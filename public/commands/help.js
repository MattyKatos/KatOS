export default {
  name: "help",
  description: "List commands",
  run: async () => {
    return [
      { type: "typed", text: "Available commands:", speed: 8 },
      { type: "text", text: "about        - info about Matty Katos", muted: true },
      { type: "text", text: "clear        - clear the terminal", muted: true },
      { type: "text", text: "fc           - Info about Eternal Hearth, our FFXIV Free Company", muted: true },
      { type: "text", text: "help         - show this list", muted: true },
      { type: "text", text: "search (arg) - Search the web", muted: true },
    ];
  },
};
