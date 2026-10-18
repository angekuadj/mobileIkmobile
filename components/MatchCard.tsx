import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Modal, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { getFixtureScore, isLiveFixtureStatus, type Fixture } from '../lib/fixtures';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../lib/theme';
import FotMobAvatar from './FotMobAvatar';
import { useFavorites } from '../context/FavoritesContext';
import { useMatchLiveAlerts } from '../hooks/useMatchLiveAlerts';
import { LocalizedText as Text } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../lib/localization';
import { LocalizedAlert as Alert } from '../lib/localization';
import { useLanguage } from '../lib/localization';

interface MatchCardProps {
  fixture: Fixture;
  selected?: boolean;
  onToggle?: (fixture: Fixture) => void;
  showLiveAlert?: boolean;
}

export default function MatchCard({ fixture, selected = false, onToggle, showLiveAlert = true }: MatchCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const favorites = useFavorites();
  const liveAlerts = useMatchLiveAlerts(fixture);
  const { language, t } = useLanguage();
  const isFavorite = favorites.isFavorite(fixture.id);
  const status = fixture.status || 'Prévu';
  const live = isLiveFixtureStatus(status);
  const finished = ['terminé', 'finished', 'ft', 'full time'].includes(status.toLocaleLowerCase('fr-FR'));
  const score = getFixtureScore(fixture);
  const homeRedCards = Number(fixture.matchStats?.redCards?.home) || 0;
  const awayRedCards = Number(fixture.matchStats?.redCards?.away) || 0;
  const homeHasRedCard = homeRedCards > 0;
  const awayHasRedCard = awayRedCards > 0;
  const date = new Date(`${fixture.date}T12:00:00.000Z`).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <>
      <View style={styles.card}>
        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            <Text style={styles.league} translate={false}>{fixture.competition || fixture.league || 'Football'}</Text>
            {fixture.location ? <Text style={styles.location} translate={false}>{fixture.location}</Text> : null}
            <Text style={[styles.status, live && styles.liveStatus]}>
              {live ? '● EN DIRECT' : finished ? 'TERMINÉ' : <Text translate={false}>{date} · {fixture.time}</Text>}
            </Text>
          </View>
          <View style={styles.metaActions}>
            {showLiveAlert && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={liveAlerts.enabled
                  ? `${t('Désactiver les notifications en direct de')} ${fixture.homeTeam} ${t('contre')} ${fixture.awayTeam}`
                  : `${t('Recevoir les notifications en direct de')} ${fixture.homeTeam} ${t('contre')} ${fixture.awayTeam}`}
                translateAccessibility={false}
                accessibilityState={{ selected: liveAlerts.enabled, disabled: liveAlerts.isBusy }}
                disabled={favorites.isLoading || liveAlerts.isBusy}
                style={styles.favoriteButton}
                onPress={() => { liveAlerts.toggle(); }}
              >
                <MaterialIcons
                  name={liveAlerts.enabled ? 'notifications-active' : 'notifications-none'}
                  size={20}
                  color={liveAlerts.enabled ? theme.primary : theme.muted}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              accessibilityState={{ selected: isFavorite }}
              disabled={favorites.isLoading}
              style={styles.favoriteButton}
              onPress={() => {
                void favorites.toggleFavorite(fixture).then(result => {
                  if (result === 'limit') Alert.alert('Limite de favoris atteinte', 'Vous pouvez suivre jusqu’à 30 rencontres.');
                }).catch(error => Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de modifier les favoris.'));
              }}
            >
              <MaterialIcons name={isFavorite ? 'favorite' : 'favorite-border'} size={20} color={isFavorite ? theme.danger : theme.muted} />
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${t('Détails')} ${fixture.homeTeam} ${t('contre')} ${fixture.awayTeam}`}
          translateAccessibility={false}
          onPress={() => router.push(`/match/${encodeURIComponent(fixture.id)}`)}
          style={styles.details}
        >
          <View style={styles.teams}>
            <View style={styles.team}>
              <FotMobAvatar imageUrl={fixture.homeImageUrl} name={fixture.homeTeam} size={38} />
              <View style={styles.teamNameRow}>
                {homeHasRedCard && (
                  <View style={styles.redCardBadge} accessibilityLabel={`${homeRedCards} ${t(homeRedCards > 1 ? 'Cartons rouges' : 'Carton rouge')}`}>
                    <Text style={styles.redCardIcon}>🟥</Text>
                    <Text style={styles.redCardCount}>{homeRedCards}</Text>
                  </View>
                )}
                <Text numberOfLines={2} style={styles.teamName} translate={false}>{fixture.homeTeam}</Text>
              </View>
            </View>
            <View style={styles.scoreBlock}>
              <Text style={styles.score}>
                {score
                  ? <>{score[0]} <Text style={styles.separator}>–</Text> {score[1]}</>
                  : live ? '—' : <>- <Text style={styles.separator}>–</Text> -</>}
              </Text>
              <Text style={[styles.matchStatus, live && styles.liveStatus]}>
                {live
                  ? fixture.liveTime ? <Text translate={false}>{fixture.liveTime}</Text> : t('En direct')
                  : t(fixture.status || 'Prévu')}
              </Text>
            </View>
            <View style={styles.team}>
              <FotMobAvatar imageUrl={fixture.awayImageUrl} name={fixture.awayTeam} size={38} />
              <View style={styles.teamNameRow}>
                {awayHasRedCard && (
                  <View style={styles.redCardBadge} accessibilityLabel={`${awayRedCards} ${t(awayRedCards > 1 ? 'Cartons rouges' : 'Carton rouge')}`}>
                    <Text style={styles.redCardIcon}>🟥</Text>
                    <Text style={styles.redCardCount}>{awayRedCards}</Text>
                  </View>
                )}
                <Text numberOfLines={2} style={styles.teamName} translate={false}>{fixture.awayTeam}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {(live || finished) && fixture.matchStats && (
          <View style={styles.matchStats}>
            {fixture.matchStats.yellowCards && (
              <Text style={styles.matchStatText}>
                🟨 {fixture.matchStats.yellowCards.home}–{fixture.matchStats.yellowCards.away}
              </Text>
            )}
            {fixture.matchStats.redCards && (
              <Text style={styles.matchStatText}>
                🟥 {fixture.matchStats.redCards.home}–{fixture.matchStats.redCards.away}
              </Text>
            )}
            {fixture.matchStats.corners && (
              <Text style={styles.matchStatText}>
                CK {fixture.matchStats.corners.home}–{fixture.matchStats.corners.away}
              </Text>
            )}
          </View>
        )}

        {fixture.odds && fixture.odds.homeWin > 0 && fixture.odds.awayWin > 0 && (
          <View style={styles.oddsRow}>
            {[
              { label: '1', value: fixture.odds.homeWin },
              { label: 'N', value: fixture.odds.draw },
              { label: '2', value: fixture.odds.awayWin },
            ].map(odd => (
              <View key={odd.label} style={styles.odd}>
                <Text style={styles.oddLabel}>{odd.label}</Text>
                <Text style={styles.oddValue}>{odd.value.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {onToggle && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={selected ? 'Retirer du panier' : 'Ajouter au panier'}
            style={[styles.addButton, selected && styles.selectedButton]}
            onPress={() => onToggle(fixture)}
          >
            <MaterialIcons name={selected ? 'check-circle' : 'add-circle-outline'} size={18} color={selected ? theme.primary : theme.muted} />
            <Text style={[styles.addButtonText, selected && styles.selectedText]}>
              {selected ? 'Dans mon panier' : 'Ajouter à ma sélection'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <Modal
        visible={liveAlerts.notice !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={liveAlerts.dismissNotice}
      >
        <View style={styles.noticeOverlay}>
          <View accessibilityViewIsModal style={styles.noticeCard}>
            <View style={styles.noticeIcon}>
              <MaterialIcons name="notifications-active" size={27} color={theme.primary} />
            </View>
            <Text style={styles.noticeEyebrow}>ALERTE MATCH</Text>
            <Text accessibilityRole="header" style={styles.noticeTitle}>{liveAlerts.notice?.title}</Text>
            <View style={styles.noticeTeams}>
              <FotMobAvatar imageUrl={fixture.homeImageUrl} name={fixture.homeTeam} size={36} />
              <Text style={styles.noticeVersus}>VS</Text>
              <FotMobAvatar imageUrl={fixture.awayImageUrl} name={fixture.awayTeam} size={36} />
            </View>
            <Text style={styles.noticeMessage}>{liveAlerts.notice?.message}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.noticeButton}
              onPress={liveAlerts.dismissNotice}
            >
              <Text style={styles.noticeButtonText}>Compris</Text>
              <MaterialIcons name="arrow-forward" size={18} color={theme.background} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },
  details: { paddingHorizontal: 16, paddingTop: 7, paddingBottom: 16 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  metaLeft: { flex: 1 },
  league: { color: theme.primary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  location: { color: theme.muted, fontSize: 11, marginTop: 3 },
  status: { color: theme.muted, fontSize: 10, fontWeight: '700', textAlign: 'right' },
  liveStatus: { color: theme.danger, fontWeight: '800' },
  favoriteButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: theme.surfaceRaised },
  metaActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teams: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  team: { flex: 1, alignItems: 'center', gap: 8 },
  teamNameRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  teamName: { color: theme.text, fontSize: 13, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  redCardBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6, backgroundColor: theme.surfaceRaised },
  redCardIcon: { fontSize: 12 },
  redCardCount: { color: theme.danger, fontSize: 10, fontWeight: '900' },
  scoreBlock: { alignItems: 'center', paddingHorizontal: 10, minWidth: 76 },
  score: { color: theme.text, fontSize: 18, fontWeight: '800' },
  separator: { color: theme.muted, fontWeight: '400' },
  matchStatus: { color: theme.muted, fontSize: 10, marginTop: 4, textAlign: 'center' },
  matchStats: { flexDirection: 'row', justifyContent: 'center', gap: 14, paddingHorizontal: 12, paddingBottom: 12 },
  matchStatText: { color: theme.muted, fontSize: 11, fontWeight: '700' },
  oddsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  odd: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderRadius: 9, backgroundColor: theme.surfaceRaised },
  oddLabel: { color: theme.muted, fontSize: 12, fontWeight: '700' },
  oddValue: { color: theme.text, fontSize: 12, fontWeight: '800' },
  addButton: { borderTopWidth: 1, borderTopColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  selectedButton: { backgroundColor: theme.accentSurface },
  addButtonText: { color: theme.muted, fontSize: 12, fontWeight: '700' },
  selectedText: { color: theme.primary },
  noticeOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.72)' },
  noticeCard: { width: '100%', maxWidth: 420, alignItems: 'center', padding: 22, borderRadius: 22, borderWidth: 1, borderColor: theme.accentBorder, backgroundColor: theme.surface },
  noticeIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentSurface, marginBottom: 12 },
  noticeEyebrow: { color: theme.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  noticeTitle: { color: theme.text, fontSize: 19, fontWeight: '900', textAlign: 'center', marginTop: 7 },
  noticeTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 17, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 14, backgroundColor: theme.surfaceRaised },
  noticeVersus: { color: theme.primary, fontSize: 11, fontWeight: '900' },
  noticeMessage: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 15 },
  noticeButton: { width: '100%', minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, backgroundColor: theme.primary, marginTop: 20 },
  noticeButtonText: { color: theme.background, fontSize: 12, fontWeight: '900' },
});
