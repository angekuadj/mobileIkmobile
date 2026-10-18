import { useRouter } from 'expo-router';

import { Screen, InfoCard, useScreenStyles } from '../components/Screen';
import { LocalizedText as Text } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity } from '../lib/localization';

export default function HelpScreen() {
  const screenStyles = useScreenStyles();
  const router = useRouter();
  return (
    <Screen eyebrow="ASSISTANCE" title="Besoin d’aide ?">
      <InfoCard title="Rencontres et calendrier">Les rencontres réelles de football proviennent du serveur mobile. Choisissez une période et un statut dans l’onglet Rencontres ; la disponibilité des scores et statistiques dépend des données fournies.</InfoCard>
      <InfoCard title="Combinaisons">Les propositions sont produites par le service à partir de l’historique disponible. Ce sont des suggestions indicatives, pas des prédictions certaines ni des conseils financiers.</InfoCard>
      <InfoCard title="Compte et paiement">Créez un compte (adresse e-mail et mot de passe) pour synchroniser votre profil et vos sélections entre vos appareils via Firebase. L’offre Premium et les tirages restent des simulations locales, sans paiement réel.</InfoCard>
      <TouchableOpacity style={screenStyles.button} onPress={() => router.push('/contact')}><Text style={screenStyles.buttonText}>Contacter l’assistance</Text></TouchableOpacity>
      <TouchableOpacity style={screenStyles.secondaryButton} onPress={() => router.push('/faq')}><Text style={screenStyles.secondaryText}>Consulter les questions fréquentes</Text></TouchableOpacity>
    </Screen>
  );
}
