export const meta = (title: string, description: string) => ({
  meta: [
    { title: `${title} — Amani Eye` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — Amani Eye` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
