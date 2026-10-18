import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from './firebase';

/** Profil utilisateur stocké dans le document Firestore users/{uid}. */
export interface FirebaseProfile {
  username: string;
  email: string;
  plan: 'free' | 'premium';
}

export function isFirebaseAuthConfigured(): boolean {
  return isFirebaseConfigured;
}

/** UID Firebase → identifiant stable utilisé côté application. */
export function firebaseUserId(fbUser: FirebaseUser): string {
  return `firebase:${fbUser.uid}`;
}

/** Chemin du document profil : users/{uid}. */
export function profileDocPath(uid: string) {
  return doc(getFirebaseDb(), 'users', uid);
}

/** Lit le document profil users/{uid}. Retourne null s'il n'existe pas. */
export async function readProfileDocument(fbUser: FirebaseUser): Promise<FirebaseProfile | null> {
  const snapshot = await getDoc(profileDocPath(fbUser.uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Partial<FirebaseProfile>;
  return {
    username: typeof data.username === 'string' && data.username ? data.username : displayName(fbUser),
    email: typeof data.email === 'string' && data.email ? data.email : fbUser.email ?? '',
    plan: data.plan === 'premium' ? 'premium' : 'free',
  };
}

/**
 * Détermine le rôle à partir des custom claims du jeton Firebase.
 * Le document profil est modifiable par son propriétaire : il ne doit jamais
 * servir à accorder un privilège. Les claims, eux, ne sont fixés que côté
 * serveur (Admin SDK) et ne peuvent pas être falsifiés par le client.
 */
export async function readRoleClaim(fbUser: FirebaseUser): Promise<'user' | 'admin'> {
  try {
    const token = await fbUser.getIdTokenResult();
    const claims = token.claims as Record<string, unknown>;
    if (claims.admin === true || claims.role === 'admin') return 'admin';
  } catch (error) {
    console.error('Firebase Auth : lecture des custom claims impossible.', error);
  }
  return 'user';
}

/** Crée ou complète le document profil users/{uid} après une inscription. */
export async function ensureProfileDocument(
  fbUser: FirebaseUser,
  username: string
): Promise<FirebaseProfile> {
  const existing = await readProfileDocument(fbUser).catch(() => null);
  const profile: FirebaseProfile = {
    username: username || existing?.username || displayName(fbUser),
    email: fbUser.email ?? existing?.email ?? '',
    plan: existing?.plan ?? 'free',
  };
  await setDoc(
    profileDocPath(fbUser.uid),
    { ...profile, updatedAt: serverTimestamp(), ...(existing ? {} : { createdAt: serverTimestamp() }) },
    { merge: true }
  );
  return profile;
}

/** Met à jour partiellement le document profil users/{uid}. */
export async function updateProfileDocument(
  uid: string,
  changes: Partial<FirebaseProfile>
): Promise<void> {
  await setDoc(
    doc(getFirebaseDb(), 'users', uid),
    { ...changes, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function registerWithFirebase(
  username: string,
  email: string,
  password: string
): Promise<FirebaseUser> {
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, normalizeEmail(email), password);
  if (username.trim()) {
    await updateProfile(credential.user, { displayName: username.trim() });
  }
  await ensureProfileDocument(credential.user, username.trim());
  return credential.user;
}

export async function loginWithFirebase(email: string, password: string): Promise<FirebaseUser> {
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), normalizeEmail(email), password);
  return credential.user;
}

export async function resetFirebasePassword(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), normalizeEmail(email));
}

export async function logoutWithFirebase(): Promise<void> {
  await signOut(getFirebaseAuth());
}

/** Abonne l'appelant aux changements de session Firebase Auth. */
export function subscribeToAuthState(
  callback: (user: FirebaseUser | null) => void
): () => void {
  return onAuthStateChanged(
    getFirebaseAuth(),
    callback,
    error => {
      console.error('Firebase Auth : erreur de session.', error);
      callback(null);
    }
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function displayName(fbUser: FirebaseUser): string {
  return fbUser.displayName || fbUser.email?.split('@')[0] || 'Utilisateur';
}

/** Convertit un message d'erreur Firebase en message utilisateur francophone. */
export function translateAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'Adresse e-mail invalide.';
    case 'auth/user-disabled':
      return 'Ce compte a été désactivé.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email ou mot de passe incorrect.';
    case 'auth/email-already-in-use':
      return 'Un compte utilise déjà cette adresse email.';
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    case 'auth/missing-password':
      return 'Veuillez saisir votre mot de passe.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessayez plus tard.';
    case 'auth/network-request-failed':
      return 'Erreur réseau. Vérifiez votre connexion.';
    case 'auth/operation-not-allowed':
      return 'Méthode de connexion non activée dans la console Firebase.';
    case 'auth/configuration-not-found':
      return 'Méthode de connexion non configurée (provider désactivé).';
    default:
      if (error instanceof Error && error.message) return error.message;
      return 'Une erreur est survenue lors de l’authentification.';
  }
}
