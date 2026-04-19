export default {
  id: "terminal",
  title: "Terminal",
  order: 0,
  iconGlyph: ">",
  create: ({ commands }) => {
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
  },
};
