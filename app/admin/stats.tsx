import { Screen, InfoCard } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';

export default function AdminStatsScreen() {
  const { user } = useAuth();
  return <Screen eyebrow="ADMIN · DÉMONSTRATION" title="Statistiques">{user?.role === 'admin' ? <InfoCard title="Données non disponibles">Aucune statistique d’utilisation ou de compte n’est fournie par le backend mobile. Les valeurs du site web sont locales et ne sont pas reproduites ici.</InfoCard> : <InfoCard title="Accès refusé">Un rôle administrateur vérifié côté serveur est requis. Cette autorisation n’est pas configurée pour l’application mobile.</InfoCard>}</Screen>;
}
