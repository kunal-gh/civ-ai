// ============================================================
// game.js — AXIOM v4  Retro Terminal Edition
// UX: Policy buttons → advance year immediately
//     Events render as typewriter "news flashes"
//     All complex data lives in tabs (Data / Research / World)
// ============================================================

// ---- Global State ----
let G = {
  state: null,
  selectedAxiom: null,
  history: [],
  usedDilemmas: new Set(), usedCrises: new Set(), triggeredDiscoveries: new Set(),
  chart: null, mlCache: null,
  gameRunning: false, advancing: false,
  lastAdvanceMs: null,
  director: null, emotionTracker: null, competingCivs: null,
  playerStrategy: 'balanced', playerScoreHistory: [],
};

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
  renderStartScreen();
  document.getElementById('start-btn').addEventListener('click', startGame);
  initTabNav();
});

// ── Tab Navigation ──
function initTabNav() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + tab)?.classList.add('active');
    });
  });
}

// ==================================================
// START SCREEN
// ==================================================
function renderStartScreen() {
  const grid = document.getElementById('axiom-grid');
  grid.innerHTML = '';
  for (const [key, ideo] of Object.entries(AXIOMS)) {
    const card = document.createElement('div');
    card.className = 'axiom-card';
    card.style.setProperty('--accent-color', ideo.color);
    card.style.setProperty('--glow-bg', ideo.color + '11');
    card.innerHTML = `<div class="icon">${ideo.icon}</div>
      <div class="name" style="color:${ideo.color}">${ideo.name}</div>
      <div class="desc">${ideo.desc}</div>`;
    card.addEventListener('click', () => {
      document.querySelectorAll('.axiom-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      G.selectedAxiom = key;
      document.getElementById('axiom-desc-preview').innerHTML =
        `<span style="color:${ideo.color}">${ideo.icon} ${ideo.name}:</span> ${ideo.desc}`;
      document.getElementById('start-btn').disabled = false;
    });
    grid.appendChild(card);
  }
}

async function startGame() {
  if (!G.selectedAxiom) return;
  
  const startBtn = document.getElementById('start-btn');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerText = "CALCULATING TRAJECTORY...";
  }

  const doStart = async () => {
    let state = new WorldState();
    state = applyAxiom(state, G.selectedAxiom);
    G.state = state;
    G.director = new AIDirector();
    G.emotionTracker = new EmotionInference();
    G.competingCivs = CIV_PRESETS.map(c => JSON.parse(JSON.stringify(c)));
    G.history = []; G.usedDilemmas = new Set(); G.usedCrises = new Set();
    G.triggeredDiscoveries = new Set(); G.playerScoreHistory = [];
    G.advancing = false;

    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('app').style.display = 'grid';

    renderAll();
    initChart();
    addTimeline(1, `Civilization founded under ${AXIOMS[G.selectedAxiom].name}.`);

    // Welcome news flash (no typewriter delay)
    setNewsFlash(
      '>> SYSTEM INITIALIZED',
      null,
      `${AXIOMS[G.selectedAxiom].icon} ${AXIOMS[G.selectedAxiom].name.toUpperCase()} PROTOCOL ACTIVE\n\nWelcome, Administrator. Your civilization is online.\nYear 1 begins now. Select a directive to advance time.\n\nRemember: Every choice has cascading consequences.\nThe AI Director watches. The world adapts.`,
      []
    );
  };

  if (window.flyToEarth) {
    window.flyToEarth(doStart);
  } else {
    doStart();
  }
}

// ==================================================
// FULL RENDER
// ==================================================
function renderAll() {
  if (!G.state) return;
  const s = G.state;
  const ideo = AXIOMS[s.axiom];

  // Header
  document.getElementById('hdr-year').textContent = `YEAR ${s.year}`;
  const hdrIdeo = document.getElementById('hdr-axiom');
  hdrIdeo.style.display = 'inline-block';
  hdrIdeo.textContent = `${ideo.icon} ${ideo.name}`;
  hdrIdeo.style.color = ideo.color; hdrIdeo.style.borderColor = ideo.color;
  document.getElementById('hdr-score').textContent = `SCORE: ${calcScore(s)}/100`;
  document.getElementById('hdr-traits').innerHTML =
    s.traits.map(t => `<span class="trait-badge">${t}</span>`).join('');

  renderSidebar(s);
  setupNLPTerminal();
  renderMetrics(s);
  renderAlerts(s);
  renderTechTree(s);
  renderWorldStage();
  renderStrategyProfile(s);
  updateChart(s);
}

// ==================================================
// SIDEBAR
// ==================================================
function renderSidebar(s) {
  // Resources
  document.getElementById('resource-bars').innerHTML = [
    resBar('🌾', 'Food',     s.food,     4000000, 'food'),
    resBar('⚡', 'Energy',   s.energy,   3000000, 'energy'),
    resBar('💧', 'Water',    s.water,    100,     'water'),
    resBar('💎', 'Minerals', s.minerals, 100,     'minerals'),
  ].join('');

  // Opinion
  document.getElementById('opinion-bars').innerHTML = [
    opBar('Trust', s.trust,  'trust'),
    opBar('Fear',  s.fear,   'fear'),
    opBar('Anger', s.anger,  'anger'),
    opBar('Hope',  s.hope,   'hope'),
  ].join('');

  // Collapse Risk
  const risk = collapseRisk(s);
  const rColor = risk < 25 ? '#a366ff' : risk < 50 ? '#c299ff' : risk < 75 ? '#ff4db8' : '#e60073';
  const rLabel = risk < 25 ? 'LOW' : risk < 50 ? 'MODERATE' : risk < 75 ? 'HIGH' : 'CRITICAL';
  document.getElementById('collapse-risk-val').textContent = `${risk}% — ${rLabel}`;
  document.getElementById('collapse-risk-val').style.color = rColor;
  document.getElementById('collapse-risk-fill').style.width = `${risk}%`;
  document.getElementById('collapse-risk-fill').style.background = rColor;

  // AI Director
  if (G.director) {
    const lbl = G.director.stateLabel();
    const t = G.director.tensionLevel;
    document.getElementById('director-state').innerHTML =
      `<div class="dir-label" style="color:${lbl.color}">${lbl.text}</div>
       <div class="dir-bar-track">
         <div class="dir-bar-fill" style="width:${t}%;background:${lbl.color}"></div>
       </div>
       <div class="dir-sub">Tension ${t}% · Quiet ${G.director.quietPeriod}yr</div>`;
  }
}

function resBar(icon, label, val, max, cls) {
  const pct = Math.min(100, (val / max) * 100);
  const display = max <= 100 ? val.toFixed(0) : val >= 1e6 ? (val/1e6).toFixed(1)+'M' : (val/1e3).toFixed(0)+'K';
  return `<div class="res-bar">
    <div class="res-row"><span>${icon} ${label}</span><span class="res-val">${display}</span></div>
    <div class="res-track"><div class="res-fill res-fill-${cls}" style="width:${pct}%"></div></div>
  </div>`;
}

function opBar(label, val, cls) {
  return `<div class="op-bar">
    <span class="op-lbl">${label}</span>
    <div class="op-track"><div class="op-fill op-fill-${cls}" style="width:${val.toFixed(0)}%"></div></div>
    <span class="op-val">${val.toFixed(0)}</span>
  </div>`;
}

// ==================================================
// NEWS FLASH
// ==================================================
function setNewsFlash(terminalId, severity, text, effects) {
  document.getElementById('news-terminal-id').textContent = terminalId;
  const sevBadge = document.getElementById('news-sev-badge');
  if (severity) {
    sevBadge.style.display = 'inline-block';
    sevBadge.textContent = severity;
    sevBadge.className = `news-sev ${severity}`;
  } else {
    sevBadge.style.display = 'none';
  }
  document.getElementById('news-flash-title').textContent = '';
  document.getElementById('news-flash-text').textContent = text;
  document.getElementById('news-effects').innerHTML = (effects || []).map(e =>
    `<span class="eff-tag eff-${e.type}">${e.label}</span>`
  ).join('');
}

async function typeNewsFlash(terminalId, severity, title, body, effects) {
  document.getElementById('news-terminal-id').textContent = terminalId;
  const sevBadge = document.getElementById('news-sev-badge');
  if (severity) {
    sevBadge.style.display = 'inline-block';
    sevBadge.textContent = severity;
    sevBadge.className = `news-sev ${severity}`;
  } else {
    sevBadge.style.display = 'none';
  }

  // Set title instantly
  const titleEl = document.getElementById('news-flash-title');
  const textEl  = document.getElementById('news-flash-text');
  titleEl.textContent = title;
  textEl.textContent  = '';

  // Typewriter body
  await typeWrite(textEl, body, 15);

  // Show effects
  document.getElementById('news-effects').innerHTML = (effects || []).map(e =>
    `<span class="eff-tag eff-${e.type}">${e.label}</span>`
  ).join('');
}

function typeWrite(el, text, speed) {
  return new Promise(resolve => {
    el.textContent = '';
    let i = 0;
    el.innerHTML = '<span id="news-cursor"></span>';
    const cursor = document.getElementById('news-cursor');
    const tick = () => {
      if (i < text.length) {
        el.insertBefore(document.createTextNode(text[i++]), cursor);
        setTimeout(tick, speed);
      } else { resolve(); }
    };
    tick();
  });
}

// Build effect tags from event effects object
function buildEffectTags(s, prevState) {
  const keys = ['population','economy','climate','disease_rate','legitimacy','happiness','trust'];
  const inverse = new Set(['climate','disease_rate','pollution']);
  return keys.map(k => {
    if (s[k] === undefined || prevState[k] === undefined) return null;
    const delta = s[k] - prevState[k];
    if (Math.abs(delta) < 0.1) return null;
    const good = inverse.has(k) ? delta < 0 : delta > 0;
    const sign  = delta > 0 ? '+' : '';
    const dFmt  = Math.abs(delta) >= 1000 ? (delta/1000).toFixed(1)+'K' : delta.toFixed(1);
    return { type: good ? 'good' : 'bad', label: `${sign}${dFmt} ${k.replace('_rate','')}` };
  }).filter(Boolean);
}

// ==================================================
// NLP TERMINAL SETUP (idempotent via onclick)
// ==================================================
function setupNLPTerminal() {
  const btn = document.getElementById('nlp-submit-btn');
  const inp = document.getElementById('nlp-input');
  if (!btn || !inp) return;
  if (btn.dataset.nlpBound) return; // already set up
  btn.dataset.nlpBound = '1';

  const submitAction = () => {
    const text = inp.value.trim();
    if (!text || G.advancing) return;
    inp.value = '';
    advanceYearText(text);
  };

  btn.onclick = submitAction;
  inp.onkeypress = (e) => { if (e.key === 'Enter') submitAction(); };
}

// ==================================================
// ADVANCE YEAR (NLP TEXT EVALUATION)
// ==================================================
async function advanceYearText(directiveText) {
  if (G.advancing) return;
  G.advancing = true;

  const inp = document.getElementById('nlp-input');
  const btn = document.getElementById('nlp-submit-btn');
  const hdrTxt = document.getElementById('choice-hdr-txt');

  const unlock = () => {
    G.advancing = false;
    if (inp) { inp.disabled = false; inp.focus(); }
    if (btn) btn.disabled = false;
    if (hdrTxt) hdrTxt.textContent = 'AUTHORIZE DIRECTIVE';
  };

  try {
    if (inp && btn) { inp.disabled = true; btn.disabled = true; }
    if (hdrTxt) hdrTxt.textContent = 'PROCESSING...';

    const prevState = JSON.parse(JSON.stringify(G.state));

    setNewsFlash(
      `>> DIRECTIVE TRANSMITTED`,
      null,
      `>>> ${directiveText}\n\nCalculating consequences...`,
      []
    );
    await delay(600);

    // Simulate base year step
    G.state = simulationStepBase(G.state);
    const s = G.state;

    // DDA bonus
    const score = calcScore(s);
    G.playerScoreHistory.push(score);
    const bonus = G.director?.resourceBonus(score) ?? 1;
    if (bonus > 1) { G.state.food *= bonus; G.state.energy *= bonus; }

    // Rival civs
    G.competingCivs = G.competingCivs.map(civ => stepCompetingCiv(civ));
    const civEvent = civGlobalEffect(G.competingCivs, G.state);
    if (civEvent) {
      G.state = applyEvent(G.state, civEvent.effects || {});
      addTimeline(s.year, civEvent.event.slice(0, 80));
    }

    // Evaluate directive via LLM (fallback to local heuristics)
    if (hdrTxt) hdrTxt.textContent = 'LLM INFERENCE...';
    let ev;
    try {
      const API_URL = window.CIV_API_URL || '';
      const res = await fetch(`${API_URL}/api/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: {
          population: G.state.population, food: G.state.food,
          technology: G.state.technology, pollution: G.state.pollution,
          economy: G.state.economy, happiness: G.state.happiness,
          legitimacy: G.state.legitimacy, disease_rate: G.state.disease_rate,
          military: G.state.military, climate: G.state.climate
        }, directive: directiveText }),
        signal: AbortSignal.timeout(7000)
      });
      if (!res.ok) throw new Error('API ' + res.status);
      ev = await res.json();
      if (!ev.consequence || !ev.effects) throw new Error('Bad response');
    } catch (apiErr) {
      console.warn('Fallback:', apiErr.message);
      ev = generateLocalFallbackConsequence(directiveText, G.state);
    }

    const preApplyState = JSON.parse(JSON.stringify(G.state));
    G.state = applyEvent(G.state, ev.effects || {});

    const delayMsg = s._lastDelayMsg || '';
    const civMsg = civEvent ? `\n\n🌐 WORLD STAGE: ${civEvent.event}` : '';
    const delMsg = delayMsg ? `\n\n⏰ DELAYED EFFECT: ${delayMsg}` : '';
    const decadeMsg = s.year % 10 === 0
      ? `\n\n— DECADE ${s.year}: Score ${score}/100`
      : '';

    await typeNewsFlash(
      `>> YEAR ${s.year} — ACTION REPORT`,
      ev.severity || 'OK',
      ev.consequence.length > 60 ? ev.consequence.slice(0, 60) + '…' : ev.consequence,
      ev.consequence + civMsg + delMsg + decadeMsg,
      buildEffectTags(G.state, preApplyState)
    );

    // Show popup toast if there is a crisis event
    if (ev.severity === 'WARNING' || ev.severity === 'CRITICAL') {
      showEventToast(ev.consequence.slice(0, 100), ev.severity);
    }

    addTimeline(s.year, ev.consequence.slice(0, 80));

    // Tech discovery
    const disc = checkTechDiscovery(G.state, G.triggeredDiscoveries);
    if (disc) {
      G.triggeredDiscoveries.add(disc.id);
      G.state = applyEvent(G.state, disc.effects);
      if (disc.flag) G.state.flags[disc.flag] = true;
      showTechDiscovery(disc);
      addTimeline(s.year, `✨ BREAKTHROUGH: ${disc.label}`);
    }

    G.director?.update(score, !!civEvent);
    fetchMLPredictions(G.state);

    renderSidebar(G.state);
    renderMetrics(G.state);
    renderAlerts(G.state);
    renderTechTree(G.state);
    renderWorldStage();
    renderStrategyProfile(G.state);
    updateChart(G.state);
    document.getElementById('hdr-year').textContent = `YEAR ${G.state.year}`;
    document.getElementById('hdr-score').textContent = `SCORE: ${calcScore(G.state)}/100`;
    document.getElementById('hdr-traits').innerHTML =
      G.state.traits.map(t => `<span class="trait-badge">${t}</span>`).join('');

    // Dilemma every 5 years
    if (G.state.year % 5 === 0) {
      const dilemma = pickDilemma(G.state, G.usedDilemmas);
      if (dilemma) { G.usedDilemmas.add(dilemma.id); await showModal(dilemma, 'DILEMMA', G.state.year); }
    }
    // Crisis every ~9 years
    else if (G.state.year > 8 && G.state.year % 9 === 0 &&
             Math.random() < (G.director?.crisisChance(G.state.year) ?? 0.6)) {
      const pool = strategyAdaptedCrisisWeights(G.playerStrategy, CRISES).filter(c => !G.usedCrises.has(c.id));
      if (pool.length > 0) {
        const crisis = pool[Math.floor(Math.random() * pool.length)];
        G.usedCrises.add(crisis.id);
        G.state = applyEvent(G.state, crisis.effects || {});
        await showModal(crisis, 'CRISIS', G.state.year);
      }
    }

    // Revolution check
    if (isRevolution(G.state)) {
      G.state.legitimacy = Math.max(25, G.state.legitimacy * 0.5);
      G.state.economy *= 0.65; G.state.military *= 0.6;
      addTimeline(G.state.year, '🔥 REVOLUTION — Government collapsed.');
      showEventToast('The people have risen. The government has collapsed.', 'CRITICAL');
      await typeNewsFlash(`>> YEAR ${G.state.year} — ALERT`, 'CATASTROPHIC', 'REVOLUTION OUTBREAK',
        'The people have risen. Government collapsed. All progress reversed.', []);
    }

    // Check endings
    const ending = checkEnding(G.state);
    if (ending) { showEnding(ending); return; }
    if (s.year >= 100) { showEndingScreen('VICTORY'); return; }

  } catch (err) {
    console.error('advanceYearText error:', err);
    setNewsFlash('>> ERROR', null, 'An error occurred. Try again.', []);
  } finally {
    unlock();
  }
}


// ==================================================
// UI HELPERS
// ==================================================
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Event Toast Popup ──
function showEventToast(message, severity) {
  let toast = document.getElementById('event-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'event-toast';
    document.body.appendChild(toast);
  }
  const colors = { 'CRITICAL': '#ff4d4d', 'WARNING': '#e5c07b', 'OK': '#4dd2ff' };
  const icons  = { 'CRITICAL': '🚨', 'WARNING': '⚠', 'OK': '●' };
  toast.style.cssText = `
    position:fixed; top:80px; right:20px; z-index:9999;
    background:#060a16; border:1px solid ${colors[severity]||'#334155'};
    border-left:3px solid ${colors[severity]||'#4dd2ff'};
    color:#e2e8f0; padding:14px 18px; max-width:320px;
    font-family:'Jura',sans-serif; font-size:.9rem; line-height:1.5;
    border-radius:2px; box-shadow: 0 8px 32px rgba(0,0,0,.6);
    opacity:1; transition:opacity .4s ease;
  `;
  toast.innerHTML = `
    <div style="font-size:.75rem;letter-spacing:2px;color:${colors[severity]||'#4dd2ff'};margin-bottom:6px;text-transform:uppercase;font-weight:700;">${icons[severity]||'●'} ${severity||'EVENT'}</div>
    <div>${message}</div>
  `;
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.style.opacity='0'; setTimeout(()=>toast.remove(),400); }, 5000);
}

function showTechDiscovery(disc) {
  const panel = document.getElementById('tech-discovery-panel');
  panel.style.display = 'block';
  panel.innerHTML = `<div class="disc-banner">
    <span class="disc-hdr">✨ BREAKTHROUGH: ${disc.label}</span>
    <span class="disc-efx">${Object.entries(disc.effects).map(([k,v])=>`${v>0?'+':''}${v} ${k}`).join(' · ')}</span>
  </div>`;
  setTimeout(() => { panel.style.display = 'none'; }, 8000);
}

function renderAlerts(s) {
  const ids = ['advisor-panel','anomaly-panel','revolution-panel','collapse-panel'];
  ids.forEach(id => { const el = document.getElementById(id); if(el) { el.style.display='none'; el.innerHTML=''; } });

  if (s.legitimacy < 25 && s.anger > 70) {
    const rp = document.getElementById('revolution-panel');
    if (rp) { rp.style.display = 'block'; rp.innerHTML = '<div class="revolution-msg">⚠ REVOLUTION IMMINENT</div>'; }
  }
  if (s.population < 100000 || s.food < 10000 || s.economy < 2) {
    const cp = document.getElementById('collapse-panel');
    if (cp) { cp.style.display = 'block'; cp.innerHTML = '<div class="revolution-msg">🚨 CRITICAL FAILURE</div>'; }
  }
  if (G.mlCache?.advisor) {
    const ap = document.getElementById('advisor-panel');
    if (ap) { ap.style.display = 'block'; ap.innerHTML = `<div class="advisor-msg">🤖 ${G.mlCache.advisor}</div>`; }
  }
  if (G.mlCache?.anomaly) {
    const anp = document.getElementById('anomaly-panel');
    if (anp) { anp.style.display = 'block'; anp.innerHTML = '<div class="anomaly-msg">⚠ ANOMALY DETECTED</div>'; }
  }
}

// ==================================================
// DATA TAB — METRICS
// ==================================================
const METRICS = [
  { key:'population',   label:'Population', icon:'👥', fmt:v=>v>=1e6?(v/1e6).toFixed(2)+'M':(v/1e3).toFixed(0)+'K', inverse:false },
  { key:'economy',      label:'Economy',    icon:'💰', fmt:v=>'$'+v.toFixed(1)+'T', inverse:false },
  { key:'technology',   label:'Technology', icon:'🔬', fmt:v=>'Lv '+v.toFixed(0), inverse:false },
  { key:'happiness',    label:'Happiness',  icon:'😊', fmt:v=>v.toFixed(1)+'%', inverse:false },
  { key:'legitimacy',   label:'Legitimacy', icon:'🏛', fmt:v=>v.toFixed(1)+'%', inverse:false },
  { key:'pollution',    label:'Pollution',  icon:'🌫', fmt:v=>v.toFixed(1)+'/100', inverse:true },
  { key:'climate',      label:'Climate',    icon:'🔥', fmt:v=>v.toFixed(1)+'/100', inverse:true },
  { key:'disease_rate', label:'Disease',    icon:'🦠', fmt:v=>v.toFixed(1)+'/100', inverse:true },
  { key:'military',     label:'Military',   icon:'🛡️', fmt:v=>v.toFixed(1)+'/100', inverse:false },
];

function renderMetrics(s) {
  const hist = s.history; const prevIdx = hist.population.length - 1;
  const container = document.getElementById('metrics-grid');
  if (!container) return;
  container.innerHTML = '';
  for (const m of METRICS) {
    const val = s[m.key]; let delta = null;
    if (prevIdx >= 0 && hist[m.key]) delta = val - hist[m.key][prevIdx];
    const tile = document.createElement('div');
    tile.className = 'metric-tile';
    let deltaHtml = '';
    if (delta !== null && Math.abs(delta) > 0.01) {
      const isGood = m.inverse ? delta < 0 : delta > 0;
      const cls = isGood ? (m.inverse?'delta-inv-down':'delta-up') : (m.inverse?'delta-inv-up':'delta-down');
      const fmtD = Math.abs(delta) >= 1000 ? (delta/1000).toFixed(1)+'K' : delta.toFixed(1);
      deltaHtml = `<span class="m-delta ${cls}">${delta>0?'+':''}${fmtD}</span>`;
    }
    tile.innerHTML = `<div class="m-icon">${m.icon}</div>
      <div class="m-info">
        <div class="m-label">${m.label}</div>
        <div class="m-value">${m.fmt(val)}</div>
        ${deltaHtml}
      </div>`;
    container.appendChild(tile);
  }
}

// ==================================================
// ML PREDICTIONS
// ==================================================
async function fetchMLPredictions(s) {
  const mlPanel = document.getElementById('ml-panel');
  try {
    const API_URL = window.CIV_API_URL || '';
    const res = await fetch(`${API_URL}/api/predict`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ state:{ population:s.population, food:s.food, energy:s.energy, technology:s.technology, pollution:s.pollution, economy:s.economy, happiness:s.happiness, legitimacy:s.legitimacy, disease_rate:s.disease_rate, military:s.military, climate:s.climate, water:s.water, minerals:s.minerals, trust:s.trust, fear:s.fear, anger:s.anger, hope:s.hope } }),
      signal: AbortSignal.timeout(2500)
    });
    if (!res.ok) throw new Error('ML Predict API failed');
    const data = await res.json();
    G.mlCache = { 
      predictions: {
        'Δ Pop': data.predicted_delta,
        ...data.feature_importances
      },
      confidence: data.confidence, 
      advisor: pickAdvisorTip(s), 
      anomaly: s.disease_rate > 60 && s.climate > 50 
    };
    renderMLPanel(mlPanel, G.mlCache); return;
  } catch (err) {
    console.warn("ML API fallback to local approximation:", err);
  }
  // Fallback
  const next = simulationStep(JSON.parse(JSON.stringify(s)), 'agriculture');
  G.mlCache = {
    predictions: {
      'Δ Pop':  Math.round(next.population - s.population),
      'Δ Eco':  +(next.economy - s.economy).toFixed(2),
      'Δ Clim': +(next.climate - s.climate).toFixed(2),
      'Δ Dis':  +(next.disease_rate - s.disease_rate).toFixed(2),
      'Δ Leg':  +(next.legitimacy - s.legitimacy).toFixed(2),
    },
    confidence: 'LOCAL', advisor: pickAdvisorTip(s), anomaly: collapseRisk(s) > 65,
  };
  renderMLPanel(mlPanel, G.mlCache);
}

function renderMLPanel(container, data) {
  const icons = {'Δ Pop':'👥','Δ Eco':'💰','Δ Clim':'🔥','Δ Dis':'🦠','Δ Leg':'🏛'};
  const inverse = new Set(['Δ Clim','Δ Dis']);
  const confColor = { HIGH:'#a366ff', MEDIUM:'#c299ff', LOW:'#ff4db8', LOCAL:'#8a4fff' };
  let html = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">`;
  for (const [lbl, val] of Object.entries(data.predictions || {})) {
    const good = inverse.has(lbl) ? val <= 0 : val >= 0;
    const color = good ? '#a366ff' : '#ff4db8';
    const sign = val > 0 ? '+' : '';
    html += `<div style="flex:1;min-width:75px;background:var(--bg-card);border:1px solid var(--border);border-radius:2px;padding:7px 8px;text-align:center">
      <div style="font-size:1.1rem">${icons[lbl]||'→'}</div>
      <div style="font-size:.6rem;color:var(--txt-dim);margin:2px 0">${lbl.replace('Δ ','')}</div>
      <div style="font-family:var(--font-vt);font-size:1.1rem;color:${color}">${sign}${typeof val==='number'?val.toFixed(1):val}</div>
    </div>`;
  }
  html += `</div><div style="font-size:.65rem;color:var(--txt-dim)">Confidence: <span style="color:${confColor[data.confidence]||'#aaa'};font-family:var(--font-vt)">${data.confidence}</span></div>`;
  container.innerHTML = html;
}

function pickAdvisorTip(s) {
  const risk = collapseRisk(s);
  if (risk > 70) return `Collapse risk ${risk}%. Multi-system intervention needed.`;
  if (s.disease_rate > 50) return 'High disease rate compounding. Healthcare critical.';
  if (s.climate > 60)      return 'Climate tipping point near. Ecological damage irreversible.';
  if (s.legitimacy < 40)   return 'Legitimacy collapse approaching. Revolution risk.';
  if (s.food < s.population * 0.15) return 'Food critical. Starvation affecting birth rates.';
  const strategy = detectPlayerStrategy(s.policyHistory);
  if (strategy === 'industrial') return 'Industrial overuse detected. Climate crises will increase.';
  if (strategy === 'military')   return 'Military focus noted. Economy and legitimacy need attention.';
  return 'Situation stable. Tech investment recommended for late-game advantages.';
}

// ==================================================
// TECH TAB
// ==================================================
function renderTechTree(s) {
  const container = document.getElementById('tech-tree-panel');
  if (!container) return;
  container.innerHTML = '';
  for (const [pathKey, path] of Object.entries(TECH_TREE)) {
    const level = s.techProgress[pathKey] ?? 0;
    const div = document.createElement('div');
    div.className = 'tech-path';
    div.innerHTML = `<div class="tech-path-name" style="color:var(--txt-dim)">${path.icon} ${path.name}</div>`;
    const levelsEl = document.createElement('div');
    levelsEl.className = 'tech-levels';
    path.levels.forEach((lvl, idx) => {
      const el = document.createElement('div');
      const done = idx < level; const avail = idx === level;
      el.className = `tech-level ${done?'researched':avail?'unlocked':'locked'}`;
      el.style.color = avail ? 'var(--green)' : 'var(--txt-dim)';
      el.title = `${lvl.name} — ${lvl.desc} (Cost: ${lvl.cost} Economy)`;
      el.textContent = lvl.name.split(' ').slice(0,2).join(' ');
      if (avail && s.economy >= lvl.cost) {
        el.style.borderColor = 'var(--border-hi)';
        el.addEventListener('click', () => showTechModal(pathKey, idx, path, lvl, s));
      }
      levelsEl.appendChild(el);
    });
    div.appendChild(levelsEl);
    container.appendChild(div);
  }
}

function showTechModal(pathKey, idx, path, lvl, s) {
  const efx = Object.entries(lvl.effects).map(([k,v])=>`${v>0?'+':''}${v} ${k}`).join(' · ');
  document.getElementById('tech-modal-title').textContent = `${path.icon} Research: ${lvl.name}`;
  document.getElementById('tech-modal-body').innerHTML =
    `${lvl.desc}<br><br><b>Effects:</b> ${efx}<br><b>Cost:</b> ${lvl.cost} Economy`;
  document.getElementById('tech-modal').style.display = 'flex';
  document.getElementById('tech-confirm-btn').onclick = () => {
    G.state = applyTechLevel(G.state, pathKey, idx);
    addTimeline(G.state.year, `RESEARCH: ${lvl.name} (${path.name}).`);
    document.getElementById('tech-modal').style.display = 'none';
    renderTechTree(G.state);
  };
  document.getElementById('tech-cancel-btn').onclick = () => {
    document.getElementById('tech-modal').style.display = 'none';
  };
}

// ==================================================
// TIMELINE
// ==================================================
function addTimeline(year, text) {
  G.history.push({ year, text });
  const tl = document.getElementById('timeline-panel');
  if (!tl) return;
  tl.innerHTML = G.history.slice().reverse().slice(0, 40).map(e =>
    `<div class="tl-entry">
      <span class="tl-year">${e.year}</span>
      <div class="tl-dot"></div>
      <span class="tl-text">${e.text}</span>
    </div>`).join('');
}

// ==================================================
// WORLD TAB
// ==================================================
function renderWorldStage() {
  if (!G.competingCivs) return;
  const panel = document.getElementById('world-stage-panel');
  if (!panel) return;
  panel.innerHTML = G.competingCivs.map(civ => {
    const s = civ.state;
    const risk = Math.min(100, Math.round(
      (s.climate > 60 ? 20 : 0) + (s.legitimacy < 30 ? 25 : 0) +
      (s.disease_rate > 60 ? 15 : 0) + (s.economy < 10 ? 20 : 0)
    ));
    const rColor = risk>50?'#ff2244':risk>25?'#ffb400':'#39ff14';
    return `<div class="civ-card">
      <div class="civ-card-hdr">
        <span class="civ-name" style="color:${civ.color}">${civ.icon} ${civ.name}</span>
        <span class="civ-risk" style="color:${rColor}">Risk ${risk}%</span>
      </div>
      <div class="civ-stats">
        <div class="civ-stat"><div class="civ-stat-lbl">Population</div><div class="civ-stat-val">${s.population>=1e6?(s.population/1e6).toFixed(1)+'M':(s.population/1e3).toFixed(0)+'K'}</div></div>
        <div class="civ-stat"><div class="civ-stat-lbl">Tech</div><div class="civ-stat-val">Lv ${s.technology.toFixed(0)}</div></div>
        <div class="civ-stat"><div class="civ-stat-lbl">Military</div><div class="civ-stat-val" style="color:${s.military>60?'#ff2244':'var(--txt)'}">${s.military.toFixed(0)}</div></div>
      </div>
    </div>`;
  }).join('');
}

function renderStrategyProfile(s) {
  const strategy = detectPlayerStrategy(s.policyHistory);
  G.playerStrategy = strategy;
  const strat = STRATEGY_TYPES[strategy] || STRATEGY_TYPES.balanced;
  const embed = buildPlayerEmbedding(s.policyHistory);
  const emotion = G.emotionTracker?.inferState();
  const sp = document.getElementById('strategy-panel');
  if (!sp) return;
  const bars = [
    { label:'Economy',  val:embed.economy*100,  color:'#ff6600' },
    { label:'Ecology',  val:embed.ecology*100,  color:'#39ff14' },
    { label:'Science',  val:embed.tech*100,     color:'#00ffee' },
    { label:'Military', val:embed.military*100, color:'#ff2244' },
    { label:'Welfare',  val:embed.welfare*100,  color:'#cc44ff' },
  ];
  sp.innerHTML = `
    <div class="strat-title" style="color:${strat.color}">${strat.label}</div>
    <div class="strat-adapt">${strat.worldAdapt}</div>
    ${bars.map(b=>`<div class="embed-row">
      <div class="embed-lbl-row"><span>${b.label}</span><span>${b.val.toFixed(0)}%</span></div>
      <div class="embed-track"><div class="embed-fill" style="width:${b.val.toFixed(0)}%;background:${b.color}"></div></div>
    </div>`).join('')}
    ${emotion && emotion.state!=='neutral'?`<div class="emotion-box">Player mode: <b style="color:${emotion.state==='frustrated'?'#ff6600':'#39ff14'}">${emotion.state}</b>${emotion.tip?`<br>${emotion.tip}`:''}</div>`:''}`;
}

// ==================================================
// CHART
// ==================================================
function initChart() {
  const ctx = document.getElementById('history-chart').getContext('2d');
  G.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label:'Pop/10K',    data:[], borderColor:'#00ffee', backgroundColor:'rgba(0,255,238,.04)', tension:.4, pointRadius:2 },
        { label:'Legitimacy', data:[], borderColor:'#39ff14', backgroundColor:'transparent', tension:.4, pointRadius:2, borderDash:[4,2] },
        { label:'Climate×2',  data:[], borderColor:'#ff6600', backgroundColor:'transparent', tension:.4, pointRadius:2, borderDash:[2,4] },
        { label:'Disease',    data:[], borderColor:'#ff2244', backgroundColor:'transparent', tension:.4, pointRadius:2 },
        { label:'Happiness',  data:[], borderColor:'#ffb400', backgroundColor:'transparent', tension:.4, pointRadius:2, borderDash:[6,2] },
      ],
    },
    options: {
      animation:{ duration:300 },
      plugins:{ legend:{ labels:{ color:'#4a5540', font:{ family:'Share Tech Mono', size:10 } } } },
      scales:{
        x:{ ticks:{ color:'#4a5540', maxTicksLimit:10, font:{family:'Share Tech Mono',size:9} }, grid:{ color:'#151928' } },
        y:{ ticks:{ color:'#4a5540', font:{family:'Share Tech Mono',size:9} }, grid:{ color:'#151928' }, beginAtZero:true },
      },
      responsive:true, maintainAspectRatio:false,
    },
  });
}

function updateChart(s) {
  if (!G.chart) return;
  const h = s.history;
  G.chart.data.labels = h.year.map(String);
  G.chart.data.datasets[0].data = h.population.map(v => v/10000);
  G.chart.data.datasets[1].data = h.legitimacy;
  G.chart.data.datasets[2].data = h.climate.map(v => v*2);
  G.chart.data.datasets[3].data = h.disease_rate;
  G.chart.data.datasets[4].data = h.happiness;
  G.chart.update('none');
}

// ==================================================
// MODALS (Dilemma / Crisis)
// ==================================================
function showModal(card, type, year) {
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-overlay');
    const mc = document.getElementById('modal-card');
    mc.className = `modal-card${type === 'CRISIS' ? ' crisis' : ''}`;
    document.getElementById('modal-year').textContent  = `// YEAR ${year} — ${type} OVERRIDE`;
    document.getElementById('modal-title').textContent = card.title;
    document.getElementById('modal-body').textContent  = card.body;
    const choicesEl = document.getElementById('modal-choices');
    choicesEl.innerHTML = '';
    (card.choices || []).forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      const allEfx = { ...(choice.effects||{}), ...(choice.cost||{}) };
      const tags = Object.entries(allEfx).map(([k,v]) => {
        const isInverse = ['climate','disease_rate','pollution'].includes(k);
        const isGood = isInverse ? v < 0 : v > 0;
        return `<span class="cost-tag ${isGood?'cost-pos':'cost-neg'}">${v>0?'+':''}${typeof v==='number'?v.toFixed(0):v} ${k.replace('_rate','')}</span>`;
      }).join('');
      btn.innerHTML = `<div class="choice-label">[${String.fromCharCode(65+i)}] ${choice.label}</div>
        <div class="choice-detail">${choice.detail || ''}</div>
        <div class="choice-costs">${tags}</div>`;
      btn.addEventListener('click', () => {
        G.state = applyChoice(G.state, choice, G.state.year - 1);
        addTimeline(G.state.year - 1, `CHOSE: "${choice.label}"`);
        overlay.style.display = 'none';
        renderSidebar(G.state); renderMetrics(G.state);
        resolve();
      });
      choicesEl.appendChild(btn);
    });
    overlay.style.display = 'flex';
  });
}

// ==================================================
// ENDING
// ==================================================
function showEnding(ending) {
  const screen = document.getElementById('ending-screen');
  screen.style.background = ending.color;
  document.getElementById('ending-content').innerHTML = `
    <div class="ending-grade" style="color:${ending.accent}">${ending.grade}</div>
    <div class="ending-title" style="color:${ending.accent}">${ending.title}</div>
    <div class="ending-subtitle">${ending.subtitle}</div>
    <div class="ending-year">YEAR ${G.state.year} — ${AXIOMS[G.state.axiom]?.name || ''}</div>
    <div class="ending-desc">${ending.desc}</div>
    <div class="ending-stats" style="color:${ending.accent}">
      SCORE: ${calcScore(G.state)}/100 · STRATEGY: ${STRATEGY_TYPES[G.playerStrategy]?.label || 'Balanced'}<br>
      POP: ${(G.state.population/1e6).toFixed(2)}M · TECH: Lv ${G.state.technology.toFixed(0)}
    </div>
    <button class="btn-primary" onclick="location.reload()">⟳ NEW CIVILIZATION</button>`;
  screen.classList.add('active');
}

// ==================================================
// SCORE
// ==================================================
function calcScore(s) {
  const pop    = Math.min(100, s.population / 100000);
  const env    = Math.max(0, 100 - s.climate);
  const health = Math.max(0, 100 - s.disease_rate);
  const social = (s.happiness + s.legitimacy) / 2;
  const tech   = Math.min(100, s.technology / 3);
  return Math.round((pop + env + health + social + tech) / 5);
}
