// ============================================================
// engine.js — CIV-AI v3 Game Engine
// Simple rules → interacting systems → emergent gameplay
// ============================================================

class WorldState {
  constructor(overrides = {}) {
    this.year         = overrides.year         ?? 1;
    this.population   = overrides.population   ?? 1_000_000;
    this.food         = overrides.food         ?? 400_000;
    this.energy       = overrides.energy       ?? 300_000;
    this.technology   = overrides.technology   ?? 20;
    this.pollution    = overrides.pollution    ?? 15;
    this.economy      = overrides.economy      ?? 44;
    this.happiness    = overrides.happiness    ?? 65;
    this.legitimacy   = overrides.legitimacy   ?? 75;
    this.disease_rate = overrides.disease_rate ?? 8;
    this.military     = overrides.military     ?? 30;
    this.climate      = overrides.climate      ?? 18;
    // Extended systems
    this.water        = overrides.water        ?? 100;  // 0-100
    this.minerals     = overrides.minerals     ?? 100;  // 0-100
    // Public opinion (0-100)
    this.trust        = overrides.trust        ?? 65;
    this.fear         = overrides.fear         ?? 20;
    this.anger        = overrides.anger        ?? 25;
    this.hope         = overrides.hope         ?? 60;
    // Ideology and traits
    this.ideology     = overrides.ideology     ?? null;
    this.traits       = overrides.traits       ?? [];        // personality traits acquired
    this.policyHistory = overrides.policyHistory ?? {};     // policy → count used
    // Tech tree progress
    this.techProgress = overrides.techProgress ?? {};       // path → level (0-4)
    // Hidden flags that trigger delayed consequences
    this.flags        = overrides.flags        ?? {};
    this.pendingDelays = overrides.pendingDelays ?? [];     // [{year, effects}]
    // History for charts
    this.history      = overrides.history      ?? {
      year: [], population: [], economy: [], climate: [],
      disease_rate: [], legitimacy: [], happiness: [],
    };
  }

  clone() {
    return new WorldState({
      ...this,
      traits: [...this.traits],
      policyHistory: { ...this.policyHistory },
      techProgress: { ...this.techProgress },
      flags: { ...this.flags },
      pendingDelays: this.pendingDelays.map(d => ({ ...d })),
      history: {
        year: [...this.history.year],
        population: [...this.history.population],
        economy: [...this.history.economy],
        climate: [...this.history.climate],
        disease_rate: [...this.history.disease_rate],
        legitimacy: [...this.history.legitimacy],
        happiness: [...this.history.happiness],
      },
    });
  }

  snap() {
    // Record current state into history
    this.history.year.push(this.year);
    this.history.population.push(this.population);
    this.history.economy.push(this.economy);
    this.history.climate.push(this.climate);
    this.history.disease_rate.push(this.disease_rate);
    this.history.legitimacy.push(this.legitimacy);
    this.history.happiness.push(this.happiness);
  }
}

// ---- Main simulation step ----
function simulationStep(state, policy) {
  const s = state.clone();
  s.snap();

  // 1) Apply ideology bonuses (first year only)
  // (applied once at init, not every step)

  // 2) Apply policy effects
  const p = POLICIES[policy];
  if (p) {
    for (const [key, rule] of Object.entries(p.effects || {})) {
      if (rule.pct !== undefined) s[key] = s[key] * (1 + rule.pct);
      if (rule.flat !== undefined) s[key] = s[key] + rule.flat;
    }
  }

  // 3) Track policy usage → develop traits
  s.policyHistory[policy] = (s.policyHistory[policy] ?? 0) + 1;
  _updateTraits(s);

  // 4) Technology multipliers (emergent scale rewards)
  const tech = s.technology;
  if (tech > 50) {
    s.food    *= 1 + 0.001 * (tech - 50);
    s.economy += 0.5 * (tech - 50) / 50;
  }
  if (tech > 100) {
    s.pollution = Math.max(0, s.pollution - 0.002 * (tech - 100));
  }
  if (tech > 200) {
    s.disease_rate = Math.max(0, s.disease_rate - 0.001 * (tech - 200));
  }

  // 5) Population dynamics (Malthusian + Keynesian)
  const fpc = s.food / Math.max(s.population, 1);
  const birth_rate = 0.022 * Math.min(fpc * 2, 1.5);
  const base_death = 0.010 + 0.004 * (s.pollution / 100);
  const dis_death  = 0.005 * (s.disease_rate / 100);
  const starv_pen  = fpc < 0.5 ? 0.05 * (0.5 - fpc) : 0;
  const climate_pen = 0.003 * Math.max(0, s.climate - 40) / 60;
  const pop_bonus   = p?.popBonus?.birth ?? 0;
  const death_bonus = p?.popBonus?.death ?? 0;

  const death_rate = Math.max(0, base_death + dis_death + starv_pen + climate_pen + death_bonus);
  s.population = Math.max(0, Math.round(s.population * (1 + birth_rate + pop_bonus - death_rate)));

  // 6) Resource consumption
  s.food   = Math.max(0, s.food   - s.population * 0.12);
  s.energy = Math.max(0, s.energy * 0.97);  // natural decay

  // 7) Secondary system interactions (cascading)
  // Pollution → climate warming
  s.climate = Math.min(100, s.climate + s.pollution * 0.02 - 0.2);

  // Climate → food damage
  if (s.climate > 50) s.food *= 1 - (s.climate - 50) * 0.004;

  // Disease from overcrowding + pollution + climate
  const crowd = s.population / 5_000_000;
  s.disease_rate = Math.min(100, s.disease_rate
    + crowd * 0.5
    + s.pollution * 0.03
    - s.technology * 0.02
    + s.climate * 0.01
  );

  // Military decay
  s.military = Math.max(0, s.military - 1.5);

  // Water depletion
  s.water = Math.max(0, s.water - 0.8 + (s.flags.climate_pact ? 0.3 : 0));
  if (s.water < 30) s.food *= 0.97;  // water shortage → food penalty

  // Minerals
  if (s.policyHistory.industry) {
    s.minerals = Math.max(0, s.minerals - 0.5);
  }

  // 8) Public opinion dynamics
  // Trust: legitimacy + happiness
  s.trust = Math.max(0, Math.min(100, s.legitimacy * 0.6 + s.happiness * 0.4));
  // Fear: disease + climate + crisis
  s.fear  = Math.max(0, Math.min(100,
    s.disease_rate * 0.5 + s.climate * 0.3 + (s.military < 20 ? 20 : 0)));
  // Anger: inversely tracks happiness and legitimacy
  s.anger = Math.max(0, Math.min(100, 100 - s.happiness * 0.5 - s.legitimacy * 0.5));
  // Hope: technology + economy
  s.hope  = Math.max(0, Math.min(100, s.technology * 0.2 + s.economy * 0.5 + s.happiness * 0.3));

  // 9) Legitimacy dynamics
  if (s.happiness < 40) s.legitimacy -= 2;
  if (s.happiness > 70) s.legitimacy += 1;
  if (s.economy < 10)   s.legitimacy -= 3;
  if (s.anger > 70)     s.legitimacy -= 3;
  s.legitimacy = Math.max(0, Math.min(100, s.legitimacy));

  // Economy natural growth / decay
  s.economy = Math.max(0, s.economy * (1 + 0.01 - s.pollution * 0.0002));

  // 10) Process pending delayed consequences
  const remaining = [];
  for (const d of s.pendingDelays) {
    if (s.year >= d.triggerYear) {
      _applyEffects(s, d.effects);
      d.triggeredMsg = d.msg || "A delayed consequence from a past decision has arrived.";
      s._lastDelayMsg = d.triggeredMsg;
    } else {
      remaining.push(d);
    }
  }
  s.pendingDelays = remaining;

  // 11) Bounds enforcement
  s.pollution    = Math.max(0, Math.min(100, s.pollution));
  s.climate      = Math.max(0, Math.min(100, s.climate));
  s.happiness    = Math.max(0, Math.min(100, s.happiness));
  s.legitimacy   = Math.max(0, Math.min(100, s.legitimacy));
  s.disease_rate = Math.max(0, Math.min(100, s.disease_rate));
  s.military     = Math.max(0, Math.min(100, s.military));
  s.technology   = Math.max(0, s.technology);

  s.year += 1;
  return s;
}

// ---- Apply an effects dict to state ----
function _applyEffects(s, effects) {
  for (const [key, val] of Object.entries(effects)) {
    if (key === 'flag' || key === 'inflation') continue;
    if (key in s) {
      if (typeof s[key] === 'number') s[key] += val;
    }
  }
}

// ---- Update civilization personality traits ----
function _updateTraits(s) {
  const p = s.policyHistory;
  const total = Object.values(p).reduce((a, b) => a + b, 0);
  if (total < 5) return;

  const traits = new Set(s.traits);
  const pct = (k) => (p[k] ?? 0) / total;

  if (pct('industry')       > 0.40) traits.add('Industrial Power');
  if (pct('education')      > 0.35) traits.add('Knowledge Society');
  if (pct('environment')    > 0.35) traits.add('Eco-Conscious');
  if (pct('military_buildup') > 0.35) traits.add('Militaristic');
  if (pct('healthcare')     > 0.35) traits.add('Welfare State');
  if (pct('agriculture')    > 0.40) traits.add('Agrarian');

  s.traits = [...traits];
}

// ---- Apply a dilemma/crisis choice ----
function applyChoice(state, choice, currentYear) {
  const s = state.clone();

  // Immediate effects
  if (choice.effects) _applyEffects(s, choice.effects);
  if (choice.cost)    _applyEffects(s, choice.cost);

  // Set flags
  if (choice.flag) s.flags[choice.flag] = true;

  // Schedule delayed consequences
  if (choice.delay) {
    s.pendingDelays.push({
      triggerYear: currentYear + choice.delay.years,
      effects: choice.delay.effects,
      msg: choice.delay.msg,
    });
  }

  return s;
}

// ---- Apply tech research ----
function applyTechLevel(state, path, level) {
  const s = state.clone();
  const lvl = TECH_TREE[path].levels[level];
  _applyEffects(s, lvl.effects);
  if (lvl.flag) s.flags[lvl.flag] = true;
  s.techProgress[path] = (s.techProgress[path] ?? 0) + 1;
  s.economy -= lvl.cost;
  return s;
}

// ---- Apply event effects ----
function applyEvent(state, effects) {
  const s = state.clone();
  _applyEffects(s, effects);
  return s;
}

// ---- Apply ideology start bonuses ----
function applyIdeology(state, ideologyKey) {
  const s = state.clone();
  s.ideology = ideologyKey;
  const ideo = IDEOLOGIES[ideologyKey];
  _applyEffects(s, ideo.startBonus);
  if (ideo.hiddenFlag) s.flags[ideo.hiddenFlag] = true;
  return s;
}

// ---- Check revolutionary collapse ----
function isRevolution(s) {
  return s.legitimacy <= 0 || (s.anger > 85 && s.legitimacy < 30);
}

// ---- Check for ending conditions ----
function checkEnding(s) {
  for (const ending of ENDINGS) {
    if (ending.trigger(s)) return ending;
  }
  // Year limit
  if (s.year > 100) {
    const score = _calcScore(s);
    if (score >= 80) return ENDINGS.find(e => e.id === 'eco_utopia') || null;
    return { id: 'survived', title: '🌍 Civilization Endured', subtitle: 'The Endless Game', desc: `Your civilization reached Year 100. Score: ${score}/100.`, color: '#0a0a14', accent: '#00e5ff', grade: score >= 70 ? 'A-' : score >= 50 ? 'B' : 'C' };
  }
  return null;
}

function _calcScore(s) {
  const pop    = Math.min(100, s.population / 100000);
  const env    = Math.max(0, 100 - s.climate);
  const health = Math.max(0, 100 - s.disease_rate);
  const social = (s.happiness + s.legitimacy) / 2;
  const tech   = Math.min(100, s.technology / 3);
  return Math.round((pop + env + health + social + tech) / 5);
}

// ---- Should a dilemma trigger this year? ----
function shouldTriggerDilemma(year) {
  return year > 1 && year % 5 === 0;
}

// ---- Should a crisis trigger? ----
function shouldTriggerCrisis(year, random) {
  return year > 8 && year % 9 === 0 && random < 0.7;
}

// ---- Pick a dilemma card appropriate for ideology ----
function pickDilemma(state, usedIds) {
  const ideo = IDEOLOGIES[state.ideology];
  const unlocked = ideo ? ideo.unlocksTags : [];
  const locked   = ideo ? ideo.locksTags   : [];

  const candidates = DILEMMAS.filter(d =>
    !usedIds.has(d.id) &&
    !d.tags.some(t => locked.includes(t))
  );

  // Prefer ideology-specific ones
  const preferred = candidates.filter(d =>
    d.tags.some(t => unlocked.includes(t) || t === 'all')
  );

  const pool = preferred.length > 0 ? preferred : candidates;
  if (pool.length === 0) return DILEMMAS[Math.floor(Math.random() * DILEMMAS.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---- Pick a crisis appropriate for current state ----
function pickCrisis(state, usedIds) {
  const eligible = CRISES.filter(c => {
    if (usedIds.has(c.id)) return false;
    if (c.trigger?.legitimacy && state.legitimacy > c.trigger.legitimacy) return false;
    if (c.trigger?.flag && !state.flags[c.trigger.flag]) return false;
    return true;
  });
  if (eligible.length === 0) return CRISES[0];
  return eligible[Math.floor(Math.random() * eligible.length)];
}

// ---- Local event generation (no API) ----
function generateLocalEvent(state) {
  // State-conditional emergent events
  const events = [...EVENT_TEMPLATES];

  if (state.disease_rate > 60)
    events.push({ severity: "HIGH", event: "The disease is spreading faster than hospitals can cope. Emergency health measures are being discussed in parliament.", effects: { population: -30000, happiness: -10, legitimacy: -5 } });

  if (state.climate > 60)
    events.push({ severity: "HIGH", event: "Record temperatures shatter historical records across the northern hemisphere. Migration from affected zones accelerates.", effects: { food: -150000, happiness: -8 } });

  if (state.legitimacy < 35)
    events.push({ severity: "HIGH", event: "A popular uprising challenges the central government. Protesters demand immediate reform.", effects: { legitimacy: -10, happiness: -15, military: -5 } });

  if (state.technology > 100)
    events.push({ severity: "LOW", event: "A technological breakthrough in materials science dramatically reduces manufacturing costs.", effects: { economy: 25, technology: 5 } });

  if (state.water < 40)
    events.push({ severity: "MODERATE", event: "Water rationing has been introduced in major cities as aquifer levels continue falling.", effects: { food: -80000, happiness: -12 } });

  if (state.flags.gene_editing)
    events.push({ severity: "MODERATE", event: "The first generation of genetically enhanced children enters the workforce. Productivity statistics are extraordinary.", effects: { technology: 15, economy: 20, happiness: -5 } });

  if (state.flags.mars)
    events.push({ severity: "LOW", event: "A live transmission from the Mars colony draws billions of viewers. National pride surges.", effects: { happiness: 15, legitimacy: 8, technology: 5 } });

  const pick = events[Math.floor(Math.random() * events.length)];
  return pick;
}
