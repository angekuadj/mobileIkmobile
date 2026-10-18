import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { fetchFixtures, fetchLiveFixtures, sortFixtures, type Fixture } from '../lib/fixtures';

const SCHEDULE_REFRESH_INTERVAL_MS = 5 * 60_000;
const LIVE_REFRESH_INTERVAL_MS = 30_000;
const LIVE_STATS_REFRESH_INTERVAL_MS = 2 * 60_000;

export function useFixtures(from: string, to: string, includeLive = false) {
  const isFocused = useIsFocused();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [liveFixtures, setLiveFixtures] = useState<Fixture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const loadedRange = useRef<string | null>(null);

  const refetch = useCallback(() => {
    setRefreshKey(key => key + 1);
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    let active = true;
    let scheduleInFlight = false;
    let liveInFlight = false;
    let schedulePending = false;
    let livePending = false;
    let livePendingWithStats = false;
    let scheduleController: AbortController | null = null;
    let liveController: AbortController | null = null;
    const rangeKey = `${from}|${to}`;
    const rangeChanged = loadedRange.current !== rangeKey;

    if (rangeChanged) {
      loadedRange.current = rangeKey;
      setFixtures([]);
      setLiveFixtures([]);
      setIsLoading(true);
    }

    const reportError = (requestError: unknown, signal: AbortSignal, context: string) => {
      if (!active || signal.aborted) return;
      setError(requestError instanceof TypeError
        ? 'Impossible de charger les rencontres FotMob. Vérifiez votre connexion Internet.'
        : requestError instanceof Error
          ? requestError.message
          : 'Erreur lors du chargement des rencontres.');
      console.error(context, requestError);
    };

    const loadSchedule = async (): Promise<void> => {
      if (!active || AppState.currentState !== 'active') return;
      if (scheduleInFlight) {
        schedulePending = true;
        return;
      }

      scheduleInFlight = true;
      const controller = new AbortController();
      scheduleController = controller;
      try {
        const schedule = sortFixtures(await fetchFixtures(from, to, controller.signal));
        if (!active) return;
        setFixtures(schedule);
        setError(null);
      } catch (requestError) {
        reportError(requestError, controller.signal, 'Error fetching fixtures:');
      } finally {
        if (scheduleController === controller) scheduleController = null;
        scheduleInFlight = false;
        const shouldRefresh = active && schedulePending && AppState.currentState === 'active';
        schedulePending = false;
        if (shouldRefresh) void loadSchedule();
      }
    };

    const loadLive = async (includeStats = false): Promise<void> => {
      if (!includeLive || !active || AppState.currentState !== 'active') return;
      if (liveInFlight) {
        livePending = true;
        livePendingWithStats ||= includeStats;
        return;
      }

      liveInFlight = true;
      const controller = new AbortController();
      liveController = controller;
      try {
        const live = sortFixtures(await fetchLiveFixtures(controller.signal, includeStats));
        if (!active) return;
        const liveById = new Map(live.map(fixture => [fixture.id, fixture]));
        setLiveFixtures(live);
        setFixtures(current => current.map(fixture => liveById.get(fixture.id) || fixture));
        setError(null);
      } catch (requestError) {
        reportError(requestError, controller.signal, 'Error fetching live fixtures:');
      } finally {
        if (liveController === controller) liveController = null;
        liveInFlight = false;
        const shouldRefresh = active && livePending && AppState.currentState === 'active';
        const refreshWithStats = livePendingWithStats;
        livePending = false;
        livePendingWithStats = false;
        if (shouldRefresh) void loadLive(refreshWithStats);
      }
    };

    const initialLoad = async () => {
      await Promise.all([loadSchedule(), loadLive(true)]);
      if (active) setIsLoading(false);
    };
    void initialLoad();
    const scheduleInterval = setInterval(() => { void loadSchedule(); }, SCHEDULE_REFRESH_INTERVAL_MS);
    const liveInterval = includeLive
      ? setInterval(() => { void loadLive(false); }, LIVE_REFRESH_INTERVAL_MS)
      : null;
    const liveStatsInterval = includeLive
      ? setInterval(() => { void loadLive(true); }, LIVE_STATS_REFRESH_INTERVAL_MS)
      : null;
    const appStateListener = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void loadSchedule();
        void loadLive(true);
      } else {
        schedulePending = false;
        livePending = false;
        livePendingWithStats = false;
        scheduleController?.abort();
        liveController?.abort();
      }
    });

    return () => {
      active = false;
      scheduleController?.abort();
      liveController?.abort();
      clearInterval(scheduleInterval);
      if (liveInterval) clearInterval(liveInterval);
      if (liveStatsInterval) clearInterval(liveStatsInterval);
      appStateListener.remove();
    };
  }, [from, to, includeLive, isFocused, refreshKey]);

  return { fixtures, liveFixtures, isLoading, error, refetch };
}
