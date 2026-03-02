// ===================== STATE =====================
let currentGame = null;
let questions = [];
let currentQ = 0;
let score = 0;
let answered = false;
let bestScores = JSON.parse(localStorage.getItem('measurementMaster') || '{}');

const QUESTIONS_PER_ROUND = 5;

const encouragements = [
  '🎉 Awesome!', '🌟 You rock!', '💪 Nailed it!', '🔥 On fire!',
  '🚀 Superstar!', '✨ Brilliant!', '👏 Amazing!', '🏆 Champion!'
];
const tryAgains = [
  '🤔 Almost!', '💭 Not quite!', '🔄 Try again next time!',
  '📚 Keep learning!', '💪 You got this!'
];

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  updateHomeStars();
});

function createParticles() {
  const container = document.getElementById('particles');
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F', '#e94560'];
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 8 + 4;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (Math.random() * 15 + 10) + 's';
    p.style.animationDelay = (Math.random() * 10) + 's';
    container.appendChild(p);
  }
}

function updateHomeStars() {
  const games = ['numberline', 'tools', 'ruler', 'convert'];
  let total = 0;
  games.forEach(g => {
    const best = bestScores[g] || 0;
    total += best;
    const el = document.getElementById('stars-' + g);
    if (el) el.textContent = '⭐'.repeat(best) + '☆'.repeat(Math.max(0, QUESTIONS_PER_ROUND - best));
  });
  document.getElementById('total-stars').textContent = total;
}

// ===================== NAVIGATION =====================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function goHome() {
  showScreen('home-screen');
  updateHomeStars();
}

// ===================== START GAME =====================
function startGame(type) {
  currentGame = type;
  currentQ = 0;
  score = 0;
  answered = false;
  questions = generateQuestions(type);
  document.getElementById('current-score').textContent = '0';

  const labels = {
    numberline: 'Number Lines',
    tools: 'Right Tool',
    ruler: 'Read the Ruler',
    convert: 'Unit Converter'
  };
  document.getElementById('game-label').textContent = labels[type];
  showScreen('game-screen');
  renderQuestion();
}

function retryGame() {
  startGame(currentGame);
}

// ===================== QUESTION GENERATORS =====================
function generateQuestions(type) {
  switch (type) {
    case 'numberline': return generateNumberLineQuestions();
    case 'tools': return generateToolQuestions();
    case 'ruler': return generateRulerQuestions();
    case 'convert': return generateConvertQuestions();
  }
}

// ---- NUMBER LINE QUESTIONS ----
function generateNumberLineQuestions() {
  const templates = [
    {
      topUnit: 'feet', bottomUnit: 'inches', factor: 12,
      topValues: [0,1,2,3,4,5,6,7,8,9,10],
      blanksTop: [4,6,7,8],
      blanksBottom: [2,3,5,7,9]
    },
    {
      topUnit: 'meters', bottomUnit: 'centimeters', factor: 100,
      topValues: [0,1,2,3,4,5,6,7,8,9,10],
      blanksTop: [4,5,7],
      blanksBottom: [1,3,6,8,9]
    },
    {
      topUnit: 'minutes', bottomUnit: 'seconds', factor: 60,
      topValues: [0,1,2,3,4,5,6,7,8,9],
      blanksTop: [4,6,7],
      blanksBottom: [1,2,4,5,6]
    },
    {
      topUnit: 'gallons', bottomUnit: 'quarts', factor: 4,
      topValues: [0,1,2,3,4,5,6,7,8,9,10],
      blanksTop: [3,4,7,8],
      blanksBottom: [1,2,5,6,9]
    },
    {
      topUnit: 'yards', bottomUnit: 'feet', factor: 3,
      topValues: [0,1,2,3,4,5,6,7,8,9,10],
      blanksTop: [3,5,7,8],
      blanksBottom: [2,4,6,7,9]
    },
    {
      topUnit: 'hours', bottomUnit: 'minutes', factor: 60,
      topValues: [0,1,2,3,4,5],
      blanksTop: [2,4],
      blanksBottom: [1,3]
    },
    {
      topUnit: 'feet', bottomUnit: 'inches', factor: 12,
      topValues: [0,1,2,3,4,5],
      blanksTop: [2,4],
      blanksBottom: [1,3,5]
    },
    {
      topUnit: 'meters', bottomUnit: 'centimeters', factor: 100,
      topValues: [0,1,2,3,4,5],
      blanksTop: [2,3],
      blanksBottom: [1,4]
    }
  ];

  return shuffle(templates).slice(0, QUESTIONS_PER_ROUND).map(t => {
    const slots = [];
    const numSlots = Math.min(t.topValues.length, 8);
    const step = Math.max(1, Math.floor(t.topValues.length / numSlots));
    const selectedIndices = [];
    for (let i = 0; i < t.topValues.length && selectedIndices.length < numSlots; i += step) {
      selectedIndices.push(i);
    }

    const blanksTopSet = new Set(t.blanksTop.filter(i => selectedIndices.includes(i)));
    const blanksBottomSet = new Set(t.blanksBottom.filter(i => selectedIndices.includes(i)));

    if (blanksTopSet.size === 0) blanksTopSet.add(selectedIndices[Math.floor(selectedIndices.length / 2)]);
    if (blanksBottomSet.size === 0) blanksBottomSet.add(selectedIndices[Math.floor(selectedIndices.length / 3)]);

    selectedIndices.forEach(idx => {
      const topVal = t.topValues[idx];
      const bottomVal = topVal * t.factor;
      slots.push({
        topVal,
        bottomVal,
        topBlank: blanksTopSet.has(idx) && idx !== 0,
        bottomBlank: blanksBottomSet.has(idx) && idx !== 0
      });
    });

    return {
      type: 'numberline',
      topUnit: t.topUnit,
      bottomUnit: t.bottomUnit,
      slots
    };
  });
}

// ---- TOOL QUESTIONS ----
function generateToolQuestions() {
  const scenarios = shuffle([
    { text: 'Cora needs 8 ounces of water for her experiment. Which tool can she use?', answer: 'measuring_cup', explanation: 'A measuring cup measures liquid volume in ounces.' },
    { text: 'The pet food factory fills small bags of dry dog food. Each bag holds 250 grams. Which tool can be used to measure the dog food?', answer: 'scale', explanation: 'A scale measures mass in grams.' },
    { text: 'Rosie wants to find the length of her bedroom. Which tool should she use?', answer: 'tape_measure', explanation: 'A tape measure is best for measuring long distances.' },
    { text: 'Phillipa needs to measure how much water is in a beaker. Which tool should she read?', answer: 'beaker', explanation: 'A beaker has markings to show liquid volume.' },
    { text: 'Simon must take his temperature before going to the doctor. Which tool should he use?', answer: 'thermometer', explanation: 'A thermometer measures temperature.' },
    { text: 'A baker needs 500 grams of cocoa for a recipe. Which tool should she use?', answer: 'scale', explanation: 'A scale measures mass in grams and kilograms.' },
    { text: 'Gia wants to measure the distance she walks to school. Which tool would work best?', answer: 'tape_measure', explanation: 'A long tape measure or measuring wheel measures distance.' },
    { text: 'Anamaria wants to measure the mass of her pencil. Which tool should she use?', answer: 'scale', explanation: 'A balance scale can measure the mass of small objects.' },
    { text: 'A nurse needs to give a patient exactly 5 milliliters of medicine. Which tool should she use?', answer: 'dropper', explanation: 'A dropper or syringe precisely measures small amounts of liquid.' },
    { text: 'Carlos wants to check if the pool water is warm enough. Which tool should he use?', answer: 'thermometer', explanation: 'A thermometer measures the temperature of liquids.' },
    { text: 'Emma wants to measure how tall she is. Which tool should she use?', answer: 'tape_measure', explanation: 'A tape measure or ruler measures height.' },
    { text: 'A chef needs to measure 2 cups of milk for pancakes. Which tool should she use?', answer: 'measuring_cup', explanation: 'A measuring cup measures liquid volume in cups.' }
  ]);

  const tools = [
    { id: 'scale', emoji: '⚖️', name: 'Scale' },
    { id: 'measuring_cup', emoji: '🥛', name: 'Measuring Cup' },
    { id: 'tape_measure', emoji: '📏', name: 'Tape Measure / Ruler' },
    { id: 'thermometer', emoji: '🌡️', name: 'Thermometer' },
    { id: 'beaker', emoji: '🧪', name: 'Beaker' },
    { id: 'dropper', emoji: '💧', name: 'Dropper / Syringe' }
  ];

  return scenarios.slice(0, QUESTIONS_PER_ROUND).map(s => {
    let options = tools.filter(t => t.id === s.answer);
    let others = shuffle(tools.filter(t => t.id !== s.answer)).slice(0, 3);
    options = shuffle([...options, ...others]);
    return { type: 'tools', ...s, options };
  });
}

// ---- RULER QUESTIONS ----
function generateRulerQuestions() {
  const measurements = shuffle([
    { inches: 2.125, display: '2⅛', wholeInches: 2, eighths: 1 },
    { inches: 2.375, display: '2⅜', wholeInches: 2, eighths: 3 },
    { inches: 2.625, display: '2⅝', wholeInches: 2, eighths: 5 },
    { inches: 2.75, display: '2¾', wholeInches: 2, eighths: 6 },
    { inches: 1.5, display: '1½', wholeInches: 1, eighths: 4 },
    { inches: 3.25, display: '3¼', wholeInches: 3, eighths: 2 },
    { inches: 1.875, display: '1⅞', wholeInches: 1, eighths: 7 },
    { inches: 3.75, display: '3¾', wholeInches: 3, eighths: 6 },
    { inches: 1.25, display: '1¼', wholeInches: 1, eighths: 2 },
    { inches: 2.5, display: '2½', wholeInches: 2, eighths: 4 },
    { inches: 3.5, display: '3½', wholeInches: 3, eighths: 4 },
    { inches: 3.125, display: '3⅛', wholeInches: 3, eighths: 1 }
  ]);

  return measurements.slice(0, QUESTIONS_PER_ROUND).map(m => {
    const wrongOptions = [];
    const nearby = [m.inches - 0.25, m.inches + 0.125, m.inches - 0.125, m.inches + 0.25]
      .filter(v => v > 0 && v !== m.inches);
    while (wrongOptions.length < 3 && nearby.length > 0) {
      wrongOptions.push(nearby.shift());
    }
    const allOptions = shuffle([m.inches, ...wrongOptions.slice(0, 3)]);
    const displayOptions = allOptions.map(v => ({ value: v, display: inchesToFraction(v) }));

    return {
      type: 'ruler',
      inches: m.inches,
      display: m.display,
      options: displayOptions,
      maxInches: Math.ceil(m.inches) + 1
    };
  });
}

function inchesToFraction(val) {
  const whole = Math.floor(val);
  const frac = val - whole;
  if (frac === 0) return '' + whole;
  const eighths = Math.round(frac * 8);
  if (eighths === 0) return '' + whole;
  if (eighths === 8) return '' + (whole + 1);
  if (eighths === 4) return whole ? whole + '½' : '½';
  if (eighths === 2) return whole ? whole + '¼' : '¼';
  if (eighths === 6) return whole ? whole + '¾' : '¾';
  return whole ? whole + ' ' + eighths + '/8' : eighths + '/8';
}

// ---- CONVERSION QUESTIONS ----
function generateConvertQuestions() {
  const conversions = [
    { fromUnit: 'feet', toUnit: 'inches', factor: 12, values: [1,2,3,4,5,6,7,8,9,10] },
    { fromUnit: 'inches', toUnit: 'feet', factor: 1/12, values: [12,24,36,48,60,72,84,96,108,120] },
    { fromUnit: 'meters', toUnit: 'centimeters', factor: 100, values: [1,2,3,4,5,6,7,8,9,10] },
    { fromUnit: 'centimeters', toUnit: 'meters', factor: 1/100, values: [100,200,300,400,500,600,700,800] },
    { fromUnit: 'minutes', toUnit: 'seconds', factor: 60, values: [1,2,3,4,5,6,7,8,9,10] },
    { fromUnit: 'seconds', toUnit: 'minutes', factor: 1/60, values: [60,120,180,240,300,360,420,480] },
    { fromUnit: 'gallons', toUnit: 'quarts', factor: 4, values: [1,2,3,4,5,6,7,8,9,10] },
    { fromUnit: 'quarts', toUnit: 'gallons', factor: 1/4, values: [4,8,12,16,20,24,28,32,36,40] },
    { fromUnit: 'yards', toUnit: 'feet', factor: 3, values: [1,2,3,4,5,6,7,8,9,10] },
    { fromUnit: 'feet', toUnit: 'yards', factor: 1/3, values: [3,6,9,12,15,18,21,24,27,30] }
  ];

  return shuffle(conversions).slice(0, QUESTIONS_PER_ROUND).map(c => {
    const fromVal = c.values[Math.floor(Math.random() * c.values.length)];
    const toVal = Math.round(fromVal * c.factor * 100) / 100;
    return {
      type: 'convert',
      fromUnit: c.fromUnit,
      toUnit: c.toUnit,
      fromVal,
      toVal
    };
  });
}

// ===================== RENDER =====================
function renderQuestion() {
  answered = false;
  document.getElementById('check-btn').classList.remove('hidden');
  document.getElementById('next-btn').classList.add('hidden');
  document.getElementById('game-progress').textContent = `${currentQ + 1} / ${QUESTIONS_PER_ROUND}`;

  const q = questions[currentQ];
  const body = document.getElementById('game-body');

  switch (q.type) {
    case 'numberline': renderNumberLine(body, q); break;
    case 'tools': renderTools(body, q); break;
    case 'ruler': renderRuler(body, q); break;
    case 'convert': renderConvert(body, q); break;
  }
}

// ---- RENDER NUMBER LINE ----
function renderNumberLine(body, q) {
  const slots = q.slots;
  let slotsHTML = '';

  slots.forEach((s, i) => {
    const topContent = s.topBlank
      ? `<input class="nl-input" data-answer="${s.topVal}" data-pos="top-${i}" type="number" inputmode="numeric" placeholder="?">`
      : `<span class="nl-top-label">${s.topVal}</span>`;
    const bottomContent = s.bottomBlank
      ? `<input class="nl-input" data-answer="${s.bottomVal}" data-pos="bottom-${i}" type="number" inputmode="numeric" placeholder="?">`
      : `<span class="nl-bottom-label">${s.bottomVal}</span>`;

    slotsHTML += `
      <div class="nl-slot">
        ${topContent}
        <div class="nl-tick"></div>
        ${bottomContent}
      </div>`;
  });

  body.innerHTML = `
    <div class="question-card">
      <div class="question-text">Fill in the missing values on the number line!</div>
      <div class="question-hint">${q.topUnit} (top) → ${q.bottomUnit} (bottom)</div>
      <div class="numberline-container">
        <div class="numberline-labels">
          <span>${q.topUnit}</span>
        </div>
        <div class="numberline-inputs" id="nl-inputs">
          ${slotsHTML}
        </div>
        <div class="numberline-labels" style="margin-top:4px">
          <span>${q.bottomUnit}</span>
        </div>
      </div>
    </div>`;
}

// ---- RENDER TOOLS ----
function renderTools(body, q) {
  const optionsHTML = q.options.map(o => `
    <div class="tool-option" data-tool="${o.id}" onclick="selectTool(this)">
      <div class="tool-emoji">${o.emoji}</div>
      <div class="tool-name">${o.name}</div>
    </div>
  `).join('');

  body.innerHTML = `
    <div class="question-card">
      <div class="question-text">${q.text}</div>
      <div class="tools-grid">${optionsHTML}</div>
    </div>`;
}

function selectTool(el) {
  if (answered) return;
  document.querySelectorAll('.tool-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

// ---- RENDER RULER ----
function renderRuler(body, q) {
  const maxInch = q.maxInches;
  const svgWidth = 480;
  const pad = 20;
  const usable = svgWidth - pad * 2;
  const pxPerInch = usable / maxInch;
  const lineEndX = pad + q.inches * pxPerInch;

  let ticks = '';
  for (let i = 0; i <= maxInch; i++) {
    const x = pad + i * pxPerInch;
    ticks += `<line x1="${x}" y1="50" x2="${x}" y2="72" stroke="#a0a0c0" stroke-width="2"/>`;
    ticks += `<text x="${x}" y="90" fill="#a0a0c0" font-size="14" font-family="Fredoka" text-anchor="middle">${i}</text>`;

    if (i < maxInch) {
      for (let e = 1; e < 8; e++) {
        const tx = pad + (i + e / 8) * pxPerInch;
        const h = e === 4 ? 16 : (e % 2 === 0 ? 12 : 8);
        ticks += `<line x1="${tx}" y1="50" x2="${tx}" y2="${50 + h}" stroke="#a0a0c0" stroke-width="1"/>`;
      }
    }
  }

  const rulerBg = `<rect x="${pad}" y="30" width="${usable}" height="22" rx="3" fill="rgba(69,183,209,0.15)" stroke="rgba(69,183,209,0.3)" stroke-width="1"/>`;
  const segment = `<line x1="${pad}" y1="20" x2="${lineEndX}" y2="20" stroke="#FF6B6B" stroke-width="6" stroke-linecap="round"/>`;
  const startDot = `<circle cx="${pad}" cy="20" r="4" fill="#FF6B6B"/>`;
  const endDot = `<circle cx="${lineEndX}" cy="20" r="4" fill="#FF6B6B"/>`;

  const optionsHTML = q.options.map(o => `
    <div class="mc-option" data-value="${o.value}" onclick="selectMC(this)">
      ${o.display} inches
    </div>
  `).join('');

  body.innerHTML = `
    <div class="question-card">
      <div class="question-text">How long is the red line segment?</div>
      <div class="ruler-container">
        <svg class="ruler-svg" viewBox="0 0 ${svgWidth} 100">
          ${rulerBg}
          ${ticks}
          ${segment}
          ${startDot}
          ${endDot}
        </svg>
      </div>
      <div class="mc-options">${optionsHTML}</div>
    </div>`;
}

function selectMC(el) {
  if (answered) return;
  document.querySelectorAll('.mc-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

// ---- RENDER CONVERT ----
function renderConvert(body, q) {
  body.innerHTML = `
    <div class="question-card">
      <div class="question-text">Convert the measurement!</div>
      <div class="question-hint">How many ${q.toUnit} are in ${q.fromVal} ${q.fromUnit}?</div>
      <div class="convert-visual">
        <div class="convert-box">
          <div class="convert-value">${q.fromVal}</div>
          <div class="convert-unit">${q.fromUnit}</div>
        </div>
        <div class="convert-arrow">→</div>
        <div class="convert-input-box">
          <input class="convert-input" id="convert-answer" type="number" inputmode="numeric" placeholder="?" data-answer="${q.toVal}">
          <div class="convert-unit">${q.toUnit}</div>
        </div>
      </div>
    </div>`;

  setTimeout(() => document.getElementById('convert-answer')?.focus(), 300);
}

// ===================== CHECK ANSWER =====================
function checkAnswer() {
  if (answered) return;
  answered = true;

  const q = questions[currentQ];
  let correct = false;

  switch (q.type) {
    case 'numberline': correct = checkNumberLine(q); break;
    case 'tools': correct = checkTools(q); break;
    case 'ruler': correct = checkRulerAnswer(q); break;
    case 'convert': correct = checkConvert(q); break;
  }

  if (correct) {
    score++;
    document.getElementById('current-score').textContent = score;
    showFeedback(true);
  } else {
    showFeedback(false);
  }

  document.getElementById('check-btn').classList.add('hidden');
  document.getElementById('next-btn').classList.remove('hidden');
}

function checkNumberLine(q) {
  const inputs = document.querySelectorAll('.nl-input');
  let allCorrect = true;

  inputs.forEach(inp => {
    const answer = parseFloat(inp.dataset.answer);
    const val = parseFloat(inp.value);
    if (val === answer) {
      inp.classList.add('correct');
    } else {
      inp.classList.add('wrong');
      inp.value = inp.value || '';
      allCorrect = false;
      setTimeout(() => {
        inp.value = answer;
        inp.classList.remove('wrong');
        inp.classList.add('correct');
      }, 1500);
    }
    inp.disabled = true;
  });

  return allCorrect;
}

function checkTools(q) {
  const selected = document.querySelector('.tool-option.selected');
  if (!selected) {
    answered = false;
    return false;
  }

  const selectedTool = selected.dataset.tool;
  const isCorrect = selectedTool === q.answer;

  document.querySelectorAll('.tool-option').forEach(o => {
    if (o.dataset.tool === q.answer) o.classList.add('correct-answer');
    else if (o === selected && !isCorrect) o.classList.add('wrong-answer');
    o.style.pointerEvents = 'none';
  });

  return isCorrect;
}

function checkRulerAnswer(q) {
  const selected = document.querySelector('.mc-option.selected');
  if (!selected) {
    answered = false;
    return false;
  }

  const selectedVal = parseFloat(selected.dataset.value);
  const isCorrect = Math.abs(selectedVal - q.inches) < 0.01;

  document.querySelectorAll('.mc-option').forEach(o => {
    const v = parseFloat(o.dataset.value);
    if (Math.abs(v - q.inches) < 0.01) o.classList.add('correct-answer');
    else if (o === selected && !isCorrect) o.classList.add('wrong-answer');
    o.style.pointerEvents = 'none';
  });

  return isCorrect;
}

function checkConvert(q) {
  const inp = document.getElementById('convert-answer');
  const val = parseFloat(inp.value);
  const isCorrect = Math.abs(val - q.toVal) < 0.01;

  if (isCorrect) {
    inp.classList.add('correct');
  } else {
    inp.classList.add('wrong');
    setTimeout(() => {
      inp.value = q.toVal;
      inp.classList.remove('wrong');
      inp.classList.add('correct');
    }, 1500);
  }
  inp.disabled = true;

  return isCorrect;
}

// ===================== NEXT / RESULTS =====================
function nextQuestion() {
  currentQ++;
  if (currentQ >= QUESTIONS_PER_ROUND) {
    showResults();
  } else {
    renderQuestion();
  }
}

function showResults() {
  const prev = bestScores[currentGame] || 0;
  if (score > prev) bestScores[currentGame] = score;
  localStorage.setItem('measurementMaster', JSON.stringify(bestScores));

  const pct = score / QUESTIONS_PER_ROUND;
  let emoji, title;
  if (pct === 1) { emoji = '🏆'; title = 'PERFECT! You\'re a Measurement Master!'; }
  else if (pct >= 0.8) { emoji = '🎉'; title = 'Awesome Job!'; }
  else if (pct >= 0.6) { emoji = '👍'; title = 'Nice Work!'; }
  else if (pct >= 0.4) { emoji = '💪'; title = 'Keep Practicing!'; }
  else { emoji = '📚'; title = 'Let\'s Try Again!'; }

  document.getElementById('results-emoji').textContent = emoji;
  document.getElementById('results-title').textContent = title;
  document.getElementById('results-score').textContent =
    `You got ${score} out of ${QUESTIONS_PER_ROUND} correct!`;
  document.getElementById('results-stars').textContent =
    '⭐'.repeat(score) + '☆'.repeat(QUESTIONS_PER_ROUND - score);

  showScreen('results-screen');

  if (pct >= 0.8) launchConfetti();
}

// ===================== FEEDBACK =====================
function showFeedback(correct) {
  const overlay = document.getElementById('feedback-overlay');
  const content = document.getElementById('feedback-content');

  if (correct) {
    content.textContent = encouragements[Math.floor(Math.random() * encouragements.length)];
    content.className = 'feedback-content feedback-correct';
    if (Math.random() > 0.5) launchMiniConfetti();
  } else {
    content.textContent = tryAgains[Math.floor(Math.random() * tryAgains.length)];
    content.className = 'feedback-content feedback-wrong';
  }

  overlay.classList.remove('hidden');
  content.style.animation = 'none';
  content.offsetHeight; // reflow
  content.style.animation = 'popIn 0.5s ease';

  setTimeout(() => overlay.classList.add('hidden'), 1200);
}

// ===================== CONFETTI =====================
function launchConfetti() {
  const colors = ['#FF6B6B','#4ECDC4','#45B7D1','#F7DC6F','#e94560','#2ecc71','#9b59b6','#f39c12'];
  for (let i = 0; i < 60; i++) {
    setTimeout(() => {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.top = '-10px';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.width = (Math.random() * 8 + 5) + 'px';
      piece.style.height = (Math.random() * 8 + 5) + 'px';
      piece.style.animationDuration = (Math.random() * 1.5 + 1.5) + 's';
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 3000);
    }, i * 30);
  }
}

function launchMiniConfetti() {
  const colors = ['#2ecc71', '#F7DC6F', '#4ECDC4'];
  for (let i = 0; i < 15; i++) {
    setTimeout(() => {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = (30 + Math.random() * 40) + 'vw';
      piece.style.top = '30vh';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.width = (Math.random() * 6 + 4) + 'px';
      piece.style.height = (Math.random() * 6 + 4) + 'px';
      piece.style.animationDuration = (Math.random() * 1 + 1) + 's';
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 2000);
    }, i * 20);
  }
}

// ===================== UTILITY =====================
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Keyboard shortcut: Enter to check/next
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (!document.getElementById('check-btn').classList.contains('hidden')) {
      checkAnswer();
    } else if (!document.getElementById('next-btn').classList.contains('hidden')) {
      nextQuestion();
    }
  }
});
