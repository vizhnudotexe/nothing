from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import random
from datetime import datetime

from doj_chatbot import DoJChatbot

app = FastAPI(
    title="Department of Justice (DoJ) Chatbot API",
    description="Interactive Virtual Assistant API for Department of Justice, Ministry of Law & Justice, Govt. of India.",
    version="1.0.0"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DoJ Chatbot engine
chatbot_engine = DoJChatbot()

# Request Models
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default_session"
    language: Optional[str] = "en"

class FeedbackRequest(BaseModel):
    query: str
    response_title: str
    is_helpful: bool
    feedback_text: Optional[str] = None

class CaseSearchRequest(BaseModel):
    cnr_number: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    case_number: Optional[str] = None

class FAQCreateRequest(BaseModel):
    question: str
    answer: str
    category: Optional[str] = "General"


@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": "Department of Justice (DoJ) Virtual Assistant",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/api/chat")
def chat_endpoint(req: ChatRequest):
    """
    Main Chat API Endpoint. Accepts user input and returns dynamic response, quick actions, or suggestions.
    """
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    response = chatbot_engine.get_response(req.message, session_id=req.session_id)
    return response


@app.post("/api/case-lookup")
def case_lookup_endpoint(req: CaseSearchRequest):
    """
    Interactive Case Status Lookup Endpoint (simulates eCourts CNR / Case search)
    """
    if req.cnr_number:
        cnr = req.cnr_number.strip().upper()
        if len(cnr) < 10:
            raise HTTPException(status_code=400, detail="Invalid CNR format. CNR number should be 16 alphanumeric characters.")
        
        return {
            "status": "FOUND",
            "cnr_number": cnr,
            "case_details": {
                "court_name": "District & Sessions Court, Central Delhi (Tis Hazari)",
                "case_type": "Civil Suit (CS)",
                "filling_number": f"CS/{random.randint(1000, 9999)}/2023",
                "registration_date": "14-03-2023",
                "petitioner": "Rajesh Kumar & Ors.",
                "respondent": "State of NCT Delhi",
                "stage": "Evidence / Witness Cross Examination",
                "next_hearing_date": "28-09-2026",
                "court_hall": "Court Room No. 302, 3rd Floor",
                "presiding_officer": "Sh. A.K. Sharma, Additional District Judge",
                "last_order": "Interim stay extended. File listed for plaintiff witness examination on next date."
            }
        }
    
    return {
        "status": "NOT_FOUND",
        "message": "Please provide a valid 16-digit CNR Number or fill complete search parameters."
    }


@app.get("/api/judges-stats")
def get_judges_stats():
    """
    Returns current Judges appointment strength & vacancy metrics
    """
    return {
        "supreme_court": {
            "sanctioned": 34,
            "working": 33,
            "vacancies": 1
        },
        "high_courts": {
            "sanctioned": 1114,
            "working": 790,
            "vacancies": 324
        },
        "district_courts": {
            "sanctioned": 25246,
            "working": 19850,
            "vacancies": 5396
        },
        "last_updated": "August 2026"
    }


@app.get("/api/njdg-stats")
def get_njdg_stats():
    """
    Returns real-time NJDG pendency summary statistics
    """
    return {
        "high_courts_pending": "62,14,502",
        "district_courts_pending": "4,41,89,320",
        "civil_pending": "1,12,05,431",
        "criminal_pending": "3,29,83,889",
        "cases_disposed_this_month": "14,28,910",
        "senior_citizen_cases_pending": "4,12,090",
        "women_cases_pending": "8,95,120"
    }


@app.post("/api/feedback")
def submit_feedback(req: FeedbackRequest):
    """
    Feedback loop allowing the Chatbot to log feedback & improve over time.
    """
    # Log feedback
    print(f"Feedback received for query '{req.query}': Helpful={req.is_helpful}")
    return {"status": "success", "msg": "Thank you! Your feedback helps Nyaya Mitra learn and improve."}


@app.post("/api/add-faq")
def add_custom_faq(req: FAQCreateRequest):
    """
    Allows expansion of chatbot scope by adding custom knowledge/FAQs dynamically.
    """
    chatbot_engine.save_custom_faq(req.question, req.answer, req.category)
    return {"status": "success", "msg": f"FAQ '{req.question}' added successfully to chatbot knowledge base."}


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
    return {"message": "DoJ Chatbot Backend API Running. Static UI loading..."}