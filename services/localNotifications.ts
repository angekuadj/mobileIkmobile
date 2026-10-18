import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { initializeLanguagePreference, translateText } from '../lib/localization';

export const MATCH_ALERT_CHANNEL_ID = 'ikprono-match-alerts-v2';
export const MATCH_NOTIFICATION_SOUND = 'ikprono_notification.wav';

export async function requestLocalNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await initializeLanguagePreference();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(MATCH_ALERT_CHANNEL_ID, {
      name: translateText('Alertes de rencontres'),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#e879f9',
      sound: MATCH_NOTIFICATION_SOUND,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  return permission.granted
    || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}
