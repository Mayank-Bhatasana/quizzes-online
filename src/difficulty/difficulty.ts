import { supabase } from "../lib/supabaseClient.ts";

const urlParams = new URLSearchParams(window.location.search);
const subjectId = urlParams.get("id");

if (!subjectId) {
  // Redirect back to dashboard if no ID is found
  window.location.href = "/dashboard/";
}

//Select the user info htmlTags
const userNameDisplay = document.getElementById(
  "display-username",
) as HTMLElement;
const userPointsDisplay = document.getElementById(
  "display-points",
) as HTMLElement;
const userAvatarDisplay = document.querySelector(
  "#display-avatar",
) as HTMLImageElement;

// const userStatsContainer = document.getElementById("user-stats"); // The container to show/hide

userNameDisplay.innerText = "Loading...";
userPointsDisplay.innerText = "Loading...";
userAvatarDisplay.innerText = "Loading...";

// Try to load the user profile
const loadUserProfile = async function () {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If the user has not logged in then don't continue
  if (!user) {
    console.log("No user logged in.");
    userNameDisplay.innerText = "";
    userPointsDisplay.innerText = "";
    userAvatarDisplay.classList.add("hidden");

    alert("Looks like you aren't logged in.😟\nLet's get you logged in.😃\n");
    window.location.href = window.location.origin + "/auth/.";
    return;
  }

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

  // get the subject name
  const subNameTag = document.getElementById("subject-name") as HTMLElement;
  const { data: subName } = await supabase
    .from("subjects")
    .select("name, image_url")
    .eq("id", subjectId);

  if (subName) {
    subNameTag.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center">
            <img src="${subName[0].image_url}" style="width: 5rem" alt=""/>${subName[0].name}
        </div>`;
  }

  // Show the difficulty
  const diffContainer = document.querySelector(
    ".difficulty__container",
  ) as HTMLElement;

  const getDifficulty = await supabase
    .from("difficulties")
    .select("*")
    .order("sort_order");

  console.log(getDifficulty.data);

  // @ts-ignore
  diffContainer.innerHTML = getDifficulty.data
    ?.map(
      (diff) =>
        `
          <button class="difficulty__card difficulty__card--${diff.level_name.toLowerCase()}" data-level="${diff.id}" >
          <div class="difficulty__card--icon">${diff.icon}</div>
          <div class="difficulty__card--content">
            <h3 class="difficulty__card--content--level_name">${diff.level_name}</h3>
            <p class="difficulty__card--content--description">
              ${diff.description}
            </p>
          </div>
          <span class="difficulty__card--content--level_points">+${diff.points_per_question} pts / correct</span>
        </button>
      `,
    )
    .join("");

  // user selects the difficulty
  diffContainer.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest(".difficulty__card") as HTMLElement;

    if (card) {
      const diffId = card.dataset.level;
      // console.log(`/quiz/?id=${subjectId}&diffId=${diffId}`);
      window.location.href = `/quiz/?id=${subjectId}&diffId=${diffId}`;
    }
  });
};

loadUserProfile();
// const signOut = async function () {
//   supabase.auth.signOut();
// };
// signOut();
