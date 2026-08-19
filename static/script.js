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

function renderMarkdown(rawText) {
    if (!rawText) return "";
    let text = escapeHtml(rawText);

    // Bold & Inline code
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Split paragraphs
    const paragraphs = text.split(/\n\n+/);
    const htmlParts = paragraphs.map(p => {
        const lines = p.split(/\n/);
        let inList = false;
        let listType = "ul";
        let out = "";

        lines.forEach(line => {
            const trimmed = line.trim();
            const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
            const bulletMatch = trimmed.match(/^[•\-\*]\s+(.*)$/);

            if (numMatch) {
                if (!inList) { out += "<ol class='bubble-list'>"; inList = true; listType = "ol"; }
                out += `<li>${numMatch[2]}</li>`;
            } else if (bulletMatch) {
                if (!inList) { out += "<ul class='bubble-list'>"; inList = true; listType = "ul"; }
                out += `<li>${bulletMatch[1]}</li>`;
            } else {
                if (inList) { out += `</${listType}>`; inList = false; }
                out += (out ? "<br>" : "") + line;
            }
        });

        if (inList) out += `</${listType}>`;
        return `<p>${out}</p>`;
    });

    return htmlParts.join("");
}

// Append Bot Message
function appendBotMessage(data, origQuery) {
    const chatBox = document.getElementById("chatMessages");
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const el = document.createElement("div");
    el.className = "msg-row bot-row";

    const formattedBody = renderMarkdown(data.message || "");
    let inner = `<div class="msg-title">${escapeHtml(data.title || 'Nyaya')}</div><div class="msg-text-content">${formattedBody}</div>`;

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
            <button class="fb-btn" onclick="submitFeedback('${escapeHtml(origQuery)}','${escapeHtml(data.title)}',true,this)" title="Yes"><i class="fa-regular fa-thumbs-up"></i></button>
            <button class="fb-btn" onclick="submitFeedback('${escapeHtml(origQuery)}','${escapeHtml(data.title)}',false,this)" title="No"><i class="fa-regular fa-thumbs-down"></i></button>
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
let currentCaseTab = 'cnr';

function openCaseLookupModal() {
    openModal("caseModal");
}

function switchCaseTab(tab) {
    currentCaseTab = tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(c => c.classList.remove('active'));

    const submitBtn = document.getElementById('caseSubmitBtn');

    if (tab === 'cnr') {
        document.getElementById('tabBtnCnr')?.classList.add('active');
        document.getElementById('cnrTab')?.classList.add('active');
        if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> Decode CNR &amp; Guide Lookup`;
    } else {
        document.getElementById('tabBtnDetails')?.classList.add('active');
        document.getElementById('detailsTab')?.classList.add('active');
        if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-search"></i> Prepare Case Query`;
    }
}

async function handleCaseSearch(e) {
    if (e) e.preventDefault();
    const resultBox = document.getElementById("caseResultBox");
    resultBox.style.display = "block";
    resultBox.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Processing query...</div>`;

    let payload = {};
    if (currentCaseTab === 'cnr') {
        const cnr = (document.getElementById("cnrInput")?.value || "").trim();
        payload = { mode: 'cnr', cnr_number: cnr || "DLCT010023452023" };
    } else {
        payload = {
            mode: 'case_no',
            state: document.getElementById("stateSelect")?.value,
            district: document.getElementById("districtInput")?.value,
            case_type: document.getElementById("caseTypeInput")?.value,
            case_number: document.getElementById("caseNoInput")?.value,
            year: document.getElementById("caseYearInput")?.value
        };
    }

    try {
        const res = await fetch("/api/case-lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.status === "INVALID_CNR" || data.status === "INVALID_PARAMS") {
            resultBox.innerHTML = `
                <div class="cnr-card" style="border-left: 4px solid var(--red);">
                    <div class="cnr-hdr">
                        <span style="color: var(--red); font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Invalid Input</span>
                        <span class="cnr-badge-warn">Attention</span>
                    </div>
                    <p style="font-size: .84rem; color: var(--t2); margin-bottom: 8px;">${escapeHtml(data.message)}</p>
                </div>`;
            return;
        }

        if (data.mode === 'cnr') {
            const d = data.details || {};
            resultBox.innerHTML = `
                <div class="cnr-card">
                    <div class="cnr-hdr">
                        <span><i class="fa-solid fa-fingerprint"></i> CNR: <strong>${escapeHtml(data.cnr)}</strong></span>
                        <span class="cnr-badge-success"><i class="fa-solid fa-check"></i> Valid Schema</span>
                    </div>
                    <div class="cnr-grid">
                        <div class="cnr-cell">
                            <div class="cnr-cell-lbl">State / UT</div>
                            <div class="cnr-cell-val">${escapeHtml(d.state)} (${escapeHtml(d.state_code)})</div>
                        </div>
                        <div class="cnr-cell">
                            <div class="cnr-cell-lbl">District &amp; Court Code</div>
                            <div class="cnr-cell-val">${escapeHtml(d.district_code)} / ${escapeHtml(d.court_complex_code)}</div>
                        </div>
                        <div class="cnr-cell">
                            <div class="cnr-cell-lbl">Filing / Case Number</div>
                            <div class="cnr-cell-val">#${escapeHtml(d.filing_number)}</div>
                        </div>
                        <div class="cnr-cell">
                            <div class="cnr-cell-lbl">Registration Year</div>
                            <div class="cnr-cell-val">${escapeHtml(d.filing_year)}</div>
                        </div>
                    </div>
                    <p style="font-size: .78rem; color: var(--t2); margin-bottom: 10px; line-height: 1.4;">
                        ${escapeHtml(data.message)} Official eCourts portal requires manual captcha verification to access cause lists and orders.
                    </p>
                    <div class="cnr-action-row">
                        <button type="button" class="cnr-btn-copy" onclick="copyToClipboard('${escapeHtml(data.cnr)}')">
                            <i class="fa-regular fa-copy"></i> Copy CNR
                        </button>
                        <a href="${escapeHtml(d.official_portal_url)}" target="_blank" rel="noopener noreferrer" class="cnr-btn-primary">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Portal &amp; Verify
                        </a>
                    </div>
                </div>`;
        } else {
            const d = data.details || {};
            resultBox.innerHTML = `
                <div class="cnr-card">
                    <div class="cnr-hdr">
                        <span><i class="fa-solid fa-file-lines"></i> Case: <strong>${escapeHtml(d.case_number)} / ${escapeHtml(d.filing_year)}</strong></span>
                        <span class="cnr-badge-success"><i class="fa-solid fa-check"></i> Query Formatted</span>
                    </div>
                    <div class="cnr-grid">
                        <div class="cnr-cell">
                            <div class="cnr-cell-lbl">State Jurisdiction</div>
                            <div class="cnr-cell-val">${escapeHtml(d.state)}</div>
                        </div>
                        <div class="cnr-cell">
                            <div class="cnr-cell-lbl">District / Complex</div>
                            <div class="cnr-cell-val">${escapeHtml(d.district)}</div>
                        </div>
                        <div class="cnr-cell">
                            <div class="cnr-cell-lbl">Case Type</div>
                            <div class="cnr-cell-val">${escapeHtml(d.case_type)}</div>
                        </div>
                        <div class="cnr-cell">
                            <div class="cnr-cell-lbl">Case Registration</div>
                            <div class="cnr-cell-val">${escapeHtml(d.case_number)} (${escapeHtml(d.filing_year)})</div>
                        </div>
                    </div>
                    <div class="cnr-action-row">
                        <a href="${escapeHtml(d.official_portal_url)}" target="_blank" rel="noopener noreferrer" class="cnr-btn-primary">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Search on Official Portal
                        </a>
                    </div>
                </div>`;
        }
    } catch (err) {
        resultBox.innerHTML = `<div style="color: #ef4444; font-size:.82rem; padding:8px;">Failed to process lookup request. Verify server status.</div>`;
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            alert("CNR copied to clipboard: " + text);
        }).catch(() => {});
    } else {
        const tempInput = document.createElement("input");
        tempInput.value = text;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
        alert("CNR copied to clipboard: " + text);
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
