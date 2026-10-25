// Escape user input before building a RegExp so search terms are treated as
// literal text instead of executable regular-expression syntax.
export const escapeRegExp = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
