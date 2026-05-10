import { initAppHeader } from "../lib/header.ts";
import { supabase } from "../lib/supabaseClient.ts";
import { hideSpinner, showSpinner } from "../lib/utils.ts";

type AttemptOption = {
  option_id: number;
  option_text: string;
  is_correct: boolean;
};

type AttemptReviewRow = {
  user_answer_id: number;
  question_id: number;
  question_text: string;
  selected_option_id: number | null;
  selected_option_text: string | null;
  correct_option_id: number;
  correct_option_text: string;
  is_correct: boolean;
  options: AttemptOption[] | string;
};

function isAttemptReviewRow(value: unknown): value is AttemptReviewRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.user_answer_id === "number" &&
    typeof row.question_id === "number" &&
    typeof row.question_text === "string" &&
    typeof row.correct_option_id === "number" &&
    typeof row.correct_option_text === "string" &&
    typeof row.is_correct === "boolean"
  );
}

const attemptFilter = document.getElementById("attempt-filter") as HTMLSelectElement;
const attemptSummary = document.getElementById("attempt-summary") as HTMLElement;
const attemptList = document.getElementById("attempt-list") as HTMLElement;

let allRows: AttemptReviewRow[] = [];

function parseOptions(options: AttemptReviewRow["options"]): AttemptOption[] {
  if (Array.isArray(options)) return options;
  try {
    const parsed = JSON.parse(options) as AttemptOption[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderSummary(rows: AttemptReviewRow[]): void {
  const total = rows.length;
  const correct = rows.filter((row) => row.is_correct).length;
  const wrong = total - correct;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);

  attemptSummary.innerHTML = `
    <div class="attempt__summary-card"><span>Total</span><strong>${total}</strong></div>
    <div class="attempt__summary-card"><span>Correct</span><strong>${correct}</strong></div>
    <div class="attempt__summary-card"><span>Wrong</span><strong>${wrong}</strong></div>
    <div class="attempt__summary-card"><span>Accuracy</span><strong>${score}%</strong></div>
  `;
}

function renderList(): void {
  const filter = attemptFilter.value;
  const rows = filter === "wrong" ? allRows.filter((row) => !row.is_correct) : allRows;

  if (rows.length === 0) {
    attemptList.innerHTML = '<p class="attempt__empty">No questions to show.</p>';
    return;
  }

  attemptList.innerHTML = rows
    .map((row, index) => {
      const options = parseOptions(row.options);
      const rowStatus = row.is_correct ? "correct" : "wrong";

      return `
      <article class="attempt-card attempt-card--${rowStatus}">
        <header class="attempt-card__header">
          <h2>Q${index + 1}. ${row.question_text}</h2>
          <span class="attempt-card__status">${row.is_correct ? "Correct" : "Wrong"}</span>
        </header>
        <div class="attempt-card__options">
          ${options
            .map((option) => {
              const isUserSelected = row.selected_option_id === option.option_id;
              const classNames = [
                "attempt-card__option",
                option.is_correct ? "is-correct" : "",
                isUserSelected ? "is-selected" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return `<div class="${classNames}">
                <span>${option.option_text}</span>
                <small>${option.is_correct ? "Correct answer" : isUserSelected ? "Your choice" : ""}</small>
              </div>`;
            })
            .join("")}
        </div>
      </article>
    `;
    })
    .join("");
}

async function loadAttemptReview(): Promise<void> {
  const urlParams = new URLSearchParams(window.location.search);
  const attemptIdParam = urlParams.get("id");
  const attemptId = attemptIdParam ? Number(attemptIdParam) : NaN;
  if (Number.isNaN(attemptId)) {
    attemptList.innerHTML = '<p class="attempt__empty">Invalid attempt ID.</p>';
    return;
  }

  const { user } = await initAppHeader({ requireAuth: true });
  if (!user) return;

  const rpcClient = supabase as unknown as {
    rpc: (
      fn: string,
      args: { p_attempt_id: number },
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await rpcClient.rpc("get_attempt_review", {
    p_attempt_id: attemptId,
  });
  
  if (error || !data) {
    attemptList.innerHTML =
      '<p class="attempt__empty">You don\'t have access ot this attempt. </p>';
    return;
  }

  if (!Array.isArray(data) || !data.every(isAttemptReviewRow)) {
    attemptList.innerHTML =
      '<p class="attempt__empty">Unexpected review payload shape from RPC.</p>';
    return;
  }

  allRows = data;
  renderSummary(allRows);
  renderList();
}

async function initAttemptPage(): Promise<void> {
  showSpinner();
  await loadAttemptReview();
  hideSpinner();
}

attemptFilter.addEventListener("change", renderList);

void initAttemptPage();
