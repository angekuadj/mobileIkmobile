import { useState } from 'react';

import { Screen, InfoCard, useScreenStyles } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LocalizedText as Text } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../lib/localization';
import { LocalizedAlert as Alert } from '../lib/localization';

const draws = [
  { id: 'daily', icon: '🎁', title: 'Abonnement gratuit', prize: '1 an Premium (démo)', date: 'Tirage quotidien' },
  { id: 'weekly', icon: '💰', title: 'Jackpot hebdomadaire', prize: '10 000 € (démo)', date: 'Tirage hebdomadaire' },
  { id: 'monthly', icon: '🏆', title: 'Prix mensuel', prize: 'iPhone 15 Pro (démo)', date: 'Tirage mensuel' },
];

export default function LotteryScreen() {
  const screenStyles = useScreenStyles();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [selected, setSelected] = useState(draws[0].id);
  const [ticket, setTicket] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState('');
  const participate = () => {
    if (user?.plan !== 'premium') {
      Alert.alert('Démonstration Premium', 'Sélectionnez d’abord le statut Premium simulé dans Offres. Aucun abonnement réel ne sera souscrit.');
      return;
    }
    setTicket(true);
    setResult('');
  };
  const spin = () => {
    if (!ticket || spinning) return;
    setSpinning(true);
    setResult('');
    setTimeout(() => {
      setSpinning(false);
      setTicket(false);
      setResult(['🎉 BRAVO !', '🌟 INCROYABLE !', '💫 GAGNANT !'][Math.floor(Math.random() * 3)]);
    }, 900);
  };
  return (
    <Screen eyebrow="JEU DÉMONSTRATIF" title="Tirages">
      <InfoCard title="Simulation locale uniquement">Les noms de prix ci-dessous reprennent la présentation du site. Aucun ticket réel, paiement, tirage officiel ou prix ne sont associés à cette animation. Elle ne désigne aucun gagnant réel.</InfoCard>
      {draws.map(draw => (
        <TouchableOpacity key={draw.id} onPress={() => setSelected(draw.id)} style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: selected === draw.id ? theme.primary : theme.border, borderRadius: 15, padding: 15, marginBottom: 9 }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800' }}>{draw.icon}  {draw.title}</Text>
          <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '800', marginTop: 6 }}>{draw.prize}</Text>
          <Text style={{ color: theme.muted, fontSize: 10, marginTop: 4 }}>{draw.date} · informations de démonstration</Text>
        </TouchableOpacity>
      ))}
      <View style={{ marginTop: 6 }} />
      <TouchableOpacity style={screenStyles.secondaryButton} onPress={participate}><Text style={screenStyles.secondaryText}>{ticket ? 'Ticket de démonstration prêt' : 'Ajouter un ticket gratuit de démonstration'}</Text></TouchableOpacity>
      <TouchableOpacity disabled={!ticket || spinning} style={[screenStyles.button, (!ticket || spinning) && { opacity: 0.45 }]} onPress={spin}><Text style={screenStyles.buttonText}>{spinning ? 'Animation…' : 'Lancer l’animation'}</Text></TouchableOpacity>
      {result ? <Text style={{ color: theme.primary, fontSize: 22, fontWeight: '900', textAlign: 'center', marginVertical: 13 }}>{result}</Text> : null}
      {result ? <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' }}>Résultat aléatoire de démonstration, sans gagnant, prix ou valeur réelle.</Text> : null}
    </Screen>
  );
}
