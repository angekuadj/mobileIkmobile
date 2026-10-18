import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MatchCard from '../components/MatchCard';
import { Screen, useScreenStyles } from '../components/Screen';
import { useFixtures } from '../hooks/useFixtures';
import { getLocalDate, shiftDate } from '../lib/fixtures';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../lib/theme';
import { LocalizedText as Text } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../lib/localization';

export default function LiveScreen() {
  const pageSize = 5;
  const [page, setPage] = useState(1);
  const screenStyles = useScreenStyles();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const today = getLocalDate();
  const { liveFixtures, isLoading, error, refetch } = useFixtures(today, shiftDate(today, 1), true);
  const pageCount = Math.ceil(liveFixtures.length / pageSize);
  const currentPage = Math.min(page, Math.max(pageCount, 1));
  const visibleFixtures = liveFixtures.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return (
    <Screen eyebrow="SCORES ACTUELS" title="En direct">
      <View style={styles.notice}>
        <MaterialIcons name="notifications-none" size={19} color={theme.primary} />
        <Text style={styles.noticeText}>Touchez la cloche d’une rencontre pour recevoir ses événements en direct : coup d’envoi, buts, cartons et fin du match.</Text>
      </View>
      <TouchableOpacity accessibilityRole="link" style={styles.testLink} onPress={() => router.push('/notifications-test')}>
        <MaterialIcons name="notification-add" size={16} color={theme.primary} />
        <Text style={screenStyles.linkText}>Voir et tester les notifications (but, carton)</Text>
      </TouchableOpacity>
      <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 17, marginBottom: 14 }}>Scores et statuts sont actualisés automatiquement. Les mises à jour dépendent des données disponibles sur le serveur.</Text>
      {isLoading ? <ActivityIndicator color={theme.primary} style={{ padding: 24 }} /> : error ? <View style={screenStyles.card}><Text style={{ color: theme.danger, fontSize: 12 }}>{error}</Text><TouchableOpacity onPress={refetch} style={{ marginTop: 10 }}><Text style={screenStyles.linkText}>Réessayer</Text></TouchableOpacity></View> : liveFixtures.length ? (
        <>
          {visibleFixtures.map(fixture => <MatchCard fixture={fixture} key={fixture.id} />)}
          {pageCount > 1 ? (
            <View style={styles.pagination}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Page précédente"
                accessibilityState={{ disabled: currentPage === 1 }}
                disabled={currentPage === 1}
                style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
                onPress={() => setPage(currentPage - 1)}
              >
                <MaterialIcons name="chevron-left" size={20} color={currentPage === 1 ? theme.muted : theme.primary} />
                <Text style={[styles.pageButtonText, currentPage === 1 && styles.pageButtonTextDisabled]}>Précédent</Text>
              </TouchableOpacity>
              <View style={styles.pageIndicator}>
                <Text style={styles.pageNumber}>{currentPage}</Text>
                <Text style={styles.pageDivider}>/</Text>
                <Text style={styles.pageTotal}>{pageCount}</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Page suivante"
                accessibilityState={{ disabled: currentPage === pageCount }}
                disabled={currentPage === pageCount}
                style={[styles.pageButton, currentPage === pageCount && styles.pageButtonDisabled]}
                onPress={() => setPage(currentPage + 1)}
              >
                <Text style={[styles.pageButtonText, currentPage === pageCount && styles.pageButtonTextDisabled]}>Suivant</Text>
                <MaterialIcons name="chevron-right" size={20} color={currentPage === pageCount ? theme.muted : theme.primary} />
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      ) : <View style={screenStyles.card}><Text style={screenStyles.cardTitle}>Aucun match en direct</Text><Text style={screenStyles.body}>Les rencontres actives apparaîtront ici.</Text></View>}
    </Screen>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.accentSurface, borderWidth: 1, borderColor: theme.accentBorder, borderRadius: 13, padding: 13, marginBottom: 10 },
  noticeText: { flex: 1, color: theme.text, fontSize: 11, lineHeight: 16 },
  testLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: theme.accentBorder, borderRadius: 12, paddingVertical: 11, marginBottom: 14 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 8, marginTop: 2, marginBottom: 12 },
  pageButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 10, paddingHorizontal: 8 },
  pageButtonDisabled: { opacity: 0.45 },
  pageButtonText: { color: theme.primary, fontSize: 11, fontWeight: '800' },
  pageButtonTextDisabled: { color: theme.muted },
  pageIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pageNumber: { color: theme.text, fontSize: 13, fontWeight: '900' },
  pageDivider: { color: theme.muted, fontSize: 12 },
  pageTotal: { color: theme.muted, fontSize: 12, fontWeight: '700' },
});
