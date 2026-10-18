import { useMemo } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import MatchCard from '../../components/MatchCard';
import { useFixtures } from '../../hooks/useFixtures';
import { getFixtureScore, getLocalDate, isUpcomingFixture, shiftDate, sortFixtures } from '../../lib/fixtures';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../lib/theme';
import { LocalizedText as Text } from '../../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../../lib/localization';
import { LocalizedAlert as Alert, useLanguage } from '../../lib/localization';

export default function HomeScreen() {
  const { language, setLanguage, t } = useLanguage();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const today = getLocalDate();
  const { liveFixtures, fixtures, isLoading, error, refetch } = useFixtures(today, shiftDate(today, 6), true);
  const upcomingFixtures = useMemo(
    () => sortFixtures(fixtures.filter(isUpcomingFixture)).slice(0, 4),
    [fixtures]
  );
  const liveFixturesWithScoresFirst = useMemo(
    () => [...liveFixtures].sort((first, second) =>
      Number(Boolean(getFixtureScore(second))) - Number(Boolean(getFixtureScore(first)))
    ),
    [liveFixtures]
  );
  const changeLanguage = (nextLanguage: 'fr' | 'en') => {
    void setLanguage(nextLanguage).catch(error => {
      console.error('Unable to save language preference:', error);
      Alert.alert(
        t('Préférence non enregistrée'),
        t('La langue n’a pas pu être sauvegardée. Vérifiez le stockage de votre appareil puis réessayez.')
      );
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand}>IK<Text style={styles.brandAccent}>PRONO</Text></Text>
          <Text style={styles.tagline}>Le calendrier du sport, en un coup d’œil.</Text>
        </View>
        <View style={styles.topBarActions}>
          <View style={styles.languageSwitch} accessibilityRole="radiogroup" accessibilityLabel={t('Langue de l’application')}>
            {([
              ['fr', 'FR', 'Français'],
              ['en', 'EN', 'English'],
            ] as const).map(([value, label, languageName]) => (
              <TouchableOpacity
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: language === value }}
                accessibilityLabel={t(languageName)}
                style={[styles.languageSwitchOption, language === value && styles.languageSwitchOptionActive]}
                onPress={() => changeLanguage(value)}
              >
                <Text style={[styles.languageSwitchText, language === value && styles.languageSwitchTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.refresh} onPress={refetch} accessibilityLabel="Actualiser les rencontres">
            <MaterialIcons name="refresh" size={21} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}><MaterialIcons name="insights" size={22} color={theme.primary} /></View>
          <Text style={styles.heroEyebrow}>VOTRE ESPACE SPORT</Text>
        </View>
        <Text style={styles.heroTitle}>Suivez les rencontres.{'\n'}Préparez vos sélections.</Text>
        <Text style={styles.heroDescription}>
          Consultez le calendrier du football, explorez les cotes disponibles et construisez une combinaison à votre rythme.
        </Text>
        <TouchableOpacity style={styles.heroButton} onPress={() => router.push('/(tabs)/matches')}>
          <Text style={styles.heroButtonText}>Parcourir les rencontres</Text>
          <MaterialIcons name="arrow-forward" size={18} color={theme.background} />
        </TouchableOpacity>
      </View>

      <View style={styles.quickLinks}>
        <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/(tabs)/matches')}>
          <View style={[styles.quickIcon, { backgroundColor: theme.accentSurface }]}><MaterialIcons name="sports-soccer" size={21} color={theme.primary} /></View>
          <Text style={styles.quickTitle}>Rencontres</Text>
          <Text style={styles.quickSubtitle}>Calendrier & scores</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/(tabs)/predictions')}>
          <View style={[styles.quickIcon, { backgroundColor: theme.accentSurface }]}><MaterialIcons name="auto-awesome" size={21} color={theme.primary} /></View>
          <Text style={styles.quickTitle}>Combinaisons</Text>
          <Text style={styles.quickSubtitle}>Suggestions par risque</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.utilityLinks}>
        <TouchableOpacity style={styles.utilityLink} onPress={() => router.push('/(tabs)/basket')}>
          <MaterialIcons name="playlist-add-check" size={17} color={theme.primary} />
          <Text style={styles.utilityText}>Mon panier</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.utilityLink} onPress={() => router.push('/live')}>
          <MaterialIcons name="sensors" size={17} color={theme.primary} />
          <Text style={styles.utilityText}>Scores live</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.utilityLink} onPress={() => router.push('/ai-search')}>
          <MaterialIcons name="search" size={17} color={theme.primary} />
          <Text style={styles.utilityText}>Recherche</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.utilityLink} onPress={() => router.push('/(tabs)/favorites')}>
          <MaterialIcons name="favorite" size={17} color={theme.primary} />
          <Text style={styles.utilityText}>Favoris</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>EN CE MOMENT</Text>
          <Text style={styles.sectionTitle}>En direct</Text>
        </View>
        <TouchableOpacity onPress={refetch}><Text style={styles.link}>Actualiser</Text></TouchableOpacity>
      </View>
      {isLoading ? (
        <ActivityIndicator color={theme.primary} style={styles.loader} />
      ) : error ? (
        <View style={styles.messageCard}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refetch}><Text style={styles.link}>Réessayer</Text></TouchableOpacity>
        </View>
      ) : liveFixtures.length === 0 ? (
        <View style={styles.messageCard}>
          <View style={styles.emptyIcon}><MaterialIcons name="schedule" size={22} color={theme.muted} /></View>
          <Text style={styles.messageTitle}>Aucune rencontre en direct</Text>
          <Text style={styles.messageBody}>Les matchs en cours apparaîtront ici.</Text>
        </View>
      ) : (
        liveFixturesWithScoresFirst.slice(0, 3).map(fixture => <MatchCard key={fixture.id} fixture={fixture} />)
      )}

      <View style={[styles.sectionHeader, styles.upcomingHeader]}>
        <View>
          <Text style={styles.sectionEyebrow}>À NE PAS MANQUER</Text>
          <Text style={styles.sectionTitle}>À venir</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/matches')}><Text style={styles.link}>Tout voir</Text></TouchableOpacity>
      </View>
      {!isLoading && upcomingFixtures.length === 0 ? (
        <View style={styles.messageCard}>
          <Text style={styles.messageTitle}>Pas de match programmé</Text>
          <Text style={styles.messageBody}>Essayez une autre période dans le calendrier.</Text>
        </View>
      ) : upcomingFixtures.map(fixture => <MatchCard key={fixture.id} fixture={fixture} />)}
      <Text style={styles.disclaimer}>Les suggestions sont indicatives et ne garantissent aucun résultat.</Text>
    </ScrollView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 36 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  languageSwitch: { flexDirection: 'row', padding: 3, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  languageSwitchOption: { minWidth: 34, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingHorizontal: 7 },
  languageSwitchOptionActive: { backgroundColor: theme.accentSurface },
  languageSwitchText: { color: theme.muted, fontSize: 10, fontWeight: '800' },
  languageSwitchTextActive: { color: theme.primary },
  brand: { color: theme.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.7 },
  brandAccent: { color: theme.primary },
  tagline: { color: theme.muted, fontSize: 11, marginTop: 3 },
  refresh: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  hero: { backgroundColor: theme.surface, borderRadius: 22, borderWidth: 1, borderColor: theme.accentBorder, padding: 20, marginBottom: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  heroIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: theme.accentSurface, alignItems: 'center', justifyContent: 'center' },
  heroEyebrow: { color: theme.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: theme.text, fontSize: 25, fontWeight: '900', lineHeight: 31, marginTop: 17, letterSpacing: -0.5 },
  heroDescription: { color: theme.muted, fontSize: 13, lineHeight: 20, marginTop: 10 },
  heroButton: { backgroundColor: theme.primaryDark, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 18 },
  heroButtonText: { color: theme.text, fontWeight: '800', fontSize: 12 },
  quickLinks: { flexDirection: 'row', gap: 11, marginBottom: 28 },
  quickLink: { flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 13 },
  quickIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  quickTitle: { color: theme.text, fontSize: 13, fontWeight: '800' },
  quickSubtitle: { color: theme.muted, fontSize: 10, marginTop: 4 },
  utilityLinks: { flexDirection: 'row', gap: 8, marginTop: -16, marginBottom: 25 },
  utilityLink: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, minHeight: 36, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: 10 },
  utilityText: { color: theme.text, fontSize: 10, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  upcomingHeader: { marginTop: 24 },
  sectionEyebrow: { color: theme.primary, fontSize: 9, letterSpacing: 1.2, fontWeight: '800' },
  sectionTitle: { color: theme.text, fontSize: 20, fontWeight: '800', marginTop: 3 },
  link: { color: theme.primary, fontSize: 12, fontWeight: '700', paddingVertical: 5 },
  loader: { paddingVertical: 26 },
  messageCard: { borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, padding: 19, alignItems: 'center' },
  emptyIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: theme.surfaceRaised, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  messageTitle: { color: theme.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  messageBody: { color: theme.muted, fontSize: 12, textAlign: 'center', marginTop: 5 },
  errorText: { color: theme.danger, fontSize: 12, textAlign: 'center', marginBottom: 6 },
  disclaimer: { color: theme.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 18 },
});
