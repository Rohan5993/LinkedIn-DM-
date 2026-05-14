/** LinkedIn profile URLs in pasted text, CSV/TSV, or spreadsheet exports. */

const RE_WITH_SCHEME =
  /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/in\/(?:[\w-]|%[0-9A-Fa-f]{2})+\/?/gi;

const RE_BARE_PATH =
  /(?:^|[\s,"'<>[\]()]|;)(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([\w-]+)/gi;

function stripTrailingJunk(href: string): string {
  return href.replace(/[.,;)\]]+$/u, "");
}

function normalizeProfileUrl(href: string): string | null {
  const trimmed = stripTrailingJunk(href.trim());
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = u.hostname.toLowerCase();
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;
    u.hash = "";
    u.search = "";
    const path = u.pathname.replace(/\/+$/u, "") || u.pathname;
    const m = path.match(/^\/in\/([^/]+)$/iu);
    if (!m?.[1]) return null;
    return `https://www.linkedin.com/in/${m[1]}`;
  } catch {
    return null;
  }
}

export function extractLinkedinProfileUrls(source: string): string[] {
  const found = new Set<string>();
  if (!source || typeof source !== "string") return [];

  let m: RegExpExecArray | null;
  while ((m = RE_WITH_SCHEME.exec(source)) !== null) {
    const n = normalizeProfileUrl(m[0]);
    if (n) found.add(n);
  }

  RE_BARE_PATH.lastIndex = 0;
  while ((m = RE_BARE_PATH.exec(source)) !== null) {
    const slug = m[1];
    if (slug) {
      const n = normalizeProfileUrl(`https://www.linkedin.com/in/${slug}`);
      if (n) found.add(n);
    }
  }

  return [...found];
}

export function mergeUniqueProfileUrls(...groups: string[][]): string[] {
  const s = new Set<string>();
  for (const g of groups) {
    for (const u of g) {
      const n = normalizeProfileUrl(u);
      if (n) s.add(n);
    }
  }
  return [...s];
}
