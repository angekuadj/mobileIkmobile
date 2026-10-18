const FOTMOB_API = 'https://www.fotmob.com/api/data';
const FOTMOB_USER_AGENT = 'IkProno/1.0 (FotMob data)';

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function fotMobTeamImageUrl(id) {
  const teamId = text(id);
  return /^\d+$/.test(teamId) && Number(teamId) > 0
    ? `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}_small.png`
    : undefined;
}

function fotMobPlayerImageUrl(id) {
  const playerId = text(id);
  return /^\d+$/.test(playerId) && Number(playerId) > 0
    ? `https://images.fotmob.com/image_resources/playerimages/${playerId}.png`
    : undefined;
}

function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseScore(value) {
  const match = value.match(/^\s*(\d+)\s*[-:]\s*(\d+)\s*$/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function frenchStatus(status) {
  if (status.cancelled === true) return 'Annulé';
  if (status.finished === true) return 'Terminé';
  if (status.started === true) return 'En direct';
  return 'Prévu';
}

function fixtureFromMatch(match, league, date) {
  if (!isRecord(match) || !isRecord(match.home) || !isRecord(match.away) || !isRecord(match.status)) {
    throw new Error(`FotMob returned invalid match data for ${league}.`);
  }
  const id = text(match.id);
  const homeTeam = text(match.home.name);
  const awayTeam = text(match.away.name);
  if (!id || !homeTeam || !awayTeam) throw new Error(`FotMob returned incomplete match data for ${league}.`);
  const status = match.status;
  const homeScore = numberOrNull(match.home.score);
  const awayScore = numberOrNull(match.away.score);
  const liveTime = isRecord(status.liveTime)
    ? text(status.liveTime.short).replace(/[\u200e\u200f]/g, '').trim()
    : '';
  const started = status.started === true || status.finished === true;
  const score = started
    ? text(status.scoreStr) || (homeScore !== null && awayScore !== null ? `${homeScore} - ${awayScore}` : '')
    : '';
  const rawTime = text(match.time);
  const time = rawTime.match(/\b\d{1,2}:\d{2}\b/)?.[0] || rawTime;
  const homeImageUrl = text(match.home.imageUrl) || fotMobTeamImageUrl(match.home.id);
  const awayImageUrl = text(match.away.imageUrl) || fotMobTeamImageUrl(match.away.id);
  return {
    id,
    matchId: id,
    sport: 'football',
    date,
    time,
    league,
    homeTeam,
    awayTeam,
    ...(homeImageUrl ? { homeImageUrl } : {}),
    ...(awayImageUrl ? { awayImageUrl } : {}),
    ...(started && homeScore !== null ? { homeScore: String(homeScore) } : {}),
    ...(started && awayScore !== null ? { awayScore: String(awayScore) } : {}),
    ...(score ? { score } : {}),
    ...(status.started === true && liveTime ? { liveTime } : {}),
    status: frenchStatus(status),
  };
}

async function fetchFotMob(url, expectedContentType = 'application/json', signal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: expectedContentType, 'User-Agent': FOTMOB_USER_AGENT },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
  const contentType = response.headers.get('content-type') || '';
  const actualContentType = contentType.split(';')[0].trim();
  const acceptedContentTypes = expectedContentType.split(',')
    .map(type => type.split(';')[0].trim());
  const isXmlResponse = expectedContentType.startsWith('text/plain')
    && ['application/xml', 'text/xml'].includes(actualContentType);
  if (!response.ok || (!acceptedContentTypes.includes(actualContentType) && !isXmlResponse)) {
    throw new Error(`FotMob returned an invalid response (HTTP ${response.status}).`);
  }
  return expectedContentType.startsWith('application/json') ? response.json() : response.text();
}

async function loadFotMobDay(date, signal) {
  if (!validDate(date)) throw new Error('A valid date in YYYY-MM-DD format is required.');
  const payload = await fetchFotMob(`${FOTMOB_API}/matches?date=${date.replaceAll('-', '')}`, 'application/json', signal);
  if (!isRecord(payload) || !Array.isArray(payload.leagues)) {
    throw new Error('FotMob returned an invalid matches response.');
  }
  const fixtures = [];
  for (const league of payload.leagues) {
    if (!isRecord(league) || typeof league.name !== 'string' || !Array.isArray(league.matches)) {
      throw new Error('FotMob returned an invalid league in the matches response.');
    }
    fixtures.push(...league.matches.map(match => fixtureFromMatch(match, league.name, date)));
  }
  return fixtures;
}

async function loadFotMobDateRange(from, to, signal) {
  if (!validDate(from) || !validDate(to) || to < from) {
    throw new Error('A valid date range is required.');
  }
  const first = new Date(`${from}T00:00:00.000Z`);
  const last = new Date(`${to}T00:00:00.000Z`);
  const dayCount = Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;
  if (dayCount > 31) throw new Error('FotMob date ranges are limited to 31 days.');

  const fixtures = [];
  for (let offset = 0; offset < dayCount; offset += 4) {
    const dates = Array.from({ length: Math.min(4, dayCount - offset) }, (_, index) =>
      new Date(first.getTime() + (offset + index) * 86_400_000).toISOString().slice(0, 10)
    );
    const dailyFixtures = await Promise.all(dates.map(date => loadFotMobDay(date, signal)));
    fixtures.push(...dailyFixtures.flat());
  }
  return fixtures.sort((firstFixture, secondFixture) =>
    `${firstFixture.date}T${firstFixture.time}`.localeCompare(`${secondFixture.date}T${secondFixture.time}`)
  );
}

function mapHistoricalMatch(value, competition = '') {
  if (!isRecord(value) || !isRecord(value.home) || !isRecord(value.away)) return null;
  const status = isRecord(value.status) ? value.status : {};
  const homeTeam = text(value.home.name);
  const awayTeam = text(value.away.name);
  const tooltip = isRecord(value.tooltipText) ? value.tooltipText : {};
  const score = parseScore(text(status.scoreStr) || text(value.score))
    || (() => {
      const homeScore = numberOrNull(tooltip.homeScore);
      const awayScore = numberOrNull(tooltip.awayScore);
      return homeScore === null || awayScore === null ? null : [homeScore, awayScore];
    })();
  if (status.finished !== true && !(score && typeof value.resultString === 'string')) return null;
  if (!homeTeam || !awayTeam || !score) return null;
  const time = isRecord(value.time) ? value.time : isRecord(value.date) ? value.date : {};
  const league = isRecord(value.league) ? text(value.league.name) : competition;
  const dateValue = text(time.utcTime);
  const date = dateValue && !Number.isNaN(new Date(dateValue).getTime())
    ? new Date(dateValue).toISOString().slice(0, 10)
    : '';
  return {
    date,
    competition: league,
    homeTeam,
    awayTeam,
    homeScore: score[0],
    awayScore: score[1],
    score: `${score[0]} - ${score[1]}`,
  };
}

function getHistoricalMatches(payload) {
  const content = isRecord(payload.content) ? payload.content : {};
  const facts = isRecord(content.matchFacts) ? content.matchFacts : {};
  const h2h = isRecord(content.h2h) && Array.isArray(content.h2h.matches) ? content.h2h.matches : [];
  const confrontations = h2h.map(match => mapHistoricalMatch(match)).filter(Boolean);
  const teamForm = Array.isArray(facts.teamForm) ? facts.teamForm : [];
  const teams = Array.isArray(payload.header.teams) ? payload.header.teams : [];
  const recentMatches = teamForm.slice(0, 2).map((rows, index) =>
    (Array.isArray(rows) ? rows : [])
      .map(match => mapHistoricalMatch(match))
      .filter(Boolean)
      .map(match => ({ ...match, team: text(teams[index]?.name) }))
  );
  const seen = new Set();
  return [...confrontations, ...recentMatches.flat()].filter(match => {
    const key = `${match.date}|${match.homeTeam}|${match.awayTeam}|${match.score}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapPlayer(value) {
  if (!isRecord(value)) return null;
  const name = isRecord(value.name)
    ? text(value.name.fullName) || text(value.name.firstName)
    : text(value.name);
  if (!name) return null;
  const position = isRecord(value.position) ? text(value.position.label) : text(value.positionName);
  const performance = isRecord(value.performance) ? value.performance : {};
  const imageUrl = text(value.imageUrl) || fotMobPlayerImageUrl(value.id);
  return {
    number: Number(value.shirtNumber) || 0,
    name,
    position,
    ...(performance.rating === undefined ? {} : { rating: text(performance.rating) }),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

function mapLineup(payload, key) {
  const content = isRecord(payload.content) ? payload.content : {};
  const lineup = isRecord(content.lineup) ? content.lineup : {};
  const team = isRecord(lineup[key]) ? lineup[key] : {};
  const players = field => (Array.isArray(team[field]) ? team[field] : [])
    .map(mapPlayer)
    .filter(Boolean);
  return { formation: text(team.formation), starters: players('starters'), subs: players('subs') };
}

function parseStatistics(payload) {
  const content = isRecord(payload.content) ? payload.content : {};
  const statsPayload = isRecord(content.stats) ? content.stats : {};
  const periods = isRecord(statsPayload.Periods) ? statsPayload.Periods : {};
  const all = isRecord(periods.All) ? periods.All : {};
  const groups = Array.isArray(all.stats) ? all.stats : [];
  const stats = new Map();
  for (const group of groups) {
    if (!isRecord(group) || !Array.isArray(group.stats)) continue;
    for (const stat of group.stats) {
      if (!isRecord(stat) || typeof stat.title !== 'string' || !Array.isArray(stat.stats)) continue;
      const values = { home: text(stat.stats[0]), away: text(stat.stats[1]) };
      if (values.home || values.away) stats.set(stat.title.toLocaleLowerCase('en'), values);
    }
  }
  return stats;
}

function parseEvents(payload) {
  const content = isRecord(payload.content) ? payload.content : {};
  const facts = isRecord(content.matchFacts) ? content.matchFacts : {};
  const eventsPayload = isRecord(facts.events) ? facts.events : {};
  const events = Array.isArray(eventsPayload.events) ? eventsPayload.events : [];
  return events.filter(isRecord).map(event => {
    const type = text(event.type) || 'Événement';
    const swap = Array.isArray(event.swap) ? event.swap.filter(isRecord) : [];
    const swapNames = swap.map(entry => text(entry.name)).filter(Boolean);
    const player = isRecord(event.player) ? text(event.player.name) : text(event.player);
    const actor = text(event.nameStr) || player || swapNames.join(' → ');
    const isSubstitution = type.toLowerCase().includes('substitution');
    const detail = [
      text(event.card),
      text(event.assistStr) ? `Passe décisive : ${text(event.assistStr).replace(/^assist by\s+/i, '')}` : '',
    ].filter(Boolean).join(' ');
    const playerId = isRecord(event.player) ? event.player.id : event.playerId;
    const playerImageUrl = text(event.profileUrl).startsWith('https://')
      ? text(event.profileUrl)
      : fotMobPlayerImageUrl(playerId);
    return {
      minute: text(event.timeStr) || text(event.time),
      type,
      player: isSubstitution ? swapNames[1] || actor || type : actor || type,
      ...(detail ? { detail } : {}),
      ...(playerImageUrl ? { playerImageUrl } : {}),
      ...(typeof event.isHome === 'boolean' ? { side: event.isHome ? 'home' : 'away' } : {}),
      ...(isSubstitution && swapNames[1] ? { playerIn: swapNames[1] } : {}),
      ...(isSubstitution && swapNames[0] ? { playerOut: swapNames[0] } : {}),
    };
  });
}

function numericStat(value) {
  const result = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(result) ? result : 0;
}

const STAT_FIELDS = {
  'ball possession': 'possession',
  'expected goals (xg)': 'expectedGoals',
  'total shots': 'shots',
  shots: 'shots',
  'shots on target': 'shotsOnTarget',
  'shots off target': 'shotsOffTarget',
  'blocked shots': 'blockedShots',
  'hit woodwork': 'hitWoodwork',
  'shots inside box': 'shotsInsideBox',
  'shots outside box': 'shotsOutsideBox',
  'big chances': 'bigChances',
  'big chances missed': 'bigChancesMissed',
  'touches in opposition box': 'touchesInBox',
  corners: 'corners',
  'yellow cards': 'yellowCards',
  'red cards': 'redCards',
  'fouls committed': 'foulsCommitted',
  passes: 'passes',
  'accurate passes': 'accuratePasses',
  'accurate long balls': 'accurateLongBalls',
  'accurate crosses': 'accurateCrosses',
  throws: 'throws',
  offsides: 'offsides',
  tackles: 'tackles',
  interceptions: 'interceptions',
  blocks: 'blocks',
  clearances: 'clearances',
  'keeper saves': 'keeperSaves',
  'duels won': 'duelsWon',
  'ground duels won': 'groundDuelsWon',
  'aerial duels won': 'aerialDuelsWon',
  'successful dribbles': 'successfulDribbles',
};

function parseStandingsXml(xml) {
  const decode = value => value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code) => {
    if (code.startsWith('#x')) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith('#')) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[code.toLowerCase()] || entity;
  });
  const rows = [];
  for (const [index, row] of Array.from(xml.matchAll(/<t\b([^>]*)\/?>/g)).entries()) {
    const attributes = new Map();
    for (const [, key, value] of row[1].matchAll(/([a-zA-Z_]+)="([^"]*)"/g)) {
      attributes.set(key, decode(value));
    }
    const team = attributes.get('name');
    const points = Number(attributes.get('p'));
    const won = Number(attributes.get('w'));
    const drawn = Number(attributes.get('d'));
    const lost = Number(attributes.get('l'));
    const goalsFor = Number(attributes.get('g'));
    const goalsAgainst = Number(attributes.get('c'));
    if (!team || ![points, won, drawn, lost, goalsFor, goalsAgainst].every(Number.isFinite)) continue;
    rows.push({
      position: index + 1,
      team,
      played: won + drawn + lost,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
      points,
    });
  }
  return rows;
}

async function loadStandings(payload, signal) {
  const content = isRecord(payload.content) ? payload.content : {};
  const table = isRecord(content.table) ? content.table : {};
  const tableUrl = text(table.url);
  const leagueId = tableUrl.match(/tables\.ext\.(\d+)\.fot\.gz$/)?.[1]
    || text(table.leagueId).match(/^\d+$/)?.[0];
  if (!leagueId) return [];
  try {
    const xml = await fetchFotMob(`https://data.fotmob.com/tables.ext.${leagueId}.fot.gz`, 'text/plain, */*', signal);
    return parseStandingsXml(xml);
  } catch (error) {
    if (signal?.aborted) throw error;
    console.error(`Could not load FotMob standings for league ${leagueId}.`, error);
    return [];
  }
}

async function loadFotMobDetails(matchId, signal, includeStandings = true) {
  if (!/^\d{1,20}$/.test(matchId)) throw new Error('Provide a valid FotMob match ID.');
  const payload = await fetchFotMob(`${FOTMOB_API}/matchDetails?matchId=${encodeURIComponent(matchId)}`, 'application/json', signal);
  if (!isRecord(payload) || !isRecord(payload.general) || !isRecord(payload.header)) {
    throw new Error('FotMob returned an invalid match details response.');
  }
  const teams = Array.isArray(payload.header.teams) ? payload.header.teams : [];
  const home = teams[0];
  const away = teams[1];
  if (!isRecord(home) || !isRecord(away)) throw new Error('FotMob returned incomplete team data.');
  const general = payload.general;
  const status = isRecord(payload.header.status) ? payload.header.status : {};
  const dateValue = text(general.matchTimeUTCDate) || text(general.matchTimeUTC);
  const date = dateValue && !Number.isNaN(new Date(dateValue).getTime())
    ? new Date(dateValue).toISOString().slice(0, 10)
    : '';
  const homeScore = numberOrNull(home.score);
  const awayScore = numberOrNull(away.score);
  const liveTime = isRecord(status.liveTime)
    ? text(status.liveTime.short).replace(/[\u200e\u200f]/g, '').trim()
    : '';
  const started = status.started === true || status.finished === true;
  const time = text(general.matchTimeUTC).match(/\b\d{1,2}:\d{2}\b/)?.[0] || '';
  const homeImageUrl = text(home.imageUrl) || fotMobTeamImageUrl(home.id);
  const awayImageUrl = text(away.imageUrl) || fotMobTeamImageUrl(away.id);
  const fixture = {
    id: matchId,
    matchId,
    sport: 'football',
    date,
    time,
    league: text(general.leagueName),
    homeTeam: text(home.name),
    awayTeam: text(away.name),
    ...(homeImageUrl ? { homeImageUrl } : {}),
    ...(awayImageUrl ? { awayImageUrl } : {}),
    ...(started && homeScore !== null ? { homeScore: String(homeScore) } : {}),
    ...(started && awayScore !== null ? { awayScore: String(awayScore) } : {}),
    ...(started && text(status.scoreStr) ? { score: text(status.scoreStr) } : {}),
    ...(status.started === true && liveTime ? { liveTime } : {}),
    status: frenchStatus(status),
  };
  if (!fixture.homeTeam || !fixture.awayTeam) throw new Error('FotMob returned incomplete team data.');
  const stats = parseStatistics(payload);
  const homeLineup = mapLineup(payload, 'homeTeam');
  const awayLineup = mapLineup(payload, 'awayTeam');
  const history = getHistoricalMatches(payload);
  const standings = includeStandings ? await loadStandings(payload, signal) : [];
  return {
    payload,
    fixture,
    stats,
    homeLineup,
    awayLineup,
    events: parseEvents(payload),
    history,
    standings,
    homeImageUrl: fixture.homeImageUrl,
    awayImageUrl: fixture.awayImageUrl,
  };
}

function statsResponse(details) {
  const { fixture, stats } = details;
  const result = {
    date: fixture.date,
    competition: fixture.league,
    fixtureId: fixture.id,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    homeImageUrl: fixture.homeImageUrl,
    awayImageUrl: fixture.awayImageUrl,
    status: fixture.status,
    liveTime: fixture.liveTime,
    homeScore: fixture.homeScore === undefined ? undefined : Number(fixture.homeScore),
    awayScore: fixture.awayScore === undefined ? undefined : Number(fixture.awayScore),
    homeForm: '',
    awayForm: '',
    homeFormation: details.homeLineup.formation || undefined,
    awayFormation: details.awayLineup.formation || undefined,
    events: details.events,
    homeLineup: details.homeLineup.starters,
    awayLineup: details.awayLineup.starters,
    homeSubstitutes: details.homeLineup.subs,
    awaySubstitutes: details.awayLineup.subs,
    headToHead: details.history.filter(match => !match.team),
    standings: details.standings,
    odds: null,
    source: 'fotmob',
  };
  const facts = isRecord(details.payload.content) && isRecord(details.payload.content.matchFacts)
    ? details.payload.content.matchFacts.teamForm
    : [];
  const formFor = teamName => {
    if (!Array.isArray(facts)) return '';
    const index = teamName === fixture.homeTeam ? 0 : 1;
    const matches = Array.isArray(facts[index]) ? facts[index] : [];
    return matches.map(match => {
      const historical = mapHistoricalMatch(match);
      if (!historical) return '';
      const goals = historical.homeTeam === teamName
        ? [historical.homeScore, historical.awayScore]
        : [historical.awayScore, historical.homeScore];
      return goals[0] > goals[1] ? 'W' : goals[0] === goals[1] ? 'D' : 'L';
    }).filter(Boolean).join('');
  };
  result.homeForm = formFor(fixture.homeTeam);
  result.awayForm = formFor(fixture.awayTeam);

  for (const [label, field] of Object.entries(STAT_FIELDS)) {
    const values = stats.get(label);
    if (!values) continue;
    const textual = ['accuratePasses', 'accurateLongBalls', 'accurateCrosses', 'groundDuelsWon',
      'aerialDuelsWon', 'successfulDribbles'].includes(field);
    result[field] = textual ? values : {
      home: numericStat(values.home),
      away: numericStat(values.away),
    };
  }
  return result;
}

module.exports = {
  validDate,
  loadFotMobDay,
  loadFotMobDateRange,
  loadFotMobDetails,
  statsResponse,
  frenchStatus,
};
