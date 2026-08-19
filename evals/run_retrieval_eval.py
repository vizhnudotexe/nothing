"""Tracked, non-gating retrieval evaluation for the SIH1700 gold set."""
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rag_service import DoJRagService

service = DoJRagService()
gold = json.loads((Path(__file__).parent / "gold_set.json").read_text())
for item in gold:
    sections = [chunk["metadata"]["section"] for chunk in service.retrieve(item["query"])]
    expected = item["expected_section"]
    print({"query": item["query"], "expected": expected, "retrieved_sections": sections, "match": expected in sections if expected else None})
