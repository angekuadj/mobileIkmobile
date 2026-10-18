import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import MatchCard from '../components/MatchCard';
import { Screen, useScreenStyles } from '../components/Screen';
import { useFixtures } from '../hooks/useFixtures';
import { getLocalDate, shiftDate } from '../lib/fixtures';
import { useTheme } from '../context/ThemeContext';
import { LocalizedText as Text } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../lib/localization';

export default function LiveAnalysisScreen() {
  const screenStyles = useScreenStyles();
  const { theme } = useTheme();
  const router = useRouter();
  const today = getLocalDate();
  const { fixtures, liveFixtures, isLoading, error, refetch } = useFixtures(today, shiftDate(today, 2), true);
  const available = [...liveFixtures, ...fixtures].filter((fixture, index, list) => list.findIndex(item => item.id === fixture.id) === index);
  return (
    <Screen eyebrow="ANALYSE DE MATCH" title="Analyse en direct">
      <View style={screenStyles.card}>
        <Text style={screenStyles.cardTitle}>Données de match disponibles</Text>
        <Text style={screenStyles.body}>Ouvrez une rencontre pour consulter les statistiques de match, les confrontations et le classement lorsqu’ils existent dans les données source. Aucune prédiction certaine n’est produite.</Text>
      </View>
      {isLoading ? <ActivityIndicator color={theme.primary} style={{ padding: 24 }} /> : error ? <View style={screenStyles.card}><Text style={{ color: theme.danger, fontSize: 12 }}>{error}</Text><TouchableOpacity onPress={refetch} style={{ marginTop: 10 }}><Text style={screenStyles.linkText}>Réessayer</Text></TouchableOpacity></View> : available.length ? available.map(fixture => <MatchCard fixture={fixture} key={fixture.id} />) : <View style={screenStyles.card}><Text style={screenStyles.body}>Aucune rencontre récente disponible pour l’analyse.</Text></View>}
      <TouchableOpacity style={screenStyles.secondaryButton} onPress={() => router.push('/(tabs)/matches')}><Text style={screenStyles.secondaryText}>Parcourir tout le calendrier</Text></TouchableOpacity>
    </Screen>
  );
}
