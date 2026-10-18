
import { Screen, InfoCard } from '../components/Screen';
import { useTheme } from '../context/ThemeContext';
import { LocalizedText as Text } from '../lib/localization';

export default function PrivacyScreen() {
  const { theme } = useTheme();
  return (
    <Screen eyebrow="INFORMATIONS LÉGALES" title="Confidentialité">
      <InfoCard title="Données de votre compte">Lorsque vous créez un compte, votre profil (nom, adresse e-mail) et vos données applicatives — favoris, panier, sélections enregistrées, combinaisons générées et préférences — sont enregistrés dans Firebase (Authentication et Cloud Firestore) et accessibles uniquement avec vos identifiants. Une copie est conservée localement sur votre appareil (base Realm) pour un usage hors ligne ; les anciennes données locales sont migrées à la première ouverture. Vous pouvez retirer la copie locale en effaçant les données de l’application.</InfoCard>
      <InfoCard title="Données sportives">Les demandes de calendrier, de scores et de statistiques sont envoyées directement par Internet à FotMob. Aucun serveur IKProno ni aucune base de données IKProno n’intervient pour afficher les rencontres.</InfoCard>
      <InfoCard title="Authentification et paiement">L’inscription et la connexion utilisent Firebase Authentication avec une adresse e-mail et un mot de passe. Le mot de passe est géré par Firebase et n’est jamais stocké par l’application. Aucune carte bancaire n’est collectée : les forfaits Premium et les tirages sont simulés localement.</InfoCard>
      <InfoCard title="Demandes de confidentialité">Pour toute question, ou pour supprimer votre compte et les données associées conservées dans Firebase, contactez support@ikprono.com. La copie locale peut être retirée en effaçant les données de l’application.</InfoCard>
      <Text style={{ color: theme.muted, fontSize: 10, lineHeight: 15 }}>Cette notice mobile décrit les données et flux de cette version ; elle ne remplace pas l’avis de confidentialité du site web.</Text>
    </Screen>
  );
}
