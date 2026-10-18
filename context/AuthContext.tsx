import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import type { User as FirebaseUser } from 'firebase/auth';
import AsyncStorage from '../lib/localStore';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  firebaseUserId,
  loginWithFirebase,
  logoutWithFirebase,
  readProfileDocument,
  readRoleClaim,
  registerWithFirebase,
  resetFirebasePassword,
  subscribeToAuthState,
  translateAuthError,
  updateProfileDocument,
  type FirebaseProfile,
} from '../lib/firebaseAuth';
import { syncOnLogin } from '../lib/userSync';
import { setSyncUser } from '../lib/syncedStore';
import { useTheme } from './ThemeContext';
import type { Theme } from '../lib/theme';
import { LocalizedView as View } from '../lib/localization';

export interface User {
  id: string;
  username: string;
  email: string;
  role?: 'user' | 'admin';
  plan?: 'free' | 'premium';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  /** Vrai quand la session est portée par Firebase Auth (et non par le profil local). */
  usingFirebase: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUser: (changes: Partial<Pick<User, 'username' | 'email' | 'plan'>>) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY_USER = '@ikprono_local_profile_v1';

const createStyles = (theme: Theme) => StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
});

function toUser(
  fbUser: FirebaseUser,
  profile: FirebaseProfile | null,
  role: 'user' | 'admin'
): User {
  return {
    id: firebaseUserId(fbUser),
    username: profile?.username || fbUser.displayName || fbUser.email?.split('@')[0] || 'Utilisateur',
    email: profile?.email || fbUser.email || '',
    role,
    plan: profile?.plan ?? 'free',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      // Repli historique : profil enregistré uniquement sur l'appareil.
      AsyncStorage.getItem(STORAGE_KEY_USER)
        .then(value => {
          if (!value) return;
          const parsed: unknown = JSON.parse(value);
          if (typeof parsed === 'object' && parsed !== null) {
            const candidate = parsed as Partial<User>;
            if (typeof candidate.id === 'string' && typeof candidate.username === 'string' && typeof candidate.email === 'string') {
              setUser({ id: candidate.id, username: candidate.username, email: candidate.email, plan: candidate.plan === 'premium' ? 'premium' : 'free' });
            }
          }
        })
        .catch(error => console.error('Unable to load local profile:', error))
        .finally(() => setIsLoading(false));
      return;
    }

    const unsubscribe = subscribeToAuthState(async fbUser => {
      try {
        if (!fbUser) {
          setSyncUser(null);
          setUser(null);
          return;
        }
        const syncUid = firebaseUserId(fbUser);
        // Synchronisation d'abord, puis activation de la session : les caches des
        // hooks se réinitialisent ainsi sur des données déjà à jour.
        await syncOnLogin(syncUid);
        setSyncUser(syncUid);
        const profile = await readProfileDocument(fbUser);
        const role = await readRoleClaim(fbUser);
        setUser(toUser(fbUser, profile, role));
      } catch (error) {
        console.error('Firebase Auth : impossible de charger le profil.', error);
        // On garde au minimum l'identité Firebase même si Firestore est injoignable.
        setUser(fbUser ? toUser(fbUser, null, 'user') : null);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    if (isFirebaseConfigured) {
      try {
        await loginWithFirebase(email, password);
      } catch (error) {
        throw new Error(translateAuthError(error));
      }
      return;
    }
    // Repli historique : connexion au profil local sans mot de passe.
    const stored = await AsyncStorage.getItem(STORAGE_KEY_USER);
    const savedUser = stored ? JSON.parse(stored) as User : null;
    if (!savedUser || savedUser.email.toLocaleLowerCase('fr-FR') !== email.trim().toLocaleLowerCase('fr-FR')) {
      throw new Error('Aucun profil local ne correspond à cette adresse e-mail.');
    }
    setUser(savedUser);
  };

  const register = async (username: string, email: string, password: string) => {
    const normalizedEmail = email.trim().toLocaleLowerCase('fr-FR');
    if (!username.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error('Saisissez un nom et une adresse e-mail valide.');
    }
    if (isFirebaseConfigured) {
      try {
        const fbUser = await registerWithFirebase(username, normalizedEmail, password);
        // Relecture immédiate pour afficher le profil sans attendre un nouvel
        // événement d'authentification.
        const profile = await readProfileDocument(fbUser).catch(() => null);
        const role = await readRoleClaim(fbUser);
        setUser(toUser(fbUser, profile, role));
      } catch (error) {
        throw new Error(translateAuthError(error));
      }
      return;
    }
    // Repli historique : profil local sans mot de passe.
    const savedPlan = await AsyncStorage.getItem('@ikprono_plan_demo_v1');
    const nextUser: User = {
      id: `local-${Date.now()}`,
      username: username.trim(),
      email: normalizedEmail,
      plan: savedPlan === 'premium' ? 'premium' : 'free',
    };
    await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const resetPassword = async (email: string) => {
    if (!isFirebaseConfigured) {
      throw new Error('La réinitialisation du mot de passe nécessite une connexion Firebase configurée.');
    }
    try {
      await resetFirebasePassword(email);
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code: unknown }).code)
          : '';
      if (code === 'auth/user-not-found') return;
      throw new Error(translateAuthError(error));
    }
  };

  const updateUser = async (changes: Partial<Pick<User, 'username' | 'email' | 'plan'>>) => {
    if (!user) throw new Error('Aucun profil à modifier.');
    const nextUser: User = { ...user, ...changes };
    await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(nextUser));
    setUser(nextUser);
    if (isFirebaseConfigured) {
      const uid = user.id.startsWith('firebase:') ? user.id.slice('firebase:'.length) : null;
      if (!uid) return;
      const profileChanges: Partial<FirebaseProfile> = {};
      if (changes.username !== undefined) profileChanges.username = changes.username;
      if (changes.email !== undefined) profileChanges.email = changes.email;
      if (changes.plan !== undefined) profileChanges.plan = changes.plan;
      if (Object.keys(profileChanges).length > 0) {
        await updateProfileDocument(uid, profileChanges);
      }
    }
  };

  const logout = async () => {
    if (isFirebaseConfigured) {
      try {
        await logoutWithFirebase();
      } catch (error) {
        console.error('Firebase Auth : déconnexion impossible.', error);
      }
      setSyncUser(null);
    }
    await AsyncStorage.removeItem(STORAGE_KEY_USER);
    setUser(null);
  };

  if (isLoading) {
    return <View style={styles.loading}><ActivityIndicator color={theme.primary} /></View>;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        usingFirebase: isFirebaseConfigured,
        login,
        register,
        resetPassword,
        updateUser,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
