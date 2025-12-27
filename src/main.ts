import { supabase } from "./lib/supabaseClient.ts";

//Select the input
const userNameDisplay = document.getElementById(
  "display-username",
) as HTMLElement;
const userPointsDisplay = document.getElementById(
  "display-points",
) as HTMLElement;
const userAvatarDisplay = document.querySelector(
  "#display-avatar",
) as HTMLImageElement;
const getStarted = document.getElementById("get-started") as HTMLButtonElement;
const loginButton = document.getElementById("log-in") as HTMLButtonElement;

// const userStatsContainer = document.getElementById("user-stats"); // The container to show/hide

getStarted.disabled = true;
userNameDisplay.innerText = "Loading...";
userPointsDisplay.innerText = "Loading...";
userAvatarDisplay.innerText = "Loading...";

getStarted.addEventListener("click", () => {
  window.location.href = "./dashboard/.";
});

// Try to load the user profile
const loadUserProfile = async function () {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If the user has not logged in then don't continue
  if (!user) {
    userNameDisplay.innerText = "";
    userPointsDisplay.innerText = "";
    userAvatarDisplay.classList.add("hidden");
    return;
  }

  getStarted.disabled = false;
  loginButton.classList.add("hidden");
  // Get the user's name, total points, avatar_url
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, total_points, avatar_url")
    .eq("id", user?.id)
    .single();

  // If there was an error when return it
  if (error) {
    console.log(error);
    return;
  }
  userNameDisplay.innerHTML = profile.username; //#818cf8
  userPointsDisplay.innerHTML = `<p style='color: #2e3478'>Total Points <label style="color: var(--success); font-size: 2rem;">${profile.total_points}</label></p>`;
  userAvatarDisplay.src = profile.avatar_url;
};

loadUserProfile();

// const signOut = async function () {
//   await supabase.auth.signOut();
//   window.location.reload();
// };
//
// // function call from the html file
// const profileBtn = document.querySelector(
//   ".right__container--pfp",
// ) as HTMLLIElement;
//
// profileBtn.addEventListener("click", signOut);
