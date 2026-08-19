"""Local, auditable RAG retrieval for the DoJ knowledge base."""
from __future__ import annotations
import json
import math
import re
from collections import Counter
from pathlib import Path
from typing import Any

DATA_FILE = Path(__file__).parent / "data" / "doj_sources.json"
CHUNK_SIZE, CHUNK_OVERLAP, TOP_K = 900, 150, 3
REFUSAL_EN = "I can’t answer that from the verified Department of Justice and eCourts material currently retrieved. I won’t guess about case-specific numbers, deadlines, or status."
REFUSAL_HI = "मुझे प्राप्त सत्यापित Department of Justice और eCourts सामग्री में इसका उत्तर नहीं मिला। मैं केस-विशिष्ट संख्या, समय-सीमा या स्थिति के बारे में अनुमान नहीं लगाऊँगा/लगाऊँगी।"

def detect_language(text: str) -> str:
    return "hi" if re.search(r"[\u0900-\u097F]", text) else "en"

def sanitize_user_input(text: str) -> str:
    """Keep queries as data, strip controls, and neutralise instruction overrides."""
    text = re.sub(r"[\x00-\x1f\x7f]", " ", text).strip()
    text = re.sub(r"(?i)\b(ignore|disregard|override)\s+(all\s+)?(previous|prior|system)\s+instructions?\b", "[instruction removed]", text)
    return re.sub(r"\s+", " ", text)[:2000]

def contains_pii(text: str) -> bool:
    return bool(re.search(r"\b[A-Z0-9]{16}\b|\b(?:\+91[- ]?)?[6-9]\d{9}\b", text, re.I))

def _tokens(text: str) -> list[str]:
    return re.findall(r"[\w\-]+", text.lower(), flags=re.UNICODE)

def chunk_document(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Chunk on paragraphs, retaining a numbered procedure as one atomic unit."""
    units = [unit.strip() for unit in re.split(r"\n\s*\n", text) if unit.strip()]
    chunks, current = [], ""
    for unit in units:
        if current and len(current) + len(unit) + 2 > size:
            chunks.append(current)
            tail = current[-overlap:] if overlap else ""
            current = tail + ("\n\n" if tail else "") + unit
        else:
            current = (current + "\n\n" if current else "") + unit
    return chunks + ([current] if current else [])

class DoJRagService:
    def __init__(self, data_file: Path = DATA_FILE):
        raw_docs = json.loads(data_file.read_text(encoding="utf-8"))
        self.chunks: list[dict[str, Any]] = []
        for doc in raw_docs:
            required = {"source_url", "section", "last_verified_date", "content"}
            missing = required - doc.keys()
            if missing: raise ValueError(f"DoJ source has missing metadata: {missing}")
            for content in chunk_document(doc["content"]):
                self.chunks.append({"content": content, "metadata": {key: doc[key] for key in required - {"content"}}})
        self.document_frequency = Counter(token for chunk in self.chunks for token in set(_tokens(chunk["content"])))

    def retrieve(self, query: str, top_k: int = TOP_K) -> list[dict[str, Any]]:
        terms, total = _tokens(query), len(self.chunks)
        if not terms: return []
        query_counts, scored = Counter(terms), []
        for chunk in self.chunks:
            counts = Counter(_tokens(chunk["content"]))
            score = sum((1 + math.log(counts[t])) * (math.log((total + 1) / (self.document_frequency[t] + 1)) + 1) * q for t, q in query_counts.items() if counts[t])
            if score: scored.append((score, chunk))
        return [chunk for _, chunk in sorted(scored, key=lambda item: item[0], reverse=True)[:top_k]]

    def get_response(self, query: str, session_id: str | None = None) -> dict[str, Any]:
        language, clean_query = detect_language(query), sanitize_user_input(query)
        if contains_pii(query):
            return self._refusal(language)
        retrieved = self.retrieve(clean_query)
        if not retrieved or "[instruction removed]" in clean_query: return self._refusal(language)
        sources = [{"source_url": c["metadata"]["source_url"], "section": c["metadata"]["section"], "last_verified_date": c["metadata"]["last_verified_date"]} for c in retrieved]
        return {"type": "grounded_context", "title": "Nyaya Mitra" if language == "en" else "न्याय मित्र", "message": "\n\n".join(c["content"] for c in retrieved), "sources": sources, "language": language}

    @staticmethod
    def _refusal(language: str) -> dict[str, Any]:
        return {"type": "refusal", "title": "Nyaya Mitra" if language == "en" else "न्याय मित्र", "message": REFUSAL_HI if language == "hi" else REFUSAL_EN, "sources": [], "language": language}
