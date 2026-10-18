import AsyncStorage from '../lib/syncedStore';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform } from 'react-native';
import { Screen, InfoCard, useScreenStyles } from '../components/Screen';
import { useTheme } from '../context/ThemeContext';
import { requestMatchNotificationPermission } from '../services/matchNotifications';
import { LocalizedText as Text } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../lib/localization';
import { LocalizedAlert as Alert } from '../lib/localization';

const KEY = '@ikprono_onboarding_preferences_v1';

export default function OnboardingScreen() {
  const screenStyles = useScreenStyles();
  const { theme } = useTheme();
  const router = useRouter();
  const [notifications, setNotifications] = useState(false);
  const [requestingNotifications, setRequestingNotifications] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  const enableNotifications = async () => {
    if (Platform.OS === 'web') {
      setNotificationMessage('Les notifications locales sont disponibles dans l’application Android ou iOS.');
      return;
    }
    setRequestingNotifications(true);
    setNotificationMessage('');
    try {
      const granted = await requestMatchNotificationPermission();
      setNotifications(granted);
      if (!granted) {
        setNotificationMessage('Autorisez les notifications IKProno dans les réglages de votre appareil.');
      }
    } catch (error) {
      console.error('Unable to request local notification permission:', error);
      setNotificationMessage(error instanceof Error ? error.message : 'Impossible d’activer les notifications locales.');
    } finally {
      setRequestingNotifications(false);
    }
  };

  const finish = async () => {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify({ sport: 'football', notifications }));
      router.replace('/dashboard');
    } catch {
      Alert.alert('Enregistrement impossible', 'Vos préférences n’ont pas pu être conservées.');
    }
  };
  return (
    <Screen eyebrow="BIENVENUE SUR IKPRONO" title="Préparons votre espace">
      <InfoCard title="1. Votre sport">Le calendrier mobile est actuellement connecté aux rencontres réelles de football uniquement. Basketball et tennis ne sont pas fournis par le backend mobile.</InfoCard>
      <InfoCard title="2. Vos sélections">Choisissez des rencontres depuis le calendrier, consultez les détails et enregistrez vos sélections ; elles suivent votre compte lorsque vous êtes connecté.</InfoCard>
      <InfoCard title="3. Notifications">Les alertes sont envoyées localement par votre téléphone pour les matchs que vous suivez. Aucun serveur n’est utilisé ; les vérifications en arrière-plan peuvent être retardées par iOS ou Android.</InfoCard>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: requestingNotifications, selected: notifications }}
        disabled={requestingNotifications}
        onPress={() => { void enableNotifications(); }}
        style={[screenStyles.secondaryButton, notifications && { borderColor: theme.primary }]}
      >
        {requestingNotifications
          ? <ActivityIndicator color={theme.primary} />
          : <Text style={screenStyles.secondaryText}>{notifications ? '✓ Notifications locales autorisées' : 'Autoriser les notifications locales'}</Text>}
      </TouchableOpacity>
      {notificationMessage ? <Text accessibilityRole="alert" style={screenStyles.warning}>{notificationMessage}</Text> : null}
      <View style={{ marginTop: 9 }} />
      <TouchableOpacity style={screenStyles.button} onPress={() => { void finish(); }}><Text style={screenStyles.buttonText}>Terminer la découverte</Text></TouchableOpacity>
      <Text style={screenStyles.warning}>Les fonctionnalités de paiement, tirage au sort et compte web ne sont pas connectées à cette application.</Text>
    </Screen>
  );
}
