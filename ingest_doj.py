"""Validate and rebuild the local DoJ retrieval corpus."""
from rag_service import DoJRagService
if __name__ == "__main__":
    service = DoJRagService()
    print(f"Validated DoJ corpus: {len(service.chunks)} chunks; size=900, overlap=150")
