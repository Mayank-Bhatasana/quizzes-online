import { initAppHeader } from "../lib/header.ts";
import { supabase } from "../lib/supabaseClient.ts";
import type { SubjectRow } from "../lib/supabaseTypes.ts";
import { showSpinner, hideSpinner } from "../lib/utils.ts";

const subjectContainer = document.querySelector(
  ".dashboard__main__container",
) as HTMLElement;

const loadUserProfile = async function () {
  showSpinner();
  const { user } = await initAppHeader({ requireAuth: true });

  // If the user has not logged in then don't continue
  if (!user) {
    hideSpinner();
    return;
  }

  const { data: subjectsData, error: subError } = await supabase
    .from("subjects")
    .select("*")
    .order("sort_order");

  if (subError) {
    console.error(subError);
    hideSpinner();
    return;
  }

  if (!subjectsData) {
    hideSpinner();
    return;
  }

  const subjects: SubjectRow[] = subjectsData;
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
  hideSpinner();
};

loadUserProfile();
