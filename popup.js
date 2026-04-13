const api = (typeof browser !== "undefined") ? browser : chrome;

let showTransformed = true;

document.addEventListener("DOMContentLoaded", async () => {
  const { settings } = await api.storage.local.get(["settings"]);
  if (!settings) return;

  document.getElementById("vowels").value = settings.vowels ?? 0;
  document.getElementById("letters").value = settings.letters ?? 0;
  document.getElementById("words").value = settings.words ?? 0;
  document.getElementById("lowercaseOnly").checked = settings.lowercaseOnly ?? false;

  const [tab] = await api.tabs.query({ active: true, currentWindow: true });

  const res = await api.tabs.sendMessage(tab.id, { type: "GET_STATE" }).catch(() => null);

  if (res?.showTransformed !== undefined) {
    showTransformed = res.showTransformed;
    updateToggleUI();
  }

  updateToggleUI();
});

document.getElementById("apply").addEventListener("click", async () => {
  const settings = {
    vowels: parseInt(document.getElementById("vowels").value),
    letters: parseInt(document.getElementById("letters").value),
    words: parseInt(document.getElementById("words").value),
    lowercaseOnly: document.getElementById("lowercaseOnly").checked
  };

  await api.storage.local.set({ settings });

  const [tab] = await api.tabs.query({ active: true, currentWindow: true });

  api.tabs.sendMessage(tab.id, {
    type: "UPDATE_SETTINGS",
    settings,
  });
});

const toggleBtn = document.getElementById("toggle");

toggleBtn.addEventListener("click", async () => {
  showTransformed = !showTransformed;

  const [tab] = await api.tabs.query({ active: true, currentWindow: true });

  api.tabs.sendMessage(tab.id, {
    type: "TOGGLE_VIEW",
    showTransformed,
  });

  updateToggleUI();
});

function updateToggleUI() {
  if (showTransformed) {
    toggleBtn.textContent = "Show Original";
    toggleBtn.style.background = "#111";
    toggleBtn.style.color = "#fff";
    toggleBtn.style.border = "1px solid #444";
  } else {
    toggleBtn.textContent = "Show Transformed";
    toggleBtn.style.background = "#00c853";
    toggleBtn.style.color = "#000";
    toggleBtn.style.border = "none";
  }
}