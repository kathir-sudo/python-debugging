document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    const state = {
        currentPage: 'landing', // landing, challenge, submitting, results, admin
        team: null,
        questions: [],
        results: [],
        settings: { timerEnabled: false, timerDurationMinutes: 30 },
        timer: { intervalId: null, endTime: null },
        currentQuestionIndex: 0,
        userAnswers: {},
        lastScore: 0,
        adminPollingId: null,
        adminActiveTab: 'management', // 'management' or 'analytics'
        analyticsData: null,
        charts: {}, // To hold chart instances
    };

    const PROGRESS_KEY = 'debuggingChallengeProgress';
    const ADMIN_SESSION_KEY = 'adminSessionActive';

    // --- DOM SELECTORS ---
    const pages = {
        landing: document.getElementById('landing-page'),
        challenge: document.getElementById('challenge-page'),
        submitting: document.getElementById('submitting-page'),
        results: document.getElementById('results-page'),
        admin: document.getElementById('admin-page'),
    };

    // --- API HELPERS ---
    const api = {
        getQuestions: () => fetch('/api/questions').then(res => res.json()),
        getResults: () => fetch('/api/results').then(res => res.json()),
        postResult: (result) => fetch('/api/results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result)
        }).then(res => res.json()),
        postQuestion: (question) => fetch('/api/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(question)
        }).then(res => res.json()),
        updateQuestion: (id, question) => fetch(`/api/questions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(question)
        }),
        deleteQuestion: (id) => fetch(`/api/questions/${id}`, { method: 'DELETE' }),
        teamExists: (member1, member2) => fetch('/api/team/exists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member1, member2 })
        }).then(res => res.json()),
        getSettings: () => fetch('/api/settings').then(res => res.json()),
        updateSettings: (settings) => fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        }),
        postAttempt: (attempt) => fetch('/api/attempts', { // New for analytics
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attempt)
        }),
        getAnalytics: () => fetch('/api/analytics').then(res => res.json()), // New for analytics
    };
    
    // --- ICONS --- (SVG strings for dynamic rendering)
    const ICONS = {
        play: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 mr-2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
        restart: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 mr-2"><path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4"></path><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"></path></svg>`,
        submit: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 mr-2"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        next: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 mr-2"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
        previous: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 mr-2"><polyline points="15 18 9 12 15 6"></polyline></svg>`,
        trash: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
        edit: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
        chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-gray-400"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
        chevronUp: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-gray-400"><polyline points="18 15 12 9 6 15"></polyline></svg>`,
        trophy: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21A3.98 3.98 0 0 1 12 22a3.98 3.98 0 0 1 2.97-2.79c-.5-.23-.97-.66-.97-1.21v-2.34"/><path d="M12 14.66L17.5 9H6.5L12 14.66z"/></svg>`,
        plus: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    };
    
    // --- PROGRESS MANAGEMENT ---
    function saveProgress() {
        if (!state.team) return;
        const progress = {
            team: state.team,
            currentQuestionIndex: state.currentQuestionIndex,
            userAnswers: state.userAnswers,
            endTime: state.timer.endTime,
        };
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    }

    function loadProgress() {
        const savedProgress = localStorage.getItem(PROGRESS_KEY);
        if (savedProgress) {
            try {
                const progress = JSON.parse(savedProgress);
                state.team = progress.team;
                state.currentQuestionIndex = progress.currentQuestionIndex;
                state.userAnswers = progress.userAnswers;
                state.timer.endTime = progress.endTime;
                return true;
            } catch (e) {
                console.error("Failed to parse saved progress", e);
                clearProgress();
                return false;
            }
        }
        return false;
    }

    function clearProgress() {
        localStorage.removeItem(PROGRESS_KEY);
        if(state.timer.intervalId) {
            clearInterval(state.timer.intervalId);
            state.timer.intervalId = null;
        }
    }

    // --- UTILITY FUNCTIONS ---
    const normalizeCode = (str) => (str || '').replace(/\r\n/g, '\n').trim();

    // --- RENDER FUNCTIONS ---
    function navigateTo(pageName) {
        // Clear the admin polling interval if we are leaving the admin page
        if (state.currentPage === 'admin' && pageName !== 'admin' && state.adminPollingId) {
            clearInterval(state.adminPollingId);
            state.adminPollingId = null;
        }

        state.currentPage = pageName;
        Object.keys(pages).forEach(key => {
            pages[key].classList.add('hidden');
        });
        
        if (pages[pageName]) {
            pages[pageName].classList.remove('hidden');
            renderCurrentPage();
        }

        // Set admin session state in localStorage
        if (pageName === 'admin') {
            localStorage.setItem(ADMIN_SESSION_KEY, 'true');
        }
    }

    function renderCurrentPage() {
        const pageRenderer = {
            landing: renderLandingPage,
            challenge: renderChallengePage,
            submitting: renderSubmittingPage,
            results: renderResultsPage,
            admin: renderAdminPage,
        };
        if (pageRenderer[state.currentPage]) {
            pageRenderer[state.currentPage]();
        }
    }

    function renderLandingPage() {
        const savedProgress = JSON.parse(localStorage.getItem(PROGRESS_KEY));

        if (savedProgress && savedProgress.team) {
            pages.landing.innerHTML = `
                <div class="w-full max-w-2xl text-center">
                    <h1 class="text-5xl font-bold text-cyan-400 mb-4">Welcome Back!</h1>
                    <p class="text-lg text-gray-300 mb-8">You have a challenge in progress for Team <span class="font-bold text-white">${savedProgress.team.member1} & ${savedProgress.team.member2}</span>.</p>
                    <div class="bg-gray-800 p-8 rounded-lg shadow-2xl w-full space-y-4">
                        <button id="continue-challenge-btn" class="w-full py-3 px-6 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg shadow-lg">
                            Continue Challenge
                        </button>
                        <button id="start-new-btn" class="w-full py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg">
                            Start New Challenge (Deletes Progress)
                        </button>
                    </div>
                </div>
            `;
            document.getElementById('continue-challenge-btn').addEventListener('click', async () => {
                if (loadProgress()) {
                    state.questions = await api.getQuestions();
                    state.settings = await api.getSettings();
                    navigateTo('challenge');
                } else {
                    renderLandingPage(); // Failsafe if loading fails
                }
            });
            document.getElementById('start-new-btn').addEventListener('click', () => {
                if (confirm('Are you sure? This will delete your current saved progress.')) {
                    clearProgress();
                    renderLandingPage();
                }
            });
        } else {
            pages.landing.innerHTML = `
                <div class="w-full max-w-2xl text-center">
                  <div id="admin-panel-button-container" class="absolute top-4 right-4 min-h-[20px]"></div>
                  <h1 class="text-5xl font-bold text-cyan-400 mb-4">Python Debugging Challenge</h1>
                  <p class="text-lg text-gray-300 mb-8">Fix the bugs. Run the code. Climb the leaderboard.</p>
                  <div class="bg-gray-800 p-8 rounded-lg shadow-2xl w-full">
                    <h2 class="text-2xl font-semibold mb-6 text-white">Enter Your Team</h2>
                    <div id="error-message-container" class="text-red-400 mb-4 min-h-[1.5rem]"></div>
                    <div class="space-y-4 mb-6">
                      <input id="member1-input" type="text" placeholder="Team Member 1 Name" class="form-input">
                      <input id="member2-input" type="text" placeholder="Team Member 2 Name" class="form-input">
                    </div>
                    <button id="start-challenge-btn" class="w-full py-3 px-6 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg shadow-lg transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed">
                      Start Challenge
                    </button>
                  </div>
                  <div class="mt-8 text-left w-full bg-gray-800/50 p-6 rounded-lg">
                    <h3 class="text-xl font-semibold mb-2 text-cyan-300">Instructions</h3>
                    <ul class="list-disc list-inside space-y-2 text-gray-400">
                      <li>This competition can only be taken once per team. Your progress is saved automatically.</li>
                      <li>Analyze the buggy Python code provided in the editor.</li>
                      <li>Modify the code to fix the bug.</li>
                      <li>Use the <span class="font-mono text-yellow-400">Run/Check</span> button to test your fix.</li>
                      <li>Navigate with <span class="font-mono text-cyan-400">Next/Previous</span>. Your code is saved.</li>
                      <li>Click <span class="font-mono text-green-400">End Competition</span> on the final question to submit all answers.</li>
                    </ul>
                  </div>
                </div>`;

            const m1Input = document.getElementById('member1-input');
            const m2Input = document.getElementById('member2-input');
            const startBtn = document.getElementById('start-challenge-btn');
            const adminContainer = document.getElementById('admin-panel-button-container');
            const errorContainer = document.getElementById('error-message-container');

            function checkInputs() {
                const m1 = m1Input.value.trim();
                const m2 = m2Input.value.trim();
                startBtn.disabled = !m1 || !m2;
                const isAdmin = (m1.toLowerCase() === 'ace' && m2.toLowerCase() === 'admin') || (m1.toLowerCase() === 'admin' && m2.toLowerCase() === 'ace');
                adminContainer.innerHTML = isAdmin ? `<button id="admin-panel-link" class="text-sm text-gray-400 hover:text-white transition-colors">Admin Panel</button>` : '';
                if (isAdmin) {
                    document.getElementById('admin-panel-link').addEventListener('click', () => navigateTo('admin'));
                }
            }
            
            m1Input.addEventListener('input', checkInputs);
            m2Input.addEventListener('input', checkInputs);
            startBtn.addEventListener('click', async () => {
                startBtn.disabled = true;
                startBtn.textContent = 'Checking...';
                errorContainer.textContent = '';
                
                const member1 = m1Input.value.trim();
                const member2 = m2Input.value.trim();
                
                const { exists } = await api.teamExists(member1, member2);

                if (exists) {
                    errorContainer.textContent = 'This team has already completed the challenge.';
                    startBtn.disabled = false;
                    startBtn.textContent = 'Start Challenge';
                    return;
                }

                state.team = { member1, member2 };
                state.questions = await api.getQuestions();
                state.settings = await api.getSettings();
                state.userAnswers = state.questions.reduce((acc, q) => {
                    acc[q._id] = q.buggyCode;
                    return acc;
                }, {});
                state.currentQuestionIndex = 0;
                
                if (state.settings.timerEnabled) {
                    const durationMs = state.settings.timerDurationMinutes * 60 * 1000;
                    state.timer.endTime = Date.now() + durationMs;
                } else {
                    state.timer.endTime = null;
                }
                
                saveProgress();
                navigateTo('challenge');
            });
            
            checkInputs();
        }
    }

    function renderChallengePage() {
        if (!state.team || state.questions.length === 0) {
            navigateTo('landing');
            return;
        }
        const question = state.questions[state.currentQuestionIndex];
        const code = state.userAnswers[question._id] || question.buggyCode;
        const progress = ((state.currentQuestionIndex + 1) / state.questions.length) * 100;
        
        const isLastQuestion = state.currentQuestionIndex === state.questions.length - 1;

        pages.challenge.innerHTML = `
         <div class="w-full max-w-6xl mx-auto flex flex-col space-y-4 h-full">
              <header class="bg-gray-800 p-4 rounded-lg shadow-lg flex justify-between items-center flex-shrink-0">
                <div>
                  <h2 class="text-xl font-bold text-cyan-400">Team: ${state.team.member1} & ${state.team.member2}</h2>
                  <p class="text-gray-400">Question ${state.currentQuestionIndex + 1} of ${state.questions.length}</p>
                </div>
                <div id="timer-container" class="text-center"></div>
                <div class="text-right">
                    <p class="text-xl font-bold text-gray-300">Progress</p>
                    <div class="w-48 bg-gray-700 rounded-full h-2.5 mt-1">
                        <div class="bg-cyan-500 h-2.5 rounded-full" style="width: ${progress}%"></div>
                    </div>
                </div>
              </header>
              <main class="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-grow min-h-0">
                <div class="bg-gray-800 p-4 rounded-lg flex flex-col space-y-4 min-h-0">
                    <h3 class="text-lg font-semibold text-gray-300 flex-shrink-0">${question.description}</h3>
                    <div class="flex-grow editor-container min-h-[300px]">
                        <textarea id="code-editor-textarea" class="w-full h-full overflow-auto" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off">${code}</textarea>
                        <pre id="code-editor-pre" class="h-full overflow-auto" aria-hidden="true"><code class="language-python">${Prism.highlight(code, Prism.languages.python, 'python')}</code></pre>
                    </div>
                </div>
                <div class="bg-gray-800 p-4 rounded-lg flex flex-col space-y-4">
                    <div class="flex flex-wrap gap-2 flex-shrink-0">
                        <button id="reset-btn" class="btn btn-secondary">${ICONS.restart}Reset Code</button>
                        <button id="run-btn" class="btn btn-primary">${ICONS.play}Run/Check</button>
                    </div>
                    <div id="console" class="bg-gray-900 border border-gray-700 rounded-lg p-4 font-mono text-sm flex-grow h-48 flex flex-col">
                        <div class="flex-shrink-0 mb-2">
                            <span class="font-bold text-gray-400">OUTPUT:</span>
                        </div>
                        <pre class="whitespace-pre-wrap overflow-y-auto flex-grow text-gray-300">Click "Run/Check" to see the output.</pre>
                    </div>
                    <div class="flex justify-between items-center mt-auto pt-4 border-t border-gray-700 flex-shrink-0">
                        <button id="prev-btn" class="btn btn-secondary" ${state.currentQuestionIndex === 0 ? 'disabled' : ''}>${ICONS.previous}Previous</button>
                        ${isLastQuestion
                            ? `<button id="end-btn" class="btn-end-competition">${ICONS.submit}End Competition</button>`
                            : `<button id="next-btn" class="btn btn-primary">${ICONS.next}Next Question</button>`
                        }
                    </div>
                </div>
              </main>
            </div>`;
        
        initializeTimer();
            
        // Code Editor Logic
        const textarea = document.getElementById('code-editor-textarea');
        const pre = document.getElementById('code-editor-pre');
        const codeEl = pre.querySelector('code');
            
        function syncScroll() {
            pre.scrollTop = textarea.scrollTop;
            pre.scrollLeft = textarea.scrollLeft;
        }

        function updateEditor() {
            const newCode = textarea.value;
            state.userAnswers[question._id] = newCode;
            codeEl.innerHTML = Prism.highlight(newCode, Prism.languages.python, 'python');
            syncScroll();
        }
            
        textarea.addEventListener('input', () => {
            updateEditor();
            saveProgress();
        });
        textarea.addEventListener('scroll', syncScroll);
            
        textarea.addEventListener('keydown', function(e) {
            if (e.key == 'Tab') {
                e.preventDefault();
                var start = this.selectionStart;
                var end = this.selectionEnd;
                this.value = this.value.substring(0, start) + "  " + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + 2;
                textarea.dispatchEvent(new Event('input'));
            }
        });

        document.getElementById('reset-btn').addEventListener('click', () => {
            textarea.value = question.buggyCode;
            textarea.dispatchEvent(new Event('input'));
        });
        document.getElementById('run-btn').addEventListener('click', handleRunCheck);
        
        const prevBtn = document.getElementById('prev-btn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (state.currentQuestionIndex > 0) {
                    state.currentQuestionIndex--;
                    saveProgress();
                    renderChallengePage();
                }
            });
        }
        
        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (state.currentQuestionIndex < state.questions.length - 1) {
                    state.currentQuestionIndex++;
                    saveProgress();
                    renderChallengePage();
                }
            });
        }

        const endBtn = document.getElementById('end-btn');
        if(endBtn) {
            endBtn.addEventListener('click', () => handleEndCompetition(false));
        }
    }

    // --- TIMER LOGIC ---
    function initializeTimer() {
        if (state.timer.intervalId) {
            clearInterval(state.timer.intervalId);
        }
        if (!state.timer.endTime) {
            document.getElementById('timer-container').innerHTML = '';
            return;
        }
        state.timer.intervalId = setInterval(updateTimerDisplay, 1000);
        updateTimerDisplay(); // Initial call
    }

    function updateTimerDisplay() {
        const container = document.getElementById('timer-container');
        if (!container) return;

        const remainingMs = state.timer.endTime - Date.now();
        const remainingSeconds = Math.round(remainingMs / 1000);

        if (remainingSeconds <= 0) {
            container.innerHTML = `<p class="text-2xl font-bold text-red-500">TIME'S UP!</p>`;
            clearInterval(state.timer.intervalId);
            handleEndCompetition(true); // Forced submission
            return;
        }

        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        const timeColorClass = remainingSeconds < 60 ? 'text-red-500 animate-pulse' : 'text-yellow-400';

        container.innerHTML = `
            <p class="text-sm text-gray-400">Time Remaining</p>
            <p class="text-3xl font-bold ${timeColorClass}">${timeString}</p>
        `;
    }
    
    function updateConsole(output, status = 'IDLE') {
        const consoleEl = document.getElementById('console');
        if (!consoleEl) return;
        const statusMap = {
            IDLE: { label: 'OUTPUT', color: 'text-gray-400' },
            CORRECT: { label: 'SUCCESS', color: 'text-green-400' },
            INCORRECT: { label: 'ERROR', color: 'text-red-400' }
        };
        const { label, color } = statusMap[status];
        consoleEl.innerHTML = `
            <div class="flex-shrink-0 mb-2">
                <span class="font-bold ${color}">${label}:</span>
            </div>
            <pre class="whitespace-pre-wrap overflow-y-auto flex-grow text-gray-300">${output}</pre>
        `;
    }
    
    function handleRunCheck() {
        updateConsole('Running...');
        const question = state.questions[state.currentQuestionIndex];
        const userAnswer = state.userAnswers[question._id] || '';
        
        setTimeout(() => {
            const isCorrect = (question.fixedCodeSolutions || []).some(solution => normalizeCode(userAnswer) === normalizeCode(solution));

            // Log the attempt for analytics
            api.postAttempt({
                team: state.team,
                questionId: question._id,
                isCorrect: isCorrect
            });

            if (isCorrect) {
                updateConsole(`Correct!\n\nExpected Output:\n${question.expectedOutput}`, 'CORRECT');
            } else {
                updateConsole(`Incorrect. Keep trying!\n\nHint: The original error was:\n${question.originalError}`, 'INCORRECT');
            }
        }, 500);
    }
    
    async function handleEndCompetition(isTimeUp = false) {
        if (!isTimeUp && !window.confirm("Are you sure? This will submit all your answers for final scoring.")) return;
        
        if (isTimeUp) {
            alert("Time's up! Your answers are being submitted automatically.");
        }
        
        if (state.timer.intervalId) {
             clearInterval(state.timer.intervalId);
             state.timer.intervalId = null;
        }

        navigateTo('submitting');
        
        let score = 0;
        state.questions.forEach(q => {
            const userAnswer = state.userAnswers[q._id] || '';
            const isCorrect = (q.fixedCodeSolutions || []).some(solution => normalizeCode(userAnswer) === normalizeCode(solution));
            if (isCorrect) {
                score++;
            }
        });
        state.lastScore = score;
        
        await api.postResult({ team: state.team, score });
        clearProgress();

        setTimeout(() => navigateTo('results'), 2500);
    }

    function renderSubmittingPage() {
        pages.submitting.innerHTML = `
            <div class="w-full max-w-md text-center">
              <div class="bg-gray-800 p-8 rounded-lg shadow-2xl">
                <svg class="animate-spin h-12 w-12 text-cyan-400 mx-auto mb-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <h1 class="text-3xl font-bold text-white mb-2">Submission in Progress</h1>
                <p class="text-lg text-gray-300">
                  Your solutions are being processed. Please wait a moment.
                </p>
              </div>
            </div>`;
    }
    
    function renderResultsPage() {
        const { team } = state;
        pages.results.innerHTML = `
            <div class="w-full max-w-lg text-center bg-gray-800 p-10 rounded-lg shadow-2xl">
              <h1 class="text-4xl font-bold text-cyan-400 mb-4">Submission Received!</h1>
              <p class="text-lg text-gray-300 mb-6">Thank you, Team <span class="font-semibold text-white">${team.member1} & ${team.member2}</span>.</p>
              <div class="my-8 border-t border-b border-gray-700 py-6">
                <p class="text-2xl text-yellow-300">Results will be announced shortly.</p>
              </div>
              <p class="text-gray-400">You have successfully completed the challenge. Please wait for the final rankings to be posted by the event organizers.</p>
            </div>`;
    }
    
    // --- ADMIN PAGE LOGIC ---
    let editingQuestionId = null;
    let expandedQuestionId = null;

    async function renderAdminPage() {
        if (state.adminPollingId) {
            clearInterval(state.adminPollingId);
            state.adminPollingId = null;
        }

        const getTabClass = (tabName) => {
            return state.adminActiveTab === tabName 
                ? 'bg-cyan-600 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700';
        };

        pages.admin.innerHTML = `
            <div class="w-full max-w-7xl mx-auto flex flex-col space-y-6">
                <header class="flex justify-between items-center px-2">
                    <h1 class="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Admin Dashboard</h1>
                    <button id="exit-admin-btn" class="px-4 py-2 bg-gray-700/50 rounded-lg hover:bg-gray-700">&larr; Exit Admin</button>
                </header>
                <div class="flex border-b border-gray-700">
                    <button id="management-tab-btn" data-tab="management" class="px-6 py-3 font-semibold rounded-t-lg transition-colors ${getTabClass('management')}">Management</button>
                    <button id="analytics-tab-btn" data-tab="analytics" class="px-6 py-3 font-semibold rounded-t-lg transition-colors ${getTabClass('analytics')}">Analytics</button>
                </div>
                <div id="admin-management-content" class="${state.adminActiveTab !== 'management' ? 'hidden' : ''}"></div>
                <div id="admin-analytics-content" class="${state.adminActiveTab !== 'analytics' ? 'hidden' : ''}"></div>
            </div>`;
        
        document.getElementById('exit-admin-btn').addEventListener('click', () => {
            localStorage.removeItem(ADMIN_SESSION_KEY);
            navigateTo('landing');
        });

        const managementTabBtn = document.getElementById('management-tab-btn');
        const analyticsTabBtn = document.getElementById('analytics-tab-btn');
        
        managementTabBtn.addEventListener('click', () => {
            state.adminActiveTab = 'management';
            renderAdminPage();
        });
        analyticsTabBtn.addEventListener('click', () => {
            state.adminActiveTab = 'analytics';
            renderAdminPage();
        });

        if (state.adminActiveTab === 'management') {
            await renderAdminManagementContent();
        } else {
            await renderAdminAnalyticsContent();
        }
    }

    async function renderAdminManagementContent() {
        const contentEl = document.getElementById('admin-management-content');
        if (!contentEl) return;

        // Fetch data for management tab
        state.questions = await api.getQuestions();
        state.results = await api.getResults();
        state.settings = await api.getSettings();

        const renderLeaderboardList = (results) => {
             const getRankClasses = (index) => {
                if (index === 0) return 'bg-yellow-500/20 border-yellow-400/50';
                if (index === 1) return 'bg-gray-400/20 border-gray-500/50';
                if (index === 2) return 'bg-amber-700/20 border-amber-600/50';
                return 'bg-gray-700/20 border-gray-600/50';
            };

            const getRankIcon = (index) => {
                const iconClasses = {0: 'text-yellow-400', 1: 'text-gray-300', 2: 'text-amber-500'};
                if (index < 3) return `<span class="${iconClasses[index]}">${ICONS.trophy}</span>`;
                return `<span class="w-6 text-center font-bold text-gray-400">${index + 1}</span>`;
            };

            return results.length > 0 ? results.map((r, i) => `
                <li class="flex items-center justify-between p-3 rounded-lg border transition-transform hover:scale-105 duration-200 ${getRankClasses(i)}">
                    <div class="flex items-center">
                        <span class="w-8 h-8 flex items-center justify-center mr-3">${getRankIcon(i)}</span>
                        <div>
                            <p class="font-semibold">${r.team.member1} & ${r.team.member2}</p>
                            <p class="text-xs text-gray-400">Finished: ${new Date(r.completedAt).toLocaleString()}</p>
                        </div>
                    </div>
                    <p class="text-xl font-bold text-green-400">${r.score}</p>
                </li>`).join('') : `<p class="text-gray-400 text-center py-8">No results yet.</p>`;
        };

        const leaderboardHtml = renderLeaderboardList(state.results);

        const questionsHtml = state.questions.map(q => `
            <li data-question-id="${q._id}" class="question-item bg-gray-900/50 rounded-lg border border-gray-700">
                <div class="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-800/50" data-action="toggle-expand">
                    <p class="flex-1 pr-4 font-medium">${q.description}</p>
                    <div class="flex items-center gap-4">
                        <button data-action="edit" class="text-blue-400 hover:text-blue-300">${ICONS.edit}</button>
                        <button data-action="delete" class="text-red-400 hover:text-red-300">${ICONS.trash}</button>
                        ${expandedQuestionId === q._id ? ICONS.chevronUp : ICONS.chevronDown}
                    </div>
                </div>
                ${expandedQuestionId === q._id ? `
                <div class="px-4 pb-4 border-t border-gray-700 space-y-3">
                    <div class="mt-3">
                        <h4 class="font-semibold text-cyan-400">Buggy Code:</h4>
                        <pre class="bg-black/30 p-2 rounded-md mt-1 text-sm overflow-auto">${q.buggyCode}</pre>
                    </div>
                    <div>
                        <h4 class="font-semibold text-green-400">Corrected Code Solutions:</h4>
                        ${(q.fixedCodeSolutions || []).map(sol => `<pre class="bg-black/30 p-2 rounded-md mt-1 text-sm overflow-auto">${sol}</pre>`).join('')}
                    </div>
                     <div>
                        <h4 class="font-semibold text-yellow-400">Expected Output:</h4>
                        <pre class="bg-black/30 p-2 rounded-md mt-1 text-sm overflow-auto">${q.expectedOutput}</pre>
                    </div>
                </div>` : ''}
            </li>`).join('');

        contentEl.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div class="lg:col-span-3 flex flex-col space-y-6">
                    <div class="bg-gradient-to-br from-gray-800/50 to-gray-900/20 backdrop-blur-md border border-gray-700/50 rounded-xl shadow-2xl p-6">
                        <h2 class="text-2xl font-semibold mb-4 text-cyan-300">Timer Settings</h2>
                        <form id="settings-form" class="space-y-4">
                            <div class="flex items-center justify-between">
                                <label for="timerEnabled" class="font-medium">Enable Timer</label>
                                <input type="checkbox" id="timerEnabled" name="timerEnabled" class="h-6 w-6 rounded-md bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500">
                            </div>
                            <div class="flex items-center justify-between">
                                 <label for="timerDurationMinutes" class="font-medium">Duration (minutes)</label>
                                 <input type="number" id="timerDurationMinutes" name="timerDurationMinutes" class="form-input w-32" min="1">
                            </div>
                            <button type="submit" id="save-settings-btn" class="btn btn-primary w-full">Save Settings</button>
                        </form>
                    </div>
                    <div class="bg-gradient-to-br from-gray-800/50 to-gray-900/20 backdrop-blur-md border border-gray-700/50 rounded-xl shadow-2xl p-6">
                        <h2 id="form-title" class="text-2xl font-semibold mb-4 text-cyan-300">Add New Question</h2>
                        <form id="admin-form" class="space-y-4">
                            <textarea name="description" placeholder="Description" required class="form-input" rows="2"></textarea>
                            <textarea name="buggyCode" placeholder="Buggy Code" required class="form-input font-mono" rows="5"></textarea>
                            <div id="solutions-container" class="space-y-2">
                                <!-- Solutions will be dynamically added here -->
                            </div>
                            <button type="button" id="add-solution-btn" class="btn btn-secondary">${ICONS.plus}Add another solution</button>
                            <textarea name="expectedOutput" placeholder="Expected Output" required class="form-input font-mono" rows="2"></textarea>
                            <textarea name="originalError" placeholder="Original Error Message" required class="form-input font-mono" rows="2"></textarea>
                            <div class="flex gap-4 pt-2">
                                <button type="submit" id="submit-form-btn" class="btn btn-primary flex-1">Add Question</button>
                                <button type="button" id="cancel-form-btn" class="btn btn-secondary flex-1 hidden">Cancel</button>
                            </div>
                        </form>
                    </div>
                    <div class="bg-gradient-to-br from-gray-800/50 to-gray-900/20 backdrop-blur-md border border-gray-700/50 rounded-xl shadow-2xl p-6">
                        <h2 class="text-2xl font-semibold mb-4 text-cyan-300">Existing Questions (${state.questions.length})</h2>
                        <ul id="questions-list" class="space-y-3">${questionsHtml}</ul>
                    </div>
                </div>
                <div class="bg-gradient-to-br from-gray-800/50 to-gray-900/20 backdrop-blur-md border border-gray-700/50 rounded-xl shadow-2xl lg:col-span-2 p-6 self-start">
                    <h2 class="text-2xl font-semibold mb-4 text-cyan-300">Leaderboard</h2>
                    <ul id="leaderboard-list" class="space-y-3">${leaderboardHtml}</ul>
                </div>
            </div>`;

        // Populate settings form
        const settingsForm = document.getElementById('settings-form');
        settingsForm.elements.timerEnabled.checked = state.settings.timerEnabled;
        settingsForm.elements.timerDurationMinutes.value = state.settings.timerDurationMinutes;
        settingsForm.elements.timerDurationMinutes.disabled = !state.settings.timerEnabled;
        settingsForm.elements.timerEnabled.addEventListener('change', (e) => {
             settingsForm.elements.timerDurationMinutes.disabled = !e.target.checked;
        });

        // Initialize solutions container
        addSolutionField();
        
        // Admin Event Listeners
        document.getElementById('settings-form').addEventListener('submit', handleSettingsFormSubmit);
        document.getElementById('admin-form').addEventListener('submit', handleAdminFormSubmit);
        document.getElementById('cancel-form-btn').addEventListener('click', resetAdminForm);
        document.getElementById('questions-list').addEventListener('click', handleQuestionListClick);
        document.getElementById('add-solution-btn').addEventListener('click', () => addSolutionField());

        document.getElementById('solutions-container').addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-action="remove-solution"]');
            if (removeBtn) {
                const solutionWrapper = removeBtn.parentElement;
                if (document.querySelectorAll('#solutions-container > div').length > 1) {
                    solutionWrapper.remove();
                } else {
                    solutionWrapper.querySelector('textarea').value = '';
                }
            }
        });
        
        // Live Leaderboard Polling
        if (state.adminActiveTab === 'management') {
            state.adminPollingId = setInterval(async () => {
                try {
                    const newResults = await api.getResults();
                    state.results = newResults;
                    const leaderboardListEl = document.getElementById('leaderboard-list');
                    if (leaderboardListEl) {
                        leaderboardListEl.innerHTML = renderLeaderboardList(state.results);
                    }
                } catch (err) {
                    console.error("Failed to poll for results:", err);
                }
            }, 5000);
        }
    }
    
    async function renderAdminAnalyticsContent() {
        const contentEl = document.getElementById('admin-analytics-content');
        if (!contentEl) return;
        contentEl.innerHTML = `<div class="text-center p-8">Loading analytics...</div>`;

        async function updateAnalytics() {
            if (state.adminActiveTab !== 'analytics') return;
            
            state.analyticsData = await api.getAnalytics();
            const { startedTeamsCount, finishedTeamsCount, averageScore, questionStats } = state.analyticsData;

            const currentContentEl = document.getElementById('admin-analytics-content');
            if (!currentContentEl) return;
            
            // Avoid full re-render if elements already exist, just update them
            if (!document.getElementById('difficultyChart')) {
                 currentContentEl.innerHTML = `
                    <div class="space-y-6">
                        <!-- Key Metrics -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div class="bg-gray-800/50 p-6 rounded-xl border border-gray-700 text-center">
                                <h3 class="text-lg text-gray-400">Teams Started</h3>
                                <p id="metric-started" class="text-5xl font-bold text-cyan-400"></p>
                            </div>
                            <div class="bg-gray-800/50 p-6 rounded-xl border border-gray-700 text-center">
                                <h3 class="text-lg text-gray-400">Teams Finished</h3>
                                <p id="metric-finished" class="text-5xl font-bold text-green-400"></p>
                            </div>
                            <div class="bg-gray-800/50 p-6 rounded-xl border border-gray-700 text-center">
                                <h3 class="text-lg text-gray-400">Average Score</h3>
                                <p id="metric-avg-score" class="text-5xl font-bold text-yellow-400"></p>
                            </div>
                        </div>

                        <!-- Charts -->
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div class="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                                <h3 class="text-xl font-semibold mb-4 text-cyan-300">Question Difficulty (Success Rate %)</h3>
                                <canvas id="difficultyChart"></canvas>
                            </div>
                             <div class="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                                <h3 class="text-xl font-semibold mb-4 text-cyan-300">Total Attempts per Question</h3>
                                <canvas id="attemptsChart"></canvas>
                            </div>
                        </div>
                    </div>`;
            }
           
            // Update metrics
            document.getElementById('metric-started').textContent = startedTeamsCount;
            document.getElementById('metric-finished').textContent = finishedTeamsCount;
            document.getElementById('metric-avg-score').textContent = averageScore;

            renderCharts(questionStats);
        }

        await updateAnalytics();

        if (state.adminActiveTab === 'analytics') {
            state.adminPollingId = setInterval(updateAnalytics, 3000);
        }
    }
    
    function renderCharts(questionStats) {
        const labels = questionStats.map((q, i) => `Q${i + 1}: ${q.description.substring(0, 20)}...`);
        
        // --- Difficulty Chart ---
        const difficultyCtx = document.getElementById('difficultyChart');
        if (difficultyCtx) {
            if (state.charts.difficulty) state.charts.difficulty.destroy();
            state.charts.difficulty = new Chart(difficultyCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Success Rate',
                        data: questionStats.map(q => q.successRate * 100),
                        backgroundColor: 'rgba(8, 145, 178, 0.6)', // cyan-600 with opacity
                        borderColor: 'rgba(6, 182, 212, 1)', // cyan-500
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    indexAxis: 'y',
                    scales: {
                        x: { beginAtZero: true, max: 100, ticks: { color: '#9ca3af' }, grid: { color: 'rgba(75, 85, 99, 0.5)' } },
                        y: { ticks: { color: '#d1d5db' }, grid: { display: false } }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.raw.toFixed(1)}%` } }
                    }
                }
            });
        }

        // --- Attempts Chart ---
        const attemptsCtx = document.getElementById('attemptsChart');
        if(attemptsCtx) {
            if (state.charts.attempts) state.charts.attempts.destroy();
            state.charts.attempts = new Chart(attemptsCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Total Attempts',
                        data: questionStats.map(q => q.totalAttempts),
                        backgroundColor: 'rgba(147, 51, 234, 0.6)', // purple-600
                        borderColor: 'rgba(168, 85, 247, 1)', // purple-500
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: { beginAtZero: true, ticks: { color: '#9ca3af', stepSize: 1 }, grid: { color: 'rgba(75, 85, 99, 0.5)' } },
                        x: { ticks: { color: '#d1d5db' }, grid: { display: false } }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
    }

    async function handleSettingsFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const newSettings = {
            timerEnabled: form.elements.timerEnabled.checked,
            timerDurationMinutes: parseInt(form.elements.timerDurationMinutes.value, 10)
        };
        
        const saveBtn = document.getElementById('save-settings-btn');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        await api.updateSettings(newSettings);
        state.settings = newSettings;
        
        saveBtn.textContent = 'Saved!';
        setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }, 1500);
    }

    function addSolutionField(value = '') {
        const container = document.getElementById('solutions-container');
        const solutionCount = container.querySelectorAll('textarea[name="fixedCodeSolutions"]').length;
        const newFieldWrapper = document.createElement('div');
        newFieldWrapper.className = 'flex items-center gap-2';
        newFieldWrapper.innerHTML = `
            <textarea name="fixedCodeSolutions" placeholder="Fixed Code (Solution ${solutionCount + 1})" required class="form-input font-mono flex-grow" rows="5">${value}</textarea>
            <button type="button" data-action="remove-solution" class="btn btn-secondary !p-2 text-red-400">${ICONS.trash}</button>
        `;
        container.appendChild(newFieldWrapper);
    }
    
    async function handleAdminFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const questionData = {
            description: formData.get('description'),
            buggyCode: formData.get('buggyCode'),
            expectedOutput: formData.get('expectedOutput'),
            originalError: formData.get('originalError'),
            fixedCodeSolutions: formData.getAll('fixedCodeSolutions').filter(s => s.trim() !== '')
        };
        
        const submitBtn = document.getElementById('submit-form-btn');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        try {
            if (editingQuestionId) {
                await api.updateQuestion(editingQuestionId, questionData);
            } else {
                await api.postQuestion(questionData);
            }
        } catch (error) {
            console.error('Failed to save question:', error);
            alert('Could not save the question. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            resetAdminForm();
            renderAdminManagementContent();
        }
    }
    
    function resetAdminForm() {
        editingQuestionId = null;
        const form = document.getElementById('admin-form');
        form.reset();
        document.getElementById('solutions-container').innerHTML = '';
        addSolutionField(); // Add the first empty field back
        document.getElementById('form-title').textContent = 'Add New Question';
        document.getElementById('submit-form-btn').textContent = 'Add Question';
        document.getElementById('cancel-form-btn').classList.add('hidden');
    }
    
    function handleQuestionListClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const li = target.closest('.question-item');
        const id = li.dataset.questionId;
        
        e.stopPropagation();

        if (action === 'edit') {
            editingQuestionId = id;
            const question = state.questions.find(q => q._id === id);
            const form = document.getElementById('admin-form');
            form.elements.description.value = question.description;
            form.elements.buggyCode.value = question.buggyCode;
            form.elements.expectedOutput.value = question.expectedOutput;
            form.elements.originalError.value = question.originalError;
            
            const solutionsContainer = document.getElementById('solutions-container');
            solutionsContainer.innerHTML = ''; // Clear existing
            
            const solutions = question.fixedCodeSolutions || [];

            if (solutions.length > 0) {
                 solutions.forEach(sol => addSolutionField(sol));
            } else {
                 addSolutionField(); // Add one empty field if there are no solutions
            }

            document.getElementById('form-title').textContent = 'Edit Question';
            document.getElementById('submit-form-btn').textContent = 'Update Question';
            document.getElementById('cancel-form-btn').classList.remove('hidden');
            form.scrollIntoView({ behavior: 'smooth' });
        } else if (action === 'delete') {
            if (confirm('Are you sure you want to delete this question?')) {
                api.deleteQuestion(id).then(() => renderAdminManagementContent());
            }
        } else if (action === 'toggle-expand') {
             expandedQuestionId = expandedQuestionId === id ? null : id;
             renderAdminManagementContent();
        }
    }

    // --- INITIALIZE APP ---
    if (localStorage.getItem(ADMIN_SESSION_KEY) === 'true') {
        navigateTo('admin');
    } else {
        navigateTo('landing');
    }
});