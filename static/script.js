// Global State
let currentTheme = localStorage.getItem("doj_theme") || "light";
let isListening = false;
let recognition = null;

document.addEventListener("DOMContentLoaded", () => {
    // Initialize Theme
    document.body.setAttribute("data-theme", currentTheme);
    updateThemeIcon();

    // Theme Toggle Handler
    const themeBtn = document.getElementById("themeToggleBtn");
    if (themeBtn) {
        themeBtn.addEventListener("click", toggleTheme);
    }

    // Initialize Speech Recognition if supported
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-IN";

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            document.getElementById("userInput").value = transcript;
            toggleVoiceRecognition(false);
            handleFormSubmit(new Event("submit"));
        };

        recognition.onerror = () => {
            toggleVoiceRecognition(false);
        };

        recognition.onend = () => {
            toggleVoiceRecognition(false);
        };
    } else {
        const voiceBtn = document.getElementById("voiceBtn");
        if (voiceBtn) voiceBtn.style.display = "none";
    }
});

// Toggle Dark / Light Theme
function toggleTheme() {
    currentTheme = currentTheme === "light" ? "dark" : "light";
    document.body.setAttribute("data-theme", currentTheme);
    localStorage.setItem("doj_theme", currentTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const themeBtn = document.getElementById("themeToggleBtn");
    if (themeBtn) {
        themeBtn.innerHTML = currentTheme === "light" 
            ? '<i class="fa-solid fa-moon"></i>' 
            : '<i class="fa-solid fa-sun"></i>';
    }
}

// Send Topic from Quick Buttons or Chips
function sendTopic(topicText) {
    document.getElementById("userInput").value = topicText;
    handleFormSubmit(new Event("submit"));
}

// Main Form Submit Handler
async function handleFormSubmit(e) {
    if (e) e.preventDefault();

    const inputEl = document.getElementById("userInput");
    const message = inputEl.value.strip ? inputEl.value.strip() : inputEl.value.trim();

    if (!message) return;

    // Append User Message to Chat
    appendUserMessage(message);
    inputEl.value = "";

    // Show Typing Indicator
    const typingId = appendTypingIndicator();

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: message })
        });

        const data = await response.json();
        removeTypingIndicator(typingId);

        // Append Bot Response
        appendBotMessage(data, message);

    } catch (err) {
        console.error("Chat error:", err);
        removeTypingIndicator(typingId);
        appendBotMessage({
            type: "text",
            title: "⚠️ Network Warning",
            message: "Unable to reach DoJ Nyaya Mitra server. Please check your internet connection and try again."
        }, message);
    }
}

// Append User Message
function appendUserMessage(text) {
    const chatBox = document.getElementById("chatMessages");
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userDiv = document.createElement("div");
    userDiv.className = "message user-message";
    userDiv.innerHTML = `
        <div class="msg-avatar">
            <i class="fa-solid fa-user"></i>
        </div>
        <div class="msg-body">
            <div class="msg-header">
                <span class="sender-name">You</span>
                <span class="msg-time">${timeStr}</span>
            </div>
            <div class="msg-content">
                <p>${escapeHtml(text)}</p>
            </div>
        </div>
    `;
    chatBox.appendChild(userDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Append Bot Message
function appendBotMessage(data, origQuery) {
    const chatBox = document.getElementById("chatMessages");
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const botDiv = document.createElement("div");
    botDiv.className = "message bot-message";

    let bodyHTML = `<div class="msg-title">${data.title || "Nyaya Mitra Response"}</div>`;
    
    // Process markdown formatting for paragraphs and bold text
    let formattedText = data.message || "";
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formattedText = formattedText.replace(/\n\n/g, '</p><p>');
    formattedText = formattedText.replace(/\n/g, '<br>');

    bodyHTML += `<p>${formattedText}</p>`;

    // Quick Links if available
    if (data.quick_links && data.quick_links.length > 0) {
        bodyHTML += `<div class="quick-link-box">`;
        data.quick_links.forEach(link => {
            bodyHTML += `<a href="${link.url}" target="_blank" class="link-btn"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${link.label}</a>`;
        });
        bodyHTML += `</div>`;
    }

    // Interactive Action Button
    if (data.action) {
        if (data.action === "view_judges_dashboard") {
            bodyHTML += `<button class="action-card-btn" onclick="openJudgesModal()"><i class="fa-solid fa-chart-line"></i> ${data.action_label || 'View Judges Dashboard'}</button>`;
        } else if (data.action === "view_njdg_stats") {
            bodyHTML += `<button class="action-card-btn" onclick="openNjdgModal()"><i class="fa-solid fa-chart-pie"></i> ${data.action_label || 'View NJDG Statistics'}</button>`;
        } else if (data.action === "open_case_lookup_modal" || data.action === "open_case_lookup") {
            bodyHTML += `<button class="action-card-btn" onclick="openCaseLookupModal()"><i class="fa-solid fa-magnifying-glass"></i> ${data.action_label || 'Search Case Status'}</button>`;
        }
    }

    // Suggestions chips
    if (data.suggestions && data.suggestions.length > 0) {
        bodyHTML += `<div class="suggested-chips"><span>Suggested topics:</span>`;
        data.suggestions.forEach(sug => {
            bodyHTML += `<button class="chip" onclick="sendTopic('${sug}')">${sug}</button>`;
        });
        bodyHTML += `</div>`;
    }

    // Feedback rating buttons
    bodyHTML += `
        <div style="margin-top: 14px; pt: 8px; border-top: 1px ease #eee; display: flex; align-items: center; gap: 10px; font-size: 0.78rem; color: #888;">
            <span>Was this helpful?</span>
            <button onclick="submitFeedback('${escapeHtml(origQuery)}', '${escapeHtml(data.title)}', true, this)" style="background:none; border:none; cursor:pointer; font-size:1rem;" title="Yes">👍</button>
            <button onclick="submitFeedback('${escapeHtml(origQuery)}', '${escapeHtml(data.title)}', false, this)" style="background:none; border:none; cursor:pointer; font-size:1rem;" title="No">👎</button>
        </div>
    `;

    botDiv.innerHTML = `
        <div class="msg-avatar">
            <i class="fa-solid fa-scale-balanced"></i>
        </div>
        <div class="msg-body">
            <div class="msg-header">
                <span class="sender-name">Nyaya Mitra</span>
                <span class="msg-time">${timeStr}</span>
            </div>
            <div class="msg-content">
                ${bodyHTML}
            </div>
        </div>
    `;

    chatBox.appendChild(botDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Typing Indicator
function appendTypingIndicator() {
    const chatBox = document.getElementById("chatMessages");
    const id = "typing_" + Date.now();

    const typingDiv = document.createElement("div");
    typingDiv.className = "message bot-message";
    typingDiv.id = id;
    typingDiv.innerHTML = `
        <div class="msg-avatar"><i class="fa-solid fa-scale-balanced"></i></div>
        <div class="msg-body">
            <div class="msg-content">
                <i class="fa-solid fa-ellipsis fa-bounce"></i> Nyaya Mitra is thinking...
            </div>
        </div>
    `;
    chatBox.appendChild(typingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// Submit Feedback
async function submitFeedback(query, title, isHelpful, btnEl) {
    try {
        await fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query, response_title: title, is_helpful: isHelpful })
        });

        const parent = btnEl.parentElement;
        parent.innerHTML = isHelpful 
            ? `<span style="color: #10b981; font-weight:600;"><i class="fa-solid fa-check"></i> Thank you for your feedback!</span>` 
            : `<span style="color: #64748b;">Thanks! We will improve this response.</span>`;
    } catch (e) {
        console.error("Feedback error:", e);
    }
}

// Speech Recognition Toggle
function toggleVoiceRecognition(forceState) {
    if (!recognition) return;

    const voiceBtn = document.getElementById("voiceBtn");

    if (typeof forceState === "boolean") {
        isListening = forceState;
    } else {
        isListening = !isListening;
    }

    if (isListening) {
        try {
            recognition.start();
            voiceBtn.classList.add("listening");
            voiceBtn.title = "Listening... Speak now";
        } catch (e) {
            console.error(e);
        }
    } else {
        try {
            recognition.stop();
            voiceBtn.classList.remove("listening");
            voiceBtn.title = "Voice Input";
        } catch (e) {
            console.error(e);
        }
    }
}

// Modal Handlers
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add("active");
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("active");
}

// Case Lookup Modal Functions
function openCaseLookupModal() {
    openModal("caseModal");
}

function switchCaseTab(tab) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

    if (tab === "cnr") {
        document.querySelectorAll(".tab-btn")[0].classList.add("active");
        document.getElementById("cnrTab").classList.add("active");
    } else {
        document.querySelectorAll(".tab-btn")[1].classList.add("active");
        document.getElementById("detailsTab").classList.add("active");
    }
}

async function handleCaseSearch(e) {
    e.preventDefault();
    const cnr = document.getElementById("cnrInput").value.trim();
    const resultBox = document.getElementById("caseResultBox");

    resultBox.style.display = "block";
    resultBox.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Searching eCourts database...</div>`;

    try {
        const res = await fetch("/api/case-lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cnr_number: cnr || "DLCT010023452023" })
        });
        const data = await res.json();

        if (data.status === "FOUND") {
            const d = data.case_details;
            resultBox.innerHTML = `
                <div style="border-left: 4px solid #10b981; padding-left: 12px;">
                    <h4 style="color: var(--doj-navy); font-size: 1.05rem; margin-bottom: 8px;">Case Status: ${data.cnr_number}</h4>
                    <p style="font-size: 0.88rem; margin-bottom: 4px;"><strong>Court:</strong> ${d.court_name}</p>
                    <p style="font-size: 0.88rem; margin-bottom: 4px;"><strong>Case Type & No:</strong> ${d.case_type} (${d.filling_number})</p>
                    <p style="font-size: 0.88rem; margin-bottom: 4px;"><strong>Parties:</strong> ${d.petitioner} vs ${d.respondent}</p>
                    <p style="font-size: 0.88rem; margin-bottom: 4px; color: #d97706;"><strong>Next Hearing Date:</strong> ${d.next_hearing_date}</p>
                    <p style="font-size: 0.88rem; margin-bottom: 4px;"><strong>Stage:</strong> ${d.stage}</p>
                    <p style="font-size: 0.85rem; background: #fff; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; margin-top: 8px;"><strong>Last Order:</strong> ${d.last_order}</p>
                </div>
            `;
        } else {
            resultBox.innerHTML = `<div style="color: #ef4444;">${data.message}</div>`;
        }
    } catch (err) {
        resultBox.innerHTML = `<div style="color: #ef4444;">Error searching case details.</div>`;
    }
}

// Judges Modal Dashboard
async function openJudgesModal() {
    openModal("judgesModal");
    const container = document.getElementById("judgesModalContent");
    container.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Fetching live judges statistics...</div>`;

    try {
        const res = await fetch("/api/judges-stats");
        const data = await res.json();

        container.innerHTML = `
            <p style="margin-bottom: 16px; font-size: 0.9rem; color: var(--text-secondary);">
                Judges Strength and Vacancies across Judicial Levels (Updated ${data.last_updated}):
            </p>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-lbl">Supreme Court of India</div>
                    <div class="stat-val">${data.supreme_court.working} / ${data.supreme_court.sanctioned}</div>
                    <small>Working / Sanctioned (${data.supreme_court.vacancies} Vacancy)</small>
                </div>
                <div class="stat-card">
                    <div class="stat-lbl">High Courts (25 Courts)</div>
                    <div class="stat-val">${data.high_courts.working} / ${data.high_courts.sanctioned}</div>
                    <small>Working / Sanctioned (${data.high_courts.vacancies} Vacancies)</small>
                </div>
                <div class="stat-card">
                    <div class="stat-lbl">District & Subordinate Courts</div>
                    <div class="stat-val">${data.district_courts.working.toLocaleString()}</div>
                    <small>Sanctioned: ${data.district_courts.sanctioned.toLocaleString()} (${data.district_courts.vacancies.toLocaleString()} Vacancies)</small>
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<p style="color:red">Failed to load statistics.</p>`;
    }
}

// NJDG Modal Dashboard
async function openNjdgModal() {
    openModal("njdgModal");
    const container = document.getElementById("njdgModalContent");
    container.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Fetching NJDG grid data...</div>`;

    try {
        const res = await fetch("/api/njdg-stats");
        const data = await res.json();

        container.innerHTML = `
            <p style="margin-bottom: 16px; font-size: 0.9rem; color: var(--text-secondary);">
                National Judicial Data Grid (NJDG) Real-Time Summary Statistics:
            </p>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-lbl">District Courts Pending</div>
                    <div class="stat-val" style="color: #dc2626;">${data.district_courts_pending}</div>
                    <small>Total Pending Cases</small>
                </div>
                <div class="stat-card">
                    <div class="stat-lbl">High Courts Pending</div>
                    <div class="stat-val" style="color: #d97706;">${data.high_courts_pending}</div>
                    <small>Total Pending Cases</small>
                </div>
                <div class="stat-card">
                    <div class="stat-lbl">Cases Disposed This Month</div>
                    <div class="stat-val" style="color: #10b981;">${data.cases_disposed_this_month}</div>
                    <small>Disposal Rate</small>
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<p style="color:red">Failed to load NJDG data.</p>`;
    }
}

// Utility
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
