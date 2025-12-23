import { supabase } from "../lib/supabaseClient";
// import "../scss/main.scss";

// 1. Select the Form
const registerForm = document.getElementById("reg__form") as HTMLFormElement;
const loginForm = document.getElementById("login__form") as HTMLFormElement;

// # Select the input types fields
const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
const registerBtn = document.getElementById(
  "register-btn",
) as HTMLButtonElement;

function toggleAuthMode(mode: "login" | "register") {
  //reset
  console.log("Btn", loginBtn, registerBtn, "FOrm", loginForm, registerForm);
  loginBtn?.classList.remove("active");
  registerBtn?.classList.remove("active");
  loginForm?.classList.add("hidden");
  registerForm?.classList.add("hidden");

  if (mode === "login") {
    loginBtn?.classList.add("active");
    loginForm?.classList.remove("hidden");
  }
  if (mode === "register") {
    registerBtn?.classList.add("active");
    registerForm?.classList.remove("hidden");
  }
}

// set loginBtn to true by default
toggleAuthMode("login");

loginBtn.addEventListener("click", toggleAuthMode.bind(null, "login"));
registerBtn.addEventListener("click", toggleAuthMode.bind(null, "register"));

// if the submitted request is for register
if (registerForm) {
  // 2. Select the Inputs
  const regEmailInput = document.getElementById(
    "reg-email",
  ) as HTMLInputElement;
  const regPasswordInput = document.getElementById(
    "reg-password",
  ) as HTMLInputElement;
  const regUsernameInput = document.getElementById(
    "reg-username",
  ) as HTMLInputElement;

  // ... previous selectors ...
  const checkUserBtn = document.getElementById(
    "check-user-btn",
  ) as HTMLButtonElement;
  const usernameStatus = document.getElementById(
    "username-status",
  ) as HTMLElement;

  // check if the username is available or not
  if (checkUserBtn) {
    checkUserBtn.addEventListener("click", async () => {
      const username = regUsernameInput.value.trim();

      // 1. Basic Validation
      if (username.length < 3) {
        usernameStatus.innerText = "Too short (min 3 chars)";
        usernameStatus.className = "status-text error";
        return;
      }

      checkUserBtn.innerText = "Checking...";
      checkUserBtn.disabled = true;

      // 2. Ask Supabase
      // We look for ANY row where username equals the input
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", username)
        .maybeSingle(); // Returns data if found, null if not found

      checkUserBtn.innerText = "Check";
      checkUserBtn.disabled = false;

      if (error) {
        console.error(error);
        return;
      }

      // 3. Update UI based on result
      if (data) {
        // Data found = Username is TAKEN
        usernameStatus.innerText = "❌ Taken";
        usernameStatus.className = "status-text error";
        regUsernameInput.style.borderColor = "var(--error)"; // Red border
      } else {
        // Data is null = Username is AVAILABLE
        usernameStatus.innerText = "✅ Available";
        usernameStatus.className = "status-text success";
        regUsernameInput.style.borderColor = "var(--success)"; // Green border
      }
    });
  }

  // if user type anything after checking the username status reset it
  regUsernameInput.addEventListener("input", () => {
    usernameStatus.innerText = "";
    regUsernameInput.style.borderColor = ""; // Reset border
  });

  // when the user click on the submit button
  registerForm.addEventListener("submit", async (e: Event) => {
    e.preventDefault();

    const email = regEmailInput.value;
    const password = regPasswordInput.value;
    const username = regUsernameInput.value;

    const emailLabel = document.querySelector(
      ".reg-email--label",
    ) as HTMLElement;
    const passwordLabel = document.querySelector(
      ".reg-password--label",
    ) as HTMLElement;
    const usernameLabel = document.querySelector(
      ".reg-username--label",
    ) as HTMLElement;
    emailLabel.innerHTML = `Email`;
    passwordLabel.innerHTML = `Password`;
    usernameLabel.innerHTML = `Username`;

    if (!email || !password || !username) {
      // get the label from the HTML

      // change the label if the user has not enter the value
      if (!email)
        emailLabel.innerHTML += `<strong style="color: #ef4444;margin: 100%;"> Please enter your email address </strong>`;
      if (!password)
        passwordLabel.innerHTML += `<strong style="color: #ef4444;margin: 100%;"> Please enter your password </strong>`;
      if (!username)
        usernameLabel.innerHTML += `<strong style="color: #ef4444;margin: 100%;"> Please enter your username  </strong>`;

      return;
    }

    const signInSubmitBtn = registerForm.querySelector(
      'input[type="submit"].signin',
    ) as HTMLInputElement;
    const originalText = signInSubmitBtn.value;
    signInSubmitBtn.value = "Signing up...";
    signInSubmitBtn.disabled = true;

    const { error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          username: username,
        },
      },
    });
    if (error) {
      alert(`Error: ${error.message}`);

      // Reset button so they can try again
      signInSubmitBtn.value = originalText;
      signInSubmitBtn.disabled = false;
    } else {
      // SUCCESS: User created!

      alert("Account created successfully! Redirecting...");

      // Redirect them to the Dashboard (or Home)
      window.location.href = "/src/";
    }
  });
}

// if the submitted request is for login
if (loginForm) {
  //create the  var to store the fields input
  const loginEmailInput = document.getElementById(
    "login-email",
  ) as HTMLInputElement;
  const loginPasswordInput = document.getElementById(
    "login-password",
  ) as HTMLInputElement;

  loginForm.addEventListener("submit", async (e: Event) => {
    e.preventDefault();

    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    const loginSubmitBtn = loginForm.querySelector(
      'input[type="submit"].login',
    ) as HTMLInputElement;

    const emailLabel = document.querySelector(
      ".login-email--label",
    ) as HTMLElement;
    const passwordLabel = document.querySelector(
      ".login-password--label",
    ) as HTMLElement;

    emailLabel.innerHTML = `Email`;
    passwordLabel.innerHTML = `Password`;

    if (!email || !password) {
      if (!email) {
        emailLabel.innerHTML += `<strong style="color: #ef4444;margin: 100%;"> Please enter your email address </strong>`;
      }
      if (!password) {
        passwordLabel.innerHTML += `<strong style="color: #ef4444;margin: 100%;"> Please enter your password </strong>`;
      }
      return;
    }

    // the button's style
    const originalText = loginSubmitBtn.value;
    loginSubmitBtn.value = "Logging in...";
    loginSubmitBtn.disabled = true;
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      console.error(error);

      // reset the button
      loginSubmitBtn.value = originalText;
      loginSubmitBtn.disabled = false;
    } else {
      // Supabase automatically saves the "token" in LocalStorage.
      // We just need to move them to the dashboard.
      window.location.href = "/";
    }
  });
}
