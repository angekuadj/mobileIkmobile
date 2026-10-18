const LEVELS = ['sure', 'medium', 'risky'];
const RISK_LEVELS = ['very-safe', 'safe', 'medium', 'bold', 'very-risky'];
const RISK_TO_LEVEL = {
  'very-safe': 'sure',
  safe: 'sure',
  medium: 'medium',
  bold: 'risky',
  'very-risky': 'risky',
};
const GOAL_THRESHOLDS = { sure: 1, medium: 2, risky: 3 };
const METADATA = {
  sure: ['Coupon sûr', 'Double chance et au moins 1 but, estimation basée sur l’historique FotMob disponible.'],
  medium: ['Coupon moyen', 'Résultat le plus fréquent et au moins 2 buts selon l’historique FotMob disponible.'],
  risky: ['Coupon risqué', 'Vainqueur le plus fréquent et au moins 3 buts selon l’historique FotMob disponible.'],
};

function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR').trim();
}

function outcomeForMatch(match, fixture) {
  if (match.homeScore === null || match.awayScore === null) return null;
  const homeTeam = normalize(fixture.homeTeam);
  const awayTeam = normalize(fixture.awayTeam);
  const historicalHome = normalize(match.homeTeam);
  const historicalAway = normalize(match.awayTeam);
  const homeIsSelected = historicalHome === homeTeam || historicalAway === homeTeam;
  const awayIsSelected = historicalHome === awayTeam || historicalAway === awayTeam;

  if (homeIsSelected && awayIsSelected) {
    if (match.homeScore === match.awayScore) return 'draw';
    const winner = match.homeScore > match.awayScore ? historicalHome : historicalAway;
    return winner === homeTeam ? 'home' : 'away';
  }
  if (!match.team) return null;
  const selectedTeam = normalize(match.team);
  if (selectedTeam !== homeTeam && selectedTeam !== awayTeam) return null;
  if (match.homeScore === match.awayScore) return 'draw';
  const teamWon = historicalHome === selectedTeam
    ? match.homeScore > match.awayScore
    : match.awayScore > match.homeScore;
  const selectedSide = selectedTeam === homeTeam ? 'home' : 'away';
  return teamWon ? selectedSide : selectedSide === 'home' ? 'away' : 'home';
}

function buildPicks(fixture, history, resultLevel, goalsLevel) {
  const results = history
    .map(match => outcomeForMatch(match, fixture))
    .filter(Boolean);
  let resultPick = { market: 'result', selection: null, historicalRate: null, sampleSize: 0 };
  if (results.length > 0) {
    const order = ['home', 'draw', 'away'];
    const counts = Object.fromEntries(order.map(outcome => [
      outcome,
      results.filter(result => result === outcome).length,
    ]));
    let selection;
    let hits;
    if (resultLevel === 'sure') {
      const excluded = [...order].sort((first, second) => counts[first] - counts[second])[0];
      selection = { home: 'away-or-draw', draw: 'either-win', away: 'home-or-draw' }[excluded];
      hits = results.length - counts[excluded];
    } else {
      const preferred = resultLevel === 'risky' ? ['home', 'away'] : order;
      selection = [...preferred].sort((first, second) => counts[second] - counts[first])[0];
      hits = counts[selection];
    }
    resultPick = {
      market: 'result',
      selection,
      historicalRate: Math.round(hits / results.length * 100),
      sampleSize: results.length,
    };
  }

  const threshold = GOAL_THRESHOLDS[goalsLevel];
  const scoreHistory = history.filter(match => match.homeScore !== null && match.awayScore !== null);
  const goalsPick = scoreHistory.length === 0
    ? { market: 'goals', selection: null, historicalRate: null, sampleSize: 0 }
    : {
      market: 'goals',
      selection: `over-${threshold - 0.5}`,
      historicalRate: Math.round(
        scoreHistory.filter(match => match.homeScore + match.awayScore >= threshold).length
          / scoreHistory.length * 100
      ),
      sampleSize: scoreHistory.length,
    };
  return [resultPick, goalsPick];
}

function prediction(fixture, details, resultLevel, goalsLevel = resultLevel) {
  return {
    fixtureId: fixture.id,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    picks: buildPicks(fixture, details.history, resultLevel, goalsLevel),
  };
}

function combinedRate(matches) {
  return Number(matches.reduce((rate, match) => {
    const rates = match.picks.map(pick => pick.historicalRate).filter(rate => rate !== null);
    const matchRate = rates.reduce((product, rate) => product * rate / 100, 100);
    return rate * matchRate / 100;
  }, 100).toFixed(2));
}

function buildCoupon(fixtures, details, riskLevel, couponCount, regenerate) {
  const defaultLevel = RISK_TO_LEVEL[riskLevel];
  const goalsLevel = riskLevel === 'bold' ? 'medium' : defaultLevel;
  return Array.from({ length: couponCount }, (_, index) => {
    const level = regenerate && index > 0
      ? LEVELS[(LEVELS.indexOf(defaultLevel) + index) % LEVELS.length]
      : defaultLevel;
    const [title, description] = METADATA[level];
    const levelForGoals = riskLevel === 'bold' && level === defaultLevel ? goalsLevel : level;
    const matches = fixtures.map((fixture, fixtureIndex) =>
      prediction(fixture, details[fixtureIndex], level, levelForGoals)
    );
    return { level, title, description, matches, estimatedCombinedRate: combinedRate(matches) };
  });
}

function buildAutomaticCoupon(candidates, count, riskLevel, excludeFixtureIds = [], randomize = false) {
  const level = RISK_TO_LEVEL[riskLevel];
  const goalsLevel = riskLevel === 'bold' ? 'medium' : level;
  const excluded = new Set(excludeFixtureIds);
  const available = candidates
    .filter(candidate => !excluded.has(candidate.fixture.id))
    .map(candidate => {
      const match = prediction(candidate.fixture, candidate.details, level, goalsLevel);
      const rates = match.picks.map(pick => pick.historicalRate);
      if (rates.some(rate => rate === null)) return null;
      return {
        match,
        estimate: rates.reduce((rate, value) => rate * value / 100, 100),
        sampleSize: Math.min(...match.picks.map(pick => pick.sampleSize)),
      };
    })
    .filter(Boolean);
  if (randomize) {
    for (let index = available.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [available[index], available[randomIndex]] = [available[randomIndex], available[index]];
    }
  } else {
    available.sort((first, second) =>
      second.estimate - first.estimate
      || second.sampleSize - first.sampleSize
      || first.match.fixtureId.localeCompare(second.match.fixtureId)
    );
  }
  if (available.length < count) {
    throw new Error(`FotMob ne fournit pas assez d’historique terminé pour proposer ${count} rencontres.`);
  }
  const matches = available.slice(0, count).map(item => item.match);
  const [defaultTitle, description] = METADATA[level];
  const title = {
    'very-safe': 'Combinaison très prudente',
    safe: 'Combinaison prudente',
    medium: 'Combinaison moyenne',
    bold: 'Combinaison audacieuse',
    'very-risky': 'Combinaison à risque très élevé',
  }[riskLevel] || defaultTitle;
  return {
    level,
    title,
    description,
    matches,
    estimatedCombinedRate: combinedRate(matches),
  };
}

function isRiskLevel(value) {
  return typeof value === 'string' && RISK_LEVELS.includes(value);
}

module.exports = { buildCoupon, buildAutomaticCoupon, isRiskLevel };
