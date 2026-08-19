// ── Global State ───────────────────────────────────────────
let currentTheme = localStorage.getItem('doj_theme') || 'light';
let isListening   = false;
let recognition   = null;

// ── Session history (localStorage only — 0 server tokens) ──
const HIST_KEY = 'nyaya_history';
const HIST_MAX = 80;

function histLoad() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); }
    catch { return []; }
}

function histSave(entries) {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(entries.slice(-HIST_MAX))); }
    catch { /* storage quota — ignore */ }
}

function histPush(question) {
    const entries = histLoad();
    entries.push({ q: question, t: Date.now() });
    histSave(entries);
    renderHistPanel();
}

function renderHistPanel() {
    const list    = document.getElementById('histList');
    const entries = histLoad();
    if (!list) return;

    if (entries.length === 0) {
        list.innerHTML = '<p class="hist-empty">No history yet.<br>Your questions appear here.</p>';
        return;
    }
    list.innerHTML = '';
    [...entries].reverse().forEach(e => {
        const btn = document.createElement('button');
        btn.className = 'hist-item';
        btn.innerHTML = `
            <i class="fa-regular fa-message hist-item-icon"></i>
            <div class="hist-item-body">
                <span class="hist-item-q">${escapeHtml(e.q)}</span>
                <span class="hist-item-time">${relTime(e.t)}</span>
            </div>`;
        btn.addEventListener('click', () => sendTopic(e.q));
        list.appendChild(btn);
    });
}

function relTime(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)    return 'just now';
    if (s < 3600)  return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
}

document.addEventListener('DOMContentLoaded', () => {
    // Theme
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.body.setAttribute('data-theme', currentTheme);
    updateThemeIcon();
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);

    // History panel
    const histBtn   = document.getElementById('histToggleBtn');
    const histPanel = document.getElementById('histPanel');
    histBtn?.addEventListener('click', () => histPanel?.classList.toggle('open'));
    document.getElementById('histClearBtn')?.addEventListener('click', () => {
        localStorage.removeItem(HIST_KEY);
        renderHistPanel();
    });
    renderHistPanel();

    // Close history on outside click (mobile)
    document.addEventListener('click', e => {
        if (histPanel?.classList.contains('open') && window.innerWidth <= 640) {
            if (!histPanel.contains(e.target) && !histBtn?.contains(e.target)) {
                histPanel.classList.remove('open');
            }
        }
    });

    // Modal veil dismiss
    document.querySelectorAll('.modal-veil').forEach(veil => {
        veil.addEventListener('click', e => { if (e.target === veil) veil.classList.remove('active'); });
    });

    // Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SR  = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SR();
        recognition.continuous    = false;
        recognition.interimResults = false;
        recognition.lang           = 'en-IN';
        recognition.onresult = e => {
            document.getElementById('userInput').value = e.results[0][0].transcript;
            toggleVoiceRecognition(false);
            handleFormSubmit(new Event('submit'));
        };
        recognition.onerror = () => toggleVoiceRecognition(false);
        recognition.onend   = () => toggleVoiceRecognition(false);
    } else {
        document.getElementById('voiceBtn')?.remove();
    }
});

// Toggle Dark / Light Theme
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.body.setAttribute('data-theme', currentTheme);
    localStorage.setItem('doj_theme', currentTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.innerHTML = currentTheme === 'light'
        ? '<i class="fa-solid fa-moon" style="font-size:11px"></i>'
        : '<i class="fa-solid fa-sun"  style="font-size:11px"></i>';
}


// Send Topic from Quick Buttons or Chips
function sendTopic(topicText) {
    document.getElementById('userInput').value = topicText;
    handleFormSubmit(new Event('submit'));
}

// Main Form Submit Handler
async function handleFormSubmit(e) {
    if (e) e.preventDefault();

    const inputEl = document.getElementById('userInput');
    const message = inputEl.value.trim();
    if (!message) return;

    // push to history before clearing
    histPush(message);

    appendUserMessage(message);
    inputEl.value = '';

    const typingId = appendTypingIndicator();

    try {
        const res  = await fetch('/api/chat', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ message })
        });
        const data = await res.json();
        removeTypingIndicator(typingId);
        appendBotMessage(data, message);
    } catch (err) {
        console.error('Chat error:', err);
        removeTypingIndicator(typingId);
        appendBotMessage({
            type: 'text',
            title: 'Network Error',
            message: 'Unable to reach Nyaya server. Check your connection and try again.'
        }, message);
    }
}


// Append User Message
function appendUserMessage(text) {
    const chatBox = document.getElementById("chatMessages");
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const el = document.createElement("div");
    el.className = "msg-row user-row";
    el.innerHTML = `
        <div class="avatar user-av"><i class="fa-solid fa-user"></i></div>
        <div class="bubble-wrap">
            <div class="bubble-meta">
                <span class="bubble-name">You</span>
                <span class="bubble-time">${timeStr}</span>
            </div>
            <div class="bubble">${escapeHtml(text)}</div>
        </div>
    `;
    chatBox.appendChild(el);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Append Bot Message
function appendBotMessage(data, origQuery) {
    const chatBox = document.getElementById("chatMessages");
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const el = document.createElement("div");
    el.className = "msg-row bot-row";

    // Format text
    let fmt = escapeHtml(data.message || "");
    fmt = fmt.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    fmt = fmt.replace(/\n\n/g, '</p><p>');
    fmt = fmt.replace(/\n/g, '<br>');

    let inner = `<div class="msg-title">${escapeHtml(data.title || 'Nyaya')}</div><p>${fmt}</p>`;

    // Quick links
    if (data.quick_links && data.quick_links.length > 0) {
        inner += `<div class="ql-row">`;
        data.quick_links.forEach(link => {
            const safeUrl = safeExternalUrl(link.url);
            if (safeUrl) inner += `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="ql-btn"><i class="fa-solid fa-arrow-up-right-from-square"></i>${escapeHtml(link.label)}</a>`;
        });
        inner += `</div>`;
    }

    // Action button
    if (data.action) {
        if (data.action === "view_judges_dashboard") {
            inner += `<button class="action-card-btn" onclick="openJudgesModal()"><i class="fa-solid fa-chart-line"></i>${data.action_label || 'View Dashboard'}</button>`;
        } else if (data.action === "view_njdg_stats") {
            inner += `<button class="action-card-btn" onclick="openNjdgModal()"><i class="fa-solid fa-chart-bar"></i>${data.action_label || 'View NJDG Stats'}</button>`;
        } else if (data.action === "open_case_lookup_modal" || data.action === "open_case_lookup") {
            inner += `<button class="action-card-btn" onclick="openCaseLookupModal()"><i class="fa-solid fa-magnifying-glass"></i>${data.action_label || 'Search Case'}</button>`;
        }
    }

    // Suggestion chips
    if (data.suggestions && data.suggestions.length > 0) {
        inner += `<div class="sug-chips">`;
        data.suggestions.forEach(s => {
            inner += `<button class="ichip" data-topic="${escapeHtml(s)}">${escapeHtml(s)}</button>`;
        });
        inner += `</div>`;
    }

    // ── Source citations ──────────────────────────────────
    if (data.sources && data.sources.length > 0) {
        inner += `<div class="sources-block">
            <div class="sources-label"><i class="fa-solid fa-shield-halved"></i> Official Sources</div>
            <div class="sources-list">`;
        data.sources.forEach(src => {
            const safeUrl = safeExternalUrl(src.url);
            if (safeUrl) {
                inner += `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="src-pill">
                    <i class="fa-solid fa-lock"></i>${escapeHtml(src.badge || src.name)}
                </a>`;
            }
        });
        inner += `</div></div>`;
    }

    // Feedback
    inner += `
        <div class="feedback-row">
            <span>Helpful?</span>
            <button class="fb-btn" onclick="submitFeedback('${escapeHtml(origQuery)}','${escapeHtml(data.title)}',true,this)" title="Yes">👍</button>
            <button class="fb-btn" onclick="submitFeedback('${escapeHtml(origQuery)}','${escapeHtml(data.title)}',false,this)" title="No">👎</button>
        </div>`;

    el.innerHTML = `
        <div class="avatar bot-av"><i class="fa-solid fa-scale-balanced"></i></div>
        <div class="bubble-wrap">
            <div class="bubble-meta">
                <span class="bubble-name">Nyaya</span>
                <span class="bubble-time">${timeStr}</span>
            </div>
            <div class="bubble bot-bubble">${inner}</div>
        </div>`;

    chatBox.appendChild(el);
    el.querySelectorAll('[data-topic]').forEach(b => {
        b.addEventListener('click', () => sendTopic(b.dataset.topic));
    });
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Typing Indicator
function appendTypingIndicator() {
    const chatBox = document.getElementById("chatMessages");
    const id = "typing_" + Date.now();

    const el = document.createElement("div");
    el.className = "msg-row bot-row";
    el.id = id;
    el.innerHTML = `
        <div class="avatar bot-av"><i class="fa-solid fa-scale-balanced"></i></div>
        <div class="bubble-wrap">
            <div class="bubble bot-bubble" style="padding:10px 14px">
                <div class="typing-dots"><span></span><span></span><span></span></div>
            </div>
        </div>`;
    chatBox.appendChild(el);
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

// Close on veil click
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal-veil').forEach(veil => {
        veil.addEventListener('click', e => {
            if (e.target === veil) veil.classList.remove('active');
        });
    });
});

// Case Lookup Modal Functions
function openCaseLookupModal() {
    openModal("caseModal");
}

function switchCaseTab(tab) {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(c => c.classList.remove('active'));

    if (tab === 'cnr') {
        document.querySelectorAll('.tab')[0].classList.add('active');
        document.getElementById('cnrTab').classList.add('active');
    } else {
        document.querySelectorAll('.tab')[1].classList.add('active');
        document.getElementById('detailsTab').classList.add('active');
    }
}

async function handleCaseSearch(e) {
    e.preventDefault();
    const cnr = document.getElementById("cnrInput").value.trim();
    const resultBox = document.getElementById("caseResultBox");

    resultBox.style.display = "block";
    resultBox.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Preparing official lookup guidance...</div>`;

    try {
        const res = await fetch("/api/case-lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cnr_number: cnr || "DLCT010023452023" })
        });
        const data = await res.json();

        resultBox.innerHTML = `<div style="border-left: 4px solid #d4af37; padding-left: 12px;"><strong>This is not a live case search.</strong><p style="margin-top: 7px; font-size: .88rem;">${escapeHtml(data.message)}</p></div>`;
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
                Judges Strength and Vacancies across Judicial Levels (${data.last_updated}):
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
    container.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading reference summary...</div>`;

    try {
        const res = await fetch("/api/njdg-stats");
        const data = await res.json();

        container.innerHTML = `
            <p style="margin-bottom: 16px; font-size: 0.9rem; color: var(--text-secondary);">
                National Judicial Data Grid (NJDG) reference summary — not a real-time feed:
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

function safeExternalUrl(value) {
    try {
        const url = new URL(value);
        return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : null;
    } catch {
        return null;
    }
}
