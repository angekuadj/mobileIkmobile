import type { FavoriteAlertKey } from '../context/FavoritesContext';
import type { Fixture } from './fixtures';
import { translateText } from './localization';

/** Event labels shown in alert preferences and notification previews. */
export const MATCH_EVENT_NAMES: Record<FavoriteAlertKey, string> = {
  kickoff: 'Coup d’envoi',
  goal: 'But',
  yellowCard: 'Carton jaune',
  redCard: 'Carton rouge',
  finished: 'Match terminé',
};

const MATCH_EVENT_EMOJIS: Record<FavoriteAlertKey, string> = {
  kickoff: '⏱️',
  goal: '⚽',
  yellowCard: '🟨',
  redCard: '🟥',
  finished: '🏁',
};

export const MATCH_EVENT_COLORS: Record<FavoriteAlertKey, string> = {
  kickoff: '#27b9a7',
  goal: '#27b66d',
  yellowCard: '#e3ad35',
  redCard: '#e34d5f',
  finished: '#a947c8',
};

export function matchNotificationTitle(key: FavoriteAlertKey, liveTime?: string): string {
  const suffix = key === 'goal' ? ' !' : '';
  const time = liveTime?.replace(/[\u200e\u200f]/g, '').trim();
  return translateText(`${MATCH_EVENT_EMOJIS[key]} ${MATCH_EVENT_NAMES[key]}${suffix}${time ? ` · ${time}` : ''}`);
}

export function kickoffNotificationBody(homeTeam: string, awayTeam: string): string {
  return translateText(`${homeTeam} – ${awayTeam}\nLe match vient de commencer.`);
}

export function goalNotificationBody(
  homeTeam: string,
  awayTeam: string,
  homeGoals: number,
  awayGoals: number,
  homeScore: number,
  awayScore: number,
  scorerNames: string[] = []
): string {
  const scorerSide = homeGoals && awayGoals
    ? 'Les deux équipes ont marqué.'
    : `${homeGoals ? homeTeam : awayTeam} a marqué${(homeGoals || awayGoals) > 1 ? ` ${homeGoals || awayGoals} buts` : ''}.`;
  const scorerText = scorerNames.length > 0
    ? `⚽ ${scorerNames.join(', ')}${scorerNames.length === 1 ? ' a marqué.' : ' ont marqué.'}`
    : scorerSide;
  return translateText(`${homeTeam}  ${homeScore}–${awayScore}  ${awayTeam}\n${scorerText}`);
}

export function cardNotificationBody(
  homeTeam: string,
  awayTeam: string,
  homeCards: number,
  awayCards: number,
  color: 'jaune' | 'rouge',
  homeScore: number,
  awayScore: number
): string {
  const count = homeCards + awayCards;
  const bothTeams = Boolean(homeCards && awayCards);
  const team = bothTeams ? 'Les deux équipes' : homeCards ? homeTeam : awayTeam;
  const verb = bothTeams ? 'ont reçu' : 'a reçu';
  const card = count > 1 ? `${count} cartons ${color}s` : `un carton ${color}`;
  return translateText(`${homeTeam}  ${homeScore}–${awayScore}  ${awayTeam}\n${team} ${verb} ${card}.`);
}

export function finishedNotificationBody(
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number
): string {
  return translateText(`${homeTeam}  ${homeScore}–${awayScore}  ${awayTeam}\nScore final`);
}

export interface MatchNotificationSample {
  key: FavoriteAlertKey;
  label: string;
  emoji: string;
  color: string;
  title: string;
  body: string;
  scorer?: Pick<NonNullable<Fixture['goalScorers']>[number], 'player' | 'minute' | 'playerImageUrl'>;
}

/** Demo fixture used by the notification test screen and the test notifications. */
export const NOTIFICATION_TEST_FIXTURE: Fixture = {
  id: 'test',
  sport: 'football',
  date: '2026-01-01',
  time: '21:00',
  league: 'Ligue 1',
  competition: 'Ligue 1',
  homeTeam: 'Paris SG',
  awayTeam: 'Marseille',
  liveTime: '67’',
  status: 'En direct',
  homeScore: '1',
  awayScore: '0',
};

/**
 * Builds the exact notifications sent during a live match (same wording as the
 * real alerts) so the user can preview a goal, a card or the final whistle.
 */
export function notificationTestSamples(): MatchNotificationSample[] {
  const { homeTeam, awayTeam } = NOTIFICATION_TEST_FIXTURE;
  return [
    {
      key: 'kickoff',
      label: MATCH_EVENT_NAMES.kickoff,
      emoji: MATCH_EVENT_EMOJIS.kickoff,
      color: MATCH_EVENT_COLORS.kickoff,
      title: matchNotificationTitle('kickoff', '1’'),
      body: kickoffNotificationBody(homeTeam, awayTeam),
    },
    {
      key: 'goal',
      label: MATCH_EVENT_NAMES.goal,
      emoji: MATCH_EVENT_EMOJIS.goal,
      color: MATCH_EVENT_COLORS.goal,
      title: matchNotificationTitle('goal', NOTIFICATION_TEST_FIXTURE.liveTime),
      body: goalNotificationBody(homeTeam, awayTeam, 1, 0, 1, 0, ['Kylian Mbappé']),
      scorer: {
        player: 'Kylian Mbappé',
        minute: NOTIFICATION_TEST_FIXTURE.liveTime || '67’',
        playerImageUrl: 'https://images.fotmob.com/image_resources/playerimages/846761.png',
      },
    },
    {
      key: 'yellowCard',
      label: MATCH_EVENT_NAMES.yellowCard,
      emoji: MATCH_EVENT_EMOJIS.yellowCard,
      color: MATCH_EVENT_COLORS.yellowCard,
      title: matchNotificationTitle('yellowCard', NOTIFICATION_TEST_FIXTURE.liveTime),
      body: cardNotificationBody(homeTeam, awayTeam, 1, 0, 'jaune', 1, 0),
    },
    {
      key: 'redCard',
      label: MATCH_EVENT_NAMES.redCard,
      emoji: MATCH_EVENT_EMOJIS.redCard,
      color: MATCH_EVENT_COLORS.redCard,
      title: matchNotificationTitle('redCard', NOTIFICATION_TEST_FIXTURE.liveTime),
      body: cardNotificationBody(homeTeam, awayTeam, 0, 1, 'rouge', 1, 0),
    },
    {
      key: 'finished',
      label: MATCH_EVENT_NAMES.finished,
      emoji: MATCH_EVENT_EMOJIS.finished,
      color: MATCH_EVENT_COLORS.finished,
      title: matchNotificationTitle('finished'),
      body: finishedNotificationBody(homeTeam, awayTeam, 2, 1),
    },
  ];
}
