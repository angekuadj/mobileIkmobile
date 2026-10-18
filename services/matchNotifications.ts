import AsyncStorage from '../lib/localStore';
import * as BackgroundFetch from 'expo-background-fetch';
import * as FileSystem from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { initializeLanguagePreference } from '../lib/localization';
import { FAVORITES_STORAGE_KEY, parseFavorites, type FavoriteAlertKey, type FavoriteMatch } from '../context/FavoritesContext';
import {
  MATCH_EVENT_NAMES,
  MATCH_EVENT_COLORS,
  cardNotificationBody,
  finishedNotificationBody,
  goalNotificationBody,
  kickoffNotificationBody,
  matchNotificationTitle,
  notificationTestSamples,
  type MatchNotificationSample,
} from '../lib/matchNotificationText';
import { fetchFixtureStatuses, type Fixture } from '../lib/fixtures';
import {
  MATCH_ALERT_CHANNEL_ID,
  MATCH_NOTIFICATION_SOUND,
  requestLocalNotificationPermission,
} from './localNotifications';
import { checkSavedCombinationEvents, hasSavedCombinations } from './combinationNotifications';

export { notificationTestSamples, type MatchNotificationSample };

const BACKGROUND_TASK = 'ikprono-match-event-notifications';
const SNAPSHOT_KEY = '@ikprono_match_notification_snapshots_v1';
const CHECK_INTERVAL_SECONDS = 15 * 60;
const TEST_CHANNEL_ID = MATCH_ALERT_CHANNEL_ID;
const TEST_MATCH_ID = 'test';
let activeCheck: Promise<boolean> | null = null;

interface NativeGoalNotifications {
  showGoalNotification(
    title: string,
    body: string,
    matchId: string,
    delaySeconds: number,
    scorerName: string,
    scorerMinute: string,
    scorerImageUrl: string,
    color: string
  ): Promise<void>;
}

const nativeGoalNotifications = Platform.OS === 'android'
  ? requireOptionalNativeModule<NativeGoalNotifications>('IKPronoGoalNotifications')
  : null;

async function downloadGoalScorerAttachment(scorer: GoalScorer): Promise<string> {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) throw new Error('Le répertoire temporaire des photos est indisponible.');
  if (!scorer.playerImageUrl?.startsWith('https://images.fotmob.com/')) {
    throw new Error('L’URL de la photo du buteur est invalide.');
  }
  const imageHash = Array.from(scorer.playerImageUrl).reduce((hash, character) =>
    (Math.imul(hash, 31) + character.charCodeAt(0)) | 0, 0
  ).toString(16);
  const localUri = `${cacheDirectory}goal-scorer-${imageHash}.png`;
  const cached = await FileSystem.getInfoAsync(localUri);
  if (cached.exists) return localUri;
  const download = await FileSystem.downloadAsync(scorer.playerImageUrl, localUri);
  if (download.status < 200 || download.status >= 300) {
    throw new Error(`Le téléchargement de la photo du buteur a échoué (HTTP ${download.status}).`);
  }
  return download.uri;
}

type MatchSnapshot = {
  homeScore: number;
  awayScore: number;
  liveTime?: string;
  goalScorers?: string[];
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
  started: boolean;
  finished: boolean;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fixtureScore(fixture: Fixture): [number, number] {
  const home = Number.parseInt(fixture.homeScore || '', 10);
  const away = Number.parseInt(fixture.awayScore || '', 10);
  if (Number.isFinite(home) && Number.isFinite(away)) return [home, away];
  const match = fixture.score?.match(/^\s*(\d+)\s*[-:–]\s*(\d+)\s*$/);
  return match ? [Number(match[1]), Number(match[2])] : [0, 0];
}

function isStarted(status: string | undefined) {
  const normalized = status?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR') || '';
  return ['en direct', 'mi-temps', 'live', 'half-time'].includes(normalized);
}

function isFinished(status: string | undefined) {
  const normalized = status?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR') || '';
  return ['termine', 'finished', 'ft', 'full time'].includes(normalized);
}

function snapshot(fixture: Fixture): MatchSnapshot {
  const [homeScore, awayScore] = fixtureScore(fixture);
  return {
    homeScore,
    awayScore,
    liveTime: fixture.liveTime,
    goalScorers: fixture.goalScorers?.map(goalScorerKey),
    homeYellowCards: fixture.matchStats?.yellowCards?.home || 0,
    awayYellowCards: fixture.matchStats?.yellowCards?.away || 0,
    homeRedCards: fixture.matchStats?.redCards?.home || 0,
    awayRedCards: fixture.matchStats?.redCards?.away || 0,
    started: isStarted(fixture.status),
    finished: isFinished(fixture.status),
  };
}

type GoalScorer = NonNullable<Fixture['goalScorers']>[number];

function goalScorerKey(scorer: GoalScorer): string {
  return `${scorer.side || ''}|${scorer.minute}|${scorer.player}`;
}

function findNewGoalScorers(
  fixture: Fixture,
  previous: MatchSnapshot,
  goalsScored: number
): GoalScorer[] {
  const scorers = fixture.goalScorers || [];
  const previousScorers = previous.goalScorers;
  if (!previousScorers) return scorers.slice(-goalsScored);
  const previousKeys = new Set(previousScorers);
  return scorers.filter(scorer => !previousKeys.has(goalScorerKey(scorer))).slice(-goalsScored);
}

async function schedule(
  title: string,
  body: string,
  matchId: string,
  delaySeconds: number,
  color: string,
  scorer?: GoalScorer
) {
  if (Platform.OS === 'android' && scorer?.playerImageUrl && nativeGoalNotifications) {
    await nativeGoalNotifications.showGoalNotification(
      title,
      body,
      matchId,
      delaySeconds,
      scorer.player,
      String(scorer.minute),
      scorer.playerImageUrl,
      color
    );
    return;
  }
  let scorerAttachment: string | undefined;
  if (Platform.OS === 'ios' && scorer?.playerImageUrl) {
    try {
      scorerAttachment = await downloadGoalScorerAttachment(scorer);
    } catch (error) {
      console.warn('The scorer photo could not be attached to the iOS notification.', error);
    }
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        matchId,
        ...(scorer ? {
          scorer: {
            player: scorer.player,
            minute: scorer.minute,
            ...(scorer.playerImageUrl ? { playerImageUrl: scorer.playerImageUrl } : {}),
          },
        } : {}),
      },
      ...(scorerAttachment ? {
        attachments: [{
          identifier: 'goal-scorer',
          url: scorerAttachment,
          type: 'image/png',
          typeHint: 'public.png',
        }],
      } : {}),
      sound: Platform.OS === 'ios' ? MATCH_NOTIFICATION_SOUND : true,
      color,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, delaySeconds),
      channelId: TEST_CHANNEL_ID,
    },
  });
}

async function notify(
  favorite: FavoriteMatch,
  key: FavoriteAlertKey,
  body: string,
  liveTime?: string,
  scorer?: GoalScorer
) {
  if (!favorite.alerts[key]) return;
  await schedule(
    matchNotificationTitle(key, liveTime),
    body,
    favorite.fixture.id,
    1,
    MATCH_EVENT_COLORS[key],
    scorer
  );
}

async function readStored<T>(key: string, fallback: T): Promise<T> {
  const value = await AsyncStorage.getItem(key);
  if (!value) return fallback;
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed)) throw new Error(`Le stockage des notifications est invalide (${key}).`);
  return parsed as T;
}

async function checkFavoriteEvents(): Promise<boolean> {
  await initializeLanguagePreference();
  if (activeCheck) return activeCheck;
  activeCheck = checkFavoriteEventsOnce().finally(() => {
    activeCheck = null;
  });
  return activeCheck;
}

async function checkFavoriteEventsOnce(): Promise<boolean> {
  const rawFavorites = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
  let favorites: FavoriteMatch[];
  try {
    favorites = rawFavorites ? parseFavorites(rawFavorites) : [];
  } catch {
    throw new Error('La liste des favoris est invalide ; les notifications de match ne peuvent pas être vérifiées.');
  }
  const activeFavorites = favorites.filter(favorite => Object.values(favorite.alerts).some(Boolean));
  let hasNewData = false;
  if (activeFavorites.length > 0) {
    const previousSnapshots = await readStored<Record<string, MatchSnapshot>>(SNAPSHOT_KEY, {});
    const latestFixtures: Fixture[] = [];
    for (let offset = 0; offset < activeFavorites.length; offset += 10) {
      const ids = activeFavorites.slice(offset, offset + 10).map(favorite => favorite.fixture.id);
      latestFixtures.push(...await fetchFixtureStatuses(ids));
    }

    const fixturesById = new Map(latestFixtures.map(fixture => [fixture.id, fixture]));
    const nextSnapshots: Record<string, MatchSnapshot> = {};
    for (const favorite of activeFavorites) {
      const fixture = fixturesById.get(favorite.fixture.id);
      if (!fixture) continue;
      const current = snapshot(fixture);
      const previous = previousSnapshots[fixture.id];
      if (previous) {
        const homeGoals = Math.max(0, current.homeScore - (previous.homeScore || 0));
        const awayGoals = Math.max(0, current.awayScore - (previous.awayScore || 0));
        const homeYellows = Math.max(0, current.homeYellowCards - (previous.homeYellowCards || 0));
        const awayYellows = Math.max(0, current.awayYellowCards - (previous.awayYellowCards || 0));
        const homeReds = Math.max(0, current.homeRedCards - (previous.homeRedCards || 0));
        const awayReds = Math.max(0, current.awayRedCards - (previous.awayRedCards || 0));
        if (!previous.started && current.started) {
          await notify(
            favorite,
            'kickoff',
            kickoffNotificationBody(fixture.homeTeam, fixture.awayTeam),
            current.liveTime
          );
          hasNewData = true;
        }
        if (homeGoals + awayGoals > 0) {
          const scorers = findNewGoalScorers(fixture, previous, homeGoals + awayGoals);
          await notify(
            favorite,
            'goal',
            goalNotificationBody(
              fixture.homeTeam,
              fixture.awayTeam,
              homeGoals,
              awayGoals,
              current.homeScore,
              current.awayScore,
              scorers.map(scorer => scorer.player)
            ),
            current.liveTime,
            scorers[0]
          );
          hasNewData = true;
        }
        if (homeYellows + awayYellows > 0) {
          await notify(
            favorite,
            'yellowCard',
            cardNotificationBody(
              fixture.homeTeam,
              fixture.awayTeam,
              homeYellows,
              awayYellows,
              'jaune',
              current.homeScore,
              current.awayScore
            ),
            current.liveTime
          );
          hasNewData = true;
        }
        if (homeReds + awayReds > 0) {
          await notify(
            favorite,
            'redCard',
            cardNotificationBody(
              fixture.homeTeam,
              fixture.awayTeam,
              homeReds,
              awayReds,
              'rouge',
              current.homeScore,
              current.awayScore
            ),
            current.liveTime
          );
          hasNewData = true;
        }
        if (!previous.finished && current.finished) {
          await notify(
            favorite,
            'finished',
            finishedNotificationBody(fixture.homeTeam, fixture.awayTeam, current.homeScore, current.awayScore)
          );
          hasNewData = true;
        }
      }
      nextSnapshots[fixture.id] = current;
    }
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(nextSnapshots));
  }
  const hasCombinationUpdates = await checkSavedCombinationEvents();
  return hasNewData || hasCombinationUpdates;
}

TaskManager.defineTask(BACKGROUND_TASK, async ({ error }) => {
  if (error) {
    console.error('Background match notification task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
  try {
    const hasNewData = await checkFavoriteEvents();
    return hasNewData ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (taskError) {
    console.error('Unable to check favorite match events in background:', taskError);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function requestMatchNotificationPermission(): Promise<boolean> {
  return requestLocalNotificationPermission();
}

export async function syncBackgroundMatchNotifications(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  const permission = enabled ? true : (await Notifications.getPermissionsAsync()).granted;
  const shouldRemainEnabled = permission && (enabled || await hasSavedCombinations());
  const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK);
  if (!shouldRemainEnabled) {
    if (registered) await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TASK);
    return;
  }
  if (registered) return;
  const status = await BackgroundFetch.getStatusAsync();
  if (status !== BackgroundFetch.BackgroundFetchStatus.Available) {
    throw new Error('Les mises à jour en arrière-plan ne sont pas autorisées sur cet appareil.');
  }
  await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK, {
    minimumInterval: CHECK_INTERVAL_SECONDS,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

export async function checkFavoriteMatchNotifications(): Promise<boolean> {
  return checkFavoriteEvents();
}

export function notificationAlertLabels(): Array<{ key: FavoriteAlertKey; label: string }> {
  return (Object.keys(MATCH_EVENT_NAMES) as FavoriteAlertKey[]).map(key => ({
    key,
    label: MATCH_EVENT_NAMES[key],
  }));
}

/**
 * Sends the sample notifications as real local notifications, one every two
 * seconds, using the same channel and wording as the live match alerts.
 * Returns false when the notification permission is missing.
 */
export async function sendMatchNotificationTests(keys?: FavoriteAlertKey[]): Promise<boolean> {
  await initializeLanguagePreference();
  if (Platform.OS === 'web') return false;
  const granted = await requestMatchNotificationPermission();
  if (!granted) return false;
  const samples = notificationTestSamples().filter(sample => !keys || keys.includes(sample.key));
  let delaySeconds = 1;
  for (const sample of samples) {
    await schedule(sample.title, sample.body, TEST_MATCH_ID, delaySeconds, sample.color, sample.scorer);
    delaySeconds += 2;
  }
  return true;
}
