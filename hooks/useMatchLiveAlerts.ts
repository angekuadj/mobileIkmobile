import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { LIVE_ALERTS, NO_ALERTS, useFavorites } from '../context/FavoritesContext';
import type { Fixture } from '../lib/fixtures';
import {
  requestMatchNotificationPermission,
  syncBackgroundMatchNotifications,
} from '../services/matchNotifications';

export interface LiveAlertNotice {
  title: string;
  message: string;
}

/**
 * Follows a match in live notifications: one gesture activates every event
 * alert (kickoff, goals, cards, final whistle) for a fixture, another one
 * stops them without removing the fixture from the favorites.
 */
export function useMatchLiveAlerts(fixture: Fixture | null) {
  const favorites = useFavorites();
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<LiveAlertNotice | null>(null);
  const favorite = fixture ? favorites.favorites.find(item => item.fixture.id === fixture.id) : undefined;
  const enabled = Boolean(favorite && Object.values(favorite.alerts).some(Boolean));

  const toggle = useCallback(() => {
    if (!fixture || isBusy) return;
    const target = fixture;
    setNotice(null);
    setIsBusy(true);
    void (async () => {
      try {
        if (Platform.OS === 'web') {
          Alert.alert('Notifications indisponibles', 'Le suivi en direct est disponible dans l’application mobile iOS ou Android.');
          return;
        }
        const granted = await requestMatchNotificationPermission();
        if (!granted) {
          Alert.alert(
            'Notifications désactivées',
            'Autorisez les notifications IKProno dans les réglages de votre appareil pour suivre ce match en direct.'
          );
          return;
        }
        if (favorite && enabled) {
          await favorites.setAlerts(target.id, NO_ALERTS);
          const stillEnabled = favorites.favorites.some(item =>
            item.fixture.id !== target.id && Object.values(item.alerts).some(Boolean)
          );
          await syncBackgroundMatchNotifications(stillEnabled);
          setNotice({
            title: 'Suivi en direct désactivé',
            message: `Plus d’alerte automatique pour ${target.homeTeam} – ${target.awayTeam}. Le match reste dans vos favoris.`,
          });
          return;
        }
        if (!favorite) {
          const result = await favorites.toggleFavorite(target);
          if (result === 'limit') {
            Alert.alert('Limite de favoris atteinte', 'Vous pouvez suivre jusqu’à 30 rencontres.');
            return;
          }
        }
        await favorites.setAlerts(target.id, LIVE_ALERTS);
        await syncBackgroundMatchNotifications(true);
        setNotice({
          title: 'Suivi en direct activé',
          message: `${target.homeTeam} – ${target.awayTeam} : coup d’envoi, buts, cartons et fin de match vous seront notifiés.`,
        });
      } catch (error) {
        Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de modifier les alertes en direct.');
      } finally {
        setIsBusy(false);
      }
    })();
  }, [enabled, favorite, favorites, fixture]);

  return { enabled, isBusy, toggle, notice, dismissNotice: () => setNotice(null), isLoading: favorites.isLoading };
}
