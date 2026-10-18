import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '../lib/localStore';

export const ANONYMOUS_COMBINATION_LIMIT = 2;
const STORAGE_KEY = '@ikprono_anonymous_combination_usage_v1';
const subscribers = new Set<(used: number) => void>();
let cachedUsed: number | null = null;
let loadingUsage: Promise<number> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

function publish(used: number) {
  cachedUsed = used;
  subscribers.forEach(subscriber => subscriber(used));
}

function loadUsage(): Promise<number> {
  if (cachedUsed !== null) return Promise.resolve(cachedUsed);
  if (!loadingUsage) {
    loadingUsage = AsyncStorage.getItem(STORAGE_KEY)
      .then(value => {
        const used = value === null ? 0 : Number(value);
        if (!Number.isSafeInteger(used) || used < 0 || used > ANONYMOUS_COMBINATION_LIMIT) {
          throw new Error('Le compteur de combinaisons gratuites est invalide.');
        }
        publish(used);
        return used;
      })
      .finally(() => {
        loadingUsage = null;
      });
  }
  return loadingUsage;
}

function updateUsage(update: (used: number) => number): Promise<number> {
  const operation = mutationQueue.then(async () => {
    const used = await loadUsage();
    const next = update(used);
    await AsyncStorage.setItem(STORAGE_KEY, String(next));
    publish(next);
    return next;
  });
  mutationQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export function useAnonymousCombinationQuota() {
  const [used, setUsed] = useState(cachedUsed ?? 0);
  const [isLoading, setIsLoading] = useState(cachedUsed === null);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const receive = (nextUsed: number) => {
      if (active) setUsed(nextUsed);
    };
    subscribers.add(receive);
    loadUsage()
      .then(nextUsed => {
        if (active) {
          setUsed(nextUsed);
          setStorageError(null);
        }
      })
      .catch(error => {
        if (active) setStorageError(error instanceof Error ? error.message : 'Impossible de charger votre quota.');
        console.error('Unable to load anonymous combination usage:', error);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
      subscribers.delete(receive);
    };
  }, []);

  const reserve = useCallback(async (count: number) => {
    if (!Number.isSafeInteger(count) || count < 1 || count > ANONYMOUS_COMBINATION_LIMIT) {
      throw new Error('Le nombre de combinaisons demandé est invalide.');
    }
    await updateUsage(current => {
      if (current + count > ANONYMOUS_COMBINATION_LIMIT) {
        throw new Error('Vous avez atteint la limite de deux combinaisons gratuites. Créez un profil local pour continuer.');
      }
      return current + count;
    });
  }, []);

  const refund = useCallback(async (count: number) => {
    if (!Number.isSafeInteger(count) || count < 1 || count > ANONYMOUS_COMBINATION_LIMIT) {
      throw new Error('Le nombre de combinaisons à rétablir est invalide.');
    }
    await updateUsage(current => Math.max(0, current - count));
  }, []);

  return {
    used,
    remaining: ANONYMOUS_COMBINATION_LIMIT - used,
    isLoading,
    storageError,
    reserve,
    refund,
  };
}
