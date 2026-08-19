from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import os
import json
from datetime import datetime
from dotenv import load_dotenv

from doj_chatbot import DoJChatbot

load_dotenv()

app = FastAPI(
    title="DoJ Chatbot API (Nyaya)",
    description="Department of Justice (DoJ) Virtual Assistant / Chatbot Engine to assist citizens, advocates, and litigants.",
    version="1.0.0"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DoJ Chatbot engine
chatbot_engine = DoJChatbot()

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default_session"

class FeedbackRequest(BaseModel):
    query: str
    response_title: str
    is_helpful: bool

class CaseLookupRequest(BaseModel):
    cnr_number: str

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": "Department of Justice Virtual Assistant (Nyaya)",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Main Chat API Endpoint. Accepts JSON message.
    """
    try:
        response = chatbot_engine.get_response(
            query=request.message,
            session_id=request.session_id
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.post("/api/feedback")
async def feedback_endpoint(request: FeedbackRequest):
    """
    Handles user feedback for responses. Saves it to feedback.json.
    """
    feedback_file = os.path.join(os.path.dirname(__file__), "feedback.json")
    feedback_data = []
    if os.path.exists(feedback_file):
        try:
            with open(feedback_file, "r", encoding="utf-8") as f:
                feedback_data = json.load(f)
        except Exception:
            pass
            
    feedback_data.append({
        "timestamp": datetime.utcnow().isoformat(),
        "query": request.query,
        "response_title": request.response_title,
        "is_helpful": request.is_helpful
    })
    
    try:
        with open(feedback_file, "w", encoding="utf-8") as f:
            json.dump(feedback_data, f, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save feedback: {str(e)}")
        
    return {"status": "success"}

@app.post("/api/case-lookup")
async def case_lookup_endpoint(request: CaseLookupRequest):
    """
    Returns guidance only. This application has no eCourts data connection.
    """
    return {
        "status": "EXTERNAL_LOOKUP_REQUIRED",
        "message": "No case records are stored or searched by this prototype. Use the official eCourts case-status portal with your CNR number."
    }

@app.get("/api/judges-stats")
async def get_judges_stats():
    """
    Returns judges appointment and vacancy data.
    """
    return {
        "last_updated": "Prototype sample — not a live feed",
        "supreme_court": {"working": 33, "sanctioned": 34, "vacancies": 1},
        "high_courts": {"working": 790, "sanctioned": 1114, "vacancies": 324},
        "district_courts": {"working": 19850, "sanctioned": 25246, "vacancies": 5396}
    }

@app.get("/api/njdg-stats")
async def get_njdg_stats():
    """
    Returns prototype sample values; it does not query NJDG.
    """
    return {
        "district_courts_pending": "4.4 Crore",
        "high_courts_pending": "62 Lakhs",
        "cases_disposed_this_month": "14.2 Lakhs"
    }

# Mount static directory for frontend web UI
static_dir = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_index():
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "DoJ Chatbot API Running. Static UI loading..."}
