/** Replace em/en dashes with comma + space for outbound copy. */
export function preferCommaOverLongDash(s: string): string {
  return s
    .replace(/\u2014/g, ", ")
    .replace(/\u2013/g, ", ")
    .replace(/,(\s*,)+/g, ", ")
    .trim();
}
