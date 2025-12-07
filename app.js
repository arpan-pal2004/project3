// =====================================================
// LOAD & NORMALIZE TEXT
// =====================================================

let paragraphs = [];
let normalizedParagraphs = [];
let gitaDataReady = false;

function normalizeText(s) {
    if (!s) return "";
    return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}


window.onload = () => {
    const data = gitaData; //use js file to avoid CORS issues

    paragraphs = data.map(item => {
        const contentText = item.Sanskrit.map(line => line.trim()).join('\n').trim();
        const translationText = item.Translation;

        return {
            verse: item.verse,
            translation: translationText,
            content: contentText,
            full: `${item.verse}\n${contentText}\nTranslation:\n${translationText}`
        };
    });

    normalizedParagraphs = paragraphs.map(p => normalizeText(p.full));
    gitaDataReady = true;
};


// =====================================================
// UI EFFECTS
// =====================================================

function showTyping() {
    document.getElementById("typing").classList.remove("hidden");
}

function hideTyping() {
    document.getElementById("typing").classList.add("hidden");
}


// =====================================================
// CHAT MESSAGE SENDING
// =====================================================

document.getElementById("askBtn").addEventListener("click", sendMessage);
document.getElementById("question").addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
});

function sendMessage() {
    const header = document.getElementById("header");
    const chatContainer = document.getElementById("chat-container");

    const input = document.getElementById("question");
    const question = input.value.trim();
    if (!question) return;
    
    // Check for data readiness
    if (!gitaDataReady) { 
        addMessage("Gita data is still loading or failed to load. Please resolve the data file issue first.", "bot-msg");
        return;
    }

    // APPLY STYLING CHANGES ON FIRST MESSAGE: Move header to top-left
    header.classList.add("top-left");
    
    chatContainer.classList.add("visible");


    addMessage(question, "user-msg");
    input.value = "";

    // Process answer with delay
    showTyping();

    setTimeout(() => {
        hideTyping();
        answerQuestion(question);
    }, 700);
}

function addMessage(text, type) {
    const box = document.getElementById("chat-box");
    const bubble = document.createElement("div");
    bubble.className = type;

    if (type === "bot-msg") {
        bubble.innerHTML = text;
    } else {
        bubble.textContent = text;
    }

    box.appendChild(bubble);
    box.scrollTop = box.scrollHeight;
}


// =====================================================
// LEVENSHTEIN (FUZZY SEARCH)
// =====================================================

function levenshtein(a, b) {
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1)
            );
        }
    }

    return matrix[b.length][a.length];
}

function similarity(a, b) {
    a = normalizeText(a);
    b = normalizeText(b);

    const dist = levenshtein(a, b);
    return 1 - dist / Math.max(a.length, b.length);
}


// =====================================================
// HIGHLIGHT MATCHED WORDS
// =====================================================

function highlightWord(paragraph, tokens) {
    let html = paragraph.replace(/\n/g, "<br>");

    const escapedTokens = tokens.map(token => 
        token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );

    escapedTokens.forEach(escaped => {
        const reExact = new RegExp(escaped, "gi");

        html = html.replace(reExact, match =>
            `<mark style="background:#ffd54f;color:black;border-radius:4px;padding:0 3px;">${match}</mark>`
        );
    });

    const words = html.split(/(\b)/);
    html = words.map(w => {
        const norm = normalizeText(w);
        for (const t of tokens) {
            if (w.length > 2 && similarity(norm, t) >= 0.7) { 
                 if (!w.includes('<mark')) {
                    return `<mark style="background:#ffab40;color:black;border-radius:4px;padding:0 3px;">${w}</mark>`;
                 }
            }
        }
        return w;
    }).join("");

    return html;
}


// =====================================================
// MAIN SEARCH
// =====================================================

function answerQuestion(query) {
    const normQuery = normalizeText(query);
    const tokens = normQuery.split(/\s+/).filter(t => t);

    let results = [];

    for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i];
        const norm = normalizedParagraphs[i];
        const words = norm.split(/\W+/);

        let score = 0;

        for (const t of tokens) {
            for (const w of words) {
                if (!w) continue;

                const sim = similarity(t, w);

                if (sim > 0.6) score += sim;
                if (w.startsWith(t)) score += 0.3;
                if (w.includes(t)) score += 0.1;
            }
        }

        if (score > 0.5) {
            results.push({ score, text: para });
        }
    }

    results.sort((a, b) => b.score - a.score);

    if (results.length === 0) {
        addMessage("No fuzzy match found for your query in the Bhagavad Gita.", "bot-msg");
        return;
    }

    let reply = `<b>Top Matches:</b><br><br>`;

    results.slice(0, 5).forEach((r, i) => {
        const para = r.text;
        const highlightedContent = highlightWord(para.content, tokens);
        const highlightedTranslation = highlightWord(para.translation, tokens);

        reply += `
            <div style="margin-bottom:14px;">
                <div style="background:#2a2a2a;padding:12px;border-radius:8px;">
                    ${para.verse ? `<b>Verse: ${para.verse}</b><br><br>` : ""}
                    <div class="verse-content">
                        ${highlightedContent}
                    </div>
                    ${
                        para.translation
                            ? `<br><br><b>Translation:</b><br>${highlightedTranslation}`
                            : ""
                    }
                </div>
            </div>
        `;
    });

    addMessage(reply, "bot-msg");
}
