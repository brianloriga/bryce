// ===================== STATE =====================
let currentSubject = 'math';
let currentGame = null;
let questions = [];
let currentQ = 0;
let score = 0;
let answered = false;

let bestScores = JSON.parse(localStorage.getItem('bryceLearning') || '{"math":{},"reading":{},"science":{}}');
if (!bestScores.math) bestScores.math = {};
if (!bestScores.reading) bestScores.reading = {};
if (!bestScores.science) bestScores.science = {};

let bossForceUnlocked = JSON.parse(localStorage.getItem('bossForceUnlocked') || '{"math":false,"reading":false,"science":false}');
if (typeof bossForceUnlocked !== 'object') bossForceUnlocked = { math: false, math157: false, reading: false, science: false };
if (bossForceUnlocked.science === undefined) bossForceUnlocked.science = false;
if (bossForceUnlocked.math157 === undefined) bossForceUnlocked.math157 = false;

const QUESTIONS_PER_ROUND = 5;
const PARENT_PASSCODE = '01131984';

const MATH_GAMES_15_1 = ['numberline', 'tools', 'ruler', 'convert'];
const MATH_GAMES_15_7 = ['readclock', 'elapsedtime', 'timeconvert', 'timeword'];
const MATH_GAMES = [...MATH_GAMES_15_1, ...MATH_GAMES_15_7];
const READING_GAMES = ['vocabulary', 'comprehension', 'textfeatures', 'chronology'];
const SCIENCE_GAMES = ['constellation', 'moonphases', 'daynight', 'spacevocab'];

let currentMathUnit = '15.1';
let constellationState = { found: new Set(), canvas: null, distractors: [] };

const encouragements = [
  '🎉 Awesome!', '🌟 You rock!', '💪 Nailed it!', '🔥 On fire!',
  '🚀 Superstar!', '✨ Brilliant!', '👏 Amazing!', '🏆 Champion!'
];
const tryAgains = [
  '🤔 Almost!', '💭 Not quite!', '🔄 Try again next time!',
  '📚 Keep learning!', '💪 You got this!'
];

function getSubjectForGame(type) {
  if (MATH_GAMES.includes(type)) return 'math';
  if (READING_GAMES.includes(type)) return 'reading';
  if (SCIENCE_GAMES.includes(type)) return 'science';
  return currentSubject;
}

// ===================== READING PASSAGES =====================
const PASSAGES = {
  'your-world-up-close': {
    title: 'Your World Up Close',
    icon: '🔬',
    html: `
      <p class="passage-section-title">Your World Up Close</p>
      <p>Does the picture on the left show a diamond or a glass prism? Look closer. Take a step back. You are <em>too</em> close.</p>
      <p>It is a picture of a sugar crystal. This extreme close-up was taken by an electron microscope, a tool that can <span class="vocab-word">magnify</span> an item to thousands of times its actual size.</p>
      <p>Pictures taken with a high-tech electron microscope are called photomicrographs. The sugar crystal on the left may look huge, but the word <em>micro</em> means "small." We are seeing a small part of the sugar crystal up close.</p>
      <p>Photomicrography dates back to 1840, when a scientist named Alfred Donné first photographed images through a microscope. Around 1852, a German pharmacist made the first version of a camera that took photomicrographs. In 1882, Wilson "Snowflake" Bentley of Vermont became the first person to use a camera with a built-in <span class="vocab-word">microscope</span> to take pictures of snowflakes. His photographs showed that there is no such thing as a <span class="vocab-word">typical</span> snowflake. Each is unique. Nowadays, we have electron micrographs.</p>
      <span class="caption-text">These electron micrographs show that snowflakes are shaped like hexagons.</span>
      <p>The light microscopes you use in school are weak and do not show much detail. An electron microscope is a much more powerful tool. It allows scientists to see things we can't see with our eyes, such as skin cells or dust mites.</p>
      <p>The picture below is a close-up of human skin and shows the detail an electron microscope can capture. The more an image is magnified, the more detail you will see. The most magnification that a photomicrograph can capture is about 2 million times the original image size.</p>
      <span class="caption-text">This is a human fingerprint, magnified by an electron microscope. (x1 million and x2 million)</span>
      <p>Magnified images have helped scientists to see what causes diseases. Over the years, scientists have learned how these diseases behave. We have even learned what is inside a cell or how a snowflake <span class="vocab-word">dissolves</span> into a drop of water.</p>
      <p class="passage-section-title">Fruit Decay</p>
      <span class="caption-text">When the mold on a strawberry is looked at under an electron microscope, it resembles grapes.</span>
      <p>Scientists use electron micrographs to see how objects change over time. For example, we can look at a piece of fruit to see how it decays. First the fruit looks fresh. After a few days, it will soften. Specks of mold will appear and <span class="vocab-word">cling</span> to it. Days pass and it will be covered in mold. A microscope shows this far earlier than our eyes.</p>
      <p>Suppose you <span class="vocab-word">mingle</span> with friends outside on a <span class="vocab-word">humid</span> day. What would the sweat on your skin look like magnified? The possibilities are endless if you examine your world up close.</p>
    `
  },
  'vocabulary': {
    title: 'Unit 5 Vocabulary',
    icon: '📝',
    html: `
      <p class="passage-section-title">Unit 5 Vocabulary Words</p>
      <p><span class="vocab-word">cling</span> — A monkey can <em>cling</em> to a tree branch with its long arms. <strong>Cling</strong> means to hold on tightly to something.</p>
      <p><span class="vocab-word">dissolves</span> — A sugar cube <em>dissolves</em> quickly in hot water. <strong>Dissolves</strong> means to break apart and mix into a liquid.</p>
      <p><span class="vocab-word">gritty</span> — The sand on my feet feels <em>gritty</em>. <strong>Gritty</strong> means rough, containing small hard particles.</p>
      <p><span class="vocab-word">humid</span> — The air is <em>humid</em> on rainy summer days. <strong>Humid</strong> means containing a lot of moisture or water in the air.</p>
      <p><span class="vocab-word">magnify</span> — Let's <em>magnify</em> a leaf to see its details up close. <strong>Magnify</strong> means to make something appear larger than it really is.</p>
      <p><span class="vocab-word">microscope</span> — A <em>microscope</em> is a tool that makes very small things look bigger so we can study them.</p>
      <p><span class="vocab-word">typical</span> — There is no such thing as a <em>typical</em> snowflake. <strong>Typical</strong> means normal, usual, or what you would expect.</p>
    `
  },
  'a-drop-of-water': {
    title: 'A Drop of Water',
    icon: '💧',
    html: `
      <p class="passage-section-title">A Drop of Water (Anchor Text)</p>
      <p>The anchor text "A Drop of Water" uses photographs to help explain complex ideas about water. The author begins and ends the selection with a drop of water to show how water changes forms through the water cycle.</p>
      <p>The author uses a blue drop of water to explain how water becomes ice. When water is liquid, the molecules move freely. As the temperature drops, the molecules slow down. When water freezes, the molecules lock together in a fixed pattern, forming ice.</p>
      <p>The photographs in the text show close-up details of water in different states — liquid water, frost, and ice crystals. The captions explain what we see in each photograph.</p>
      <p>Key ideas: Water molecules behave differently as liquid versus ice. Liquid water molecules move freely, while ice molecules are locked in place. The author uses photographs and captions to show what these changes look like up close.</p>
    `
  },
  'the-incredible-shrinking-potion': {
    title: 'The Incredible Shrinking Potion',
    icon: '🧪',
    html: `
      <p class="passage-section-title">The Incredible Shrinking Potion (Paired Selection)</p>
      <p><strong>1.</strong> It began as a simple science project.</p>
      <p><strong>2.</strong> It was only one week ago that Isabel, Mariela, and Hector were working on a shrinking potion that would amaze everyone at the science fair. Mariela and Isabel had perfected the potion, but it was Hector who had created the antidote. Since his discovery, Hector had become less interested in winning the science fair prize and more interested in how this experiment could increase his popularity. His short stature made him practically invisible to everyone at Washington Elementary School.</p>
      <p><strong>3.</strong> That wasn't the case anymore — now the entire class was looking up at Hector. He had come to the science lab bearing "special" cupcakes, which made it easy for him to shrink the entire class, including his science teacher, Ms. Sampson. Hector smirked as he placed his miniature classmates inside the tank of Rambo, the class pet.</p>
      <p><strong>4.</strong> Isabel and Mariela overheard the shrinking shrieks of their classmates outside the classroom door. The girls had been late to lab again. Upon peering inside, they quickly realized they had to do something. Mariela saw that Rambo, outfitted with a vest of tiny tubes, was sniffing merrily outside his tank.</p>
      <p><strong>5.</strong> "Rambo has the antidote!" Mariela whispered. "We will have to shrink ourselves to sneak inside and get the antidote. Then we can help everyone out of the tank!" With shaking hands, Isabel pulled out a vial. The girls took a deep breath and sipped the shrinking potion. The world around them began to grow…</p>
      <p><strong>6.</strong> As Isabel and Mariela walked under the classroom door, everything was magnified to the extreme. Desks and chairs towered over them — even the complex details of each nut and screw became clear, as if viewed under a microscope. The girls made their way to the other side of the lab, dodging mountainous cupcake crumbs and wads of gooey gum.</p>
    `
  }
};

function openPassageModal(sourceKey) {
  const p = PASSAGES[sourceKey];
  if (!p) return;
  document.getElementById('passage-modal-icon').textContent = p.icon;
  document.getElementById('passage-modal-title').textContent = p.title;
  document.getElementById('passage-modal-body').innerHTML = p.html;
  document.getElementById('passage-modal').classList.remove('hidden');
}

function closePassageModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('passage-modal').classList.add('hidden');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('passage-modal').classList.add('hidden');
  }
});

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  switchTab('math');
});

// ===================== NAVIGATION =====================
function switchTab(subject) {
  currentSubject = subject;

  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.subject === subject);
  });

  document.querySelectorAll('.home-screen').forEach(s => s.classList.remove('active'));
  const home = document.getElementById(subject + '-home');
  if (home) home.classList.add('active');

  ['game-screen', 'results-screen', 'boss-screen', 'boss-victory-screen'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });

  setSubjectCSS(subject);
  updateAllStars();
  updateBossCards();
  document.getElementById('top-nav').classList.remove('hidden');
}

function switchMathUnit(unit) {
  currentMathUnit = unit;
  document.querySelectorAll('.unit-pill').forEach(p => p.classList.toggle('active', p.dataset.unit === unit));
  document.getElementById('math-grid-15-1').classList.toggle('hidden', unit !== '15.1');
  document.getElementById('math-grid-15-7').classList.toggle('hidden', unit !== '15.7');
  updateAllStars();
  updateBossCards();
}

function setSubjectCSS(subject) {
  const root = document.documentElement;
  const map = {
    math:    { s: '#2563eb', sl: '#dbeafe', sd: '#1e40af' },
    reading: { s: '#16a34a', sl: '#dcfce7', sd: '#15803d' },
    science: { s: '#ea580c', sl: '#ffedd5', sd: '#c2410c' }
  };
  const c = map[subject] || map.math;
  root.style.setProperty('--subject', c.s);
  root.style.setProperty('--subject-light', c.sl);
  root.style.setProperty('--subject-dark', c.sd);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  const isGameScreen = ['game-screen', 'boss-screen', 'boss-victory-screen'].includes(id);
  const isHomeScreen = id.endsWith('-home');
  document.getElementById('top-nav').classList.toggle('hidden', isGameScreen);
  if (isHomeScreen) document.getElementById('top-nav').classList.remove('hidden');
}

function goHome() {
  setSubjectCSS(currentSubject);
  showScreen(currentSubject + '-home');
  updateAllStars();
  updateBossCards();
}

// ===================== STARS & PROGRESS =====================
function updateAllStars() {
  [['math', MATH_GAMES], ['reading', READING_GAMES], ['science', SCIENCE_GAMES]].forEach(([subj, games]) => {
    games.forEach(g => {
      const el = document.getElementById('stars-' + g);
      const best = (bestScores[subj] || {})[g] || 0;
      if (el) el.textContent = '⭐'.repeat(best) + '☆'.repeat(Math.max(0, QUESTIONS_PER_ROUND - best));
    });
    const total = games.reduce((t, g) => t + ((bestScores[subj] || {})[g] || 0), 0);
    const el = document.getElementById(subj + '-total-stars');
    if (el) el.textContent = total;
  });
}

// ===================== BOSS CARDS =====================
function isBossUnlocked(subject) {
  if (bossForceUnlocked[subject]) return true;
  const gamesMap = { math: MATH_GAMES_15_1, math157: MATH_GAMES_15_7, reading: READING_GAMES, science: SCIENCE_GAMES };
  const games = gamesMap[subject] || [];
  const scoreKey = subject === 'math157' ? 'math' : subject;
  const scores = bestScores[scoreKey] || {};
  return games.every(g => (scores[g] || 0) >= 3);
}

function updateBossCards() {
  ['math', 'math157', 'reading', 'science'].forEach(s => updateBossCard(s));
}

function updateBossCard(subject) {
  const card = document.getElementById(subject + '-boss-card');
  const icon = document.getElementById(subject + '-boss-icon');
  const title = document.getElementById(subject + '-boss-title');
  const desc = document.getElementById(subject + '-boss-desc');
  const checklist = document.getElementById(subject + '-boss-checklist');
  if (!card) return;

  const gamesMap = { math: MATH_GAMES_15_1, math157: MATH_GAMES_15_7, reading: READING_GAMES, science: SCIENCE_GAMES };
  const labelsMap = {
    math: { numberline: 'Number Lines', tools: 'Right Tool', ruler: 'Ruler', convert: 'Converter' },
    math157: { readclock: 'Clock', elapsedtime: 'Elapsed Time', timeconvert: 'Converter', timeword: 'Problems' },
    reading: { vocabulary: 'Vocabulary', comprehension: 'Comprehension', textfeatures: 'Text Features', chronology: 'Chronology' },
    science: { constellation: 'Constellations', moonphases: 'Moon Phases', daynight: 'Day & Night', spacevocab: 'Vocabulary' }
  };
  const games = gamesMap[subject] || [];
  const labels = labelsMap[subject] || {};
  const scoreKey = subject === 'math157' ? 'math' : subject;
  const scores = bestScores[scoreKey] || {};
  const unlocked = isBossUnlocked(subject);

  checklist.innerHTML = games.map(g => {
    const done = (scores[g] || 0) >= 3;
    return `<span class="boss-check-item ${done ? 'done' : 'todo'}">${done ? '✅' : '☐'} ${labels[g] || g}</span>`;
  }).join('');

  const bossInfo = {
    math:    { emoji: '🐉', name: 'BOSS BATTLE', desc: 'Defeat the Measurement Dragon!' },
    math157: { emoji: '⏰', name: 'TIME BATTLE', desc: 'Defeat the Time Titan!' },
    reading: { emoji: '📚', name: 'READING TEST', desc: 'Prove your reading skills!' },
    science: { emoji: '🛸', name: 'SPACE BATTLE', desc: 'Defeat the Cosmic Commander!' }
  };
  const bi = bossInfo[subject] || bossInfo.math;

  if (unlocked) {
    card.classList.remove('locked');
    card.classList.add('unlocked');
    card.disabled = false;
    icon.textContent = bi.emoji;
    title.textContent = bi.name;
    desc.textContent = bi.desc;
  } else {
    card.classList.add('locked');
    card.classList.remove('unlocked');
    card.disabled = true;
    icon.textContent = '🔒';
    title.textContent = bi.name;
    desc.textContent = 'Get ⭐3+ in all 4 activities to unlock!';
  }
}

// ===================== START GAME =====================
function startGame(type) {
  const subject = getSubjectForGame(type);
  currentSubject = subject;
  setSubjectCSS(subject);
  currentGame = type;
  currentQ = 0;
  score = 0;
  answered = false;
  questions = generateQuestions(type);
  document.getElementById('current-score').textContent = '0';

  const labels = {
    numberline: 'Number Lines', tools: 'Right Tool', ruler: 'Read the Ruler', convert: 'Unit Converter',
    vocabulary: 'Vocabulary', comprehension: 'Comprehension', textfeatures: 'Text Features', chronology: 'Chronology',
    constellation: 'Constellations', moonphases: 'Moon Phases', daynight: 'Day & Night', spacevocab: 'Space Vocabulary',
    readclock: 'Read the Clock', elapsedtime: 'Elapsed Time', timeconvert: 'Time Converter', timeword: 'Time Problems'
  };
  document.getElementById('game-label').textContent = labels[type] || type;
  showScreen('game-screen');
  renderQuestion();
}

function retryGame() { startGame(currentGame); }

// ===================== QUESTION GENERATORS (Dispatch) =====================
function generateQuestions(type) {
  switch (type) {
    case 'numberline': return generateNumberLineQuestions();
    case 'tools': return generateToolQuestions();
    case 'ruler': return generateRulerQuestions();
    case 'convert': return generateConvertQuestions();
    case 'vocabulary': return generateVocabularyQuestions();
    case 'comprehension': return generateComprehensionQuestions();
    case 'textfeatures': return generateTextFeaturesQuestions();
    case 'chronology': return generateChronologyQuestions();
    case 'constellation': return generateConstellationQuestions();
    case 'moonphases': return generateMoonPhaseQuestions();
    case 'daynight': return generateDayNightQuestions();
    case 'spacevocab': return generateSpaceVocabQuestions();
    case 'readclock': return generateReadClockQuestions();
    case 'elapsedtime': return generateElapsedTimeQuestions();
    case 'timeconvert': return generateTimeConvertQuestions();
    case 'timeword': return generateTimeWordQuestions();
    default: return [];
  }
}

// ===================== MATH: NUMBER LINE =====================
function generateNumberLineQuestions() {
  const unitPairs = [
    { topUnit: 'feet', bottomUnit: 'inches', factor: 12 },
    { topUnit: 'meters', bottomUnit: 'centimeters', factor: 100 },
    { topUnit: 'minutes', bottomUnit: 'seconds', factor: 60 },
    { topUnit: 'gallons', bottomUnit: 'quarts', factor: 4 },
    { topUnit: 'yards', bottomUnit: 'feet', factor: 3 },
    { topUnit: 'hours', bottomUnit: 'minutes', factor: 60 },
    { topUnit: 'pounds', bottomUnit: 'ounces', factor: 16 },
    { topUnit: 'cups', bottomUnit: 'tablespoons', factor: 16 },
    { topUnit: 'pints', bottomUnit: 'cups', factor: 2 },
    { topUnit: 'quarts', bottomUnit: 'pints', factor: 2 },
    { topUnit: 'kilometers', bottomUnit: 'meters', factor: 1000 },
  ];
  return shuffle(unitPairs).slice(0, QUESTIONS_PER_ROUND).map(pair => {
    const rangeOptions = pair.factor >= 100 ? [4, 5, 6] : [5, 6, 7, 8];
    const count = rangeOptions[Math.floor(Math.random() * rangeOptions.length)];
    const startOffset = Math.floor(Math.random() * 4);
    const slots = [];
    const blankCount = Math.max(2, Math.floor(count * 0.4 + Math.random() * 2));
    const blankIndices = new Set();
    while (blankIndices.size < blankCount) {
      blankIndices.add(1 + Math.floor(Math.random() * (count - 1)));
    }
    for (let i = 0; i < count; i++) {
      const topVal = startOffset + i;
      const bottomVal = topVal * pair.factor;
      const isBlank = blankIndices.has(i);
      const blankTop = isBlank && Math.random() < 0.5;
      slots.push({ topVal, bottomVal, topBlank: blankTop, bottomBlank: !blankTop && isBlank });
    }
    return { type: 'numberline', topUnit: pair.topUnit, bottomUnit: pair.bottomUnit, slots };
  });
}

// ===================== MATH: TOOLS =====================
function generateToolQuestions() {
  const names = shuffle(['Bryce','Cora','Rosie','Simon','Gia','Emma','Carlos','Lily','Max','Noah','Zoe','Mia','Liam','Ava','Jack','Ella','Leo','Ivy','Finn','Ruby']);
  let nameIdx = 0;
  const n = () => names[nameIdx++ % names.length];
  const templates = [
    () => ({ text: `${n()} needs ${50+Math.floor(Math.random()*450)} grams of flour. Which tool?`, answer: 'scale' }),
    () => ({ text: `${n()} wants to know the mass of a watermelon. Which tool?`, answer: 'scale' }),
    () => ({ text: `The pet store needs to weigh ${Math.floor(Math.random()*5+1)} kg of birdseed. Which tool?`, answer: 'scale' }),
    () => ({ text: `${n()} needs ${Math.floor(Math.random()*3+1)} cups of milk for a smoothie. Which tool?`, answer: 'measuring_cup' }),
    () => ({ text: `A chef needs to measure ${Math.floor(Math.random()*12+4)} ounces of broth. Which tool?`, answer: 'measuring_cup' }),
    () => ({ text: `${n()} is baking and needs ½ cup of oil. Which tool?`, answer: 'measuring_cup' }),
    () => ({ text: `${n()} wants to find the length of the classroom. Which tool?`, answer: 'tape_measure' }),
    () => ({ text: `${n()} needs to see if a bookshelf fits a ${Math.floor(Math.random()*8+4)}-foot wall. Which tool?`, answer: 'tape_measure' }),
    () => ({ text: `${n()} is building a birdhouse and needs to cut a board to ${Math.floor(Math.random()*10+6)} inches. Which tool?`, answer: 'tape_measure' }),
    () => ({ text: `${n()} wants to check if the bath water is too hot. Which tool?`, answer: 'thermometer' }),
    () => ({ text: `${n()} feels sick and needs to check their temperature. Which tool?`, answer: 'thermometer' }),
    () => ({ text: `${n()} wants to know how cold it is outside. Which tool?`, answer: 'thermometer' }),
    () => ({ text: `${n()} is doing a science experiment and needs ${Math.floor(Math.random()*400+100)} mL of liquid. Which tool?`, answer: 'beaker' }),
    () => ({ text: `In science class, ${n()} must mix two liquids and track volume. Which tool?`, answer: 'beaker' }),
    () => ({ text: `A vet needs to give a kitten exactly ${Math.floor(Math.random()*8+2)} mL of medicine. Which tool?`, answer: 'dropper' }),
    () => ({ text: `${n()} needs to add exactly ${Math.floor(Math.random()*5+1)} drops of food coloring. Which tool?`, answer: 'dropper' }),
  ];
  const tools = [
    { id: 'scale', emoji: '⚖️', name: 'Scale' },
    { id: 'measuring_cup', emoji: '🥛', name: 'Measuring Cup' },
    { id: 'tape_measure', emoji: '📏', name: 'Tape Measure / Ruler' },
    { id: 'thermometer', emoji: '🌡️', name: 'Thermometer' },
    { id: 'beaker', emoji: '🧪', name: 'Beaker' },
    { id: 'dropper', emoji: '💧', name: 'Dropper / Syringe' }
  ];
  return shuffle(templates).slice(0, QUESTIONS_PER_ROUND).map(fn => {
    const s = fn();
    let opts = tools.filter(t => t.id === s.answer);
    let others = shuffle(tools.filter(t => t.id !== s.answer)).slice(0, 3);
    opts = shuffle([...opts, ...others]);
    return { type: 'tools', ...s, options: opts };
  });
}

// ===================== MATH: RULER =====================
function generateRulerQuestions() {
  const results = [];
  for (let i = 0; i < QUESTIONS_PER_ROUND; i++) {
    const wholeInch = Math.floor(Math.random() * 4) + 1;
    const eighths = Math.floor(Math.random() * 7) + 1;
    const inches = wholeInch + eighths / 8;
    const wrongSet = new Set();
    while (wrongSet.size < 3) {
      const offsets = [-0.25, 0.25, -0.125, 0.125, -0.375, 0.375, -0.5, 0.5];
      const offset = offsets[Math.floor(Math.random() * offsets.length)];
      const wrong = Math.round((inches + offset) * 8) / 8;
      if (wrong > 0 && wrong !== inches && !wrongSet.has(wrong)) wrongSet.add(wrong);
    }
    const allOptions = shuffle([inches, ...wrongSet]);
    const displayOptions = allOptions.map(v => ({ value: v, display: inchesToFraction(v) }));
    results.push({ type: 'ruler', inches, display: inchesToFraction(inches), options: displayOptions, maxInches: Math.ceil(inches) + 1 });
  }
  return results;
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

// ===================== MATH: CONVERSION =====================
function generateConvertQuestions() {
  const conversions = [
    { fromUnit: 'feet', toUnit: 'inches', factor: 12, min: 1, max: 12 },
    { fromUnit: 'inches', toUnit: 'feet', factor: 1/12, multOf: 12, min: 1, max: 12 },
    { fromUnit: 'meters', toUnit: 'centimeters', factor: 100, min: 1, max: 10 },
    { fromUnit: 'centimeters', toUnit: 'meters', factor: 1/100, multOf: 100, min: 1, max: 10 },
    { fromUnit: 'minutes', toUnit: 'seconds', factor: 60, min: 1, max: 10 },
    { fromUnit: 'gallons', toUnit: 'quarts', factor: 4, min: 1, max: 12 },
    { fromUnit: 'quarts', toUnit: 'gallons', factor: 1/4, multOf: 4, min: 1, max: 12 },
    { fromUnit: 'yards', toUnit: 'feet', factor: 3, min: 1, max: 12 },
    { fromUnit: 'pounds', toUnit: 'ounces', factor: 16, min: 1, max: 8 },
    { fromUnit: 'cups', toUnit: 'tablespoons', factor: 16, min: 1, max: 6 },
    { fromUnit: 'pints', toUnit: 'cups', factor: 2, min: 1, max: 12 },
    { fromUnit: 'kilometers', toUnit: 'meters', factor: 1000, min: 1, max: 10 },
    { fromUnit: 'hours', toUnit: 'minutes', factor: 60, min: 1, max: 8 },
    { fromUnit: 'days', toUnit: 'hours', factor: 24, min: 1, max: 7 },
    { fromUnit: 'weeks', toUnit: 'days', factor: 7, min: 1, max: 10 },
  ];
  return shuffle(conversions).slice(0, QUESTIONS_PER_ROUND).map(c => {
    const n = c.min + Math.floor(Math.random() * (c.max - c.min + 1));
    const fromVal = c.multOf ? n * c.multOf : n;
    const toVal = Math.round(fromVal * c.factor * 100) / 100;
    return { type: 'convert', fromUnit: c.fromUnit, toUnit: c.toUnit, fromVal, toVal };
  });
}

// ===================== MATH 15.7: READ THE CLOCK =====================
function generateReadClockQuestions() {
  const qs = [];
  const used = new Set();
  while (qs.length < QUESTIONS_PER_ROUND) {
    const h = Math.floor(Math.random() * 12) + 1;
    const m = Math.floor(Math.random() * 12) * 5;
    const key = `${h}:${m}`;
    if (used.has(key)) continue;
    used.add(key);
    const ampm = Math.random() < 0.5 ? 'a.m.' : 'p.m.';
    const correct = `${h}:${String(m).padStart(2, '0')} ${ampm}`;
    const wrongs = new Set();
    while (wrongs.size < 3) {
      const wh = Math.max(1, Math.min(12, h + (Math.random() < 0.5 ? 1 : -1) * (Math.floor(Math.random() * 2) + 1)));
      const wm = ((m + (Math.floor(Math.random() * 3) + 1) * 5) % 60);
      const w = `${wh}:${String(wm).padStart(2, '0')} ${ampm}`;
      if (w !== correct) wrongs.add(w);
    }
    const options = shuffle([correct, ...wrongs]);
    qs.push({ type: 'readclock', hours: h, minutes: m, ampm, question: 'What time does this clock show?', options, correctIndex: options.indexOf(correct) });
  }
  return qs;
}

// ===================== MATH 15.7: ELAPSED TIME =====================
function generateElapsedTimeQuestions() {
  const pool = [];
  for (let i = 0; i < 12; i++) {
    const sh = Math.floor(Math.random() * 10) + 1;
    const sm = Math.floor(Math.random() * 4) * 15;
    const durH = Math.floor(Math.random() * 3) + 1;
    const durM = Math.floor(Math.random() * 4) * 15;
    const totalDur = durH * 60 + durM;
    if (totalDur === 0) continue;
    const eh = sh + durH + Math.floor((sm + durM) / 60);
    const em = (sm + durM) % 60;
    if (eh > 12) continue;
    const sampm = sh >= 8 ? 'a.m.' : 'p.m.';
    const eampm = sampm;
    const startStr = `${sh}:${String(sm).padStart(2, '0')} ${sampm}`;
    const endStr = `${eh}:${String(em).padStart(2, '0')} ${eampm}`;
    const correct = durH > 0 && durM > 0 ? `${durH} hr ${durM} min` : durH > 0 ? `${durH} hr 0 min` : `${durM} min`;
    const correctMin = totalDur + ' minutes';
    const wrongs = new Set();
    while (wrongs.size < 3) {
      const off = (Math.floor(Math.random() * 4) + 1) * 15 * (Math.random() < 0.5 ? 1 : -1);
      const w = totalDur + off;
      if (w > 0 && w !== totalDur) wrongs.add(w + ' minutes');
    }
    const options = shuffle([correctMin, ...wrongs]);
    pool.push({ type: 'elapsedtime', startH: sh, startM: sm, endH: eh, endM: em, ampm: sampm, question: `How much time passed from ${startStr} to ${endStr}?`, options, correctIndex: options.indexOf(correctMin) });
  }
  return shuffle(pool).slice(0, QUESTIONS_PER_ROUND);
}

// ===================== MATH 15.7: TIME CONVERTER =====================
function generateTimeConvertQuestions() {
  const pool = [];
  for (let h = 2; h <= 8; h++) {
    pool.push({ type: 'timeconvert_input', given: h, givenUnit: 'hours', answerUnit: 'minutes', answer: h * 60, question: `${h} hours = ? minutes` });
  }
  for (let m = 2; m <= 10; m++) {
    pool.push({ type: 'timeconvert_input', given: m, givenUnit: 'minutes', answerUnit: 'seconds', answer: m * 60, question: `${m} minutes = ? seconds` });
  }
  [90, 120, 150, 180, 210, 240, 300].forEach(m => {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    const aStr = rm > 0 ? `${h} hr ${rm} min` : `${h} hr`;
    pool.push({ type: 'science_mc', question: `Convert ${m} minutes to hours and minutes.`, options: shuffle([aStr, `${h + 1} hr ${rm} min`, `${h} hr ${rm + 15} min`, `${Math.max(1, h - 1)} hr ${rm + 30} min`].filter((v,i,a) => a.indexOf(v) === i).slice(0, 4)), correctIndex: 0 });
    pool[pool.length - 1].correctIndex = pool[pool.length - 1].options.indexOf(aStr);
  });
  return shuffle(pool).slice(0, QUESTIONS_PER_ROUND);
}

// ===================== MATH 15.7: TIME WORD PROBLEMS =====================
function generateTimeWordQuestions() {
  const pool = [
    { type: 'science_mc', question: 'Lola started watching a movie at 3:45 p.m. and stopped at 5:55 p.m. How many minutes was the movie?', options: ['110 minutes', '120 minutes', '130 minutes', '150 minutes'], correctIndex: 2 },
    { type: 'science_mc', question: 'Derinda walked a dog from 11:45 a.m. to 12:15 p.m. on 5 days this week. How many total minutes did she walk the dog?', options: ['30 minutes', '100 minutes', '150 minutes', '200 minutes'], correctIndex: 2 },
    { type: 'science_mc', question: 'A teacher gives 30-minute piano lessons once each day on 5 days. How many hours of piano lessons in a week?', options: ['1½ hours', '2 hours', '2½ hours', '3 hours'], correctIndex: 2 },
    { type: 'science_mc', question: 'Helen worked in the garden from 10:20 a.m. to 2:15 p.m. How many minutes did she work?', options: ['195 minutes', '215 minutes', '235 minutes', '255 minutes'], correctIndex: 2 },
    { type: 'science_mc', question: 'A concert is from 12:15 p.m. to 2:45 p.m. How long is the concert?', options: ['2 hours', '2 hours 15 minutes', '2 hours 30 minutes', '2 hours 45 minutes'], correctIndex: 2 },
    { type: 'science_mc', question: 'A movie lasts 2 hours and 8 minutes and ends at 2:24 p.m. What time did the movie start?', options: ['12:16 p.m.', '12:08 p.m.', '11:56 a.m.', '12:24 p.m.'], correctIndex: 0 },
    { type: 'science_mc', question: 'Julian reads 2 hours each week. He has read 32 min (Mon), 18 min (Tue), 26 min (Wed). How many more minutes does he need this week?', options: ['24 minutes', '34 minutes', '44 minutes', '54 minutes'], correctIndex: 2 },
    { type: 'science_mc', question: 'Jess swam 200 yards in 7 minutes. Christina swam 200 yards in 400 seconds. How many seconds faster did Christina swim?', options: ['10 seconds', '20 seconds', '30 seconds', '40 seconds'], correctIndex: 1 },
    { type: 'science_mc', question: 'If 10 hours = 600 minutes, how many minutes are in 30 hours?', options: ['1200 minutes', '1500 minutes', '1800 minutes', '2400 minutes'], correctIndex: 2 },
    { type: 'science_mc', question: 'Fasil plays basketball for 40 minutes each day on Monday, Wednesday, and Saturday. How many total minutes does he play in a week?', options: ['80 minutes', '100 minutes', '120 minutes', '160 minutes'], correctIndex: 2 },
    { type: 'science_mc', question: 'Ana has math class 1½ hours each day on 4 days of the week. How many total minutes of math class per week?', options: ['240 minutes', '300 minutes', '360 minutes', '420 minutes'], correctIndex: 2 },
    { type: 'science_mc', question: 'Henry walks one lap in 12 minutes. How many laps can he walk in an hour?', options: ['3 laps', '4 laps', '5 laps', '6 laps'], correctIndex: 2 },
  ];
  return shuffle(pool).slice(0, QUESTIONS_PER_ROUND);
}

// ===================== READING: VOCABULARY =====================
function generateVocabularyQuestions() {
  const pool = [
    { question: 'What does "magnify" mean?', source: 'vocabulary', options: ['To make something smaller', 'To make something appear larger', 'To make something disappear', 'To change color'], correctIndex: 1 },
    { question: 'What does "dissolves" mean?', source: 'vocabulary', options: ['Becomes harder and stronger', 'Changes color suddenly', 'Breaks apart and mixes into a liquid', 'Gets much bigger'], correctIndex: 2 },
    { question: 'Which word means "to stick to something"?', source: 'vocabulary', options: ['dissolves', 'magnify', 'cling', 'humid'], correctIndex: 2 },
    { question: 'What is a synonym for "humid"?', source: 'vocabulary', options: ['Cold', 'Dry', 'Moist', 'Windy'], correctIndex: 2 },
    { question: 'Which word means "usual" or "normal"?', source: 'vocabulary', options: ['gritty', 'humid', 'magnify', 'typical'], correctIndex: 3 },
    { question: 'What does "gritty" mean?', source: 'vocabulary', options: ['Smooth and soft', 'Rough, with small hard particles', 'Very cold', 'Brightly colored'], correctIndex: 1 },
    { question: 'A microscope is a tool that helps you...', source: 'vocabulary', options: ['Measure weight', 'See very small things up close', 'Hear sounds better', 'Feel temperatures'], correctIndex: 1 },
    { question: 'What is an antonym (opposite) of "humid"?', source: 'vocabulary', options: ['Moist', 'Wet', 'Dry', 'Warm'], correctIndex: 2 },
    { question: '"The sugar cube dissolves quickly in hot water." What does dissolves mean here?', source: 'vocabulary', options: ['It breaks into tiny pieces and mixes into the water', 'It gets bigger in the water', 'It floats on top of the water', 'It turns the water into sugar'], correctIndex: 0 },
    { question: 'Which word describes a foggy day with lots of moisture in the air?', source: 'vocabulary', options: ['Gritty', 'Typical', 'Humid', 'Magnify'], correctIndex: 2 },
    { question: '"A monkey can cling to a tree branch with its long arms." What does cling mean?', source: 'vocabulary', options: ['Fall from', 'Hold on tightly', 'Jump over', 'Look at'], correctIndex: 1 },
    { question: 'What is an antonym (opposite) of "magnify"?', source: 'vocabulary', options: ['Enlarge', 'Shrink', 'Discover', 'Dissolve'], correctIndex: 1 },
    { question: '"The sand on my feet feels gritty." What does gritty mean in this sentence?', source: 'vocabulary', options: ['Soft and smooth', 'Wet and cold', 'Rough and sandy', 'Warm and dry'], correctIndex: 2 },
    { question: 'What does the word "photomicrograph" mean?', source: 'your-world-up-close', options: ['A very small camera', 'A photograph taken through a microscope', 'A type of painting', 'A picture of the sun'], correctIndex: 1 },
    { question: 'How are the words "magnify" and "enlarge" related?', source: 'vocabulary', options: ['They are antonyms (opposites)', 'They are synonyms (similar meaning)', 'They are not related at all', 'One is a noun, the other is a verb'], correctIndex: 1 },
  ];
  return shuffle(pool).slice(0, QUESTIONS_PER_ROUND).map(q => ({ type: 'reading_mc', ...q }));
}

// ===================== READING: COMPREHENSION =====================
function generateComprehensionQuestions() {
  const pool = [
    { question: 'What is the main topic of "Your World Up Close"?', source: 'your-world-up-close', options: ['How to build a microscope', 'What we can discover by looking at things closely with electron microscopes', 'How to take photographs', 'The history of cameras'], correctIndex: 1 },
    { question: 'What did Wilson "Snowflake" Bentley discover?', source: 'your-world-up-close', options: ['How to make snow', 'That every snowflake is unique', 'How to build microscopes', 'How to melt ice'], correctIndex: 1 },
    { question: 'What shape are snowflakes when viewed under an electron microscope?', source: 'your-world-up-close', options: ['Circles', 'Squares', 'Hexagons', 'Triangles'], correctIndex: 2 },
    { question: 'How powerful can an electron microscope be?', source: 'your-world-up-close', options: ['About the same as a school microscope', '10 times stronger', 'Up to 2 million times the original size', '100 times stronger'], correctIndex: 2 },
    { question: '"Your World Up Close" is an example of what type of text?', source: 'your-world-up-close', options: ['Fiction', 'Poetry', 'Expository text', 'Fantasy'], correctIndex: 2 },
    { question: 'What happens to fruit as it decays over time?', source: 'your-world-up-close', options: ['It stays the same forever', 'It gets bigger', 'It softens and mold appears on it', 'It changes color to blue'], correctIndex: 2 },
    { question: 'In "The Incredible Shrinking Potion," why did Hector make the shrinking potion?', source: 'the-incredible-shrinking-potion', options: ['To help his classmates learn', 'To win the science fair and become popular', 'Because his teacher asked him to', 'To help Rambo the hamster'], correctIndex: 1 },
    { question: 'In "A Drop of Water," what can you infer about water molecules?', source: 'a-drop-of-water', options: ['They never change', 'They behave differently as liquid versus ice', 'They can only be seen with our eyes', 'They are always the same size'], correctIndex: 1 },
    { question: 'What is the difference between a light microscope and an electron microscope?', source: 'your-world-up-close', options: ['They are exactly the same', 'Light microscopes are more powerful', 'Electron microscopes are much more powerful and show more detail', 'Light microscopes are used by scientists'], correctIndex: 2 },
    { question: 'What did Alfred Donné do in 1840?', source: 'your-world-up-close', options: ['Invented the camera', 'First photographed images through a microscope', 'Discovered snowflakes', 'Built the first electron microscope'], correctIndex: 1 },
    { question: 'Why does the author begin and end "A Drop of Water" with a drop of water?', source: 'a-drop-of-water', options: ['Because water is pretty', 'To explain the water cycle and how water changes forms', 'Because the author likes rain', 'To make the pictures more colorful'], correctIndex: 1 },
    { question: 'What does the word "micro" mean in "photomicrograph"?', source: 'your-world-up-close', options: ['Large', 'Fast', 'Small', 'Old'], correctIndex: 2 },
  ];
  return shuffle(pool).slice(0, QUESTIONS_PER_ROUND).map(q => ({ type: 'reading_mc', ...q }));
}

// ===================== READING: TEXT FEATURES =====================
function generateTextFeaturesQuestions() {
  const pool = [
    { question: 'What is a caption?', source: 'your-world-up-close', options: ['The title of a book', 'Words that explain a photograph', 'The first sentence of a paragraph', 'A type of question'], correctIndex: 1 },
    { question: 'An expository text is a text that...', source: 'your-world-up-close', options: ['Tells a made-up story', 'Gives facts and information about a topic', 'Is always a poem', 'Is always about animals'], correctIndex: 1 },
    { question: 'In expository text, photographs help readers by...', source: 'your-world-up-close', options: ['Making the text longer', 'Illustrating information described in the text', 'Making the text more difficult', 'Replacing the written words'], correctIndex: 1 },
    { question: 'Bold or highlighted words in a text usually mean...', source: 'your-world-up-close', options: ['The words are not important', 'The words are vocabulary terms that are important to understand', 'The words should be skipped', 'The words are made up'], correctIndex: 1 },
    { question: 'How do headings help readers?', source: 'your-world-up-close', options: ['They make the text look pretty', 'They tell readers what a section is about', 'They are just decoration', 'They make the text longer'], correctIndex: 1 },
    { question: 'Which text feature helps you see what something looks like?', source: 'your-world-up-close', options: ['Headings', 'Bold words', 'Photographs', 'Page numbers'], correctIndex: 2 },
    { question: 'What does "summarize" mean?', source: 'your-world-up-close', options: ['Copy the entire text word for word', 'Retell the central ideas and important details in your own words', 'Only read the last paragraph', 'Draw a picture about the text'], correctIndex: 1 },
    { question: 'What is "text evidence"?', source: 'your-world-up-close', options: ['A guess about what might happen', 'Specific details from the text that support an answer', 'The title of a book', 'A picture in the text'], correctIndex: 1 },
    { question: 'How do photographs and captions work together in expository text?', source: 'your-world-up-close', options: ['They don\'t — they are separate', 'Captions explain what the photographs show, adding extra information', 'Photographs replace the captions', 'Captions are more important than photographs'], correctIndex: 1 },
    { question: '"Your World Up Close" includes photographs of snowflakes, sugar crystals, and fruit. These photos help the reader by...', source: 'your-world-up-close', options: ['Making the text confusing', 'Showing details that are too small to see with just our eyes', 'Telling a story about winter', 'Replacing the need to read the words'], correctIndex: 1 },
    { question: 'What makes "Your World Up Close" an expository text?', source: 'your-world-up-close', options: ['It has made-up characters', 'It gives facts and information, and includes text features like photographs and captions', 'It rhymes', 'It is a fairy tale'], correctIndex: 1 },
    { question: 'Imagery is the use of words to help readers...', source: 'the-incredible-shrinking-potion', options: ['Count the pages', 'Visualize what the author is describing using their senses', 'Spell difficult words', 'Find the main character'], correctIndex: 1 },
  ];
  return shuffle(pool).slice(0, QUESTIONS_PER_ROUND).map(q => ({ type: 'reading_mc', ...q }));
}

// ===================== READING: CHRONOLOGY =====================
function generateChronologyQuestions() {
  const pool = [
    { question: 'Put these events in order. What happened FIRST?', source: 'your-world-up-close', options: ['Wilson Bentley took pictures of snowflakes (1882)', 'Alfred Donné first photographed through a microscope (1840)', 'We now have electron micrographs', 'A German pharmacist made a camera for photomicrographs (1852)'], correctIndex: 1 },
    { question: 'When did Alfred Donné first photograph images through a microscope?', source: 'your-world-up-close', options: ['1882', '1852', '1840', '1900'], correctIndex: 2 },
    { question: 'What happened in 1852?', source: 'your-world-up-close', options: ['Wilson Bentley took pictures of snowflakes', 'Alfred Donné used a microscope', 'A German pharmacist made the first camera that took photomicrographs', 'Electron microscopes were invented'], correctIndex: 2 },
    { question: 'In 1882, Wilson "Snowflake" Bentley became the first person to...', source: 'your-world-up-close', options: ['Invent the microscope', 'Use a camera with a built-in microscope to take pictures of snowflakes', 'Discover sugar crystals', 'Make photomicrographs of fruit'], correctIndex: 1 },
    { question: 'Which sequence is in the correct chronological (time) order?', source: 'your-world-up-close', options: ['Bentley → Donné → German pharmacist', 'Donné (1840) → German pharmacist (1852) → Bentley (1882)', 'German pharmacist → Bentley → Donné', 'Bentley → German pharmacist → Donné'], correctIndex: 1 },
    { question: 'In "The Incredible Shrinking Potion," what happened AFTER Isabel and Mariela drank the potion?', source: 'the-incredible-shrinking-potion', options: ['They grew very tall', 'Everything appeared magnified/gigantic — desks and chairs towered over them', 'They fell asleep', 'They flew through the air'], correctIndex: 1 },
    { question: 'According to the text, what happens to fruit FIRST when it decays?', source: 'your-world-up-close', options: ['It gets covered in mold', 'It softens', 'It disappears completely', 'It becomes gritty'], correctIndex: 1 },
    { question: 'Time-order words like "first," "then," and "after" help readers...', source: 'your-world-up-close', options: ['Understand the characters better', 'Understand the sequence (order) of events', 'Find vocabulary words', 'Count the pages in a book'], correctIndex: 1 },
    { question: 'What is the correct order of fruit decaying?', source: 'your-world-up-close', options: ['Mold → Fresh → Covered in mold', 'Fresh → Softens → Mold appears → Covered in mold', 'Covered in mold → Fresh → Softens', 'Softens → Fresh → Covered in mold'], correctIndex: 1 },
    { question: 'In "The Incredible Shrinking Potion," what did Hector do BEFORE bringing cupcakes to class?', source: 'the-incredible-shrinking-potion', options: ['He shrank Rambo the hamster', 'He worked with Isabel and Mariela to create the shrinking potion', 'He told Ms. Sampson about the potion', 'He ran out of the classroom'], correctIndex: 1 },
    { question: 'Which happened most recently in the history of microscopes?', source: 'your-world-up-close', options: ['Alfred Donné used a microscope (1840)', 'Photomicrography cameras (1852)', 'Wilson Bentley\'s snowflake photos (1882)', 'We have electron micrographs (today)'], correctIndex: 3 },
    { question: 'Chronological order means organizing events by...', source: 'your-world-up-close', options: ['Size, from smallest to largest', 'The time they happened, from earliest to latest', 'Importance, from most to least', 'The alphabet'], correctIndex: 1 },
  ];
  return shuffle(pool).slice(0, QUESTIONS_PER_ROUND).map(q => ({ type: 'reading_mc', ...q }));
}

// ===================== SCIENCE: CONSTELLATION DATA =====================
const CONSTELLATIONS = [
  {
    name: 'Big Dipper', season: 'Spring/Summer',
    fact: 'Part of Ursa Major (the Great Bear). Used for navigation!',
    stars: [{x:18,y:58},{x:28,y:46},{x:38,y:40},{x:50,y:36},{x:50,y:56},{x:68,y:56},{x:68,y:28}],
    edges: [[0,1],[1,2],[2,3],[3,6],[6,5],[5,4],[4,3]]
  },
  {
    name: 'Cassiopeia', season: 'Fall/Winter',
    fact: 'Shaped like the letter W! Named after a queen in Greek mythology.',
    stars: [{x:12,y:38},{x:28,y:62},{x:50,y:32},{x:72,y:62},{x:88,y:38}],
    edges: [[0,1],[1,2],[2,3],[3,4]]
  },
  {
    name: 'Orion', season: 'Winter',
    fact: 'Named after a hunter. Look for the famous 3-star belt!',
    stars: [{x:35,y:15},{x:65,y:15},{x:42,y:44},{x:50,y:48},{x:58,y:44},{x:32,y:80},{x:70,y:80}],
    edges: [[0,2],[1,4],[2,3],[3,4],[2,5],[4,6]]
  },
  {
    name: 'Cygnus', season: 'Summer',
    fact: 'Also called the Northern Cross. Cygnus means "swan"!',
    stars: [{x:50,y:12},{x:50,y:42},{x:50,y:78},{x:25,y:42},{x:75,y:42}],
    edges: [[0,1],[1,2],[3,1],[1,4]]
  },
  {
    name: 'Leo', season: 'Spring',
    fact: 'Leo means "lion." Regulus is its brightest star!',
    stars: [{x:25,y:55},{x:20,y:38},{x:30,y:22},{x:45,y:20},{x:50,y:35},{x:80,y:55}],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,0],[4,5]]
  },
  {
    name: 'Ursa Minor', season: 'All Year',
    fact: 'Contains Polaris, the North Star! Helps you find north.',
    stars: [{x:82,y:22},{x:70,y:30},{x:58,y:25},{x:48,y:35},{x:48,y:55},{x:32,y:55},{x:32,y:32}],
    edges: [[0,1],[1,2],[2,3],[3,6],[6,5],[5,4],[4,3]]
  }
];

function generateConstellationQuestions() {
  return shuffle([...CONSTELLATIONS]).slice(0, QUESTIONS_PER_ROUND).map(c => ({ type: 'constellation', ...c }));
}

// ===================== SCIENCE: MOON PHASES =====================
function generateMoonPhaseQuestions() {
  const visualPool = [
    { type: 'moon_visual', phaseKey: 'new-moon', question: 'What moon phase is shown below?', options: ['New Moon','Full Moon','First Quarter','Waxing Crescent'], correctIndex: 0 },
    { type: 'moon_visual', phaseKey: 'full-moon', question: 'What moon phase is shown below?', options: ['Waning Gibbous','New Moon','Full Moon','Last Quarter'], correctIndex: 2 },
    { type: 'moon_visual', phaseKey: 'first-quarter', question: 'What moon phase is shown below?', options: ['Waning Crescent','First Quarter','Full Moon','New Moon'], correctIndex: 1 },
    { type: 'moon_visual', phaseKey: 'last-quarter', question: 'What moon phase is shown below?', options: ['First Quarter','Waxing Gibbous','Last Quarter','New Moon'], correctIndex: 2 },
    { type: 'moon_visual', phaseKey: 'waxing-crescent', question: 'What moon phase is shown below?', options: ['Waning Crescent','Waxing Crescent','First Quarter','New Moon'], correctIndex: 1 },
    { type: 'moon_visual', phaseKey: 'waning-crescent', question: 'What moon phase is shown below?', options: ['Waxing Crescent','Full Moon','Waning Crescent','Last Quarter'], correctIndex: 2 },
    { type: 'moon_visual', phaseKey: 'waxing-gibbous', question: 'What moon phase is shown below?', options: ['Waning Gibbous','First Quarter','Full Moon','Waxing Gibbous'], correctIndex: 3 },
    { type: 'moon_visual', phaseKey: 'waning-gibbous', question: 'What moon phase is shown below?', options: ['Waxing Gibbous','Waning Gibbous','Last Quarter','Full Moon'], correctIndex: 1 },
  ];
  const factPool = [
    { type: 'science_mc', question: 'How long does the moon\'s phase cycle take?', options: ['7 days','14 days','About 29 days','365 days'], correctIndex: 2 },
    { type: 'science_mc', question: 'What phase comes AFTER a Full Moon?', options: ['New Moon','Waning Gibbous','Waxing Gibbous','First Quarter'], correctIndex: 1 },
    { type: 'science_mc', question: 'What phase comes AFTER a New Moon?', options: ['Full Moon','Waning Crescent','Waxing Crescent','Last Quarter'], correctIndex: 2 },
    { type: 'science_mc', question: 'During which phase can the moon hardly be seen?', options: ['Full Moon','First Quarter','New Moon','Waxing Gibbous'], correctIndex: 2 },
    { type: 'science_mc', question: 'The Full Moon looks like a...', options: ['Thin sliver','Half circle','Big, bright circle','You cannot see it'], correctIndex: 2 },
    { type: 'science_mc', question: 'After the Full Moon, do we see more or less of the moon each night?', options: ['More each night','Less each night','The same amount','The moon disappears'], correctIndex: 1 },
    { type: 'science_mc', question: 'Does the moon make its own light?', options: ['Yes, it glows from inside','No, it reflects light from the sun','Yes, from moonbeams','No, it uses starlight'], correctIndex: 1 },
  ];
  return shuffle([...shuffle(visualPool).slice(0, 3), ...shuffle(factPool).slice(0, 2)]);
}

// ===================== SCIENCE: DAY & NIGHT =====================
function generateDayNightQuestions() {
  const pool = [
    { type: 'science_mc', question: 'What causes day and night on Earth?', options: ['The sun moving around Earth','Earth\'s rotation on its axis','The moon blocking the sun','Earth\'s revolution around the sun'], correctIndex: 1 },
    { type: 'science_mc', question: 'How long does it take Earth to complete one full rotation?', options: ['365 days','30 days','12 hours','24 hours'], correctIndex: 3 },
    { type: 'science_mc', question: 'How long does it take Earth to revolve around the sun?', options: ['24 hours','30 days','About 365 days','7 days'], correctIndex: 2 },
    { type: 'science_mc', question: 'Earth\'s axis is an imaginary line that runs between...', options: ['East and West','The North Pole and South Pole','The sun and the moon','Two oceans'], correctIndex: 1 },
    { type: 'science_mc', question: 'The sun appears to rise in the...', options: ['North','South','East','West'], correctIndex: 2 },
    { type: 'science_mc', question: 'The sun appears to set in the...', options: ['North','South','East','West'], correctIndex: 3 },
    { type: 'science_mc', question: 'Does the sun actually move across the sky?', options: ['Yes, it orbits Earth every day','No, Earth rotates which makes it look like the sun moves','Yes, it moves east to west','No, the moon pushes it'], correctIndex: 1 },
    { type: 'science_mc', question: 'When it is daytime where you live, your area is...', options: ['Facing away from the sun','Facing toward the sun','Between the sun and moon','Not rotating'], correctIndex: 1 },
    { type: 'science_mc', question: 'Earth\'s rotation helps keep temperatures from...', options: ['Changing too much','Staying the same','Getting colder every day','Going up every hour'], correctIndex: 0 },
    { type: 'science_mc', question: 'Which TWO statements are true?\nB. Earth revolves around the sun in about 365 days\nD. Earth rotates on its axis in about 24 hours', options: ['A and C','B and D','A and D','B and C'], correctIndex: 1 },
    { type: 'science_mc', question: 'What does "revolve" mean in science?', options: ['To spin in place','To orbit around another object','To stop moving','To change shape'], correctIndex: 1 },
    { type: 'science_mc', question: 'What does "rotation" mean?', options: ['Moving around the sun','Spinning around on an axis','Flying through space','Reflecting light'], correctIndex: 1 },
  ];
  return shuffle(pool).slice(0, QUESTIONS_PER_ROUND);
}

// ===================== SCIENCE: SPACE VOCABULARY =====================
function generateSpaceVocabQuestions() {
  const pool = [
    { type: 'science_mc', question: 'What is an "axis"?', options: ['A type of star','An imaginary line that something spins around','A planet','The moon\'s shadow'], correctIndex: 1 },
    { type: 'science_mc', question: 'What does "revolve" mean?', options: ['To spin in place on an axis','To orbit around another object','To glow brightly','To shrink in size'], correctIndex: 1 },
    { type: 'science_mc', question: 'What does "rotation" mean?', options: ['Moving around the sun','The spinning of an object on its axis','A type of star','The shape of the moon'], correctIndex: 1 },
    { type: 'science_mc', question: 'What is a "pattern" in science?', options: ['Something that happens only once','Something random','Something that repeats in a predictable way','A type of planet'], correctIndex: 2 },
    { type: 'science_mc', question: 'What does "shift" mean?', options: ['To stay in the same place','To move or change position','To become invisible','To grow larger'], correctIndex: 1 },
    { type: 'science_mc', question: 'What is a "constellation"?', options: ['A single star','A group of stars that form a pattern','A planet','The moon'], correctIndex: 1 },
    { type: 'science_mc', question: 'What is a "phase" of the moon?', options: ['How fast the moon moves','The different shapes the moon appears to have','The color of the moon','How close the moon is'], correctIndex: 1 },
    { type: 'science_mc', question: 'The Earth\'s axis runs from the _____ to the _____.', options: ['East to West','North Pole to South Pole','Sun to Moon','Ocean to Ocean'], correctIndex: 1 },
    { type: 'science_mc', question: 'Earth makes one full rotation every...', options: ['Week','24 hours (one day)','Month','Year'], correctIndex: 1 },
    { type: 'science_mc', question: 'Earth revolves around the sun once every...', options: ['Day','Week','Month','About 365 days (one year)'], correctIndex: 3 },
    { type: 'science_mc', question: 'The sun appears to move across the sky because of Earth\'s...', options: ['Revolution','Rotation','Moon phases','Constellations'], correctIndex: 1 },
    { type: 'science_mc', question: 'The moon completes its phase cycle about every...', options: ['7 days','29 days','365 days','24 hours'], correctIndex: 1 },
  ];
  return shuffle(pool).slice(0, QUESTIONS_PER_ROUND);
}

// ===================== RENDER QUESTIONS =====================
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
    case 'reading_mc': renderReadingMC(body, q); break;
    case 'readclock': renderReadClock(body, q); break;
    case 'elapsedtime': renderElapsedTime(body, q); break;
    case 'timeconvert_input': renderTimeConvert(body, q); break;
    case 'constellation': renderConstellation(body, q); break;
    case 'moon_visual': renderMoonVisual(body, q); break;
    case 'science_mc': renderScienceMC(body, q); break;
  }
}

// ---- RENDER NUMBER LINE ----
function renderNumberLine(body, q) {
  let slotsHTML = '';
  q.slots.forEach((s, i) => {
    const topContent = s.topBlank
      ? `<input class="nl-input" data-answer="${s.topVal}" data-pos="top-${i}" type="number" inputmode="numeric" placeholder="?">`
      : `<span class="nl-top-label">${s.topVal}</span>`;
    const bottomContent = s.bottomBlank
      ? `<input class="nl-input" data-answer="${s.bottomVal}" data-pos="bottom-${i}" type="number" inputmode="numeric" placeholder="?">`
      : `<span class="nl-bottom-label">${s.bottomVal}</span>`;
    slotsHTML += `<div class="nl-slot">${topContent}<div class="nl-tick"></div>${bottomContent}</div>`;
  });

  body.innerHTML = `
    <div class="question-card">
      <div class="question-text">Fill in the missing values on the number line!</div>
      <div class="question-hint">${q.topUnit} (top) → ${q.bottomUnit} (bottom)</div>
      <div class="numberline-container">
        <div class="numberline-labels"><span>${q.topUnit}</span></div>
        <div class="numberline-inputs" id="nl-inputs">${slotsHTML}</div>
        <div class="numberline-labels" style="margin-top:4px"><span>${q.bottomUnit}</span></div>
      </div>
    </div>`;
}

// ---- RENDER TOOLS ----
function renderTools(body, q) {
  const optionsHTML = q.options.map(o => `
    <div class="tool-option" data-tool="${o.id}" onclick="selectTool(this)">
      <div class="tool-emoji">${o.emoji}</div>
      <div class="tool-name">${o.name}</div>
    </div>`).join('');
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
    ticks += `<line x1="${x}" y1="50" x2="${x}" y2="72" stroke="#94a3b8" stroke-width="2"/>`;
    ticks += `<text x="${x}" y="90" fill="#64748b" font-size="14" font-family="Fredoka" text-anchor="middle">${i}</text>`;
    if (i < maxInch) {
      for (let e = 1; e < 8; e++) {
        const tx = pad + (i + e / 8) * pxPerInch;
        const h = e === 4 ? 16 : (e % 2 === 0 ? 12 : 8);
        ticks += `<line x1="${tx}" y1="50" x2="${tx}" y2="${50 + h}" stroke="#94a3b8" stroke-width="1"/>`;
      }
    }
  }

  const rulerBg = `<rect x="${pad}" y="30" width="${usable}" height="22" rx="3" fill="rgba(37,99,235,0.08)" stroke="rgba(37,99,235,0.2)" stroke-width="1"/>`;
  const segment = `<line x1="${pad}" y1="20" x2="${lineEndX}" y2="20" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/>`;
  const startDot = `<circle cx="${pad}" cy="20" r="4" fill="#ef4444"/>`;
  const endDot = `<circle cx="${lineEndX}" cy="20" r="4" fill="#ef4444"/>`;

  const optionsHTML = q.options.map((o, i) => {
    const letter = String.fromCharCode(65 + i);
    return `<button type="button" class="mc-option" data-value="${o.value}" onclick="selectMC(this)">
      <span class="mc-letter">${letter}</span>
      <span class="mc-text">${o.display} inches</span>
    </button>`;
  }).join('');

  body.innerHTML = `
    <div class="question-card">
      <div class="question-text">How long is the red line segment?</div>
      <div class="ruler-container">
        <svg class="ruler-svg" viewBox="0 0 ${svgWidth} 100">${rulerBg}${ticks}${segment}${startDot}${endDot}</svg>
      </div>
      <div class="mc-options">${optionsHTML}</div>
    </div>`;
}

function selectMC(el) {
  if (answered) return;
  document.querySelectorAll('.mc-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

// ---- DRAW ANALOG CLOCK ----
function drawAnalogClock(canvas, hours, minutes) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 6;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 3; ctx.stroke();

  ctx.font = `bold ${r * 0.22}px Fredoka, sans-serif`;
  ctx.fillStyle = '#1e293b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) {
    const a = (i * Math.PI / 6) - Math.PI / 2;
    ctx.fillText(i, cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
  }

  for (let i = 0; i < 60; i++) {
    const a = (i * Math.PI / 30) - Math.PI / 2;
    const major = i % 5 === 0;
    const inner = major ? r * 0.88 : r * 0.93;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97);
    ctx.strokeStyle = major ? '#475569' : '#cbd5e1'; ctx.lineWidth = major ? 2 : 1; ctx.stroke();
  }

  const ha = ((hours % 12 + minutes / 60) * Math.PI / 6) - Math.PI / 2;
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(ha) * r * 0.48, cy + Math.sin(ha) * r * 0.48);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke();

  const ma = (minutes * Math.PI / 30) - Math.PI / 2;
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(ma) * r * 0.68, cy + Math.sin(ma) * r * 0.68);
  ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 3; ctx.stroke();

  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#1e293b'; ctx.fill();
}

// ---- RENDER READ CLOCK ----
function renderReadClock(body, q) {
  const optionsHTML = q.options.map((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    return `<button type="button" class="mc-option" data-value="${i}" onclick="selectMC(this)">
      <span class="mc-letter">${letter}</span><span class="mc-text">${opt}</span></button>`;
  }).join('');
  body.innerHTML = `<div class="question-card"><div class="question-text">${q.question}</div>
    <div class="clock-wrap"><canvas id="clock-canvas" width="220" height="220"></canvas></div>
    <div class="mc-options">${optionsHTML}</div></div>`;
  drawAnalogClock(document.getElementById('clock-canvas'), q.hours, q.minutes);
}

// ---- RENDER ELAPSED TIME ----
function renderElapsedTime(body, q) {
  const optionsHTML = q.options.map((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    return `<button type="button" class="mc-option" data-value="${i}" onclick="selectMC(this)">
      <span class="mc-letter">${letter}</span><span class="mc-text">${opt}</span></button>`;
  }).join('');
  body.innerHTML = `<div class="question-card"><div class="question-text">${q.question}</div>
    <div class="elapsed-clocks">
      <div class="elapsed-clock-label">Start<canvas id="clock-start" width="150" height="150"></canvas></div>
      <div class="elapsed-arrow">➜</div>
      <div class="elapsed-clock-label">End<canvas id="clock-end" width="150" height="150"></canvas></div>
    </div>
    <div class="mc-options">${optionsHTML}</div></div>`;
  drawAnalogClock(document.getElementById('clock-start'), q.startH, q.startM);
  drawAnalogClock(document.getElementById('clock-end'), q.endH, q.endM);
}

// ---- RENDER TIME CONVERT ----
function renderTimeConvert(body, q) {
  body.innerHTML = `<div class="question-card"><div class="question-text">${q.question}</div>
    <div class="time-convert-visual">
      <span class="time-val">${q.given} ${q.givenUnit}</span>
      <span>=</span>
      <input type="number" inputmode="numeric" class="time-input" id="time-answer" placeholder="?">
      <span>${q.answerUnit}</span>
    </div></div>`;
  document.getElementById('time-answer').focus();
}

// ---- RENDER CONSTELLATION (interactive canvas) ----
function renderConstellation(body, q) {
  constellationState = { found: new Set(), canvas: null, distractors: [] };
  const distractors = [];
  for (let i = 0; i < 30; i++) {
    const dx = Math.random() * 96 + 2, dy = Math.random() * 96 + 2;
    if (!q.stars.some(s => Math.hypot(s.x - dx, s.y - dy) < 8)) {
      distractors.push({ x: dx, y: dy, sz: Math.random() * 1.5 + 0.5, a: Math.random() * 0.35 + 0.1 });
    }
  }
  constellationState.distractors = distractors;

  body.innerHTML = `
    <div class="question-card constellation-card">
      <div class="question-text">Find and connect the stars of <strong>${q.name}</strong>!</div>
      <div class="constellation-hint">🌟 ${q.fact}</div>
      <div class="constellation-progress">Stars found: <span id="const-found">0</span> / ${q.stars.length}</div>
      <div class="constellation-wrap">
        <canvas id="constellation-canvas" width="500" height="380"></canvas>
      </div>
    </div>`;

  const canvas = document.getElementById('constellation-canvas');
  constellationState.canvas = canvas;
  drawConstellationCanvas(canvas, q, distractors);

  canvas.addEventListener('click', (e) => handleConstellationClick(e, q, distractors));
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    handleConstellationClick({ clientX: t.clientX, clientY: t.clientY }, q, distractors);
  }, { passive: false });
}

function drawConstellationCanvas(canvas, q, distractors) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#070b24');
  grad.addColorStop(1, '#131940');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  distractors.forEach(d => {
    ctx.beginPath();
    ctx.arc(d.x / 100 * w, d.y / 100 * h, d.sz, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${d.a})`;
    ctx.fill();
  });

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 10;
  q.edges.forEach(([a, b]) => {
    if (constellationState.found.has(a) && constellationState.found.has(b)) {
      ctx.beginPath();
      ctx.moveTo(q.stars[a].x / 100 * w, q.stars[a].y / 100 * h);
      ctx.lineTo(q.stars[b].x / 100 * w, q.stars[b].y / 100 * h);
      ctx.stroke();
    }
  });
  ctx.shadowBlur = 0;

  q.stars.forEach((s, i) => {
    const sx = s.x / 100 * w, sy = s.y / 100 * h;
    const found = constellationState.found.has(i);
    if (found) {
      ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251,191,36,0.25)'; ctx.fill();
      ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24'; ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(226,232,240,0.12)'; ctx.fill();
      ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#e2e8f0'; ctx.fill();
    }
  });
}

function handleConstellationClick(e, q, distractors) {
  if (answered) return;
  const canvas = constellationState.canvas;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX, my = (e.clientY - rect.top) * scaleY;

  for (let i = 0; i < q.stars.length; i++) {
    const sx = q.stars[i].x / 100 * canvas.width, sy = q.stars[i].y / 100 * canvas.height;
    if (Math.hypot(mx - sx, my - sy) < 22) {
      if (!constellationState.found.has(i)) {
        constellationState.found.add(i);
        document.getElementById('const-found').textContent = constellationState.found.size;
        drawConstellationCanvas(canvas, q, distractors);
        if (constellationState.found.size === q.stars.length) {
          answered = true;
          score++;
          document.getElementById('current-score').textContent = score;
          showFeedback(true);
          document.getElementById('next-btn').classList.remove('hidden');
        }
      }
      return;
    }
  }
}

// ---- RENDER MOON VISUAL ----
function drawMoonOnCanvas(canvas, phaseKey) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 8;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 25; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, Math.random() + 0.3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.3 + 0.1})`;
    ctx.fill();
  }

  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#1e293b'; ctx.fill();
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.stroke();

  if (phaseKey === 'new-moon') return;

  const litColor = '#fef9c3';
  if (phaseKey === 'full-moon') {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = litColor; ctx.fill();
    ctx.fillStyle = 'rgba(200,190,150,0.25)';
    ctx.beginPath(); ctx.arc(cx - r * 0.2, cy - r * 0.1, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.25, cy + r * 0.3, r * 0.08, 0, Math.PI * 2); ctx.fill();
    return;
  }

  const map = {
    'waxing-crescent': [0.25, 'right'], 'first-quarter': [0.5, 'right'],
    'waxing-gibbous': [0.75, 'right'], 'waning-gibbous': [0.75, 'left'],
    'last-quarter': [0.5, 'left'], 'waning-crescent': [0.25, 'left']
  };
  const [illum, side] = map[phaseKey] || [0, 'right'];

  ctx.fillStyle = litColor;
  ctx.beginPath();
  if (side === 'right') {
    ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
    if (illum === 0.5) { ctx.lineTo(cx, cy - r); }
    else if (illum < 0.5) { ctx.quadraticCurveTo(cx + r * (1 - 2 * illum), cy, cx, cy - r); }
    else { ctx.quadraticCurveTo(cx - r * (2 * illum - 1), cy, cx, cy - r); }
  } else {
    ctx.arc(cx, cy, r, Math.PI / 2, -Math.PI / 2, false);
    if (illum === 0.5) { ctx.lineTo(cx, cy + r); }
    else if (illum < 0.5) { ctx.quadraticCurveTo(cx - r * (1 - 2 * illum), cy, cx, cy + r); }
    else { ctx.quadraticCurveTo(cx + r * (2 * illum - 1), cy, cx, cy + r); }
  }
  ctx.closePath();
  ctx.fill();
}

function renderMoonVisual(body, q) {
  const optionsHTML = q.options.map((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    return `<button type="button" class="mc-option" data-value="${i}" onclick="selectMC(this)">
      <span class="mc-letter">${letter}</span>
      <span class="mc-text">${opt}</span>
    </button>`;
  }).join('');

  body.innerHTML = `
    <div class="question-card">
      <div class="question-text">${q.question}</div>
      <div class="moon-canvas-wrap">
        <canvas id="moon-canvas" width="180" height="180"></canvas>
      </div>
      <div class="mc-options">${optionsHTML}</div>
    </div>`;

  drawMoonOnCanvas(document.getElementById('moon-canvas'), q.phaseKey);
}

// ---- RENDER SCIENCE MC ----
function renderScienceMC(body, q) {
  const optionsHTML = q.options.map((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    return `<button type="button" class="mc-option" data-value="${i}" onclick="selectMC(this)">
      <span class="mc-letter">${letter}</span>
      <span class="mc-text">${opt}</span>
    </button>`;
  }).join('');

  body.innerHTML = `
    <div class="question-card">
      <div class="question-text">${q.question}</div>
      <div class="mc-options">${optionsHTML}</div>
    </div>`;
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

// ---- RENDER READING MC ----
function renderReadingMC(body, q) {
  const passageBtnHTML = q.source && PASSAGES[q.source]
    ? `<button type="button" class="read-passage-btn" onclick="openPassageModal('${q.source}')">
        <span class="btn-icon">📖</span> Read the Passage — ${PASSAGES[q.source].title}
      </button>`
    : '';

  const optionsHTML = q.options.map((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    return `<button type="button" class="mc-option" data-value="${i}" onclick="selectMC(this)">
      <span class="mc-letter">${letter}</span>
      <span class="mc-text">${opt}</span>
    </button>`;
  }).join('');

  body.innerHTML = `
    <div class="question-card">
      <div class="question-text">${q.question}</div>
      ${passageBtnHTML}
      <div class="mc-options">${optionsHTML}</div>
    </div>`;
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
    case 'reading_mc': correct = checkReadingMC(q); break;
    case 'readclock':
    case 'elapsedtime': correct = checkScienceMC(q); break;
    case 'timeconvert_input': correct = checkTimeConvert(q); break;
    case 'constellation': correct = checkConstellation(q); break;
    case 'moon_visual':
    case 'science_mc': correct = checkScienceMC(q); break;
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
      allCorrect = false;
      setTimeout(() => { inp.value = answer; inp.classList.remove('wrong'); inp.classList.add('correct'); }, 1500);
    }
    inp.disabled = true;
  });
  return allCorrect;
}

function checkTools(q) {
  const selected = document.querySelector('.tool-option.selected');
  if (!selected) { answered = false; return false; }
  const isCorrect = selected.dataset.tool === q.answer;
  document.querySelectorAll('.tool-option').forEach(o => {
    if (o.dataset.tool === q.answer) o.classList.add('correct-answer');
    else if (o === selected && !isCorrect) o.classList.add('wrong-answer');
    o.style.pointerEvents = 'none';
  });
  return isCorrect;
}

function checkRulerAnswer(q) {
  const selected = document.querySelector('.mc-option.selected');
  if (!selected) { answered = false; return false; }
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
    setTimeout(() => { inp.value = q.toVal; inp.classList.remove('wrong'); inp.classList.add('correct'); }, 1500);
  }
  inp.disabled = true;
  return isCorrect;
}

function checkReadingMC(q) {
  const selected = document.querySelector('.mc-option.selected');
  if (!selected) { answered = false; return false; }
  const selectedIdx = parseInt(selected.dataset.value);
  const isCorrect = selectedIdx === q.correctIndex;
  document.querySelectorAll('.mc-option').forEach((o, i) => {
    const idx = parseInt(o.dataset.value);
    if (idx === q.correctIndex) o.classList.add('correct-answer');
    else if (o === selected && !isCorrect) o.classList.add('wrong-answer');
    o.style.pointerEvents = 'none';
  });
  return isCorrect;
}

function checkScienceMC(q) {
  const selected = document.querySelector('.mc-option.selected');
  if (!selected) { answered = false; return false; }
  const selectedIdx = parseInt(selected.dataset.value);
  const isCorrect = selectedIdx === q.correctIndex;
  document.querySelectorAll('.mc-option').forEach(o => {
    const idx = parseInt(o.dataset.value);
    if (idx === q.correctIndex) o.classList.add('correct-answer');
    else if (o === selected && !isCorrect) o.classList.add('wrong-answer');
    o.style.pointerEvents = 'none';
  });
  return isCorrect;
}

function checkTimeConvert(q) {
  const el = document.getElementById('time-answer');
  if (!el) return false;
  const val = parseInt(el.value);
  const ok = val === q.answer;
  el.classList.add(ok ? 'correct' : 'wrong');
  if (!ok) {
    const hint = document.createElement('div');
    hint.style.cssText = 'text-align:center;margin-top:8px;font-family:Fredoka,sans-serif;color:#dc2626;font-weight:600';
    hint.textContent = `Answer: ${q.answer} ${q.answerUnit}`;
    el.parentElement.appendChild(hint);
  }
  return ok;
}

function checkConstellation(q) {
  const allFound = constellationState.found.size === q.stars.length;
  if (!allFound) {
    q.stars.forEach((_, i) => constellationState.found.add(i));
    const canvas = constellationState.canvas;
    if (canvas) drawConstellationCanvas(canvas, q, constellationState.distractors);
  }
  return allFound;
}

// ===================== NEXT / RESULTS =====================
function nextQuestion() {
  currentQ++;
  if (currentQ >= QUESTIONS_PER_ROUND) showResults();
  else renderQuestion();
}

function showResults() {
  const subject = getSubjectForGame(currentGame);
  const prev = bestScores[subject][currentGame] || 0;
  if (score > prev) bestScores[subject][currentGame] = score;
  localStorage.setItem('bryceLearning', JSON.stringify(bestScores));

  const pct = score / QUESTIONS_PER_ROUND;
  let emoji, title;
  if (pct === 1) { emoji = '🏆'; title = 'PERFECT SCORE!'; }
  else if (pct >= 0.8) { emoji = '🎉'; title = 'Awesome Job!'; }
  else if (pct >= 0.6) { emoji = '👍'; title = 'Nice Work!'; }
  else if (pct >= 0.4) { emoji = '💪'; title = 'Keep Practicing!'; }
  else { emoji = '📚'; title = "Let's Try Again!"; }

  document.getElementById('results-emoji').textContent = emoji;
  document.getElementById('results-title').textContent = title;
  document.getElementById('results-score').textContent = `You got ${score} out of ${QUESTIONS_PER_ROUND} correct!`;
  document.getElementById('results-stars').textContent = '⭐'.repeat(score) + '☆'.repeat(QUESTIONS_PER_ROUND - score);

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
  content.offsetHeight;
  content.style.animation = 'popIn 0.5s ease';
  setTimeout(() => overlay.classList.add('hidden'), 1200);
}

// ===================== CONFETTI =====================
function launchConfetti() {
  const colors = ['#2563eb','#16a34a','#ea580c','#f59e0b','#ef4444','#8b5cf6','#ec4899','#22c55e'];
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
  const colors = ['#22c55e', '#f59e0b', '#2563eb'];
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

// ===================== KEYBOARD SHORTCUT =====================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const checkBtn = document.getElementById('check-btn');
    const nextBtn = document.getElementById('next-btn');
    if (checkBtn && !checkBtn.classList.contains('hidden')) checkAnswer();
    else if (nextBtn && !nextBtn.classList.contains('hidden')) nextQuestion();
  }
});

// ===================== BOSS BATTLE =====================
const BOSS_MAX_HP = 100;
const BOSS_TOTAL_ROUNDS = 10;
const BOSS_PLAYER_HEARTS = 5;

let bossState = null;

function startBoss() {
  const bossSubject = currentSubject === 'math' ? (currentMathUnit === '15.7' ? 'math157' : 'math') : currentSubject;
  if (!isBossUnlocked(bossSubject)) return;

  const bossQs = { math: generateMathBossQuestions, math157: generateTimeBossQuestions, reading: generateReadingBossQuestions, science: generateScienceBossQuestions };
  bossState = {
    subject: bossSubject,
    hp: BOSS_MAX_HP,
    hearts: BOSS_PLAYER_HEARTS,
    combo: 0,
    maxCombo: 0,
    round: 0,
    totalCorrect: 0,
    questions: (bossQs[bossSubject] || bossQs.math)(),
    answering: false
  };

  const bossConfig = {
    math:    { name: 'Measurement Dragon', sprite: '🐉' },
    math157: { name: 'The Time Titan', sprite: '⏰' },
    reading: { name: 'The Vocabulary Villain', sprite: '📕' },
    science: { name: 'The Cosmic Commander', sprite: '🛸' }
  };
  const bc = bossConfig[bossSubject] || bossConfig.math;
  document.getElementById('boss-monster-name').textContent = bc.name;
  document.getElementById('boss-monster-sprite').textContent = bc.sprite;

  showScreen('boss-screen');
  renderBossHud();
  renderBossMonster();
  nextBossRound();
}

function generateTimeBossQuestions() {
  const pool = [
    { text: 'How many minutes are in 4 hours?', answer: '240', options: shuffle(['200', '240', '280', '320']) },
    { text: 'How many seconds are in 3 minutes?', answer: '180', options: shuffle(['150', '160', '180', '200']) },
    { text: 'A movie starts at 1:30 p.m. and ends at 3:45 p.m. How long is the movie?', answer: '2 hr 15 min', options: shuffle(['2 hr 15 min', '2 hr 30 min', '1 hr 45 min', '2 hr 45 min']) },
    { text: 'Convert 180 minutes to hours.', answer: '3 hours', options: shuffle(['2 hours', '2.5 hours', '3 hours', '4 hours']) },
    { text: 'Helen worked from 10:20 a.m. to 2:15 p.m. How many minutes?', answer: '235', options: shuffle(['195', '215', '235', '255']) },
    { text: 'How many minutes are in 5½ hours?', answer: '330', options: shuffle(['300', '310', '330', '350']) },
    { text: 'A concert lasts from 12:15 p.m. to 2:45 p.m. How long is it in minutes?', answer: '150', options: shuffle(['130', '140', '150', '160']) },
    { text: 'Jess swam 200 yards in 7 minutes. How many seconds is 7 minutes?', answer: '420', options: shuffle(['400', '420', '440', '700']) },
    { text: '30 hours = how many minutes?', answer: '1800', options: shuffle(['1200', '1500', '1800', '2100']) },
    { text: 'A class lasts 1½ hours. How many minutes is that?', answer: '90', options: shuffle(['75', '80', '85', '90']) },
    { text: 'School starts at 8:15 a.m. and ends at 2:45 p.m. How many hours and minutes?', answer: '6 hr 30 min', options: shuffle(['5 hr 30 min', '6 hr 30 min', '6 hr', '7 hr']) },
    { text: 'If you practice piano 30 min/day for 5 days, how many hours is that?', answer: '2½ hours', options: shuffle(['1½ hours', '2 hours', '2½ hours', '3 hours']) },
    { text: 'A movie ends at 2:24 p.m. It lasted 2 hr 8 min. What time did it start?', answer: '12:16 p.m.', options: shuffle(['12:08 p.m.', '12:16 p.m.', '12:24 p.m.', '11:56 a.m.']) },
    { text: 'How many minutes is 420 seconds?', answer: '7', options: shuffle(['6', '7', '8', '9']) },
    { text: 'Henry walks a lap in 12 min. How many laps in 1 hour?', answer: '5', options: shuffle(['4', '5', '6', '8']) },
  ];
  return shuffle(pool);
}

function generateMathBossQuestions() {
  const qs = [];
  const convPairs = shuffle([
    { from: 'feet', to: 'inches', f: 12 },
    { from: 'yards', to: 'feet', f: 3 },
    { from: 'meters', to: 'centimeters', f: 100 },
    { from: 'gallons', to: 'quarts', f: 4 },
    { from: 'pounds', to: 'ounces', f: 16 },
    { from: 'hours', to: 'minutes', f: 60 },
    { from: 'minutes', to: 'seconds', f: 60 },
    { from: 'pints', to: 'cups', f: 2 },
    { from: 'weeks', to: 'days', f: 7 },
    { from: 'days', to: 'hours', f: 24 },
  ]);
  for (let i = 0; i < 5; i++) {
    const p = convPairs[i % convPairs.length];
    const n = Math.floor(Math.random() * 7) + 2;
    const answer = n * p.f;
    const wrongs = new Set();
    while (wrongs.size < 3) {
      const off = (Math.floor(Math.random() * 5) + 1) * p.f * (Math.random() < 0.5 ? 1 : -1);
      const w = answer + off;
      if (w > 0 && w !== answer) wrongs.add(w);
    }
    qs.push({ text: `${n} ${p.from} = ? ${p.to}`, answer: String(answer), options: shuffle([String(answer), ...[...wrongs].map(String)]) });
  }
  const toolQs = shuffle([
    { q: 'Which tool measures weight?', a: 'Scale', wrong: ['Ruler', 'Thermometer', 'Beaker'] },
    { q: 'Which tool measures temperature?', a: 'Thermometer', wrong: ['Scale', 'Ruler', 'Measuring Cup'] },
    { q: 'Which tool measures length?', a: 'Ruler', wrong: ['Scale', 'Thermometer', 'Dropper'] },
    { q: 'Which tool measures liquid volume?', a: 'Measuring Cup', wrong: ['Thermometer', 'Ruler', 'Scale'] },
    { q: 'Which tool gives tiny amounts of liquid?', a: 'Dropper', wrong: ['Beaker', 'Ruler', 'Scale'] },
  ]);
  for (let i = 0; i < 3; i++) {
    const t = toolQs[i];
    qs.push({ text: t.q, answer: t.a, options: shuffle([t.a, ...t.wrong]) });
  }
  const compQs = shuffle([
    { q: 'Which is longer?', a: '1 yard', wrong: ['2 feet', '30 inches', '1 meter'] },
    { q: 'Which is heavier?', a: '2 pounds', wrong: ['20 ounces', '1 pound', '24 ounces'] },
    { q: 'Which takes longer?', a: '2 hours', wrong: ['100 minutes', '90 minutes', '1 hour'] },
  ]);
  for (let i = 0; i < 2; i++) {
    const c = compQs[i];
    qs.push({ text: c.q, answer: c.a, options: shuffle([c.a, ...c.wrong.slice(0, 3)]) });
  }
  return shuffle(qs).slice(0, BOSS_TOTAL_ROUNDS);
}

function generateReadingBossQuestions() {
  const qs = shuffle([
    { text: 'What does "magnify" mean?', source: 'vocabulary', answer: 'Make appear larger', options: shuffle(['Make appear larger', 'Make smaller', 'Dissolve', 'Freeze']) },
    { text: 'What does "dissolves" mean?', source: 'vocabulary', answer: 'Breaks apart in liquid', options: shuffle(['Breaks apart in liquid', 'Gets bigger', 'Freezes solid', 'Changes color']) },
    { text: 'What does "cling" mean?', source: 'vocabulary', answer: 'Hold on tightly', options: shuffle(['Hold on tightly', 'Fall away', 'Spin around', 'Disappear']) },
    { text: 'What is an antonym of "humid"?', source: 'vocabulary', answer: 'Dry', options: shuffle(['Dry', 'Wet', 'Moist', 'Warm']) },
    { text: 'What does "typical" mean?', source: 'vocabulary', answer: 'Normal or usual', options: shuffle(['Normal or usual', 'Strange', 'Tiny', 'Fast']) },
    { text: 'When did photomicrography begin?', source: 'your-world-up-close', answer: '1840', options: shuffle(['1840', '1852', '1882', '1920']) },
    { text: 'Who first photographed snowflakes?', source: 'your-world-up-close', answer: 'Wilson Bentley', options: shuffle(['Wilson Bentley', 'Alfred Donné', 'A German pharmacist', 'Albert Einstein']) },
    { text: 'Snowflakes are shaped like...', source: 'your-world-up-close', answer: 'Hexagons', options: shuffle(['Hexagons', 'Circles', 'Squares', 'Triangles']) },
    { text: 'An expository text gives...', source: 'your-world-up-close', answer: 'Facts and information', options: shuffle(['Facts and information', 'Made-up stories', 'Only poems', 'Only pictures']) },
    { text: 'What is a caption?', source: 'your-world-up-close', answer: 'Words explaining a photo', options: shuffle(['Words explaining a photo', 'The book title', 'A chapter name', 'Bold text']) },
    { text: 'What does "gritty" mean?', source: 'vocabulary', answer: 'Rough with particles', options: shuffle(['Rough with particles', 'Smooth', 'Very cold', 'Bright']) },
    { text: 'Captions help readers by...', source: 'your-world-up-close', answer: 'Explaining photographs', options: shuffle(['Explaining photographs', 'Making text longer', 'Replacing text', 'Adding fiction']) },
    { text: '"Micro" in photomicrograph means...', source: 'your-world-up-close', answer: 'Small', options: shuffle(['Small', 'Large', 'Fast', 'Old']) },
    { text: 'Electron microscopes can magnify up to...', source: 'your-world-up-close', answer: '2 million times', options: shuffle(['2 million times', '100 times', '1,000 times', '10 times']) },
    { text: 'Why did Hector make the shrinking potion?', source: 'the-incredible-shrinking-potion', answer: 'To become popular', options: shuffle(['To become popular', 'To help his teacher', 'To feed Rambo', 'To clean the lab']) },
  ]);
  return qs.slice(0, BOSS_TOTAL_ROUNDS);
}

function generateScienceBossQuestions() {
  const qs = shuffle([
    { text: 'What causes day and night?', answer: "Earth's rotation", options: shuffle(["Earth's rotation", "Sun's movement", "Moon's orbit", "Wind patterns"]) },
    { text: 'How long is one full rotation of Earth?', answer: '24 hours', options: shuffle(['24 hours', '365 days', '7 days', '12 hours']) },
    { text: 'Earth revolves around the sun in about...', answer: '365 days', options: shuffle(['365 days', '24 hours', '30 days', '7 days']) },
    { text: 'What is the axis?', answer: 'Line from pole to pole', options: shuffle(['Line from pole to pole', 'The equator', 'A type of star', 'The orbit path']) },
    { text: 'The sun rises in the...', answer: 'East', options: shuffle(['East', 'West', 'North', 'South']) },
    { text: 'How long is the moon phase cycle?', answer: 'About 29 days', options: shuffle(['About 29 days', '7 days', '365 days', '24 hours']) },
    { text: 'What phase comes after Full Moon?', answer: 'Waning Gibbous', options: shuffle(['Waning Gibbous', 'Waxing Crescent', 'New Moon', 'First Quarter']) },
    { text: 'What phase is a big, bright circle?', answer: 'Full Moon', options: shuffle(['Full Moon', 'New Moon', 'Crescent', 'Quarter']) },
    { text: 'Constellations are...', answer: 'Star patterns', options: shuffle(['Star patterns', 'Single bright stars', 'Planets', 'Moon phases']) },
    { text: 'What does "revolve" mean?', answer: 'Orbit around something', options: shuffle(['Orbit around something', 'Spin in place', 'Disappear', 'Shrink']) },
    { text: '"Rotation" means...', answer: 'Spinning on an axis', options: shuffle(['Spinning on an axis', 'Orbiting the sun', 'A type of star', 'Getting bigger']) },
    { text: 'What is a pattern?', answer: 'Something that repeats', options: shuffle(['Something that repeats', 'Something random', 'A single event', 'A color']) },
    { text: 'Can you see the New Moon?', answer: 'No, not visible', options: shuffle(['No, not visible', 'Yes, very bright', 'Only at noon', 'Half lit']) },
    { text: 'The Big Dipper is a...', answer: 'Constellation', options: shuffle(['Constellation', 'Planet', 'Moon phase', 'Type of star']) },
    { text: 'Does the sun actually move across our sky?', answer: 'No, Earth rotates', options: shuffle(['No, Earth rotates', 'Yes, it orbits Earth', 'Yes, it spins', 'The moon pushes it']) },
  ]);
  return qs.slice(0, BOSS_TOTAL_ROUNDS);
}

function renderBossHud() {
  const heartsEl = document.getElementById('boss-hearts');
  heartsEl.innerHTML = '';
  for (let i = 0; i < BOSS_PLAYER_HEARTS; i++) {
    heartsEl.innerHTML += i < bossState.hearts ? '❤️' : '🖤';
  }
  updateBossCombo();
}

function updateBossCombo() {
  const el = document.getElementById('boss-combo');
  if (bossState.combo >= 3) {
    el.textContent = `🔥 x${bossState.combo}!`;
    el.className = 'boss-combo fire';
  } else if (bossState.combo >= 2) {
    el.textContent = `⚡ x${bossState.combo}`;
    el.className = 'boss-combo';
  } else {
    el.textContent = '';
    el.className = 'boss-combo';
  }
}

function renderBossMonster() {
  const hpPct = bossState.hp / BOSS_MAX_HP * 100;
  document.getElementById('boss-hp-bar').style.width = hpPct + '%';
  document.getElementById('boss-hp-text').textContent = `${bossState.hp} / ${BOSS_MAX_HP}`;
  const monster = document.getElementById('boss-monster');
  monster.classList.remove('low-hp');
  if (hpPct <= 30 && hpPct > 0) monster.classList.add('low-hp');
}

function nextBossRound() {
  if (bossState.round >= BOSS_TOTAL_ROUNDS || bossState.hp <= 0) { bossVictory(); return; }
  if (bossState.hearts <= 0) { bossDefeat(); return; }

  bossState.answering = true;
  const q = bossState.questions[bossState.round];
  const passageBtn = q.source && PASSAGES[q.source]
    ? `<button type="button" class="read-passage-btn" style="margin:8px auto 4px;font-size:0.85rem;padding:7px 14px" onclick="openPassageModal('${q.source}')"><span class="btn-icon">📖</span> Read the Passage</button>`
    : '';
  document.getElementById('boss-q-text').innerHTML = q.text + passageBtn;
  document.getElementById('boss-options').innerHTML = q.options.map((o, i) =>
    `<button class="boss-option" onclick="bossAnswer(${i})" data-idx="${i}">${o}</button>`
  ).join('');
}

function bossAnswer(idx) {
  if (!bossState.answering) return;
  bossState.answering = false;
  const q = bossState.questions[bossState.round];
  const selected = q.options[idx];
  const correct = selected === q.answer;
  const buttons = document.querySelectorAll('.boss-option');

  buttons.forEach((btn, i) => {
    btn.classList.add('disabled');
    if (q.options[i] === q.answer) btn.classList.add('correct');
    if (i === idx && !correct) btn.classList.add('wrong');
  });

  if (correct) {
    bossState.combo++;
    if (bossState.combo > bossState.maxCombo) bossState.maxCombo = bossState.combo;
    bossState.totalCorrect++;
    const dmg = 10;
    bossState.hp = Math.max(0, bossState.hp - dmg);
    showDamageFloat(`-${dmg} HP`, 'hit');
    const monster = document.getElementById('boss-monster');
    monster.classList.remove('hit');
    void monster.offsetWidth;
    monster.classList.add('hit');
    renderBossMonster();
    updateBossCombo();
    if (bossState.combo >= 3) launchMiniConfetti();
  } else {
    bossState.combo = 0;
    bossState.hearts--;
    showDamageFloat('MISS!', 'miss');
    const arena = document.querySelector('.boss-arena');
    arena.classList.remove('player-hit');
    void arena.offsetWidth;
    arena.classList.add('player-hit');
    renderBossHud();
  }

  bossState.round++;
  setTimeout(() => {
    if (bossState.hp <= 0) {
      const monster = document.getElementById('boss-monster');
      monster.classList.add('defeated');
      setTimeout(() => bossVictory(), 1200);
    } else if (bossState.hearts <= 0) {
      bossDefeat();
    } else if (bossState.round >= BOSS_TOTAL_ROUNDS) {
      bossDefeat();
    } else {
      nextBossRound();
    }
  }, 800);
}

function showDamageFloat(text, type) {
  const container = document.getElementById('boss-damage-float');
  const el = document.createElement('div');
  el.className = `damage-number ${type}`;
  el.textContent = text;
  el.style.left = (Math.random() * 40 - 20) + 'px';
  container.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function bossVictory() {
  const bossNames = { math: 'the Measurement Dragon', math157: 'the Time Titan', reading: 'the Vocabulary Villain', science: 'the Cosmic Commander' };
  const bossName = bossNames[bossState.subject] || 'the Boss';
  launchConfetti();
  document.getElementById('boss-victory-title').textContent = 'VICTORY!';
  document.getElementById('boss-victory-sub').textContent = `You defeated ${bossName}!`;
  document.getElementById('boss-victory-emoji').textContent = '⚔️';
  document.getElementById('boss-victory-stats').innerHTML = `
    Correct: ${bossState.totalCorrect} / ${BOSS_TOTAL_ROUNDS}<br>
    Max Combo: 🔥 x${bossState.maxCombo}<br>
    Hearts Left: ${'❤️'.repeat(bossState.hearts)}${'🖤'.repeat(BOSS_PLAYER_HEARTS - bossState.hearts)}
  `;
  showScreen('boss-victory-screen');
  setTimeout(launchConfetti, 800);
}

function bossDefeat() {
  const defeatNames = { math: 'The dragon', math157: 'The Time Titan', reading: 'The villain', science: 'The commander' };
  const bossName = defeatNames[bossState.subject] || 'The boss';
  document.getElementById('boss-victory-title').textContent = 'DEFEATED...';
  document.getElementById('boss-victory-sub').textContent = `${bossName} was too strong this time!`;
  document.getElementById('boss-victory-emoji').textContent = '💔';
  document.getElementById('boss-victory-stats').innerHTML = `
    You dealt ${BOSS_MAX_HP - bossState.hp} damage<br>
    HP remaining: ${bossState.hp} / ${BOSS_MAX_HP}<br>
    Keep practicing and try again!
  `;
  showScreen('boss-victory-screen');
}

// ===================== PARENT MENU =====================
function showParentMenu() {
  const code = prompt('Enter parent passcode:');
  if (code !== PARENT_PASSCODE) return;

  const choice = prompt(
    'Parent Menu\n\n' +
    '1 - Reset all stars (all subjects)\n' +
    '2 - Unlock Boss Battle (' + currentSubject + ')\n' +
    '3 - Lock Boss Battle (' + currentSubject + ')\n\n' +
    'Enter 1, 2, or 3:'
  );

  if (choice === '1') {
    bestScores = { math: {}, reading: {}, science: {} };
    localStorage.setItem('bryceLearning', JSON.stringify(bestScores));
    bossForceUnlocked = { math: false, math157: false, reading: false, science: false };
    localStorage.setItem('bossForceUnlocked', JSON.stringify(bossForceUnlocked));
    updateAllStars();
    updateBossCards();
    alert('All stars have been reset!');
  } else if (choice === '2') {
    const unlockKey = currentSubject === 'math' && currentMathUnit === '15.7' ? 'math157' : currentSubject;
    bossForceUnlocked[unlockKey] = true;
    localStorage.setItem('bossForceUnlocked', JSON.stringify(bossForceUnlocked));
    updateBossCards();
    alert('Boss Battle unlocked!');
  } else if (choice === '3') {
    const lockKey = currentSubject === 'math' && currentMathUnit === '15.7' ? 'math157' : currentSubject;
    bossForceUnlocked[lockKey] = false;
    localStorage.setItem('bossForceUnlocked', JSON.stringify(bossForceUnlocked));
    updateBossCards();
    alert('Boss Battle locked. Stars required again.');
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
