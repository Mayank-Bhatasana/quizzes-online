import { supabase } from "../lib/supabaseClient.ts";

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
const subjectContainer = document.querySelector(
  ".dashboard__main__container",
) as HTMLElement;

// subjectContainer.style.gridTemplateColumns = "repeat(1, 1fr)";

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
    userNameDisplay.innerText = "";
    userPointsDisplay.innerText = "";
    userAvatarDisplay.classList.add("hidden");

    alert("Looks like you aren't logged in.😟\nLet's get you logged in.😃\n");
    window.location.href = "/auth/.";
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

  const { data: subjects, error: subError } = await supabase
    .from("subjects")
    .select("*")
    .order("sort_order");

  if (subError) {
    console.error(subError);
    return;
  }

  const htmlOfSubjects = subjects
    .map(
      (subject) =>
        `
    <div class="dashboard__main__container--card" data-id="${subject.id}">
        <img
          src="${subject.image_url}"
          alt="logo"
          class="dashboard__main__container--card--logo"
        />
        <h3 class="dashboard__main__container--card--name">${subject.name}</h3>
        <span class="dashboard__main__container--card--discription">
            ${subject.description}
        </span>
    </div>
    `,
    )
    .join("");

  subjectContainer.innerHTML = htmlOfSubjects;

  const subjectIdCon = document.querySelector(
    ".dashboard__main__container",
  ) as HTMLElement;

  subjectIdCon.addEventListener("click", (e) => {
    if (e.target instanceof Element) {
      const card = e.target.closest(".dashboard__main__container--card");
      if (card) {
        const id = (card as HTMLElement).dataset.id;

        // Navigate to the difficulty page with the subject ID as a query parameter
        window.location.href = `/difficulty/?id=${id}`;
      }
    }
  });
};

loadUserProfile();

// const signOut = async function () {
//   supabase.auth.signOut();
// };
// signOut();
