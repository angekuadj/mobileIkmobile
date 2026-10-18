import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState  } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../lib/theme';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../lib/localization';

export default function LoginScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Veuillez renseigner votre adresse e-mail et votre mot de passe.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Connexion impossible. Vérifiez vos identifiants.');
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
        <Text style={styles.title}>Connexion</Text>
        <Text style={styles.subtitle}>Connectez-vous à votre compte IKProno pour retrouver vos favoris et sélections sur tous vos appareils.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Adresse e-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="vous@exemple.com"
            placeholderTextColor={theme.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            placeholder="Votre mot de passe"
            placeholderTextColor={theme.muted}
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />
          <Text style={styles.localNote}>Vos données sont synchronisées avec votre compte Firebase IKProno et protégées par votre mot de passe.</Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <TouchableOpacity onPress={() => router.push('/forgot-password')} style={styles.forgotLink}>
            <Text style={styles.switchText}>Mot de passe oublié ? <Text style={styles.switchAccent}>Le réinitialiser</Text></Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.submitButton, isLoading && styles.disabledButton]} onPress={handleLogin} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color={theme.background} /> : <Text style={styles.submitText}>Continuer</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/register')} style={styles.switchLink}>
            <Text style={styles.switchText}>Aucun compte ? <Text style={styles.switchAccent}>En créer un</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 36 },
  backButton: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, marginBottom: 40 },
  brandMark: { width: 55, height: 55, borderRadius: 18, backgroundColor: theme.accentSurface, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 10 },
  brand: { color: theme.text, fontSize: 16, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' },
  brandAccent: { color: theme.primary },
  title: { color: theme.text, fontSize: 27, fontWeight: '900', textAlign: 'center', marginTop: 30 },
  subtitle: { color: theme.muted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 8 },
  form: { marginTop: 29 },
  label: { color: theme.text, fontSize: 11, fontWeight: '700', marginBottom: 7 },
  input: { color: theme.text, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, minHeight: 48, paddingHorizontal: 13, fontSize: 13, marginBottom: 17 },
  error: { color: theme.danger, fontSize: 11, lineHeight: 16, marginBottom: 10 },
  localNote: { color: theme.muted, fontSize: 11, lineHeight: 16, marginBottom: 14 },
  submitButton: { minHeight: 49, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primaryDark, borderRadius: 12, marginTop: 5 },
  disabledButton: { opacity: 0.55 },
  submitText: { color: theme.text, fontSize: 13, fontWeight: '900' },
  switchLink: { alignItems: 'center', marginTop: 21 },
  forgotLink: { alignItems: 'flex-end', marginTop: -5, marginBottom: 15 },
  switchText: { color: theme.muted, fontSize: 11 },
  switchAccent: { color: theme.primary, fontWeight: '800' },
});
