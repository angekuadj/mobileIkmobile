import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import MatchCard from '../components/MatchCard';
import { Screen, useScreenStyles } from '../components/Screen';
import { useFixtures } from '../hooks/useFixtures';
import { getLocalDate, shiftDate } from '../lib/fixtures';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../lib/theme';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../lib/localization';
import { LocalizedView as View } from '../lib/localization';

export default function SearchScreen() {
  const screenStyles = useScreenStyles();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [query, setQuery] = useState('');
  const today = getLocalDate();
  const { fixtures, liveFixtures, isLoading, error, refetch } = useFixtures(today, shiftDate(today, 13), true);
  const fixturesWithLiveStats = useMemo(() => {
    const merged = new Map(fixtures.map(fixture => [fixture.id, fixture]));
    liveFixtures.forEach(fixture => merged.set(fixture.id, fixture));
    return [...merged.values()];
  }, [fixtures, liveFixtures]);
  const matches = useMemo(() => {
    const value = query.trim().toLocaleLowerCase('fr-FR');
    if (!value) return fixturesWithLiveStats;
    return fixturesWithLiveStats.filter(fixture => `${fixture.homeTeam} ${fixture.awayTeam} ${fixture.league} ${fixture.competition}`.toLocaleLowerCase('fr-FR').includes(value));
  }, [fixturesWithLiveStats, query]);
  return (
    <Screen eyebrow="RECHERCHE DE RENCONTRES" title="Trouver un match">
      <View style={styles.search}>
        <MaterialIcons name="search" size={20} color={theme.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Équipe ou compétition" placeholderTextColor={theme.muted} style={styles.input} returnKeyType="search" />
      </View>
      <Text style={styles.caption}>Recherche dans les rencontres de football des 14 prochains jours. La recherche filtre le calendrier ; elle n’appelle pas un modèle d’intelligence artificielle.</Text>
      {isLoading ? <ActivityIndicator color={theme.primary} style={{ padding: 24 }} /> : error ? <View style={screenStyles.card}><Text style={{ color: theme.danger, fontSize: 12 }}>{error}</Text><Text onPress={refetch} style={[screenStyles.linkText, { marginTop: 9 }]}>Réessayer</Text></View> : matches.length ? matches.map(fixture => <MatchCard fixture={fixture} key={fixture.id} />) : <View style={screenStyles.card}><Text style={screenStyles.cardTitle}>Aucun résultat</Text><Text style={screenStyles.body}>Essayez un autre nom ou consultez le calendrier.</Text></View>}
    </Screen>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, height: 46, marginBottom: 10 },
  input: { flex: 1, color: theme.text, fontSize: 12 },
  caption: { color: theme.muted, fontSize: 10, lineHeight: 15, marginBottom: 12 },
});
