const api = (typeof browser !== "undefined") ? browser : chrome;

let settingsCache = { vowels: 100, letters: 0, words: 0, lowercaseOnly: true, keepConsecutiveVowels: true };
let showTransformed = true;

api.storage.local.get(["settings"]).then(async (result) => {
  if (result.settings) {
    settingsCache = result.settings;
  } else {
    await api.storage.local.set({ "settings": settingsCache });
  }
  applyAll();
});

const shadow = new Map();

function shouldIgnore(node) {
  const p = node.parentElement;
  if (!p) return false;
  return p.closest("script, style, pre, code");
}

function isVowel(char, lowercaseOnly = false) {
  const normalized = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const base = normalized[0];
  return "aeiou".includes(lowercaseOnly ? base : base.toLowerCase());
}

function removeVowels(text, percent, lowercaseOnly = false, keepConsecutiveVowels = true) {
  return text.split(/([^\p{L}\p{N}_]+)/u).map(part => {
    const chars = [...part];
    return chars.map((c, i) => {
      if (i === 0) return c;
      if (!isVowel(c, lowercaseOnly)) return c;
      if (keepConsecutiveVowels) {
        const prev = chars[i - 1];
        const next = chars[i + 1];
        const isCluster =
          (prev && isVowel(prev, lowercaseOnly)) ||
          (next && isVowel(next, lowercaseOnly));
        if (isCluster) return c;
      }
      if (Math.random() >= percent / 100) return c;
      return "";
    }).join("");
  }).join("");
}

function removeLetters(text, percent, lowercaseOnly = false) {
  return [...text].map(c => {
    if (!/\p{L}/u.test(c)) return c;
    if (lowercaseOnly && c !== c.toLowerCase()) return c;
    if (Math.random() >= percent / 100) return c;
    return "";
  }).join("");
}

function removeWords(text, percent) {
  return text.split(/([^\p{L}\p{N}_]+)/u).map(part => {
    if (!/[\p{L}\p{N}_]/u.test(part)) return part;
    return Math.random() < percent / 100 ? "___" : part;
  }).join("");
}

function walk(node, transform) {
  if (!node) return;

  const children = node.childNodes || [];

  if (node.nodeType === Node.TEXT_NODE) {
    if (shouldIgnore(node)) return;

    const key = node;

    if (!shadow.has(key)) {
      const original = node.textContent;
      shadow.set(key, {
        original,
        transformed: transform(original),
      });
    } else {
      const entry = shadow.get(key);

      if (
        node.textContent !== entry.original &&
        node.textContent !== entry.transformed
      ) {
        const newOriginal = node.textContent;
        shadow.set(key, {
          original: newOriginal,
          transformed: transform(newOriginal),
        });
      }
    }

    const entry = shadow.get(key);
    node.textContent = showTransformed
      ? entry.transformed
      : entry.original;

    return;
  }

  if (node.shadowRoot) {
    walk(node.shadowRoot, transform);
  }

  children.forEach((n) => walk(n, transform));
}

function applyAll() {
  if (!showTransformed) return;
  walk(document.body, (text) => {
    let out = text;
    if (settingsCache.words > 0) out = removeWords(out, settingsCache.words);
    if (settingsCache.vowels > 0) out = removeVowels(out, settingsCache.vowels, settingsCache.lowercaseOnly, settingsCache.keepConsecutiveVowels);
    if (settingsCache.letters > 0) out = removeLetters(out, settingsCache.letters, settingsCache.lowercaseOnly);
    return out;
  });
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_STATE") {
    sendResponse({ showTransformed });
    return;
  }

  if (msg.type === "UPDATE_SETTINGS") {
    settingsCache = msg.settings;

    shadow.forEach((entry, node) => {
      node.textContent = entry.original;
    });

    shadow.clear();
    applyAll();
  }

  if (msg.type === "TOGGLE_VIEW") {
    showTransformed = msg.showTransformed;
    if (!showTransformed) {
      shadow.forEach((entry, node) => {
        node.textContent = entry.original;
      });
    }
    applyAll();
  }
});

let scheduled = false;

const observer = new MutationObserver(() => {
  if (scheduled) return;

  scheduled = true;

  setTimeout(() => {
    applyAll();
    scheduled = false;
  }, 300);
});

const root = document.body || document.documentElement;

observer.observe(root, {
  childList: true,
  subtree: true,
});