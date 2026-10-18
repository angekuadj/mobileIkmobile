import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth, type Persistence } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Configuration du projet Firebase « Ikprono » (ikprono-84863).
 *
 * Ce sont des identifiants PUBLICS côté client (apiKey, appId, etc.) : ils
 * doivent être lisibles par l'application et ne sont pas des secrets. Les
 * règles de sécurité Firestore et les clés de serveur restent, elles, protégées
 * dans la console Firebase.
 *
 * Chaque valeur peut être surchargée par une variable EXPO_PUBLIC_FIREBASE_*
 * (modèle dans .env.example).
 */
const defaultFirebaseConfig = {
  apiKey: 'AIzaSyCwJm3mmA_F5TtGCnqA78OSAJ1tU-m880k',
  authDomain: 'ikprono-84863.firebaseapp.com',
  projectId: 'ikprono-84863',
  storageBucket: 'ikprono-84863.firebasestorage.app',
  messagingSenderId: '982975835181',
  appId: '1:982975835181:web:f4acdccc04246f435d9ca4',
};

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? defaultFirebaseConfig.apiKey,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? defaultFirebaseConfig.authDomain,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? defaultFirebaseConfig.projectId,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? defaultFirebaseConfig.storageBucket,
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? defaultFirebaseConfig.messagingSenderId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? defaultFirebaseConfig.appId,
};

/** Vrai uniquement si la config Firebase est réellement renseignée. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase n'est pas configuré : renseignez les variables EXPO_PUBLIC_FIREBASE_* dans .env"
    );
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  return app;
}

/**
 * Persistance Firebase Auth adossée à AsyncStorage.
 *
 * Le build de firebase/auth résolu par Metro n'expose pas
 * `getReactNativePersistence` ; on fournit donc l'implémentation attendue par
 * Firebase (interface interne : type + _isAvailable/_set/_get/_remove/...).
 * L'utilisateur reste ainsi connecté au redémarrage de l'application.
 */
class AsyncStoragePersistence implements Persistence {
  readonly type = 'LOCAL' as const;

  _isAvailable(): Promise<boolean> {
    return Promise.resolve(true);
  }

  _set(key: string, value: object): Promise<void> {
    return AsyncStorage.setItem(key, JSON.stringify(value));
  }

  async _get<T>(key: string): Promise<T | null> {
    const stored = await AsyncStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : null;
  }

  _remove(key: string): Promise<void> {
    return AsyncStorage.removeItem(key);
  }

  _addListener(_key: string, _listener: () => void): void {}

  _removeListener(_key: string, _listener: () => void): void {}
}

/**
 * Crée l'instance Auth. On tente d'abord `getReactNativePersistence` (présent
 * dans certaines versions/bundles de firebase/auth), puis on retombe sur notre
 * persistance AsyncStorage, et enfin sur getAuth (session en mémoire).
 */
function createAuthInstance(firebaseApp: FirebaseApp): Auth {
  try {
    const authModule = require('firebase/auth') as {
      getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
    };
    const persistence =
      typeof authModule.getReactNativePersistence === 'function'
        ? authModule.getReactNativePersistence(AsyncStorage)
        : new AsyncStoragePersistence();
    return initializeAuth(firebaseApp, { persistence });
  } catch (error) {
    console.warn('Persistance AsyncStorage indisponible, session Auth en mémoire.', error);
    return getAuth(firebaseApp);
  }
}

export function getFirebaseAuth(): Auth {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase n'est pas configuré : renseignez les variables EXPO_PUBLIC_FIREBASE_* dans .env"
    );
  }
  if (!authInstance) {
    authInstance = createAuthInstance(getFirebaseApp());
  }
  return authInstance;
}

export function getFirebaseDb(): Firestore {
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(getFirebaseApp());
  }
  return firestoreInstance;
}
