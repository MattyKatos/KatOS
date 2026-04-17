const desktopEl = document.getElementById("desktop");
const desktopIconsEl = document.getElementById("desktopIcons");
const windowLayerEl = document.getElementById("windowLayer");
const taskbarAppsEl = document.getElementById("taskbarApps");

let commands = {};
let zCounter = 10;
let winCounter = 1;
const windowsById = new Map();

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

function focusWindow(winId) {
  for (const w of windowsById.values()) {
    w.el.classList.remove("window--focused");
    w.taskbarBtn.setAttribute("aria-pressed", "false");
  }
  const w = windowsById.get(winId);
  if (!w) return;
  w.el.classList.add("window--focused");
  w.el.style.zIndex = String(++zCounter);
  w.taskbarBtn.setAttribute("aria-pressed", "true");
  if (!w.minimized) {
    w.onFocus?.();
  }
}

function setMinimized(winId, minimized) {
  const w = windowsById.get(winId);
  if (!w) return;
  w.minimized = minimized;
  w.el.style.display = minimized ? "none" : "grid";
  if (!minimized) {
    focusWindow(winId);
  }
}

function closeWindow(winId) {
  const w = windowsById.get(winId);
  if (!w) return;
  w.el.remove();
  w.taskbarBtn.remove();
  windowsById.delete(winId);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function createWindow({ title, appId, contentEl, onFocus }) {
  const winId = `win_${winCounter++}`;
  const el = document.createElement("section");
  el.className = "window";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", title);
  el.dataset.winId = winId;
  el.dataset.appId = appId;

  const titlebar = document.createElement("div");
  titlebar.className = "window__titlebar";

  const titleEl = document.createElement("div");
  titleEl.className = "window__title";
  titleEl.textContent = title;

  const controls = document.createElement("div");
  controls.className = "window__controls";

  const minBtn = document.createElement("button");
  minBtn.type = "button";
  minBtn.className = "window__btn";
  minBtn.textContent = "_";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "window__btn window__btn--close";
  closeBtn.textContent = "X";

  controls.appendChild(minBtn);
  controls.appendChild(closeBtn);
  titlebar.appendChild(titleEl);
  titlebar.appendChild(controls);

  const contentWrap = document.createElement("div");
  contentWrap.className = "window__content";
  contentWrap.appendChild(contentEl);

  el.appendChild(titlebar);
  el.appendChild(contentWrap);

  const offset = 30 + windowsById.size * 26;
  el.style.left = `${clamp(offset, 14, Math.max(14, window.innerWidth - 420))}px`;
  el.style.top = `${clamp(offset, 14, Math.max(14, window.innerHeight - 320))}px`;
  el.style.zIndex = String(++zCounter);

  windowLayerEl.appendChild(el);

  const taskbarBtn = document.createElement("button");
  taskbarBtn.type = "button";
  taskbarBtn.className = "taskbar__appbtn";
  taskbarBtn.textContent = title;
  taskbarBtn.setAttribute("aria-pressed", "false");
  taskbarAppsEl.appendChild(taskbarBtn);

  const winState = { id: winId, appId, title, el, taskbarBtn, minimized: false, onFocus };
  windowsById.set(winId, winState);

  el.addEventListener("mousedown", () => focusWindow(winId));

  taskbarBtn.addEventListener("click", () => {
    if (winState.minimized) {
      setMinimized(winId, false);
      return;
    }
    const pressed = taskbarBtn.getAttribute("aria-pressed") === "true";
    if (pressed) {
      setMinimized(winId, true);
    } else {
      focusWindow(winId);
    }
  });

  minBtn.addEventListener("click", () => setMinimized(winId, true));
  closeBtn.addEventListener("click", () => closeWindow(winId));

  let drag = null;
  titlebar.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    focusWindow(winId);
    const rect = el.getBoundingClientRect();
    drag = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
  });

  window.addEventListener("mousemove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const nextLeft = drag.startLeft + dx;
    const nextTop = drag.startTop + dy;

    const maxLeft = Math.max(14, window.innerWidth - el.offsetWidth - 14);
    const maxTop = Math.max(14, window.innerHeight - el.offsetHeight - 62);
    el.style.left = `${clamp(nextLeft, 14, maxLeft)}px`;
    el.style.top = `${clamp(nextTop, 14, maxTop)}px`;
  });

  window.addEventListener("mouseup", () => {
    drag = null;
  });

  focusWindow(winId);
  return winId;
}

function createTerminalApp() {
  const terminalEl = document.createElement("main");
  terminalEl.className = "terminal";
  terminalEl.setAttribute("aria-label", "Terminal");

  const headerEl = document.createElement("header");
  headerEl.className = "terminal__header";
  const titleEl = document.createElement("div");
  titleEl.className = "terminal__title";
  titleEl.textContent = "KatOS";
  const subtitleEl = document.createElement("div");
  subtitleEl.className = "terminal__subtitle";
  subtitleEl.innerHTML = 'Type <span class="hint">help</span> for a list of commands';
  headerEl.appendChild(titleEl);
  headerEl.appendChild(subtitleEl);

  const outputEl = document.createElement("section");
  outputEl.className = "terminal__output";
  outputEl.setAttribute("aria-live", "polite");

  const promptForm = document.createElement("form");
  promptForm.className = "terminal__prompt";
  promptForm.autocomplete = "off";

  const prefix = document.createElement("span");
  prefix.className = "terminal__prompt__prefix";
  prefix.textContent = "$";

  const inputEl = document.createElement("input");
  inputEl.className = "terminal__prompt__input";
  inputEl.type = "text";
  inputEl.spellcheck = false;
  inputEl.autocapitalize = "none";
  inputEl.autocomplete = "off";
  inputEl.setAttribute("aria-label", "Command input");

  promptForm.appendChild(prefix);
  promptForm.appendChild(inputEl);

  terminalEl.appendChild(headerEl);
  terminalEl.appendChild(outputEl);
  terminalEl.appendChild(promptForm);

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

  function renderToken(token, execute) {
    switch (token.type) {
      case "clear": {
        outputEl.innerHTML = "";
        return;
      }
      case "open": {
        if (token.href) {
          window.open(token.href, "_blank", "noreferrer");
        }
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

    const [first, ...restParts] = trimmed.split(/\s+/g);
    const name = (first ?? "").toLowerCase();
    const args = restParts;
    const argsText = restParts.join(" ");
    return { name, args, argsText };
  }

  async function execute(raw) {
    const { name, args, argsText } = parseInput(raw);

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
      const tokens = (await cmd.run({ args, argsText })) ?? [];
      for (const token of tokens) {
        const res = renderToken(token, execute);
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

  terminalEl.addEventListener("mousedown", () => {
    inputEl.focus();
  });

  return {
    el: terminalEl,
    focus() {
      inputEl.focus();
    },
    async boot() {
      inputEl.focus();
      await execute("about");
    },
  };
}

function createWebApp() {
  const el = document.createElement("div");
  el.className = "webapp";

  const header = document.createElement("div");
  header.className = "webapp__header";

  const title = document.createElement("div");
  title.className = "webapp__title";
  title.textContent = "Loading latest video...";

  const openBtn = document.createElement("a");
  openBtn.href = "https://www.youtube.com/@mattykatos";
  openBtn.target = "_blank";
  openBtn.rel = "noreferrer";
  openBtn.textContent = "Open on YouTube";

  header.appendChild(title);
  header.appendChild(openBtn);

  const body = document.createElement("div");
  body.className = "webapp__body";

  const frame = document.createElement("iframe");
  frame.className = "webapp__frame";
  frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  frame.allowFullscreen = true;
  body.appendChild(frame);

  el.appendChild(header);
  el.appendChild(body);

  async function loadLatest() {
    const res = await fetch("/api/latest-video?handle=mattykatos", { headers: { Accept: "application/json" } });
    if (!res.ok) {
      title.textContent = `Failed to load latest video (${res.status})`;
      frame.remove();
      return;
    }
    const data = await res.json();
    const videoId = data?.videoId;
    if (!videoId) {
      title.textContent = "Failed to load latest video";
      frame.remove();
      return;
    }
    title.textContent = data?.title ? `Latest: ${data.title}` : "Latest video";
    openBtn.href = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    frame.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
  }

  return {
    el,
    async boot() {
      await loadLatest();
    },
  };
}

function openApp(appId) {
  if (appId === "terminal") {
    const terminal = createTerminalApp();
    const winId = createWindow({
      title: "Terminal",
      appId,
      contentEl: terminal.el,
      onFocus: () => terminal.focus(),
    });
    terminal.boot();
    return winId;
  }
  if (appId === "youtube") {
    const web = createWebApp();
    const winId = createWindow({
      title: "YouTube",
      appId,
      contentEl: web.el,
      onFocus: () => {},
    });
    web.boot();
    return winId;
  }
  return null;
}

desktopIconsEl.addEventListener("dblclick", (e) => {
  const btn = e.target?.closest?.("button[data-app]");
  if (!btn) return;
  const appId = btn.getAttribute("data-app");
  openApp(appId);
});

desktopIconsEl.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("button[data-app]");
  if (!btn) return;
  const appId = btn.getAttribute("data-app");
  openApp(appId);
});

desktopEl.addEventListener("mousedown", () => {
  return;
});

(async () => {
  try {
    await loadCommands();
  } catch (err) {
    openApp("terminal");
    return;
  }
  openApp("terminal");
})();
