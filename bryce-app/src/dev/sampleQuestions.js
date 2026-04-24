/**
 * Developer sample questions – one example for every question type and variant.
 * Used by DevPreviewScreen to let you launch any question type directly in the
 * browser without needing a real scan / Supabase unit.
 */

// ─────────────────────────────────────────────────────────────
// MULTIPLE CHOICE
// ─────────────────────────────────────────────────────────────
const multiplChoice_basic = {
  id: 'mc_basic',
  label: 'Multiple Choice – Basic',
  unit: {
    title: 'Multiple Choice – Basic',
    subject: 'math',
    questions: [
      {
        type: 'multiple_choice',
        question: 'What is 7 × 8?',
        options: ['54', '56', '58', '64'],
        correctIndex: 1,
      },
      {
        type: 'multiple_choice',
        question: 'Which planet is closest to the Sun?',
        options: ['Venus', 'Earth', 'Mercury', 'Mars'],
        correctIndex: 2,
        hint: 'Think about the order of the planets starting from the Sun.',
      },
      {
        type: 'multiple_choice',
        question: 'What is the square root of 144?',
        options: ['10', '11', '12', '13'],
        correctIndex: 2,
      },
    ],
  },
};

const multipleChoice_withContext = {
  id: 'mc_context',
  label: 'Multiple Choice – With Context Card',
  unit: {
    title: 'MC with Context',
    subject: 'math',
    questions: [
      {
        type: 'multiple_choice',
        question: 'Based on the table, how many apples were sold on Wednesday?',
        context: {
          type: 'table',
          title: 'Fruit Sales',
          columns: ['Day', 'Apples', 'Oranges'],
          rows: [
            ['Monday', '14', '8'],
            ['Tuesday', '20', '12'],
            ['Wednesday', '17', '9'],
            ['Thursday', '11', '15'],
          ],
        },
        options: ['14', '17', '20', '11'],
        correctIndex: 1,
      },
    ],
  },
};

const multipleChoice_withImage = {
  id: 'mc_image',
  label: 'Multiple Choice – With Image URL',
  unit: {
    title: 'MC with Image',
    subject: 'science',
    questions: [
      {
        type: 'multiple_choice',
        question: 'What type of triangle is shown?',
        image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/IsoscelesTriangle.svg/320px-IsoscelesTriangle.svg.png',
        options: ['Scalene', 'Isosceles', 'Equilateral', 'Right'],
        correctIndex: 1,
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// VISUAL MC
// ─────────────────────────────────────────────────────────────
const visualMC = {
  id: 'visual_mc',
  label: 'Visual MC',
  unit: {
    title: 'Visual Multiple Choice',
    subject: 'math',
    questions: [
      {
        type: 'visual_mc',
        question: 'Which shape has exactly 6 sides?',
        options: ['Triangle', 'Square', 'Pentagon', 'Hexagon'],
        correctIndex: 3,
        hint: 'Hex = 6.',
      },
      {
        type: 'visual_mc',
        question: 'What fraction of the pie is shaded?',
        geometry: { type: 'pie', slices: [{ fraction: 0.25, color: '#4ade80', label: 'Shaded' }, { fraction: 0.75, color: '#e2e8f0' }] },
        options: ['1/2', '1/4', '3/4', '1/3'],
        correctIndex: 1,
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// FILL IN
// ─────────────────────────────────────────────────────────────
const fillIn_basic = {
  id: 'fill_in_basic',
  label: 'Fill-In – Basic',
  unit: {
    title: 'Fill-In Basic',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        question: 'What is 12 ÷ 4?',
        correctAnswer: '3',
      },
      {
        type: 'fill_in',
        question: 'The capital of France is ___.',
        correctAnswer: 'Paris',
        acceptedAnswers: ['paris', 'paris, france'],
        hint: 'It starts with the letter P.',
      },
      {
        type: 'fill_in',
        question: 'How many centimeters are in a meter?',
        correctAnswer: '100',
        acceptedAnswers: ['100 cm', '100cm'],
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// TRUE / FALSE
// ─────────────────────────────────────────────────────────────
const trueFalse = {
  id: 'true_false',
  label: 'True / False',
  unit: {
    title: 'True or False',
    subject: 'science',
    questions: [
      {
        type: 'true_false',
        question: 'The Sun is a star.',
        correctAnswer: true,
      },
      {
        type: 'true_false',
        question: 'Spiders are insects.',
        correctAnswer: false,
        hint: 'Count the legs: insects have 6, spiders have 8.',
      },
      {
        type: 'true_false',
        question: 'Water freezes at 100°C.',
        correctAnswer: false,
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// WORD BANK
// ─────────────────────────────────────────────────────────────
const wordBank = {
  id: 'word_bank',
  label: 'Word Bank',
  unit: {
    title: 'Word Bank',
    subject: 'english',
    questions: [
      {
        type: 'word_bank',
        question: 'The cat sat on the ____.',
        wordBank: ['mat', 'hat', 'log', 'sky'],
        correctAnswer: 'mat',
      },
      {
        type: 'word_bank',
        question: 'The ____ is the largest planet in our solar system.',
        wordBank: ['Mars', 'Saturn', 'Jupiter', 'Neptune'],
        correctAnswer: 'Jupiter',
      },
      {
        type: 'word_bank',
        question: 'Water is made of hydrogen and ____.',
        wordBank: ['carbon', 'oxygen', 'nitrogen', 'helium'],
        correctAnswer: 'oxygen',
        hint: 'H₂O — the O stands for something.',
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// ORDERING
// ─────────────────────────────────────────────────────────────
const ordering = {
  id: 'ordering',
  label: 'Ordering',
  unit: {
    title: 'Ordering',
    subject: 'math',
    questions: [
      {
        type: 'ordering',
        question: 'Put these numbers in order from smallest to largest.',
        items: ['42', '7', '19', '3'],
        correctOrder: [3, 1, 2, 0],
      },
      {
        type: 'ordering',
        question: 'Order the planets from closest to farthest from the Sun.',
        items: ['Earth', 'Mercury', 'Mars', 'Venus'],
        correctOrder: [1, 3, 0, 2],
        hint: 'My Very Eager Mother…',
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// NUMBER LINE – place mode
// ─────────────────────────────────────────────────────────────
const numberLine_place = {
  id: 'nl_place',
  label: 'Number Line – Place',
  unit: {
    title: 'Number Line: Place',
    subject: 'math',
    questions: [
      {
        type: 'number_line',
        mode: 'place',
        question: 'Drag the point to **2.5** on the number line.',
        correctAnswer: '2.5',
        geometry: { min: 0, max: 5, step: 0.5, target: 2.5, pointColor: 'purple' },
      },
      {
        type: 'number_line',
        mode: 'place',
        question: 'Place **−3** on the number line.',
        correctAnswer: '-3',
        geometry: { min: -5, max: 5, step: 1, target: -3, pointColor: 'green' },
      },
      {
        type: 'number_line',
        mode: 'place',
        question: 'Where does **0.75** go?',
        correctAnswer: '0.75',
        geometry: { min: 0, max: 1, step: 0.25, target: 0.75, pointColor: 'blue' },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// NUMBER LINE – read mode (MC)
// ─────────────────────────────────────────────────────────────
const numberLine_read = {
  id: 'nl_read',
  label: 'Number Line – Read (MC)',
  unit: {
    title: 'Number Line: Read',
    subject: 'math',
    questions: [
      {
        type: 'number_line',
        mode: 'read',
        question: 'What number is marked on the number line?',
        correctAnswer: '3',
        correctIndex: 1,
        options: ['2', '3', '4', '5'],
        geometry: { min: 0, max: 5, step: 1, target: 3 },
      },
      {
        type: 'number_line',
        mode: 'read',
        question: 'What value does the point represent?',
        correctAnswer: '0.5',
        correctIndex: 2,
        options: ['0.25', '0.75', '0.5', '1'],
        geometry: { min: 0, max: 1, step: 0.25, target: 0.5 },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// NUMBER LINE – count mode (MC)
// ─────────────────────────────────────────────────────────────
const numberLine_count = {
  id: 'nl_count',
  label: 'Number Line – Count (MC)',
  unit: {
    title: 'Number Line: Count',
    subject: 'math',
    questions: [
      {
        type: 'number_line',
        mode: 'count',
        question: 'How many equal parts is the number line divided into?',
        correctIndex: 0,
        options: ['4', '5', '6'],
        geometry: { min: 0, max: 1, step: 0.25 },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// PROTRACTOR – align mode
// ─────────────────────────────────────────────────────────────
const protractor_align = {
  id: 'prot_align',
  label: 'Protractor – Align',
  unit: {
    title: 'Protractor: Align',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'protractor',
        question: 'Align the protractor and measure the angle.',
        correctAnswer: '60',
        geometry: {
          type: 'angle',
          protractorMode: 'align',
          angleDeg: 60,
          vertex: 'B',
          ray1: 'A',
          ray2: 'C',
          flipped: false,
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'protractor',
        question: 'Align the protractor and measure the angle.',
        correctAnswer: '130',
        geometry: {
          type: 'angle',
          protractorMode: 'align',
          angleDeg: 130,
          vertex: 'P',
          ray1: 'Q',
          ray2: 'R',
          flipped: true,
        },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// PROTRACTOR – read mode
// ─────────────────────────────────────────────────────────────
const protractor_read = {
  id: 'prot_read',
  label: 'Protractor – Read',
  unit: {
    title: 'Protractor: Read',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'protractor',
        question: 'What angle is shown on the protractor?',
        correctAnswer: '45',
        geometry: {
          type: 'angle',
          protractorMode: 'read',
          scaleOrigin: 'right',
          flipped: false,
          vertex: 'P',
          ray1: 'Q',
          ray2: 'R',
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'protractor',
        question: 'Read the angle from the left scale.',
        correctAnswer: '110',
        geometry: {
          type: 'angle',
          protractorMode: 'read',
          scaleOrigin: 'left',
          flipped: false,
          angleDeg: 110,
          vertex: 'X',
          ray1: 'Y',
          ray2: 'Z',
        },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// PROTRACTOR – build mode
// ─────────────────────────────────────────────────────────────
const protractor_build = {
  id: 'prot_build',
  label: 'Protractor – Build',
  unit: {
    title: 'Protractor: Build',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'protractor',
        question: 'Drag the arm to build a **75°** angle.',
        correctAnswer: '75',
        geometry: {
          type: 'angle',
          protractorMode: 'build',
          vertex: 'A',
          ray1: 'B',
          ray2: 'C',
        },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// PROTRACTOR – estimate mode
// ─────────────────────────────────────────────────────────────
const protractor_estimate = {
  id: 'prot_estimate',
  label: 'Protractor – Estimate',
  unit: {
    title: 'Protractor: Estimate',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'protractor',
        question: 'About how large is this angle? Choose the best estimate.',
        correctAnswer: '72',
        geometry: {
          type: 'angle',
          protractorMode: 'estimate',
          angleDeg: 72,
          vertex: 'M',
          ray1: 'N',
          ray2: 'L',
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'protractor',
        question: 'Choose the best estimate for this angle.',
        correctAnswer: '118',
        geometry: {
          type: 'angle',
          protractorMode: 'estimate',
          angleDeg: 118,
          vertex: 'A',
          ray1: 'B',
          ray2: 'C',
        },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// PROTRACTOR – spot mistake mode
// ─────────────────────────────────────────────────────────────
const protractor_spotMistake = {
  id: 'prot_spot',
  label: 'Protractor – Spot Mistake',
  unit: {
    title: 'Protractor: Spot Mistake',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'protractor',
        question: 'Who read the protractor correctly?',
        correctAnswer: 'A',
        geometry: {
          type: 'angle',
          protractorMode: 'spot_mistake',
          angleDeg: 70,
          flipped: false,
          claimA: { name: 'Nina', valueDeg: 70 },
          claimB: { name: 'Sam', valueDeg: 110 },
          correctClaim: 'A',
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'protractor',
        question: 'One student made an error. Which reading is correct?',
        correctAnswer: 'B',
        geometry: {
          type: 'angle',
          protractorMode: 'spot_mistake',
          angleDeg: 55,
          flipped: false,
          claimA: { name: 'Leo', valueDeg: 125 },
          claimB: { name: 'Mia', valueDeg: 55 },
          correctClaim: 'B',
        },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// RULER – endpoint
// ─────────────────────────────────────────────────────────────
const ruler_endpoint = {
  id: 'ruler_endpoint',
  label: 'Ruler – Endpoint',
  unit: {
    title: 'Ruler: Endpoint',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'ruler',
        rulerSubtype: 'endpoint',
        question: 'How long is the green bar (in cm)?',
        correctAnswer: '3.5',
        geometry: { unit: 'cm', color: 'green', length: 3.5 },
      },
      {
        type: 'fill_in',
        measurementTool: 'ruler',
        rulerSubtype: 'endpoint',
        question: 'Measure the red bar to the nearest half inch.',
        correctAnswer: '2.5',
        geometry: { unit: 'inch', color: 'red', length: 2.5 },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// RULER – offset (bar doesn't start at 0)
// ─────────────────────────────────────────────────────────────
const ruler_offset = {
  id: 'ruler_offset',
  label: 'Ruler – Offset',
  unit: {
    title: 'Ruler: Offset',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'ruler',
        rulerSubtype: 'offset',
        question: 'The bar does not start at zero. What is its length (in cm)?',
        correctAnswer: '4',
        geometry: { unit: 'cm', color: 'blue', start: 2, length: 4 },
      },
      {
        type: 'fill_in',
        measurementTool: 'ruler',
        rulerSubtype: 'offset',
        question: 'Measure the orange bar. It starts at 1 inch.',
        correctAnswer: '3',
        geometry: { unit: 'inch', color: 'orange', start: 1, length: 3 },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// RULER – compare
// ─────────────────────────────────────────────────────────────
const ruler_compare = {
  id: 'ruler_compare',
  label: 'Ruler – Compare',
  unit: {
    title: 'Ruler: Compare',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'ruler',
        rulerSubtype: 'compare',
        question: 'Which bar is longer — the red bar or the blue bar?',
        correctAnswer: 'blue',
        geometry: { unit: 'cm', color: 'red', length: 5, bar2: { length: 7, color: 'blue' } },
      },
      {
        type: 'fill_in',
        measurementTool: 'ruler',
        rulerSubtype: 'compare',
        question: 'Are the two bars the same length, or is one longer?',
        correctAnswer: 'same',
        geometry: { unit: 'cm', color: 'green', length: 4, bar2: { length: 4, color: 'purple' } },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// RULER – difference
// ─────────────────────────────────────────────────────────────
const ruler_difference = {
  id: 'ruler_difference',
  label: 'Ruler – Difference',
  unit: {
    title: 'Ruler: Difference',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'ruler',
        rulerSubtype: 'difference',
        question: 'How much longer is the red bar than the blue bar (in cm)?',
        correctAnswer: '2',
        geometry: { unit: 'cm', color: 'red', length: 7, bar2: { length: 5, color: 'blue' } },
      },
      {
        type: 'fill_in',
        measurementTool: 'ruler',
        rulerSubtype: 'difference',
        question: 'What is the difference in length between the two bars (in inches)?',
        correctAnswer: '1.5',
        geometry: { unit: 'inch', color: 'purple', length: 4, bar2: { length: 2.5, color: 'orange' } },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// GEOMETRY DISPLAY showcase
// ─────────────────────────────────────────────────────────────
const geometryDisplay = {
  id: 'geometry_display',
  label: 'Geometry Display (pie / bar / shape)',
  unit: {
    title: 'Geometry Displays',
    subject: 'math',
    questions: [
      {
        type: 'multiple_choice',
        question: 'What fraction of the pie chart is green?',
        geometry: {
          type: 'pie',
          slices: [
            { fraction: 0.5, color: '#4ade80', label: 'Green' },
            { fraction: 0.25, color: '#f87171', label: 'Red' },
            { fraction: 0.25, color: '#60a5fa', label: 'Blue' },
          ],
        },
        options: ['1/4', '1/3', '1/2', '2/3'],
        correctIndex: 2,
      },
      {
        type: 'multiple_choice',
        question: 'Which month had the highest sales?',
        geometry: {
          type: 'bar',
          bars: [
            { value: 30, label: 'Jan' },
            { value: 45, label: 'Feb' },
            { value: 60, label: 'Mar' },
            { value: 40, label: 'Apr' },
          ],
          maxValue: 70,
        },
        options: ['January', 'February', 'March', 'April'],
        correctIndex: 2,
      },
      {
        type: 'multiple_choice',
        question: 'What shape is shown?',
        geometry: { type: 'shape', kind: 'rectangle', shaded: true, label: '4 cm × 2 cm' },
        options: ['Triangle', 'Circle', 'Rectangle', 'Hexagon'],
        correctIndex: 2,
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// PASSAGE (Read Along)
// ─────────────────────────────────────────────────────────────
const passage_readAlong = {
  id: 'passage',
  label: 'Read Along Passage',
  unit: {
    title: 'Read Along',
    subject: 'english',
    passage: `# The Water Cycle\n\nWater is always moving. The sun heats water in oceans, lakes, and rivers. The water turns into a gas called **water vapor** and rises into the air. As it rises, it cools and forms tiny droplets — this is called **condensation**. These droplets clump together to make clouds. When the clouds get heavy enough, water falls back to Earth as **precipitation** (rain or snow). Then the cycle begins again.`,
    questions: [
      {
        type: 'multiple_choice',
        question: 'What causes water to evaporate from oceans and lakes?',
        options: ['The moon', 'The sun', 'Wind', 'Rain'],
        correctIndex: 1,
      },
      {
        type: 'true_false',
        question: 'Condensation happens when water vapor cools and forms droplets.',
        correctAnswer: true,
      },
      {
        type: 'fill_in',
        question: 'Rain and snow are both types of ___.',
        correctAnswer: 'precipitation',
        acceptedAnswers: ['Precipitation'],
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// MIXED – one of each standard type
// ─────────────────────────────────────────────────────────────
const mixed_all = {
  id: 'mixed_all',
  label: '⭐ Mixed – All Standard Types',
  unit: {
    title: 'All Standard Question Types',
    subject: 'math',
    questions: [
      {
        type: 'multiple_choice',
        question: 'What is 9 × 6?',
        options: ['52', '54', '56', '58'],
        correctIndex: 1,
      },
      {
        type: 'visual_mc',
        question: 'Which shape has **3 sides**?',
        options: ['Square', 'Triangle', 'Pentagon', 'Circle'],
        correctIndex: 1,
      },
      {
        type: 'fill_in',
        question: 'How many sides does a hexagon have?',
        correctAnswer: '6',
        acceptedAnswers: ['six'],
      },
      {
        type: 'true_false',
        question: 'A triangle has four sides.',
        correctAnswer: false,
      },
      {
        type: 'word_bank',
        question: 'A polygon with 5 sides is called a ____.',
        wordBank: ['hexagon', 'pentagon', 'octagon', 'quadrilateral'],
        correctAnswer: 'pentagon',
      },
      {
        type: 'ordering',
        question: 'Order from fewest to most sides.',
        items: ['Hexagon (6)', 'Triangle (3)', 'Pentagon (5)', 'Square (4)'],
        correctOrder: [1, 3, 2, 0],
      },
      {
        type: 'number_line',
        mode: 'place',
        question: 'Place **4** on the number line.',
        correctAnswer: '4',
        geometry: { min: 0, max: 10, step: 1, target: 4, pointColor: 'green' },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// MIXED – all enhanced/tool types
// ─────────────────────────────────────────────────────────────
const mixed_enhanced = {
  id: 'mixed_enhanced',
  label: '⭐ Mixed – All Enhanced Tool Types',
  unit: {
    title: 'All Enhanced (Tool) Question Types',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'protractor',
        question: 'Measure the angle shown.',
        correctAnswer: '90',
        geometry: { type: 'angle', protractorMode: 'align', angleDeg: 90, vertex: 'A', ray1: 'B', ray2: 'C', flipped: false },
      },
      {
        type: 'fill_in',
        measurementTool: 'protractor',
        question: 'Estimate the size of this angle.',
        correctAnswer: '60',
        geometry: { type: 'angle', protractorMode: 'estimate', angleDeg: 60, vertex: 'X', ray1: 'Y', ray2: 'Z' },
      },
      {
        type: 'fill_in',
        measurementTool: 'ruler',
        rulerSubtype: 'endpoint',
        question: 'How long is the red bar (in cm)?',
        correctAnswer: '5',
        geometry: { unit: 'cm', color: 'red', length: 5 },
      },
      {
        type: 'fill_in',
        measurementTool: 'ruler',
        rulerSubtype: 'offset',
        question: 'The bar starts at 1 cm. How long is it?',
        correctAnswer: '3',
        geometry: { unit: 'cm', color: 'blue', start: 1, length: 3 },
      },
      {
        type: 'number_line',
        mode: 'place',
        question: 'Place **3.5** on the number line.',
        correctAnswer: '3.5',
        geometry: { min: 0, max: 5, step: 0.5, target: 3.5, pointColor: 'purple' },
      },
      {
        type: 'number_line',
        mode: 'read',
        question: 'What number is marked?',
        correctAnswer: '7',
        correctIndex: 2,
        options: ['5', '6', '7', '8'],
        geometry: { min: 0, max: 10, step: 1, target: 7 },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// Export all sample sets grouped by category
// ─────────────────────────────────────────────────────────────
export const SAMPLE_GROUPS = [
  {
    title: '⭐ Quick Showcases',
    items: [mixed_all, mixed_enhanced],
  },
  {
    title: 'Standard Types',
    items: [
      multiplChoice_basic,
      multipleChoice_withContext,
      multipleChoice_withImage,
      visualMC,
      fillIn_basic,
      trueFalse,
      wordBank,
      ordering,
    ],
  },
  {
    title: 'Number Line',
    items: [numberLine_place, numberLine_read, numberLine_count],
  },
  {
    title: 'Protractor (Enhanced)',
    items: [
      protractor_align,
      protractor_read,
      protractor_build,
      protractor_estimate,
      protractor_spotMistake,
    ],
  },
  {
    title: 'Ruler (Enhanced)',
    items: [ruler_endpoint, ruler_offset, ruler_compare, ruler_difference],
  },
  {
    title: 'Extras',
    items: [geometryDisplay, passage_readAlong],
  },
];
