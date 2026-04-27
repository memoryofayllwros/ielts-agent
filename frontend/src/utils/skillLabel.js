export function humanizeSkillId(id) {
  if (!id || typeof id !== "string") return id;
  const parts = id.split("_");
  if (parts.length > 2) {
    return parts
      .slice(2)
      .join(" ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return id;
}
