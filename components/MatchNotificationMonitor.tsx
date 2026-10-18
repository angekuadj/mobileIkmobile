import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useFavorites } from '../context/FavoritesContext';
import { useGeneratedCombinations } from '../hooks/useGeneratedCombinations';
import {
  checkFavoriteMatchNotifications,
  syncBackgroundMatchNotifications,
} from '../services/matchNotifications';

const FOREGROUND_INTERVAL = 30_000;

export default function MatchNotificationMonitor() {
  const router = useRouter();
  const { favorites, isLoading } = useFavorites();
  const generated = useGeneratedCombinations();
  const hasEnabledAlerts = favorites.some(favorite => Object.values(favorite.alerts).some(Boolean));
  const shouldTrackMatches = hasEnabledAlerts || generated.combinations.length > 0;

  useEffect(() => {
    if (isLoading || generated.isLoading || Platform.OS === 'web') return;
    let active = true;
    const run = async () => {
      if (AppState.currentState !== 'active' || !shouldTrackMatches) return;
      try {
        const permission = await Notifications.getPermissionsAsync();
        if (!active) return;
        if (!permission.granted) {
          await syncBackgroundMatchNotifications(false);
          return;
        }
        await checkFavoriteMatchNotifications();
      } catch (error) {
        console.error('Unable to check favorite match notifications:', error);
      }
    };
    const sync = async () => {
      try {
        const permission = await Notifications.getPermissionsAsync();
        if (active) await syncBackgroundMatchNotifications(permission.granted && shouldTrackMatches);
      } catch (error) {
        console.error('Unable to configure background match notifications:', error);
      }
    };
    void sync();
    if (shouldTrackMatches) run();
    const interval = shouldTrackMatches ? setInterval(run, FOREGROUND_INTERVAL) : null;
    const appStateListener = AppState.addEventListener('change', state => {
      if (state === 'active' && shouldTrackMatches) run();
    });
    return () => {
      active = false;
      if (interval) clearInterval(interval);
      appStateListener.remove();
    };
  }, [generated.combinations.length, generated.isLoading, hasEnabledAlerts, isLoading]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    const openMatch = (response: Notifications.NotificationResponse) => {
      const matchId = response.notification.request.content.data.matchId;
      if (typeof matchId === 'string' && /^\d{1,20}$/.test(matchId)) {
        router.push(`/match/${matchId}`);
      } else if (response.notification.request.content.data.notificationRoute === 'saved-combinations') {
        router.push('/(tabs)/basket');
      }
      void Notifications.clearLastNotificationResponseAsync().catch(error =>
        console.error('Unable to clear the opened match notification:', error)
      );
    };
    const notificationListener = Notifications.addNotificationResponseReceivedListener(openMatch);
    void Notifications.getLastNotificationResponseAsync().then(response => {
      if (active && response) openMatch(response);
    }).catch(error => console.error('Unable to read the last match notification:', error));
    return () => {
      active = false;
      notificationListener.remove();
    };
  }, [router]);

  return null;
}
