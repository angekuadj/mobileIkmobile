import localStore from './localStore';
import { pushValueToCloud, removeValueFromCloud } from './userSync';

/**
 * Magasin « local d'abord » : chaque écriture est d'abord enregistrée dans le
 * stockage embarqué (Realm), puis répliquée vers Firestore lorsque l'utilisateur
 * est connecté. Les utilisateurs anonymes continuent de tout garder en local.
 *
 * Les contexts/hooks concernant l'utilisateur importent ce module au lieu de
 * lib/localStore ; les préférences purement device (thème, notifications)
 * restent sur lib/localStore.
 */

let currentUid: string | null = null;
/** Incrémenté à chaque connexion/déconnexion pour que les caches se réinitialisent. */
let generation = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(listener => listener());
}

/** Appelé par AuthContext à chaque changement de session. */
export function setSyncUser(uid: string | null) {
  if (currentUid === uid) return;
  currentUid = uid;
  generation += 1;
  notify();
}

export function getSyncUid(): string | null {
  return currentUid;
}

export function getSyncGeneration(): number {
  return generation;
}

/**
 * S'abonne aux changements de session. Utilisé par les caches module-level
 * (panier, combinaisons) pour se vider quand l'utilisateur change.
 */
export function subscribeToSyncUser(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function getItem(key: string): Promise<string | null> {
  return localStore.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  await localStore.setItem(key, value);
  const uid = currentUid;
  if (!uid) return;
  // Réplication asynchrone : une erreur réseau ne doit pas faire échouer l'écriture locale.
  pushValueToCloud(uid, key, value).catch(error =>
    console.warn(`Synchronisation Firestore impossible pour ${key} :`, error)
  );
}

async function removeItem(key: string): Promise<void> {
  await localStore.removeItem(key);
  const uid = currentUid;
  if (!uid) return;
  removeValueFromCloud(uid, key).catch(error =>
    console.warn(`Suppression Firestore impossible pour ${key} :`, error)
  );
}

export default { getItem, setItem, removeItem };
