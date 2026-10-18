import { Screen, InfoCard } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';

export default function AdminPaymentsScreen() {
  const { user } = useAuth();
  return <Screen eyebrow="ADMIN · DÉMONSTRATION" title="Paiements">{user?.role === 'admin' ? <InfoCard title="Aucune transaction">Aucun paiement réel n’est traité par l’application. Les statuts présentés sur le site sont des données de démonstration et aucun relevé transactionnel n’est exposé.</InfoCard> : <InfoCard title="Accès refusé">Un rôle administrateur vérifié côté serveur est requis. Cette autorisation n’est pas configurée pour l’application mobile.</InfoCard>}</Screen>;
}
