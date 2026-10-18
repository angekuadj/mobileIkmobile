import { useCallback, useEffect, useState } from 'react';
import AsyncStorage, { subscribeToSyncUser } from '../lib/syncedStore';
import type { Fixture } from '../lib/fixtures';

export interface SavedSelection {
  id: string;
  title: string;
  savedAt: string;
  fixtures: Fixture[];
}

const KEY = '@ikprono_saved_selections_v1';

export function useSavedSelections() {
  const [selections, setSelections] = useState<SavedSelection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const value = await AsyncStorage.getItem(KEY);
      const parsed: unknown = value ? JSON.parse(value) : [];
      setSelections(Array.isArray(parsed) ? parsed as SavedSelection[] : []);
    } catch (error) {
      console.error('Unable to load saved selections:', error);
      setSelections([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Recharge les sélections lorsque la session change (connexion/déconnexion Firestore).
    return subscribeToSyncUser(() => {
      void refresh();
    });
  }, [refresh]);

  const save = useCallback(async (fixtures: Fixture[], title = 'Ma sélection') => {
    if (fixtures.length === 0) throw new Error('Ajoutez au moins une rencontre avant d’enregistrer.');
    const currentValue = await AsyncStorage.getItem(KEY);
    const current = currentValue ? JSON.parse(currentValue) as SavedSelection[] : [];
    const selection: SavedSelection = {
      id: `selection-${Date.now()}`,
      title: title.trim() || 'Ma sélection',
      savedAt: new Date().toISOString(),
      fixtures,
    };
    const next = [selection, ...current].slice(0, 30);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    setSelections(next);
    return selection;
  }, []);

  const remove = useCallback(async (id: string) => {
    const next = selections.filter(selection => selection.id !== id);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    setSelections(next);
  }, [selections]);

  const updateFixtureStatuses = useCallback(async (fixtures: Fixture[]) => {
    const value = await AsyncStorage.getItem(KEY);
    const current = value ? JSON.parse(value) as SavedSelection[] : [];
    const latestById = new Map(fixtures.map(fixture => [fixture.id, fixture]));
    const next = current.map(selection => ({
      ...selection,
      fixtures: selection.fixtures.map(fixture => {
        const latest = latestById.get(fixture.id);
        return latest ? { ...latest, pick: fixture.pick } : fixture;
      }),
    }));
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      setSelections(next);
    }
  }, []);

  return { selections, isLoading, save, remove, refresh, updateFixtureStatuses };
}
