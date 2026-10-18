import AsyncStorage from '../lib/localStore';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { GENERATED_COMBINATIONS_STORAGE_KEY, type CouponMatch, type GeneratedCoupon, type StoredGeneratedCombination } from '../lib/coupons';
import { getMatchOutcome, type CombinationOutcome } from '../lib/combinationOutcome';
import { fetchFixtureStatuses, type Fixture } from '../lib/fixtures';
import { initializeLanguagePreference, translateText } from '../lib/localization';
import { MATCH_ALERT_CHANNEL_ID, MATCH_NOTIFICATION_SOUND, requestLocalNotificationPermission } from './localNotifications';

const OUTCOMES_STORAGE_KEY = '@ikprono_combination_notification_outcomes_v1';
const COMBINATION_ROUTE = 'saved-combinations';

type OutcomeSnapshot = Record<string, CombinationOutcome>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCouponMatch(value: unknown): value is CouponMatch {
  return isRecord(value)
    && typeof value.fixtureId === 'string'
    && typeof value.homeTeam === 'string'
    && typeof value.awayTeam === 'string'
    && Array.isArray(value.picks)
    && value.picks.every(pick => isRecord(pick)
      && (pick.market === 'result' || pick.market === 'goals')
      && (pick.selection === null || typeof pick.selection === 'string')
      && (pick.historicalRate === null || typeof pick.historicalRate === 'number')
      && typeof pick.sampleSize === 'number');
}

function isStoredCombination(value: unknown): value is StoredGeneratedCombination {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.createdAt === 'string'
    && isRecord(value.coupon)
    && typeof value.coupon.title === 'string'
    && typeof value.coupon.description === 'string'
    && typeof value.coupon.level === 'string'
    && Array.isArray(value.coupon.matches)
    && value.coupon.matches.every(isCouponMatch);
}

function parseCombinations(raw: string | null): StoredGeneratedCombination[] {
  const parsed: unknown = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(parsed) || !parsed.every(isStoredCombination)) {
    throw new Error('Les combinaisons enregistrées contiennent des données invalides.');
  }
  return parsed;
}

async function readOutcomes(): Promise<OutcomeSnapshot> {
  const raw = await AsyncStorage.getItem(OUTCOMES_STORAGE_KEY);
  if (raw === null) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || Object.values(parsed).some(value =>
    value !== 'pending' && value !== 'won' && value !== 'lost'
  )) {
    throw new Error('Le suivi des notifications de combinaisons est invalide.');
  }
  return parsed as OutcomeSnapshot;
}

function matchOutcomeKey(combinationId: string, fixtureId: string): string {
  return `${combinationId}:match:${fixtureId}`;
}

function combinationOutcomeKey(combinationId: string): string {
  return `${combinationId}:overall`;
}

function scheduleCombinationNotification(title: string, body: string, combinationId: string): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: Platform.OS === 'ios' ? MATCH_NOTIFICATION_SOUND : true,
      data: { combinationId, notificationRoute: COMBINATION_ROUTE },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      channelId: MATCH_ALERT_CHANNEL_ID,
    },
  });
}

export async function notifyCombinationsGenerated(count: number): Promise<boolean> {
  await initializeLanguagePreference();
  if (!Number.isInteger(count) || count < 1) throw new Error('Le nombre de combinaisons générées est invalide.');
  if (!await requestLocalNotificationPermission()) return false;
  await scheduleCombinationNotification(
    translateText(count === 1 ? 'Combinaison générée' : 'Combinaisons générées'),
    translateText(`${count} ${count === 1 ? 'combinaison prête à consulter.' : 'combinaisons prêtes à consulter.'} Enregistrez une combinaison pour suivre ses résultats.`),
    'generated'
  );
  return true;
}

export async function notifyCombinationSaved(combination: StoredGeneratedCombination): Promise<boolean> {
  await initializeLanguagePreference();
  if (!isStoredCombination(combination)) throw new Error('La combinaison enregistrée est invalide.');
  if (!await requestLocalNotificationPermission()) return false;
  await scheduleCombinationNotification(
    translateText('Combinaison enregistrée'),
    `${combination.coupon.title} · ${translateText('le suivi des résultats est activé.')}`,
    combination.id
  );
  return true;
}

export async function hasSavedCombinations(): Promise<boolean> {
  return parseCombinations(await AsyncStorage.getItem(GENERATED_COMBINATIONS_STORAGE_KEY)).length > 0;
}

export async function trackSavedCombination(combination: StoredGeneratedCombination): Promise<void> {
  if (!isStoredCombination(combination)) throw new Error('La combinaison enregistrée est invalide.');
  const outcomes = await readOutcomes();
  for (const match of combination.coupon.matches) {
    outcomes[matchOutcomeKey(combination.id, match.fixtureId)] = 'pending';
  }
  outcomes[combinationOutcomeKey(combination.id)] = 'pending';
  await AsyncStorage.setItem(OUTCOMES_STORAGE_KEY, JSON.stringify(outcomes));
}

function matchNotificationText(match: CouponMatch, fixture: Fixture, outcome: CombinationOutcome): string {
  const score = fixture.homeScore && fixture.awayScore
    ? `${fixture.homeScore}–${fixture.awayScore}`
    : fixture.score || 'score indisponible';
  const verdict = outcome === 'won' ? 'Pronostic validé' : 'Pronostic non validé';
  return `${match.homeTeam} ${score} ${match.awayTeam}\n${translateText(verdict)} ${translateText('dans la combinaison.')}`;
}

export async function checkSavedCombinationEvents(): Promise<boolean> {
  await initializeLanguagePreference();
  const combinations = parseCombinations(await AsyncStorage.getItem(GENERATED_COMBINATIONS_STORAGE_KEY));
  if (combinations.length === 0) {
    await AsyncStorage.setItem(OUTCOMES_STORAGE_KEY, JSON.stringify({}));
    return false;
  }
  const outcomes = await readOutcomes();
  const fixtureIds = [...new Set(combinations.flatMap(combination =>
    combination.coupon.matches
      .filter(match => outcomes[matchOutcomeKey(combination.id, match.fixtureId)] !== 'won'
        && outcomes[matchOutcomeKey(combination.id, match.fixtureId)] !== 'lost')
      .map(match => match.fixtureId)
  ))];

  const latestFixtures: Fixture[] = [];
  for (let offset = 0; offset < fixtureIds.length; offset += 100) {
    latestFixtures.push(...await fetchFixtureStatuses(fixtureIds.slice(offset, offset + 100)));
  }
  const fixturesById = new Map(latestFixtures.map(fixture => [fixture.id, fixture]));
  const activeKeys = new Set<string>();
  let hasNewData = false;
  let permission: boolean | null = null;

  for (const combination of combinations) {
    const currentMatchOutcomes: CombinationOutcome[] = [];
    for (const match of combination.coupon.matches) {
      const key = matchOutcomeKey(combination.id, match.fixtureId);
      activeKeys.add(key);
      const fixture = fixturesById.get(match.fixtureId);
      const previous = outcomes[key];
      const current = previous && previous !== 'pending'
        ? previous
        : getMatchOutcome(match, fixture);
      currentMatchOutcomes.push(current);
      if (previous === undefined) {
        outcomes[key] = current;
      } else if (previous === 'pending' && current !== 'pending') {
        if (permission === null) {
          const currentPermission = await Notifications.getPermissionsAsync();
          permission = currentPermission.granted;
        }
        if (permission) {
          if (!fixture) throw new Error(`La rencontre ${match.fixtureId} a disparu pendant son suivi.`);
          await scheduleCombinationNotification(
            translateText(current === 'won' ? 'Pronostic validé' : 'Pronostic non validé'),
            matchNotificationText(match, fixture, current),
            combination.id
          );
          outcomes[key] = current;
          await AsyncStorage.setItem(OUTCOMES_STORAGE_KEY, JSON.stringify(outcomes));
          hasNewData = true;
        }
      } else if (previous !== current && current !== 'pending') {
        outcomes[key] = current;
      }
    }
    const overallKey = combinationOutcomeKey(combination.id);
    activeKeys.add(overallKey);
    const currentOverall = currentMatchOutcomes.some(outcome => outcome === 'lost')
      ? 'lost'
      : currentMatchOutcomes.length > 0 && currentMatchOutcomes.every(outcome => outcome === 'won')
        ? 'won'
        : 'pending';
    const previousOverall = outcomes[overallKey];
    if (previousOverall === undefined) {
      outcomes[overallKey] = currentOverall;
    } else if (previousOverall === 'pending' && currentOverall !== 'pending') {
      if (permission === null) {
        const currentPermission = await Notifications.getPermissionsAsync();
        permission = currentPermission.granted;
      }
      if (permission) {
        await scheduleCombinationNotification(
          translateText(currentOverall === 'won' ? 'Combinaison validée' : 'Combinaison non validée'),
          `${combination.coupon.title} · ${translateText(currentOverall === 'won' ? 'tous les pronostics sont validés.' : 'au moins un pronostic n’est pas validé.')}`,
          combination.id
        );
        outcomes[overallKey] = currentOverall;
        await AsyncStorage.setItem(OUTCOMES_STORAGE_KEY, JSON.stringify(outcomes));
        hasNewData = true;
      }
    } else if (previousOverall !== currentOverall && currentOverall !== 'pending') {
      outcomes[overallKey] = currentOverall;
    }
  }

  for (const key of Object.keys(outcomes)) {
    if (!activeKeys.has(key)) delete outcomes[key];
  }
  await AsyncStorage.setItem(OUTCOMES_STORAGE_KEY, JSON.stringify(outcomes));
  return hasNewData;
}
