import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../lib/theme';
import { LocalizedText as Text } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../lib/localization';

export function Screen({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createScreenStyles(theme), [theme]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Retour"
        onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
        style={styles.back}
      >
        <MaterialIcons name="arrow-back" size={18} color={theme.primary} />
        <Text style={styles.backText}>Retour</Text>
      </TouchableOpacity>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {children}
    </ScrollView>
  );
}

export function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  const screenStyles = useScreenStyles();
  return (
    <View style={screenStyles.card}>
      <Text style={screenStyles.cardTitle}>{title}</Text>
      {typeof children === 'string' ? <Text style={screenStyles.body}>{children}</Text> : children}
    </View>
  );
}

const createSharedStyles = (theme: Theme) => StyleSheet.create({
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 16, marginBottom: 11 },
  cardTitle: { color: theme.text, fontSize: 14, fontWeight: '800', marginBottom: 7 },
  body: { color: theme.muted, fontSize: 12, lineHeight: 19 },
  button: { alignItems: 'center', backgroundColor: theme.primaryDark, borderRadius: 12, padding: 14, marginBottom: 10 },
  buttonText: { color: theme.text, fontSize: 13, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 13, marginBottom: 10 },
  secondaryText: { color: theme.primary, fontSize: 12, fontWeight: '800' },
  warning: { color: theme.warning, fontSize: 11, lineHeight: 17 },
  label: { color: theme.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  linkText: { color: theme.primary, fontSize: 12, fontWeight: '800' },
});

export function useScreenStyles() {
  const { theme } = useTheme();
  return useMemo(() => createSharedStyles(theme), [theme]);
}

const createScreenStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: 18, paddingBottom: 40 },
  eyebrow: { color: theme.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.3, marginTop: 3 },
  title: { color: theme.text, fontSize: 27, fontWeight: '900', marginTop: 3, marginBottom: 18 },
  back: { alignSelf: 'flex-start', minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 8, borderRadius: 11, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  backText: { color: theme.primary, fontSize: 12, fontWeight: '800' },
});
