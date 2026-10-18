import { useRouter } from 'expo-router';
import { Image } from 'react-native';
import { Screen, InfoCard, useScreenStyles } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useBasket } from '../hooks/useBasket';
import { useSavedSelections } from '../hooks/useSavedSelections';
import { LocalizedText as Text } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity } from '../lib/localization';
import { useLanguage } from '../lib/localization';

export default function DashboardScreen() {
  const { t } = useLanguage();
  const screenStyles = useScreenStyles();
  const router = useRouter();
  const { user } = useAuth();
  const basket = useBasket();
  const saved = useSavedSelections();
  return (
    <Screen eyebrow="TABLEAU DE BORD" title="Mon espace">
      <Image
        accessibilityLabel={t('Logo IKProno')}
        resizeMode="contain"
        source={require('../assets/ikprono-logo.png')}
        style={{ width: 210, height: 62, alignSelf: 'center', marginBottom: 12 }}
      />
      <InfoCard title={user ? `Bonjour ${user.username}` : 'Bienvenue'}>
        {user ? `Compte IKProno · ${user.email} · Offre ${user.plan === 'premium' ? 'Premium simulée' : 'gratuite'}.` : 'Consultez et gérez vos sélections sportives. Connectez-vous pour les retrouver sur tous vos appareils.'}
      </InfoCard>
      <InfoCard title="Mes sélections">
        {`${basket.fixtures.length} rencontre${basket.fixtures.length === 1 ? '' : 's'} dans le panier · ${saved.selections.length} sélection${saved.selections.length === 1 ? '' : 's'} enregistrée${saved.selections.length === 1 ? '' : 's'}. Les scores finaux sont affichés lorsqu’ils sont fournis par le calendrier ; aucun bilan de pari n’est calculé.`}
      </InfoCard>
      <TouchableOpacity style={screenStyles.button} onPress={() => router.push('/(tabs)/basket')}><Text style={screenStyles.buttonText}>Gérer mon panier</Text></TouchableOpacity>
      <TouchableOpacity style={screenStyles.secondaryButton} onPress={() => router.push('/(tabs)/predictions')}><Text style={screenStyles.secondaryText}>Voir les combinaisons disponibles</Text></TouchableOpacity>
      <TouchableOpacity style={screenStyles.secondaryButton} onPress={() => router.push('/profile-edit')}><Text style={screenStyles.secondaryText}>Modifier mon profil</Text></TouchableOpacity>
      <Text style={screenStyles.warning}>Ce tableau de bord mobile ne récupère pas le compte web : aucune authentification, historique de paiement ou statistique personnelle n’est fournie par le serveur mobile.</Text>
    </Screen>
  );
}
