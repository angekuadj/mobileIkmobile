import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import localStore from './localStore';

/**
 * Clés locales qui transportent des données propres à l'utilisateur connecté.
 * Elles sont dupliquées dans Firestore sous users/{uid}/data/{clé} afin de
 * retrouver favoris, panier, sélections et préférences sur un autre appareil.
 *
 * Les préférences purement locales (thème, instantanés de notifications,
 * quota anonyme) ne figurent pas dans cette liste : elles restent sur l'appareil.
 */
export const USER_SCOPED_KEYS = [
  '@ikprono_favorite_matches_v1',
  'ikprono_fixture_basket',
  '@ikprono_saved_selections_v1',
  '@ikprono_generated_combinations_v1',
  '@ikprono_plan_demo_v1',
  '@ikprono_onboarding_preferences_v1',
] as const;

/** Sous-collection de données utilisateur : users/{uid}/data/{key}. */
function userDataCollection(uid: string) {
  return collection(getFirebaseDb(), 'users', uid, 'data');
}

/**
 * Clé locale (non synchronisée) qui mémorise à quel compte appartiennent les
 * données présentes sur l'appareil. Elle évite qu'un second compte se connectant
 * sur le même téléphone hérite des favoris/panier du précédent.
 */
const SYNC_OWNER_KEY = '@ikprono_sync_owner_v1';

/** Pousse une valeur locale vers Firestore (users/{uid}/data/{key}). */
export async function pushValueToCloud(uid: string, key: string, value: string): Promise<void> {
  await setDoc(
    doc(userDataCollection(uid), key),
    { value, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** Supprime une valeur dans Firestore (users/{uid}/data/{key}). */
export async function removeValueFromCloud(uid: string, key: string): Promise<void> {
  await deleteDoc(doc(userDataCollection(uid), key));
}

/**
 * Envoie vers Firestore toutes les valeurs locales présentes.
 * Appelé à la connexion : l'appareil devient la source de vérité pour la
 * première synchronisation et aucun travail local n'est écrasé.
 */
export async function pushAllToCloud(uid: string): Promise<void> {
  await Promise.all(
    USER_SCOPED_KEYS.map(async key => {
      const value = await localStore.getItem(key);
      if (value === null) return;
      await pushValueToCloud(uid, key, value);
    })
  );
}

/**
 * Récupère les valeurs Firestore absentes localement et les écrit dans le
 * stockage local. Les clés déjà présentes sur l'appareil ne sont jamais
 * écrasées : on comble seulement les manques (restauration d'un nouvel appareil).
 */
export async function pullMissingFromCloud(uid: string): Promise<string[]> {
  const snapshot = await getDocs(userDataCollection(uid));
  const restored: string[] = [];
  await Promise.all(
    snapshot.docs.map(async entry => {
      const key = entry.id;
      const cloudValue = (entry.data() as { value?: unknown }).value;
      if (typeof cloudValue !== 'string') return;
      const localValue = await localStore.getItem(key);
      if (localValue !== null) return;
      await localStore.setItem(key, cloudValue);
      restored.push(key);
    })
  );
  return restored;
}

/**
 * Orchestration appelée à la connexion.
 * - Même compte (ou données anonymes) : le local fait foi, on l'envoie au cloud
 *   puis on comble les manques depuis Firestore.
 * - Autre compte sur le même appareil : on remplace les données locales par les
 *   siennes (aucune fuite d'un compte vers l'autre).
 */
export async function syncOnLogin(uid: string): Promise<void> {
  const previousOwner = await localStore.getItem(SYNC_OWNER_KEY);
  if (previousOwner && previousOwner !== uid) {
    await Promise.all(USER_SCOPED_KEYS.map(key => localStore.removeItem(key)));
  } else {
    await pushAllToCloud(uid);
  }
  await pullMissingFromCloud(uid);
  await localStore.setItem(SYNC_OWNER_KEY, uid);
}
