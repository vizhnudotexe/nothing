import re
import json
import os
from typing import Dict, Any, List, Optional

class DoJChatbot:
    """
    Department of Justice (DoJ) Virtual Assistant / Chatbot Engine.
    Handles user queries across key DoJ services, schemes, and judicial information.
    """

    def __init__(self):
        self.knowledge_base = self._load_knowledge_base()
        self.faq_db = self._load_custom_faqs()

    def _load_knowledge_base(self) -> Dict[str, Any]:
        return {
            "divisions": {
                "title": "🏛️ Divisions of Department of Justice (DoJ)",
                "description": (
                    "The Department of Justice under the Ministry of Law & Justice, Govt. of India, operates through key divisions:\n\n"
                    "1. **Judicial Division**: Manages appointment, resignation, and service conditions of Judges of Supreme Court and High Courts.\n"
                    "2. **e-Courts Division**: Implements the e-Courts Mission Mode Project for ICT enablement of Indian Judiciary.\n"
                    "3. **Access to Justice Division**: Implements schemes like Tele-Law, Nyaya Bandhu (Pro Bono Legal Services), and Legal Literacy.\n"
                    "4. **National Judicial Academy & Training**: Financial assistance and policy coordination for training judicial officers.\n"
                    "5. **Fast Track Special Courts (FTSC) Division**: Coordinates setup of FTSCs for speedy trial of rape & POCSO cases."
                ),
                "quick_links": [
                    {"label": "Official DoJ Portal", "url": "https://doj.gov.in"},
                    {"label": "Tele-Law Portal", "url": "https://www.tele-law.in"}
                ]
            },
            "judges": {
                "title": "⚖️ Judges Strength & Vacancies (reference information)",
                "description": (
                    "Here is the current appointment status across Indian Courts:\n\n"
                    "• **Supreme Court of India**:\n"
                    "  - Sanctioned Strength: **34**\n"
                    "  - Working Strength: **33**\n"
                    "  - Vacancies: **1**\n\n"
                    "• **High Courts (25 High Courts across India)**:\n"
                    "  - Sanctioned Strength: **1,114**\n"
                    "  - Working Strength: **790**\n"
                    "  - Vacancies: **324**\n\n"
                    "• **District & Subordinate Courts**:\n"
                    "  - Sanctioned Strength: **25,246**\n"
                    "  - Working Strength: **19,850**\n"
                    "  - Vacancies: **5,396**\n\n"
                    "*This prototype contains reference figures only. Confirm current statistics on the official DoJ Judicial Statistics Portal.*"
                ),
                "action": "view_judges_dashboard"
            },
            "pendency_njdg": {
                "title": "📊 Case Pendency - National Judicial Data Grid (NJDG)",
                "description": (
                    "The National Judicial Data Grid (NJDG) publishes statistics on case pendency and disposal across courts. This prototype provides a reference summary only:\n\n"
                    "• **Total Pending Cases in High Courts**: ~62 Lakhs\n"
                    "• **Total Pending Cases in District Courts**: ~4.4 Crore\n"
                    "• **Civil Cases**: ~1.1 Crore\n"
                    "• **Criminal Cases**: ~3.3 Crore\n"
                    "• **Cases Disposed Last Month**: ~14.2 Lakhs\n\n"
                    "Confirm current figures and search by State, District, Court Complex, or Case Type directly on the NJDG portal."
                ),
                "quick_links": [
                    {"label": "Visit NJDG Portal", "url": "https://njdg.ecourts.gov.in"}
                ],
                "action": "view_njdg_stats"
            },
            "traffic_fine": {
                "title": "🚦 Procedure to Pay Traffic Violation Fines (Virtual Courts)",
                "description": (
                    "You can pay traffic challans online through the Virtual Courts system without visiting a physical court:\n\n"
                    "**Step-by-Step Process:**\n"
                    "1. Visit the official Virtual Courts Portal: `https://vcourts.gov.in`\n"
                    "2. Select your **State / Department** (e.g., Delhi Traffic Police, Maharashta Virtual Court).\n"
                    "3. Search your challan using **Mobile Number**, **Challan Number**, or **Vehicle Number**.\n"
                    "4. Verify the violation details and fine amount.\n"
                    "5. Click **Pay Fine** and complete payment via NetBanking/UPI/Debit Card.\n"
                    "6. Download the digital acknowledgement receipt."
                ),
                "quick_links": [
                    {"label": "Pay Traffic Fine (Virtual Courts)", "url": "https://vcourts.gov.in"}
                ]
            },
            "live_streaming": {
                "title": "📺 Live Streaming of Court Proceedings",
                "description": (
                    "To promote transparency and open justice, live streaming of court hearings is operational:\n\n"
                    "• **Supreme Court of India**: Streamed live on official YouTube channel & webcasts (Constitution Bench cases).\n"
                    "• **High Courts**: Gujarat, Karnataka, Madhya Pradesh, Orissa, Gujarat, Patna, and Jharkhand High Courts regularly live stream proceedings.\n\n"
                    "You can watch live proceedings on the official court YouTube channels or eCourts portal."
                ),
                "quick_links": [
                    {"label": "Supreme Court Live Stream", "url": "https://main.sci.gov.in/live-streaming"},
                    {"label": "eCourts Live Streaming Links", "url": "https://ecourts.gov.in"}
                ]
            },
            "efiling_epay": {
                "title": "💻 Steps for eFiling & ePay Services",
                "description": (
                    "**eFiling Portal (v3.0):**\n"
                    "1. Visit `https://efiling.ecourts.gov.in`\n"
                    "2. Register as an Advocate or Party-in-Person using Aadhar / Mobile OTP.\n"
                    "3. Draft pleadings, upload digitized documents (PDF with digital signature).\n"
                    "4. Submit case online for verification.\n\n"
                    "**ePay Portal (Court Fee & Fines):**\n"
                    "1. Visit `https://pay.ecourts.gov.in`\n"
                    "2. Select State & Court Complex.\n"
                    "3. Enter Case Details / CNR Number.\n"
                    "4. Pay Court Fee, Judicial Stamp Fee, Fine, or Bail amount using SBI ePay gateway."
                ),
                "quick_links": [
                    {"label": "eFiling Portal", "url": "https://efiling.ecourts.gov.in"},
                    {"label": "ePay Portal", "url": "https://pay.ecourts.gov.in"}
                ]
            },
            "fast_track_courts": {
                "title": "⚡ Fast Track Special Courts (FTSCs)",
                "description": (
                    "Fast Track Special Courts (FTSCs) are specialized courts established under Centrally Sponsored Scheme of DoJ:\n\n"
                    "• **Purpose**: Expedited trial and disposal of pending cases relating to Rape and POCSO Act (Protection of Children from Sexual Offences).\n"
                    "• **Operational Courts**: Over **750+ FTSCs** (including exclusive POCSO courts) are functional across 29 States/UTs.\n"
                    "• **Key Features**: Vulnerable witness deposition centers, victim friendly atmosphere, strict timeframe for disposal."
                ),
                "quick_links": [
                    {"label": "FTSC Scheme Details", "url": "https://doj.gov.in/fast-track-special-court"}
                ]
            },
            "ecourts_app": {
                "title": "📱 eCourts Services Mobile App",
                "description": (
                    "The **eCourts Services App** is a official mobile application for litigants, advocates, and citizens:\n\n"
                    "**Key Features:**\n"
                    "• Search Case Status by CNR Number, Party Name, Case Number, Advocate Name.\n"
                    "• View Cause Lists, Next Hearing Dates, Orders & Judgments.\n"
                    "• Create personal case portfolio (My Cases) with real-time push notifications.\n\n"
                    "**How to Download:**\n"
                    "• **Android**: Search 'eCourts Services' on Google Play Store.\n"
                    "• **iOS**: Search 'eCourts Services' on Apple App Store."
                ),
                "quick_links": [
                    {"label": "Download for Android (Play Store)", "url": "https://play.google.com/store/apps/details?id=in.gov.ecourts.eCourtsServices"},
                    {"label": "Download for iOS (App Store)", "url": "https://apps.apple.com/in/app/ecourts-services/id1260905971"}
                ]
            },
            "tele_law": {
                "title": "📞 Tele-Law Services (Mainstreaming Legal Aid)",
                "description": (
                    "Tele-Law connects marginalized citizens with Panel Lawyers for free legal advice via Video Conferencing & Tele-calling:\n\n"
                    "• **Who is Eligible?**: Free advice for SC/ST, Women, Children, Victims of Trafficking, Disabled, and Low-income individuals.\n"
                    "• **How to Access**:\n"
                    "  1. Visit your nearest **Common Service Centre (CSC)** (VLE helps book appointment).\n"
                    "  2. Or download the **Tele-Law Citizen Mobile App**.\n"
                    "  3. Register & connect directly with a Panel Lawyer in your native language."
                ),
                "quick_links": [
                    {"label": "Tele-Law Official Portal", "url": "https://www.tele-law.in"},
                    {"label": "Tele-Law Citizen App", "url": "https://play.google.com/store/apps/details?id=com.telelaw.citizen"}
                ]
            },
            "case_status": {
                "title": "🔍 Know Current Status of Case",
                "description": (
                    "You can check your case status online in 3 easy ways:\n\n"
                    "1. **By 16-digit CNR Number**: The fastest way (printed on receipt / filing acknowledgment).\n"
                    "2. **By Case Details**: Select State -> District -> Court Complex -> Case Type & Number.\n"
                    "3. **By Party / Advocate Name**: Search by petitioner/respondent name.\n\n"
                    "👉 Use the interactive **Case Lookup Widget** below to check status immediately!"
                ),
                "action": "open_case_lookup_modal"
            }
        }

    def _load_custom_faqs(self) -> List[Dict[str, str]]:
        faq_file = os.path.join(os.path.dirname(__file__), "custom_faqs.json")
        if os.path.exists(faq_file):
            try:
                with open(faq_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return []
        return []

    def save_custom_faq(self, question: str, answer: str, category: str = "General"):
        self.faq_db.append({"question": question, "answer": answer, "category": category})
        faq_file = os.path.join(os.path.dirname(__file__), "custom_faqs.json")
        try:
            with open(faq_file, "w", encoding="utf-8") as f:
                json.dump(self.faq_db, f, indent=2)
        except Exception as e:
            print(f"Error saving custom FAQ: {e}")

    # Official source registry — authoritative GOI / court portals
    _SOURCES = {
        "divisions": [
            {"name": "Department of Justice — Official Portal", "url": "https://doj.gov.in", "badge": "doj.gov.in"},
            {"name": "Ministry of Law & Justice", "url": "https://lawmin.gov.in", "badge": "lawmin.gov.in"},
        ],
        "judges": [
            {"name": "DoJ — Judicial Statistics", "url": "https://doj.gov.in/judicial-statistics", "badge": "doj.gov.in"},
            {"name": "Supreme Court of India", "url": "https://main.sci.gov.in", "badge": "sci.gov.in"},
            {"name": "National Judicial Data Grid", "url": "https://njdg.ecourts.gov.in", "badge": "njdg.ecourts.gov.in"},
        ],
        "pendency_njdg": [
            {"name": "NJDG — National Judicial Data Grid", "url": "https://njdg.ecourts.gov.in", "badge": "njdg.ecourts.gov.in"},
            {"name": "eCourts Services Portal", "url": "https://ecourts.gov.in", "badge": "ecourts.gov.in"},
        ],
        "traffic_fine": [
            {"name": "Virtual Courts — vcourts.gov.in", "url": "https://vcourts.gov.in", "badge": "vcourts.gov.in"},
            {"name": "Parivahan — MoRTH Traffic Challans", "url": "https://parivahan.gov.in/parivahan", "badge": "parivahan.gov.in"},
        ],
        "live_streaming": [
            {"name": "Supreme Court Live Streaming", "url": "https://main.sci.gov.in/live-streaming", "badge": "sci.gov.in"},
            {"name": "eCourts Live Streaming", "url": "https://ecourts.gov.in", "badge": "ecourts.gov.in"},
        ],
        "efiling_epay": [
            {"name": "eFiling Portal — ecourts.gov.in", "url": "https://efiling.ecourts.gov.in", "badge": "efiling.ecourts.gov.in"},
            {"name": "ePay Portal — pay.ecourts.gov.in", "url": "https://pay.ecourts.gov.in", "badge": "pay.ecourts.gov.in"},
        ],
        "fast_track_courts": [
            {"name": "FTSC Scheme — DoJ", "url": "https://doj.gov.in/fast-track-special-court", "badge": "doj.gov.in"},
            {"name": "Department of Justice", "url": "https://doj.gov.in", "badge": "doj.gov.in"},
        ],
        "ecourts_app": [
            {"name": "eCourts Services — ecourts.gov.in", "url": "https://ecourts.gov.in", "badge": "ecourts.gov.in"},
            {"name": "Android — Google Play", "url": "https://play.google.com/store/apps/details?id=in.gov.ecourts.eCourtsServices", "badge": "play.google.com"},
            {"name": "iOS — Apple App Store", "url": "https://apps.apple.com/in/app/ecourts-services/id1260905971", "badge": "apps.apple.com"},
        ],
        "tele_law": [
            {"name": "Tele-Law Official Portal", "url": "https://www.tele-law.in", "badge": "tele-law.in"},
            {"name": "CSC — Common Service Centres", "url": "https://csc.gov.in", "badge": "csc.gov.in"},
            {"name": "NALSA — National Legal Services Authority", "url": "https://nalsa.gov.in", "badge": "nalsa.gov.in"},
        ],
        "case_status": [
            {"name": "eCourts Case Status Portal", "url": "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index", "badge": "services.ecourts.gov.in"},
            {"name": "eCourts Services — Main", "url": "https://ecourts.gov.in", "badge": "ecourts.gov.in"},
        ],
    }

    def get_response(self, query: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        query_clean = query.strip().lower()

        if re.search(r"\b(division|department|branches|about doj|structure|functions)\b", query_clean):
            data = self.knowledge_base["divisions"]
            return {
                "type": "text", "title": data["title"],
                "message": data["description"],
                "quick_links": data.get("quick_links"),
                "sources": self._SOURCES["divisions"]
            }

        if re.search(r"\b(judge|judges|vacancy|vacancies|sanctioned strength|working strength|supreme court judges|high court judges)\b", query_clean):
            data = self.knowledge_base["judges"]
            return {
                "type": "text_with_action", "title": data["title"],
                "message": data["description"],
                "action": data["action"],
                "action_label": "View Interactive Judges Analytics",
                "sources": self._SOURCES["judges"]
            }

        if re.search(r"\b(pendency|pending|njdg|national judicial data grid|cases pending|disposal rate)\b", query_clean):
            data = self.knowledge_base["pendency_njdg"]
            return {
                "type": "text_with_action", "title": data["title"],
                "message": data["description"],
                "quick_links": data.get("quick_links"),
                "action": data.get("action"),
                "action_label": "View NJDG Live Stat Dashboard",
                "sources": self._SOURCES["pendency_njdg"]
            }

        if re.search(r"\b(traffic|challan|fine|vcourt|virtual court|pay fine|traffic violation)\b", query_clean):
            data = self.knowledge_base["traffic_fine"]
            return {
                "type": "text", "title": data["title"],
                "message": data["description"],
                "quick_links": data.get("quick_links"),
                "sources": self._SOURCES["traffic_fine"]
            }

        if re.search(r"\b(live stream|livestream|youtube|watch court|stream court|live proceedings)\b", query_clean):
            data = self.knowledge_base["live_streaming"]
            return {
                "type": "text", "title": data["title"],
                "message": data["description"],
                "quick_links": data.get("quick_links"),
                "sources": self._SOURCES["live_streaming"]
            }

        if re.search(r"\b(efiling|e-filing|epay|e-pay|court fee|pay fee|file case online)\b", query_clean):
            data = self.knowledge_base["efiling_epay"]
            return {
                "type": "text", "title": data["title"],
                "message": data["description"],
                "quick_links": data.get("quick_links"),
                "sources": self._SOURCES["efiling_epay"]
            }

        if re.search(r"\b(fast track|ftsc|pocso|rape cases|special court|fast track court)\b", query_clean):
            data = self.knowledge_base["fast_track_courts"]
            return {
                "type": "text", "title": data["title"],
                "message": data["description"],
                "quick_links": data.get("quick_links"),
                "sources": self._SOURCES["fast_track_courts"]
            }

        if re.search(r"\b(app|mobile app|ecourts app|download app|android app|ios app)\b", query_clean):
            data = self.knowledge_base["ecourts_app"]
            return {
                "type": "text", "title": data["title"],
                "message": data["description"],
                "quick_links": data.get("quick_links"),
                "sources": self._SOURCES["ecourts_app"]
            }

        if re.search(r"\b(tele law|tele-law|legal aid|free legal advice|csc|panel lawyer|poor)\b", query_clean):
            data = self.knowledge_base["tele_law"]
            return {
                "type": "text", "title": data["title"],
                "message": data["description"],
                "quick_links": data.get("quick_links"),
                "sources": self._SOURCES["tele_law"]
            }

        if re.search(r"\b(case status|cnr|case number|hearing date|next date|court status|check case)\b", query_clean):
            data = self.knowledge_base["case_status"]
            return {
                "type": "text_with_action", "title": data["title"],
                "message": data["description"],
                "action": "open_case_lookup",
                "action_label": "Search Case Status Now",
                "sources": self._SOURCES["case_status"]
            }

        for faq in self.faq_db:
            if any(word in query_clean for word in faq["question"].lower().split()):
                return {
                    "type": "text",
                    "title": f"FAQ: {faq['question']}",
                    "message": faq["answer"],
                    "sources": [{"name": "Department of Justice", "url": "https://doj.gov.in", "badge": "doj.gov.in"}]
                }

        return {
            "type": "fallback",
            "title": "Nyaya — DoJ Virtual Assistant",
            "message": (
                "I am **Nyaya**, official virtual assistant for Department of Justice.\n"
                "I didn't catch your exact request. Topics I can help with:\n\n"
                "• **Divisions of DoJ**\n"
                "• **Judges Strength & Vacancies**\n"
                "• **Case Pendency (NJDG)**\n"
                "• **Pay Traffic Fine (Virtual Courts)**\n"
                "• **Live Court Streaming**\n"
                "• **eFiling & ePay Services**\n"
                "• **Fast Track Special Courts**\n"
                "• **eCourts Mobile App**\n"
                "• **Tele-Law Legal Assistance**\n"
                "• **Check Current Case Status**"
            ),
            "suggestions": [
                "Divisions of DoJ", "Number of Judges & Vacancies",
                "Case Pendency (NJDG)", "Pay Traffic Fine",
                "Live Court Stream", "eFiling & ePay",
                "Fast Track Courts", "eCourts App Download",
                "Tele-Law Services", "Check Case Status"
            ],
            "sources": [
                {"name": "Department of Justice", "url": "https://doj.gov.in", "badge": "doj.gov.in"},
                {"name": "eCourts Services", "url": "https://ecourts.gov.in", "badge": "ecourts.gov.in"}
            ]
        }
