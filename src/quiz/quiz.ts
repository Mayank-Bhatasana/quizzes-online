import { supabase } from "../lib/supabaseClient.ts";

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
let locked = false;
let answers: Array<number | null> = [];

// Quiz Configuration (store these for later submission)
const urlParams = new URLSearchParams(window.location.search);

const quizSubjectId = urlParams.get("id");
const quizDifficultyId = urlParams.get("diffId");
let quizStartTime: number;

const QuestionTime = async function () {
  const { data } = await supabase
    .from("difficulties")
    .select("time_limit_seconds")
    .eq("id", 2);
  return data[0].time_limit_seconds;
};

let QUESTION_TIME = await QuestionTime();
const WARNING_TIME = 5;

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
  quizStartTime = Date.now();

  const { data, error } = await supabase.rpc("get_quiz_data", {
    quiz_subject_id: quizSubjectId,
    quiz_difficulty_id: quizDifficultyId,
  });

  if (error || !data) {
    container.innerHTML = `<div class="error">Failed to load quiz. Please try again.</div>`;
    console.error(error);
    return;
  }

  questions = transformQuizData(data as RawApiResponse[]);
  answers = Array(questions.length).fill(null);

  renderQuestion();
}

// Timer Functions
function startTimer() {
  stopTimer();
  timeLeft = QUESTION_TIME;
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
  timerValue.textContent = String(timeLeft);
  timerPill.classList.toggle("warning", timeLeft <= WARNING_TIME);
}

function updateProgress() {
  const pct = (current / questions.length) * 100;
  progressBar.style.width = `${pct}%`;
  if (headerPill) {
    headerPill.textContent = `Question: ${current + 1} / ${questions.length}`;
  }
}

// Render Question
function renderQuestion() {
  if (questions.length === 0) return;

  locked = false;
  const q = questions[current];
  updateProgress();

  container.innerHTML = `
    <h1>${q.text}</h1>
    <div class="options">
      ${q.options
        .map(
          (opt) => `
          <button class="option" data-option-id="${opt.id}">
            <span>${opt.text}</span>
          </button>
        `,
        )
        .join("")}
    </div>
    <div class="footer">
      <div></div>
      <button class="btn-primary" id="nextBtn" disabled>Next</button>
    </div>
  `;

  document.querySelectorAll<HTMLButtonElement>(".option").forEach((btn) => {
    btn.addEventListener("click", () => handleSelect(btn));
  });
  document.getElementById("nextBtn")?.addEventListener("click", nextQuestion);

  startTimer();
}

function handleSelect(btn: HTMLButtonElement) {
  if (locked) return;
  locked = true;
  stopTimer();

  const selectedId = Number(btn.dataset.optionId);
  answers[current] = selectedId;

  const all = document.querySelectorAll<HTMLButtonElement>(".option");
  btn.classList.add("selected");
  all.forEach((b) => (b.disabled = true));

  const nextBtn = document.getElementById("nextBtn") as HTMLButtonElement;
  if (nextBtn) nextBtn.disabled = false;
}

function handleTimeout() {
  stopTimer();
  if (locked) return;
  locked = true;
  answers[current] = null; // Unanswered

  document
    .querySelectorAll<HTMLButtonElement>(".option")
    .forEach((b) => (b.disabled = true));
  const nextBtn = document.getElementById("nextBtn") as HTMLButtonElement;
  if (nextBtn) nextBtn.disabled = false;
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
  stopTimer();
  updateProgress();
  progressBar.style.width = "100%";

  container.innerHTML = `<div class="result"><div class="pill">Submitting...</div></div>`;

  try {
    const result = await sendAnswersToServer(answers);

    container.innerHTML = `
      <div class="result">
        <div class="pill">Quiz Complete! 🎉</div>
        <div class="score">${result.correct_count} / ${result.total_questions}</div>
        <div class="pill">Points Earned: ${result.score}</div>
        <button class="btn-secondary" id="homeBtn">Home Page</button>
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
