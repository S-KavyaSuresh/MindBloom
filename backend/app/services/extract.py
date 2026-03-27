from __future__ import annotations

import base64
import re
from io import BytesIO
from typing import List

from fastapi import UploadFile
from pypdf import PdfReader
from docx import Document


def clean_pdf_text(text: str) -> str:
    """
    Cleans and formats raw text extracted from PDFs.

    Handles common extraction issues:
    - Words split across lines (word-per-line issue)
    - Extra spaces from justified text
    - Broken sentences across lines
    - Missing paragraph breaks for headings
    """
    if not text:
        return text

    # Step 1: Fix word-per-line issue (e.g., "word\n \nword")
    prev = None
    while prev != text:
        prev = text
        text = re.sub(r'([^\n])\n \n([^\n])', r'\1 \2', text)

    # Step 2: Merge lines that belong to the same sentence
    lines = text.split('\n')
    merged = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            merged.append('')
            i += 1
            continue

        # Continue merging until a sentence ends or a new structured line starts
        while i + 1 < len(lines):
            next_line = lines[i + 1].strip()
            if not next_line:
                break
            if re.search(r'[.!?]\s*(\[\d[^\]]*\])?\s*$', line):
                break
            if re.match(r'^(●|•|\d+\.\s|https?://|\[\d)', next_line):
                break
            i += 1
            line = line + ' ' + lines[i].strip()

        merged.append(line)
        i += 1

    text = '\n'.join(merged)

    # Step 3: Normalize multiple spaces into a single space
    text = re.sub(r'  +', ' ', text)

    # Step 4: Insert paragraph breaks before detected section headings
    text = re.sub(r'(?<=[a-z\.\]\d])\s+(The [A-Z][a-z])', r'\n\n\1', text)
    text = re.sub(r'(?<=[a-z\.\]\d])\s+(Dwarf|Exploration|Beyond|In \d{4})', r'\n\n\1', text)

    # Step 5: Reduce excessive blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


async def extract_text_from_upload(file: UploadFile) -> str:
    name = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()
    data = await file.read()

    if not data:
        return ""

    # Handle plain text files (.txt, .md, etc.)
    if content_type.startswith("text/") or name.endswith((".txt", ".md")):
        try:
            return data.decode("utf-8")
        except Exception:
            return data.decode("latin-1", errors="ignore")

    # Handle PDF files
    if content_type == "application/pdf" or name.endswith(".pdf"):
        reader = PdfReader(BytesIO(data))
        parts = []
        for page in reader.pages:
            txt = page.extract_text() or ""
            if txt.strip():
                parts.append(txt)
        raw = "\n\n".join(parts).strip()
        return clean_pdf_text(raw)

    # Handle DOCX files
    if (
        content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        or name.endswith(".docx")
    ):
        doc = Document(BytesIO(data))
        parts = []
        for p in doc.paragraphs:
            if p.text and p.text.strip():
                parts.append(p.text.strip())
        return "\n".join(parts).strip()

    # Reject unsupported .doc format
    if name.endswith(".doc"):
        raise ValueError("DOC files are not supported. Please upload DOCX or PDF.")

    # Fallback: attempt generic decoding
    try:
        return data.decode("utf-8")
    except Exception:
        return data.decode("latin-1", errors="ignore")


async def pdf_to_base64_images(data: bytes) -> List[str]:
    try:
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(data, dpi=150)
        result = []
        for img in images:
            buf = BytesIO()
            img.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            result.append(f"data:image/png;base64,{b64}")
        return result
    except Exception:
        return []
