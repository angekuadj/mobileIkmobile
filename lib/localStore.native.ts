import AsyncStorage from '@react-native-async-storage/async-storage';
import Realm from 'realm';

class LocalStoreEntry extends Realm.Object<LocalStoreEntry, 'key' | 'value'> {
  key!: string;
  value!: string;

  static schema: Realm.ObjectSchema = {
    name: 'LocalStoreEntry',
    primaryKey: 'key',
    properties: {
      key: 'string',
      value: 'string',
    },
  };
}

let realmPromise: Promise<Realm> | null = null;
let initialization: Promise<void> | null = null;

function openRealm(): Promise<Realm> {
  if (!realmPromise) {
    realmPromise = Realm.open({
      path: 'ikprono-local.realm',
      schema: [LocalStoreEntry],
      schemaVersion: 1,
    }).catch(error => {
      realmPromise = null;
      throw error;
    });
  }
  return realmPromise;
}

async function migrateAsyncStorage(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith('@ikprono_'));
  if (keys.length === 0) return;
  const entries = await AsyncStorage.multiGet(keys);
  const realm = await openRealm();
  realm.write(() => {
    for (const [key, value] of entries) {
      if (value === null || realm.objectForPrimaryKey(LocalStoreEntry, key)) continue;
      realm.create(LocalStoreEntry, { key, value });
    }
  });
  await AsyncStorage.multiRemove(keys);
}

export function initializeLocalStore(): Promise<void> {
  if (!initialization) {
    initialization = migrateAsyncStorage().catch(error => {
      initialization = null;
      throw error;
    });
  }
  return initialization;
}

async function getItem(key: string): Promise<string | null> {
  await initializeLocalStore();
  return openRealm().then(realm => realm.objectForPrimaryKey(LocalStoreEntry, key)?.value ?? null);
}

async function setItem(key: string, value: string): Promise<void> {
  await initializeLocalStore();
  const realm = await openRealm();
  realm.write(() => {
    const entry = realm.objectForPrimaryKey(LocalStoreEntry, key);
    if (entry) entry.value = value;
    else realm.create(LocalStoreEntry, { key, value });
  });
}

async function removeItem(key: string): Promise<void> {
  await initializeLocalStore();
  const realm = await openRealm();
  realm.write(() => {
    const entry = realm.objectForPrimaryKey(LocalStoreEntry, key);
    if (entry) realm.delete(entry);
  });
}

export default { getItem, setItem, removeItem };
