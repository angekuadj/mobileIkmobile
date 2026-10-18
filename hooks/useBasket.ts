import { useCallback, useEffect, useState } from 'react';
import AsyncStorage, { subscribeToSyncUser } from '../lib/syncedStore';
import type { Fixture } from '../lib/fixtures';

const BASKET_KEY = 'ikprono_fixture_basket';
const MAX_FIXTURES = 20;
const subscribers = new Set<(fixtures: Fixture[]) => void>();
let cachedFixtures: Fixture[] | null = null;
let loadingBasket: Promise<Fixture[]> | null = null;
let basketMutationQueue: Promise<void> = Promise.resolve();

// Quand l'utilisateur connecté change (connexion/déconnexion Firestore), on vide
// le cache du panier et on republie la valeur fraîchement synchronisée.
subscribeToSyncUser(() => {
  cachedFixtures = null;
  loadingBasket = null;
  void loadBasket()
    .then(publish)
    .catch(error => {
      console.error('Unable to reload basket after sync:', error);
      publish([]);
    });
});

function updateBasket<T>(
  update: (currentFixtures: Fixture[]) => { fixtures: Fixture[]; result: T }
): Promise<T> {
  const operation = basketMutationQueue.then(async () => {
    const currentFixtures = await loadBasket();
    const { fixtures, result } = update(currentFixtures);
    await AsyncStorage.setItem(BASKET_KEY, JSON.stringify(fixtures));
    publish(fixtures);
    return result;
  });
  basketMutationQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

function isFixture(value: unknown): value is Fixture {
  if (typeof value !== 'object' || value === null) return false;
  const fixture = value as Partial<Fixture>;
  return typeof fixture.id === 'string'
    && typeof fixture.sport === 'string'
    && typeof fixture.date === 'string'
    && typeof fixture.time === 'string'
    && typeof fixture.league === 'string'
    && typeof fixture.homeTeam === 'string'
    && typeof fixture.awayTeam === 'string';
}

function publish(fixtures: Fixture[]) {
  cachedFixtures = fixtures;
  subscribers.forEach(subscriber => subscriber(fixtures));
}

function loadBasket(): Promise<Fixture[]> {
  if (cachedFixtures) return Promise.resolve(cachedFixtures);
  if (!loadingBasket) {
    loadingBasket = AsyncStorage.getItem(BASKET_KEY)
      .then(value => {
        const parsed: unknown = value ? JSON.parse(value) : [];
        if (!Array.isArray(parsed) || parsed.length > MAX_FIXTURES || !parsed.every(isFixture)) {
          throw new Error('Le panier contient des données invalides.');
        }
        const fixtures = parsed as Fixture[];
        cachedFixtures = fixtures;
        return fixtures;
      })
      .finally(() => {
        loadingBasket = null;
      });
  }
  return loadingBasket;
}

export function useBasket() {
  const [fixtures, setFixtures] = useState<Fixture[]>(cachedFixtures ?? []);
  const [isLoading, setIsLoading] = useState(cachedFixtures === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const receive = (nextFixtures: Fixture[]) => {
      if (active) setFixtures(nextFixtures);
    };
    subscribers.add(receive);
    loadBasket()
      .then(nextFixtures => {
        if (active) setFixtures(nextFixtures);
      })
      .catch(loadError => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Impossible de charger le panier.');
        console.error('Unable to load fixture basket:', loadError);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
      subscribers.delete(receive);
    };
  }, []);

  const toggleFixture = useCallback(async (fixture: Fixture) => {
    const result = await updateBasket(currentFixtures => {
      const selected = currentFixtures.some(item => item.id === fixture.id);
      if (selected) {
        return { fixtures: currentFixtures.filter(item => item.id !== fixture.id), result: 'removed' as const };
      }
      if (currentFixtures.length >= MAX_FIXTURES) {
        return { fixtures: currentFixtures, result: 'limit' as const };
      }
      return { fixtures: [...currentFixtures, fixture], result: 'added' as const };
    });
    setError(null);
    return result;
  }, []);

  const removeFixture = useCallback(async (fixtureId: string) => {
    await updateBasket(currentFixtures => ({
      fixtures: currentFixtures.filter(fixture => fixture.id !== fixtureId),
      result: undefined,
    }));
    setError(null);
  }, []);

  const setFixturePick = useCallback(async (fixtureId: string, pick: Fixture['pick']) => {
    await updateBasket(currentFixtures => ({
      fixtures: currentFixtures.map(fixture => fixture.id === fixtureId ? { ...fixture, pick } : fixture),
      result: undefined,
    }));
    setError(null);
  }, []);

  const clearBasket = useCallback(async () => {
    await updateBasket(() => ({ fixtures: [], result: undefined }));
    setError(null);
  }, []);

  const replaceFixtures = useCallback(async (nextFixtures: Fixture[]) => {
    await updateBasket(() => ({ fixtures: nextFixtures.filter(isFixture).slice(0, MAX_FIXTURES), result: undefined }));
    setError(null);
  }, []);

  return {
    fixtures,
    isLoading,
    error,
    toggleFixture,
    removeFixture,
    setFixturePick,
    clearBasket,
    replaceFixtures,
  };
}
