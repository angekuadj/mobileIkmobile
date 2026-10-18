import { fetchFixtureStatuses as fetchFotMobFixtureStatuses, fetchFixtures as fetchFotMobFixtures, fetchLiveFixtures as fetchFotMobLiveFixtures } from './fotmobClient';

export interface Fixture {
  id: string;
  sport: 'football' | 'basketball' | 'tennis';
  date: string;
  time: string;
  league: string;
  location?: string;
  competition?: string;
  homeTeam: string;
  awayTeam: string;
  homeImageUrl?: string;
  awayImageUrl?: string;
  homeScore?: string;
  awayScore?: string;
  score?: string;
  status?: string;
  liveTime?: string;
  goalScorers?: Array<{
    player: string;
    minute: string | number;
    playerImageUrl?: string;
    side?: 'home' | 'away';
  }>;
  pick?: 'home' | 'draw' | 'away';
  matchStats?: {
    corners?: { home: number; away: number };
    yellowCards?: { home: number; away: number };
    redCards?: { home: number; away: number };
  };
  odds?: {
    homeWin: number;
    draw: number;
    awayWin: number;
  };
}

export function getFixtureScore(fixture: Fixture): [string, string] | null {
  const homeScore = fixture.homeScore?.trim();
  const awayScore = fixture.awayScore?.trim();
  if (homeScore && awayScore) return [homeScore, awayScore];

  const scoreMatch = fixture.score?.match(/^\s*(\d+)\s*[-:–]\s*(\d+)\s*$/);
  if (scoreMatch) return [scoreMatch[1], scoreMatch[2]];
  return null;
}

export function isLiveFixtureStatus(status?: string): boolean {
  const normalizedStatus = status?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('fr-FR');
  return normalizedStatus !== undefined
    && ['en direct', 'en live', 'mi-temps', 'live'].includes(normalizedStatus);
}

export async function fetchFixtures(from: string, to: string, signal?: AbortSignal): Promise<Fixture[]> {
  return fetchFotMobFixtures(from, to, signal);
}

export async function fetchLiveFixtures(signal?: AbortSignal, includeStats = true): Promise<Fixture[]> {
  return fetchFotMobLiveFixtures(signal, includeStats);
}

export async function fetchFixtureStatuses(ids: string[], signal?: AbortSignal): Promise<Fixture[]> {
  return fetchFotMobFixtureStatuses(ids, signal);
}

export function getLocalDate(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getPeriodStart(anchor: string, period: 'day' | 'week' | 'month'): string {
  const date = new Date(`${anchor}T00:00:00.000Z`);
  if (period === 'week') {
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  } else if (period === 'month') {
    date.setUTCDate(1);
  }
  return date.toISOString().slice(0, 10);
}

export function getPeriodEnd(start: string, period: 'day' | 'week' | 'month'): string {
  if (period === 'day') return start;
  if (period === 'week') return shiftDate(start, 6);
  const date = new Date(`${start}T00:00:00.000Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

export function formatPeriodLabel(
  start: string,
  end: string,
  period: 'day' | 'week' | 'month',
  locale = 'fr-FR'
): string {
  const firstDate = new Date(`${start}T12:00:00.000Z`);
  const lastDate = new Date(`${end}T12:00:00.000Z`);
  if (period === 'day') {
    return firstDate.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  if (period === 'week') {
    return `${firstDate.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${lastDate.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  return firstDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function isUpcomingFixture(fixture: Fixture): boolean {
  return fixture.status?.trim().toLocaleLowerCase('fr-FR') === 'prévu'
    && fixture.date >= getLocalDate();
}

export function sortFixtures(fixtures: Fixture[]): Fixture[] {
  return [...fixtures].sort((first, second) =>
    `${first.date}T${first.time}`.localeCompare(`${second.date}T${second.time}`)
  );
}
