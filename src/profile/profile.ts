import logoUrl from "../assets/img/logo.svg";
import { initAppHeader, setHeaderProfile } from "../lib/header.ts";
import { supabase } from "../lib/supabaseClient.ts";
import type {
  ProfileRow,
  ProfileSummary,
  ProfileUpdate,
} from "../lib/supabaseTypes.ts";
import { hideSpinner, showSpinner } from "../lib/utils.ts";

const profileForm = document.getElementById("profile-form") as HTMLFormElement;
const passwordForm = document.getElementById("password-form") as HTMLFormElement;
const messageBox = document.getElementById("profile-message") as HTMLElement;

const emailInput = document.getElementById("profile-email") as HTMLInputElement;
const usernameInput = document.getElementById("profile-username") as HTMLInputElement;
const avatarPreview = document.getElementById(
  "profile-avatar-preview",
) as HTMLImageElement;
const avatarGallery = document.getElementById(
  "profile-avatar-gallery",
) as HTMLDivElement;
const pointsDisplay = document.getElementById("profile-points") as HTMLElement;
const roleDisplay = document.getElementById("profile-role") as HTMLElement;
const createdAtDisplay = document.getElementById("profile-created-at") as HTMLElement;
const saveBtn = document.getElementById("profile-save-btn") as HTMLButtonElement;
const logoutBtn = document.getElementById("profile-logout-btn") as HTMLButtonElement;
const passwordBtn = document.getElementById("profile-password-btn") as HTMLButtonElement;
const newPasswordInput = document.getElementById("new-password") as HTMLInputElement;
const confirmPasswordInput = document.getElementById(
  "confirm-password",
) as HTMLInputElement;

let currentUserId = "";
let selectedAvatarUrl: string | null = null;

const AVATAR_BUCKET = "defaults";

function showMessage(text: string, variant: "success" | "error"): void {
  messageBox.classList.remove("hidden");
  messageBox.classList.remove("profile__message--success", "profile__message--error");
  messageBox.classList.add(`profile__message--${variant}`);
  messageBox.textContent = text;
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString();
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  if (parts.length < 2) return "jpg";
  return parts[parts.length - 1].toLowerCase();
}

function setAvatarPreview(url: string | null): void {
  avatarPreview.src = url ?? logoUrl;
}

function markSelectedAvatar(url: string | null): void {
  selectedAvatarUrl = url;
  setAvatarPreview(selectedAvatarUrl);

  const options = avatarGallery.querySelectorAll<HTMLElement>(".profile__avatar-option");
  options.forEach((option) => {
    const isActive = option.dataset.url === (selectedAvatarUrl ?? "");
    option.classList.toggle("is-selected", isActive);
  });
}

function renderAvatarGallery(avatarUrls: string[]): void {
  if (avatarUrls.length === 0) {
    avatarGallery.innerHTML =
      '<p class="profile__avatar-gallery-empty">No avatars found in storage yet.</p>';
    return;
  }

  avatarGallery.innerHTML = avatarUrls
    .map(
      (url) => `
      <button type="button" class="profile__avatar-option" data-url="${url}">
        <img src="${url}" alt="Avatar option" />
      </button>
    `,
    )
    .join("");

  markSelectedAvatar(selectedAvatarUrl);
}

async function loadAvatarGallery(): Promise<void> {
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .list("", {
      limit: 100,
      sortBy: { column: "name", order: "asc" },
    });

  if (error) {
    avatarGallery.innerHTML =
      '<p class="profile__avatar-gallery-empty">Could not load avatar library.</p>';
    return;
  }

  const avatarUrls = (data ?? [])
    .filter((file) => {
      const extension = getFileExtension(file.name);
      return ["jpg", "jpeg", "png", "webp"].includes(extension);
    })
    .map((file) => {
      return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(file.name).data.publicUrl;
    });

  renderAvatarGallery(avatarUrls);
}

function fillProfileForm(profile: ProfileRow, email: string): void {
  emailInput.value = email;
  usernameInput.value = profile.username ?? "";
  selectedAvatarUrl = profile.avatar_url;
  setAvatarPreview(selectedAvatarUrl);
  pointsDisplay.textContent = String(profile.total_points);
  roleDisplay.textContent = profile.role;
  createdAtDisplay.textContent = formatDate(profile.created_at);
}

async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) {
    showMessage("Could not load your profile.", "error");
    return null;
  }

  return data;
}

async function usernameExists(
  username: string,
  userId: string,
): Promise<{ exists: boolean; hasError: boolean }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", userId)
    .maybeSingle();

  if (error) return { exists: false, hasError: true };
  return { exists: Boolean(data), hasError: false };
}

async function handleProfileSave(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  messageBox.classList.add("hidden");

  const nextUsername = usernameInput.value.trim();

  if (nextUsername.length < 3) {
    showMessage("Username must be at least 3 characters.", "error");
    return;
  }

  saveBtn.disabled = true;

  const { exists, hasError } = await usernameExists(nextUsername, currentUserId);
  if (hasError) {
    saveBtn.disabled = false;
    showMessage("Could not verify username availability.", "error");
    return;
  }

  if (exists) {
    saveBtn.disabled = false;
    showMessage("That username is already taken.", "error");
    return;
  }

  const updatePayload: ProfileUpdate = {
    username: nextUsername,
    avatar_url: selectedAvatarUrl,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", currentUserId)
    .select("*")
    .single();

  saveBtn.disabled = false;

  if (error || !data) {
    showMessage("Failed to update profile.", "error");
    return;
  }

  const updatedProfile: ProfileRow = data;
  const profileSummary: ProfileSummary = {
    username: updatedProfile.username,
    total_points: updatedProfile.total_points,
    avatar_url: updatedProfile.avatar_url,
  };

  setHeaderProfile(profileSummary);
  fillProfileForm(updatedProfile, emailInput.value);
  showMessage("Profile updated successfully.", "success");
}

async function handlePasswordSave(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  messageBox.classList.add("hidden");

  const newPassword = newPasswordInput.value.trim();
  const confirmPassword = confirmPasswordInput.value.trim();

  if (newPassword.length < 6) {
    showMessage("Password must be at least 6 characters.", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showMessage("Passwords do not match.", "error");
    return;
  }

  passwordBtn.disabled = true;
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  passwordBtn.disabled = false;

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  passwordForm.reset();
  showMessage("Password updated successfully.", "success");
}

async function initProfilePage(): Promise<void> {
  showSpinner();

  const { user } = await initAppHeader({ requireAuth: true });
  if (!user) {
    hideSpinner();
    return;
  }

  currentUserId = user.id;
  const profile = await fetchProfile(user.id);
  if (profile) {
    fillProfileForm(profile, user.email ?? "");
  }
  await loadAvatarGallery();

  hideSpinner();
}

profileForm.addEventListener("submit", (event) => {
  void handleProfileSave(event);
});

passwordForm.addEventListener("submit", (event) => {
  void handlePasswordSave(event);
});

avatarGallery.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const option = target.closest(".profile__avatar-option") as HTMLButtonElement | null;
  if (!option) return;

  const url = option.dataset.url ?? null;
  markSelectedAvatar(url);
});

logoutBtn.addEventListener("click", () => {
  void (async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/";
  })();
});

void initProfilePage();
