import { supabase } from "../lib/supabaseClient.ts";
import { showSpinner, hideSpinner } from "../lib/utils.ts";

// Type Definitions
type RawApiResponse = {
  question_id: number;
  question_text: string;
  option_id: number;
  option_text: string;
};

type Question = {
  id: number;
  text: string;
  options: { id: number; text: string }[];
};

// State Management
let questions: Question[] = [];
let current = 0;
let timeLeft: number;
let timerId: number | null = null;
let answers: Array<number | null> = [];

// Quiz Configuration (store these for later submission)
const urlParams = new URLSearchParams(window.location.search);

const quizSubjectId = urlParams.get("id");
const quizDifficultyId = urlParams.get("diffId");
let quizStartTime: number;

const QUIZ_TOTAL_TIME_SECONDS = 600; // 10 minutes
const WARNING_TIME = 30; // Warning for the last 30 seconds of the quiz

// DOM Elements
const container = document.getElementById("quizContainer") as HTMLDivElement;
const timerValue = document.getElementById("timerValue") as HTMLSpanElement;
const timerPill = document.getElementById("timerPill") as HTMLDivElement;
const progressBar = document.getElementById("progressBar") as HTMLDivElement;
const headerPill = document.querySelector(".header .pill") as HTMLDivElement;

// Data Transformation
function transformQuizData(rawData: RawApiResponse[]): Question[] {
  const map = new Map<number, Question>();

  rawData.forEach((item) => {
    if (!map.has(item.question_id)) {
      map.set(item.question_id, {
        id: item.question_id,
        text: item.question_text,
        options: [],
      });
    }

    map.get(item.question_id)?.options.push({
      id: item.option_id,
      text: item.option_text,
    });
  });

  return Array.from(map.values());
}

// Initialize Quiz
async function initQuiz() {
  showSpinner();
  quizStartTime = Date.now();

  const { data, error } = await supabase.rpc("get_quiz_data", {
    quiz_subject_id: quizSubjectId,
    quiz_difficulty_id: quizDifficultyId,
  });

  if (error || !data) {
    container.innerHTML = `<div class="error">Failed to load quiz. Please try again.</div>`;
    console.error(error);
    hideSpinner();
    return;
  }

  questions = transformQuizData(data as RawApiResponse[]);
  answers = Array(questions.length).fill(null);

  renderQuestion();
  startTimer(); // Start the overall quiz timer here
  hideSpinner();
}

// Timer Functions
function startTimer() {
  stopTimer();
  timeLeft = QUIZ_TOTAL_TIME_SECONDS; // Use total quiz time
  updateTimerUI();
  timerId = window.setInterval(() => {
    timeLeft--;
    updateTimerUI();
    if (timeLeft <= 0) handleTimeout();
  }, 1000);
}

function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function updateTimerUI() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  timerValue.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  timerPill.classList.toggle("warning", timeLeft <= WARNING_TIME);
}

function updateProgress() {
  const pct = (current / questions.length) * 100;
  progressBar.style.width = `${pct}%`;
  if (headerPill && questions.length > current) {
    headerPill.textContent = `Question: ${current + 1} / ${questions.length}`;
  }
}

// Render Question
function renderQuestion() {
  if (questions.length === 0) return;

  const q = questions[current];
  updateProgress();

  const isQuestionAnswered = answers[current] !== null;
  const isLastQuestion = current === questions.length - 1;

  container.innerHTML = `
    <h1>${q.text}</h1>
    <div class="options">
      ${q.options
        .map(
          (opt) => `
          <button class="option" data-option-id="${opt.id}" ${isQuestionAnswered ? "disabled" : ""}>
            <span>${opt.text}</span>
          </button>
        `,
        )
        .join("")}
    </div>
    <div class="quiz-navigation">
      <button class="btn-secondary" id="prevBtn" ${current === 0 ? "disabled" : ""}>Previous</button>
      <button class="btn-primary" id="nextBtn" ${!isQuestionAnswered ? "disabled" : ""}>${isLastQuestion ? "Submit Quiz" : "Next Question"}</button>
    </div>
  `;
  document.querySelectorAll<HTMLButtonElement>(".option").forEach((btn) => {
    btn.addEventListener("click", () => handleSelect(btn));
    if (answers[current] === Number(btn.dataset.optionId)) {
      btn.classList.add("selected");
    }
  });

  const nextBtn = document.getElementById("nextBtn") as HTMLButtonElement;
  if (nextBtn) {
    nextBtn.addEventListener("click", nextQuestion);
  }

  const prevBtn = document.getElementById("prevBtn") as HTMLButtonElement;
  if (prevBtn) {
    prevBtn.addEventListener("click", previousQuestion);
  }
}

function previousQuestion() {
  if (current > 0) {
    current--;
    renderQuestion();
  }
}

function handleSelect(btn: HTMLButtonElement) {
  const selectedId = Number(btn.dataset.optionId);

  answers[current] = selectedId;

  document.querySelectorAll<HTMLButtonElement>(".option").forEach((b) => {
    b.classList.remove("selected");
  });

  btn.classList.add("selected");

  nextQuestion();
}

async function handleTimeout() {
  stopTimer();
  await showResults(); // End quiz when time runs out
}

async function nextQuestion() {
  current++;
  if (current >= questions.length) {
    await showResults();
  } else {
    renderQuestion();
  }
}

async function showResults() {
  stopTimer(); // Ensure timer stops when results are shown
  updateProgress();
  progressBar.style.width = "100%";

  container.innerHTML = `<div class="result"><div class="pill">Submitting...</div></div>`;
  showSpinner(); // Show spinner during submission

  try {
    timerValue.textContent = String(0);
    timerPill.classList.add("warning");

    const result = await sendAnswersToServer(answers);
    const percentage = Math.round((result.correct_count / result.total_questions) * 100);
    const timeTaken = Math.floor((Date.now() - quizStartTime) / 1000);
    const minutes = Math.floor(timeTaken / 60);
    const seconds = timeTaken % 60;

    // Determine performance level
    let performanceClass = "poor";
    let performanceEmoji = "😢";
    let performanceText = "Keep Practicing!";
    if (percentage >= 90) {
      performanceClass = "excellent";
      performanceEmoji = "🏆";
      performanceText = "Outstanding!";
    } else if (percentage >= 70) {
      performanceClass = "good";
      performanceEmoji = "🎉";
      performanceText = "Great Job!";
    } else if (percentage >= 50) {
      performanceClass = "average";
      performanceEmoji = "👍";
      performanceText = "Good Effort!";
    }

    container.innerHTML = `
      <div class="result ${performanceClass}">
        <div class="result__confetti"></div>
        <div class="result__emoji">${performanceEmoji}</div>
        <h2 class="result__title">${performanceText}</h2>
        <div class="result__score-ring">
          <svg viewBox="0 0 120 120">
            <circle class="result__score-bg" cx="60" cy="60" r="54"/>
            <circle class="result__score-progress" cx="60" cy="60" r="54" 
              style="--percentage: ${percentage}"/>
          </svg>
          <div class="result__score-value">
            <span class="result__percentage">${percentage}%</span>
            <span class="result__fraction">${result.correct_count}/${result.total_questions}</span>
          </div>
        </div>
        <div class="result__stats">
          <div class="result__stat">
            <span class="result__stat-icon">⏱️</span>
            <span class="result__stat-value">${minutes}:${seconds.toString().padStart(2, "0")}</span>
            <span class="result__stat-label">Time Taken</span>
          </div>
          <div class="result__stat">
            <span class="result__stat-icon">⭐</span>
            <span class="result__stat-value">${result.score}</span>
            <span class="result__stat-label">Points Earned</span>
          </div>
          <div class="result__stat">
            <span class="result__stat-icon">✅</span>
            <span class="result__stat-value">${result.correct_count}</span>
            <span class="result__stat-label">Correct</span>
          </div>
        </div>
        <button class="btn-primary result__btn" id="homeBtn">
          <span>Back to Home</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    `;

    document.getElementById("homeBtn")?.addEventListener("click", () => {
      window.location.href = window.location.origin;
    });
  } catch (err) {
    console.error("Submission error:", err);
    container.innerHTML = `
      <div class="result">
        <div class="pill error">Error submitting quiz</div>
        <p>${err instanceof Error ? err.message : "Unknown error"}</p>
      </div>
    `;
  } finally {
    hideSpinner(); // Hide spinner after submission (success or error)
  }
}

async function sendAnswersToServer(ans: Array<number | null>) {
  // Filter out null/undefined answers
  const validAnswers = ans.filter((id): id is number => id !== null);

  // Calculate time taken in seconds
  const timeTaken = Math.floor((Date.now() - quizStartTime) / 1000);

  const { data, error } = await supabase.rpc("check_quiz_answers", {
    user_selected_ids: validAnswers,
    quiz_subject_id: quizSubjectId,
    quiz_difficulty_id: quizDifficultyId,
    time_taken_seconds: timeTaken,
  });

  if (error) {
    console.error("Error checking answers:", error);
    throw error;
  }

  // data returns: [{ correct_count, total_questions, score, attempt_id }]
  return data[0];
}

// Start the app
initQuiz();
