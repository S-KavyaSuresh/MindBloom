from __future__ import annotations

import base64
import json
import os
import re
import traceback
from typing import Any, Dict, List, Optional

import pydantic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.services.ai import (
    OpenRouterClient,
    extract_image_data_url_from_chat,
    safe_json_loads,
)
from app.services.extract import extract_text_from_upload, pdf_to_base64_images

load_dotenv()

APP_NAME = "MindBloom API"



def _split_csv(value: str) -> List[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


cors_origins = _split_csv(os.getenv("CORS_ORIGINS", "http://localhost:5173"))

app = FastAPI(title=APP_NAME)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ai = OpenRouterClient.from_env()


@app.get("/")
def read_root() -> Dict[str, Any]:
    return {"message": "Welcome to MindBloom API", "health": "/health"}


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True, "provider": "openrouter", "text_model": ai.text_model}


class ExtractRequest(pydantic.BaseModel):
    file_b64: str
    filename: str = "file"


@app.post("/api/extract-text")
async def api_extract_text(req: ExtractRequest) -> Dict[str, str]:
    """Accept JSON body: { "file_b64": "<base64>", "filename": "doc.pdf" }
    Decodes and extracts text from PDF, DOCX, or TXT — no python-multipart needed.
    """
    try:
        import base64 as _base64
        from io import BytesIO
        raw = _base64.b64decode(req.file_b64)
        name = req.filename.lower()

        if name.endswith(".pdf"):
            from pypdf import PdfReader
            from app.services.extract import clean_pdf_text
            reader = PdfReader(BytesIO(raw))
            parts = [page.extract_text() or "" for page in reader.pages]
            text = clean_pdf_text("\n\n".join(p for p in parts if p.strip()))
        elif name.endswith(".docx"):
            from docx import Document
            doc = Document(BytesIO(raw))
            text = "\n".join(p.text.strip() for p in doc.paragraphs if p.text.strip())
        elif name.endswith((".txt", ".md")):
            try:
                text = raw.decode("utf-8")
            except Exception:
                text = raw.decode("latin-1", errors="ignore")
        else:
            try:
                text = raw.decode("utf-8")
            except Exception:
                text = raw.decode("latin-1", errors="ignore")

        return {"text": text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract text: {str(e)}") from e


@app.post("/api/simplify")
async def api_simplify(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = (payload.get("text") or "").strip()
    mode = payload.get("mode", "text")
    is_pdf = payload.get("is_pdf", False)
    raw_file_b64 = payload.get("file_b64")

    images = []
    if is_pdf and raw_file_b64:
        try:
            pdf_bytes = base64.b64decode(raw_file_b64)
            images = await pdf_to_base64_images(pdf_bytes)
            images = images[:3]
        except Exception as e:
            print(f"Vision processing failed: {e}")

    system_prompt = (
        "You are a warm, clear tutor helping a student with dyslexia. "
        "You MUST return ONLY a valid JSON object. "
        "Start your response with { and end with }. "
        "No markdown code fences like ```json, no explanation before or after the JSON."
    )

    # Use the text as a separate user message
    if images:
        input_part = "Please analyse the attached study material images."
    else:
        input_part = text

    instructions = (
        "Analyze the text and return a JSON object with these 8 keys:\n\n"
        "```json\n"
        "{\n"
        '  "simplified": "string - max 400 words",\n'
        '  "keypoints": ["array of 6-8 short phrases"],\n'
        '  "examples": ["array of 2-3 examples"],\n'
        '  "mindmap": "string - Mermaid syntax",\n'
        '  "summary": "string - exactly 3 sentences",\n'
        '  "layman": "string - 2-3 simple sentences",\n'
        '  "visuals": ["array of 2-3 image prompts"],\n'
        '  "abbreviations": [{"short":"str","full":"str"}]\n'
        "}\n"
        "```\n\n"
        "FIELD REQUIREMENTS:\n"
        "• simplified: Plain language rewrite (max 400 words). Use **bold** for key terms. Short paragraphs.\n"
        "• keypoints: 6-8 bullet facts, each under 10 words\n"
        "• examples: 2-3 concrete examples\n"
        "• summary: Exactly 3 short sentences\n"
        "• layman: Explain like to a 10-year-old (2-3 sentences)\n"
        "• mindmap: Mermaid mindmap code starting with 'mindmap\\n  root\\n    branch1\\n    branch2'\n"
        "• visuals: 2-3 short image descriptions (under 12 words each)\n"
        "• abbreviations: Any acronyms found, or empty array []\n\n"
        "CRITICAL: Your response must be ONLY the JSON object. Start with { and end with }.\n\n"
        "TEXT TO ANALYZE:\n"
    )

    user_message = instructions + input_part

    try:
        # Don't use response_format_json - it's too strict for Groq
        if images:
            content = await ai.chat_vision(
                system=system_prompt,
                user=instructions,
                images=images,
            )
        else:
            content = await ai.chat_text(
                system=system_prompt,
                user=user_message,
                response_format_json=False,  # Changed to False
            )

        # Clean up the response
        content = content.strip()
        
        # Remove markdown code fences if present
        if content.startswith("```"):
            # Find the first { and last }
            start_idx = content.find("{")
            end_idx = content.rfind("}")
            if start_idx != -1 and end_idx != -1:
                content = content[start_idx:end_idx + 1]
        
        print(f"Cleaned content (first 300 chars): {content[:300]}")
        
        # Try to parse the JSON response
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as json_err:
            print(f"JSON decode error: {json_err}")
            print(f"Full response: {content}")
            
            # Try to extract JSON from the response
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                try:
                    parsed = json.loads(json_match.group(0))
                    print("Successfully extracted JSON from response")
                except Exception as e2:
                    print(f"Failed to parse extracted JSON: {e2}")
                    raise HTTPException(
                        status_code=500, 
                        detail="AI returned incomplete JSON. Try with shorter text."
                    )
            else:
                raise HTTPException(
                    status_code=500, 
                    detail="AI did not return valid JSON format."
                )
        
        # Validate and return response
        return {
            "simplified":    parsed.get("simplified", ""),
            "keypoints":     parsed.get("keypoints", []) if isinstance(parsed.get("keypoints"), list) else [],
            "examples":      parsed.get("examples", []) if isinstance(parsed.get("examples"), list) else [],
            "mindmap":       parsed.get("mindmap", ""),
            "summary":       parsed.get("summary", ""),
            "layman":        parsed.get("layman", ""),
            "visuals":       parsed.get("visuals", []) if isinstance(parsed.get("visuals"), list) else [],
            "abbreviations": parsed.get("abbreviations", []) if isinstance(parsed.get("abbreviations"), list) else [],
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Simplification error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to simplify: {str(e)}") from e


@app.post("/api/mindmap")
async def api_mindmap(payload: Dict[str, Any]) -> Dict[str, str]:
    text = payload.get("text")
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=400, detail="Missing or invalid 'text'")

    prompt = f"""
Create a Mermaid mindmap for this text.

Requirements:
- Output ONLY Mermaid mindmap syntax.
- Start with: mindmap
- Use short words/phrases.
- Use 1 central topic and 3–6 branches.

Text:
\"\"\"{text}\"\"\"
"""
    try:
        mermaid = await ai.chat_text(
            system="Return only Mermaid mindmap syntax. No markdown.",
            user=prompt,
            response_format_json=False,
        )
        mermaid = mermaid.strip().replace("```mermaid", "").replace("```", "").strip()
        return {"mermaid": mermaid}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to generate mindmap") from e


@app.post("/api/quiz")
async def api_quiz(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = payload.get("text")
    count = payload.get("count", 6)
    exclude = payload.get("exclude", [])
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=400, detail="Missing or invalid 'text'")

    try:
        n = int(count)
    except Exception:
        n = 6
    n = max(3, min(12, n))

    exclude_note = f"\nIMPORTANT: Do NOT repeat these already-asked questions: {exclude}" if exclude else ""

    prompt = f"""
Create a quiz from this study text for a child with dyslexia.

Return ONLY valid JSON with this shape:
{{
  "questions": [
    {{
      "question": string,
      "choices": string[],
      "answerIndex": number,
      "explanation": string
    }}
  ]
}}

Rules:
- Create exactly {n} DIFFERENT questions.
- Each question must have 4 choices.
- Keep questions short and clear.
- Explanations must be simple (1 sentence).
- Ask about different aspects of the text.{exclude_note}

Study text:
\"\"\"{text}\"\"\"
"""

    try:
        content = await ai.chat_text(
            system="Return only valid JSON. No markdown.",
            user=prompt,
            response_format_json=True,
        )
        parsed = safe_json_loads(content)
        questions = parsed.get("questions")
        if not isinstance(questions, list):
            questions = []
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to generate quiz") from e


@app.post("/api/assistant")
async def api_assistant(payload: Dict[str, Any]) -> Dict[str, str]:
    message = payload.get("message")
    if not isinstance(message, str) or not message.strip():
        raise HTTPException(status_code=400, detail="Missing or invalid 'message'")

    # Classify the message type
    msg_lower = message.lower().strip()
    is_greeting = any(w in msg_lower for w in ["hello","hi","hey","hai","hii","helo","sup","howdy"])
    
    if is_greeting:
        system = "You are a friendly AI study assistant. Respond to greetings with exactly 1-2 sentences. Be warm and brief. No lists. No emojis spam."
        user_prompt = f"Student said: '{message}'. Reply with a short, warm greeting (1-2 sentences max)."
    else:
        system = "You are a concise AI study assistant for a student with dyslexia. Give clear, direct answers. Use simple language. Max 4-5 short sentences or 3-4 bullet points. No long paragraphs."
        user_prompt = f"""Answer this student question clearly and briefly:
"{message}"

Rules:
- Max 4-5 sentences OR 3-4 short bullet points
- Simple language, short sentences
- Be encouraging but brief
- 1 emoji maximum"""

    try:
        answer = await ai.chat_text(
            system=system,
            user=user_prompt,
            response_format_json=False,
        )
        return {"answer": answer.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to answer") from e


@app.post("/api/image")
async def api_image(payload: Dict[str, Any]) -> Dict[str, Optional[str]]:
    prompt = payload.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise HTTPException(status_code=400, detail="Missing or invalid 'prompt'")

    try:
        completion = await ai.chat_image_gen(prompt=prompt)
        image_data_url = extract_image_data_url_from_chat(completion)
        return {"imageDataUrl": image_data_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to generate image") from e


@app.get("/api/quote")
async def api_quote() -> Dict[str, str]:
    prompt = "Give me one short, inspiring, unique motivational quote for a student with dyslexia. No hashtags. No repetition."
    try:
        quote = await ai.chat_text(
            system="You are a warm, encouraging mentor.",
            user=prompt,
            response_format_json=False
        )
        return {"quote": quote.strip()}
    except Exception:
        return {"quote": "Believe in yourself, you're doing great!"}


@app.post("/api/smart-schedule")
async def api_smart_schedule(payload: Dict[str, Any]) -> Dict[str, Any]:
    subjects = payload.get("subjects", [])
    hours_per_day = payload.get("hours_per_day", payload.get("hours", 2))
    priority_subjects = payload.get("priority_subjects", [])
    study_days = payload.get("study_days", ["Mon","Tue","Wed","Thu","Fri"])
    document_text = payload.get("document_text", "")

    days_str = ", ".join(study_days) if study_days else "Monday to Friday"
    subjects_str = ", ".join(subjects) if subjects else "General study"
    priority_str = ", ".join(priority_subjects) if priority_subjects else "none specified"
    doc_snippet = document_text[:3000] if document_text else ""

    prompt = f"""
Create a smart, adaptive weekly study schedule for a student with dyslexia.

INPUT:
- Subjects to study: {subjects_str}
- Priority subjects (give more time): {priority_str}
- Study days: {days_str}
- Available hours per day: {hours_per_day}
- Document content (if provided, use headings to structure topics): {doc_snippet}

RULES:
1. Each study session should be 20-35 minutes (dyslexic students need shorter focused sessions).
2. ALWAYS include 5-minute breaks between study sessions.
3. Prioritize subjects marked as priority by giving them more sessions per week.
4. If document_text is provided: extract headings/topics and allocate time proportional to content length.
5. Spread sessions across the provided study days.
6. Sessions start at 09:00 and continue sequentially.
7. Include variety - alternate subjects where possible.

Return ONLY valid JSON in this EXACT format (no markdown, no backticks):
{{
  "schedule": [
    {{
      "day": "Monday",
      "sessions": [
        {{ "subject": "Math", "startTime": "09:00", "duration": "30 min", "type": "study" }},
        {{ "subject": "Break", "startTime": "09:30", "duration": "5 min", "type": "break" }},
        {{ "subject": "Science", "startTime": "09:35", "duration": "25 min", "type": "study" }}
      ]
    }}
  ]
}}

IMPORTANT: Always include "type" field - either "study" or "break". Include at least one break per day.
"""
    try:
        raw = await ai.chat_text(
            system="You are an expert educational planner specializing in dyslexia-friendly study schedules. Return only valid JSON.",
            user=prompt,
            response_format_json=True
        )
        parsed = safe_json_loads(raw)
        schedule = parsed.get("schedule", [])
        if not schedule:
            raise ValueError("Empty schedule returned")
        return {"schedule": schedule}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create schedule: {str(e)}") from e

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


@app.get("/api/story")
async def api_story(used: str = "") -> dict:
    used_list = [s.strip() for s in used.split("||") if s.strip()]
    exclude_note = f"\nDo NOT tell any of these stories again (titles): {', '.join(used_list[:10])}" if used_list else ""
    prompt = f"""Tell a short, fun story for a child (8-14 years old). 
Choose randomly between: a funny story OR a moral story OR an adventure story.
The story must be completely original and unique each time.{exclude_note}

Return ONLY valid JSON:
{{
  "title": string,
  "type": "funny" | "moral" | "adventure",
  "story": string,
  "moral": string  
}}

Rules:
- story: 150-200 words, simple language, engaging
- moral: one short sentence (the lesson). If funny, make it light-hearted.
- Keep it age-appropriate and positive"""
    try:
        raw = await ai.chat_text(
            system="You are a creative storyteller for children. Return only valid JSON.",
            user=prompt,
            response_format_json=True
        )
        parsed = safe_json_loads(raw)
        return {
            "title": parsed.get("title", "A Fun Story"),
            "type": parsed.get("type", "funny"),
            "story": parsed.get("story", ""),
            "moral": parsed.get("moral", ""),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to generate story") from e


@app.post("/api/references")
async def api_references(payload: dict) -> dict:
    topic = payload.get("topic", "")
    keywords = payload.get("keywords", [])
    if not topic and not keywords:
        raise HTTPException(status_code=400, detail="Provide topic or keywords")
    
    kw_str = ", ".join(keywords[:8]) if keywords else topic
    prompt = f"""Generate useful reference resources for a student studying this topic: "{kw_str}"

Return ONLY valid JSON:
{{
  "youtube": [
    {{"title": string, "channel": string, "url": string, "desc": string}}
  ],
  "websites": [
    {{"title": string, "url": string, "desc": string}}
  ]
}}

Rules:
- youtube: 3-4 real, well-known educational YouTube videos (Khan Academy, CrashCourse, TED-Ed, Kurzgesagt, etc.)
- websites: 3-4 real, reputable educational websites (Wikipedia, BBC Bitesize, Khan Academy, NASA, National Geographic, etc.)
- Only include REAL URLs that actually exist
- Keep descriptions short (1 sentence)"""
    try:
        raw = await ai.chat_text(
            system="You are a helpful librarian. Return only valid JSON with real educational links.",
            user=prompt,
            response_format_json=True
        )
        parsed = safe_json_loads(raw)
        return {
            "youtube": parsed.get("youtube", []),
            "websites": parsed.get("websites", []),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch references") from e


@app.post("/api/revision-schedule")
async def api_revision_schedule(payload: dict) -> dict:
    original_schedule = payload.get("original_schedule", [])
    hours_per_day = payload.get("hours_per_day", 1.5)
    study_days = payload.get("study_days", ["Mon", "Tue", "Wed", "Thu", "Fri"])

    # Extract ALL unique subjects with their average session duration
    subject_map = {}
    for day in original_schedule:
        for s in day.get("sessions", []):
            if s.get("type") != "break":
                subj = s["subject"]
                dur = s.get("duration", "30 min")
                m = re.search(r"(\d+)", str(dur))
                mins = int(m.group(1)) if m else 30
                if subj not in subject_map:
                    subject_map[subj] = []
                subject_map[subj].append(mins)

    if not subject_map:
        raise HTTPException(status_code=400, detail="No subjects found in original schedule")

    # ALL subjects must appear — revision time = 50-60% of original average
    subjects_str = ""
    for subj, durations in subject_map.items():
        avg = sum(durations) // len(durations)
        rev = max(10, int(avg * 0.55))
        subjects_str += f"- {subj}: was ~{avg} min → revise in {rev} min\n"

    days_str = ", ".join(study_days)
    n_days = len(study_days)

    prompt = f"""Create a REVISION study schedule that covers ALL the listed subjects.

ALL SUBJECTS TO REVISE (every single one must appear):
{subjects_str}

SETTINGS:
- Study days: {days_str} ({n_days} days total)
- Hours available per day: {hours_per_day}
- Start time: 09:00

STRICT RULES:
1. EVERY subject listed above MUST appear at least once in the schedule
2. Revision sessions: 10-20 minutes only (shorter than original learning)
3. Add a 5-minute break after every 2 study sessions
4. Distribute subjects as evenly as possible across all {n_days} days
5. If a subject can't fit on one day, put it on the next day
6. Label subjects clearly as "X Revision" (e.g. "Math Revision")

Return ONLY valid JSON:
{{
  "schedule": [
    {{
      "day": "Monday",
      "sessions": [
        {{ "subject": "Math Revision", "startTime": "09:00", "duration": "15 min", "type": "study" }},
        {{ "subject": "Science Revision", "startTime": "09:15", "duration": "12 min", "type": "study" }},
        {{ "subject": "Break", "startTime": "09:27", "duration": "5 min", "type": "break" }}
      ]
    }}
  ]
}}"""
    try:
        raw = await ai.chat_text(
            system="You are an expert study planner. Return only valid JSON.",
            user=prompt,
            response_format_json=True
        )
        parsed = safe_json_loads(raw)
        return {"schedule": parsed.get("schedule", [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create revision schedule: {e}") from e
