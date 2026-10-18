import { useMemo } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../lib/theme';
import { useLanguage } from '../../lib/localization';
import { LocalizedText as Text } from '../../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../../lib/localization';
import { LocalizedAlert as Alert } from '../../lib/localization';

const links = [
  ['dashboard', 'Tableau de bord', 'Profil et état de vos sélections', 'dashboard'],
  ['favorites', 'Mes favoris', 'Matchs suivis et alertes personnalisées', 'favorite'],
  ['notifications-test', 'Test des notifications', 'Aperçu et envoi d’alertes de test', 'notifications'],
  ['live', 'Scores en direct', 'Rencontres en cours', 'sensors'],
  ['live-analysis', 'Analyse de match', 'Statistiques et détails disponibles', 'insights'],
  ['ai-search', 'Recherche de rencontres', 'Filtrer le calendrier par équipe', 'search'],
  ['profile-edit', 'Modifier mon profil', 'Nom et adresse e-mail du compte', 'edit'],
  ['onboarding', 'Préférences de démarrage', 'Revoir la découverte mobile', 'tune'],
  ['payment', 'Offres', 'Statut gratuit et Premium simulé', 'workspace-premium'],
  ['lottery', 'Tirages', 'Démonstration sans paiement ni prix', 'casino'],
  ['help', 'Aide', 'Fonctionnement et limites de la version mobile', 'help-outline'],
  ['faq', 'Questions fréquentes', 'Réponses pratiques', 'quiz'],
  ['contact', 'Contact', 'Écrire à l’assistance', 'mail-outline'],
  ['rating', 'Donner mon avis', 'Évaluer IKProno', 'star-outline'],
  ['privacy', 'Confidentialité', 'Données de votre compte', 'privacy-tip'],
  ['terms', 'Conditions d’utilisation', 'Informations sur le service', 'gavel'],
];

export default function ProfileScreen() {
  const { theme, mode, setMode } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { user, isAuthenticated, logout, usingFirebase } = useAuth();
  const changeTheme = async (nextMode: 'dark' | 'light') => {
    try {
      await setMode(nextMode);
    } catch (error) {
      console.error('Unable to save theme preference:', error);
      Alert.alert(t('Préférence non enregistrée'), t('Le thème n’a pas pu être sauvegardé. Vérifiez le stockage de votre appareil puis réessayez.'));
    }
  };
  const confirmLogout = () => Alert.alert(t('Se déconnecter ?'), t('Vos données sont conservées dans votre compte et retrouvées à la prochaine connexion.'), [
    { text: t('Annuler'), style: 'cancel' },
    { text: t('Déconnexion'), style: 'destructive', onPress: () => { void logout(); } },
  ]);
  const changeLanguage = async (nextLanguage: 'fr' | 'en') => {
    try {
      await setLanguage(nextLanguage);
    } catch (error) {
      console.error('Unable to save language preference:', error);
      Alert.alert(t('Préférence non enregistrée'), t('La langue n’a pas pu être sauvegardée. Vérifiez le stockage de votre appareil puis réessayez.'));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>VOTRE ESPACE</Text>
      <Text style={styles.title}>Profil</Text>
      <View style={styles.languageCard}>
        <Text style={styles.themeTitle}>{t('Langue de l’application')}</Text>
        <Text style={styles.themeDescription}>{t('Choisissez la langue de l’application.')}</Text>
        <View style={styles.themeOptions} accessibilityRole="radiogroup" accessibilityLabel={t('Langue de l’application')}>
          {([
            ['fr', 'Français'],
            ['en', 'English'],
          ] as const).map(([value, label]) => (
            <TouchableOpacity
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: language === value }}
              accessibilityLabel={t(`${label}${language === value ? ', sélectionné' : ''}`)}
              style={[styles.themeOption, language === value && styles.themeOptionSelected]}
              onPress={() => { void changeLanguage(value); }}
            >
              <Text style={[styles.themeOptionText, language === value && styles.themeOptionTextSelected]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {isAuthenticated ? (
        <View style={styles.profileCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user?.username.slice(0, 1).toUpperCase()}</Text></View>
          <Text style={styles.username}>{user?.username}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <Text style={styles.localBadge}>{usingFirebase ? 'COMPTE IKPRONO' : 'PROFIL LOCAL'} · {user?.plan === 'premium' ? 'PREMIUM SIMULÉ' : 'STANDARD'}</Text>
        </View>
      ) : (
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>Bienvenue sur IKProno</Text>
          <Text style={styles.welcomeText}>Consultez librement les rencontres, scores et détails sans compte. Vous disposez de deux combinaisons gratuites ; un compte IKProno permet de continuer et de retrouver vos favoris, votre panier et vos sélections sur tous vos appareils.</Text>
          <TouchableOpacity style={styles.createButton} onPress={() => router.push('/register')}><Text style={styles.createText}>Créer un compte</Text></TouchableOpacity>
          <TouchableOpacity style={styles.findButton} onPress={() => router.push('/login')}><Text style={styles.findText}>Se connecter</Text></TouchableOpacity>
        </View>
      )}

      <View style={styles.themeCard}>
        <Text style={styles.themeTitle}>Apparence</Text>
        <Text style={styles.themeDescription}>Choisissez le thème de l’application.</Text>
        <View style={styles.themeOptions} accessibilityRole="radiogroup" accessibilityLabel="Thème de l’application">
          {([
            ['dark', 'Sombre', 'dark-mode'],
            ['light', 'Clair', 'light-mode'],
          ] as const).map(([value, label, icon]) => (
            <TouchableOpacity
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: mode === value }}
              accessibilityLabel={`${label}${mode === value ? ', sélectionné' : ''}`}
              style={[styles.themeOption, mode === value && styles.themeOptionSelected]}
              onPress={() => { void changeTheme(value); }}
            >
              <MaterialIcons name={icon} size={18} color={mode === value ? theme.primary : theme.muted} />
              <Text style={[styles.themeOptionText, mode === value && styles.themeOptionTextSelected]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Mon espace</Text>
      {links.filter(([path]) => isAuthenticated || path !== 'profile-edit').map(([path, title, subtitle, icon]) => (
        <TouchableOpacity key={path} style={styles.actionCard} onPress={() => router.push(path === 'favorites' ? '/(tabs)/favorites' : `/${path}` as never)}>
          <View style={styles.actionIcon}><MaterialIcons name={icon as never} size={20} color={theme.primary} /></View>
          <View style={styles.actionCopy}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionSubtitle}>{subtitle}</Text></View>
          <MaterialIcons name="chevron-right" size={22} color={theme.muted} />
        </TouchableOpacity>
      ))}
      {user?.role === 'admin' ? (
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/admin')}>
          <View style={styles.actionIcon}><MaterialIcons name="admin-panel-settings" size={20} color={theme.primary} /></View>
          <View style={styles.actionCopy}><Text style={styles.actionTitle}>Administration</Text><Text style={styles.actionSubtitle}>Données de démonstration, accès restreint</Text></View>
          <MaterialIcons name="chevron-right" size={22} color={theme.muted} />
        </TouchableOpacity>
      ) : null}
      {isAuthenticated ? (
        <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout}>
          <MaterialIcons name="logout" size={18} color={theme.danger} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={styles.disclaimer}>Votre compte IKProno synchronise vos favoris, votre panier, vos sélections et vos préférences entre vos appareils via Firebase.</Text>
    </ScrollView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: 18, paddingBottom: 40 },
  languageCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 15, marginBottom: 14 },
  eyebrow: { color: theme.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.3, marginTop: 3 },
  title: { color: theme.text, fontSize: 27, fontWeight: '900', marginTop: 3, marginBottom: 19 },
  profileCard: { alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 18, padding: 22, marginBottom: 22 },
  avatar: { width: 60, height: 60, borderRadius: 21, backgroundColor: theme.accentSurface, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { color: theme.primary, fontSize: 27, fontWeight: '900' },
  username: { color: theme.text, fontSize: 17, fontWeight: '900' },
  email: { color: theme.muted, fontSize: 12, marginTop: 5 },
  localBadge: { color: theme.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 10 },
  welcomeCard: { alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 18, padding: 20, marginBottom: 21 },
  welcomeTitle: { color: theme.text, fontSize: 17, fontWeight: '900' },
  welcomeText: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 },
  themeCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 15, marginBottom: 22 },
  themeTitle: { color: theme.text, fontSize: 14, fontWeight: '800' },
  themeDescription: { color: theme.muted, fontSize: 11, marginTop: 4 },
  themeOptions: { flexDirection: 'row', gap: 9, marginTop: 13 },
  themeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: theme.border, borderRadius: 11, paddingVertical: 11 },
  themeOptionSelected: { borderColor: theme.primary, backgroundColor: theme.accentSurface },
  themeOptionText: { color: theme.muted, fontSize: 12, fontWeight: '700' },
  themeOptionTextSelected: { color: theme.primary },
  createButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: theme.primaryDark, padding: 13, borderRadius: 12, marginTop: 15 },
  createText: { color: theme.text, fontSize: 12, fontWeight: '900' },
  findButton: { padding: 12 },
  findText: { color: theme.primary, fontSize: 11, fontWeight: '800' },
  sectionTitle: { color: theme.text, fontSize: 15, fontWeight: '800', marginBottom: 10 },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 13, marginBottom: 8 },
  actionIcon: { width: 37, height: 37, borderRadius: 11, backgroundColor: theme.accentSurface, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1 },
  actionTitle: { color: theme.text, fontSize: 12, fontWeight: '800' },
  actionSubtitle: { color: theme.muted, fontSize: 10, marginTop: 3 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginTop: 15 },
  logoutText: { color: theme.danger, fontSize: 12, fontWeight: '800' },
  disclaimer: { color: theme.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 20 },
});
