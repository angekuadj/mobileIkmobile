import { useCallback, useEffect, useState } from 'react';
import AsyncStorage, { subscribeToSyncUser } from '../lib/syncedStore';
import { GENERATED_COMBINATIONS_STORAGE_KEY, type GeneratedCoupon, type StoredGeneratedCombination } from '../lib/coupons';

const MAX_SAVED_COMBINATIONS = 100;
let cachedCombinations: StoredGeneratedCombination[] | null = null;
let loadingCombinations: Promise<StoredGeneratedCombination[]> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();
const subscribers = new Set<(combinations: StoredGeneratedCombination[]) => void>();

// Quand l'utilisateur connecté change, on vide le cache et on republie les
// combinaisons fraîchement synchronisées depuis Firestore.
subscribeToSyncUser(() => {
  cachedCombinations = null;
  loadingCombinations = null;
  void loadCombinations()
    .then(publish)
    .catch(error => {
      console.error('Unable to reload combinations after sync:', error);
      publish([]);
    });
});

function publish(combinations: StoredGeneratedCombination[]) {
  cachedCombinations = combinations;
  subscribers.forEach(subscriber => subscriber(combinations));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isGeneratedCoupon(value: unknown): value is GeneratedCoupon {
  if (!isRecord(value) || typeof value.title !== 'string' || typeof value.description !== 'string'
    || typeof value.level !== 'string' || !Array.isArray(value.matches)) return false;
  return value.matches.every(match =>
    isRecord(match)
    && typeof match.fixtureId === 'string'
    && typeof match.homeTeam === 'string'
    && typeof match.awayTeam === 'string'
    && Array.isArray(match.picks)
    && match.picks.every(pick => isRecord(pick)
      && (pick.market === 'result' || pick.market === 'goals')
      && (pick.selection === null || typeof pick.selection === 'string')
      && (pick.historicalRate === null || typeof pick.historicalRate === 'number')
      && typeof pick.sampleSize === 'number')
  );
}

function isStoredCombination(value: unknown): value is StoredGeneratedCombination {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.createdAt === 'string'
    && isGeneratedCoupon(value.coupon);
}

function loadCombinations(): Promise<StoredGeneratedCombination[]> {
  if (cachedCombinations !== null) return Promise.resolve(cachedCombinations);
  if (!loadingCombinations) {
    loadingCombinations = AsyncStorage.getItem(GENERATED_COMBINATIONS_STORAGE_KEY)
      .then(value => {
        const parsed: unknown = value ? JSON.parse(value) : [];
        if (!Array.isArray(parsed) || !parsed.every(isStoredCombination)) {
          throw new Error('Les combinaisons enregistrées contiennent des données invalides.');
        }
        cachedCombinations = parsed;
        return parsed;
      })
      .finally(() => {
        loadingCombinations = null;
      });
  }
  return loadingCombinations;
}

function updateCombinations(
  update: (current: StoredGeneratedCombination[]) => StoredGeneratedCombination[]
): Promise<StoredGeneratedCombination[]> {
  const operation = mutationQueue.then(async () => {
    const current = await loadCombinations();
    const next = update(current);
    await AsyncStorage.setItem(GENERATED_COMBINATIONS_STORAGE_KEY, JSON.stringify(next));
    publish(next);
    return next;
  });
  mutationQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export function useGeneratedCombinations() {
  const [combinations, setCombinations] = useState<StoredGeneratedCombination[]>(cachedCombinations ?? []);
  const [isLoading, setIsLoading] = useState(cachedCombinations === null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCombinations(await loadCombinations());
      setError(null);
    } catch (loadError) {
      const message = loadError instanceof Error
        ? loadError.message
        : 'Impossible de charger les combinaisons enregistrées.';
      setError(message);
      console.error('Unable to load saved combinations:', loadError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const receive = (next: StoredGeneratedCombination[]) => {
      if (active) setCombinations(next);
    };
    subscribers.add(receive);
    void refresh();
    return () => {
      active = false;
      subscribers.delete(receive);
    };
  }, [refresh]);

  const save = useCallback(async (coupon: GeneratedCoupon) => {
    const combination: StoredGeneratedCombination = {
      id: `combination-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      coupon,
    };
    const saved = await updateCombinations(current => [{
      ...combination,
    }, ...current].slice(0, MAX_SAVED_COMBINATIONS));
    setCombinations(saved);
    setError(null);
    return combination;
  }, []);

  const remove = useCallback(async (id: string) => {
    const saved = await updateCombinations(current => current.filter(combination => combination.id !== id));
    setCombinations(saved);
    setError(null);
  }, []);

  return { combinations, isLoading, error, save, remove, refresh };
}
