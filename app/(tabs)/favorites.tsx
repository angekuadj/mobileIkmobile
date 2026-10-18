import { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Switch } from 'react-native';
import MatchCard from '../../components/MatchCard';
import { Screen, useScreenStyles } from '../../components/Screen';
import { useFavorites } from '../../context/FavoritesContext';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../lib/theme';
import { fetchFixtureStatuses, type Fixture } from '../../lib/fixtures';
import {
  notificationAlertLabels,
  requestMatchNotificationPermission,
  syncBackgroundMatchNotifications,
} from '../../services/matchNotifications';
import * as Notifications from 'expo-notifications';
import { LocalizedText as Text } from '../../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../../lib/localization';
import { LocalizedAlert as Alert } from '../../lib/localization';
import { useLanguage } from '../../lib/localization';

export default function FavoritesScreen() {
  const { t } = useLanguage();
  const shared = useScreenStyles();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { favorites, isLoading, error, removeFavorite, setAlert } = useFavorites();
  const router = useRouter();
  const [latestFixtures, setLatestFixtures] = useState<Fixture[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const ids = favorites.map(item => item.fixture.id);
  const idsKey = ids.join(',');
  const labels = notificationAlertLabels();

  const refresh = useCallback(async () => {
    const currentIds = favorites.map(item => item.fixture.id);
    if (currentIds.length === 0) {
      setLatestFixtures([]);
      setRefreshError('');
      return;
    }
    setIsRefreshing(true);
    setRefreshError('');
    try {
      const fixtures: Fixture[] = [];
      for (let offset = 0; offset < currentIds.length; offset += 100) {
        fixtures.push(...await fetchFixtureStatuses(currentIds.slice(offset, offset + 100)));
      }
      setLatestFixtures(fixtures);
    } catch (requestError) {
      setRefreshError(requestError instanceof TypeError
        ? 'Impossible de joindre le serveur pour actualiser les favoris.'
        : requestError instanceof Error ? requestError.message : 'Impossible d’actualiser les favoris.');
      console.error('Unable to refresh favorite fixtures:', requestError);
    } finally {
      setIsRefreshing(false);
    }
  }, [favorites]);

  useFocusEffect(useCallback(() => {
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 30_000);
    return () => clearInterval(interval);
  }, [idsKey, refresh]));

  useEffect(() => {
    let active = true;
    Notifications.getPermissionsAsync()
      .then(permission => { if (active) setNotificationsEnabled(permission.granted); })
      .catch(permissionRequestError => {
        if (active) setPermissionError('Impossible de vérifier l’autorisation de notifications.');
        console.error('Unable to read notification permission:', permissionRequestError);
      });
    return () => { active = false; };
  }, []);

  const enableNotifications = async () => {
    setPermissionLoading(true);
    setPermissionError('');
    try {
      const granted = await requestMatchNotificationPermission();
      setNotificationsEnabled(granted);
      if (!granted) {
        setPermissionError('Autorisez les notifications IKProno dans les réglages de votre appareil.');
        return;
      }
      const enabled = favorites.some(favorite => Object.values(favorite.alerts).some(Boolean));
      await syncBackgroundMatchNotifications(enabled);
      Alert.alert('Notifications activées', 'Les alertes suivront les événements sélectionnés dans vos favoris.');
    } catch (requestError) {
      setPermissionError(requestError instanceof Error ? requestError.message : 'Impossible d’activer les notifications.');
      console.error('Unable to enable favorite match notifications:', requestError);
    } finally {
      setPermissionLoading(false);
    }
  };

  const updateAlert = async (fixtureId: string, key: (typeof labels)[number]['key'], enabled: boolean) => {
    try {
      await setAlert(fixtureId, key, enabled);
      if (notificationsEnabled) {
        const hasEnabled = favorites.some(favorite =>
          favorite.fixture.id === fixtureId
            ? Object.entries(favorite.alerts).some(([alertKey, value]) => alertKey === key ? enabled : value)
            : Object.values(favorite.alerts).some(Boolean)
        );
        await syncBackgroundMatchNotifications(hasEnabled);
      }
    } catch (updateError) {
      Alert.alert('Impossible d’enregistrer', updateError instanceof Error ? updateError.message : 'Réessayez.');
    }
  };

  const remove = (fixture: Fixture) => {
    Alert.alertWithRawMessage('Retirer des favoris ?', `${fixture.homeTeam} – ${fixture.awayTeam}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: () => { void removeFavorite(fixture.id).catch(removeError => {
          Alert.alert('Erreur', removeError instanceof Error ? removeError.message : 'Impossible de retirer ce match.');
        }); },
      },
    ]);
  };

  const fixturesById = new Map(latestFixtures.map(fixture => [fixture.id, fixture]));

  return (
    <Screen eyebrow="VOS MATCHS SUIVIS" title="Favoris">
      <View style={styles.notice}>
        <MaterialIcons name="notifications-active" size={21} color={theme.primary} />
        <Text style={styles.noticeText}>Suivez les scores et choisissez les événements qui déclenchent une alerte pour chaque match. Depuis l’écran En direct, la cloche d’une carte ajoute le match au suivi avec toutes les alertes actives.</Text>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        style={[shared.button, permissionLoading && styles.disabledButton]}
        onPress={() => { void enableNotifications(); }}
        disabled={permissionLoading}
      >
        {permissionLoading
          ? <ActivityIndicator color={theme.background} />
          : <Text style={shared.buttonText}>{notificationsEnabled ? 'Notifications autorisées · gérer les alertes' : 'Activer les notifications'}</Text>}
      </TouchableOpacity>
      {permissionError ? <Text accessibilityRole="alert" style={styles.error}>{permissionError}</Text> : null}
      <Text style={styles.disclaimer}>Les alertes sont vérifiées lorsque l’application est ouverte et, si le système l’autorise, en arrière-plan. iOS et Android peuvent retarder les vérifications pour économiser la batterie.</Text>
      <TouchableOpacity accessibilityRole="link" style={styles.testLink} onPress={() => router.push('/notifications-test')}>
        <MaterialIcons name="notifications-active" size={16} color={theme.primary} />
        <Text style={shared.linkText}>Voir et tester les notifications (but, carton)</Text>
      </TouchableOpacity>

      <View style={styles.heading}>
        <Text style={shared.cardTitle}>Matchs suivis · {favorites.length}/30</Text>
        <TouchableOpacity accessibilityLabel="Actualiser les favoris" onPress={() => { void refresh(); }}>
          <MaterialIcons name="refresh" size={21} color={isRefreshing ? theme.muted : theme.primary} />
        </TouchableOpacity>
      </View>
      {isLoading ? <ActivityIndicator color={theme.primary} style={styles.loading} /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {refreshError ? <Text accessibilityRole="alert" style={styles.error}>{refreshError}</Text> : null}

      {!isLoading && favorites.length === 0 ? (
        <View style={shared.card}>
          <Text style={shared.cardTitle}>Aucun match en favori</Text>
          <Text style={shared.body}>Touchez le cœur sur une carte de rencontre pour la retrouver et la suivre ici.</Text>
        </View>
      ) : favorites.map(favorite => {
        const fixture = fixturesById.get(favorite.fixture.id) || favorite.fixture;
        return (
          <View key={fixture.id} style={styles.favoriteCard}>
            <MatchCard fixture={fixture} showLiveAlert={false} />
            <View style={styles.alerts}>
              <Text style={styles.alertHeading}>M’alerter pour</Text>
              {labels.map(({ key, label }) => (
                <View key={key} style={styles.alertRow}>
                  <Text style={styles.alertLabel}>{label}</Text>
                  <Switch
                    accessibilityLabel={`${t('Alerte')} ${t(label)} ${t('pour')} ${fixture.homeTeam} ${t('contre')} ${fixture.awayTeam}`}
                    value={favorite.alerts[key]}
                    onValueChange={enabled => { void updateAlert(fixture.id, key, enabled); }}
                    trackColor={{ false: theme.border, true: theme.accentBorder }}
                    thumbColor={favorite.alerts[key] ? theme.primary : theme.muted}
                  />
                </View>
              ))}
              <TouchableOpacity style={styles.removeButton} onPress={() => remove(fixture)}>
                <MaterialIcons name="delete-outline" size={17} color={theme.danger} />
                <Text style={styles.removeText}>Retirer des favoris</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.accentSurface, borderWidth: 1, borderColor: theme.accentBorder, borderRadius: 13, padding: 13, marginBottom: 13 },
  noticeText: { flex: 1, color: theme.text, fontSize: 11, lineHeight: 16 },
  disabledButton: { opacity: 0.7 },
  disclaimer: { color: theme.muted, fontSize: 10, lineHeight: 15, marginBottom: 17 },
  testLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: theme.accentBorder, borderRadius: 12, paddingVertical: 11, marginBottom: 15 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  loading: { paddingVertical: 14 },
  error: { color: theme.danger, fontSize: 11, marginBottom: 10 },
  favoriteCard: { marginBottom: 14 },
  alerts: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 13, paddingHorizontal: 13, paddingTop: 12, marginTop: -5 },
  alertHeading: { color: theme.text, fontSize: 12, fontWeight: '800', marginBottom: 4 },
  alertRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.border, paddingVertical: 5 },
  alertLabel: { color: theme.muted, fontSize: 11 },
  removeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  removeText: { color: theme.danger, fontSize: 11, fontWeight: '700' },
});
