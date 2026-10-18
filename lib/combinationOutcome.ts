import type { CouponMatch, GeneratedCoupon } from './coupons';
import { getFixtureScore, type Fixture } from './fixtures';

export type CombinationOutcome = 'pending' | 'won' | 'lost';

export function isFixtureFinished(fixture: Fixture | undefined): fixture is Fixture {
  const status = fixture?.status?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ?? '';
  return ['termine', 'finished', 'ft', 'full time'].includes(status);
}

export function getMatchOutcome(
  match: CouponMatch,
  fixture: Fixture | undefined
): CombinationOutcome {
  const score = fixture && isFixtureFinished(fixture) ? getFixtureScore(fixture) : null;
  if (!score || match.picks.length === 0) return 'pending';
  const [home, away] = score.map(value => Number.parseInt(value, 10));
  if (Number.isNaN(home) || Number.isNaN(away)) return 'pending';
  const result = home === away ? 'draw' : home > away ? 'home' : 'away';
  const outcomes = match.picks.map(pick => {
    if (!pick.selection) return null;
    if (pick.market === 'goals') {
      const threshold = Number.parseFloat(pick.selection.replace('over-', ''));
      return Number.isFinite(threshold) ? home + away > threshold : null;
    }
    if (pick.market !== 'result') return null;
    if (pick.selection === 'home-or-draw') return result !== 'away';
    if (pick.selection === 'away-or-draw') return result !== 'home';
    if (pick.selection === 'either-win') return result !== 'draw';
    return pick.selection === result;
  });
  if (outcomes.some(outcome => outcome === false)) return 'lost';
  if (outcomes.length > 0 && outcomes.every(outcome => outcome === true)) return 'won';
  return 'pending';
}

export function getCouponOutcome(
  coupon: GeneratedCoupon,
  fixturesById: Map<string, Fixture>
): CombinationOutcome {
  const outcomes = coupon.matches.map(match =>
    getMatchOutcome(match, fixturesById.get(match.fixtureId))
  );
  if (outcomes.some(outcome => outcome === 'lost')) return 'lost';
  if (outcomes.length > 0 && outcomes.every(outcome => outcome === 'won')) return 'won';
  return 'pending';
}
