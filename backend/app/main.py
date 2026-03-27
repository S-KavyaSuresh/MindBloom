from __future__ import annotations

import base64
import json
import os
import re
import traceback
from typing import Any, Dict, List

import pydantic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Custom AI + extraction services
from app.services.ai import (
    OpenRouterClient,
    extract_image_data_url_from_chat,
    safe_json_loads,
)
from app.services.extract import pdf_to_base64_images

# Load environment variables (.env)
load_dotenv()

APP_NAME = "MindBloom API"


# -----------------------------
# Utility function
# -----------------------------
def _split_csv(value: str) -> List[str]:
    """Convert comma-separated string to list"""
    return [v.strip() for v in value.split(",") if v.strip()]


# -----------------------------
# FastAPI App Setup
# -----------------------------
cors_origins = _split_csv(os.getenv("CORS_ORIGINS", "http://localhost:5173"))

app = FastAPI(title=APP_NAME)

# Enable CORS (important for frontend-backend connection)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI client
ai = OpenRouterClient.from_env()


# -----------------------------
# Basic Routes
# -----------------------------
@app.get("/")
def read_root() -> Dict[str, Any]:
    """Root endpoint"""
    return {"message": "Welcome to MindBloom API", "health": "/health"}


@app.get("/health")
def health() -> Dict[str, Any]:
    """Health check endpoint"""
    return {"ok": True, "provider": "openrouter", "text_model": ai.text_model}


# -----------------------------
# Request Models
# -----------------------------
class ExtractRequest(pydantic.BaseModel):
    file_b64: str
    filename: str = "file"


# -----------------------------
# Extract Text API
# -----------------------------
@app.post("/api/extract-text")
async def api_extract_text(req: ExtractRequest) -> Dict[str, str]:
    """
    Extract text from base64 file (PDF, DOCX, TXT)
    """
    try:
        from io import BytesIO

        raw = base64.b64decode(req.file_b64)
        name = req.filename.lower()

        # PDF extraction
        if name.endswith(".pdf"):
            from pypdf import PdfReader
            from app.services.extract import clean_pdf_text

            reader = PdfReader(BytesIO(raw))
            parts = [page.extract_text() or "" for page in reader.pages]
            text = clean_pdf_text("\n\n".join(p for p in parts if p.strip()))

        # DOCX extraction
        elif name.endswith(".docx"):
            from docx import Document

            doc = Document(BytesIO(raw))
            text = "\n".join(p.text.strip() for p in doc.paragraphs if p.text.strip())

        # TXT / fallback
        else:
            try:
                text = raw.decode("utf-8")
            except Exception:
                text = raw.decode("latin-1", errors="ignore")

        return {"text": text}

    except Exception as e:
        raise HTTPException(500, f"Failed to extract text: {str(e)}")


# -----------------------------
# Simplify Text API
# -----------------------------
@app.post("/api/simplify")
async def api_simplify(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Simplifies text using AI and returns structured JSON
    """
    text = (payload.get("text") or "").strip()
    is_pdf = payload.get("is_pdf", False)
    raw_file_b64 = payload.get("file_b64")

    # Convert PDF to images if needed
    images = []
    if is_pdf and raw_file_b64:
        try:
            pdf_bytes = base64.b64decode(raw_file_b64)
            images = await pdf_to_base64_images(pdf_bytes)
            images = images[:3]  # limit images
        except Exception as e:
            print(f"Vision processing failed: {e}")

    system_prompt = "You are a helpful tutor. Return only valid JSON."

    user_message = f"Simplify this:\n{text}" if not images else "Analyze these images"

    try:
        # Call AI
        content = await ai.chat_text(
            system=system_prompt,
            user=user_message,
            response_format_json=False,
        )

        content = content.strip()

        # Remove markdown formatting if present
        if content.startswith("```"):
            start = content.find("{")
            end = content.rfind("}")
            if start != -1 and end != -1:
                content = content[start:end + 1]

        # Try parsing JSON
        try:
            parsed = json.loads(content)
        except:
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                parsed = json.loads(match.group(0))
            else:
                raise HTTPException(500, "Invalid AI JSON response")

        # Return structured response safely
        return {
            "simplified": parsed.get("simplified", ""),
            "keypoints": parsed.get("keypoints", []),
            "examples": parsed.get("examples", []),
            "mindmap": parsed.get("mindmap", ""),
            "summary": parsed.get("summary", ""),
            "layman": parsed.get("layman", ""),
            "visuals": parsed.get("visuals", []),
            "abbreviations": parsed.get("abbreviations", []),
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Simplify failed: {e}")


# -----------------------------
# Mindmap API
# -----------------------------
@app.post("/api/mindmap")
async def api_mindmap(payload: Dict[str, Any]) -> Dict[str, str]:
    """Generate Mermaid mindmap"""
    text = payload.get("text")
    if not text:
        raise HTTPException(400, "Missing text")

    prompt = f"Create Mermaid mindmap:\n{text}"

    mermaid = await ai.chat_text(
        system="Return only Mermaid syntax",
        user=prompt,
        response_format_json=False,
    )

    return {"mermaid": mermaid.strip().replace("```", "")}


# -----------------------------
# Quiz API
# -----------------------------
@app.post("/api/quiz")
async def api_quiz(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Generate quiz questions"""
    text = payload.get("text")
    if not text:
        raise HTTPException(400, "Missing text")

    content = await ai.chat_text(
        system="Return only JSON",
        user=f"Create quiz:\n{text}",
        response_format_json=True,
    )

    parsed = safe_json_loads(content)
    return {"questions": parsed.get("questions", [])}


# -----------------------------
# Assistant API
# -----------------------------
@app.post("/api/assistant")
async def api_assistant(payload: Dict[str, Any]) -> Dict[str, str]:
    """Chat assistant"""
    message = payload.get("message")
    if not message:
        raise HTTPException(400, "Missing message")

    answer = await ai.chat_text(
        system="Give short simple answers",
        user=message,
        response_format_json=False,
    )

    return {"answer": answer.strip()}


# -----------------------------
# Image Generation API
# -----------------------------
@app.post("/api/image")
async def api_image(payload: Dict[str, Any]) -> Dict[str, str]:
    """Generate image from prompt"""
    prompt = payload.get("prompt")
    if not prompt:
        raise HTTPException(400, "Missing prompt")

    completion = await ai.chat_image_gen(prompt=prompt)
    return {"imageDataUrl": extract_image_data_url_from_chat(completion)}


# -----------------------------
# Quote API
# -----------------------------
@app.get("/api/quote")
async def api_quote():
    """Motivational quote"""
    quote = await ai.chat_text(
        system="Motivational mentor",
        user="Give one short quote",
        response_format_json=False
    )
    return {"quote": quote.strip()}


# -----------------------------
# Smart Schedule API
# -----------------------------
@app.post("/api/smart-schedule")
async def api_smart_schedule(payload: Dict[str, Any]):
    """Generate study schedule"""
    raw = await ai.chat_text(
        system="Return JSON schedule",
        user=str(payload),
        response_format_json=True
    )
    return {"schedule": safe_json_loads(raw).get("schedule", [])}


# -----------------------------
# Story API
# -----------------------------
@app.get("/api/story")
async def api_story():
    """Generate story"""
    raw = await ai.chat_text(
        system="Return story JSON",
        user="Give a short story",
        response_format_json=True
    )
    return safe_json_loads(raw)


# -----------------------------
# References API
# -----------------------------
@app.post("/api/references")
async def api_references(payload: dict):
    """Get learning resources"""
    raw = await ai.chat_text(
        system="Return links JSON",
        user=str(payload),
        response_format_json=True
    )
    return safe_json_loads(raw)


# -----------------------------
# Revision Schedule API
# -----------------------------
@app.post("/api/revision-schedule")
async def api_revision_schedule(payload: dict):
    """Generate revision schedule"""
    raw = await ai.chat_text(
        system="Return revision JSON",
        user=str(payload),
        response_format_json=True
    )
    return {"schedule": safe_json_loads(raw).get("schedule", [])}


# -----------------------------
# Run Server
# -----------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
