export default {
  name: "search",
  description: "Search DuckDuckGo",
  run: async ({ argsText }) => {
    const query = (argsText ?? "").trim();

    if (!query) {
      return [
        { type: "typed", text: "Usage:", speed: 10 },
        { type: "text", text: "search <query with spaces allowed>", muted: true },
      ];
    }

    const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;

    return [
      { type: "typed", text: `Searching DDG for: ${query}`, speed: 10 },
      { type: "open", href: url },
    ];
  },
};
