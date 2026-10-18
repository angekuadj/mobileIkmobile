import AsyncStorage from '../lib/syncedStore';
import { useRouter } from 'expo-router';

import { Screen, InfoCard, useScreenStyles } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { LocalizedText as Text } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity } from '../lib/localization';
import { LocalizedAlert as Alert } from '../lib/localization';

const PLAN_KEY = '@ikprono_plan_demo_v1';

export default function PaymentScreen() {
  const screenStyles = useScreenStyles();
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const selectPlan = async (plan: 'free' | 'premium') => {
    try {
      await AsyncStorage.setItem(PLAN_KEY, plan);
      if (user) await updateUser({ plan });
      Alert.alert('Simulation terminée', plan === 'premium'
        ? 'Le statut Premium simulé est activé sur cet appareil. Aucun paiement n’a été effectué.'
        : 'L’offre gratuite est sélectionnée. Aucun paiement n’a été effectué.');
    } catch {
      Alert.alert('Action impossible', 'Le choix de démonstration n’a pas été enregistré.');
    }
  };
  return (
    <Screen eyebrow="OFFRES" title="Choisir une offre">
      <InfoCard title="Standard · Gratuit">Calendrier des rencontres, scores et statistiques lorsqu’ils sont disponibles, sélection et combinaisons indicatives.</InfoCard>
      <TouchableOpacity style={screenStyles.secondaryButton} onPress={() => { void selectPlan('free'); }}><Text style={screenStyles.secondaryText}>Conserver l’offre gratuite</Text></TouchableOpacity>
      <InfoCard title="Premium · 3 000 FCFA / mois (présentation du site)">L’offre est affichée à titre informatif. Cette application ne connecte aucun prestataire de paiement et n’accorde pas réellement les fonctionnalités payantes du site.</InfoCard>
      <TouchableOpacity style={screenStyles.button} onPress={() => { void selectPlan('premium'); }}><Text style={screenStyles.buttonText}>Simuler l’activation Premium · sans paiement</Text></TouchableOpacity>
      <InfoCard title="Après la simulation">Le badge Premium est local et réversible ; il ne correspond pas à un abonnement, ne déclenche aucun renouvellement et ne donne aucun droit sur le compte web.</InfoCard>
      <TouchableOpacity style={screenStyles.secondaryButton} onPress={() => router.push('/lottery')}><Text style={screenStyles.secondaryText}>Voir la démonstration de tirage</Text></TouchableOpacity>
    </Screen>
  );
}
