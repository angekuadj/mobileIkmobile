import { useRouter } from 'expo-router';

import { Screen, InfoCard, useScreenStyles } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { LocalizedText as Text } from '../../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity } from '../../lib/localization';

export default function AdminHomeScreen() {
  const screenStyles = useScreenStyles();
  const router = useRouter();
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return <Screen eyebrow="ACCÈS RESTREINT" title="Administration"><InfoCard title="Accès refusé">Cette section nécessite un rôle administrateur. Le rôle doit être attribué côté serveur via une custom claim Firebase (Admin SDK) ; le profil de l’utilisateur ne peut pas s’accorder lui-même ce privilège.</InfoCard></Screen>;
  }
  return (
    <Screen eyebrow="ADMIN · DÉMONSTRATION" title="Administration">
      <InfoCard title="Données de démonstration">Le site web présente des données de démonstration stockées dans le navigateur. Elles ne représentent pas les utilisateurs, paiements ou statistiques réels du backend mobile.</InfoCard>
      <TouchableOpacity style={screenStyles.secondaryButton} onPress={() => router.push('/admin/users')}><Text style={screenStyles.secondaryText}>Utilisateurs · démo</Text></TouchableOpacity>
      <TouchableOpacity style={screenStyles.secondaryButton} onPress={() => router.push('/admin/stats')}><Text style={screenStyles.secondaryText}>Statistiques · démo</Text></TouchableOpacity>
      <TouchableOpacity style={screenStyles.secondaryButton} onPress={() => router.push('/admin/payments')}><Text style={screenStyles.secondaryText}>Paiements · démo</Text></TouchableOpacity>
    </Screen>
  );
}
