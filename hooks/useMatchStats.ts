import { useState, useEffect } from 'react';
import { fetchMatchStats as fetchFotMobMatchStats } from '../lib/fotmobClient';

type StatPair = { home: number | string; away: number | string };

export interface MatchStats {
  date: string;
  competition: string;
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeImageUrl?: string;
  awayImageUrl?: string;
  status: string;
  liveTime?: string;
  homeScore?: number;
  awayScore?: number;
  homeForm: string;
  awayForm: string;
  homeFormation?: string;
  awayFormation?: string;
  events: Array<{
    minute: number | string;
    type: string;
    player: string;
    playerImageUrl?: string;
    detail?: string;
    side?: 'home' | 'away';
    playerIn?: string;
    playerOut?: string;
  }>;
  homeLineup: Array<{
    number: number;
    name: string;
    imageUrl?: string;
    position: string;
    rating?: string;
  }>;
  awayLineup: Array<{
    number: number;
    name: string;
    imageUrl?: string;
    position: string;
    rating?: string;
  }>;
  homeSubstitutes: Array<{
    number: number;
    name: string;
    imageUrl?: string;
    position: string;
    rating?: string;
  }>;
  awaySubstitutes: Array<{
    number: number;
    name: string;
    imageUrl?: string;
    position: string;
    rating?: string;
  }>;
  possession?: StatPair;
  expectedGoals?: StatPair;
  shots?: StatPair;
  shotsOnTarget?: StatPair;
  touchesInBox?: StatPair;
  bigChances?: StatPair;
  bigChancesMissed?: StatPair;
  accuratePasses?: StatPair;
  yellowCards?: StatPair;
  corners?: StatPair;
  shotsOffTarget?: StatPair;
  blockedShots?: StatPair;
  hitWoodwork?: StatPair;
  shotsInsideBox?: StatPair;
  shotsOutsideBox?: StatPair;
  xgOpenPlay?: StatPair;
  xgSetPlay?: StatPair;
  xgNonPenalty?: StatPair;
  xgOnTarget?: StatPair;
  passes?: StatPair;
  accurateLongBalls?: StatPair;
  accurateCrosses?: StatPair;
  throws?: StatPair;
  offsides?: StatPair;
  tackles?: StatPair;
  interceptions?: StatPair;
  blocks?: StatPair;
  clearances?: StatPair;
  keeperSaves?: StatPair;
  duelsWon?: StatPair;
  groundDuelsWon?: StatPair;
  aerialDuelsWon?: StatPair;
  successfulDribbles?: StatPair;
  redCards?: StatPair;
  foulsCommitted?: StatPair;
  headToHead: Array<{
    date: string;
    homeTeam: string;
    awayTeam: string;
    homeScore?: number | null;
    awayScore?: number | null;
    competition: string;
  }>;
  standings: Array<{
    position: number;
    team: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
  }>;
  odds: {
    homeWin: number;
    draw: number;
    awayWin: number;
  } | null;
}

export function useMatchStats(fixtureId: string) {
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchMatchStats(controller.signal);
    return () => controller.abort();
  }, [fixtureId]);

  const fetchMatchStats = async (signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      setError(null);
      setStats(await fetchFotMobMatchStats(fixtureId, signal));
    } catch (err) {
      if (signal?.aborted) return;
      setError('Erreur de connexion');
      console.error('Error fetching match stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    stats,
    isLoading,
    error,
    refetch: fetchMatchStats,
  };
}
