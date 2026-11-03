export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function withRandomSuffix(slug: string): string {
  return `${slug}-${Math.random().toString(36).slice(2, 7)}`;
}
