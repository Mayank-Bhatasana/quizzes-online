import { initAppHeader } from "../lib/header.ts";
import { supabase } from "../lib/supabaseClient.ts";
import type {
  DifficultyRow,
  QuizAttemptRow,
  SubjectRow,
} from "../lib/supabaseTypes.ts";
import { hideSpinner, showSpinner } from "../lib/utils.ts";

const ITEMS_PER_PAGE = 5;
const historyList = document.getElementById("history-list") as HTMLElement;
const pagination = document.getElementById("history-pagination") as HTMLElement;
const sortFieldSelect = document.getElementById(
  "history-sort-field",
) as HTMLSelectElement;
const sortOrderSelect = document.getElementById(
  "history-sort-order",
) as HTMLSelectElement;

type SortField =
  | "created_at"
  | "score"
  | "accuracy"
  | "difficulty"
  | "subject"
  | "time_taken_seconds";
type SortOrder = "asc" | "desc";

type HistoryAttempt = {
  attempt: QuizAttemptRow;
  subjectName: string;
  difficultyName: string;
  accuracy: number;
};

let allAttempts: HistoryAttempt[] = [];
let currentPage = 1;

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function accuracy(attempt: QuizAttemptRow): number {
  if (attempt.total_questions === 0) return 0;
  return Math.round((attempt.correct_answers / attempt.total_questions) * 100);
}

function getAccuracyTone(value: number): "good" | "none" | "low" {
  if (value >= 80) return "good";
  if (value >= 30) return "none";
  return "low";
}

function compareAttempts(a: HistoryAttempt, b: HistoryAttempt): number {
  const field = sortFieldSelect.value as SortField;
  const order = sortOrderSelect.value as SortOrder;
  const factor = order === "asc" ? 1 : -1;

  switch (field) {
    case "score":
      return (a.attempt.score - b.attempt.score) * factor;
    case "accuracy":
      return (a.accuracy - b.accuracy) * factor;
    case "difficulty":
      return a.difficultyName.localeCompare(b.difficultyName) * factor;
    case "subject":
      return a.subjectName.localeCompare(b.subjectName) * factor;
    case "time_taken_seconds":
      return (
        (a.attempt.time_taken_seconds ?? Number.MAX_SAFE_INTEGER) -
        (b.attempt.time_taken_seconds ?? Number.MAX_SAFE_INTEGER)
      ) * factor;
    case "created_at":
    default:
      return (
        (new Date(a.attempt.created_at).getTime() -
          new Date(b.attempt.created_at).getTime()) *
        factor
      );
  }
}

function renderPagination(totalPages: number): void {
  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  const pages: Array<number | "ellipsis"> = [];
  if (totalPages <= 7) {
    for (let page = 1; page <= totalPages; page++) pages.push(page);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("ellipsis");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let page = start; page <= end; page++) pages.push(page);
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
  }

  pagination.innerHTML = pages
    .map((page) => {
      if (page === "ellipsis") {
        return '<span class="history__pagination-ellipsis">...</span>';
      }
      return `<button type="button" class="history__page-btn ${page === currentPage ? "is-active" : ""}" data-page="${page}">${page}</button>`;
    })
    .join("");
}

function renderHistory(): void {
  if (allAttempts.length === 0) {
    historyList.innerHTML =
      '<p class="history__empty">No attempts yet. Complete a quiz to see your history.</p>';
    pagination.innerHTML = "";
    return;
  }

  const sortedAttempts = [...allAttempts].sort(compareAttempts);
  const totalPages = Math.ceil(sortedAttempts.length / ITEMS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageAttempts = sortedAttempts.slice(start, start + ITEMS_PER_PAGE);

  historyList.innerHTML = pageAttempts
    .map((item, index) => {
      const { attempt, subjectName, difficultyName } = item;
      const attemptAccuracy = item.accuracy;
      const tone = getAccuracyTone(attemptAccuracy);
      const serialNumber = start + index + 1;

      return `
      <article class="history-card history-card--clickable history-card--${tone}" data-attempt-id="${attempt.id}">
        <header class="history-card__header">
          <h2>${subjectName}</h2>
          <span class="history-card__difficulty">${difficultyName}</span>
        </header>
        <div class="history-card__stats">
          <div><span>Score</span><strong>${attempt.score}</strong></div>
          <div><span>Accuracy</span><strong class="history-card__accuracy history-card__accuracy--${tone}">${attemptAccuracy}%</strong></div>
          <div><span>Correct</span><strong>${attempt.correct_answers}/${attempt.total_questions}</strong></div>
          <div><span>Time</span><strong>${formatDuration(attempt.time_taken_seconds)}</strong></div>
        </div>
        <footer class="history-card__footer">
          <span>Quiz ${serialNumber}</span>
          <span>${formatDate(attempt.created_at)}</span>
        </footer>
      </article>
    `;
    })
    .join("");

  renderPagination(totalPages);
}

async function loadHistory(): Promise<void> {
  const { user } = await initAppHeader({ requireAuth: true });
  if (!user) return;

  const { data: attemptsData, error: attemptsError } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("user_id", user.id);

  if (attemptsError) {
    historyList.innerHTML =
      '<p class="history__empty">Could not load your history right now.</p>';
    return;
  }

  const attempts: QuizAttemptRow[] = attemptsData ?? [];
  if (attempts.length === 0) {
    renderHistory();
    return;
  }

  const subjectIds = [...new Set(attempts.map((attempt) => attempt.subject_id))];
  const difficultyIds = [...new Set(attempts.map((attempt) => attempt.difficulty_id))];

  const [{ data: subjectsData }, { data: difficultiesData }] = await Promise.all([
    supabase.from("subjects").select("*").in("id", subjectIds),
    supabase.from("difficulties").select("*").in("id", difficultyIds),
  ]);

  const subjects = new Map<number, SubjectRow>(
    (subjectsData ?? []).map((subject) => [subject.id, subject]),
  );
  const difficulties = new Map<number, DifficultyRow>(
    (difficultiesData ?? []).map((difficulty) => [difficulty.id, difficulty]),
  );

  allAttempts = attempts.map((attempt) => ({
    attempt,
    subjectName: subjects.get(attempt.subject_id)?.name ?? "Unknown Subject",
    difficultyName:
      difficulties.get(attempt.difficulty_id)?.level_name ?? "Unknown Difficulty",
    accuracy: accuracy(attempt),
  }));

  renderHistory();
}

async function initHistoryPage(): Promise<void> {
  showSpinner();
  await loadHistory();
  hideSpinner();
}

sortFieldSelect.addEventListener("change", () => {
  currentPage = 1;
  renderHistory();
});

sortOrderSelect.addEventListener("change", () => {
  currentPage = 1;
  renderHistory();
});

pagination.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest(".history__page-btn") as HTMLButtonElement | null;
  if (!button) return;

  const page = Number(button.dataset.page);
  if (Number.isNaN(page)) return;
  currentPage = page;
  renderHistory();
});

historyList.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const card = target.closest(".history-card") as HTMLElement | null;
  if (!card) return;

  const attemptId = card.dataset.attemptId;
  if (!attemptId) return;
  window.location.href = `/history-attempt/?id=${attemptId}`;
});

void initHistoryPage();
