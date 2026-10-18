import { useMemo } from 'react';
import { StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMatchStats, type MatchStats } from '../../hooks/useMatchStats';
import { useMatchLiveAlerts } from '../../hooks/useMatchLiveAlerts';
import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../lib/theme';
import FotMobAvatar from '../../components/FotMobAvatar';
import { useFavorites } from '../../context/FavoritesContext';
import { isLiveFixtureStatus, type Fixture } from '../../lib/fixtures';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../../lib/localization';
import { LocalizedView as View, LocalizedTouchableOpacity as TouchableOpacity } from '../../lib/localization';
import { LocalizedAlert as Alert } from '../../lib/localization';
import { useLanguage } from '../../lib/localization';

function eventMinuteValue(minute: number | string): number {
  const value = String(minute).match(/\d+/)?.[0];
  return value ? Number.parseInt(value, 10) : 0;
}

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

function buildFixture(stats: MatchStats): Fixture {
  return {
    id: stats.fixtureId,
    sport: 'football',
    date: stats.date,
    time: '',
    league: stats.competition,
    homeTeam: stats.homeTeam,
    awayTeam: stats.awayTeam,
    ...(stats.homeImageUrl ? { homeImageUrl: stats.homeImageUrl } : {}),
    ...(stats.awayImageUrl ? { awayImageUrl: stats.awayImageUrl } : {}),
    ...(stats.homeScore === undefined ? {} : { homeScore: String(stats.homeScore) }),
    ...(stats.awayScore === undefined ? {} : { awayScore: String(stats.awayScore) }),
    status: stats.status,
  };
}

export default function MatchDetailScreen() {
  const { theme } = useTheme();
  const { language, t } = useLanguage();
  const dateLocale = language === 'fr' ? 'fr-FR' : 'en-US';
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const favorites = useFavorites();
  const { stats, isLoading, error, refetch } = useMatchStats(id as string);
  const liveAlerts = useMatchLiveAlerts(stats ? buildFixture(stats) : null);
  const [activeTab, setActiveTab] = useState<'resume' | 'lineups' | 'stats' | 'h2h'>('resume');
  const [showAllHeadToHead, setShowAllHeadToHead] = useState(false);
  const [eventQuery, setEventQuery] = useState('');
  const timelineEvents = useMemo(() => {
    if (!stats) return [];
    let homeScore = 0;
    let awayScore = 0;
    return stats.events
      .map((event, index) => ({ event, index }))
      .sort((first, second) =>
        eventMinuteValue(first.event.minute) - eventMinuteValue(second.event.minute) || first.index - second.index
      )
      .map(({ event, index }) => {
        const isGoal = /goal|but/i.test(`${event.type} ${event.detail || ''}`);
        if (isGoal && event.side === 'home') homeScore += 1;
        if (isGoal && event.side === 'away') awayScore += 1;
        return { event, index, isGoal, scoreAfter: `${homeScore}–${awayScore}` };
      });
  }, [stats?.events]);
  const visibleTimelineEvents = useMemo(() => {
    const query = normalizeSearch(eventQuery.trim());
    if (!query || !stats) return timelineEvents;
    return timelineEvents.filter(({ event }) =>
      normalizeSearch([
        event.player,
        event.type,
        event.detail || '',
        event.playerIn || '',
        event.playerOut || '',
        event.side === 'home' ? stats.homeTeam : event.side === 'away' ? stats.awayTeam : '',
      ].join(' ')).includes(query)
    );
  }, [eventQuery, stats, timelineEvents]);

  const renderForm = (form: string) => {
    const matches = form.split('·');
    return (
      <View style={styles.formContainer}>
        {matches.map((match, index) => {
          const [result, score] = match.trim().split(' ');
          return (
            <View key={index} style={[
              styles.formItem,
              result === 'W' && styles.formWin,
              result === 'D' && styles.formDraw,
              result === 'L' && styles.formLoss
            ]}>
              <Text style={styles.formText}>{score}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderStatRow = (
    label: string,
    values?: { home: number | string; away: number | string },
    suffix = ''
  ) => values ? (
    <View style={styles.statRow}>
      <Text style={styles.statValue}>{`${values.home}${suffix}`}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{`${values.away}${suffix}`}</Text>
    </View>
  ) : null;

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (error || !stats) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Données non disponibles'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const favoriteFixture: Fixture = buildFixture(stats);
  const isFavorite = favorites.isFavorite(stats.fixtureId);
  const hasAnyStats = (...values: unknown[]) => values.some(value => value !== undefined && value !== null);
  const live = isLiveFixtureStatus(stats.status);
  const eventRedCardCount = (side: 'home' | 'away') => stats.events.filter(event =>
    event.side === side && /card|carton/i.test(`${event.type} ${event.detail || ''}`)
    && /red|rouge/i.test(`${event.type} ${event.detail || ''}`)
  ).length;
  const homeRedCardCount = Math.max(Number(stats.redCards?.home) || 0, eventRedCardCount('home'));
  const awayRedCardCount = Math.max(Number(stats.redCards?.away) || 0, eventRedCardCount('away'));
  const homeHasRedCard = homeRedCardCount > 0;
  const awayHasRedCard = awayRedCardCount > 0;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <Text style={styles.backIconText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} translate={false}>
          {stats.homeTeam} vs {stats.awayTeam}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={liveAlerts.enabled ? 'Désactiver les notifications en direct' : 'Recevoir les notifications en direct de ce match'}
            accessibilityState={{ selected: liveAlerts.enabled, disabled: liveAlerts.isBusy }}
            disabled={liveAlerts.isBusy}
            onPress={() => { liveAlerts.toggle(); }}
            style={styles.favoriteButton}
          >
            <MaterialIcons
              name={liveAlerts.enabled ? 'notifications-active' : 'notifications-none'}
              size={20}
              color={liveAlerts.enabled ? theme.primary : theme.muted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            onPress={() => {
              void favorites.toggleFavorite(favoriteFixture).then(result => {
                if (result === 'limit') Alert.alert('Limite de favoris atteinte', 'Vous pouvez suivre jusqu’à 30 rencontres.');
              }).catch(favoriteError => Alert.alert('Erreur', favoriteError instanceof Error ? favoriteError.message : 'Impossible de modifier les favoris.'));
            }}
            style={styles.favoriteButton}
          >
            <Text style={[styles.favoriteIcon, isFavorite && styles.favoriteIconSelected]}>{isFavorite ? '♥' : '♡'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Match Info */}
      <View style={styles.matchInfoCard}>
        <Text style={styles.competition} translate={false}>{stats.competition}</Text>
        <Text style={styles.matchDate}>
          {new Date(stats.date).toLocaleDateString(dateLocale, {
            weekday: 'long', 
            day: 'numeric', 
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
        <View style={styles.scoreContainer}>
          <View style={styles.teamScoreGroup}>
            <FotMobAvatar imageUrl={stats.homeImageUrl} name={stats.homeTeam} size={42} />
            <View style={styles.teamScoreNameRow}>
              {homeHasRedCard && (
                <View style={styles.redCardBadge} accessibilityLabel={`${homeRedCardCount} ${t(homeRedCardCount > 1 ? 'Cartons rouges' : 'Carton rouge')}`}>
                  <Text style={styles.redCardIcon}>🟥</Text>
                  <Text style={styles.redCardCount}>{homeRedCardCount}</Text>
                </View>
              )}
              <Text style={styles.teamScore} translate={false}>{stats.homeTeam}</Text>
            </View>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.score}>
              {stats.homeScore ?? '-'} - {stats.awayScore ?? '-'}
            </Text>
            <Text style={[styles.matchStatus, live && styles.liveStatus]} translate={false}>{live ? stats.liveTime || 'En direct' : stats.status}</Text>
          </View>
          <View style={styles.teamScoreGroup}>
            <FotMobAvatar imageUrl={stats.awayImageUrl} name={stats.awayTeam} size={42} />
            <View style={styles.teamScoreNameRow}>
              {awayHasRedCard && (
                <View style={styles.redCardBadge} accessibilityLabel={`${awayRedCardCount} ${t(awayRedCardCount > 1 ? 'Cartons rouges' : 'Carton rouge')}`}>
                  <Text style={styles.redCardIcon}>🟥</Text>
                  <Text style={styles.redCardCount}>{awayRedCardCount}</Text>
                </View>
              )}
              <Text style={styles.teamScore} translate={false}>{stats.awayTeam}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {(['resume', 'lineups', 'stats', 'h2h'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'resume' ? 'Résumé' : tab === 'lineups' ? 'Compositions' : tab === 'stats' ? 'Statistiques' : 'H2H'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'resume' && (
        <View style={styles.tabContent}>
          {/* Odds */}
          {stats.odds && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cotes</Text>
              <View style={styles.oddsContainer}>
                <View style={styles.oddCard}>
                  <Text style={styles.oddTeam} translate={false}>{stats.homeTeam.substring(0, 3).toUpperCase()}</Text>
                  <Text style={styles.oddValue}>{stats.odds.homeWin.toFixed(2)}</Text>
                </View>
                <View style={styles.oddCard}>
                  <Text style={styles.oddTeam}>NUL</Text>
                  <Text style={styles.oddValue}>{stats.odds.draw.toFixed(2)}</Text>
                </View>
                <View style={styles.oddCard}>
                  <Text style={styles.oddTeam} translate={false}>{stats.awayTeam.substring(0, 3).toUpperCase()}</Text>
                  <Text style={styles.oddValue}>{stats.odds.awayWin.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Form */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Forme</Text>
            <View style={styles.formSection}>
              <Text style={styles.formTeamName} translate={false}>{stats.homeTeam}</Text>
              {renderForm(stats.homeForm)}
              <Text style={styles.formTeamName} translate={false}>{stats.awayTeam}</Text>
              {renderForm(stats.awayForm)}
            </View>
          </View>

          {hasAnyStats(stats.redCards) || homeHasRedCard || awayHasRedCard ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cartons rouges</Text>
              <View style={styles.redCardsSummary}>
                {homeHasRedCard ? (
                  <View style={styles.redCardTeam}>
                    <Text style={styles.redCardSummaryIcon}>🟥</Text>
                    <Text style={styles.redCardSummaryTeam} translate={false}>{stats.homeTeam}</Text>
                    <Text style={styles.redCardSummaryCount}>{homeRedCardCount}</Text>
                  </View>
                ) : null}
                {awayHasRedCard ? (
                  <View style={styles.redCardTeam}>
                    <Text style={styles.redCardSummaryIcon}>🟥</Text>
                    <Text style={styles.redCardSummaryTeam} translate={false}>{stats.awayTeam}</Text>
                    <Text style={styles.redCardSummaryCount}>{awayRedCardCount}</Text>
                  </View>
                ) : null}
                {!homeHasRedCard && !awayHasRedCard ? (
                  <Text style={styles.standingsEmpty}>Aucun carton rouge</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Events */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, styles.eventSectionTitle]}>Événements</Text>
            <View style={styles.eventSearchBox}>
              <MaterialIcons name="search" size={19} color={theme.muted} />
              <TextInput
                accessibilityLabel="Rechercher un événement"
                value={eventQuery}
                onChangeText={setEventQuery}
                placeholder="Joueur, équipe ou événement"
                placeholderTextColor={theme.muted}
                style={styles.eventSearchInput}
                returnKeyType="search"
              />
              {eventQuery ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Effacer la recherche"
                  onPress={() => setEventQuery('')}
                >
                  <MaterialIcons name="close" size={18} color={theme.muted} />
                </TouchableOpacity>
              ) : null}
            </View>
            {stats.events.length > 0 ? (
              <>
                {([
                  ['first', visibleTimelineEvents.filter(({ event }) => eventMinuteValue(event.minute) <= 45), '1re mi-temps'],
                  ['second', visibleTimelineEvents.filter(({ event }) => eventMinuteValue(event.minute) > 45), '2e mi-temps'],
                ] as const).map(([period, events, periodLabel]) => {
                  const periodGoals = timelineEvents.filter(({ event, isGoal }) =>
                    isGoal && (period === 'first'
                      ? eventMinuteValue(event.minute) <= 45
                      : eventMinuteValue(event.minute) > 45)
                  );
                  const homePeriodScore = periodGoals.filter(({ event }) => event.side === 'home').length;
                  const awayPeriodScore = periodGoals.filter(({ event }) => event.side === 'away').length;
                  if (events.length === 0 && (eventQuery || periodGoals.length === 0)) return null;
                  return (
                    <View key={period} style={styles.timelinePeriod}>
                      <View style={styles.timelinePeriodHeader}>
                        <Text style={styles.timelinePeriodLabel}>{periodLabel}</Text>
                        <Text style={styles.timelinePeriodScore}>{homePeriodScore} – {awayPeriodScore}</Text>
                      </View>
                      {events.map(({ event, index, isGoal, scoreAfter }) => {
                        const eventType = `${event.type} ${event.detail || ''}`.toLocaleLowerCase('fr-FR');
                        const isRedCard = eventType.includes('rouge') || eventType.includes('red');
                        const isYellowCard = eventType.includes('jaune') || eventType.includes('yellow');
                        const isCard = eventType.includes('card') || eventType.includes('carton');
                        const teamName = event.side === 'home'
                          ? stats.homeTeam
                          : event.side === 'away'
                            ? stats.awayTeam
                            : '';
                        const awayEvent = event.side === 'away';
                        const marker = isGoal ? 'sports-soccer' : eventType.includes('substitution') ? 'swap-horiz' : 'style';
                        return (
                          <View
                            key={`${event.minute}-${event.type}-${index}`}
                            style={[styles.timelineEventRow, awayEvent && styles.timelineEventRowAway]}
                          >
                            <Text style={[styles.timelineEventMinute, awayEvent && styles.timelineEventMinuteAway]} translate={false}>
                              {String(event.minute).replace(/['′’]/g, '')}′
                            </Text>
                            <View style={[
                              styles.timelineEventMarker,
                              isRedCard && styles.timelineEventMarkerRed,
                              isYellowCard && styles.timelineEventMarkerYellow,
                            ]}>
                              {isCard
                                ? <Text style={styles.eventCardMarker}>{isRedCard ? '🟥' : '🟨'}</Text>
                                : <MaterialIcons name={marker} size={15} color={theme.primary} />}
                            </View>
                            <View style={[styles.timelineEventCopy, awayEvent && styles.timelineEventCopyAway]}>
                              {teamName ? <Text style={styles.timelineEventTeam} translate={false}>{teamName}</Text> : null}
                              <View style={[styles.timelineEventTitleRow, awayEvent && styles.timelineEventTitleRowAway]}>
                                {event.playerImageUrl ? <FotMobAvatar imageUrl={event.playerImageUrl} name={event.player} size={24} /> : null}
                                <Text style={[styles.eventPlayer, awayEvent && styles.timelineEventTextAway]} translate={false}>
                                  {event.player}
                                </Text>
                                {isGoal ? <Text style={styles.timelineEventScore}>{scoreAfter}</Text> : null}
                              </View>
                              {!isCard && !isGoal ? <Text style={[styles.eventType, awayEvent && styles.timelineEventTextAway]} translate={false}>{event.type}</Text> : null}
                              {event.detail ? <Text style={[styles.eventDetailText, awayEvent && styles.timelineEventTextAway]} translate={false}>{event.detail}</Text> : null}
                              {event.playerOut ? <Text style={[styles.eventDetailText, awayEvent && styles.timelineEventTextAway]}>{t('Sortie :')} <Text translate={false}>{event.playerOut}</Text></Text> : null}
                              {event.playerIn ? <Text style={[styles.eventDetailText, awayEvent && styles.timelineEventTextAway]}>{t('Entrée :')} <Text translate={false}>{event.playerIn}</Text></Text> : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
                {visibleTimelineEvents.length === 0 ? (
                  <Text style={styles.standingsEmpty}>Aucun événement ne correspond à cette recherche.</Text>
                ) : null}
              </>
            ) : <Text style={styles.standingsEmpty}>Aucun événement disponible pour cette rencontre.</Text>}
          </View>
        </View>
      )}

      {activeTab === 'lineups' && (
        <View style={styles.tabContent}>
          {/* Home Lineup */}
          <View style={styles.lineupSection}>
            <Text style={styles.lineupTeamTitle} translate={false}>{stats.homeTeam}</Text>
            {stats.homeFormation ? <Text style={styles.formation}>{stats.homeFormation}</Text> : null}
            {stats.homeLineup.map((player, index) => (
              <View key={index} style={styles.playerRow}>
                <Text style={styles.playerNumber} translate={false}>{player.number}</Text>
                {player.imageUrl ? <FotMobAvatar imageUrl={player.imageUrl} name={player.name} size={32} /> : null}
                <Text style={styles.playerName} translate={false}>{player.name}</Text>
                <Text style={styles.playerPosition} translate={false}>{player.position}</Text>
                {player.rating && <Text style={styles.playerRating} translate={false}>{player.rating}</Text>}
              </View>
            ))}
            
            <Text style={styles.substitutesTitle}>Remplaçants</Text>
            {stats.homeSubstitutes.map((player, index) => (
              <View key={index} style={styles.playerRow}>
                <Text style={styles.playerNumber} translate={false}>{player.number}</Text>
                {player.imageUrl ? <FotMobAvatar imageUrl={player.imageUrl} name={player.name} size={32} /> : null}
                <Text style={styles.playerName} translate={false}>{player.name}</Text>
                <Text style={styles.playerPosition} translate={false}>{player.position}</Text>
                {player.rating && <Text style={styles.playerRating} translate={false}>{player.rating}</Text>}
              </View>
            ))}
          </View>

          {/* Away Lineup */}
          <View style={styles.lineupSection}>
            <Text style={styles.lineupTeamTitle} translate={false}>{stats.awayTeam}</Text>
            {stats.awayFormation ? <Text style={styles.formation}>{stats.awayFormation}</Text> : null}
            {stats.awayLineup.map((player, index) => (
              <View key={index} style={styles.playerRow}>
                <Text style={styles.playerNumber} translate={false}>{player.number}</Text>
                {player.imageUrl ? <FotMobAvatar imageUrl={player.imageUrl} name={player.name} size={32} /> : null}
                <Text style={styles.playerName} translate={false}>{player.name}</Text>
                <Text style={styles.playerPosition} translate={false}>{player.position}</Text>
                {player.rating && <Text style={styles.playerRating} translate={false}>{player.rating}</Text>}
              </View>
            ))}
            
            <Text style={styles.substitutesTitle}>Remplaçants</Text>
            {stats.awaySubstitutes.map((player, index) => (
              <View key={index} style={styles.playerRow}>
                <Text style={styles.playerNumber} translate={false}>{player.number}</Text>
                {player.imageUrl ? <FotMobAvatar imageUrl={player.imageUrl} name={player.name} size={32} /> : null}
                <Text style={styles.playerName} translate={false}>{player.name}</Text>
                <Text style={styles.playerPosition} translate={false}>{player.position}</Text>
                {player.rating && <Text style={styles.playerRating} translate={false}>{player.rating}</Text>}
              </View>
            ))}
          </View>
        </View>
      )}

      {activeTab === 'stats' && (
        <View style={styles.tabContent}>
          {/* Overview Stats */}
          {hasAnyStats(stats.possession, stats.expectedGoals, stats.shots, stats.shotsOnTarget, stats.touchesInBox,
            stats.bigChances, stats.bigChancesMissed, stats.accuratePasses, stats.yellowCards, stats.corners) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Aperçu</Text>
              {renderStatRow('Possession', stats.possession, '%')}
              {renderStatRow('xG', stats.expectedGoals)}
              {renderStatRow('Tirs', stats.shots)}
              {renderStatRow('Tirs cadrés', stats.shotsOnTarget)}
              {renderStatRow('Touches surface', stats.touchesInBox)}
              {renderStatRow('Grosses chances', stats.bigChances)}
              {renderStatRow('Chances ratées', stats.bigChancesMissed)}
              {renderStatRow('Passes précis', stats.accuratePasses)}
              {renderStatRow('Cartons jaunes', stats.yellowCards)}
              {renderStatRow('Corners', stats.corners)}
            </View>
          ) : null}

          {/* Shots */}
          {hasAnyStats(stats.shots, stats.shotsOffTarget, stats.shotsOnTarget, stats.blockedShots, stats.hitWoodwork,
            stats.shotsInsideBox, stats.shotsOutsideBox) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tirs</Text>
              {renderStatRow('Total tirs', stats.shots)}
              {renderStatRow('Tirs hors cadre', stats.shotsOffTarget)}
              {renderStatRow('Tirs cadrés', stats.shotsOnTarget)}
              {renderStatRow('Tirs bloqués', stats.blockedShots)}
              {renderStatRow('Sur poteau', stats.hitWoodwork)}
              {renderStatRow('Dans la surface', stats.shotsInsideBox)}
              {renderStatRow('Hors surface', stats.shotsOutsideBox)}
            </View>
          ) : null}

          {/* Expected Goals */}
          {hasAnyStats(stats.expectedGoals, stats.xgOpenPlay, stats.xgSetPlay, stats.xgNonPenalty, stats.xgOnTarget) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Buts attendus (xG)</Text>
              {renderStatRow('xG total', stats.expectedGoals)}
              {renderStatRow('xG jeu ouvert', stats.xgOpenPlay)}
              {renderStatRow('xG coups arrêtés', stats.xgSetPlay)}
              {renderStatRow('xG non penalty', stats.xgNonPenalty)}
              {renderStatRow('xG cadré (xGOT)', stats.xgOnTarget)}
            </View>
          ) : null}

          {/* Passes */}
          {hasAnyStats(stats.passes, stats.accuratePasses, stats.accurateLongBalls, stats.accurateCrosses,
            stats.throws, stats.offsides) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Passes</Text>
              {renderStatRow('Total passes', stats.passes)}
              {renderStatRow('Passes précis', stats.accuratePasses)}
              {renderStatRow('Longs balls précis', stats.accurateLongBalls)}
              {renderStatRow('Centres précis', stats.accurateCrosses)}
              {renderStatRow('Touches', stats.throws)}
              {renderStatRow('Hors-jeu', stats.offsides)}
            </View>
          ) : null}

          {/* Defence */}
          {hasAnyStats(stats.tackles, stats.interceptions, stats.blocks, stats.clearances, stats.keeperSaves) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Défense</Text>
              {renderStatRow('Tacles', stats.tackles)}
              {renderStatRow('Interceptions', stats.interceptions)}
              {renderStatRow('Bloqués', stats.blocks)}
              {renderStatRow('Dégagements', stats.clearances)}
              {renderStatRow('Arrêts gardien', stats.keeperSaves)}
            </View>
          ) : null}

          {/* Duels */}
          {hasAnyStats(stats.duelsWon, stats.groundDuelsWon, stats.aerialDuelsWon, stats.successfulDribbles) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Duels</Text>
              {renderStatRow('Duels gagnés', stats.duelsWon)}
              {renderStatRow('Duels au sol', stats.groundDuelsWon)}
              {renderStatRow('Duels aériens', stats.aerialDuelsWon)}
              {renderStatRow('Dribbles réussis', stats.successfulDribbles)}
            </View>
          ) : null}

          {/* Discipline */}
          {hasAnyStats(stats.yellowCards, stats.redCards, stats.foulsCommitted) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Discipline</Text>
              {renderStatRow('Cartons jaunes', stats.yellowCards)}
              {renderStatRow('Cartons rouges', stats.redCards)}
              {renderStatRow('Fautes commises', stats.foulsCommitted)}
            </View>
          ) : null}

          {!hasAnyStats(
            stats.possession, stats.expectedGoals, stats.shots, stats.shotsOnTarget, stats.touchesInBox,
            stats.bigChances, stats.bigChancesMissed, stats.accuratePasses, stats.yellowCards, stats.corners,
            stats.shotsOffTarget, stats.blockedShots, stats.hitWoodwork, stats.shotsInsideBox, stats.shotsOutsideBox,
            stats.xgOpenPlay, stats.xgSetPlay, stats.xgNonPenalty, stats.xgOnTarget, stats.passes,
            stats.accurateLongBalls, stats.accurateCrosses, stats.throws, stats.offsides, stats.tackles,
            stats.interceptions, stats.blocks, stats.clearances, stats.keeperSaves, stats.duelsWon,
            stats.groundDuelsWon, stats.aerialDuelsWon, stats.successfulDribbles, stats.redCards, stats.foulsCommitted
          ) ? (
            <Text style={styles.standingsEmpty}>Les statistiques ne sont pas disponibles pour cette rencontre.</Text>
          ) : null}
        </View>
      )}

      {activeTab === 'h2h' && (
        <View style={styles.tabContent}>
          {/* Head to Head */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confrontations directes</Text>
            <Text style={styles.h2hSubtitle}>Rencontres récentes entre les deux équipes</Text>
            {stats.headToHead.length > 0 ? stats.headToHead
              .slice(0, showAllHeadToHead ? stats.headToHead.length : 3)
              .map((match, index) => (
              <View key={`${match.date}-${match.homeTeam}-${match.awayTeam}-${index}`} style={styles.h2hItem}>
                <View style={styles.h2hMeta}>
                  <Text style={styles.h2hDate}>
                    {match.date
                      ? new Date(match.date).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })
                      : 'Date inconnue'}
                  </Text>
                  <Text numberOfLines={1} style={styles.h2hCompetition} translate={false}>{match.competition}</Text>
                </View>
                <View style={styles.h2hMatch}>
                  <Text numberOfLines={2} style={styles.h2hTeam} translate={false}>{match.homeTeam}</Text>
                  <View style={styles.h2hScore}>
                    <Text style={styles.h2hScoreValue} translate={false}>{match.homeScore ?? '-'}</Text>
                    <Text style={styles.h2hScoreSeparator}>–</Text>
                    <Text style={styles.h2hScoreValue} translate={false}>{match.awayScore ?? '-'}</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.h2hTeam} translate={false}>{match.awayTeam}</Text>
                </View>
              </View>
              )) : (
                <Text style={styles.standingsEmpty}>Aucune confrontation directe disponible sur FotMob.</Text>
              )}
            {stats.headToHead.length > 3 ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ expanded: showAllHeadToHead }}
                onPress={() => setShowAllHeadToHead(value => !value)}
                style={styles.h2hMoreButton}
              >
                <Text style={styles.h2hMoreText}>
                  {showAllHeadToHead ? 'Voir moins' : `Voir plus (${stats.headToHead.length - 3})`}
                </Text>
                <MaterialIcons
                  name={showAllHeadToHead ? 'expand-less' : 'expand-more'}
                  size={20}
                  color={theme.primary}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Standings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Classement</Text>
            {stats.standings.length > 0 ? (
              <>
                <View style={styles.standingsHeader}>
                  <Text style={styles.standingsHeaderCell}>#</Text>
                  <Text style={styles.standingsHeaderCell}>Équipe</Text>
                  <Text style={styles.standingsHeaderCell}>MJ</Text>
                  <Text style={styles.standingsHeaderCell}>G</Text>
                  <Text style={styles.standingsHeaderCell}>N</Text>
                  <Text style={styles.standingsHeaderCell}>P</Text>
                  <Text style={styles.standingsHeaderCell}>+/-</Text>
                  <Text style={styles.standingsHeaderCell}>Pts</Text>
                </View>
                {stats.standings.map((team, index) => (
                  <View key={index} style={[
                    styles.standingsRow,
                    (team.team === stats.homeTeam || team.team === stats.awayTeam) && styles.standingsRowHighlight
                  ]}>
                    <Text style={styles.standingsCell} translate={false}>{team.position}</Text>
                    <Text style={[styles.standingsCell, styles.standingsTeam]} translate={false}>{team.team}</Text>
                    <Text style={styles.standingsCell}>{team.played}</Text>
                    <Text style={styles.standingsCell}>{team.won}</Text>
                    <Text style={styles.standingsCell}>{team.drawn}</Text>
                    <Text style={styles.standingsCell}>{team.lost}</Text>
                    <Text style={styles.standingsCell}>{team.goalDifference}</Text>
                    <Text style={[styles.standingsCell, styles.standingsPoints]} translate={false}>{team.points}</Text>
                  </View>
                ))}
              </>
            ) : (
              <Text style={styles.standingsEmpty}>Classement non disponible pour cette rencontre.</Text>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backIcon: {
    marginRight: 15,
  },
  backIconText: {
    fontSize: 24,
    color: theme.primary,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    flex: 1,
  },
  favoriteButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceRaised },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  favoriteIcon: { color: theme.muted, fontSize: 23, lineHeight: 26 },
  favoriteIconSelected: { color: theme.danger },
  matchInfoCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 20,
    margin: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  competition: {
    fontSize: 14,
    color: theme.primary,
    textAlign: 'center',
    marginBottom: 5,
  },
  matchDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.muted,
    textAlign: 'center',
    marginBottom: 15,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamScoreGroup: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  teamScoreNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  teamScore: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'center',
    flexShrink: 1,
  },
  redCardIcon: {
    fontSize: 12,
  },
  redCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: theme.surfaceRaised,
  },
  redCardCount: {
    color: theme.danger,
    fontSize: 10,
    fontWeight: '900',
  },
  redCardsSummary: {
    gap: 8,
  },
  redCardTeam: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: theme.surfaceRaised,
  },
  redCardSummaryIcon: {
    fontSize: 14,
  },
  redCardSummaryTeam: {
    flex: 1,
    color: theme.text,
    fontSize: 12,
    fontWeight: '700',
  },
  redCardSummaryCount: {
    color: theme.danger,
    fontSize: 13,
    fontWeight: '900',
  },
  scoreBox: {
    flex: 1,
    alignItems: 'center',
  },
  score: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.primary,
  },
  matchStatus: {
    fontSize: 12,
    color: theme.muted,
    marginTop: 5,
  },
  liveStatus: {
    color: theme.danger,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 15,
    marginBottom: 15,
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 5,
  },
  tab: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: theme.primaryDark,
  },
  tabText: {
    fontSize: 12,
    color: theme.muted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: theme.text,
  },
  tabContent: {
    marginHorizontal: 15,
    marginBottom: 20,
  },
  section: {
    backgroundColor: theme.surface,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },
  formContainer: {
    flexDirection: 'row',
    gap: 5,
  },
  formSection: {
    gap: 15,
  },
  formTeamName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 5,
  },
  formItem: {
    width: 35,
    height: 35,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formWin: {
    backgroundColor: theme.primaryDark,
  },
  formDraw: {
    backgroundColor: '#a16207',
  },
  formLoss: {
    backgroundColor: '#b91c1c',
  },
  formText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.text,
  },
  eventSearchBox: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 11,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceRaised,
  },
  eventSearchInput: {
    flex: 1,
    color: theme.text,
    fontSize: 12,
    paddingVertical: 9,
  },
  timelinePeriod: {
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: theme.background,
  },
  timelinePeriodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: theme.surfaceRaised,
  },
  timelinePeriodLabel: {
    color: theme.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  timelinePeriodScore: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '900',
  },
  timelineEventRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  timelineEventRowAway: {
    flexDirection: 'row-reverse',
  },
  timelineEventMinute: {
    width: 34,
    color: theme.muted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'left',
  },
  timelineEventMinuteAway: {
    textAlign: 'right',
  },
  timelineEventMarker: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceRaised,
  },
  timelineEventMarkerRed: {
    borderColor: theme.danger,
  },
  timelineEventMarkerYellow: {
    borderColor: theme.warning,
  },
  eventCardMarker: {
    fontSize: 12,
  },
  timelineEventCopy: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 7,
  },
  timelineEventCopyAway: {
    alignItems: 'flex-end',
  },
  timelineEventTeam: {
    color: theme.primary,
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 2,
  },
  timelineEventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  timelineEventTitleRowAway: {
    justifyContent: 'flex-end',
  },
  timelineEventTextAway: {
    textAlign: 'right',
  },
  eventType: {
    fontSize: 10,
    color: theme.muted,
  },
  eventPlayer: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.text,
  },
  timelineEventScore: {
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: theme.surfaceRaised,
    color: theme.text,
    fontSize: 10,
    fontWeight: '800',
  },
  eventDetailText: {
    fontSize: 10,
    color: theme.muted,
    marginTop: 1,
  },
  eventSectionTitle: {
    marginBottom: 8,
  },
  lineupSection: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lineupTeamTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 5,
  },
  formation: {
    fontSize: 14,
    color: theme.muted,
    marginBottom: 15,
  },
  playerRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    alignItems: 'center',
  },
  playerNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.primary,
    width: 30,
  },
  playerName: {
    fontSize: 14,
    color: theme.text,
    flex: 1,
    marginLeft: 8,
  },
  playerPosition: {
    fontSize: 12,
    color: theme.muted,
    width: 40,
  },
  playerRating: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.text,
    width: 30,
    textAlign: 'right',
  },
  substitutesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 15,
    marginBottom: 10,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.text,
    flex: 1,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: theme.muted,
    flex: 1,
    textAlign: 'center',
  },
  h2hItem: {
    padding: 12,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceRaised,
  },
  h2hSubtitle: {
    color: theme.muted,
    fontSize: 12,
    marginTop: -8,
    marginBottom: 4,
  },
  h2hMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingBottom: 8,
  },
  h2hDate: {
    fontSize: 12,
    color: theme.muted,
    fontWeight: '600',
  },
  h2hMatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
  },
  h2hTeam: {
    flex: 1,
    color: theme.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  h2hScore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 68,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: theme.surface,
  },
  h2hScoreValue: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '800',
  },
  h2hScoreSeparator: {
    color: theme.muted,
    fontSize: 12,
  },
  h2hCompetition: {
    fontSize: 12,
    color: theme.primary,
    flexShrink: 1,
    textAlign: 'right',
  },
  h2hMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: theme.accentSurface,
  },
  h2hMoreText: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  standingsHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: theme.primary,
  },
  standingsHeaderCell: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.text,
    flex: 1,
    textAlign: 'center',
  },
  standingsEmpty: {
    color: theme.muted,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
  },
  standingsRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  standingsRowHighlight: {
    backgroundColor: theme.accentSurface,
  },
  standingsCell: {
    fontSize: 12,
    color: theme.text,
    flex: 1,
    textAlign: 'center',
  },
  standingsTeam: {
    textAlign: 'left',
    fontWeight: '600',
  },
  standingsPoints: {
    fontWeight: 'bold',
    color: theme.primary,
  },
  oddsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  oddCard: {
    backgroundColor: theme.surfaceRaised,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  oddTeam: {
    fontSize: 12,
    color: theme.muted,
    marginBottom: 5,
  },
  oddValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.primary,
  },
  errorText: {
    fontSize: 16,
    color: theme.danger,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: theme.surface,
    padding: 15,
    borderRadius: 8,
  },
  backButtonText: {
    color: theme.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
