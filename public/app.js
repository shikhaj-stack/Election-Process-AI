/**
 * @fileoverview Frontend logic for VoteSmart Hub.
 * @description Handles extended UI interactions, API calls, Accessibility, and Client-side Exporting.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const onboardingModal = document.getElementById('onboardingModal');
    const onboardingForm = document.getElementById('onboardingForm');
    const chatHistory = document.getElementById('chatHistory');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const micBtn = document.getElementById('micBtn');
    const timelineContainer = document.getElementById('timelineContainer');
    const timelineEmptyState = document.getElementById('timelineEmptyState');
    const urgentActionContainer = document.getElementById('urgentActionContainer');
    
    const quizContainer = document.getElementById('quizContainer');
    const quizQuestion = document.getElementById('quizQuestion');
    const quizOptions = document.getElementById('quizOptions');
    const quizFeedback = document.getElementById('quizFeedback');
    
    const contrastToggle = document.getElementById('contrastToggle');
    const exportPlanBtn = document.getElementById('exportPlanBtn');
    const userInfoBadge = document.getElementById('userInfoBadge');

    let userContext = {};
    let isRecording = false;
    let currentTimelineData = [];

    // --- Accessibility: High Contrast Toggle ---
    contrastToggle.addEventListener('click', () => {
        document.body.classList.toggle('high-contrast');
    });

    // --- Onboarding Logic & Caching ---
    const savedContext = sessionStorage.getItem('voteSmartContext');
    if (savedContext) {
        userContext = JSON.parse(savedContext);
        applyAccessibilityPreferences();
        updateUserBadge();
        loadChatHistory();
        if (chatHistory.children.length === 0) {
            greetUser();
        }
    } else {
        onboardingModal.showModal();
    }

    onboardingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Capture extended details
        userContext = {
            state: document.getElementById('userState').value,
            age: document.getElementById('userAge').value,
            language: document.getElementById('userLanguage').value,
            experience: document.querySelector('input[name="experience"]:checked').value,
            issue: document.getElementById('userIssue').value,
            accessibility: document.getElementById('userAccessibility').value,
        };
        
        sessionStorage.setItem('voteSmartContext', JSON.stringify(userContext));
        applyAccessibilityPreferences();
        updateUserBadge();
        onboardingModal.close();
        
        greetUser();
    });

    function applyAccessibilityPreferences() {
        if (userContext.accessibility === 'Visual') {
            document.body.classList.add('large-text');
        } else {
            document.body.classList.remove('large-text');
        }
    }

    function updateUserBadge() {
        if (!userContext.state) return;
        userInfoBadge.innerHTML = `📍 ${userContext.state} | ${userContext.experience}`;
        userInfoBadge.classList.remove('hidden');
    }

    function greetUser() {
        let greeting = `Welcome to VoteSmart Hub! I've tailored my knowledge for a ${userContext.experience.toLowerCase()} voter in ${userContext.state}. `;
        if (userContext.issue && userContext.issue !== 'Other') {
            greeting += `I see you're passionate about ${userContext.issue}. `;
        }
        greeting += `How can I help you prepare for the upcoming elections?`;
        
        addMessage('AI', greeting);
        if (userContext.accessibility === 'Audio') speakText(greeting);
    }

    // --- Web Speech API (Voice-to-Voice) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add('text-danger', 'bg-white/10', 'animate-pulse');
            micBtn.setAttribute('aria-label', 'Stop Recording');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            chatInput.value = transcript;
            handleSend();
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            stopRecording();
        };

        recognition.onend = () => {
            stopRecording();
        };
    } else {
        micBtn.style.display = 'none';
    }

    micBtn.addEventListener('click', () => {
        if (!recognition) return;
        if (isRecording) {
            recognition.stop();
        } else {
            const langMap = { 'Spanish': 'es-ES', 'French': 'fr-FR', 'English': 'en-US' };
            recognition.lang = langMap[userContext.language] || 'en-US';
            recognition.start();
        }
    });

    function stopRecording() {
        isRecording = false;
        micBtn.classList.remove('text-danger', 'bg-white/10', 'animate-pulse');
        micBtn.setAttribute('aria-label', 'Start Voice Input');
    }

    function speakText(text) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel(); // Stop current speech
        const utterance = new SpeechSynthesisUtterance(text);
        const langMap = { 'Spanish': 'es-ES', 'French': 'fr-FR', 'English': 'en-US' };
        utterance.lang = langMap[userContext.language] || 'en-US';
        window.speechSynthesis.speak(utterance);
    }

    // --- Chat Logic & Efficiency ---
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
    sendBtn.addEventListener('click', handleSend);

    async function handleSend() {
        const message = chatInput.value.trim();
        if (!message) return;

        addMessage('User', message);
        chatInput.value = '';

        const loadingId = 'loading-' + Date.now();
        addTypingIndicator(loadingId);

        try {
            const response = await fetch('/api/v1/election/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, context: userContext })
            });

            const result = await response.json();
            document.getElementById(loadingId)?.remove();

            if (response.status === 429) {
                addMessage('AI', 'Rate limit exceeded. Please wait a moment and try again.');
                return;
            }

            if (result.success) {
                const data = result.data;
                addMessage('AI', data.answer);
                
                // Auto-read if user requested audio accessibility
                if (userContext.accessibility === 'Audio') {
                    speakText(data.answer); 
                }
                
                if (data.timeline && data.timeline.length > 0) {
                    currentTimelineData = data.timeline;
                    updateTimeline(data.timeline);
                    updateUrgentAction(data.action_items);
                }
                
                if (data.quiz) showQuiz(data.quiz);
                
                saveSessionState();
            } else {
                addMessage('AI', `Error: ${result.error}`);
            }
        } catch (error) {
            document.getElementById(loadingId)?.remove();
            addMessage('AI', 'Sorry, an error occurred while connecting to the server. Please try again later.');
            console.error(error);
        }
    }

    function addMessage(sender, text, id = null) {
        const msgDiv = document.createElement('div');
        if (id) msgDiv.id = id;
        
        const isUser = sender === 'User';
        
        msgDiv.className = `flex ${isUser ? 'justify-end' : 'justify-start'} chat-message-anim w-full`;
        
        const innerDiv = document.createElement('div');
        innerDiv.className = `p-4 rounded-2xl max-w-[85%] md:max-w-[75%] ${
            isUser 
            ? 'bg-gradient-to-tr from-accentIndigo to-accentCyan text-white shadow-lg rounded-tr-sm' 
            : 'bg-white/5 border border-white/10 text-textMain rounded-tl-sm'
        }`;
        
        innerDiv.innerHTML = `<p class="text-sm md:text-base leading-relaxed whitespace-pre-wrap">${text}</p>`;
        
        msgDiv.appendChild(innerDiv);
        chatHistory.appendChild(msgDiv);
        scrollToBottom();
    }

    function addTypingIndicator(id) {
        const msgDiv = document.createElement('div');
        msgDiv.id = id;
        msgDiv.className = `flex justify-start chat-message-anim w-full`;
        
        msgDiv.innerHTML = `
            <div class="p-4 rounded-2xl bg-white/5 border border-white/10 rounded-tl-sm flex items-center gap-1">
                <div class="w-2 h-2 rounded-full bg-accentCyan typing-dot"></div>
                <div class="w-2 h-2 rounded-full bg-accentCyan typing-dot"></div>
                <div class="w-2 h-2 rounded-full bg-accentCyan typing-dot"></div>
            </div>
        `;
        chatHistory.appendChild(msgDiv);
        scrollToBottom();
    }

    function scrollToBottom() {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // --- Timeline & Urgent Action ---
    function updateTimeline(timelineData) {
        timelineEmptyState?.classList.add('hidden');
        exportPlanBtn.classList.remove('hidden');
        
        timelineContainer.innerHTML = '';
        timelineData.forEach((item, idx) => {
            const stepDiv = document.createElement('div');
            stepDiv.className = 'relative pl-6 pb-6 group';
            
            // Highlight the first step as active/urgent
            const isFirst = idx === 0;
            const dotColor = isFirst ? 'bg-success shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-white/30 group-hover:bg-accentCyan';
            const titleColor = isFirst ? 'text-success' : 'text-accentCyan';

            stepDiv.innerHTML = `
                <div class="absolute left-[-5px] top-1.5 w-3 h-3 ${dotColor} rounded-full transition-all duration-300"></div>
                <h4 class="font-bold ${titleColor} text-base md:text-lg tracking-wide">${item.step}. ${item.title}</h4>
                <p class="text-sm text-textMuted mt-1 leading-relaxed">${item.description}</p>
                <span class="inline-block mt-2 text-xs font-bold bg-white/5 border border-white/10 px-2.5 py-1 rounded-md text-textMain uppercase tracking-wider">📅 ${item.date}</span>
            `;
            timelineContainer.appendChild(stepDiv);
        });
    }

    function updateUrgentAction(actions) {
        if (!actions || actions.length === 0) return;
        const action = actions[0]; // Take the most urgent
        urgentActionContainer.innerHTML = `
            <p class="text-lg md:text-xl font-bold text-white mb-2 leading-tight">${action}</p>
            <div class="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-3">
                <div class="bg-accentCyan w-1/3 h-full animate-pulse"></div>
            </div>
        `;
    }

    // --- Feature: Export Action Plan ---
    exportPlanBtn.addEventListener('click', () => {
        if (currentTimelineData.length === 0) return;
        
        let content = `🗳️ MY VOTESMART ACTION PLAN - ${userContext.state.toUpperCase()}\n`;
        content += `========================================================\n\n`;
        
        currentTimelineData.forEach(item => {
            content += `[ ] ${item.step}. ${item.title.toUpperCase()}\n`;
            content += `    Deadline: ${item.date}\n`;
            content += `    Details:  ${item.description}\n\n`;
        });
        
        content += `\nGenerated via VoteSmart Hub. Make your voice heard!`;
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'My_Voting_Plan.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // --- Quiz Logic ---
    function showQuiz(quizData) {
        quizContainer.classList.remove('hidden');
        quizContainer.classList.remove('translate-y-4', 'opacity-0');
        quizFeedback.classList.add('hidden');
        
        quizQuestion.textContent = quizData.question;
        quizOptions.innerHTML = '';

        quizData.options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'p-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl transition-all text-left text-sm md:text-base font-medium text-textMain outline-none focus:ring-2 focus:ring-accentIndigo';
            btn.textContent = option;
            btn.onclick = () => {
                const isCorrect = option === quizData.answer;
                
                if (isCorrect) {
                    btn.classList.add('bg-success/20', 'border-success', 'text-white');
                    quizFeedback.innerHTML = '✅ <span class="text-success ml-1">Correct! Great job.</span>';
                    quizFeedback.className = 'mt-4 font-bold block text-sm bg-success/10 border border-success/20 p-3 rounded-xl';
                    
                    // Confetti effect (simple visual cue)
                    btn.style.transform = 'scale(1.05)';
                    setTimeout(() => btn.style.transform = 'scale(1)', 200);
                } else {
                    btn.classList.add('bg-danger/20', 'border-danger', 'text-white');
                    quizFeedback.innerHTML = `❌ <span class="text-textMuted ml-1">Not quite. The right answer is:</span> <span class="text-white">${quizData.answer}</span>`;
                    quizFeedback.className = 'mt-4 font-bold block text-sm bg-danger/10 border border-danger/20 p-3 rounded-xl';
                }
                
                Array.from(quizOptions.children).forEach(child => child.disabled = true);
            };
            quizOptions.appendChild(btn);
        });
    }

    // --- Session Storage Caching ---
    function saveSessionState() {
        sessionStorage.setItem('chatHistoryHTML', chatHistory.innerHTML);
        sessionStorage.setItem('timelineData', JSON.stringify(currentTimelineData));
        sessionStorage.setItem('urgentActionHTML', urgentActionContainer.innerHTML);
    }

    function loadChatHistory() {
        const savedHistory = sessionStorage.getItem('chatHistoryHTML');
        const savedTimeline = sessionStorage.getItem('timelineData');
        const savedUrgentAction = sessionStorage.getItem('urgentActionHTML');
        
        if (savedHistory) chatHistory.innerHTML = savedHistory;
        
        if (savedTimeline) {
            currentTimelineData = JSON.parse(savedTimeline);
            if (currentTimelineData.length > 0) {
                updateTimeline(currentTimelineData);
            }
        }
        
        if (savedUrgentAction) {
            urgentActionContainer.innerHTML = savedUrgentAction;
        }
        
        scrollToBottom();
    }
});
