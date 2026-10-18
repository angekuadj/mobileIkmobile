import type { MatchStats } from '../hooks/useMatchStats';
import type { GeneratedCoupon } from './coupons';
import { isLiveFixtureStatus, type Fixture } from './fixtures';

type HistoricalMatch = MatchStats['headToHead'][number] & { team?: string };

interface FotMobDetails {
  fixture: Fixture;
  stats: Map<string, { home: string; away: string }>;
  history: HistoricalMatch[];
}

interface FotMobModule {
  validDate(value: string): boolean;
  loadFotMobDay(date: string, signal?: AbortSignal): Promise<Fixture[]>;
  loadFotMobDateRange(from: string, to: string, signal?: AbortSignal): Promise<Fixture[]>;
  loadFotMobDetails(matchId: string, signal?: AbortSignal, includeStandings?: boolean): Promise<FotMobDetails>;
  statsResponse(details: FotMobDetails): MatchStats;
}

interface CouponModule {
  buildCoupon(
    fixtures: Fixture[],
    details: FotMobDetails[],
    riskLevel: RiskLevel,
    couponCount: number,
    regenerate: boolean,
  ): GeneratedCoupon[];
  buildAutomaticCoupon(
    candidates: Array<{ fixture: Fixture; details: FotMobDetails }>,
    count: number,
    riskLevel: RiskLevel,
    excludeFixtureIds?: string[],
    randomize?: boolean,
  ): GeneratedCoupon;
  isRiskLevel(value: unknown): value is RiskLevel;
}

type RiskLevel = 'very-safe' | 'safe' | 'medium' | 'bold' | 'very-risky';

declare const require: (path: string) => unknown;

const fotMob = require('../server/fotmob.cjs') as FotMobModule;
const coupons = require('../server/coupons.cjs') as CouponModule;

async function mapInBatches<T, R>(
  values: T[],
  batchSize: number,
  callback: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < values.length; index += batchSize) {
    results.push(...await Promise.all(values.slice(index, index + batchSize).map(callback)));
  }
  return results;
}

function attachCardStats(fixture: Fixture, details: FotMobDetails): Fixture {
  const events = fotMob.statsResponse(details).events;
  const goalScorers = events
    .filter(event => /goal|but/i.test(event.type) && event.player.trim() && event.player !== event.type)
    .map(event => ({
      player: event.player,
      minute: event.minute,
      ...(event.playerImageUrl ? { playerImageUrl: event.playerImageUrl } : {}),
      ...(event.side ? { side: event.side } : {}),
    }));
  const count = (label: string) => {
    const values = details.stats.get(label);
    return values ? {
      home: Number.parseInt(values.home, 10) || 0,
      away: Number.parseInt(values.away, 10) || 0,
    } : undefined;
  };
  const yellowCards = count('yellow cards');
  const redCards = count('red cards');
  const corners = count('corners');
  const matchStats = {
    ...(yellowCards ? { yellowCards } : {}),
    ...(redCards ? { redCards } : {}),
    ...(corners ? { corners } : {}),
  };
  return {
    ...fixture,
    ...(goalScorers.length > 0 ? { goalScorers } : {}),
    ...(Object.keys(matchStats).length > 0 ? { matchStats } : {}),
  };
}

export async function fetchFixtures(from: string, to: string, signal?: AbortSignal): Promise<Fixture[]> {
  return fotMob.loadFotMobDateRange(from, to, signal);
}

export async function fetchLiveFixtures(signal?: AbortSignal, includeStats = true): Promise<Fixture[]> {
  const today = new Date().toISOString().slice(0, 10);
  const fixtures = await fotMob.loadFotMobDay(today, signal);
  const liveFixtures = fixtures.filter(fixture => fixture.status === 'En direct');
  if (!includeStats) return liveFixtures;
  const details = await mapInBatches(liveFixtures, 5, async fixture => {
    try {
      return { fixture, details: await fotMob.loadFotMobDetails(fixture.id, signal, false) };
    } catch (error) {
      if (signal?.aborted) throw error;
      console.error(`Could not load FotMob details for match ${fixture.id}.`, error);
      return null;
    }
  });
  const statsById = new Map(
    details.filter((item): item is NonNullable<typeof item> => item !== null)
      .map(({ fixture, details: matchDetails }) => [fixture.id, attachCardStats(fixture, matchDetails)])
  );
  return liveFixtures.map(fixture => statsById.get(fixture.id) || fixture);
}

export async function fetchFixtureStatuses(ids: string[], signal?: AbortSignal): Promise<Fixture[]> {
  if (ids.length < 1 || ids.length > 100 || new Set(ids).size !== ids.length
    || ids.some(id => !/^\d{1,20}$/.test(id))) {
    throw new Error('Choisissez entre une et cent rencontres FotMob uniques à actualiser.');
  }
  const details = await mapInBatches(ids, 5, id => fotMob.loadFotMobDetails(id, signal));
  return details.map(item => attachCardStats(item.fixture, item));
}

export async function fetchMatchStats(matchId: string, signal?: AbortSignal): Promise<MatchStats> {
  return fotMob.statsResponse(await fotMob.loadFotMobDetails(matchId, signal));
}

export async function suggestCoupons(
  fixtureIds: string[],
  riskLevel: RiskLevel,
  couponCount: number,
  regenerate: boolean,
  includeLive = false,
): Promise<GeneratedCoupon[]> {
  if (fixtureIds.length < 1 || fixtureIds.length > 20
    || fixtureIds.some(id => !/^\d{1,20}$/.test(id))
    || new Set(fixtureIds).size !== fixtureIds.length) {
    throw new Error('Choisissez entre une et vingt rencontres FotMob différentes.');
  }
  if (!coupons.isRiskLevel(riskLevel) || !Number.isInteger(couponCount) || couponCount < 1 || couponCount > 50) {
    throw new Error('Le niveau de risque ou le nombre de combinaisons est invalide.');
  }
  const details = await mapInBatches(fixtureIds, 5, id => fotMob.loadFotMobDetails(id));
  const today = new Date().toISOString().slice(0, 10);
  if (details.some(({ fixture }) => fixture.date < today
    || (fixture.status !== 'Prévu' && !(includeLive && isLiveFixtureStatus(fixture.status))))) {
    throw new Error('Les combinaisons nécessitent des rencontres à venir ou, si activé, en direct.');
  }
  return coupons.buildCoupon(details.map(item => item.fixture), details, riskLevel, couponCount, regenerate);
}

export async function suggestAutomaticCoupon(
  from: string,
  count: number,
  riskLevel: RiskLevel,
  excludeFixtureIds: string[] = [],
  includeLive = false,
  randomize = false,
): Promise<GeneratedCoupon> {
  if (!fotMob.validDate(from) || !Number.isInteger(count) || count < 1 || count > 20
    || !coupons.isRiskLevel(riskLevel)
    || !excludeFixtureIds.every(id => typeof id === 'string' && id.length > 0)) {
    throw new Error('La date, le nombre de rencontres ou le niveau de risque est invalide.');
  }
  const today = new Date().toISOString().slice(0, 10);
  if (from < today) throw new Error('La date de début doit être aujourd’hui ou ultérieure.');
  const throughDate = new Date(`${from}T00:00:00.000Z`);
  throughDate.setUTCDate(throughDate.getUTCDate() + 6);
  const fixtures = (await fotMob.loadFotMobDateRange(from, throughDate.toISOString().slice(0, 10)))
    .filter(fixture => fixture.date >= today
      && (fixture.status === 'Prévu' || (includeLive && fixture.date === today && isLiveFixtureStatus(fixture.status))))
    .slice(0, Math.min(100, Math.max(20, count * 4)));
  const candidates = await mapInBatches(fixtures, 5, async fixture => {
    try {
      return { fixture, details: await fotMob.loadFotMobDetails(fixture.id) };
    } catch (error) {
      console.error(`Could not load FotMob details for match ${fixture.id}.`, error);
      return null;
    }
  });
  return coupons.buildAutomaticCoupon(
    candidates.filter((item): item is NonNullable<typeof item> => item !== null),
    count,
    riskLevel,
    excludeFixtureIds,
    randomize,
  );
}
