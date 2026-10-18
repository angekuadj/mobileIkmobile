import AsyncStorage, { subscribeToSyncUser } from '../lib/syncedStore';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Fixture } from '../lib/fixtures';

export type FavoriteAlertKey = 'kickoff' | 'goal' | 'yellowCard' | 'redCard' | 'finished';

export interface FavoriteMatch {
  fixture: Fixture;
  alerts: Record<FavoriteAlertKey, boolean>;
}

export const FAVORITE_ALERT_KEYS: FavoriteAlertKey[] = ['kickoff', 'goal', 'yellowCard', 'redCard', 'finished'];
const LEGACY_ALERT_KEYS: FavoriteAlertKey[] = ['kickoff', 'goal', 'redCard', 'finished'];

export const DEFAULT_ALERTS: Record<FavoriteAlertKey, boolean> = {
  kickoff: false,
  goal: true,
  yellowCard: false,
  redCard: true,
  finished: true,
};

export const LIVE_ALERTS: Record<FavoriteAlertKey, boolean> = {
  kickoff: true,
  goal: true,
  yellowCard: true,
  redCard: true,
  finished: true,
};

export const NO_ALERTS: Record<FavoriteAlertKey, boolean> = {
  kickoff: false,
  goal: false,
  yellowCard: false,
  redCard: false,
  finished: false,
};

interface FavoritesContextValue {
  favorites: FavoriteMatch[];
  isLoading: boolean;
  error: string | null;
  isFavorite: (fixtureId: string) => boolean;
  toggleFavorite: (fixture: Fixture) => Promise<'added' | 'removed' | 'limit'>;
  removeFavorite: (fixtureId: string) => Promise<void>;
  setAlert: (fixtureId: string, alert: FavoriteAlertKey, enabled: boolean) => Promise<void>;
  setAlerts: (fixtureId: string, alerts: Partial<Record<FavoriteAlertKey, boolean>>) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);
export const FAVORITES_STORAGE_KEY = '@ikprono_favorite_matches_v1';
const MAX_FAVORITES = 30;
let mutationQueue: Promise<void> = Promise.resolve();

function normalizeAlerts(value: unknown): Record<FavoriteAlertKey, boolean> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (!LEGACY_ALERT_KEYS.every(key => typeof source[key] === 'boolean')) return null;
  const alerts = { ...DEFAULT_ALERTS };
  for (const key of FAVORITE_ALERT_KEYS) {
    if (typeof source[key] === 'boolean') alerts[key] = source[key] as boolean;
  }
  return alerts;
}

function normalizeFavoriteMatch(value: unknown): FavoriteMatch | null {
  if (typeof value !== 'object' || value === null) return null;
  const item = value as Partial<FavoriteMatch>;
  if (typeof item.fixture !== 'object' || item.fixture === null || typeof item.fixture.id !== 'string') return null;
  const alerts = normalizeAlerts(item.alerts);
  if (!alerts) return null;
  return { fixture: item.fixture, alerts };
}

/**
 * Reads the stored favorites and upgrades older payloads: alerts added after a
 * previous release are completed with their default value instead of failing.
 */
export function parseFavorites(raw: string | null): FavoriteMatch[] {
  const parsed: unknown = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(parsed) || parsed.length > MAX_FAVORITES) {
    throw new Error('La liste des favoris contient des données invalides.');
  }
  const favorites: FavoriteMatch[] = [];
  for (const item of parsed) {
    const normalized = normalizeFavoriteMatch(item);
    if (!normalized) throw new Error('La liste des favoris contient des données invalides.');
    favorites.push(normalized);
  }
  return favorites;
}

function queueMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const operation = mutationQueue.then(mutation);
  mutationQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      AsyncStorage.getItem(FAVORITES_STORAGE_KEY)
        .then(value => {
          setFavorites(parseFavorites(value));
        })
        .catch(loadError => {
          setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les favoris.');
          console.error('Unable to load favorite matches:', loadError);
        })
        .finally(() => setIsLoading(false));
    void load();
    // Recharge les favoris lorsque la session change (connexion/déconnexion Firestore).
    return subscribeToSyncUser(() => {
      void load();
    });
  }, []);

  const persist = useCallback(async (nextFavorites: FavoriteMatch[]) => {
    await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavorites));
    setFavorites(nextFavorites);
    setError(null);
  }, []);

  const isFavorite = useCallback(
    (fixtureId: string) => favorites.some(item => item.fixture.id === fixtureId),
    [favorites]
  );

  const toggleFavorite = useCallback(async (fixture: Fixture) => queueMutation(async () => {
    const existing = parseFavorites(await AsyncStorage.getItem(FAVORITES_STORAGE_KEY));
    const found = existing.some(item => item.fixture.id === fixture.id);
    if (found) {
      await persist(existing.filter(item => item.fixture.id !== fixture.id));
      return 'removed' as const;
    }
    if (existing.length >= MAX_FAVORITES) return 'limit' as const;
    await persist([...existing, { fixture, alerts: { ...DEFAULT_ALERTS } }]);
    return 'added' as const;
  }), [persist]);

  const removeFavorite = useCallback(async (fixtureId: string) => queueMutation(async () => {
    const existing = parseFavorites(await AsyncStorage.getItem(FAVORITES_STORAGE_KEY));
    await persist(existing.filter(item => item.fixture.id !== fixtureId));
  }), [persist]);

  const patchAlerts = useCallback(async (fixtureId: string, patch: Partial<Record<FavoriteAlertKey, boolean>>) =>
    queueMutation(async () => {
      const existing = parseFavorites(await AsyncStorage.getItem(FAVORITES_STORAGE_KEY));
      const next = existing.map(item =>
        item.fixture.id === fixtureId ? { ...item, alerts: { ...item.alerts, ...patch } } : item
      );
      await persist(next);
    }), [persist]);

  const setAlert = useCallback((fixtureId: string, alert: FavoriteAlertKey, enabled: boolean) => {
    const patch: Partial<Record<FavoriteAlertKey, boolean>> = {};
    patch[alert] = enabled;
    return patchAlerts(fixtureId, patch);
  }, [patchAlerts]);

  const setAlerts = useCallback((fixtureId: string, alerts: Partial<Record<FavoriteAlertKey, boolean>>) =>
    patchAlerts(fixtureId, alerts), [patchAlerts]);

  const value = useMemo(() => ({
    favorites, isLoading, error, isFavorite, toggleFavorite, removeFavorite, setAlert, setAlerts,
  }), [favorites, isLoading, error, isFavorite, toggleFavorite, removeFavorite, setAlert, setAlerts]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used within a FavoritesProvider');
  return context;
}
