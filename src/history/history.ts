import { initAppHeader } from "../lib/header.ts";
import { supabase } from "../lib/supabaseClient.ts";
import type {
  DifficultyRow,
  QuizAttemptRow,
  SubjectRow,
} from "../lib/supabaseTypes.ts";
import { hideSpinner, showSpinner } from "../lib/utils.ts";

const historyList = document.getElementById("history-list") as HTMLElement;

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

async function loadHistory(): Promise<void> {
  const { user } = await initAppHeader({ requireAuth: true });
  if (!user) return;

  const { data: attemptsData, error: attemptsError } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (attemptsError) {
    historyList.innerHTML =
      '<p class="history__empty">Could not load your history right now.</p>';
    return;
  }

  const attempts: QuizAttemptRow[] = attemptsData ?? [];
  if (attempts.length === 0) {
    historyList.innerHTML =
      '<p class="history__empty">No attempts yet. Complete a quiz to see your history.</p>';
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

  historyList.innerHTML = attempts
    .map((attempt) => {
      const subjectName = subjects.get(attempt.subject_id)?.name ?? "Unknown Subject";
      const difficultyName =
        difficulties.get(attempt.difficulty_id)?.level_name ?? "Unknown Difficulty";
      const attemptAccuracy = accuracy(attempt);

      return `
      <article class="history-card">
        <header class="history-card__header">
          <h2>${subjectName}</h2>
          <span class="history-card__difficulty">${difficultyName}</span>
        </header>
        <div class="history-card__stats">
          <div><span>Score</span><strong>${attempt.score}</strong></div>
          <div><span>Accuracy</span><strong>${attemptAccuracy}%</strong></div>
          <div><span>Correct</span><strong>${attempt.correct_answers}/${attempt.total_questions}</strong></div>
          <div><span>Time</span><strong>${formatDuration(attempt.time_taken_seconds)}</strong></div>
        </div>
        <footer class="history-card__footer">
          <span>Attempt #${attempt.id}</span>
          <span>${formatDate(attempt.created_at)}</span>
        </footer>
      </article>
    `;
    })
    .join("");
}

async function initHistoryPage(): Promise<void> {
  showSpinner();
  await loadHistory();
  hideSpinner();
}

void initHistoryPage();
