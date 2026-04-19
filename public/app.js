const desktopEl = document.getElementById("desktop");
const desktopIconsEl = document.getElementById("desktopIcons");
const windowLayerEl = document.getElementById("windowLayer");
const taskbarAppsEl = document.getElementById("taskbarApps");

let commands = {};
let apps = {};
let appList = [];
let zCounter = 10;
let winCounter = 1;
const windowsById = new Map();

async function loadApps() {
  const res = await fetch("/api/apps", { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Failed to load apps list: ${res.status}`);
  }

  const data = await res.json();
  const modules = Array.isArray(data.modules) ? data.modules : [];

  const loaded = await Promise.all(
    modules.map(async (p) => {
      const mod = await import(p);
      return mod?.default;
    })
  );

  appList = loaded.filter((a) => a && typeof a.id === "string" && typeof a.create === "function");
  apps = Object.fromEntries(appList.map((a) => [a.id.toLowerCase(), a]));
}

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

function clearDesktopIcons() {
  desktopIconsEl.innerHTML = "";
}

function addDesktopIcon(app) {
  const btn = document.createElement("button");
  btn.className = "desktop-icon";
  btn.type = "button";
  btn.setAttribute("data-app", app.id);
  btn.setAttribute("aria-label", `Open ${app.title}`);

  const glyph = document.createElement("span");
  glyph.className = "desktop-icon__glyph";
  glyph.textContent = app.iconGlyph ?? "?";

  const label = document.createElement("span");
  label.className = "desktop-icon__label";
  label.textContent = app.title;

  btn.appendChild(glyph);
  btn.appendChild(label);
  desktopIconsEl.appendChild(btn);
}

function renderDesktopIcons() {
  clearDesktopIcons();
  const sorted = [...appList].sort((a, b) => {
    const ao = Number.isFinite(a.order) ? a.order : 9999;
    const bo = Number.isFinite(b.order) ? b.order : 9999;
    if (ao !== bo) return ao - bo;
    const at = String(a.title ?? a.id ?? "");
    const bt = String(b.title ?? b.id ?? "");
    return at.localeCompare(bt);
  });

  for (const app of sorted) {
    addDesktopIcon(app);
  }
}

function openApp(appId) {
  const app = apps[String(appId ?? "").toLowerCase()];
  if (!app) return null;

  const instance = app.create({ commands });
  const winId = createWindow({
    title: app.title,
    appId: app.id,
    contentEl: instance.el,
    onFocus: () => instance.focus?.(),
  });
  instance.boot?.();
  return winId;
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
    await loadApps();
    await loadCommands();
  } catch (err) {
    try {
      await loadApps();
    } catch {
      return;
    }
    renderDesktopIcons();
    openApp("terminal");
    return;
  }
  renderDesktopIcons();
  openApp("terminal");
})();
