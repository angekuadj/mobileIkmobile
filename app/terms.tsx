
import { Screen, InfoCard } from '../components/Screen';
import { useTheme } from '../context/ThemeContext';
import { LocalizedText as Text } from '../lib/localization';

export default function TermsScreen() {
  const { theme } = useTheme();
  return (
    <Screen eyebrow="INFORMATIONS LÉGALES" title="Conditions d’utilisation">
      <InfoCard title="Utilisation des informations">Les calendriers, scores, statistiques et suggestions sont fournis à titre informatif selon la disponibilité des sources. Les statistiques peuvent être absentes ou retardées. Les suggestions ne constituent pas une garantie, une recommandation de pari ou un conseil financier.</InfoCard>
      <InfoCard title="Pas de pari ni de transaction">L’application mobile n’accepte aucune mise, n’effectue aucun paiement et n’enregistre aucun gain ou perte. Les écrans Premium et loterie sont des démonstrations locales sans prix réel.</InfoCard>
      <InfoCard title="Compte et sélections">Créez un compte avec une adresse e-mail et un mot de passe pour enregistrer votre profil et vos sélections. Ces données sont conservées dans Firebase et synchronisées entre les appareils connectés au même compte. Sans compte, elles restent uniquement sur l’appareil.</InfoCard>
      <InfoCard title="Évolutions du service">Les rencontres et statistiques dépendent de la disponibilité des services FotMob. La disponibilité et les fonctions peuvent évoluer. Le support peut être contacté à support@ikprono.com.</InfoCard>
      <Text style={{ color: theme.muted, fontSize: 10, lineHeight: 15 }}>Cette information mobile n’est pas une reproduction juridique des conditions du site. Veuillez consulter le site pour ses conditions complètes.</Text>
    </Screen>
  );
}
