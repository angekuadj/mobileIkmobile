import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState  } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../lib/theme';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../lib/localization';

export default function RegisterScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      router.replace('/onboarding');
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : 'Impossible de créer ce compte. Vérifiez les informations saisies.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={21} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.brandMark}><MaterialIcons name="sports-soccer" size={26} color={theme.primary} /></View>
        <Text style={styles.brand}>IK<Text style={styles.brandAccent}>PRONO</Text></Text>
        <Text style={styles.title}>Créer un compte</Text>
        <Text style={styles.subtitle}>Un compte personnel qui synchronise vos données sur tous vos appareils.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Nom d’utilisateur</Text>
          <TextInput style={styles.input} placeholder="Votre nom" placeholderTextColor={theme.muted} autoCapitalize="none" autoComplete="username" value={username} onChangeText={setUsername} />
          <Text style={styles.label}>Adresse e-mail</Text>
          <TextInput style={styles.input} placeholder="vous@exemple.com" placeholderTextColor={theme.muted} keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} />
          <Text style={styles.label}>Mot de passe</Text>
          <TextInput style={styles.input} placeholder="6 caractères minimum" placeholderTextColor={theme.muted} secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} />
          <View style={styles.notice}>
            <Text style={styles.noticeText}>Vos favoris, panier, sélections et préférences sont enregistrés dans votre compte Firebase IKProno et retrouvés sur vos autres appareils.</Text>
          </View>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={[styles.submitButton, isLoading && styles.disabledButton]} onPress={handleRegister} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color={theme.background} /> : <Text style={styles.submitText}>Créer mon compte</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/login')} style={styles.switchLink}>
            <Text style={styles.switchText}>Déjà un compte ? <Text style={styles.switchAccent}>Se connecter</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 36 },
  backButton: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, marginBottom: 25 },
  brandMark: { width: 48, height: 48, borderRadius: 16, backgroundColor: theme.accentSurface, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 8 },
  brand: { color: theme.text, fontSize: 15, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' },
  brandAccent: { color: theme.primary },
  title: { color: theme.text, fontSize: 25, fontWeight: '900', textAlign: 'center', marginTop: 18 },
  subtitle: { color: theme.muted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 6 },
  form: { marginTop: 23 },
  label: { color: theme.text, fontSize: 11, fontWeight: '700', marginBottom: 7 },
  input: { color: theme.text, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, minHeight: 46, paddingHorizontal: 13, fontSize: 13, marginBottom: 12 },
  error: { color: theme.danger, fontSize: 11, lineHeight: 16, marginBottom: 10 },
  notice: { padding: 12, borderRadius: 12, backgroundColor: theme.accentSurface, marginBottom: 12 },
  noticeText: { color: theme.muted, fontSize: 11, lineHeight: 16 },
  submitButton: { minHeight: 49, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primaryDark, borderRadius: 12, marginTop: 5 },
  disabledButton: { opacity: 0.55 },
  submitText: { color: theme.text, fontSize: 13, fontWeight: '900' },
  switchLink: { alignItems: 'center', marginTop: 18 },
  switchText: { color: theme.muted, fontSize: 11 },
  switchAccent: { color: theme.primary, fontWeight: '800' },
});
