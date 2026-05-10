import type { User } from "@supabase/supabase-js";
import logoUrl from "../assets/img/logo.svg";
import { supabase } from "./supabaseClient.ts";
import type { ProfileSummary } from "./supabaseTypes.ts";

type HeaderInitOptions = {
  mountId?: string;
  requireAuth?: boolean;
  authRedirectPath?: string;
};

type HeaderInitResult = {
  user: User | null;
  profile: ProfileSummary | null;
};

function headerTemplate(): string {
  return `
    <header class="home__header">
      <nav class="home__header__nav">
        <div class="logo">
          <a class="logo__link" href="/">
            <img src="${logoUrl}" alt="DevQuiz logo" />
          </a>
        </div>
        <div class="home__header__nav__container">
          <ul class="right__container">
            <li id="display-username" class="right__container--username">USERNAME</li>
            <li id="display-points" class="right__container--points">TOTAL_POINTS</li>
            <li class="right__container--pfp">
              <img id="display-avatar" alt="User avatar" />
              <div class="right__container--pfp--dropdown">
                <ul id="dropdown__container" class="dropdown__container hidden">
                  <li class="dropdown__container--list" data-nav-target="profile">
                    <a href="/profile/">👤 Profile</a>
                  </li>
                  <li class="dropdown__container--list" data-nav-target="leaderboard">
                    <a href="/leaderboard/">🏆 Leaderboard</a>
                  </li>
                  <li class="dropdown__container--list" data-nav-target="history">
                    <a href="#">📜 History</a>
                  </li>
                  <li class="dropdown__container--list" data-nav-target="logout">
                    ➜] Logout
                  </li>
                </ul>
              </div>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  `;
}

function updateHeaderProfile(profile: ProfileSummary | null): void {
  const username = document.getElementById("display-username");
  const points = document.getElementById("display-points");
  const avatar = document.getElementById("display-avatar") as HTMLImageElement | null;
  const pfpItem = document.querySelector(".right__container--pfp") as HTMLElement | null;

  if (!username || !points || !avatar || !pfpItem) return;

  if (!profile) {
    username.textContent = "";
    points.textContent = "";
    pfpItem.classList.add("hidden");
    return;
  }

  pfpItem.classList.remove("hidden");
  username.textContent = profile.username ?? "User";
  points.innerHTML = `<p style='color: #2e3478'>Total Points: <label class="right__container--point">${profile.total_points}</label></p>`;
  avatar.src = profile.avatar_url ?? logoUrl;
}

function wireDropdownHandlers(): void {
  const pfp = document.querySelector(".right__container--pfp img") as HTMLImageElement | null;
  const dropdownContainer = document.getElementById("dropdown__container");

  if (!pfp || !dropdownContainer) return;

  pfp.addEventListener("click", (event) => {
    event.stopPropagation();
    dropdownContainer.classList.toggle("hidden");
  });

  dropdownContainer.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const listItem = target.closest(".dropdown__container--list");
    if (!listItem) return;

    dropdownContainer.classList.add("hidden");
    const action = listItem.getAttribute("data-nav-target");

    if (action === "logout") {
      void (async () => {
        await supabase.auth.signOut();
        window.location.href = "/";
      })();
      return;
    }

    if (action === "profile") {
      window.location.href = "/profile/";
      return;
    }

    if (action === "leaderboard") {
      window.location.href = "/leaderboard/";
    }
  });

  window.addEventListener("click", (event) => {
    if (!dropdownContainer.contains(event.target as Node) && event.target !== pfp) {
      dropdownContainer.classList.add("hidden");
    }
  });
}

export async function initAppHeader(
  options: HeaderInitOptions = {},
): Promise<HeaderInitResult> {
  const mountId = options.mountId ?? "app-header";
  const requireAuth = options.requireAuth ?? false;
  const authRedirectPath = options.authRedirectPath ?? "/auth/";
  const mount = document.getElementById(mountId);

  if (!mount) {
    throw new Error(`Header mount container '#${mountId}' was not found.`);
  }

  mount.innerHTML = headerTemplate();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    updateHeaderProfile(null);

    if (requireAuth) {
      window.location.href = authRedirectPath;
    }

    return { user: null, profile: null };
  }

  wireDropdownHandlers();

  const { data: profileData } = await supabase
    .from("profiles")
    .select("username, total_points, avatar_url")
    .eq("id", user.id)
    .single();

  const profile: ProfileSummary | null = profileData ?? null;
  updateHeaderProfile(profile);

  return { user, profile };
}

export function setHeaderProfile(profile: ProfileSummary | null): void {
  updateHeaderProfile(profile);
}
