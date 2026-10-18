import { useRouter } from 'expo-router';
import { useMemo, useState  } from 'react';
import { StyleSheet } from 'react-native';
import { Screen, useScreenStyles } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../lib/theme';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity } from '../lib/localization';
import { LocalizedAlert as Alert } from '../lib/localization';

export default function EditProfileScreen() {
  const screenStyles = useScreenStyles();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const save = async () => {
    if (!username.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Informations invalides', 'Saisissez un nom et une adresse e-mail valides.');
      return;
    }
    try {
      await updateUser({ username: username.trim(), email: email.trim().toLocaleLowerCase('fr-FR') });
      router.back();
    } catch {
      Alert.alert('Enregistrement impossible', 'Votre profil n’a pas pu être modifié.');
    }
  };
  return (
    <Screen eyebrow="MON COMPTE" title="Modifier mes informations">
      <Text style={styles.label}>Nom affiché</Text>
      <TextInput value={username} onChangeText={setUsername} style={styles.input} placeholderTextColor={theme.muted} />
      <Text style={styles.label}>Adresse e-mail</Text>
      <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} placeholderTextColor={theme.muted} />
      <TouchableOpacity style={screenStyles.button} onPress={() => { void save(); }}><Text style={screenStyles.buttonText}>Enregistrer</Text></TouchableOpacity>
      <Text style={screenStyles.warning}>Ces informations sont enregistrées dans votre compte IKProno et synchronisées entre vos appareils.</Text>
    </Screen>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  label: { color: theme.text, fontSize: 11, fontWeight: '700', marginBottom: 7 },
  input: { color: theme.text, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, minHeight: 46, paddingHorizontal: 13, fontSize: 13, marginBottom: 16 },
});
