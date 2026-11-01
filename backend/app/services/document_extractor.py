"""
Multi-format document extractor for KnowledgeX AI.
Extracts structured text sections, source-page hints, section headings, and rich metadata.
Supports PDF, DOCX, TXT, and HTML. Includes scanned PDF detection and OCR diagnostics.
"""
from __future__ import annotations

import hashlib
import io
import re
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
from pydantic import BaseModel

import structlog

log = structlog.get_logger(__name__)

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB

SUPPORTED_MIME_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "text/html": "html",
    "application/xhtml+xml": "html",
}

EXTENSION_MAP = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".txt": "txt",
    ".html": "html",
    ".htm": "html",
}


class ExtractedSection(BaseModel):
    text: str
    page: Optional[int] = None
    section_heading: Optional[str] = None


class ExtractedMetadata(BaseModel):
    title: str
    author: Optional[str] = None
    created_date: Optional[str] = None
    page_count: int = 1
    word_count: int = 0
    char_count: int = 0
    file_type: str
    content_hash: str
    mime_type: str
    has_ocr_content: bool = False
    ocr_notice: Optional[str] = None
    custom_metadata: Dict[str, Any] = {}


class ExtractionResult(BaseModel):
    sections: List[ExtractedSection]
    metadata: ExtractedMetadata
    logs: List[Dict[str, Any]]


def validate_file(content: bytes, filename: str, content_type: Optional[str] = None) -> Tuple[bool, str, Optional[str]]:
    """
    Validate file size, extension, and magic bytes for security.
    Returns: (is_valid, file_type_or_error_message, detected_mime)
    """
    if len(content) == 0:
        return False, "File is empty (0 bytes)", None

    if len(content) > MAX_UPLOAD_BYTES:
        return False, f"File exceeds maximum upload limit of {MAX_UPLOAD_BYTES // (1024 * 1024)} MB", None

    # Detect extension
    ext = Path(filename).suffix.lower()
    file_type = EXTENSION_MAP.get(ext)
    if not file_type and content_type:
        file_type = SUPPORTED_MIME_TYPES.get(content_type)

    if not file_type:
        return False, f"Unsupported file type '{ext}'. Allowed: .pdf, .docx, .txt, .html", None

    # Magic byte validation
    if file_type == "pdf":
        if not content.startswith(b"%PDF-"):
            return False, "Invalid PDF: missing '%PDF-' header signature", None
        mime = "application/pdf"
    elif file_type == "docx":
        # ZIP magic bytes PK\x03\x04 or any standard zip signature in first 32 bytes
        if b"PK" not in content[:32]:
            return False, "Invalid DOCX: missing ZIP/OpenXML signature", None
        mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif file_type == "html":
        # Basic HTML check
        sample = content[:1024].decode("utf-8", errors="ignore").lower()
        if not ("<html" in sample or "<!doctype" in sample or "<body" in sample or "<div" in sample or "<p" in sample):
            return False, "Invalid HTML: file does not contain valid HTML markup", None
        mime = "text/html"
    else:  # txt
        mime = "text/plain"

    return True, file_type, mime


class _HTMLStructuredParser(HTMLParser):
    """Custom HTML parser extracting clean structural sections with heading tags."""

    def __init__(self):
        super().__init__()
        self.sections: List[ExtractedSection] = []
        self.current_heading: Optional[str] = None
        self.current_buffer: List[str] = []
        self.title: Optional[str] = None
        self.author: Optional[str] = None
        self.in_title = False
        self.in_script = False
        self.in_style = False
        self.current_tag: Optional[str] = None

    def handle_starttag(self, tag: str, attrs: list):
        self.current_tag = tag
        attr_dict = dict(attrs)

        if tag in ("script", "style", "noscript"):
            self.in_script = True
        elif tag == "title":
            self.in_title = True
        elif tag == "meta":
            name = attr_dict.get("name", "").lower()
            if name == "author":
                self.author = attr_dict.get("content")
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self._flush_buffer()

    def handle_endtag(self, tag: str):
        if tag in ("script", "style", "noscript"):
            self.in_script = False
        elif tag == "title":
            self.in_title = False
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            heading_text = "".join(self.current_buffer).strip()
            if heading_text:
                self.current_heading = heading_text
            self.current_buffer = []
        elif tag in ("p", "div", "li", "tr", "article", "section"):
            self._flush_buffer()

    def handle_data(self, data: str):
        if self.in_script:
            return
        if self.in_title:
            if not self.title:
                self.title = data.strip()
            return
        clean = data.strip()
        if clean:
            self.current_buffer.append(data)

    def _flush_buffer(self):
        text = " ".join("".join(self.current_buffer).split()).strip()
        if text:
            self.sections.append(
                ExtractedSection(
                    text=text,
                    page=1,
                    section_heading=self.current_heading,
                )
            )
        self.current_buffer = []


async def extract_document(content: bytes, filename: str, file_type: str, mime_type: str) -> ExtractionResult:
    """
    Extract structured content, section headings, page numbers, and document metadata.
    """
    logs: List[Dict[str, Any]] = []
    content_hash = hashlib.sha256(content).hexdigest()
    logs.append({
        "stage": "validation",
        "timestamp": datetime.utcnow().isoformat(),
        "message": f"File '{filename}' validated (SHA-256: {content_hash[:12]}..., size: {len(content):,} bytes)",
    })

    sections: List[ExtractedSection] = []
    author: Optional[str] = None
    created_date: Optional[str] = None
    page_count = 1
    has_ocr_content = False
    ocr_notice = None
    custom_metadata: Dict[str, Any] = {}
    default_title = Path(filename).stem.replace("_", " ").replace("-", " ").title()
    title = default_title

    if file_type == "pdf":
        sections, title_cand, author_cand, created_cand, page_count, ocr_notice = await _extract_pdf(content, logs)
        if title_cand:
            title = title_cand
        author = author_cand
        created_date = created_cand
    elif file_type == "docx":
        sections, title_cand, author_cand, created_cand, page_count = await _extract_docx(content, logs)
        if title_cand:
            title = title_cand
        author = author_cand
        created_date = created_cand
    elif file_type == "html":
        sections, title_cand, author_cand = await _extract_html(content, logs)
        if title_cand:
            title = title_cand
        author = author_cand
        page_count = max(1, len(sections) // 5)
    else:  # txt
        sections, title_cand = await _extract_txt(content, logs)
        if title_cand:
            title = title_cand
        page_count = max(1, len(sections) // 5)

    # Word and character counts
    total_text = " ".join(s.text for s in sections)
    words = total_text.split()
    word_count = len(words)
    char_count = len(total_text)

    logs.append({
        "stage": "extraction_summary",
        "timestamp": datetime.utcnow().isoformat(),
        "message": f"Extracted {len(sections)} sections, {word_count:,} words, {char_count:,} characters across {page_count} page(s)",
    })

    metadata = ExtractedMetadata(
        title=title,
        author=author,
        created_date=created_date,
        page_count=page_count,
        word_count=word_count,
        char_count=char_count,
        file_type=file_type,
        content_hash=content_hash,
        mime_type=mime_type,
        has_ocr_content=has_ocr_content,
        ocr_notice=ocr_notice,
        custom_metadata=custom_metadata,
    )

    return ExtractionResult(sections=sections, metadata=metadata, logs=logs)


async def _extract_pdf(content: bytes, logs: List[Dict[str, Any]]) -> Tuple[List[ExtractedSection], Optional[str], Optional[str], Optional[str], int, Optional[str]]:
    import PyPDF2
    reader = PyPDF2.PdfReader(io.BytesIO(content))
    pages = len(reader.pages)
    sections: List[ExtractedSection] = []
    title = None
    author = None
    created = None
    ocr_notice = None

    if reader.metadata:
        title = reader.metadata.get("/Title")
        author = reader.metadata.get("/Author")
        created = reader.metadata.get("/CreationDate")

    scanned_pages_detected = 0

    for idx, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""
        clean_text = page_text.strip()
        if len(clean_text) < 30:
            scanned_pages_detected += 1
            # Attempt OCR diagnostics: check for pytesseract
            try:
                import pytesseract
                # If pytesseract is installed, attempt OCR
                logs.append({
                    "stage": "ocr_attempt",
                    "timestamp": datetime.utcnow().isoformat(),
                    "message": f"Page {idx} has sparse text ({len(clean_text)} chars). OCR module detected.",
                })
            except ImportError:
                pass

        if clean_text:
            # Look for heading at start of page
            first_line = clean_text.split("\n")[0].strip()
            heading = first_line if len(first_line) < 80 and not first_line.endswith(".") else None
            sections.append(ExtractedSection(text=clean_text, page=idx, section_heading=heading))

    if scanned_pages_detected > 0:
        ocr_notice = f"{scanned_pages_detected} page(s) appear to contain scanned or sparse text. (OCR engine requires tesseract system binary)"
        logs.append({
            "stage": "ocr_diagnostic",
            "timestamp": datetime.utcnow().isoformat(),
            "message": ocr_notice,
        })

    return sections, title, author, str(created) if created else None, pages, ocr_notice


async def _extract_docx(content: bytes, logs: List[Dict[str, Any]]) -> Tuple[List[ExtractedSection], Optional[str], Optional[str], Optional[str], int]:
    sections: List[ExtractedSection] = []
    title = None
    author = None
    created = None

    try:
        import docx
        doc = docx.Document(io.BytesIO(content))

        if doc.core_properties:
            title = doc.core_properties.title or None
            author = doc.core_properties.author or None
            if doc.core_properties.created:
                created = doc.core_properties.created.isoformat()

        current_heading: Optional[str] = None
        for p in doc.paragraphs:
            txt = p.text.strip()
            if not txt:
                continue
            if p.style and p.style.name and p.style.name.startswith("Heading"):
                current_heading = txt
                continue
            sections.append(ExtractedSection(text=txt, page=1, section_heading=current_heading))

        # Also extract tables cleanly
        for table in doc.tables:
            table_rows = []
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    table_rows.append(row_text)
            if table_rows:
                sections.append(
                    ExtractedSection(
                        text="\n".join(table_rows),
                        page=1,
                        section_heading=f"Table ({current_heading or 'Data'})",
                    )
                )

        if sections:
            return sections, title, author, created, max(1, len(sections) // 6)
    except Exception as exc:
        logs.append({
            "stage": "docx_extractor_warning",
            "timestamp": datetime.utcnow().isoformat(),
            "message": f"python-docx encountered an issue: {exc}. Activating direct XML zipfile parser.",
        })

    # Direct zipfile fallback for complex or modern docx files
    try:
        import zipfile
        import xml.etree.ElementTree as ET

        with zipfile.ZipFile(io.BytesIO(content)) as z:
            xml_names = ["word/document.xml"] + [
                n for n in z.namelist() if n.startswith("word/") and (
                    n.startswith("word/header") or n.startswith("word/footer") or n.startswith("word/footnotes")
                ) and n.endswith(".xml")
            ]
            for xml_name in xml_names:
                if xml_name in z.namelist():
                    xml_bytes = z.read(xml_name)
                    try:
                        root = ET.fromstring(xml_bytes)
                        # Find all w:p elements regardless of namespace prefix
                        for elem in root.iter():
                            if elem.tag.endswith("}p") or elem.tag == "p":
                                p_texts = [
                                    child.text for child in elem.iter()
                                    if (child.tag.endswith("}t") or child.tag == "t") and child.text
                                ]
                                p_full = "".join(p_texts).strip()
                                if p_full:
                                    sections.append(ExtractedSection(text=p_full, page=1))
                    except Exception:
                        # Regex extraction on <w:t> tags
                        xml_str = xml_bytes.decode("utf-8", errors="replace")
                        matches = re.findall(r"<w:t[^>]*>(.*?)</w:t>", xml_str, flags=re.DOTALL)
                        clean_matches = [m.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&").strip() for m in matches if m.strip()]
                        if clean_matches:
                            sections.append(ExtractedSection(text=" ".join(clean_matches), page=1))
    except Exception as zip_exc:
        logs.append({
            "stage": "docx_zip_warning",
            "timestamp": datetime.utcnow().isoformat(),
            "message": f"Direct zipfile extraction failed: {zip_exc}",
        })

    return sections, title, author, created, max(1, len(sections) // 6)


async def _extract_html(content: bytes, logs: List[Dict[str, Any]]) -> Tuple[List[ExtractedSection], Optional[str], Optional[str]]:
    html_text = content.decode("utf-8", errors="replace")
    parser = _HTMLStructuredParser()
    parser.feed(html_text)
    return parser.sections, parser.title, parser.author


async def _extract_txt(content: bytes, logs: List[Dict[str, Any]]) -> Tuple[List[ExtractedSection], Optional[str]]:
    text = content.decode("utf-8", errors="replace")
    lines = text.split("\n")
    sections: List[ExtractedSection] = []
    title: Optional[str] = None
    current_heading: Optional[str] = None

    buffer: List[str] = []
    for line in lines:
        sline = line.strip()
        if not sline:
            if buffer:
                sections.append(ExtractedSection(text=" ".join(buffer), page=1, section_heading=current_heading))
                buffer = []
            continue

        # Markdown-style heading detection
        if sline.startswith("#"):
            if buffer:
                sections.append(ExtractedSection(text=" ".join(buffer), page=1, section_heading=current_heading))
                buffer = []
            current_heading = sline.lstrip("#").strip()
            if not title:
                title = current_heading
            continue

        if not title and len(sline) < 80:
            title = sline

        buffer.append(sline)

    if buffer:
        sections.append(ExtractedSection(text=" ".join(buffer), page=1, section_heading=current_heading))

    return sections, title
