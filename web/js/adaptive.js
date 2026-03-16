// ============================================================
// adaptive.js — AXIOM v3 ML-Adaptive Systems
// Implements: AI Director, DDA, Strategy Detection, Collapse Risk,
//             Player Embedding, Technology Discovery, Competing Civs
// ============================================================

// ===========================================================
// 1. PLAYER STRATEGY DETECTION
// Detects dominant playstyle from policy history → adapts world
// ===========================================================

const STRATEGY_TYPES = {
  industrial:  { label: '🏭 Industrial Expansionist', color: '#ff6d00',
    worldAdapt: '→ Climate disasters more frequent. Pollution crises amplified.' },
  eco:         { label: '🌿 Ecological Guardian',     color: '#00e676',
    worldAdapt: '→ Economic crises more severe. Industry events trigger first.' },
  tech:        { label: '🔬 Scientific Innovator',    color: '#00e5ff',
    worldAdapt: '→ AI governance events more common. Tech surprises frequent.' },
  military:    { label: '🛡️ Military Empire',          color: '#ff1744',
    worldAdapt: '→ Civil war risk elevated. Rival civs more aggressive.' },
  healthcare:  { label: '💊 Welfare State',            color: '#7c4dff',
    worldAdapt: '→ Disease breakthrough events more common.' },
  agriculture: { label: '🌾 Agrarian Society',         color: '#66bb6a',
    worldAdapt: '→ Climate → food chain events amplified.' },
  balanced:    { label: '⚖️ Balanced Strategist',      color: '#aaaadd',
    worldAdapt: '→ World adapts to keep all systems in tension.' },
};

function detectPlayerStrategy(policyHistory) {
  const entries = Object.entries(policyHistory);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total < 4) return 'balanced';

  const pct = Object.fromEntries(entries.map(([k, v]) => [k, v / total]));
  // Sorted by dominant use
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0]?.[0];
  const dominantPct = pct[dominant] ?? 0;

  if (dominantPct < 0.35) return 'balanced';
  return dominant.replace('_buildup', '').replace('environment', 'eco').replace('healthcare','healthcare');
}

// Build a player behavior embedding (5D vector: economy, ecology, tech, military, welfare)
function buildPlayerEmbedding(policyHistory) {
  const total = Object.values(policyHistory).reduce((s, v) => s + v, 0) || 1;
  return {
    economy:     (policyHistory.industry   ?? 0) / total,
    ecology:     (policyHistory.environment ?? 0) / total,
    tech:        (policyHistory.education  ?? 0) / total,
    military:    (policyHistory.military_buildup ?? 0) / total,
    welfare:     (policyHistory.healthcare ?? 0) / total + (policyHistory.agriculture ?? 0) / total * 0.5,
  };
}


// ===========================================================
// 2. COLLAPSE RISK PREDICTOR
// Multi-factor probability estimate (0-100)
// ===========================================================

function collapseRisk(s) {
  let risk = 0;
  // Food starvation pressure
  const fpc = s.food / Math.max(s.population, 1);
  if (fpc < 0.2)  risk += 30;
  else if (fpc < 0.5) risk += 15;

  // Legitimacy collapse
  if (s.legitimacy < 15) risk += 35;
  else if (s.legitimacy < 30) risk += 20;
  else if (s.legitimacy < 50) risk += 8;

  // Disease pressure
  if (s.disease_rate > 75) risk += 20;
  else if (s.disease_rate > 50) risk += 10;

  // Climate tipping point
  if (s.climate > 80) risk += 20;
  else if (s.climate > 60) risk += 10;

  // Economic collapse
  if (s.economy < 3) risk += 25;
  else if (s.economy < 10) risk += 12;

  // Anger + trust
  if (s.anger > 80 && s.trust < 20) risk += 15;

  // Positive offsets
  if (s.military > 60) risk -= 5;    // Strong military reduces civil war risk
  if (s.technology > 150) risk -= 5; // High tech reduces some risks
  if (s.happiness > 70) risk -= 5;

  return Math.max(0, Math.min(100, Math.round(risk)));
}


// ===========================================================
// 3. AI DIRECTOR SYSTEM
// Orchestrates pacing, tension, and event timing
// ===========================================================

class AIDirector {
  constructor() {
    this.recentScores   = [];  // last 5 year scores
    this.tensionLevel   = 50;  // 0=calm, 100=crisis
    this.quietPeriod    = 0;   // years since last major event
    this.crisisStreak   = 0;   // consecutive crisis years
  }

  update(currentScore, hadMajorEvent) {
    this.recentScores.push(currentScore);
    if (this.recentScores.length > 5) this.recentScores.shift();
    if (hadMajorEvent) {
      this.quietPeriod = 0;
      this.crisisStreak++;
    } else {
      this.quietPeriod++;
      this.crisisStreak = 0;
    }
    // Compute tension: rises when player excels, falls when they struggle
    const avgScore  = this.recentScores.reduce((a, b) => a + b, 0) / this.recentScores.length;
    const trend     = this.recentScores.length >= 2
      ? this.recentScores.at(-1) - this.recentScores.at(-3 > 0 ? -3 : 0)
      : 0;
    // If player is dominating → raise tension to challenge them
    if (avgScore > 75 && trend > 0) this.tensionLevel = Math.min(100, this.tensionLevel + 8);
    // If player is struggling → lower tension to help them
    else if (avgScore < 35 || trend < -10) this.tensionLevel = Math.max(10, this.tensionLevel - 8);
    // Natural decay toward 50
    else this.tensionLevel += (50 - this.tensionLevel) * 0.1;

    this.tensionLevel = Math.round(this.tensionLevel);
  }

  // DDA: Should a crisis trigger? Director decides probability
  crisisChance(year) {
    const calm     = this.quietPeriod > 10;
    const tooMany  = this.crisisStreak > 2;
    if (tooMany)  return 0.15;  // Give player breathing room
    if (calm)     return 0.85;  // Build tension
    return 0.1 + (this.tensionLevel / 100) * 0.75;
  }

  // DDA: Resource bonus for struggling players
  resourceBonus(score) {
    if (score < 30) return 1.25;
    if (score < 45) return 1.10;
    return 1.0;
  }

  // DDA: Event severity bias
  eventBias() {
    if (this.tensionLevel > 75) return 'HIGH';
    if (this.tensionLevel < 30) return 'LOW';
    return null;
  }

  stateLabel() {
    if (this.tensionLevel > 75) return { text: '🔴 HIGH TENSION', color: '#ff1744' };
    if (this.tensionLevel > 50) return { text: '🟡 BUILDING', color: '#ffb300' };
    if (this.tensionLevel > 25) return { text: '🟢 STABLE', color: '#00e676' };
    return { text: '🔵 CALM', color: '#00e5ff' };
  }
}


// ===========================================================
// 4. STRATEGY-ADAPTIVE WORLD
// World adjusts crisis probabilities based on player strategy
// ===========================================================

function strategyAdaptedCrisisWeights(strategy, crises) {
  // Returns a modified pool — crises most relevant to player strategy have higher weight
  const strategyBoosts = {
    industrial:  { eco_collapse: 2.5, mega_drought: 2.0, supervolcano: 1.5 },
    military:    { civil_war: 2.5, ai_rebellion: 1.5, tech_collapse: 1.5 },
    tech:        { ai_rebellion: 2.0, tech_collapse: 2.0, cyber: 1.5 },
    eco:         { economic_crash: 2.0, civil_war: 1.5 },
    balanced:    {},
  };
  const boosts = strategyBoosts[strategy] || {};

  const weighted = [];
  for (const crisis of crises) {
    const w = boosts[crisis.id] ?? 1;
    for (let i = 0; i < w * 10; i++) weighted.push(crisis);
  }
  return weighted;
}


// ===========================================================
// 5. TECHNOLOGY DISCOVERY (Probabilistic)
// Research investments increase discovery probability each year
// ===========================================================

const TECH_DISCOVERIES = [
  { id: 'fusion',     label: '⚡ Fusion Breakthrough',     prob: 0.04, minTech: 120, effects: { energy: 500000, pollution: -20 }, flag: 'fusion' },
  { id: 'cure',       label: '💊 Universal Cure',          prob: 0.03, minTech: 100, effects: { disease_rate: -40, happiness: 20 }, flag: null },
  { id: 'ai_assist',  label: '🤖 AI Climate Modeling',     prob: 0.05, minTech: 80,  effects: { climate: -15, technology: 20 }, flag: null },
  { id: 'vertical',   label: '🌾 Vertical Farming',        prob: 0.04, minTech: 60,  effects: { food: 500000, pollution: -5 }, flag: null },
  { id: 'antigrav',   label: '🚀 Gravity-Assist Drive',    prob: 0.02, minTech: 200, effects: { technology: 40 }, flag: 'mars' },
  { id: 'longevity',  label: '🧬 Longevity Therapy',       prob: 0.03, minTech: 150, effects: { population: 200000, happiness: 15 }, flag: null },
  { id: 'nuclear_clean', label: '☢️ Clean Nuclear Reactor', prob: 0.05, minTech: 90, effects: { energy: 300000, pollution: -15 }, flag: null },
];

function checkTechDiscovery(state, triggeredIds) {
  if (state.technology < 40) return null;
  for (const disc of TECH_DISCOVERIES) {
    if (triggeredIds.has(disc.id)) continue;
    if (state.technology < disc.minTech)  continue;
    const chance = disc.prob * (1 + (state.technology - disc.minTech) / 200);
    if (Math.random() < chance) return disc;
  }
  return null;
}


// ===========================================================
// 6. COMPETING CIVILIZATIONS
// Two AI civs run in parallel, affecting global events
// ===========================================================

const CIV_PRESETS = [
  {
    name: 'Republic of Nova',
    icon: '🏛️',
    axiom: 'tech',
    color: '#00e5ff',
    state: { population: 2000000, technology: 35, economy: 55, military: 40, climate: 22, legitimacy: 78, food: 800000, pollution: 20, disease_rate: 6, happiness: 70 },
    policy: 'education',
  },
  {
    name: 'Imperium Draconis',
    icon: '⚔️',
    axiom: 'military',
    color: '#ff1744',
    state: { population: 3000000, technology: 18, economy: 62, military: 75, climate: 30, legitimacy: 55, food: 1200000, pollution: 35, disease_rate: 12, happiness: 45 },
    policy: 'military_buildup',
  },
];

function stepCompetingCiv(civ) {
  const p = civ.policy;
  const s = { ...civ.state };

  // Simple deterministic physics for competing civs
  if (p === 'education')       { s.technology += 2; s.economy *= 0.99; }
  if (p === 'military_buildup'){ s.military = Math.min(100, s.military + 2); s.economy *= 0.985; }
  if (p === 'industry')        { s.economy *= 1.04; s.pollution += 2; }
  if (p === 'environment')     { s.pollution = Math.max(0, s.pollution - 3); s.climate -= 0.5; }

  // Population dynamics
  const fpc = s.food / Math.max(s.population, 1);
  s.population = Math.max(0, Math.round(s.population * (1 + 0.018 * Math.min(fpc * 2, 1.2) - 0.010)));
  s.food       = Math.max(0, s.food - s.population * 0.10);
  s.climate    = Math.min(100, s.climate + s.pollution * 0.015 - 0.1);
  s.disease_rate = Math.max(0, s.disease_rate + 0.2 * (s.pollution / 100) - 0.1);
  s.legitimacy = Math.max(0, Math.min(100, s.legitimacy + (s.happiness > 60 ? 0.5 : -1)));
  s.happiness  = Math.max(0, Math.min(100, s.happiness + (s.economy > 50 ? 0.3 : -0.5)));

  // Occasional AI policy switch
  if (Math.random() < 0.15) {
    const opts = ['education', 'industry', 'military_buildup', 'environment', 'agriculture'];
    civ.policy = opts[Math.floor(Math.random() * opts.length)];
  }

  civ.state = s;
  return civ;
}

// Competing civ affects global events (returns optional event)
function civGlobalEffect(civs, playerState) {
  const rival = civs.find(c => c.state.military > 70 && playerState.military < 40);
  if (rival) return {
    event: `${rival.icon} ${rival.name} has mobilized its military forces near your borders. Intelligence reports warn of imminent pressure.`,
    severity: 'HIGH',
    effects: { military: -5, legitimacy: -5 },
  };

  const ally = civs.find(c => c.state.technology > 60 && playerState.technology < 40);
  if (ally && Math.random() < 0.25) return {
    event: `${ally.icon} ${ally.name} has proposed a technology-sharing treaty. Research insights flow across borders.`,
    severity: 'MODERATE',
    effects: { technology: 10, legitimacy: 5 },
  };

  return null;
}


// ===========================================================
// 7. EMOTIONAL STATE INFERENCE
// Infers player frustration/engagement from decision patterns
// ===========================================================

class EmotionInference {
  constructor() {
    this.decisionTimes   = [];  // time between year advances (ms)
    this.sameChoiceStreak = 0;  // how many times same policy picked
    this.lastPolicy       = null;
  }

  recordAdvance(policy, msSinceLastAdvance) {
    this.decisionTimes.push(msSinceLastAdvance);
    if (this.decisionTimes.length > 10) this.decisionTimes.shift();

    if (policy === this.lastPolicy) this.sameChoiceStreak++;
    else this.sameChoiceStreak = 0;
    this.lastPolicy = policy;
  }

  inferState() {
    const avgTime = this.decisionTimes.length
      ? this.decisionTimes.reduce((a, b) => a + b, 0) / this.decisionTimes.length
      : 5000;

    // Rapid clicking + same choice = frustration or impatience
    if (avgTime < 1500 && this.sameChoiceStreak > 3) return { state: 'frustrated', tip: 'Consider switching strategy — your current approach may be suboptimal.' };
    // Very slow decisions = deep engagement or confusion
    if (avgTime > 15000) return { state: 'deliberating', tip: 'Take your time. Long-term thinking is rewarded.' };
    // Varied choices + normal pace = engaged
    if (this.sameChoiceStreak < 2 && avgTime > 2000) return { state: 'engaged', tip: null };
    return { state: 'neutral', tip: null };
  }
}
