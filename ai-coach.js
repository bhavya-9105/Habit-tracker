/**
 * AI Coach Integration via Google Gemini Flash API
 */

const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_PLACEHOLDER';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

document.addEventListener('DOMContentLoaded', () => {
    const drawer = document.getElementById('ai-coach-drawer');
    const drawerToggle = document.getElementById('drawer-toggle');
    const toggleIcon = drawerToggle.querySelector('.toggle-icon');
    
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-chat');
    const chatWindow = document.getElementById('chat-window');

    // Drawer Toggle Logic
    drawerToggle.addEventListener('click', () => {
        drawer.classList.toggle('open');
        if (drawer.classList.contains('open')) {
            toggleIcon.classList.remove('fa-chevron-up');
            toggleIcon.classList.add('fa-chevron-down');
        } else {
            toggleIcon.classList.remove('fa-chevron-down');
            toggleIcon.classList.add('fa-chevron-up');
        }
    });

    // Send Message Logic
    const sendMessage = async () => {
        const text = chatInput.value.trim();
        if (!text) return;

        appendMessage(text, 'user');
        chatInput.value = '';

        // Show typing indicator
        const typingId = appendMessage('...', 'ai', true);

        try {
            // Serialize Dashboard State for Context
            const stateContext = window.AppLogic ? window.AppLogic.serializeState() : 'No context available';
            
            const personaSelect = document.getElementById('coach-persona');
            const personaType = personaSelect ? personaSelect.value : 'zen_mentor';
            
            let personaInstruction = "";
            if (personaType === 'drill_sergeant') {
                personaInstruction = "You are 'The Drill Sergeant', a harsh, raw, aggressive cyberpunk commander. Callously call out any breaks in consistency. Use military jargon and ALL CAPS for emphasis. Be extremely tough.";
            } else if (personaType === 'data_scientist') {
                personaInstruction = "You are 'The Data Scientist', a cold, calculated, purely statistical AI. Evaluate progress using performance coefficient data. Speak logically, reference data points, and remain emotionally detached.";
            } else {
                personaInstruction = "You are 'The Zen Mentor', a calm, scientific, reassuring AI. Use mindfulness frameworks and cognitive behavioral therapy concepts to encourage the user. Speak peacefully.";
            }
            
            const prompt = `
                ${personaInstruction}
                
                Current User Context:
                ${stateContext}
                
                User Message: "${text}"
            `;

            if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_PLACEHOLDER') {
                updateMessage(typingId, "Please set your Gemini API key in ai-coach.js to enable the AI coach!");
                return;
            }

            const response = await fetch(GEMINI_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();
            if (data.error) {
                updateMessage(typingId, `Error: ${data.error.message}`);
                return;
            }

            const aiText = data.candidates[0].content.parts[0].text;
            updateMessage(typingId, aiText);

        } catch (error) {
            updateMessage(typingId, "Connection error. Keep grinding anyway!");
            console.error(error);
        }
    };

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Chat UI Helpers
    function appendMessage(text, sender, isTyping = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;
        msgDiv.textContent = text;
        
        const id = `msg-${Date.now()}`;
        msgDiv.id = id;

        if (isTyping) msgDiv.style.opacity = 0.5;

        chatWindow.appendChild(msgDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        
        return id;
    }

    function updateMessage(id, text) {
        const msgDiv = document.getElementById(id);
        if (msgDiv) {
            msgDiv.textContent = text;
            msgDiv.style.opacity = 1;
        }
    }

    // Expose Global Engine Instance
    window.aiCoachEngineInstance = {
        triggerProactiveAlert: (habitName) => {
            console.log(`[AI Coach] Triggering proactive alert for: ${habitName}`);
            
            // Expand Drawer & Alert Styling
            drawer.classList.add('open');
            drawer.classList.add('alert');
            toggleIcon.classList.remove('fa-chevron-up');
            toggleIcon.classList.add('fa-chevron-down');
            
            // Flash Notification Dot
            const dot = document.getElementById('ai-notification-dot');
            if (dot) {
                dot.classList.remove('hidden');
                dot.classList.add('violent-pulse');
            }

            // Append Context-Aware Warning
            appendMessage(`🚨 CRITICAL VECTOR CRASHING: You are neglecting "${habitName}". Re-engage immediately to stabilize your streak!`, 'ai');
            
            // Optional: Dismiss dot when drawer is toggled closed
            drawerToggle.addEventListener('click', function dismissAlert() {
                if (!drawer.classList.contains('open')) {
                    drawer.classList.remove('alert');
                    if (dot) {
                        dot.classList.add('hidden');
                        dot.classList.remove('violent-pulse');
                    }
                    drawerToggle.removeEventListener('click', dismissAlert);
                }
            });
        }
    };
});
