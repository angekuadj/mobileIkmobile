import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet } from 'react-native';
import MatchCard from '../../components/MatchCard';
import { useBasket } from '../../hooks/useBasket';
import { useFixtures } from '../../hooks/useFixtures';
import {
  formatPeriodLabel,
  getLocalDate,
  getPeriodEnd,
  getPeriodStart,
  isLiveFixtureStatus,
  shiftDate,
  type Fixture,
} from '../../lib/fixtures';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../lib/theme';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../../lib/localization';
import { LocalizedAlert as Alert } from '../../lib/localization';
import { useLanguage } from '../../lib/localization';

type Period = 'day' | 'week' | 'month';
type StatusFilter = 'all' | 'upcoming' | 'live' | 'finished';
type TimeFilter = 'all' | 'morning' | 'afternoon' | 'evening';

function moveAnchor(anchor: string, period: Period, direction: -1 | 1): string {
  if (period === 'day') return shiftDate(anchor, direction);
  if (period === 'week') return shiftDate(getPeriodStart(anchor, period), direction * 7);
  const month = new Date(`${getPeriodStart(anchor, period)}T00:00:00.000Z`);
  month.setUTCMonth(month.getUTCMonth() + direction);
  return month.toISOString().slice(0, 10);
}

function matchesStatus(fixture: Fixture, filter: StatusFilter): boolean {
  const status = fixture.status?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('fr-FR') ?? '';
  if (filter === 'all') return true;
  if (filter === 'live') return isLiveFixtureStatus(fixture.status);
  if (filter === 'finished') return ['termine', 'finished', 'ft', 'full time'].includes(status);
  return ['prevu', 'scheduled', 'reporte', 'postponed'].includes(status);
}

export default function MatchesScreen() {
  const { language } = useLanguage();
  const dateLocale = language === 'fr' ? 'fr-FR' : 'en-US';
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [anchorDate, setAnchorDate] = useState(getLocalDate);
  const [period, setPeriod] = useState<Period>('day');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [query, setQuery] = useState('');
  const { fixtures, isLoading, error, refetch } = useFixtures(
    getPeriodStart(anchorDate, period),
    getPeriodEnd(getPeriodStart(anchorDate, period), period),
    true
  );
  const basket = useBasket();
  const periodStart = getPeriodStart(anchorDate, period);
  const periodEnd = getPeriodEnd(periodStart, period);
  const periodLabel = formatPeriodLabel(periodStart, periodEnd, period, dateLocale);
  const filteredFixtures = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr-FR');
    return fixtures.filter(fixture => {
      if (!matchesStatus(fixture, statusFilter)) return false;
      const hour = Number.parseInt(fixture.time.slice(0, 2), 10);
      if (timeFilter === 'morning' && !(hour >= 5 && hour < 12)) return false;
      if (timeFilter === 'afternoon' && !(hour >= 12 && hour < 18)) return false;
      if (timeFilter === 'evening' && !(hour >= 18 || hour < 5)) return false;
      if (!normalizedQuery) return true;
      return `${fixture.homeTeam} ${fixture.awayTeam} ${fixture.league} ${fixture.competition} ${fixture.location}`
        .toLocaleLowerCase('fr-FR')
        .includes(normalizedQuery);
    });
  }, [fixtures, query, statusFilter, timeFilter]);
  const statusFilters: ReadonlyArray<readonly [StatusFilter, string]> = [
    ['all', 'Tous'],
    ['upcoming', 'À venir'],
    ...(period === 'day' ? [['live', 'En direct'] as const] : []),
    ['finished', 'Terminés'],
  ] as const;
  const selectedFixtureIds = useMemo(
    () => new Set(basket.fixtures.map(fixture => fixture.id)),
    [basket.fixtures]
  );

  const handleToggle = async (fixture: Fixture) => {
    try {
      const result = await basket.toggleFixture(fixture);
      if (result === 'limit') {
        Alert.alert('Sélection complète', 'Le panier est limité à 20 rencontres.');
      }
    } catch (toggleError) {
      Alert.alert('Erreur', toggleError instanceof Error ? toggleError.message : 'Impossible de modifier votre sélection.');
    }
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      data={filteredFixtures}
      keyExtractor={fixture => fixture.id}
      extraData={selectedFixtureIds}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      updateCellsBatchingPeriod={50}
      ListHeaderComponent={
        <View>
          <View style={styles.heading}>
            <View>
              <Text style={styles.eyebrow}>CALENDRIER</Text>
              <Text style={styles.title}>Rencontres</Text>
            </View>
            <TouchableOpacity style={styles.refresh} onPress={refetch} accessibilityLabel="Actualiser">
              <MaterialIcons name="refresh" size={21} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.periodPicker}>
            {([
              ['day', 'Jour'],
              ['week', 'Semaine'],
              ['month', 'Mois'],
            ] as const).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                onPress={() => {
                  setPeriod(value);
                  if (value !== 'day' && statusFilter === 'live') setStatusFilter('all');
                }}
                style={[styles.periodButton, period === value && styles.periodButtonActive]}
              >
                <Text style={[styles.periodText, period === value && styles.periodTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.dateNavigator}>
            <TouchableOpacity style={styles.arrowButton} onPress={() => setAnchorDate(date => moveAnchor(date, period, -1))} accessibilityLabel="Période précédente">
              <MaterialIcons name="chevron-left" size={24} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.dateLabel}>
              <Text style={styles.dateTitle}>{periodLabel}</Text>
              <Text style={styles.sportLabel}>FOOTBALL · SEUL SPORT DISPONIBLE</Text>
            </View>
            <TouchableOpacity style={styles.arrowButton} onPress={() => setAnchorDate(date => moveAnchor(date, period, 1))} accessibilityLabel="Période suivante">
              <MaterialIcons name="chevron-right" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.todayButton} onPress={() => setAnchorDate(getLocalDate())}>
            <Text style={styles.todayText}>Revenir à aujourd’hui</Text>
          </TouchableOpacity>

          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={theme.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Équipe, compétition ou lieu"
              placeholderTextColor={theme.muted}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {!!query && <TouchableOpacity onPress={() => setQuery('')}><MaterialIcons name="close" size={18} color={theme.muted} /></TouchableOpacity>}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {statusFilters.map(([value, label]) => (
              <TouchableOpacity key={value} onPress={() => setStatusFilter(value)} style={[styles.filter, statusFilter === value && styles.filterActive]}>
                <Text style={[styles.filterText, statusFilter === value && styles.filterTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {([
              ['all', 'Toutes heures'],
              ['morning', 'Matin'],
              ['afternoon', 'Après-midi'],
              ['evening', 'Soir'],
            ] as const).map(([value, label]) => (
              <TouchableOpacity key={value} onPress={() => setTimeFilter(value)} style={[styles.filter, timeFilter === value && styles.filterActive]}>
                <Text style={[styles.filterText, timeFilter === value && styles.filterTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>
              {language === 'fr'
                ? `${filteredFixtures.length} rencontre${filteredFixtures.length === 1 ? '' : 's'}`
                : `${filteredFixtures.length} match${filteredFixtures.length === 1 ? '' : 'es'}`}
            </Text>
            <Text style={styles.basketCount}>{basket.fixtures.length}/20 sélectionnées</Text>
          </View>
          {basket.error ? <Text style={styles.errorText}>{basket.error}</Text> : null}
          {!isLoading && error && filteredFixtures.length > 0 && (
            <View style={styles.messageCard}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={refetch}><Text style={styles.retryText}>Réessayer</Text></TouchableOpacity>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={isLoading ? (
        <ActivityIndicator color={theme.primary} size="large" style={styles.loader} />
      ) : error ? (
        <View style={styles.messageCard}>
          <MaterialIcons name="cloud-off" size={25} color={theme.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}><Text style={styles.retryText}>Réessayer</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={styles.messageCard}>
          <MaterialIcons name="event-busy" size={25} color={theme.muted} />
          <Text style={styles.emptyTitle}>Aucune rencontre pour cette période</Text>
          <Text style={styles.emptyBody}>Changez de date ou de filtre pour voir d’autres matchs.</Text>
        </View>
      )}
      ListFooterComponent={<Text style={styles.footnote}>Les données et cotes sont affichées lorsqu’elles sont disponibles auprès du service.</Text>}
      renderItem={({ item }) => (
        <MatchCard
          fixture={item}
          selected={selectedFixtureIds.has(item.id)}
          onToggle={basket.isLoading ? undefined : handleToggle}
        />
      )}
    />
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: 18, paddingBottom: 36 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  eyebrow: { color: theme.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: theme.text, fontSize: 27, fontWeight: '900', marginTop: 3 },
  refresh: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  periodPicker: { flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 4, marginBottom: 13 },
  periodButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  periodButtonActive: { backgroundColor: theme.primary },
  periodText: { color: theme.muted, fontSize: 12, fontWeight: '700' },
  periodTextActive: { color: theme.background },
  dateNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  arrowButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  dateLabel: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  dateTitle: { color: theme.text, fontSize: 14, fontWeight: '800', textAlign: 'center', textTransform: 'capitalize' },
  sportLabel: { color: theme.muted, fontSize: 9, letterSpacing: 1, marginTop: 5, fontWeight: '700' },
  todayButton: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 10, marginBottom: 11 },
  todayText: { color: theme.primary, fontSize: 11, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, color: theme.text, fontSize: 12 },
  filters: { gap: 8, paddingVertical: 14 },
  filter: { borderRadius: 10, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  filterActive: { backgroundColor: theme.accentSurface, borderColor: theme.accentBorder },
  filterText: { color: theme.muted, fontSize: 11, fontWeight: '700' },
  filterTextActive: { color: theme.primary },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11, marginTop: 2 },
  resultsTitle: { color: theme.text, fontSize: 13, fontWeight: '800' },
  basketCount: { color: theme.primary, fontSize: 11, fontWeight: '700' },
  loader: { paddingVertical: 35 },
  messageCard: { alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 20, gap: 8 },
  errorText: { color: theme.danger, textAlign: 'center', fontSize: 12 },
  emptyTitle: { color: theme.text, textAlign: 'center', fontSize: 14, fontWeight: '800' },
  emptyBody: { color: theme.muted, textAlign: 'center', fontSize: 11, lineHeight: 17 },
  retryButton: { backgroundColor: theme.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9, marginTop: 4 },
  retryText: { color: theme.background, fontSize: 11, fontWeight: '800' },
  footnote: { color: theme.muted, textAlign: 'center', fontSize: 10, lineHeight: 15, marginTop: 12 },
});
