import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { InfoCard, Screen, useScreenStyles } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../lib/theme';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../lib/localization';

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const screenStyles = useScreenStyles();
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (isLoading) return;
    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Saisissez une adresse e-mail valide.');
      setSent(false);
      return;
    }
    setError('');
    setSent(false);
    setIsLoading(true);
    try {
      await resetPassword(normalizedEmail);
      setSent(true);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Impossible d’envoyer le lien de réinitialisation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen eyebrow="COMPTE IKPRONO" title="Réinitialiser le mot de passe">
      <InfoCard title="Recevoir un lien">
        Saisissez l’adresse e-mail de votre compte. Si un compte correspond à cette adresse, Firebase vous enverra un lien de réinitialisation.
      </InfoCard>
      <Text accessibilityRole="header" style={styles.label}>Adresse e-mail</Text>
      <TextInput
        accessibilityLabel="Adresse e-mail"
        style={styles.input}
        placeholder="vous@exemple.com"
        placeholderTextColor={theme.muted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        value={email}
        onChangeText={value => {
          setEmail(value);
          setError('');
          setSent(false);
        }}
        editable={!isLoading}
        onSubmitEditing={() => { void handleSubmit(); }}
        returnKeyType="send"
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {sent ? (
        <View accessibilityRole="alert" style={styles.success}>
          <Text style={styles.successText}>Si un compte correspond à cette adresse, un lien de réinitialisation vient d’être envoyé.</Text>
        </View>
      ) : null}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: isLoading || !email.trim(), busy: isLoading }}
        disabled={isLoading || !email.trim()}
        style={[screenStyles.button, (isLoading || !email.trim()) && styles.disabled]}
        onPress={() => { void handleSubmit(); }}
      >
        {isLoading
          ? <ActivityIndicator color={theme.text} />
          : <Text style={screenStyles.buttonText}>Envoyer le lien</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        style={screenStyles.secondaryButton}
        onPress={() => router.replace('/login')}
      >
        <Text style={screenStyles.secondaryText}>Retour à la connexion</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  label: { color: theme.text, fontSize: 11, fontWeight: '700', marginBottom: 7 },
  input: { color: theme.text, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, minHeight: 48, paddingHorizontal: 13, fontSize: 13, marginBottom: 12 },
  error: { color: theme.danger, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  success: { padding: 13, borderRadius: 12, backgroundColor: theme.accentSurface, borderWidth: 1, borderColor: theme.accentBorder, marginBottom: 14 },
  successText: { color: theme.primary, fontSize: 12, lineHeight: 18 },
  disabled: { opacity: 0.55 },
});
