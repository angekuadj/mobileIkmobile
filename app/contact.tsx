import { Linking, StyleSheet } from 'react-native';
import { useMemo, useState  } from 'react';
import { Screen, InfoCard, useScreenStyles } from '../components/Screen';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../lib/theme';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity } from '../lib/localization';
import { LocalizedAlert as Alert } from '../lib/localization';

export default function ContactScreen() {
  const screenStyles = useScreenStyles();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const compose = async () => {
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !subject.trim() || !message.trim()) {
      Alert.alert('Formulaire incomplet', 'Renseignez votre nom, votre e-mail, le sujet et le message.');
      return;
    }
    const mailto = `mailto:support@ikprono.com?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(`${message.trim()}\n\n${name.trim()} · ${email.trim()}`)}`;
    try {
      await Linking.openURL(mailto);
    } catch {
      Alert.alert('E-mail indisponible', 'Écrivez directement à support@ikprono.com depuis votre messagerie.');
    }
  };

  return (
    <Screen eyebrow="ASSISTANCE" title="Contactez-nous">
      <InfoCard title="Nous écrire">Le message est ouvert dans votre application de messagerie. Il n’est pas envoyé ni conservé par IKProno tant que vous ne l’avez pas envoyé.</InfoCard>
      <Text style={styles.label}>Nom</Text><TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Votre nom" placeholderTextColor={theme.muted} />
      <Text style={styles.label}>E-mail</Text><TextInput value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" autoCapitalize="none" placeholder="vous@exemple.com" placeholderTextColor={theme.muted} />
      <Text style={styles.label}>Sujet</Text><TextInput value={subject} onChangeText={setSubject} style={styles.input} placeholder="Sujet de votre message" placeholderTextColor={theme.muted} />
      <Text style={styles.label}>Message</Text><TextInput value={message} onChangeText={setMessage} style={[styles.input, styles.multiline]} multiline textAlignVertical="top" placeholder="Comment pouvons-nous vous aider ?" placeholderTextColor={theme.muted} />
      <TouchableOpacity style={screenStyles.button} onPress={() => { void compose(); }}><Text style={screenStyles.buttonText}>Ouvrir mon application e-mail</Text></TouchableOpacity>
    </Screen>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  label: { color: theme.text, fontSize: 11, fontWeight: '700', marginBottom: 7 },
  input: { color: theme.text, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, minHeight: 46, paddingHorizontal: 13, fontSize: 13, marginBottom: 14 },
  multiline: { minHeight: 125, paddingTop: 12 },
});
