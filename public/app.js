const outputEl = document.getElementById("output");
const promptForm = document.getElementById("prompt");
const inputEl = document.getElementById("commandInput");

let commands = {};

async function loadCommands() {
  const res = await fetch("/api/commands", { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Failed to load commands list: ${res.status}`);
  }

  const data = await res.json();
  const modules = Array.isArray(data.modules) ? data.modules : [];

  const loaded = await Promise.all(
    modules.map(async (p) => {
      const mod = await import(p);
      return mod?.default;
    })
  );

  const list = loaded.filter((c) => c && typeof c.name === "string" && typeof c.run === "function");
  commands = Object.fromEntries(list.map((c) => [c.name.toLowerCase(), c]));
}

function scrollToBottom() {
  outputEl.scrollTop = outputEl.scrollHeight;
}

function animateIn(element) {
  if (typeof anime === "undefined") return;
  anime({
    targets: element,
    opacity: [0, 1],
    translateY: [6, 0],
    duration: 260,
    easing: "easeOutQuad",
  });
}

function createLine(text, { muted = false } = {}) {
  const line = document.createElement("div");
  line.className = muted ? "line line--muted" : "line";
  line.textContent = text;
  return line;
}

async function typeLine(text, { muted = false, speed = 12 } = {}) {
  const line = document.createElement("div");
  line.className = muted ? "line line--muted" : "line";
  outputEl.appendChild(line);
  scrollToBottom();

  const caret = document.createElement("span");
  caret.className = "caret";
  line.appendChild(caret);

  for (let i = 0; i < text.length; i += 1) {
    caret.insertAdjacentText("beforebegin", text[i]);
    await new Promise((r) => setTimeout(r, speed));
    scrollToBottom();
  }

  caret.remove();
  animateIn(line);
}

function renderToken(token) {
  switch (token.type) {
    case "clear": {
      outputEl.innerHTML = "";
      return;
    }
    case "text": {
      const line = createLine(token.text, { muted: Boolean(token.muted) });
      outputEl.appendChild(line);
      animateIn(line);
      return;
    }
    case "typed": {
      return typeLine(token.text, { muted: Boolean(token.muted), speed: token.speed ?? 12 });
    }
    case "link": {
      const line = document.createElement("div");
      line.className = "line";
      const a = document.createElement("a");
      a.href = token.href;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = token.text ?? token.href;
      line.appendChild(a);
      outputEl.appendChild(line);
      animateIn(line);
      return;
    }
    case "image": {
      const wrap = document.createElement("div");
      wrap.className = "block";
      const img = document.createElement("img");
      img.className = "terminal-image";
      img.alt = token.alt ?? "";
      img.src = token.src;
      wrap.appendChild(img);
      outputEl.appendChild(wrap);
      animateIn(wrap);
      return;
    }
    case "buttons": {
      const wrap = document.createElement("div");
      wrap.className = "block";

      if (token.label) {
        wrap.appendChild(createLine(token.label, { muted: true }));
      }

      const row = document.createElement("div");
      row.className = "btn-row";

      for (const btn of token.buttons ?? []) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "terminal-btn";
        b.textContent = btn.text;
        b.addEventListener("click", async () => {
          if (btn.run) {
            await execute(btn.run);
          }
          if (btn.href) {
            window.open(btn.href, "_blank", "noreferrer");
          }
        });
        row.appendChild(b);
      }

      wrap.appendChild(row);
      outputEl.appendChild(wrap);
      animateIn(wrap);
      return;
    }
    default: {
      const line = createLine(`[unknown token: ${token.type}]`, { muted: true });
      outputEl.appendChild(line);
      animateIn(line);
    }
  }
}

function parseInput(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return { name: "", args: [] };

  const parts = trimmed.split(/\s+/g);
  const name = parts[0].toLowerCase();
  const args = parts.slice(1);
  return { name, args };
}

async function execute(raw) {
  const { name, args } = parseInput(raw);

  if (!name) return;

  outputEl.appendChild(createLine(`$ ${raw}`, { muted: true }));
  scrollToBottom();

  const cmd = commands[name];
  if (!cmd) {
    await typeLine(`Command not found: ${name}`, { muted: false, speed: 10 });
    await typeLine(`Type 'help' to see available commands.`, { muted: true, speed: 10 });
    return;
  }

  try {
    const tokens = (await cmd.run({ args })) ?? [];
    for (const token of tokens) {
      // Ensure typed tokens are awaited so output order is preserved
      const res = renderToken(token);
      if (res instanceof Promise) await res;
      scrollToBottom();
    }
  } catch (err) {
    await typeLine(`Error: ${err?.message ?? String(err)}`, { muted: false, speed: 10 });
  }
}

promptForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = inputEl.value;
  inputEl.value = "";
  await execute(raw);
});

window.addEventListener("click", () => {
  inputEl.focus();
});

inputEl.focus();
(async () => {
  try {
    await loadCommands();
  } catch (err) {
    await typeLine(`Error: ${err?.message ?? String(err)}`, { muted: false, speed: 10 });
    await typeLine(`Could not auto-load /commands modules.`, { muted: true, speed: 10 });
    return;
  }

  await execute("about");
})();
