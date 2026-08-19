"""Compatibility facade for the DoJ retrieval-augmented assistant."""
from rag_service import DoJRagService


class DoJChatbot(DoJRagService):
    """Retained name for callers of the original application."""
