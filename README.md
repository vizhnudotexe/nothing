# 🏛️ Nyaya - Department of Justice (DoJ) Virtual Assistant

**Problem Statement ID**: SIH1700  
**Ministry**: Ministry of Law & Justice, Department of Justice, Government of India.

## 📌 Overview
Nyaya is an interactive virtual assistant developed for the Department of Justice website to provide citizens, advocates, and litigants with instant, seamless access to legal services, court statistics, case status updates, and judicial schemes.

## ✨ Key Features & Capabilities
1. **DoJ Divisions Information**: Detailed insights into Judicial, e-Courts, Access to Justice, FTSC, and NJA divisions.
2. **Judges Strength & Vacancies**: Real-time stats on sanctioned/working strength and vacancies across Supreme Court, High Courts, and District Courts.
3. **NJDG Case Pendency Dashboard**: Integrated summary of National Judicial Data Grid (NJDG) case pendency & disposal statistics.
4. **Traffic Violation Fine Payment**: Direct guide and portal redirection for Virtual Courts (`vcourts.gov.in`).
5. **Live Court Streaming**: Direct access to live streaming links for Supreme Court and High Courts.
6. **eFiling & ePay Services**: Step-by-step assistance for online case filing and fee payments.
7. **Fast Track Special Courts (FTSCs)**: Information on POCSO & rape case expedited trial courts.
8. **eCourts Mobile App**: Quick download links and usage guides for the official eCourts Services app.
9. **Tele-Law Assistance**: Guidance on accessing free legal advice for marginalized sections via CSCs and mobile app.
10. **Interactive Case Status Lookup**: Search case status using 16-digit CNR number or case parameters directly from the interface.
11. **Continuous Learning & Feedback**: Feedback mechanism allowing the assistant to gather ratings and improve responses over time.

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- FastAPI & Uvicorn

### Running the Server
```bash
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

Access the Web Application at: `http://localhost:8000/`
API Documentation (Swagger): `http://localhost:8000/docs`
