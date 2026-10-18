import { useState } from 'react';

import { Screen } from '../components/Screen';
import { useTheme } from '../context/ThemeContext';
import { LocalizedText as Text } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../lib/localization';

const faqs = [
  ['Quelles disciplines sont disponibles ?', 'Le backend mobile fournit actuellement des rencontres de football uniquement. Aucun flux mobile basketball ou tennis n’est configuré.'],
  ['Les combinaisons garantissent-elles un résultat ?', 'Non. Elles sont calculées à partir des données historiques disponibles, qui peuvent être incomplètes. Aucun pronostic ne garantit un résultat.'],
  ['Puis-je retrouver mes données sur un autre appareil ?', 'Oui. Vos favoris, votre panier, vos sélections et vos préférences sont synchronisés via Firebase entre les appareils connectés au même compte. Le site web reste un service distinct.'],
  ['Le paiement Premium est-il réel ?', 'Non. L’écran de forfait permet une simulation locale, sans prestataire de paiement, débit, renouvellement ou abonnement réel.'],
  ['Le tirage et ses prix sont-ils réels ?', 'Non. L’écran de loterie est une démonstration locale, sans ticket payant, prix réel, tirage officiel ou gagnant.'],
  ['Comment sauvegarder des matchs ?', 'Ajoutez-les au panier depuis le calendrier puis enregistrez la sélection. Lorsque vous êtes connecté, les sélections et préférences sont synchronisées avec votre compte ; sinon elles restent sur cet appareil.'],
];

export default function FAQScreen() {
  const { theme } = useTheme();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Screen eyebrow="AIDE" title="Questions fréquentes">
      {faqs.map(([question, answer], index) => (
        <TouchableOpacity key={question} onPress={() => setOpen(open === index ? null : index)} style={{ backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: 14, padding: 15, marginBottom: 9 }}>
          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800' }}>{open === index ? '−  ' : '+  '}{question}</Text>
          {open === index ? <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 19, marginTop: 10 }}>{answer}</Text> : null}
        </TouchableOpacity>
      ))}
      <View style={{ marginTop: 6 }}><Text style={{ color: theme.muted, fontSize: 10, lineHeight: 15 }}>Les informations de cette application décrivent les fonctions mobiles réellement activées, qui diffèrent de certaines fonctions de démonstration du site.</Text></View>
    </Screen>
  );
}
