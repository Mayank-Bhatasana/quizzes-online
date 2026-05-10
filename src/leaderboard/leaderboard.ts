import { initAppHeader } from "../lib/header.ts";
import { supabase } from "../lib/supabaseClient.ts";
import type { LeaderboardRow } from "../lib/supabaseTypes.ts";
import { hideSpinner, showSpinner } from "../lib/utils.ts";

type LeaderboardEntry = {
  rank: number;
  username: string;
  total_points: number;
  avatar_url: string | null;
};

const podiumContainer = document.getElementById("leaderboard-podium") as HTMLElement;
const listContainer = document.getElementById("leaderboard-list") as HTMLElement;

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toLeaderboardEntry(row: LeaderboardRow, fallbackRank: number): LeaderboardEntry {
  return {
    rank: row.rank ?? fallbackRank,
    username: row.username ?? "Anonymous",
    total_points: row.total_points ?? 0,
    avatar_url: row.avatar_url,
  };
}

function getInitials(username: string): string {
  const words = username.trim().split(/\s+/).slice(0, 2);
  if (words.length === 0) return "U";
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
}

function avatarMarkup(user: LeaderboardEntry): string {
  if (user.avatar_url) {
    return `<img src="${user.avatar_url}" alt="${escapeHtml(user.username)} avatar" />`;
  }

  return `<span class="leaderboard__avatar-fallback">${escapeHtml(getInitials(user.username))}</span>`;
}

function renderPodium(entries: LeaderboardEntry[]): void {
  if (entries.length === 0) {
    podiumContainer.innerHTML =
      '<div class="leaderboard__empty">No leaderboard data available.</div>';
    return;
  }

  const first = entries[0];
  const second = entries[1];
  const third = entries[2];

  const cards: string[] = [];

  if (second) {
    cards.push(`
      <article class="podium-card podium-card--second">
        <span class="podium-card__rank">#2</span>
        <div class="podium-card__avatar">${avatarMarkup(second)}</div>
        <h3>${escapeHtml(second.username)}</h3>
        <p>${second.total_points} pts</p>
      </article>
    `);
  }

  if (first) {
    cards.push(`
      <article class="podium-card podium-card--first">
        <span class="podium-card__rank">#1</span>
        <div class="podium-card__avatar">${avatarMarkup(first)}</div>
        <h3>${escapeHtml(first.username)}</h3>
        <p>${first.total_points} pts</p>
      </article>
    `);
  }

  if (third) {
    cards.push(`
      <article class="podium-card podium-card--third">
        <span class="podium-card__rank">#3</span>
        <div class="podium-card__avatar">${avatarMarkup(third)}</div>
        <h3>${escapeHtml(third.username)}</h3>
        <p>${third.total_points} pts</p>
      </article>
    `);
  }

  podiumContainer.innerHTML = cards.join("");
}

function renderRemaining(entries: LeaderboardEntry[]): void {
  const rest = entries.slice(3);
  if (rest.length === 0) {
    listContainer.innerHTML = "";
    return;
  }

  listContainer.innerHTML = `
    ${rest
      .map(
        (user) => `
      <article class="leaderboard-row">
        <div class="leaderboard-row__rank">#${user.rank}</div>
        <div class="leaderboard-row__avatar">${avatarMarkup(user)}</div>
        <div class="leaderboard-row__name">${escapeHtml(user.username)}</div>
        <div class="leaderboard-row__points">${user.total_points} pts</div>
      </article>
    `,
      )
      .join("")}
  `;
}

async function loadLeaderboard(): Promise<void> {
  const { data, error } = await supabase.from("leaderboard").select("*");

  if (error || !data) {
    podiumContainer.innerHTML =
      '<div class="leaderboard__empty">Could not load leaderboard right now.</div>';
    return;
  }

  const typedRows: LeaderboardRow[] = data;
  const sorted = typedRows
    .map((row, index) => toLeaderboardEntry(row, index + 1))
    .sort((a, b) => b.total_points - a.total_points)
    .slice(0, 10)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  renderPodium(sorted);
  renderRemaining(sorted);
}

async function initLeaderboardPage(): Promise<void> {
  showSpinner();
  const { user } = await initAppHeader({ requireAuth: true });
  if (!user) {
    hideSpinner();
    return;
  }

  await loadLeaderboard();
  hideSpinner();
}

void initLeaderboardPage();
