// ============================================================
// game.js — CIV-AI v3 Main Game Controller
// ============================================================

// ---- State ----
let G = {
  state: null,
  selectedPolicy: 'agriculture',
  selectedIdeology: null,
  history: [],          // array of events for timeline
  usedDilemmas: new Set(),
  usedCrises:   new Set(),
  chart: null,
  pendingTechResearch: null,
  mlCache: null,        // last ML prediction
  gameRunning: false,
  advanceDisabled: false,
};

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
  renderStartScreen();
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('advance-btn').addEventListener('click', advanceYear);
});

// ==================================================
// START SCREEN
// ==================================================
function renderStartScreen() {
  const grid = document.getElementById('ideology-grid');
  grid.innerHTML = '';
  for (const [key, ideo] of Object.entries(IDEOLOGIES)) {
    const card = document.createElement('div');
    card.className = 'ideology-card';
    card.style.setProperty('--accent-color', ideo.color);
    card.style.setProperty('--glow-color',   ideo.color + '33');
    card.innerHTML = `
      <div class="icon">${ideo.icon}</div>
      <div class="name" style="color:${ideo.color}">${ideo.name}</div>
      <div class="desc">${ideo.desc}</div>
    `;
    card.addEventListener('click', () => {
      document.querySelectorAll('.ideology-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      G.selectedIdeology = key;
      document.getElementById('ideology-desc-preview').innerHTML =
        `<span style="color:${ideo.color}">${ideo.icon} ${ideo.name}:</span> ${ideo.desc} <span style="opacity:.6">— Starting bonus applied.</span>`;
      document.getElementById('start-btn').disabled = false;
    });
    grid.appendChild(card);
  }
}

function startGame() {
  if (!G.selectedIdeology) return;
  let state = new WorldState();
  state = applyIdeology(state, G.selectedIdeology);
  G.state = state;
  G.history = [];
  G.usedDilemmas = new Set();
  G.usedCrises   = new Set();
  G.chart = null;
  G.gameRunning = true;

  document.getElementById('start-screen').classList.remove('active');
  document.getElementById('app').style.display = 'grid';

  renderAll();
  initChart();
  addTimeline(1, `Civilization founded as a ${IDEOLOGIES[G.selectedIdeology].name}.`);
}

// ==================================================
// MAIN RENDER
// ==================================================
function renderAll() {
  if (!G.state) return;
  const s = G.state;
  const ideo = IDEOLOGIES[s.ideology];

  // Header
  document.getElementById('hdr-year').textContent = `Year ${s.year}`;
  const hdrIdeo = document.getElementById('hdr-ideology');
  hdrIdeo.style.display = 'inline-block';
  hdrIdeo.textContent = `${ideo.icon} ${ideo.name}`;
  hdrIdeo.style.color = ideo.color;
  hdrIdeo.style.borderColor = ideo.color;
  document.getElementById('hdr-score').textContent = `Score: ${calcScore(s)}/100`;

  // Traits
  const traitEl = document.getElementById('hdr-traits');
  traitEl.innerHTML = s.traits.map(t => `<span class="trait-badge">${t}</span>`).join('');

  renderResourceBars(s);
  renderOpinionBars(s);
  renderPolicyButtons();
  renderMetrics(s);
  renderAlerts(s);
  renderTechTree(s);
  updateChart(s);
}

// ---- Resource Bars ----
function renderResourceBars(s) {
  document.getElementById('resource-bars').innerHTML = `
    ${resourceBar('🌾 Food',     s.food,     4000000, 'food')}
    ${resourceBar('⚡ Energy',   s.energy,   3000000, 'energy')}
    ${resourceBar('💧 Water',    s.water,    100,     'water')}
    ${resourceBar('💎 Minerals', s.minerals, 100,     'minerals')}
  `;
}

function resourceBar(label, val, max, cls) {
  const pct = Math.min(100, (val / max) * 100);
  const display = max === 100 ? `${val.toFixed(0)}` : val >= 1e6 ? (val/1e6).toFixed(1)+'M' : (val/1e3).toFixed(0)+'K';
  return `
    <div class="resource-bar">
      <div class="label"><span>${label}</span><span>${display}</span></div>
      <div class="bar-track"><div class="bar-fill bar-${cls}" style="width:${pct}%"></div></div>
    </div>`;
}

// ---- Opinion Bars ----
function renderOpinionBars(s) {
  document.getElementById('opinion-bars').innerHTML = `
    ${opBar('Trust',  s.trust,  'trust')}
    ${opBar('Fear',   s.fear,   'fear')}
    ${opBar('Anger',  s.anger,  'anger')}
    ${opBar('Hope',   s.hope,   'hope')}
  `;
}

function opBar(label, val, cls) {
  return `
    <div class="opinion-bar">
      <span class="o-label">${label}</span>
      <div class="o-track"><div class="o-fill bar-${cls}" style="width:${val.toFixed(0)}%"></div></div>
      <span class="o-val">${val.toFixed(0)}</span>
    </div>`;
}

// ---- Policy Buttons ----
function renderPolicyButtons() {
  const s = G.state;
  const ideo = IDEOLOGIES[s.ideology];
  const container = document.getElementById('policy-btns');
  container.innerHTML = '';
  for (const [key, p] of Object.entries(POLICIES)) {
    const locked = ideo.locksTags.some(t => key.includes(t.replace('industry','industry')));
    const btn = document.createElement('button');
    btn.className = `policy-btn${key === G.selectedPolicy ? ' active' : ''}${locked ? '' : ''}`;
    btn.innerHTML = `<span class="p-icon">${p.name.split(' ')[0]}</span>
      <span class="p-name">${p.name.split(' ').slice(1).join(' ')}</span>`;
    btn.title = p.desc;
    btn.addEventListener('click', () => {
      G.selectedPolicy = key;
      renderPolicyButtons();
    });
    container.appendChild(btn);
  }
}

// ---- Metrics Grid ----
const METRICS = [
  { key: 'population',  label: 'Population', icon: '👥', fmt: v => v >= 1e6 ? (v/1e6).toFixed(2)+'M' : (v/1e3).toFixed(0)+'K', inverse: false },
  { key: 'economy',     label: 'Economy',    icon: '💰', fmt: v => '$'+v.toFixed(1)+'T',     inverse: false },
  { key: 'technology',  label: 'Technology', icon: '🔬', fmt: v => 'Lv '+v.toFixed(0),       inverse: false },
  { key: 'happiness',   label: 'Happiness',  icon: '😊', fmt: v => v.toFixed(1)+'%',          inverse: false },
  { key: 'legitimacy',  label: 'Legitimacy', icon: '🏛', fmt: v => v.toFixed(1)+'%',          inverse: false },
  { key: 'pollution',   label: 'Pollution',  icon: '🌫', fmt: v => v.toFixed(1)+'/100',       inverse: true },
  { key: 'climate',     label: 'Climate',    icon: '🔥', fmt: v => v.toFixed(1)+'/100',       inverse: true },
  { key: 'disease_rate',label: 'Disease',    icon: '🦠', fmt: v => v.toFixed(1)+'/100',       inverse: true },
  { key: 'military',    label: 'Military',   icon: '🛡️', fmt: v => v.toFixed(1)+'/100',       inverse: false },
];

function renderMetrics(s) {
  const hist = s.history;
  const prevIdx = hist.population.length - 1;
  const container = document.getElementById('metrics-grid');
  container.innerHTML = '';
  for (const m of METRICS) {
    const val = s[m.key];
    let delta = null;
    if (prevIdx >= 0 && hist[m.key]) {
      const prev = hist[m.key][prevIdx];
      delta = val - prev;
    }
    const tile = document.createElement('div');
    tile.className = 'metric-tile';
    let deltaHtml = '';
    if (delta !== null && Math.abs(delta) > 0.01) {
      const isGood = m.inverse ? delta < 0 : delta > 0;
      const cls    = isGood ? (m.inverse ? 'delta-inv-down' : 'delta-up')
                             : (m.inverse ? 'delta-inv-up'  : 'delta-down');
      const sign   = delta > 0 ? '+' : '';
      const fmtD   = Math.abs(delta) >= 1000 ? (delta/1000).toFixed(1)+'K' : delta.toFixed(1);
      deltaHtml = `<span class="m-delta ${cls}">${sign}${fmtD}</span>`;
    }
    tile.innerHTML = `
      <div class="m-icon">${m.icon}</div>
      <div class="m-label">${m.label}</div>
      <div class="m-value">${m.fmt(val)}</div>
      ${deltaHtml}
    `;
    container.appendChild(tile);
  }
}

// ---- Alerts (Revolution / Collapse warning / Advisor) ----
function renderAlerts(s) {
  const sideAlerts = ['advisor-panel','anomaly-panel','revolution-panel','collapse-panel'];
  sideAlerts.forEach(id => {
    document.getElementById(id).style.display = 'none';
    document.getElementById(id).innerHTML = '';
  });

  if (s.legitimacy < 25 && s.anger > 70) {
    const rp = document.getElementById('revolution-panel');
    rp.style.display = 'block';
    rp.innerHTML = '<div class="revolution-alert">⚠️ REVOLUTION IMMINENT — Legitimacy critical. Anger levels extreme.</div>';
  }

  if (s.population < 100000 || s.food < 10000 || s.economy < 2) {
    const cp = document.getElementById('collapse-panel');
    cp.style.display = 'block';
    cp.innerHTML = '<div class="collapse-warning">🚨 Civilization systems failing. Critical thresholds breached.</div>';
  }

  // ML-derived advisor hint (cached from last prediction)
  if (G.mlCache?.advisor) {
    const ap = document.getElementById('advisor-panel');
    ap.style.display = 'block';
    ap.innerHTML = `<div class="advisor-box">🤖 <b>AI Advisor:</b> ${G.mlCache.advisor}</div>`;
  }

  if (G.mlCache?.anomaly) {
    const anp = document.getElementById('anomaly-panel');
    anp.style.display = 'block';
    anp.innerHTML = `<div class="anomaly-alert">⚠️ <b>Anomaly Detected</b> — Unusual civilisation state. High cascading failure risk.</div>`;
  }
}

// ---- Tech Tree ----
function renderTechTree(s) {
  const container = document.getElementById('tech-tree-panel');
  container.innerHTML = '';
  for (const [pathKey, path] of Object.entries(TECH_TREE)) {
    const currentLevel = s.techProgress[pathKey] ?? 0;
    const div = document.createElement('div');
    div.className = 'tech-path';
    div.innerHTML = `<div class="tech-path-name" style="color:${path.color}">${path.icon} ${path.name}</div>`;
    const levelsEl = document.createElement('div');
    levelsEl.className = 'tech-levels';
    path.levels.forEach((lvl, idx) => {
      const el = document.createElement('div');
      const done = idx < currentLevel;
      const avail = idx === currentLevel;
      el.className = `tech-level ${done ? 'researched' : avail ? 'unlocked' : 'locked'}`;
      el.style.color = path.color;
      el.title = `${lvl.name} — ${lvl.desc} (Cost: ${lvl.cost}💰)`;
      el.textContent = lvl.name.split(' ')[0];
      if (avail && s.economy >= lvl.cost) {
        el.addEventListener('click', () => showTechModal(pathKey, idx, path, lvl, s));
      }
      levelsEl.appendChild(el);
    });
    div.appendChild(levelsEl);
    container.appendChild(div);
  }
}

function showTechModal(pathKey, idx, path, lvl, s) {
  document.getElementById('tech-modal-title').textContent = `${path.icon} Research: ${lvl.name}`;
  const efx = Object.entries(lvl.effects).map(([k,v]) => `${v>0?'+':''}${v} ${k}`).join(' · ');
  document.getElementById('tech-modal-body').innerHTML =
    `${lvl.desc}<br><br><b>Effects:</b> ${efx}<br><b>Cost:</b> ${lvl.cost} Economy units`;
  G.pendingTechResearch = { pathKey, idx };
  document.getElementById('tech-modal').style.display = 'flex';
  document.getElementById('tech-confirm-btn').onclick = () => {
    G.state = applyTechLevel(G.state, pathKey, idx);
    addTimeline(G.state.year, `Researched ${lvl.name} (${path.name} path).`);
    document.getElementById('tech-modal').style.display = 'none';
    renderAll();
  };
  document.getElementById('tech-cancel-btn').onclick = () => {
    document.getElementById('tech-modal').style.display = 'none';
  };
}

// ---- Timeline ----
function addTimeline(year, text) {
  G.history.push({ year, text });
  const tl = document.getElementById('timeline-panel');
  tl.innerHTML = G.history.slice().reverse().slice(0, 30).map(e =>
    `<div class="timeline-entry">
      <span class="tl-year">${e.year}</span>
      <div class="tl-dot"></div>
      <span class="tl-text">${e.text}</span>
    </div>`
  ).join('');
}

// ---- Event Log ----
function addEventToLog(year, ev) {
  const logEl = document.getElementById('event-log');
  const box = document.createElement('div');
  box.className = `event-box ${ev.severity}`;
  box.innerHTML = `
    <div class="event-year">
      Year ${year}
      <span class="event-sev sev-${ev.severity}">${ev.severity}</span>
    </div>
    <div class="event-text">${ev.event}</div>
  `;
  logEl.insertBefore(box, logEl.firstChild);
  while (logEl.children.length > 4) logEl.removeChild(logEl.lastChild);
}

// ---- History Chart ----
function initChart() {
  const ctx = document.getElementById('history-chart').getContext('2d');
  G.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Population/10K',  data: [], borderColor: '#00e5ff', backgroundColor: 'rgba(0,229,255,.05)', tension: .4, pointRadius: 2 },
        { label: 'Legitimacy %',    data: [], borderColor: '#00e676', backgroundColor: 'transparent', tension: .4, pointRadius: 2, borderDash: [4,2] },
        { label: 'Climate ×2',      data: [], borderColor: '#ff6d00', backgroundColor: 'transparent', tension: .4, pointRadius: 2, borderDash: [2,4] },
        { label: 'Disease ×1',      data: [], borderColor: '#ff1744', backgroundColor: 'transparent', tension: .4, pointRadius: 2 },
        { label: 'Happiness %',     data: [], borderColor: '#ffb300', backgroundColor: 'transparent', tension: .4, pointRadius: 2, borderDash: [6,2] },
      ]
    },
    options: {
      animation: { duration: 400 },
      plugins: { legend: { labels: { color: '#aaaadd', font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: '#6666aa', maxTicksLimit: 12 }, grid: { color: '#1e1e40' } },
        y: { ticks: { color: '#6666aa' }, grid: { color: '#1e1e40' }, beginAtZero: true },
      },
      responsive: true,
      maintainAspectRatio: true,
    }
  });
}

function updateChart(s) {
  if (!G.chart) return;
  const h = s.history;
  G.chart.data.labels = h.year.map(String);
  G.chart.data.datasets[0].data = h.population.map(v => v / 10000);
  G.chart.data.datasets[1].data = h.legitimacy;
  G.chart.data.datasets[2].data = h.climate.map(v => v * 2);
  G.chart.data.datasets[3].data = h.disease_rate;
  G.chart.data.datasets[4].data = h.happiness;
  G.chart.update('none');
}

// ==================================================
// ADVANCE YEAR
// ==================================================
async function advanceYear() {
  if (G.advanceDisabled) return;
  G.advanceDisabled = true;
  document.getElementById('advance-btn').disabled = true;

  // Step simulation
  G.state = simulationStep(G.state, G.selectedPolicy);
  const s = G.state;

  // Delayed consequence notification
  if (s._lastDelayMsg) {
    addTimeline(s.year, `⏰ ${s._lastDelayMsg}`);
    delete s._lastDelayMsg;
  }

  // Generate event
  const ev = generateLocalEvent(s);
  G.state = applyEvent(G.state, ev.effects || {});
  addEventToLog(s.year, ev);
  addTimeline(s.year, ev.event.slice(0, 80) + '…');

  // Add to timeline occasionally
  if (s.year % 10 === 0) {
    const grade = calcScore(s);
    addTimeline(s.year, `Era report: Score ${grade}/100. Pop ${(s.population/1e6).toFixed(2)}M. Tech Lv${s.technology.toFixed(0)}.`);
  }

  // ML predictions (call API or use local fallback)
  await fetchMLPredictions(G.state);

  // Check for dilemma (every 5 years)
  if (shouldTriggerDilemma(s.year)) {
    const dilemma = pickDilemma(s, G.usedDilemmas);
    if (dilemma) {
      G.usedDilemmas.add(dilemma.id);
      await showModal(dilemma, 'DILEMMA', s.year);
    }
  }
  // Check for crisis (every 9 years with probability)
  else if (shouldTriggerCrisis(s.year, Math.random())) {
    const crisis = pickCrisis(s, G.usedCrises);
    if (crisis) {
      G.usedCrises.add(crisis.id);
      G.state = applyEvent(G.state, crisis.effects || {});
      await showModal(crisis, 'CRISIS', s.year);
    }
  }

  // Check for revolution
  if (isRevolution(G.state)) {
    G.state.legitimacy = Math.max(25, G.state.legitimacy * 0.5);
    G.state.economy   *= 0.65;
    G.state.military  *= 0.60;
    addTimeline(G.state.year, '🔥 REVOLUTION — Legitimacy collapsed. Government reformed by force.');
    addEventToLog(G.state.year, { severity: 'CATASTROPHIC', event: 'A revolution has toppled the government. The military has intervened.' });
  }

  // Check for endings
  const ending = checkEnding(G.state);
  if (ending) {
    showEnding(ending);
    return;
  }

  renderAll();
  G.advanceDisabled = false;
  document.getElementById('advance-btn').disabled = false;
}

// ==================================================
// ML PREDICTIONS
// ==================================================
async function fetchMLPredictions(s) {
  const mlPanel = document.getElementById('ml-panel');

  // Try API
  try {
    const API_URL = window.CIV_API_URL || 'http://localhost:8000';
    const payload = {
      state: {
        population: s.population, food: s.food, energy: s.energy, technology: s.technology,
        pollution: s.pollution, economy: s.economy, happiness: s.happiness, legitimacy: s.legitimacy,
        disease_rate: s.disease_rate, military: s.military, climate: s.climate,
      },
      policy: G.selectedPolicy,
    };
    const res  = await fetch(`${API_URL}/ml/predict`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload), signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    G.mlCache = data;
    renderMLPanel(mlPanel, data);
    return;
  } catch (e) { /* API unavailable — use local simulation delta */ }

  // Local fallback: compare one simulation step
  const next      = simulationStep(s.clone(), G.selectedPolicy);
  const fallback  = {
    predictions: {
      'Δ Population':  Math.round(next.population  - s.population),
      'Δ Economy':     +(next.economy    - s.economy).toFixed(2),
      'Δ Climate':     +(next.climate    - s.climate).toFixed(2),
      'Δ Disease':     +(next.disease_rate - s.disease_rate).toFixed(2),
      'Δ Legitimacy':  +(next.legitimacy - s.legitimacy).toFixed(2),
    },
    confidence: 'LOCAL',
    advisor: pickAdvisorTip(s),
    anomaly: s.disease_rate > 60 && s.climate > 50,
  };
  G.mlCache = fallback;
  renderMLPanel(mlPanel, fallback);
}

function renderMLPanel(container, data) {
  const icons = { 'Δ Population':'👥', 'Δ Economy':'💰', 'Δ Climate':'🔥', 'Δ Disease':'🦠', 'Δ Legitimacy':'🏛' };
  const inverse = new Set(['Δ Climate','Δ Disease']);
  let html = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">`;
  for (const [lbl, val] of Object.entries(data.predictions || {})) {
    const good = inverse.has(lbl) ? val <= 0 : val >= 0;
    const color = good ? '#00e676' : '#ff1744';
    const sign  = val > 0 ? '+' : '';
    html += `<div style="flex:1;min-width:80px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:8px 10px;text-align:center">
      <div style="font-size:1.1rem">${icons[lbl] || '→'}</div>
      <div style="font-size:.65rem;color:var(--txt-dim);margin:2px 0">${lbl.replace('Δ ','')}</div>
      <div style="font-family:var(--font-head);font-size:.88rem;color:${color};font-weight:700">${sign}${typeof val==='number'?val.toFixed(1):val}</div>
    </div>`;
  }
  html += `</div>`;
  const confColor = { HIGH:'#00e676', MEDIUM:'#ffb300', LOW:'#ff1744', LOCAL:'#7c4dff' };
  html += `<div style="font-size:.7rem;color:var(--txt-dim)">Confidence: <span style="color:${confColor[data.confidence]||'#aaa'};font-weight:700">${data.confidence}</span></div>`;
  container.innerHTML = html;
}

function pickAdvisorTip(s) {
  if (s.disease_rate > 50) return "High disease rate threatens population growth. Consider Healthcare policy.";
  if (s.climate > 60)      return "Climate damage accelerating. Environment policy urgently advised.";
  if (s.legitimacy < 40)   return "Legitimacy is dangerously low. Public unrest may trigger revolution.";
  if (s.food < s.population * 0.15) return "Food per capita is critical. Agriculture policy is required.";
  if (s.technology < 30)  return "Low technology leaves your civilization vulnerable long-term. Consider Education.";
  const policies = Object.keys(POLICIES);
  return `Current conditions suggest ${POLICIES[policies[Math.floor(Math.random()*policies.length)]].name} could improve outcomes.`;
}

// ==================================================
// MODALS (Dilemma / Crisis)
// ==================================================
function showModal(card, type, year) {
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-overlay');
    const mc      = document.getElementById('modal-card');
    mc.className  = `modal-card${type === 'CRISIS' ? ' crisis' : ''}`;

    document.getElementById('modal-year').textContent = `Year ${year} — ${type}`;
    document.getElementById('modal-title').textContent = card.title;
    document.getElementById('modal-body').textContent  = card.body;

    const choicesEl = document.getElementById('modal-choices');
    choicesEl.innerHTML = '';

    (card.choices || []).forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';

      // Build cost/effect tags
      const allEfx = { ...(choice.effects || {}), ...(choice.cost || {}) };
      const tags = Object.entries(allEfx).map(([k, v]) => {
        const isInverse = ['climate','disease_rate','pollution'].includes(k);
        const isGood = isInverse ? v < 0 : v > 0;
        const sign = v > 0 ? '+' : '';
        return `<span class="cost-tag ${isGood ? 'cost-pos' : 'cost-neg'}">${sign}${typeof v==='number'?v.toFixed(0):v} ${k.replace('_rate','')}</span>`;
      }).join('');

      btn.innerHTML = `
        <div class="choice-label">[${String.fromCharCode(65+i)}] ${choice.label}</div>
        <div class="choice-detail">${choice.detail || ''}</div>
        <div class="choice-costs">${tags}</div>
      `;

      btn.addEventListener('click', () => {
        G.state = applyChoice(G.state, choice, G.state.year - 1);
        addTimeline(G.state.year -1, `Chose: "${choice.label}" — ${choice.detail || ''}`);
        overlay.style.display = 'none';
        renderAll();
        resolve();
      });
      choicesEl.appendChild(btn);
    });

    overlay.style.display = 'flex';
  });
}

// ==================================================
// ENDING SCREEN
// ==================================================
function showEnding(ending) {
  const screen  = document.getElementById('ending-screen');
  const content = document.getElementById('ending-content');
  screen.style.background = ending.color;

  content.innerHTML = `
    <div class="ending-grade" style="color:${ending.accent}">${ending.grade}</div>
    <div class="ending-title"  style="color:${ending.accent}">${ending.title}</div>
    <div class="ending-subtitle">${ending.subtitle}</div>
    <div class="ending-year">Year ${G.state.year} — ${IDEOLOGIES[G.state.ideology]?.name || ''}</div>
    <div class="ending-desc">${ending.desc}</div>
    <div style="font-family:var(--font-head);font-size:.75rem;color:${ending.accent};margin-bottom:24px">
      Final Score: ${calcScore(G.state)}/100 · Population: ${(G.state.population/1e6).toFixed(2)}M
    </div>
    <button class="btn-primary" onclick="location.reload()">⟳ NEW CIVILIZATION</button>
  `;

  screen.classList.add('active');
}

// ==================================================
// HELPERS
// ==================================================
function calcScore(s) {
  const pop    = Math.min(100, s.population / 100000);
  const env    = Math.max(0, 100 - s.climate);
  const health = Math.max(0, 100 - s.disease_rate);
  const social = (s.happiness + s.legitimacy) / 2;
  const tech   = Math.min(100, s.technology / 3);
  return Math.round((pop + env + health + social + tech) / 5);
}
