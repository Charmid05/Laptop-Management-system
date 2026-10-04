export const meta = (title: string, description: string) => ({
  meta: [
    { title: `${title} — Laptop Store Manager` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — Laptop Store Manager` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
