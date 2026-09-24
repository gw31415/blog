import type { JSONContent } from "@tiptap/core";
export interface ArticleDraft {
  publishedAt: string;
  title: string;
  subtitle: string;
  body: JSONContent;
  editingState?: Record<string, unknown> | null;
  description: string;
  tags: string[];
}

export const BLOG_NAME = "ブログ名（仮）";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;
const DIGITS = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"] as const;

function parseIsoDate(isoDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`Invalid ISO date: ${isoDate}`);

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }

  return date;
}

function toKanjiNumber(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 99) {
    throw new RangeError(`Unsupported Japanese number: ${value}`);
  }
  if (value < 10) return DIGITS[value];

  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return `${tens === 1 ? "" : DIGITS[tens]}十${ones === 0 ? "" : DIGITS[ones]}`;
}

export function formatJapaneseDate(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  return `${japaneseEraYear(date, isoDate)}　${toKanjiNumber(date.getUTCMonth() + 1)}月${toKanjiNumber(date.getUTCDate())}日　${WEEKDAYS[date.getUTCDay()]}曜日`;
}

export function formatShortDate(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  return `${date.getUTCFullYear()}.${date.getUTCMonth() + 1}.${date.getUTCDate()}`;
}

function japaneseEraYear(date: Date, isoDate: string): string {
  const parts = new Intl.DateTimeFormat("ja-JP-u-ca-japanese", {
    era: "long",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(date);
  const era = parts.find((part) => part.type === "era")?.value;
  const year = parts.find((part) => part.type === "year")?.value;
  if (!era || !year) throw new Error(`Cannot format Japanese era: ${isoDate}`);

  const eraYear = /^\d+$/.test(year) ? toKanjiNumber(Number(year)) : year;
  return `${era}${eraYear}年`;
}

export function formatJapaneseEraYear(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  return `${japaneseEraYear(date, isoDate)} / ${date.getUTCFullYear()}`;
}
