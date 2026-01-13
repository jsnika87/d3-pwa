// src/lib/d3Content.ts
import d3 from "../../content/d3_discipleship.json";

export type D3Week = {
  week: number;
  title: string;
  readings: string[];
  memoryVerse: string;
};

export type D3Program = {
  program: string;
  weeks: D3Week[];
};

const program = d3 as D3Program;

export function getWeekContent(weekNumber: number): D3Week | null {
  return program.weeks.find((w) => w.week === weekNumber) ?? null;
}

export function getMaxWeek(): number {
  return Math.max(...program.weeks.map((w) => w.week));
}

export function readingToUrl(reading: string): string {
  // Clickable YouVersion/Bible.com search link (works with any reference text)
  const q = encodeURIComponent(reading);
  return `https://www.bible.com/search/bible?q=${q}`;
}