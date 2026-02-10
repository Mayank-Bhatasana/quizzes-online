export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function showSpinner() {
  document.getElementById("spinner-overlay")?.classList.add("active");
  document.getElementById("spinner")?.classList.add("active");
}

export function hideSpinner() {
  document.getElementById("spinner-overlay")?.classList.remove("active");
  document.getElementById("spinner")?.classList.remove("active");
}

