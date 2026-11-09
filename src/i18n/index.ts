import { es, type Dict } from "./es";

const dictionaries: Record<string, Dict> = { es };

export const DEFAULT_LOCALE = "es";

/** Current UI dictionary. Locale switching can be added by reading a stored preference here. */
export function getDict(locale: string = DEFAULT_LOCALE): Dict {
  return dictionaries[locale] ?? es;
}

export const t = getDict();

/** Human label for a free-form interest/skill tag, falling back to the tag itself. */
export function tagLabel(tag: string): string {
  return t.options.interests[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1);
}

/** "a, b y c" */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function errorMessage(code: string | undefined | null): string {
  if (!code) return t.errors.generic;
  return t.errors[code] ?? t.errors.generic;
}

export function formatTime(d: Date | string): string {
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

export function formatDateTime(d: Date | string): string {
  return new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

export function relativeTime(d: Date | string): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (diff < 45) return "ahora";
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  if (diff < 86400 * 7) return rtf.format(-Math.round(diff / 86400), "day");
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(d));
}
