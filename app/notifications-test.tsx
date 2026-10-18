import { MaterialIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet } from 'react-native';
import { Screen, useScreenStyles } from '../components/Screen';
import type { FavoriteAlertKey } from '../context/FavoritesContext';
import { useTheme } from '../context/ThemeContext';
import { NOTIFICATION_TEST_FIXTURE } from '../lib/matchNotificationText';
import type { Theme } from '../lib/theme';
import {
  notificationAlertLabels,
  notificationTestSamples,
  requestMatchNotificationPermission,
  sendMatchNotificationTests,
} from '../services/matchNotifications';
import { LocalizedText as Text } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../lib/localization';
import { useLanguage } from '../lib/localization';

type SendState = FavoriteAlertKey | null;
type Feedback = { tone: 'success' | 'error'; text: string } | null;

export default function NotificationsTestScreen() {
  const { t } = useLanguage();
  const shared = useScreenStyles();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const samples = useMemo(() => notificationTestSamples(), []);
  const labels = notificationAlertLabels();
  const [sending, setSending] = useState<SendState>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [permission, setPermission] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    Notifications.getPermissionsAsync()
      .then(result => { if (active) setPermission(result.granted); })
      .catch(error => {
        console.error('Unable to read notification permission:', error);
        if (active) setPermission(false);
      });
    return () => { active = false; };
  }, []);

  const runTest = async (keys: FavoriteAlertKey[], state: FavoriteAlertKey) => {
    setSending(state);
    setFeedback(null);
    try {
      if (Platform.OS === 'web') {
        setFeedback({ tone: 'error', text: 'Le test de notifications n’est pas disponible sur le web : lancez l’application sur un téléphone.' });
        return;
      }
      const granted = await sendMatchNotificationTests(keys);
      setPermission(granted);
      if (!granted) {
        setFeedback({ tone: 'error', text: 'Autorisez les notifications IKProno dans les réglages de votre appareil, puis relancez le test.' });
        return;
      }
      setFeedback({
        tone: 'success',
        text: 'Notification envoyée : elle apparaît sur votre appareil dans les prochaines secondes.',
      });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Impossible d’envoyer le test de notifications.' });
      console.error('Unable to send match notification test:', error);
    } finally {
      setSending(null);
    }
  };

  return (
    <Screen eyebrow="ALERTE EN DIRECT" title="Test des notifications">
      <View style={styles.notice}>
        <MaterialIcons name="notifications-active" size={21} color={theme.primary} />
        <Text style={styles.noticeText}>
          Voici exactement comment les alertes apparaissent pendant un match : coup d’envoi, buts, cartons et fin de rencontre, avec le son IKProno. Le test utilise un match de démonstration (Paris SG – Marseille) et les mêmes textes que les vraies alertes.
        </Text>
      </View>

      <View style={styles.permissionRow}>
        <MaterialIcons
          name={permission === null ? 'hourglass-top' : permission ? 'check-circle' : 'error-outline'}
          size={16}
          color={permission === null ? theme.muted : permission ? theme.primary : theme.warning}
        />
        <Text style={styles.permissionText}>
          {permission === null
            ? 'Vérification de l’autorisation de notifications…'
            : permission
              ? 'Notifications autorisées sur cet appareil.'
              : 'Notifications non autorisées : les alertes en direct ne peuvent pas être affichées.'}
        </Text>
      </View>

      {feedback ? (
        <Text accessibilityRole="alert" style={[styles.feedback, feedback.tone === 'error' && styles.feedbackError]}>
          {feedback.text}
        </Text>
      ) : null}

      <Text style={styles.sectionTitle}>Aperçu des notifications</Text>
      {samples.map(sample => (
        <View key={sample.key} style={styles.previewCard}>
          <View style={styles.previewHeading}>
            <Text style={styles.previewEmoji}>{sample.emoji}</Text>
            <Text style={styles.previewLabel}>{sample.label}</Text>
          </View>
          <View style={styles.banner}>
            <View style={styles.bannerHeader}>
              <View style={[styles.bannerIcon, { backgroundColor: sample.color }]}><MaterialIcons name="sports-soccer" size={13} color="#ffffff" /></View>
              <Text style={styles.bannerApp}>IKProno · Football</Text>
              <Text style={styles.bannerTime}>à l’instant</Text>
            </View>
            <View style={[styles.notificationContent, { borderLeftColor: sample.color }]}>
              {sample.scorer?.playerImageUrl ? (
                <View style={styles.scorerRow}>
                  <Image
                    accessibilityLabel={`${t('Photo de')} ${sample.scorer.player}`}
                    source={{ uri: sample.scorer.playerImageUrl }}
                    style={styles.scorerImage}
                  />
                  <View style={styles.scorerCopy}>
                    <Text numberOfLines={1} style={styles.bannerTitle} translate={false}>{sample.scorer.player}</Text>
                    <Text style={styles.scorerLabel}>Buteur · {NOTIFICATION_TEST_FIXTURE.liveTime}</Text>
                  </View>
                </View>
              ) : null}
              <Text numberOfLines={1} style={styles.bannerTitle}>{sample.title}</Text>
              <Text numberOfLines={3} style={styles.bannerBody}>{sample.body}</Text>
            </View>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Envoyer le test de notification ${sample.label}`}
            disabled={sending !== null}
            style={styles.sendButton}
            onPress={() => { void runTest([sample.key], sample.key); }}
          >
            {sending === sample.key
              ? <ActivityIndicator size="small" color={theme.primary} />
              : <MaterialIcons name="send" size={15} color={theme.primary} />}
            <Text style={styles.sendText}>{sending === sample.key ? 'Envoi…' : 'Envoyer ce test'}</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Alertes configurables</Text>
      <View style={shared.card}>
        <Text style={shared.body}>
          Dans l’onglet Favoris, chaque match suivi propose un interrupteur par événement : {labels.map(label => label.label).join(', ')}. Touchez la cloche sur une carte de rencontre pour activer toutes ces alertes en direct d’un seul geste.
        </Text>
      </View>

      <Text style={styles.disclaimer}>
        Ce test envoie des notifications locales avec le son IKProno depuis votre appareil : aucun serveur ni autre utilisateur n’est concerné. Les alertes de but affichent le nom, la minute et la photo du buteur lorsqu’elle est disponible. Les vraies alertes sont déclenchées lorsque les scores ou les cartons du match évoluent, avec une vérification toutes les 15 minutes au maximum en arrière-plan selon les réglages de batterie d’iOS ou d’Android.
      </Text>
    </Screen>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.accentSurface, borderWidth: 1, borderColor: theme.accentBorder, borderRadius: 13, padding: 13, marginBottom: 13 },
  noticeText: { flex: 1, color: theme.text, fontSize: 11, lineHeight: 16 },
  permissionRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  permissionText: { flex: 1, color: theme.muted, fontSize: 11 },
  feedback: { color: theme.primary, fontSize: 11, lineHeight: 16, marginBottom: 14 },
  feedbackError: { color: theme.danger },
  sectionTitle: { color: theme.text, fontSize: 14, fontWeight: '800', marginTop: 6, marginBottom: 10 },
  previewCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 13, marginBottom: 12 },
  previewHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 },
  previewEmoji: { fontSize: 13 },
  previewLabel: { color: theme.text, fontSize: 12, fontWeight: '800' },
  banner: { backgroundColor: theme.surfaceRaised, borderRadius: 14, borderWidth: 1, borderColor: theme.accentBorder, overflow: 'hidden' },
  bannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 },
  bannerIcon: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primaryDark },
  bannerApp: { color: theme.muted, fontSize: 10, fontWeight: '700', flex: 1 },
  bannerTime: { color: theme.muted, fontSize: 10 },
  notificationContent: { borderLeftWidth: 3, borderLeftColor: theme.primary, paddingLeft: 10, marginBottom: 12 },
  scorerRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 },
  scorerImage: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.surface },
  scorerCopy: { flex: 1 },
  scorerLabel: { color: theme.muted, fontSize: 10, marginTop: 2 },
  bannerTitle: { color: theme.text, fontSize: 13, fontWeight: '800', marginBottom: 3 },
  bannerBody: { color: theme.muted, fontSize: 12, lineHeight: 18 },
  sendButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: theme.accentBorder },
  sendText: { color: theme.primary, fontSize: 12, fontWeight: '800' },
  disclaimer: { color: theme.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
});
