/**
 * @fileoverview Frontend logic for VoteSmart Hub.
 * @description Handles UI interactions, API calls, Web Speech API, and Local Storage caching.
 */

document.addEventListener('DOMContentLoaded', () => {
    const onboardingModal = document.getElementById('onboardingModal');
    const onboardingForm = document.getElementById('onboardingForm');
    const chatHistory = document.getElementById('chatHistory');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const micBtn = document.getElementById('micBtn');
    const timelineContainer = document.getElementById('timelineContainer');
    const quizContainer = document.getElementById('quizContainer');
    const quizQuestion = document.getElementById('quizQuestion');
    const quizOptions = document.getElementById('quizOptions');
    const quizFeedback = document.getElementById('quizFeedback');
    const contrastToggle = document.getElementById('contrastToggle');

    let userContext = {};
    let isRecording = false;

    // --- High Contrast Toggle ---
    contrastToggle.addEventListener('click', () => {
        document.body.classList.toggle('high-contrast');
    });

    // --- Onboarding Logic & Caching ---
    const savedContext = sessionStorage.getItem('voteSmartContext');
    if (savedContext) {
        userContext = JSON.parse(savedContext);
        loadChatHistory();
    } else {
        onboardingModal.showModal();
    }

    onboardingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        userContext = {
            state: document.getElementById('userState').value,
            age: document.getElementById('userAge').value,
            language: document.getElementById('userLanguage').value,
        };
        sessionStorage.setItem('voteSmartContext', JSON.stringify(userContext));
        onboardingModal.close();
        addMessage('AI', `Welcome! I'm your Election Assistant. I've tailored my knowledge for ${userContext.state}. How can I help you today?`);
    });

    // --- Web Speech API (Voice-to-Voice) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add('bg-red-500', 'animate-pulse');
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
        micBtn.style.display = 'none'; // Hide if not supported
    }

    micBtn.addEventListener('click', () => {
        if (!recognition) return;
        if (isRecording) {
            recognition.stop();
        } else {
            recognition.lang = userContext.language === 'Spanish' ? 'es-ES' : (userContext.language === 'French' ? 'fr-FR' : 'en-US');
            recognition.start();
        }
    });

    function stopRecording() {
        isRecording = false;
        micBtn.classList.remove('bg-red-500', 'animate-pulse');
        micBtn.setAttribute('aria-label', 'Start Voice Input');
    }

    function speakText(text) {
        if (!window.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = userContext.language === 'Spanish' ? 'es-ES' : (userContext.language === 'French' ? 'fr-FR' : 'en-US');
        window.speechSynthesis.speak(utterance);
    }

    // --- Chat Logic & Efficiency ---
    let debounceTimer;
    chatInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            // Typing logic if needed
        }, 300);
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });
    sendBtn.addEventListener('click', handleSend);

    async function handleSend() {
        const message = chatInput.value.trim();
        if (!message) return;

        addMessage('User', message);
        chatInput.value = '';

        const loadingId = 'loading-' + Date.now();
        addMessage('AI', 'Processing your query...', loadingId);

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
                speakText(data.answer); // Web Speech API Read aloud
                updateTimeline(data.timeline);
                if (data.quiz) showQuiz(data.quiz);
                saveSessionState();
            } else {
                addMessage('AI', `Error: ${result.error}`);
            }
        } catch (error) {
            document.getElementById(loadingId)?.remove();
            addMessage('AI', 'Sorry, an error occurred while connecting to the server.');
            console.error(error);
        }
    }

    function addMessage(sender, text, id = null) {
        const msgDiv = document.createElement('div');
        if (id) msgDiv.id = id;
        msgDiv.className = `p-3 rounded-xl max-w-[85%] ${sender === 'User' ? 'bg-gray-700 ml-auto text-right' : 'bg-emeraldSuccess bg-opacity-20 text-left border border-emeraldSuccess/30'}`;
        msgDiv.innerHTML = `<strong class="text-sm text-gray-300 block mb-1">${sender}</strong> <p class="text-md">${text}</p>`;
        chatHistory.appendChild(msgDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // --- Timeline Update ---
    function updateTimeline(timelineData) {
        if (!timelineData || !Array.isArray(timelineData)) return;
        timelineContainer.innerHTML = '';
        timelineData.forEach((item) => {
            const stepDiv = document.createElement('div');
            stepDiv.className = 'relative pl-6 pb-6 transition-all duration-300 hover:translate-x-1';
            stepDiv.innerHTML = `
                <div class="absolute left-[-5px] top-1 w-3 h-3 bg-goldHighlight rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
                <h4 class="font-bold text-emeraldSuccess text-lg">${item.step}. ${item.title}</h4>
                <p class="text-sm text-gray-300 mt-1">${item.description}</p>
                <span class="text-xs text-goldHighlight mt-2 block font-semibold uppercase tracking-wider">📅 ${item.date}</span>
            `;
            timelineContainer.appendChild(stepDiv);
        });
    }

    // --- Quiz Logic ---
    function showQuiz(quizData) {
        quizContainer.classList.remove('hidden');
        quizFeedback.classList.add('hidden');
        quizQuestion.textContent = quizData.question;
        quizOptions.innerHTML = '';

        quizData.options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'p-3 bg-gray-800 border border-gray-600 hover:bg-gray-700 rounded-lg transition-all focus:ring-2 focus:ring-emeraldSuccess text-left text-sm md:text-base font-medium';
            btn.textContent = option;
            btn.onclick = () => {
                if (option === quizData.answer) {
                    btn.classList.add('bg-emeraldSuccess', 'text-white', 'border-emeraldSuccess');
                    quizFeedback.innerHTML = '✅ <span class="text-emeraldSuccess">Correct!</span>';
                    quizFeedback.className = 'mt-4 font-bold block text-lg';
                } else {
                    btn.classList.add('bg-red-500', 'text-white', 'border-red-500');
                    quizFeedback.innerHTML = `❌ Incorrect. The right answer is: <span class="text-emeraldSuccess">${quizData.answer}</span>`;
                    quizFeedback.className = 'mt-4 font-bold block text-lg';
                }
                Array.from(quizOptions.children).forEach(child => child.disabled = true);
            };
            quizOptions.appendChild(btn);
        });
    }

    // --- Session Storage Caching ---
    function saveSessionState() {
        sessionStorage.setItem('chatHistory', chatHistory.innerHTML);
        sessionStorage.setItem('timelineState', timelineContainer.innerHTML);
    }

    function loadChatHistory() {
        const savedHistory = sessionStorage.getItem('chatHistory');
        const savedTimeline = sessionStorage.getItem('timelineState');
        if (savedHistory) chatHistory.innerHTML = savedHistory;
        if (savedTimeline) timelineContainer.innerHTML = savedTimeline;
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
});
