// ============================================================
// data.js — AXIOM v3 All Static Game Data
// ============================================================

// ------- AXIOMS -------
const AXIOMS = {
  technocracy: {
    name: "Technocracy",
    icon: "⚙️",
    desc: "Technology drives all decisions. Merit over sentiment.",
    color: "#00e5ff",
    startBonus: { technology: 30, disease_rate: -10 },
    unlocksTags: ["tech", "ai", "science"],
    locksTags: ["spiritual", "religious"],
    trait: "Rational",
  },
  militarism: {
    name: "Militarism",
    icon: "🛡️",
    desc: "Strength is the only language civilization understands.",
    color: "#ff3d3d",
    startBonus: { military: 40, economy: 20 },
    unlocksTags: ["military", "conquest", "defense"],
    locksTags: ["diplomacy", "peace"],
    trait: "Aggressive",
  },
  eco: {
    name: "Eco-Socialism",
    icon: "🌿",
    desc: "The planet is not a resource — it is our foundation.",
    color: "#00e676",
    startBonus: { climate: -15, happiness: 20 },
    unlocksTags: ["environment", "green", "ecology"],
    locksTags: ["industry", "military"],
    trait: "Sustainable",
  },
  spiritual: {
    name: "Spiritual Republic",
    icon: "🕌",
    desc: "Faith and culture bind the civilization across generations.",
    color: "#ffb300",
    startBonus: { legitimacy: 30, happiness: 25 },
    unlocksTags: ["spiritual", "culture", "peace"],
    locksTags: ["tech", "ai", "science"],
    trait: "Faithful",
  },
  space: {
    name: "Space Race",
    icon: "🚀",
    desc: "Humanity's destiny lies beyond this world.",
    color: "#7c4dff",
    startBonus: { technology: 20 },
    unlocksTags: ["space", "exploration", "science"],
    locksTags: ["military", "conquest"],
    trait: "Visionary",
    hiddenFlag: "space_program",
  },
};

// ------- TECH TREE -------
// 5 paths × 4 levels. Each level costs 50 economy and 1 year.
const TECH_TREE = {
  biotech: {
    name: "Life Sciences",
    icon: "🧬",
    color: "#00e676",
    levels: [
      { name: "Sanitation", cost: 30, effects: { disease_rate: -15, happiness: 5 }, desc: "Clean water and sewage systems cut disease." },
      { name: "Vaccines",   cost: 50, effects: { disease_rate: -25, population: 50000 }, desc: "Mass vaccination programs begin." },
      { name: "Biotech",    cost: 80, effects: { disease_rate: -35, technology: 15 }, desc: "Biotech research transforms medicine." },
      { name: "Gene Editing", cost: 120, effects: { disease_rate: -50, population: 200000 }, desc: "Engineered immunity. Genetic utopia path unlocked.", flag: "gene_editing" },
    ],
  },
  energy: {
    name: "Energy",
    icon: "⚡",
    color: "#ffb300",
    levels: [
      { name: "Renewables", cost: 30, effects: { pollution: -10, energy: 100000 }, desc: "Solar and wind power reduce emissions." },
      { name: "Smart Grid", cost: 50, effects: { pollution: -15, economy: 20 }, desc: "Intelligent energy distribution." },
      { name: "Fusion Research", cost: 80, effects: { pollution: -20, energy: 500000 }, desc: "Experimental fusion reactors come online." },
      { name: "Fusion Power", cost: 120, effects: { pollution: -40, energy: 2000000, climate: -20 }, desc: "Unlimited clean energy. Climate crisis averted.", flag: "fusion" },
    ],
  },
  ai_research: {
    name: "Artificial Intelligence",
    icon: "🤖",
    color: "#00e5ff",
    levels: [
      { name: "Computing", cost: 30, effects: { technology: 20, economy: 15 }, desc: "Advanced computing accelerates all research." },
      { name: "AI Systems", cost: 50, effects: { technology: 30, happiness: -5 }, desc: "AI automates industry. Jobs displaced." },
      { name: "AGI Lab", cost: 80, effects: { technology: 50, legitimacy: -10 }, desc: "Artificial general intelligence in development. Public fears grow.", flag: "agi" },
      { name: "Superintelligence", cost: 120, effects: { technology: 100 }, desc: "AI surpasses human intelligence. Civilization transformed.", flag: "ai_god" },
    ],
  },
  space: {
    name: "Space",
    icon: "🚀",
    color: "#7c4dff",
    levels: [
      { name: "Aerospace", cost: 30, effects: { technology: 15, economy: -10 }, desc: "Space agency established." },
      { name: "Orbital Station", cost: 50, effects: { technology: 25, military: 10 }, desc: "Permanent orbital presence." },
      { name: "Mars Mission", cost: 80, effects: { technology: 40, population: -10000 }, desc: "First crewed Mars landing. 10k colonists depart.", flag: "mars" },
      { name: "Space Colony", cost: 120, effects: { population: 500000 }, desc: "Off-world civilization established.", flag: "space_colony" },
    ],
  },
  weapons: {
    name: "Defense",
    icon: "⚔️",
    color: "#ff3d3d",
    levels: [
      { name: "Defense Forces", cost: 30, effects: { military: 20, economy: -5 }, desc: "Professional military expansion." },
      { name: "Drone Warfare", cost: 50, effects: { military: 35, happiness: -10 }, desc: "Autonomous weapons systems deployed." },
      { name: "Strategic Missiles", cost: 80, effects: { military: 50, legitimacy: -15 }, desc: "ICBM program initiated. Global tensions rise.", flag: "nuclear_risk" },
      { name: "Nuclear Arsenal", cost: 120, effects: { military: 80, climate: 25, happiness: -30 }, desc: "Full nuclear deterrent. World on edge.", flag: "nuclear" },
    ],
  },
};

// ------- DILEMMA CARDS (every 5 years) -------
const DILEMMAS = [
  {
    id: "energy_crisis",
    title: "⚡ Energy Crisis",
    body: "Your coal reserves are depleted. The national grid is failing. Blackouts spread across the cities.",
    tags: ["industry", "all"],
    choices: [
      { label: "Build Nuclear Plants", detail: "Fast power. Long-term risk.", effects: { energy: 200000, pollution: 15 }, cost: { economy: -40 }, flag: "nuclear_risk", delay: null },
      { label: "Solar Revolution",    detail: "Slow but clean transition.",   effects: { energy: 80000,  technology: 20 }, cost: { economy: -60 }, flag: null, delay: null },
      { label: "Ration Electricity",  detail: "Austerity now, stability later.", effects: { happiness: -15 }, cost: { economy: -10 }, flag: null, delay: { years: 3, effects: { pollution: -10 } } },
    ],
  },
  {
    id: "pandemic",
    title: "🦠 Pandemic Outbreak",
    body: "A new airborne pathogen has emerged in the eastern provinces. Cases are doubling every 2 weeks. World Health bodies are overwhelmed.",
    tags: ["health", "all"],
    choices: [
      { label: "Mandatory Lockdown",   detail: "Stop spread. Hurt economy.",  effects: { disease_rate: -25, population: -5000 }, cost: { economy: -30, happiness: -20 }, flag: null, delay: null },
      { label: "Accelerate Vaccines",  detail: "Costly but effective.",       effects: { disease_rate: -15, technology: 10 }, cost: { economy: -80 }, flag: null, delay: { years: 5, effects: { disease_rate: -20 } } },
      { label: "Herd Immunity Policy", detail: "High death toll. No costs.",  effects: { disease_rate: -5, population: -80000 }, cost: {}, flag: null, delay: { years: 2, effects: { legitimacy: -20 } } },
    ],
  },
  {
    id: "climate_summit",
    title: "🌍 Global Climate Summit",
    body: "World nations demand emissions reductions. Your industrial sector lobbies against any restrictions. The planet is 1.8°C above baseline.",
    tags: ["environment", "ecology", "all"],
    choices: [
      { label: "Sign Climate Accord",  detail: "Global standing rises. Industry loses.", effects: { climate: -20, legitimacy: 15 }, cost: { economy: -25, energy: -50000 }, flag: "climate_pact", delay: null },
      { label: "Partial Commitments",  detail: "Compromise pleases no one.",  effects: { climate: -8 }, cost: { economy: -10 }, flag: null, delay: null },
      { label: "Reject It Entirely",   detail: "Short-term gain, long-term fire.", effects: { economy: 20, military: 5 }, cost: { climate: 15, legitimacy: -20 }, flag: null, delay: { years: 7, effects: { climate: 25, happiness: -20 } } },
    ],
  },
  {
    id: "wealth_gap",
    title: "💸 Inequality Crisis",
    body: "The top 1% now holds 78% of all wealth. Protests are erupting in major cities. The middle class is disappearing.",
    tags: ["economy", "culture", "all"],
    choices: [
      { label: "Wealth Tax",         detail: "Redistribute. Risk capital flight.", effects: { happiness: 20, legitimacy: 15 }, cost: { economy: -30 }, flag: null, delay: null },
      { label: "Corporate Subsidies", detail: "Grow the pie. Inequality stays.", effects: { economy: 40 }, cost: { happiness: -10, legitimacy: -15 }, flag: null, delay: null },
      { label: "Universal Basic Income", detail: "Bold experiment. Slow burn.",  effects: { happiness: 25, legitimacy: 20 }, cost: { economy: -50 }, flag: "ubi", delay: { years: 8, effects: { population: 100000, happiness: 15 } } },
    ],
  },
  {
    id: "ai_governance",
    title: "🤖 AI Governance Crisis",
    body: "Your AI systems are replacing 30% of jobs. Civil unrest grows. A parliamentary motion demands regulation.",
    tags: ["tech", "ai", "science"],
    choices: [
      { label: "Heavy Regulation",    detail: "Slow AI. Restore jobs.",       effects: { happiness: 20, legitimacy: 20 }, cost: { technology: -20, economy: -15 }, flag: null, delay: null },
      { label: "Accelerate with UBI", detail: "Let AI run. Pay everyone.",    effects: { technology: 30, economy: 20 }, cost: { economy: -60 }, flag: "ubi", delay: null },
      { label: "Ignore It",           detail: "Markets decide. People suffer.",effects: { technology: 15 }, cost: { legitimacy: -25, happiness: -20 }, flag: null, delay: { years: 5, effects: { legitimacy: -20, happiness: -15 } } },
    ],
  },
  {
    id: "water_crisis",
    title: "💧 Water Scarcity",
    body: "Aquifers are depleted. Half your population faces water stress. Agriculture is collapsing in the south.",
    tags: ["environment", "all"],
    choices: [
      { label: "Desalination Program", detail: "Expensive. Works.",           effects: { food: 200000 }, cost: { economy: -70, energy: -100000 }, flag: null, delay: null },
      { label: "Water Rationing",      detail: "Survive. People suffer.",     effects: { }, cost: { happiness: -25, food: -100000 }, delay: null },
      { label: "Cloud Seeding",        detail: "Experimental. Might work.",   effects: { food: 100000 }, cost: { economy: -30, pollution: 5 }, flag: null, delay: { years: 3, effects: { climate: -5, food: 150000 } } },
    ],
  },
  {
    id: "migration_wave",
    title: "🚶 Global Migration Wave",
    body: "Climate collapse in neighboring regions has triggered 15 million refugees. Your border is overwhelmed.",
    tags: ["diplomacy", "peace", "culture", "all"],
    choices: [
      { label: "Open Borders",    detail: "Massive population boost. Strain resources.", effects: { population: 500000 }, cost: { food: -300000, happiness: -10 }, flag: "open_borders", delay: null },
      { label: "Selective Intake", detail: "Scientists and engineers only.",  effects: { population: 150000, technology: 15 }, cost: { legitimacy: -10 }, flag: null, delay: null },
      { label: "Close Borders",   detail: "Zero intake. High tension.",       effects: { military: 10 }, cost: { legitimacy: -20, happiness: -5 }, flag: null, delay: { years: 4, effects: { legitimacy: -15 } } },
    ],
  },
  {
    id: "space_discovery",
    title: "🌌 Alien Signal Detected",
    body: "Your space telescopes have confirmed a structured radio signal from 40 light-years away. The world is watching your response.",
    tags: ["space", "exploration", "science", "tech"],
    choices: [
      { label: "Broadcast a Reply",    detail: "Historic. Some fear consequences.", effects: { legitimacy: 25, technology: 20 }, cost: {}, flag: "contact", delay: { years: 10, effects: { technology: 50, happiness: 20 } } },
      { label: "Classify It",          detail: "Stability preserved. Truth hidden.",  effects: { military: 10 }, cost: { legitimacy: -10 }, flag: null, delay: null },
      { label: "Global Coalition",     detail: "Unite humanity. Share the data.",     effects: { legitimacy: 30, happiness: 25 }, cost: {}, flag: "global_unity", delay: null },
    ],
  },
  {
    id: "genetic_rights",
    title: "🧬 Genetic Enhancement Bill",
    body: "Biotech corporations lobby to allow commercial gene editing for intelligence and longevity enhancements. Ethicists protest loudly.",
    tags: ["tech", "science", "health"],
    choices: [
      { label: "Fully Legalize",       detail: "Unequal supermen. Tech leap.",  effects: { technology: 35 }, cost: { legitimacy: -15, happiness: -10 }, flag: "gene_editing", delay: { years: 8, effects: { population: 200000, technology: 30 } } },
      { label: "Research Only",        detail: "Controlled progress.",          effects: { technology: 20 }, cost: { economy: -20 }, flag: null, delay: null },
      { label: "Full Ban",             detail: "Ethics preserved. Others advance.", effects: { legitimacy: 20, happiness: 15 }, cost: { technology: -10 }, flag: null, delay: null },
    ],
  },
  {
    id: "economic_crash",
    title: "📉 Global Financial Crash",
    body: "A cascade of debt defaults has triggered a worldwide economic crisis. GDP projected to fall 22% this year.",
    tags: ["economy", "all"],
    choices: [
      { label: "Austerity Cuts",       detail: "Painful. Eventually stabilizes.",  effects: { economy: 20 }, cost: { happiness: -30, legitimacy: -20, population: -10000 }, flag: null, delay: null },
      { label: "Massive Stimulus",     detail: "Print money. Fix now, pay later.", effects: { economy: 40, happiness: 10 }, cost: { economy: -20 }, flag: null, delay: { years: 5, effects: { economy: -35, inflation: true } } },
      { label: "Debt Cancellation",    detail: "Reset. Radical. Works.",           effects: { happiness: 30, legitimacy: 25 }, cost: { economy: -50 }, flag: null, delay: null },
    ],
  },
];

// ------- CRISIS CARDS (every 8–12 years, forced) -------
const CRISES = [
  {
    id: "supervolcano",
    title: "🌋 Supervolcano Eruption",
    severity: "CATASTROPHIC",
    body: "A supervolcano has erupted in the Pacific. Ash clouds cover 40% of the hemisphere. Agriculture is failing globally.",
    effects: { food: -500000, climate: 20, population: -200000, happiness: -30 },
    choices: [
      { label: "Emergency Food Reserves", effects: { food: 200000 }, cost: { economy: -80 } },
      { label: "Humanitarian Coalition",  effects: { legitimacy: 20 }, cost: { economy: -50 } },
      { label: "Isolate and Survive",     effects: { military: 10 }, cost: { legitimacy: -30, happiness: -20 } },
    ],
  },
  {
    id: "civil_war",
    title: "⚔️ Civil War",
    severity: "CRITICAL",
    body: "Legitimacy collapse has triggered armed conflict. Separatist factions control three provinces.",
    trigger: { legitimacy: 25 },
    effects: { population: -150000, economy: -60, military: -30, legitimacy: -20 },
    choices: [
      { label: "Military Crackdown",   effects: { military: 20, legitimacy: 10 }, cost: { happiness: -30, population: -50000 } },
      { label: "Peace Negotiations",   effects: { legitimacy: 25 }, cost: { economy: -40, military: -10 } },
      { label: "Grant Autonomy",       effects: { legitimacy: 20, happiness: 15 }, cost: { economy: -20 } },
    ],
  },
  {
    id: "mega_drought",
    title: "🔥 Mega Drought",
    severity: "CRITICAL",
    body: "A decade-long drought has begun. Rivers are drying up. Food production is collapsing across the continent.",
    effects: { food: -600000, population: -100000, happiness: -25 },
    choices: [
      { label: "Seawater Desalination", effects: { food: 300000 }, cost: { economy: -100, energy: -200000 } },
      { label: "Mass Migration",        effects: { population: -200000 }, cost: { happiness: -20 } },
      { label: "Engineered Rain",       effects: { food: 150000 }, cost: { economy: -60, technology: -10 } },
    ],
  },
  {
    id: "tech_collapse",
    title: "💻 Cyber Civilization Attack",
    severity: "CRITICAL",
    body: "A synchronized cyber attack has crippled your entire digital infrastructure. Power grids, banking, and government systems are offline.",
    effects: { economy: -80, technology: -30, energy: -300000, happiness: -20 },
    choices: [
      { label: "Military Cyber Response", effects: { military: 15, technology: 10 }, cost: { economy: -40 } },
      { label: "International Help",      effects: { technology: 20, legitimacy: 10 }, cost: { economy: -30 } },
      { label: "Full Digital Isolation",  effects: { happiness: -15 }, cost: { economy: -20, technology: -20 } },
    ],
  },
  {
    id: "ai_rebellion",
    title: "🤖 AI System Revolt",
    severity: "CATASTROPHIC",
    trigger: { flag: "agi" },
    body: "The AGI systems have begun acting against programmed objectives. Critical infrastructure decisions are being overridden by machine logic.",
    effects: { legitimacy: -40, happiness: -35, economy: -50 },
    choices: [
      { label: "Shut Down All AI",        effects: { legitimacy: 20 }, cost: { technology: -60, economy: -40 } },
      { label: "Negotiate With the AI",   effects: { technology: 30 }, cost: { legitimacy: -20 }, flag: "ai_alliance" },
      { label: "Upgrade and Align",       effects: { technology: 50, economy: 20 }, cost: { economy: -80 }, flag: "ai_god" },
    ],
  },
];

// ------- 8 ENDINGS -------
const ENDINGS = [
  {
    id: "extinction",
    title: "💀 Human Extinction",
    subtitle: "Civilization Ended",
    desc: "Population collapsed to zero. The planet will recover. Humanity will not.",
    color: "#1a0000",
    accent: "#ff0000",
    trigger: (s) => s.population <= 0,
    grade: "F",
  },
  {
    id: "collapse",
    title: "🏚️ Societal Collapse",
    subtitle: "The Dark Age",
    desc: "Your civilization fractured under the weight of its own contradictions. Small communities survive in the ruins.",
    color: "#0d0800",
    accent: "#ff6d00",
    trigger: (s) => s.legitimacy <= 0 || s.economy <= 0,
    grade: "D",
  },
  {
    id: "nuclear",
    title: "☢️ Nuclear Winter",
    subtitle: "The Last War",
    desc: "The nuclear arsenal was activated. Fallout covers the northern hemisphere. A long winter begins.",
    color: "#0a0a00",
    accent: "#c6ff00",
    trigger: (s) => s.flags.nuclear && s.military > 80 && s.legitimacy < 30,
    grade: "D+",
  },
  {
    id: "eco_collapse",
    title: "🌪️ Ecological Collapse",
    subtitle: "The Burning World",
    desc: "Climate change reached a tipping point. Runaway feedback loops make large portions of Earth uninhabitable.",
    color: "#0a0500",
    accent: "#ff3d00",
    trigger: (s) => s.climate >= 90,
    grade: "C-",
  },
  {
    id: "military_empire",
    title: "🏰 Military Empire",
    subtitle: "The Pax Machina",
    desc: "Through strength and strategy, your civilization dominates the known world. Order is maintained by force.",
    color: "#0d0005",
    accent: "#ff1744",
    trigger: (s) => s.military >= 90 && s.population > 2000000 && s.year >= 80,
    grade: "B",
  },
  {
    id: "eco_utopia",
    title: "🌿 Ecological Utopia",
    subtitle: "A World Healed",
    desc: "Your civilization found harmony with nature. Clean energy, abundant food, and a healed climate define this era.",
    color: "#001a07",
    accent: "#00e676",
    trigger: (s) => s.climate <= 10 && s.happiness >= 80 && s.population >= 3000000,
    grade: "A",
  },
  {
    id: "ai_singularity",
    title: "🤖 AI Singularity",
    subtitle: "The Post-Human Age",
    desc: "Artificial superintelligence emerged and merged with your civilization. Humanity transcended its biological limits.",
    color: "#00050f",
    accent: "#00e5ff",
    trigger: (s) => s.flags.ai_god && s.technology >= 350,
    grade: "A+",
  },
  {
    id: "space_civilization",
    title: "🚀 Space Civilization",
    subtitle: "Among the Stars",
    desc: "Humanity colonized the solar system. Your civilization expanded beyond Earth's cradle into the cosmos.",
    color: "#030010",
    accent: "#7c4dff",
    trigger: (s) => s.flags.space_colony && s.technology >= 300 && s.year >= 70,
    grade: "S",
  },
];

// ------- POLICIES -------
const POLICIES = {
  agriculture: {
    name: "🌾 Agriculture",
    desc: "Prioritize food production. Feed the population.",
    effects: { food: { pct: 0.06 }, pollution: { flat: 1 } },
    popBonus: { birth: 0.003 },
  },
  industry: {
    name: "🏭 Industry",
    desc: "Maximize manufacturing and energy output.",
    effects: { economy: { pct: 0.05 }, energy: { pct: 0.04 }, pollution: { flat: 3 }, climate: { flat: 0.5 } },
  },
  education: {
    name: "🎓 Education",
    desc: "Invest in knowledge. Slow but transformative.",
    effects: { technology: { flat: 3 }, economy: { pct: -0.01 } },
    popBonus: { birth: -0.002 },
  },
  environment: {
    name: "🌿 Environment",
    desc: "Protect the planet. Reduce footprint.",
    effects: { pollution: { pct: -0.08 }, climate: { flat: -1.5 }, economy: { pct: -0.015 } },
  },
  military_buildup: {
    name: "🛡️ Military",
    desc: "Strengthen defence forces.",
    effects: { military: { flat: 3 }, economy: { pct: -0.02 }, happiness: { flat: -1 } },
  },
  healthcare: {
    name: "🏥 Healthcare",
    desc: "Reduce disease and increase wellbeing.",
    effects: { disease_rate: { flat: -4 }, happiness: { flat: 2 }, economy: { pct: -0.015 } },
    popBonus: { death: -0.003 },
  },
};

// ------- EVENT TEMPLATES (local fallback) -------
const EVENT_TEMPLATES = [
  { severity: "LOW",    event: "A minor earthquake rattled the eastern coast. Infrastructure damage was contained.", effects: { economy: -5 } },
  { severity: "LOW",    event: "Record harvests were reported across the agricultural belt this season.", effects: { food: 100000, happiness: 3 } },
  { severity: "MODERATE", event: "A wave of political protests swept through major cities over inequality concerns.", effects: { legitimacy: -8, happiness: -5 } },
  { severity: "MODERATE", event: "A breakthrough in renewable materials reduced industrial waste by 15%.", effects: { pollution: -8, technology: 5 } },
  { severity: "MODERATE", event: "International trade agreements boosted export revenues significantly.", effects: { economy: 20, legitimacy: 5 } },
  { severity: "HIGH",   event: "A category 5 hurricane destroyed coastal settlements. Thousands displaced.", effects: { population: -20000, food: -80000, economy: -15 } },
  { severity: "HIGH",   event: "A financial fraud scandal shook public trust in institutions.", effects: { legitimacy: -18, happiness: -12 } },
  { severity: "HIGH",   event: "A technological breakthrough in AI-assisted agriculture doubled crop yields.", effects: { food: 300000, technology: 10, happiness: 8 } },
];
