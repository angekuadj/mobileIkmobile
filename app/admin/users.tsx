import { Screen, InfoCard } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';

export default function AdminUsersScreen() {
  const { user } = useAuth();
  return <Screen eyebrow="ADMIN · DÉMONSTRATION" title="Utilisateurs">{user?.role === 'admin' ? <InfoCard title="Aucun compte mobile distant">Le backend mobile ne gère aucun compte utilisateur. Les profils locaux ne sont pas visibles par l’administrateur.</InfoCard> : <InfoCard title="Accès refusé">Un rôle administrateur vérifié côté serveur est requis. Cette autorisation n’est pas configurée pour l’application mobile.</InfoCard>}</Screen>;
}
