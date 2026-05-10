import { initAppHeader } from "./lib/header.ts";

const getStarted = document.getElementById("get-started") as HTMLButtonElement;
const loginButton = document.getElementById("log-in") as HTMLButtonElement;

getStarted.disabled = true;

getStarted.addEventListener("click", () => {
  window.location.href = "./dashboard/.";
});

const initHome = async () => {
  const { user } = await initAppHeader();
  if (!user) {
    return;
  }

  getStarted.disabled = false;
  loginButton.classList.add("hidden");
};

void initHome();
