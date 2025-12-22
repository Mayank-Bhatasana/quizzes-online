// src/main.ts
import "./scss/main.scss"; // Imports the styles we just wrote
import { supabase } from "./lib/supabaseClient";

// DOM Elements
const btnLogin = document.getElementById("btn-login-start");
const btnDashboard = document.getElementById("btn-dashboard");
const userStats = document.getElementById("user-stats");
const guestLink = document.getElementById("guest-link");
const userNameDisplay = document.getElementById("display-username");
const userPointsDisplay = document.getElementById("display-points");
const userAvatarDisplay = document.querySelector(
  "#display-avatar img",
) as HTMLImageElement;

async function initApp() {
  console.log("Initializing App...");

  // 1. Check Supabase Session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    // === LOGGED IN STATE ===
    console.log("User is logged in:", session.user.email);

    // Toggle Buttons
    if (btnLogin) btnLogin.classList.add("hidden");
    if (btnDashboard) btnDashboard.classList.remove("hidden");

    // Toggle Header UI
    if (guestLink) guestLink.classList.add("hidden");
    if (userStats) userStats.classList.remove("hidden");

    // Fetch Profile Data (Points & Username)
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, total_points, avatar_url")
      .eq("id", session.user.id)
      .single();

    if (profile) {
      if (userNameDisplay)
        userNameDisplay.textContent = profile.username || "Coder";
      if (userPointsDisplay)
        userPointsDisplay.textContent = `${profile.total_points} XP`;

      // If they have a custom avatar, use it. Otherwise, generate a robot based on username.
      if (profile.avatar_url) {
        userAvatarDisplay.src = profile.avatar_url;
      } else {
        userAvatarDisplay.src = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${profile.username}`;
      }
    }
  } else {
    // === GUEST STATE ===
    console.log("User is guest");
    // Default HTML is already in Guest State, so we do nothing.
  }
}

// Run immediately
initApp();
