import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useCallback, useEffect, useRef, useState  } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import MatchCard from '../../components/MatchCard';
import FotMobAvatar from '../../components/FotMobAvatar';
import { Screen, useScreenStyles as useSharedScreenStyles } from '../../components/Screen';
import { useBasket } from '../../hooks/useBasket';
import { useGeneratedCombinations } from '../../hooks/useGeneratedCombinations';
import { useSavedSelections } from '../../hooks/useSavedSelections';
import { fetchFixtureStatuses, getFixtureScore, type Fixture } from '../../lib/fixtures';
import { getCouponOutcome, isFixtureFinished } from '../../lib/combinationOutcome';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../lib/theme';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../../lib/localization';
import { LocalizedAlert as Alert } from '../../lib/localization';
import { useLanguage } from '../../lib/localization';

const SAVED_PICK_LABELS: Record<string, string> = {
  home: 'Victoire domicile (1)',
  draw: 'Match nul (N)',
  away: 'Victoire extérieur (2)',
  'home-or-draw': 'Domicile ou nul (1X)',
  'away-or-draw': 'Extérieur ou nul (X2)',
  'either-win': 'Victoire d’une équipe (12)',
  'over-0.5': 'Plus de 0,5 but',
  'over-1.5': 'Plus de 1,5 buts',
  'over-2.5': 'Plus de 2,5 buts',
};

function ResultLine({ fixture }: { fixture: Fixture }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const score = getFixtureScore(fixture);
  if (!isFixtureFinished(fixture)) return <Text style={styles.pending}>En attente du résultat officiel</Text>;
  if (!score) return <Text style={styles.pending}>Terminé · score indisponible</Text>;
  const [home, away] = score.map(value => Number.parseInt(value, 10));
  const outcome = home === away ? 'draw' : home > away ? 'home' : 'away';
  if (!fixture.pick) return <Text style={styles.result}>Terminé · {score[0]}–{score[1]} · aucun choix enregistré</Text>;
  const won = fixture.pick === outcome;
  return <Text style={won ? styles.result : styles.lost}>{won ? 'Pronostic correct' : 'Pronostic non validé'} · {score[0]}–{score[1]}</Text>;
}

export default function BasketScreen() {
  const { language } = useLanguage();
  const dateLocale = language === 'fr' ? 'fr-FR' : 'en-US';
  const shared = useSharedScreenStyles();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const basket = useBasket();
  const saved = useSavedSelections();
  const generated = useGeneratedCombinations();
  const [title, setTitle] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [latestFixtures, setLatestFixtures] = useState<Fixture[]>([]);
  const fixturesRef = useRef(basket.fixtures);
  const selectionsRef = useRef(saved.selections);
  const combinationsRef = useRef(generated.combinations);
  fixturesRef.current = basket.fixtures;
  selectionsRef.current = saved.selections;
  combinationsRef.current = generated.combinations;
  const idsKey = basket.fixtures.map(fixture => fixture.id).join(',');
  const savedIdsKey = [...new Set(saved.selections.flatMap(selection => selection.fixtures.map(fixture => fixture.id)))].join(',');
  const generatedIdsKey = [...new Set(generated.combinations.flatMap(combination => combination.coupon.matches.map(match => match.fixtureId)))].join(',');

  const refreshStatuses = useCallback(async () => {
    const currentFixtures = fixturesRef.current;
    const savedFixtures = selectionsRef.current.flatMap(selection => selection.fixtures);
    const generatedFixtureIds = combinationsRef.current.flatMap(combination => combination.coupon.matches.map(match => match.fixtureId));
    const ids = [...new Set([...currentFixtures, ...savedFixtures].map(fixture => fixture.id).concat(generatedFixtureIds))];
    if (ids.length === 0) return;
    setStatusLoading(true);
    setStatusError('');
    try {
      const latest: Fixture[] = [];
      for (let offset = 0; offset < ids.length; offset += 100) {
        latest.push(...await fetchFixtureStatuses(ids.slice(offset, offset + 100)));
      }
      if (latest.length === 0) {
        setStatusError('Le serveur ne renvoie plus ces rencontres. Les dernières informations locales restent affichées.');
        return;
      }
      const latestById = new Map(latest.map(fixture => [fixture.id, fixture]));
      setLatestFixtures(current => {
        const merged = new Map(current.map(fixture => [fixture.id, fixture]));
        latest.forEach(fixture => merged.set(fixture.id, fixture));
        return [...merged.values()];
      });
      const updated = currentFixtures.map(fixture => {
        const latestFixture = latestById.get(fixture.id);
        return latestFixture ? { ...latestFixture, pick: fixture.pick } : fixture;
      });
      if (updated.some((fixture, index) => JSON.stringify(fixture) !== JSON.stringify(currentFixtures[index]))) {
        await basket.replaceFixtures(updated);
      }
      await saved.updateFixtureStatuses(latest);
      if (latest.length < ids.length) setStatusError('Certaines rencontres ne sont plus disponibles ; leurs dernières données locales sont conservées.');
    } catch (error) {
      setStatusError(error instanceof TypeError
        ? 'Impossible d’actualiser les scores. Vérifiez la connexion au serveur.'
        : error instanceof Error ? error.message : 'Impossible d’actualiser les scores.');
    } finally {
      setStatusLoading(false);
    }
  }, [basket.replaceFixtures, saved.updateFixtureStatuses]);

  useEffect(() => {
    if (!basket.isLoading && !saved.isLoading && (idsKey || savedIdsKey || generatedIdsKey)) void refreshStatuses();
  }, [basket.isLoading, generatedIdsKey, idsKey, saved.isLoading, savedIdsKey, refreshStatuses]);

  const saveBasket = async () => {
    try {
      await saved.save(basket.fixtures, title || 'Ma sélection');
      setTitle('');
      Alert.alert('Sélection enregistrée', 'Elle est conservée dans votre panier.');
      await basket.clearBasket();
    } catch (error) {
      Alert.alert('Impossible d’enregistrer', error instanceof Error ? error.message : 'Réessayez.');
    }
  };

  const removeSaved = (id: string) => {
    Alert.alert('Supprimer cette sélection ?', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { void saved.remove(id); } },
    ]);
  };

  return (
    <Screen eyebrow="VOS SÉLECTIONS" title="Mon panier">
      <View style={shared.card}>
        <View style={styles.savedHeading}>
          <Text style={[shared.cardTitle, { flex: 1, marginBottom: 0 }]}>Sélection en cours · {basket.fixtures.length}/20</Text>
          <TouchableOpacity disabled={statusLoading || (basket.fixtures.length === 0 && saved.selections.length === 0)} onPress={() => { void refreshStatuses(); }} accessibilityLabel="Actualiser les résultats">
            <MaterialIcons name="refresh" size={21} color={statusLoading ? theme.muted : theme.primary} />
          </TouchableOpacity>
        </View>
        <Text style={shared.body}>Choisissez un résultat 1/N/2 pour chaque rencontre. L’application compare ensuite ce choix au score final fourni par le serveur. Aucun pari, mise ou gain n’est enregistré.</Text>
      </View>
      {basket.error ? <Text style={styles.error}>{basket.error}</Text> : null}
      {statusLoading ? <ActivityIndicator color={theme.primary} style={{ marginBottom: 10 }} /> : null}
      {statusError ? <Text style={styles.statusError}>{statusError}</Text> : null}
      {generated.error ? <Text style={styles.error}>{generated.error}</Text> : null}
      {basket.fixtures.length === 0 ? (
        <TouchableOpacity style={styles.empty} onPress={() => router.push('/(tabs)/matches')}>
          <MaterialIcons name="add-circle-outline" size={27} color={theme.primary} />
          <Text style={styles.emptyTitle}>Votre panier est vide</Text>
          <Text style={styles.emptyBody}>Parcourir le calendrier pour choisir jusqu’à 20 rencontres.</Text>
        </TouchableOpacity>
      ) : (
        <>
          {basket.fixtures.map(fixture => (
            <View key={fixture.id}>
              <MatchCard fixture={fixture} selected onToggle={() => { void basket.removeFixture(fixture.id); }} />
              <View style={styles.pickRow}>
                <Text style={styles.pickLabel}>Résultat</Text>
                {([
                  ['home', '1'],
                  ['draw', 'N'],
                  ['away', '2'],
                ] as const).map(([pick, label]) => (
                  <TouchableOpacity
                    key={pick}
                    onPress={() => { void basket.setFixturePick(fixture.id, pick); }}
                    style={[styles.pickButton, fixture.pick === pick && styles.pickButtonActive]}
                    accessibilityLabel={`Choisir ${label}`}
                  >
                    <Text style={[styles.pickText, fixture.pick === pick && styles.pickTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
                {!fixture.pick ? <Text style={styles.noPick}>Non choisi</Text> : null}
              </View>
              <View style={styles.resultRow}><ResultLine fixture={fixture} /></View>
            </View>
          ))}
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Nom de la sélection (facultatif)"
            placeholderTextColor={theme.muted}
            style={styles.input}
            maxLength={50}
          />
          <TouchableOpacity style={shared.button} onPress={() => { void saveBasket(); }}>
            <Text style={shared.buttonText}>Enregistrer la sélection et vider le panier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={shared.secondaryButton} onPress={() => { void basket.clearBasket(); }}>
            <Text style={shared.secondaryText}>Vider sans enregistrer</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.sectionTitle}>Combinaisons enregistrées · {generated.combinations.length}</Text>
      {generated.isLoading ? <ActivityIndicator color={theme.primary} /> : generated.combinations.length === 0 ? (
        <View style={shared.card}>
          <Text style={shared.body}>Enregistrez une suggestion depuis l’écran Combinaisons pour la retrouver ici.</Text>
        </View>
      ) : generated.combinations.map(combination => {
        const outcome = getCouponOutcome(combination.coupon, new Map(latestFixtures.map(fixture => [fixture.id, fixture])));
        return (
          <View style={styles.combinationCard} key={combination.id}>
            <View style={styles.savedHeading}>
              <View style={{ flex: 1 }}>
                <Text style={styles.savedTitle}>{combination.coupon.title}</Text>
                <Text style={styles.savedDate}>
                  {new Date(combination.createdAt).toLocaleDateString(dateLocale)} · {language === 'fr'
                    ? `${combination.coupon.matches.length} rencontre${combination.coupon.matches.length === 1 ? '' : 's'}`
                    : `${combination.coupon.matches.length} match${combination.coupon.matches.length === 1 ? '' : 'es'}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => {
                Alert.alert('Supprimer cette combinaison ?', 'Cette action est définitive.', [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: () => { void generated.remove(combination.id).catch(removeError => Alert.alert('Erreur', removeError instanceof Error ? removeError.message : 'Impossible de supprimer la combinaison.')); } },
                ]);
              }} accessibilityLabel="Supprimer la combinaison enregistrée">
                <MaterialIcons name="delete-outline" size={21} color={theme.danger} />
              </TouchableOpacity>
            </View>
            <Text style={styles.combinationDescription}>{combination.coupon.description}</Text>
            <Text style={[
              styles.combinationOutcome,
              outcome === 'won' ? styles.result : outcome === 'lost' ? styles.lost : styles.pending,
            ]}>
              {outcome === 'won' ? 'Combinaison validée' : outcome === 'lost' ? 'Combinaison non validée' : 'Résultats en attente'}
            </Text>
            {combination.coupon.matches.map((match, index) => {
              const fixture = latestFixtures.find(item => item.id === match.fixtureId);
              const score = fixture && isFixtureFinished(fixture) ? getFixtureScore(fixture) : null;
              return (
                <View style={styles.savedFixture} key={`${match.fixtureId}-${index}`}>
                  <View style={styles.savedFixtureMeta}>
                    <Text style={styles.savedFixtureLeague} numberOfLines={1}>
                      {fixture?.competition || fixture?.league || 'Football'}
                    </Text>
                    <Text style={styles.savedFixtureStatus}>
                      {score ? `Terminé · ${score[0]}–${score[1]}` : fixture?.status || 'En attente'}
                    </Text>
                  </View>
                  <View style={styles.savedTeams}>
                    <View style={styles.savedTeam}>
                      <FotMobAvatar imageUrl={fixture?.homeImageUrl} name={match.homeTeam} size={34} />
                      <Text numberOfLines={2} style={styles.savedTeamName} translate={false}>{match.homeTeam}</Text>
                    </View>
                    <View style={styles.savedVersus}>
                      <Text style={styles.savedVersusText}>{score ? `${score[0]}–${score[1]}` : 'VS'}</Text>
                    </View>
                    <View style={styles.savedTeam}>
                      <FotMobAvatar imageUrl={fixture?.awayImageUrl} name={match.awayTeam} size={34} />
                      <Text numberOfLines={2} style={styles.savedTeamName} translate={false}>{match.awayTeam}</Text>
                    </View>
                  </View>
                  <View style={styles.savedPicks}>
                    {match.picks.map((pick, pickIndex) => (
                      <View style={styles.savedPickChip} key={`${pick.market}-${pickIndex}`}>
                        <Text style={styles.savedPickMarket}>{pick.market === 'goals' ? 'BUTS' : 'RÉSULTAT'}</Text>
                        <Text style={styles.savedPick}>
                          {pick.selection ? SAVED_PICK_LABELS[pick.selection] || pick.selection : 'Historique insuffisant'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Sélections enregistrées · {saved.selections.length}</Text>
      {saved.selections.length === 0 ? (
        <View style={shared.card}><Text style={shared.body}>Les sélections sauvegardées apparaîtront ici et suivront votre compte.</Text></View>
      ) : saved.selections.map(selection => (
        <View style={shared.card} key={selection.id}>
          <View style={styles.savedHeading}>
            <View style={{ flex: 1 }}>
              <Text style={styles.savedTitle}>{selection.title}</Text>
              <Text style={styles.savedDate}>
                {new Date(selection.savedAt).toLocaleDateString(dateLocale)} · {language === 'fr'
                  ? `${selection.fixtures.length} rencontre${selection.fixtures.length === 1 ? '' : 's'}`
                  : `${selection.fixtures.length} match${selection.fixtures.length === 1 ? '' : 'es'}`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => removeSaved(selection.id)} accessibilityLabel="Supprimer la sélection enregistrée">
              <MaterialIcons name="delete-outline" size={21} color={theme.danger} />
            </TouchableOpacity>
          </View>
          {selection.fixtures.map(fixture => (
            <View style={styles.savedFixture} key={fixture.id}>
              <Text style={styles.fixtureName} translate={false}>{fixture.homeTeam} – {fixture.awayTeam}</Text>
              <ResultLine fixture={fixture} />
            </View>
          ))}
        </View>
      ))}
      <Text style={styles.disclaimer}>Un résultat de match ne détermine pas un gain : aucune mise, cote finale ou transaction n’est enregistrée dans l’application.</Text>
    </Screen>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  empty: { alignItems: 'center', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, marginBottom: 18 },
  emptyTitle: { color: theme.text, fontSize: 14, fontWeight: '800', marginTop: 10 },
  emptyBody: { color: theme.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  error: { color: theme.danger, fontSize: 11, marginBottom: 10 },
  statusError: { color: theme.warning, fontSize: 10, lineHeight: 15, marginBottom: 10 },
  resultRow: { marginTop: -5, marginBottom: 10, paddingHorizontal: 9 },
  pending: { color: theme.warning, fontSize: 10 },
  result: { color: theme.primary, fontSize: 10, fontWeight: '800' },
  lost: { color: theme.danger, fontSize: 10, fontWeight: '800' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: -2, marginBottom: 4, paddingHorizontal: 8 },
  pickLabel: { color: theme.muted, fontSize: 10, fontWeight: '700', marginRight: 2 },
  pickButton: { minWidth: 29, alignItems: 'center', paddingVertical: 5, borderRadius: 7, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  pickButtonActive: { backgroundColor: theme.primaryDark, borderColor: theme.primary },
  pickText: { color: theme.muted, fontSize: 10, fontWeight: '800' },
  pickTextActive: { color: theme.text },
  noPick: { color: theme.muted, fontSize: 9 },
  input: { color: theme.text, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, minHeight: 46, paddingHorizontal: 13, fontSize: 12, marginBottom: 10 },
  sectionTitle: { color: theme.text, fontSize: 16, fontWeight: '900', marginTop: 14, marginBottom: 10 },
  savedHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  savedTitle: { color: theme.text, fontSize: 13, fontWeight: '800' },
  savedDate: { color: theme.muted, fontSize: 10, marginTop: 3 },
  combinationCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 17, padding: 14, marginBottom: 12 },
  combinationDescription: { color: theme.text, fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 2 },
  combinationOutcome: { fontSize: 10, marginTop: 5, marginBottom: 2 },
  savedFixture: { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 9, marginTop: 8 },
  savedFixtureMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  savedFixtureLeague: { flex: 1, color: theme.muted, fontSize: 9, fontWeight: '700' },
  savedFixtureStatus: { color: theme.primary, fontSize: 9, fontWeight: '700' },
  savedTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 9 },
  savedTeam: { flex: 1, alignItems: 'center', gap: 5 },
  savedTeamName: { color: theme.text, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  savedVersus: { minWidth: 42, minHeight: 32, borderRadius: 10, backgroundColor: theme.surfaceRaised, alignItems: 'center', justifyContent: 'center', marginHorizontal: 6 },
  savedVersusText: { color: theme.primary, fontSize: 10, fontWeight: '900' },
  savedPicks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  savedPickChip: { flexGrow: 1, flexBasis: '45%', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, backgroundColor: theme.surfaceRaised, borderWidth: 1, borderColor: theme.border },
  savedPickMarket: { color: theme.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.6 },
  savedPick: { color: theme.text, fontSize: 9, fontWeight: '700', marginTop: 3 },
  fixtureName: { color: theme.text, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  disclaimer: { color: theme.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 10, marginBottom: 10 },
});
