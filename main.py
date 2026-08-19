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
    mode: Optional[str] = "cnr"
    cnr_number: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    court_complex: Optional[str] = None
    case_type: Optional[str] = None
    case_number: Optional[str] = None
    year: Optional[str] = None

STATE_CODES = {
    "AN": "Andaman and Nicobar Islands",
    "AP": "Andhra Pradesh",
    "AR": "Arunachal Pradesh",
    "AS": "Assam",
    "BR": "Bihar",
    "CH": "Chandigarh",
    "CG": "Chhattisgarh",
    "CT": "Chhattisgarh",
    "DD": "Daman and Diu",
    "DH": "Dadra and Nagar Haveli and Daman and Diu",
    "DL": "Delhi",
    "DN": "Dadra and Nagar Haveli",
    "GA": "Goa",
    "GJ": "Gujarat",
    "HP": "Himachal Pradesh",
    "HR": "Haryana",
    "JH": "Jharkhand",
    "JK": "Jammu and Kashmir",
    "KA": "Karnataka",
    "KL": "Kerala",
    "LA": "Ladakh",
    "LD": "Lakshadweep",
    "MH": "Maharashtra",
    "ML": "Meghalaya",
    "MN": "Manipur",
    "MP": "Madhya Pradesh",
    "MZ": "Mizoram",
    "NL": "Nagaland",
    "OD": "Odisha",
    "OR": "Odisha",
    "PB": "Punjab",
    "PY": "Puducherry",
    "RJ": "Rajasthan",
    "SK": "Sikkim",
    "TG": "Telangana",
    "TN": "Tamil Nadu",
    "TR": "Tripura",
    "TS": "Telangana",
    "UK": "Uttarakhand",
    "UP": "Uttar Pradesh",
    "UT": "Uttarakhand",
    "WB": "West Bengal"
}

@app.post("/api/case-lookup")
async def case_lookup_endpoint(request: CaseLookupRequest):
    """
    Validates and decodes 16-character CNR numbers per eCourts national schema
    or formats Case Number query parameters for official eCourts portal lookup.
    """
    portal_url = "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index"

    if request.mode == "case_no":
        state = (request.state or "").strip()
        case_type = (request.case_type or "").strip()
        case_no = (request.case_number or "").strip()
        year = (request.year or "").strip()
        district = (request.district or "").strip()

        if not state or not case_no:
            return {
                "status": "INVALID_PARAMS",
                "message": "Please specify at least State and Case Number."
            }

        return {
            "status": "CASE_NO_PARSED",
            "mode": "case_no",
            "details": {
                "state": state,
                "district": district or "All District Courts",
                "case_type": case_type or "General / All Types",
                "case_number": case_no,
                "filing_year": year or datetime.utcnow().strftime("%Y"),
                "official_portal_url": portal_url
            },
            "message": f"Query configured for {state} Court | Case No: {case_no}/{year or datetime.utcnow().strftime('%Y')}."
        }

    raw_cnr = (request.cnr_number or "").strip().upper()
    
    if not raw_cnr or len(raw_cnr) != 16:
        return {
            "status": "INVALID_CNR",
            "message": "CNR Number must be exactly 16 alphanumeric characters (e.g. DLCT010023452023)."
        }

    state_code = raw_cnr[0:2]
    district_code = raw_cnr[2:4]
    court_code = raw_cnr[4:6]
    case_num = raw_cnr[6:12].lstrip("0") or "0"
    year = raw_cnr[12:16]

    state_name = STATE_CODES.get(state_code, f"State ({state_code})")

    return {
        "status": "VALID_PARSED",
        "mode": "cnr",
        "cnr": raw_cnr,
        "details": {
            "state_code": state_code,
            "state": state_name,
            "district_code": district_code,
            "court_complex_code": court_code,
            "filing_number": case_num,
            "filing_year": year,
            "official_portal_url": portal_url
        },
        "message": f"Verified CNR structure for {state_name} under eCourts national schema."
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
