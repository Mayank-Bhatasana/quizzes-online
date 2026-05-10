import { supabase } from "../lib/supabaseClient.ts";
import type {
  CheckQuizAnswersResultRow,
  GetQuizDataRow,
} from "../lib/supabaseTypes.ts";
import { showSpinner, hideSpinner } from "../lib/utils.ts";

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
const quizSubjectIdParam = urlParams.get("id");
const quizDifficultyIdParam = urlParams.get("diffId");
const quizSubjectId = quizSubjectIdParam ? Number(quizSubjectIdParam) : NaN;
const quizDifficultyId = quizDifficultyIdParam
  ? Number(quizDifficultyIdParam)
  : NaN;
let quizStartTime: number;

if (Number.isNaN(quizSubjectId) || Number.isNaN(quizDifficultyId)) {
  window.location.href = "/dashboard/";
}

const QUIZ_TOTAL_TIME_SECONDS = 600; // 10 minutes
const WARNING_TIME = 30; // Warning for the last 30 seconds of the quiz

// DOM Elements
const container = document.getElementById("quizContainer") as HTMLDivElement;
const timerValue = document.getElementById("timerValue") as HTMLSpanElement;
const timerPill = document.getElementById("timerPill") as HTMLDivElement;
const progressBar = document.getElementById("progressBar") as HTMLDivElement;
const headerPill = document.querySelector(".header .pill") as HTMLDivElement;

// Data Transformation
function transformQuizData(rawData: GetQuizDataRow[]): Question[] {
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

  questions = transformQuizData(data);
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

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function getPerformanceMessage(accuracy: number): string {
  if (accuracy === 100) return "Perfect score! You nailed every question.";
  if (accuracy >= 80) return "Excellent work. Your fundamentals look strong.";
  if (accuracy >= 60) return "Nice effort. You're getting there, keep pushing.";
  return "Good attempt. Review and come back even stronger.";
}

function getResultTier(
  accuracy: number,
): { key: "great" | "good" | "okay" | "low"; label: string } {
  if (accuracy >= 90) return { key: "great", label: "Outstanding" };
  if (accuracy >= 75) return { key: "good", label: "Strong Performance" };
  if (accuracy >= 50) return { key: "okay", label: "Good Attempt" };
  return { key: "low", label: "Keep Practicing" };
}

function isQuizResult(value: unknown): value is CheckQuizAnswersResultRow {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.correct_count === "number" &&
    typeof candidate.total_questions === "number" &&
    typeof candidate.score === "number" &&
    typeof candidate.attempt_id === "number"
  );
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

  container.innerHTML = `
    <div class="result result--loading">
      <div class="pill">Submitting your answers...</div>
    </div>
  `;
  showSpinner(); // Show spinner during submission

  try {
    timerValue.textContent = "00:00";
    timerPill.classList.add("warning");

    const result = await sendAnswersToServer(answers);
    const answeredCount = answers.filter((id) => id !== null).length;
    const completionSeconds = Math.max(
      0,
      Math.floor((Date.now() - quizStartTime) / 1000),
    );
    const accuracy =
      result.total_questions > 0
        ? Math.round((result.correct_count / result.total_questions) * 100)
        : 0;
    const performanceMessage = getPerformanceMessage(accuracy);
    const resultTier = getResultTier(accuracy);

    container.innerHTML = `
      <section class="result-card result-card--${resultTier.key}" style="--result-progress: ${accuracy}%;" aria-live="polite">
        <div class="result-card__hero">
          <div class="pill result-pill">${resultTier.label}</div>
          <h2>Great job finishing the challenge</h2>
          <p class="result-card__message">${performanceMessage}</p>
        </div>

        <div class="result-highlight">
          <div class="result-highlight__score">
            <span class="result-highlight__label">Final Score</span>
            <strong>${result.score}</strong>
          </div>
          <div class="result-highlight__accuracy">
            <span class="result-highlight__label">Accuracy</span>
            <strong>${accuracy}%</strong>
          </div>
        </div>

        <div class="score-orb" aria-hidden="true">
          <div class="score-orb__inner">
            <div class="score-orb__value">${result.correct_count}<span>/${result.total_questions}</span></div>
            <div class="score-orb__label">Correct Answers</div>
          </div>
        </div>

        <div class="result-stats">
          <div class="result-stat">
            <span>Points Earned</span>
            <strong>${result.score}</strong>
          </div>
          <div class="result-stat">
            <span>Accuracy</span>
            <strong>${accuracy}%</strong>
          </div>
          <div class="result-stat">
            <span>Answered</span>
            <strong>${answeredCount} / ${result.total_questions}</strong>
          </div>
          <div class="result-stat">
            <span>Time Taken</span>
            <strong>${formatDuration(completionSeconds)}</strong>
          </div>
        </div>

        <div class="result-actions">
          <button class="btn-secondary" id="reviewAttemptBtn">Review Answers</button>
          <button class="btn-secondary" id="retryBtn">Try Again</button>
          <button class="btn-secondary" id="leaderboardBtn">Leaderboard</button>
          <button class="btn-primary" id="homeBtn">Home Page</button>
        </div>
      </section>
    `;

    document
      .getElementById("reviewAttemptBtn")
      ?.addEventListener("click", () => {
        window.location.href = `/history-attempt/?id=${result.attempt_id}`;
      });

    document.getElementById("retryBtn")?.addEventListener("click", () => {
      window.location.reload();
    });

    document.getElementById("leaderboardBtn")?.addEventListener("click", () => {
      window.location.href = "/leaderboard/";
    });

    document.getElementById("homeBtn")?.addEventListener("click", () => {
      window.location.href = window.location.origin;
    });
  } catch (err) {
    console.error("Submission error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    container.innerHTML = `
      <section class="result-card result-card--error">
        <div class="result-card__hero">
          <div class="pill result-pill result-pill--error">Submission failed</div>
          <h2>We couldn't submit your quiz</h2>
          <p class="result-card__message">${errorMessage}</p>
        </div>
        <div class="result-actions">
          <button class="btn-secondary" id="retrySubmitBtn">Retry Submit</button>
          <button class="btn-primary" id="homeBtn">Home Page</button>
        </div>
      </section>
    `;

    document.getElementById("retrySubmitBtn")?.addEventListener("click", () => {
      void showResults();
    });

    document.getElementById("homeBtn")?.addEventListener("click", () => {
      window.location.href = window.location.origin;
    });
  } finally {
    hideSpinner(); // Hide spinner after submission (success or error)
  }
}

async function sendAnswersToServer(
  ans: Array<number | null>,
): Promise<CheckQuizAnswersResultRow> {
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

  if (!Array.isArray(data) || data.length === 0 || !isQuizResult(data[0])) {
    throw new Error("Quiz result payload is invalid.");
  }

  return data[0];
}

// Start the app
initQuiz();
