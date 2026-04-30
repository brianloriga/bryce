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
// NUMBER LINE – partition mode (count equal parts)
// ─────────────────────────────────────────────────────────────
const numberLine_count = {
  id: 'nl_count',
  label: 'Number Line – Partition (Count Parts)',
  unit: {
    title: 'Number Line: Partition',
    subject: 'math',
    questions: [
      {
        type: 'number_line',
        mode: 'partition',
        question: 'How many equal parts is the number line divided into?',
        hint: 'Count the spaces between the tick marks, not the tick marks themselves.',
        correctIndex: 1,
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        geometry: { min: 0, max: 1, step: 0.25 },
      },
      {
        type: 'number_line',
        mode: 'partition',
        question: 'How many equal parts is the number line divided into?',
        hint: 'Count the spaces — not the end marks.',
        correctIndex: 0,
        options: ['3', '4', '5', '6'],
        correctAnswer: '3',
        geometry: { min: 0, max: 1, step: 0.333 },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// NUMBER LINE – missing number
// ─────────────────────────────────────────────────────────────
const numberLine_missing = {
  id: 'nl_missing',
  label: 'Number Line – Missing Number',
  unit: {
    title: 'Number Line: Missing Number',
    subject: 'math',
    questions: [
      {
        type: 'number_line',
        mode: 'missing',
        question: 'What number is missing from the pattern?',
        hint: 'Find the pattern — each space goes up by the same amount.',
        options: ['8', '10', '12', '14'],
        correctIndex: 1,
        correctAnswer: '10',
        geometry: { min: 0, max: 20, step: 5, missingValue: 10 },
      },
      {
        type: 'number_line',
        mode: 'missing',
        question: 'What number is missing?',
        hint: 'Count by 2s to find the pattern.',
        options: ['4', '6', '8', '10'],
        correctIndex: 1,
        correctAnswer: '6',
        geometry: { min: 0, max: 10, step: 2, missingValue: 6 },
      },
      {
        type: 'number_line',
        mode: 'missing',
        question: 'What value is marked with a "?" on the number line?',
        hint: 'Skip count by 10s.',
        options: ['25', '30', '35', '40'],
        correctIndex: 1,
        correctAnswer: '30',
        geometry: { min: 0, max: 50, step: 10, missingValue: 30 },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// NUMBER LINE – distance between two points
// ─────────────────────────────────────────────────────────────
const numberLine_distance = {
  id: 'nl_distance',
  label: 'Number Line – Distance Between Points',
  unit: {
    title: 'Number Line: Distance',
    subject: 'math',
    questions: [
      {
        type: 'number_line',
        mode: 'distance',
        question: 'How far apart are points A and B?',
        hint: 'Count the spaces between the two points.',
        options: ['4 units', '5 units', '6 units', '7 units'],
        correctIndex: 1,
        correctAnswer: '5',
        geometry: {
          min: 0, max: 8, step: 1,
          points: [
            { value: 2, label: 'A', color: 'green' },
            { value: 7, label: 'B', color: 'blue' },
          ],
        },
      },
      {
        type: 'number_line',
        mode: 'distance',
        question: 'What is the distance between points A and B?',
        hint: 'Subtract the smaller value from the larger value.',
        options: ['2', '3', '4', '5'],
        correctIndex: 1,
        correctAnswer: '3',
        geometry: {
          min: 0, max: 10, step: 1,
          points: [
            { value: 1, label: 'A', color: 'orange' },
            { value: 4, label: 'B', color: 'purple' },
          ],
        },
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
// PROTRACTOR – angle type identification (Standard)
// ─────────────────────────────────────────────────────────────
const protractor_angleType = {
  id: 'prot_angle_type',
  label: 'Angle Type Identification',
  unit: {
    title: 'Protractor: Angle Type',
    subject: 'math',
    questions: [
      {
        type: 'multiple_choice',
        question: 'What type of angle is shown?',
        geometry: { type: 'angle', angleDeg: 45, vertex: 'B', ray1: 'A', ray2: 'C' },
        options: ['Acute', 'Obtuse', 'Right', 'Straight'],
        correctIndex: 0,
        hint: 'An acute angle is less than 90°.',
      },
      {
        type: 'multiple_choice',
        question: 'What type of angle is shown?',
        geometry: { type: 'angle', angleDeg: 130, vertex: 'X', ray1: 'Y', ray2: 'Z' },
        options: ['Acute', 'Obtuse', 'Right', 'Straight'],
        correctIndex: 1,
        hint: 'An obtuse angle is between 90° and 180°.',
      },
      {
        type: 'multiple_choice',
        question: 'What type of angle is shown?',
        geometry: { type: 'angle', angleDeg: 90, vertex: 'P', ray1: 'Q', ray2: 'R' },
        options: ['Acute', 'Obtuse', 'Right', 'Straight'],
        correctIndex: 2,
        hint: 'A right angle is exactly 90°. Look for the small square at the corner.',
      },
      {
        type: 'multiple_choice',
        question: 'What type of angle is shown?',
        geometry: { type: 'angle', angleDeg: 160, vertex: 'M', ray1: 'N', ray2: 'L' },
        options: ['Acute', 'Obtuse', 'Right', 'Straight'],
        correctIndex: 1,
        hint: 'Compare it to a right angle — is it bigger or smaller than 90°?',
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// PROTRACTOR – angle matching (Standard drag-to-match)
// ─────────────────────────────────────────────────────────────
const protractor_matching = {
  id: 'prot_match',
  label: 'Angle Matching',
  unit: {
    title: 'Protractor: Angle Matching',
    subject: 'math',
    questions: [
      {
        type: 'angle_matching',
        question: 'Match each angle to its measure.',
        pairs: [
          { angleDeg: 45,  vertex: 'A', ray1: 'B', ray2: 'C' },
          { angleDeg: 90,  vertex: 'D', ray1: 'E', ray2: 'F' },
          { angleDeg: 120, vertex: 'G', ray1: 'H', ray2: 'I' },
        ],
        correctAnswer: 'match',
        hint: 'Tap an angle row, then tap the degree that matches it.',
      },
      {
        type: 'angle_matching',
        question: 'Match each angle to its measure.',
        pairs: [
          { angleDeg: 30,  vertex: 'P', ray1: 'Q', ray2: 'R' },
          { angleDeg: 60,  vertex: 'X', ray1: 'Y', ray2: 'Z' },
          { angleDeg: 150, vertex: 'M', ray1: 'N', ray2: 'L' },
        ],
        correctAnswer: 'match',
        hint: 'Compare each angle to a right angle (90°) to narrow it down.',
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// PROTRACTOR – word problem (Standard)
// ─────────────────────────────────────────────────────────────
const protractor_wordProblem = {
  id: 'prot_word',
  label: 'Word Problem – Angles',
  unit: {
    title: 'Protractor: Word Problems',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        question: 'The angle of elevation from a lighthouse to a boat is 28°. Later, the boat moves and the angle of elevation becomes 47°. How many degrees did the angle increase?',
        correctAnswer: '19',
        acceptedAnswers: ['19°', '19 degrees'],
        hint: 'Increase = new angle − old angle.',
      },
      {
        type: 'fill_in',
        question: 'A clock shows 3:00. The minute hand moves to 12:30. How many degrees did the minute hand turn? (Hint: a full circle is 360°.)',
        correctAnswer: '180',
        acceptedAnswers: ['180°'],
        hint: 'Half a revolution = 180°.',
      },
      {
        type: 'multiple_choice',
        question: 'Sam opens a book to a flat page. The two covers form an angle. What type of angle is this?',
        options: ['Acute', 'Right', 'Obtuse', 'Straight'],
        correctIndex: 3,
        hint: 'A flat, open book looks like a straight line — 180°.',
      },
      {
        type: 'fill_in',
        question: 'A skateboard ramp makes an angle of 35° with the ground. Is the ramp angle acute or obtuse?\nType "acute" or "obtuse".',
        correctAnswer: 'acute',
        hint: '35° < 90°, so it is an acute angle.',
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
// COIN / MONEY — count mode
// ─────────────────────────────────────────────────────────────
const coin_count = {
  id: 'coin_count',
  label: 'Coin – Count the Money',
  unit: {
    title: 'Coin: Count',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'How much money is shown?',
        correctAnswer: '80',
        acceptedAnswers: ['80¢', '$0.80', '0.80', '80 cents'],
        hint: 'Count each coin by its value and add them up.',
        geometry: {
          mode: 'count',
          coins: [
            { denomination: 'quarter', count: 2 },
            { denomination: 'dime', count: 3 },
          ],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'How much money is shown?',
        correctAnswer: '36',
        acceptedAnswers: ['36¢', '$0.36', '0.36', '36 cents'],
        hint: 'A quarter is 25¢. Add on the smaller coins.',
        geometry: {
          mode: 'count',
          coins: [
            { denomination: 'quarter', count: 1 },
            { denomination: 'nickel', count: 1 },
            { denomination: 'penny', count: 6 },
          ],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'How much money is shown?',
        correctAnswer: '100',
        acceptedAnswers: ['100¢', '$1.00', '1.00', '1 dollar'],
        hint: 'Four quarters equal one dollar.',
        geometry: {
          mode: 'count',
          coins: [
            { denomination: 'quarter', count: 4 },
          ],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'How much money is shown?',
        correctAnswer: '135',
        acceptedAnswers: ['$1.35', '1.35'],
        hint: 'Count the dollar bill first, then add the coins.',
        geometry: {
          mode: 'count',
          coins: [
            { denomination: 'dollar', count: 1 },
            { denomination: 'quarter', count: 1 },
            { denomination: 'dime', count: 1 },
          ],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'How much money is shown?',
        correctAnswer: '550',
        acceptedAnswers: ['$5.50', '5.50'],
        hint: 'A $5 bill is worth 500 cents. Then add the coins.',
        geometry: {
          mode: 'count',
          coins: [
            { denomination: 'five_dollar', count: 1 },
            { denomination: 'quarter', count: 2 },
          ],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'How much money is shown?',
        correctAnswer: '1130',
        acceptedAnswers: ['$11.30', '11.30'],
        hint: 'Count the $10 bill, then the $1 bill, then the coins.',
        geometry: {
          mode: 'count',
          coins: [
            { denomination: 'ten_dollar', count: 1 },
            { denomination: 'dollar', count: 1 },
            { denomination: 'quarter', count: 1 },
            { denomination: 'nickel', count: 1 },
          ],
        },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// COIN / MONEY — make the amount
// ─────────────────────────────────────────────────────────────
const coin_make = {
  id: 'coin_make',
  label: 'Coin – Make the Amount',
  unit: {
    title: 'Coin: Make',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Use coins to make 68¢.',
        correctAnswer: '68',
        acceptedAnswers: ['68¢', '$0.68', '0.68'],
        hint: 'Start with the largest coin you can use.',
        geometry: {
          mode: 'make',
          target: 68,
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Use coins to make 45¢.',
        correctAnswer: '45',
        acceptedAnswers: ['45¢', '$0.45', '0.45'],
        hint: 'A quarter and two dimes work!',
        geometry: {
          mode: 'make',
          target: 45,
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Use coins to make 87¢.',
        correctAnswer: '87',
        acceptedAnswers: ['87¢', '$0.87'],
        hint: 'Start with 3 quarters and add smaller coins.',
        geometry: {
          mode: 'make',
          target: 87,
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Use bills and coins to make $1.25.',
        correctAnswer: '125',
        acceptedAnswers: ['$1.25', '1.25'],
        hint: 'One dollar bill plus one quarter gets you there!',
        geometry: {
          mode: 'make',
          target: 125,
          availableCoins: ['dollar', 'quarter', 'dime', 'nickel', 'penny'],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Use bills and coins to make $6.50.',
        correctAnswer: '650',
        acceptedAnswers: ['$6.50', '6.50'],
        hint: 'Start with the $5 bill, then add dollar bills and coins.',
        geometry: {
          mode: 'make',
          target: 650,
          availableCoins: ['five_dollar', 'dollar', 'quarter', 'dime', 'nickel', 'penny'],
        },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// COIN / MONEY — estimation
// ─────────────────────────────────────────────────────────────
const coin_estimation = {
  id: 'coin_estimation',
  label: 'Coin – Estimation',
  unit: {
    title: 'Coin: Estimation',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'About how much money is shown?',
        correctAnswer: '60',
        hint: 'Think about which coins are worth the most.',
        geometry: {
          mode: 'estimation',
          coins: [
            { denomination: 'quarter', count: 2 },
            { denomination: 'dime', count: 1 },
          ],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'About how much money is shown?',
        correctAnswer: '35',
        hint: 'A quarter is worth 25¢ — start there.',
        geometry: {
          mode: 'estimation',
          coins: [
            { denomination: 'quarter', count: 1 },
            { denomination: 'nickel', count: 2 },
          ],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'About how much money is shown?',
        correctAnswer: '175',
        hint: 'The dollar bill is the big piece — count on from there.',
        geometry: {
          mode: 'estimation',
          coins: [
            { denomination: 'dollar', count: 1 },
            { denomination: 'quarter', count: 3 },
          ],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'About how much money is shown?',
        correctAnswer: '530',
        hint: 'The $5 bill is worth the most — start there.',
        geometry: {
          mode: 'estimation',
          coins: [
            { denomination: 'five_dollar', count: 1 },
            { denomination: 'quarter', count: 1 },
            { denomination: 'nickel', count: 1 },
          ],
        },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// COIN / MONEY — spot the mistake
// ─────────────────────────────────────────────────────────────
const coin_spotMistake = {
  id: 'coin_spot',
  label: 'Coin – Spot the Mistake',
  unit: {
    title: 'Coin: Spot the Mistake',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Nina says the total is 47¢. Sam says it\'s 42¢. Who is correct?',
        correctAnswer: 'A',
        hint: 'Count each coin one at a time to find the real total.',
        geometry: {
          mode: 'spot_mistake',
          coins: [
            { denomination: 'quarter', count: 1 },
            { denomination: 'dime', count: 2 },
            { denomination: 'penny', count: 2 },
          ],
          claimA: { name: 'Nina', valueCents: 47 },
          claimB: { name: 'Sam', valueCents: 42 },
          correctClaim: 'A',
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Leo says the total is 55¢. Mia says it\'s 65¢. Who is correct?',
        correctAnswer: 'B',
        hint: 'Two quarters and a dime and a nickel — add them up.',
        geometry: {
          mode: 'spot_mistake',
          coins: [
            { denomination: 'quarter', count: 2 },
            { denomination: 'dime', count: 1 },
            { denomination: 'nickel', count: 1 },
          ],
          claimA: { name: 'Leo', valueCents: 55 },
          claimB: { name: 'Mia', valueCents: 65 },
          correctClaim: 'B',
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: "Ava says the total is $1.35. Max says it's $1.45. Who is correct?",
        correctAnswer: 'A',
        hint: 'Count the dollar bill first, then add the coins.',
        geometry: {
          mode: 'spot_mistake',
          coins: [
            { denomination: 'dollar', count: 1 },
            { denomination: 'quarter', count: 1 },
            { denomination: 'dime', count: 1 },
          ],
          claimA: { name: 'Ava', valueCents: 135 },
          claimB: { name: 'Max', valueCents: 145 },
          correctClaim: 'A',
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: "Sam says the total is $5.30. Nina says it's $5.35. Who is correct?",
        correctAnswer: 'A',
        hint: 'Add the $5 bill and each coin carefully.',
        geometry: {
          mode: 'spot_mistake',
          coins: [
            { denomination: 'five_dollar', count: 1 },
            { denomination: 'quarter', count: 1 },
            { denomination: 'nickel', count: 1 },
          ],
          claimA: { name: 'Sam', valueCents: 530 },
          claimB: { name: 'Nina', valueCents: 535 },
          correctClaim: 'A',
        },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// COIN / MONEY — fewest coins
// ─────────────────────────────────────────────────────────────
const coin_fewest = {
  id: 'coin_fewest',
  label: 'Coin – Fewest Coins',
  unit: {
    title: 'Coin: Fewest',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Make 41¢ using the fewest coins.',
        correctAnswer: '4',
        hint: 'Think about the largest-value coin you can use first.',
        geometry: {
          mode: 'fewest',
          target: 41,
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Make 30¢ using the fewest coins.',
        correctAnswer: '2',
        hint: 'A quarter is 25¢ — what gets you to 30¢ in one more coin?',
        geometry: {
          mode: 'fewest',
          target: 30,
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Make 75¢ using the fewest coins.',
        correctAnswer: '3',
        hint: 'Three of the largest coin works here.',
        geometry: {
          mode: 'fewest',
          target: 75,
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Make $1.25 using the fewest bills and coins.',
        correctAnswer: '2',
        hint: 'One dollar bill and one quarter — that\'s only 2 pieces!',
        geometry: {
          mode: 'fewest',
          target: 125,
          availableCoins: ['dollar', 'quarter', 'dime', 'nickel', 'penny'],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Make $5.50 using the fewest bills and coins.',
        correctAnswer: '3',
        hint: 'One $5 bill and two quarters = 3 pieces total.',
        geometry: {
          mode: 'fewest',
          target: 550,
          availableCoins: ['ten_dollar', 'five_dollar', 'dollar', 'quarter', 'dime', 'nickel', 'penny'],
        },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// COIN / MONEY — mixed standard questions (no tool)
// ─────────────────────────────────────────────────────────────
const coin_standard = {
  id: 'coin_standard',
  label: 'Coin – Standard Questions',
  unit: {
    title: 'Money: Standard',
    subject: 'math',
    questions: [
      {
        type: 'multiple_choice',
        question: 'Which coin is worth 25 cents?',
        options: ['Penny', 'Nickel', 'Dime', 'Quarter'],
        correctIndex: 3,
        hint: 'This coin has an eagle on the back.',
      },
      {
        type: 'multiple_choice',
        question: 'A toy costs 75¢. You pay with $1.00. How much change do you get?',
        options: ['15¢', '25¢', '35¢', '45¢'],
        correctIndex: 1,
        hint: 'Change = amount paid − price.',
      },
      {
        type: 'true_false',
        question: 'A dime is worth 10 cents.',
        correctAnswer: true,
        hint: 'Think about how many dimes equal a dollar.',
      },
      {
        type: 'fill_in',
        question: 'How many nickels equal one quarter (25¢)?',
        correctAnswer: '5',
        acceptedAnswers: ['five'],
        hint: 'Each nickel is worth 5¢. How many 5¢ coins fit in 25¢?',
      },
      {
        type: 'multiple_choice',
        question: 'Sam has 2 dimes and 3 pennies. How much money does Sam have?',
        options: ['15¢', '23¢', '13¢', '32¢'],
        correctIndex: 1,
        hint: '2 dimes = 20¢. Add the pennies.',
      },
      {
        type: 'multiple_choice',
        question: 'You have a $5 bill and buy a book for $3.25. How much change do you get back?',
        options: ['$1.25', '$1.50', '$1.75', '$2.25'],
        correctIndex: 2,
        hint: '$5.00 − $3.25 = ?',
      },
      {
        type: 'multiple_choice',
        question: 'How many $1 bills equal one $10 bill?',
        options: ['5', '8', '10', '12'],
        correctIndex: 2,
        hint: 'Think: how many ones make ten?',
      },
      {
        type: 'true_false',
        question: 'A $5 bill is worth more than twenty quarters.',
        correctAnswer: false,
        hint: 'Twenty quarters = 20 × 25¢. Is that more or less than $5?',
      },
      {
        type: 'fill_in',
        question: 'You have a $10 bill and spend $4.50. How much do you have left?',
        correctAnswer: '$5.50',
        acceptedAnswers: ['5.50', '5 dollars 50 cents'],
        hint: '$10.00 − $4.50 = ?',
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// COIN / MONEY — dollar bills focused (enhanced tool)
// ─────────────────────────────────────────────────────────────
const coin_dollars = {
  id: 'coin_dollars',
  label: 'Coin – Dollar Bills & Mixed',
  unit: {
    title: 'Money: Dollar Bills',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'How much money is shown?',
        correctAnswer: '150',
        acceptedAnswers: ['$1.50', '1.50'],
        hint: 'Start with the dollar bill and count on the quarters.',
        geometry: {
          mode: 'count',
          coins: [
            { denomination: 'dollar', count: 1 },
            { denomination: 'quarter', count: 2 },
          ],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'How much money is shown?',
        correctAnswer: '625',
        acceptedAnswers: ['$6.25', '6.25'],
        hint: 'Count the $5 bill first, then the $1 bill, then the quarter.',
        geometry: {
          mode: 'count',
          coins: [
            { denomination: 'five_dollar', count: 1 },
            { denomination: 'dollar', count: 1 },
            { denomination: 'quarter', count: 1 },
          ],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'How much money is shown?',
        correctAnswer: '1035',
        acceptedAnswers: ['$10.35', '10.35'],
        hint: 'Start with the biggest bill and work down.',
        geometry: {
          mode: 'count',
          coins: [
            { denomination: 'ten_dollar', count: 1 },
            { denomination: 'quarter', count: 1 },
            { denomination: 'dime', count: 1 },
          ],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Use bills and coins to make $2.50.',
        correctAnswer: '250',
        acceptedAnswers: ['$2.50', '2.50'],
        hint: 'Two $1 bills and two quarters works!',
        geometry: {
          mode: 'make',
          target: 250,
          availableCoins: ['five_dollar', 'dollar', 'quarter', 'dime', 'nickel', 'penny'],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Make $1.50 using the fewest bills and coins.',
        correctAnswer: '3',
        hint: 'One $1 bill and two quarters — just 3 pieces.',
        geometry: {
          mode: 'fewest',
          target: 150,
          availableCoins: ['dollar', 'quarter', 'dime', 'nickel', 'penny'],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'About how much money is shown?',
        correctAnswer: '675',
        hint: 'Count the big bills first.',
        geometry: {
          mode: 'estimation',
          coins: [
            { denomination: 'five_dollar', count: 1 },
            { denomination: 'dollar', count: 1 },
            { denomination: 'quarter', count: 3 },
          ],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: "Mia says the total is $5.30. Leo says it's $5.25. Who is correct?",
        correctAnswer: 'A',
        hint: 'Add the $5 bill and the coins carefully.',
        geometry: {
          mode: 'spot_mistake',
          coins: [
            { denomination: 'five_dollar', count: 1 },
            { denomination: 'quarter', count: 1 },
            { denomination: 'nickel', count: 1 },
          ],
          claimA: { name: 'Mia', valueCents: 530 },
          claimB: { name: 'Leo', valueCents: 525 },
          correctClaim: 'A',
        },
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
// MIXED — all 5 coin modes in one run
// ─────────────────────────────────────────────────────────────
const mixed_coins = {
  id: 'mixed_coins',
  label: '⭐ Mixed – All Coin / Money Modes',
  unit: {
    title: 'All Coin Question Types',
    subject: 'math',
    questions: [
      // 1. Count — coins only
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'How much money is shown?',
        correctAnswer: '56',
        acceptedAnswers: ['56¢', '$0.56', '0.56', '56 cents'],
        hint: 'Count each coin by its value and add them up.',
        geometry: {
          mode: 'count',
          coins: [
            { denomination: 'quarter', count: 2 },
            { denomination: 'nickel', count: 1 },
            { denomination: 'penny', count: 1 },
          ],
        },
      },
      // 2. Count — with a dollar bill
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'How much money is shown?',
        correctAnswer: '150',
        acceptedAnswers: ['$1.50', '1.50'],
        hint: 'Start with the dollar bill, then add the quarters.',
        geometry: {
          mode: 'count',
          coins: [
            { denomination: 'dollar', count: 1 },
            { denomination: 'quarter', count: 2 },
          ],
        },
      },
      // 3. Make the amount
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Use bills and coins to make $1.25.',
        correctAnswer: '125',
        acceptedAnswers: ['$1.25', '1.25'],
        hint: 'One dollar bill and one quarter!',
        geometry: {
          mode: 'make',
          target: 125,
          availableCoins: ['dollar', 'quarter', 'dime', 'nickel', 'penny'],
        },
      },
      // 4. Estimation
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'About how much money is shown?',
        correctAnswer: '75',
        hint: 'Three quarters is a classic combination.',
        geometry: {
          mode: 'estimation',
          coins: [
            { denomination: 'quarter', count: 3 },
          ],
        },
      },
      // 5. Spot the mistake
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: "Ava says the total is 31¢. Max says it's 26¢. Who is correct?",
        correctAnswer: 'A',
        hint: 'Count the pennies carefully.',
        geometry: {
          mode: 'spot_mistake',
          coins: [
            { denomination: 'quarter', count: 1 },
            { denomination: 'nickel', count: 1 },
            { denomination: 'penny', count: 1 },
          ],
          claimA: { name: 'Ava', valueCents: 31 },
          claimB: { name: 'Max', valueCents: 26 },
          correctClaim: 'A',
        },
      },
      // 6. Fewest coins
      {
        type: 'fill_in',
        measurementTool: 'coin',
        question: 'Make $1.50 using the fewest bills and coins.',
        correctAnswer: '3',
        hint: 'One dollar bill and two quarters — just 3 pieces!',
        geometry: {
          mode: 'fewest',
          target: 150,
          availableCoins: ['dollar', 'quarter', 'dime', 'nickel', 'penny'],
        },
      },
      // 7. Standard MC — bill identification
      {
        type: 'multiple_choice',
        question: 'A $5 bill is worth how many $1 bills?',
        options: ['3', '4', '5', '6'],
        correctIndex: 2,
        hint: 'Think: five ones equals five dollars.',
      },
      // 8. Standard fill_in — word problem with bill
      {
        type: 'fill_in',
        question: 'You have a $5 bill and buy a snack for $2.75. How much change do you get?',
        correctAnswer: '$2.25',
        acceptedAnswers: ['2.25', '2 dollars 25 cents'],
        hint: '$5.00 − $2.75 = ?',
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// Analog Clock (Enhanced) — 4 interaction modes
// ─────────────────────────────────────────────────────────────

export const clock_read = {
  id: 'clock_read',
  label: 'Clock – Read',
  unit: {
    title: 'Clock: Read the Time',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'What time does the clock show?',
        hint: 'Look at the short hand (hours) and the long hand (minutes).',
        correctAnswer: '3:15',
        acceptedAnswers: ['3:15'],
        geometry: { hours: 3, minutes: 15, clockMode: 'read' },
      },
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'What time does the clock show?',
        hint: 'The long hand at 12 means 0 minutes — that\'s on the hour.',
        correctAnswer: '7:00',
        acceptedAnswers: ['7:00'],
        geometry: { hours: 7, minutes: 0, clockMode: 'read' },
      },
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'What time does the clock show?',
        hint: 'The minute hand pointing to 6 means 30 minutes past the hour.',
        correctAnswer: '2:30',
        acceptedAnswers: ['2:30'],
        geometry: { hours: 2, minutes: 30, clockMode: 'read' },
      },
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'What time does the clock show?',
        hint: 'Count by 5s from 12 to find the minutes.',
        correctAnswer: '11:45',
        acceptedAnswers: ['11:45'],
        geometry: { hours: 11, minutes: 45, clockMode: 'read' },
      },
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'What time does the clock show?',
        hint: 'Each number on the clock is 5 minutes apart.',
        correctAnswer: '9:20',
        acceptedAnswers: ['9:20'],
        geometry: { hours: 9, minutes: 20, clockMode: 'read' },
      },
    ],
  },
};

export const clock_set = {
  id: 'clock_set',
  label: 'Clock – Set the Time',
  unit: {
    title: 'Clock: Set the Time',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'Use the sliders to show 4:30 on the clock.',
        hint: 'Half past means 30 minutes — the minute hand points to 6.',
        correctAnswer: '4:30',
        geometry: { hours: 4, minutes: 30, clockMode: 'set' },
      },
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'Use the sliders to show 1:00 on the clock.',
        hint: 'When it\'s exactly on the hour, the minute hand points straight up to 12.',
        correctAnswer: '1:00',
        geometry: { hours: 1, minutes: 0, clockMode: 'set' },
      },
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'Use the sliders to show 6:15 on the clock.',
        hint: 'Quarter past means 15 minutes — the minute hand points to 3.',
        correctAnswer: '6:15',
        geometry: { hours: 6, minutes: 15, clockMode: 'set' },
      },
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'Use the sliders to show 10:45 on the clock.',
        hint: 'Quarter to means 45 minutes — the minute hand points to 9.',
        correctAnswer: '10:45',
        geometry: { hours: 10, minutes: 45, clockMode: 'set' },
      },
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'Use the sliders to show 8:10 on the clock.',
        hint: 'Count by 5s — 1 on the clock face = 5 minutes, 2 = 10 minutes.',
        correctAnswer: '8:10',
        geometry: { hours: 8, minutes: 10, clockMode: 'set' },
      },
    ],
  },
};

export const clock_estimate = {
  id: 'clock_estimate',
  label: 'Clock – Estimate the Time',
  unit: {
    title: 'Clock: Estimate the Time',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'About what time is shown on the clock?',
        hint: 'Look at roughly where both hands are pointing.',
        correctAnswer: '8:45',
        geometry: { hours: 8, minutes: 47, clockMode: 'estimate' },
      },
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'About what time is shown on the clock?',
        hint: 'Is the minute hand closer to 12, 3, 6, or 9?',
        correctAnswer: '3:00',
        geometry: { hours: 3, minutes: 4, clockMode: 'estimate' },
      },
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'About what time is shown on the clock?',
        hint: 'Think about whether the time is closer to a half hour or the hour.',
        correctAnswer: '12:15',
        geometry: { hours: 12, minutes: 13, clockMode: 'estimate' },
      },
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'About what time is shown on the clock?',
        hint: 'The hour hand is just past the number — use that to narrow it down.',
        correctAnswer: '5:30',
        geometry: { hours: 5, minutes: 32, clockMode: 'estimate' },
      },
    ],
  },
};

export const clock_spotMistake = {
  id: 'clock_spotMistake',
  label: 'Clock – Spot the Mistake',
  unit: {
    title: 'Clock: Spot the Mistake',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'Nina says the time is 6:15. Sam says it is 6:45. Who is correct?',
        hint: 'Look carefully at where the minute hand is pointing.',
        correctAnswer: 'A',
        geometry: {
          hours: 6, minutes: 15, clockMode: 'spot_mistake',
          claimA: { name: 'Nina', time: '6:15' },
          claimB: { name: 'Sam',  time: '6:45' },
          correctClaim: 'A',
        },
      },
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'Leo says the time is 3:00. Mia says it is 2:00. Who is correct?',
        hint: 'The short hand tells you the hour — which number is it closest to?',
        correctAnswer: 'A',
        geometry: {
          hours: 3, minutes: 0, clockMode: 'spot_mistake',
          claimA: { name: 'Leo', time: '3:00' },
          claimB: { name: 'Mia', time: '2:00' },
          correctClaim: 'A',
        },
      },
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'Ava says the time is 9:30. Max says it is 9:00. Who is correct?',
        hint: 'Is the minute hand on the 12 or the 6?',
        correctAnswer: 'A',
        geometry: {
          hours: 9, minutes: 30, clockMode: 'spot_mistake',
          claimA: { name: 'Ava', time: '9:30' },
          claimB: { name: 'Max', time: '9:00' },
          correctClaim: 'A',
        },
      },
      {
        type: 'fill_in', measurementTool: 'clock',
        question: 'Sam says the time is 1:20. Nina says it is 1:25. Who is correct?',
        hint: 'Count by 5s from 12 to find where the minute hand lands.',
        correctAnswer: 'A',
        geometry: {
          hours: 1, minutes: 20, clockMode: 'spot_mistake',
          claimA: { name: 'Sam',  time: '1:20' },
          claimB: { name: 'Nina', time: '1:25' },
          correctClaim: 'A',
        },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// FRACTION BAR (Tool 7)
// ─────────────────────────────────────────────────────────────

const fractionBar_read = {
  id: 'fraction_bar_read',
  label: 'Fraction Bar – Read',
  unit: {
    title: 'Fraction Bar – Read the Fraction',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'What fraction of the bar is shaded?',
        hint: 'Count the green parts, then count all the parts.',
        correctAnswer: '1/2',
        geometry: { mode: 'read', parts: 2, shaded: 1 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'What fraction of the bar is shaded?',
        hint: 'The bar is divided into 4 equal parts.',
        correctAnswer: '3/4',
        geometry: { mode: 'read', parts: 4, shaded: 3 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'What fraction of the bar is shaded?',
        hint: 'Count the shaded sections out of the total.',
        correctAnswer: '2/3',
        geometry: { mode: 'read', parts: 3, shaded: 2 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'What fraction of the bar is shaded?',
        hint: 'There are 5 equal parts. How many are green?',
        correctAnswer: '3/5',
        geometry: { mode: 'read', parts: 5, shaded: 3 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'What fraction of the bar is shaded?',
        hint: 'Count carefully — the bar has 8 sections.',
        correctAnswer: '5/8',
        geometry: { mode: 'read', parts: 8, shaded: 5 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'What fraction of the bar is shaded?',
        hint: 'The whole bar is 6 parts. How many are shaded?',
        correctAnswer: '1/6',
        geometry: { mode: 'read', parts: 6, shaded: 1 },
      },
    ],
  },
};

const fractionBar_shade = {
  id: 'fraction_bar_shade',
  label: 'Fraction Bar – Shade',
  unit: {
    title: 'Fraction Bar – Shade the Fraction',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Shade 1/2 of the bar.',
        hint: 'The bar has 2 equal parts. Tap 1 of them.',
        correctAnswer: '1',
        geometry: { mode: 'shade', parts: 2, shaded: 1 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Shade 3/4 of the bar.',
        hint: 'The bar has 4 equal parts. Tap 3 of them.',
        correctAnswer: '3',
        geometry: { mode: 'shade', parts: 4, shaded: 3 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Shade 1/3 of the bar.',
        hint: 'The bar has 3 equal parts. Tap 1 of them.',
        correctAnswer: '1',
        geometry: { mode: 'shade', parts: 3, shaded: 1 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Shade 4/5 of the bar.',
        hint: 'The bar has 5 equal parts. Tap 4 of them.',
        correctAnswer: '4',
        geometry: { mode: 'shade', parts: 5, shaded: 4 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Shade 3/8 of the bar.',
        hint: 'The bar is divided into 8 sections. Tap exactly 3.',
        correctAnswer: '3',
        geometry: { mode: 'shade', parts: 8, shaded: 3 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Shade 5/6 of the bar.',
        hint: 'The bar has 6 equal parts. Tap 5 of them.',
        correctAnswer: '5',
        geometry: { mode: 'shade', parts: 6, shaded: 5 },
      },
    ],
  },
};

const fractionBar_compare = {
  id: 'fraction_bar_compare',
  label: 'Fraction Bar – Compare',
  unit: {
    title: 'Fraction Bar – Compare Fractions',
    subject: 'math',
    questions: [
      {
        // Easy: same denominator
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Which fraction is greater?',
        hint: 'Both bars have the same number of parts — count the shaded ones.',
        correctAnswer: 'top',
        geometry: { mode: 'compare', parts: 4, shaded: 3, parts2: 4, shaded2: 1 },
      },
      {
        // Same numerator, different denominator (3/4 vs 3/5)
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Which fraction is greater?',
        hint: 'Same number of shaded parts — but how many total parts does each bar have?',
        correctAnswer: 'top',
        geometry: { mode: 'compare', parts: 4, shaded: 3, parts2: 5, shaded2: 3 },
      },
      {
        // Close call (2/3 vs 3/4)
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Which fraction is greater?',
        hint: 'These are close — try converting to the same denominator in your head.',
        correctAnswer: 'bottom',
        geometry: { mode: 'compare', parts: 3, shaded: 2, parts2: 4, shaded2: 3 },
      },
      {
        // Equal fractions (2/4 = 1/2)
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Which fraction is greater — or are they equal?',
        hint: 'Think carefully — could these actually be the same amount?',
        correctAnswer: 'equal',
        geometry: { mode: 'compare', parts: 2, shaded: 1, parts2: 4, shaded2: 2 },
      },
      {
        // 1/3 vs 2/5
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Which fraction is greater?',
        hint: '1/3 ≈ 0.33 and 2/5 = 0.40 — which is larger?',
        correctAnswer: 'bottom',
        geometry: { mode: 'compare', parts: 3, shaded: 1, parts2: 5, shaded2: 2 },
      },
      {
        // Equal (3/6 = 1/2)
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Which fraction is greater — or are they equal?',
        hint: 'Simplify the bottom fraction — what does 3/6 reduce to?',
        correctAnswer: 'equal',
        geometry: { mode: 'compare', parts: 2, shaded: 1, parts2: 6, shaded2: 3 },
      },
    ],
  },
};

const fractionBar_equivalent = {
  id: 'fraction_bar_equivalent',
  label: 'Fraction Bar – Equivalent',
  unit: {
    title: 'Fraction Bar – Equivalent Fractions',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Shade the bottom bar to show the same fraction as the top.',
        hint: '1/2 means half. How many parts out of 4 equal half?',
        correctAnswer: '2',
        geometry: { mode: 'equivalent', parts: 2, shaded: 1, parts2: 4 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Shade the bottom bar to show the same fraction as the top.',
        hint: '1/3 — if the bottom bar has 6 parts, how many make 1/3?',
        correctAnswer: '2',
        geometry: { mode: 'equivalent', parts: 3, shaded: 1, parts2: 6 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Shade the bottom bar to show the same fraction as the top.',
        hint: '3/4 — if the bottom bar has 8 parts, how many equal 3/4?',
        correctAnswer: '6',
        geometry: { mode: 'equivalent', parts: 4, shaded: 3, parts2: 8 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Shade the bottom bar to show the same fraction as the top.',
        hint: '2/3 — with 6 parts in the bottom bar, multiply top and bottom by 2.',
        correctAnswer: '4',
        geometry: { mode: 'equivalent', parts: 3, shaded: 2, parts2: 6 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Shade the bottom bar to show the same fraction as the top.',
        hint: '1/2 with 10 parts — how many is half of 10?',
        correctAnswer: '5',
        geometry: { mode: 'equivalent', parts: 2, shaded: 1, parts2: 10 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_bar',
        question: 'Shade the bottom bar to show the same fraction as the top.',
        hint: '4/5 — with 10 parts, multiply by 2 to keep the same value.',
        correctAnswer: '8',
        geometry: { mode: 'equivalent', parts: 5, shaded: 4, parts2: 10 },
      },
    ],
  },
};

const fractionBuild = {
  id: 'fraction_build',
  label: 'Fraction – Build-a-Fraction',
  unit: {
    title: 'Fraction – Build-a-Fraction',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'fraction_build',
        question: 'Build the fraction 1/2 using the bar below.',
        hint: 'Set the stepper to 2 equal parts, then shade 1.',
        correctAnswer: '1/2',
        geometry: { target: '1/2' },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_build',
        question: 'Build the fraction 3/4.',
        hint: 'You need 4 equal parts total, with 3 shaded.',
        correctAnswer: '3/4',
        geometry: { target: '3/4' },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_build',
        question: 'Build the fraction 2/3.',
        hint: '3 equal parts — shade 2 of them.',
        correctAnswer: '2/3',
        geometry: { target: '2/3' },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_build',
        question: 'Build the fraction 4/5.',
        hint: '5 parts total, shade 4.',
        correctAnswer: '4/5',
        geometry: { target: '4/5' },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_build',
        question: 'Build the fraction 3/8.',
        hint: 'Remember: the bottom number tells you how many parts to make.',
        correctAnswer: '3/8',
        geometry: { target: '3/8' },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_build',
        question: 'Build the fraction 5/6.',
        hint: 'Set 6 equal parts, then shade 5 — almost the whole bar!',
        correctAnswer: '5/6',
        geometry: { target: '5/6' },
      },
    ],
  },
};

const fractionNumberLine_read = {
  id: 'fraction_number_line_read',
  label: 'Fraction Number Line – Read',
  unit: {
    title: 'Fraction Number Line – Read the Point',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'What fraction does the point show?',
        hint: 'Count the equal spaces between 0 and 1.',
        correctAnswer: '3/4',
        geometry: { mode: 'read', denominator: 4, target: 3 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'What fraction does the point show?',
        hint: 'How many spaces is the point from 0? How many spaces total?',
        correctAnswer: '1/3',
        geometry: { mode: 'read', denominator: 3, target: 1 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'What fraction does the point show?',
        hint: 'Count carefully — there are 5 equal spaces.',
        correctAnswer: '2/5',
        geometry: { mode: 'read', denominator: 5, target: 2 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'What fraction does the point show?',
        hint: 'The line is divided into 8 equal parts.',
        correctAnswer: '5/8',
        geometry: { mode: 'read', denominator: 8, target: 5 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'What fraction is at the marked point?',
        hint: '1/2 is right in the middle.',
        correctAnswer: '1/2',
        geometry: { mode: 'read', denominator: 2, target: 1 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'What fraction does the point show?',
        hint: '6 equal spaces — count from 0.',
        correctAnswer: '5/6',
        geometry: { mode: 'read', denominator: 6, target: 5 },
      },
    ],
  },
};

const fractionNumberLine_place = {
  id: 'fraction_number_line_place',
  label: 'Fraction Number Line – Place',
  unit: {
    title: 'Fraction Number Line – Place the Point',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'Place 1/2 on the number line.',
        hint: '1/2 is exactly halfway between 0 and 1.',
        correctAnswer: '1/2',
        geometry: { mode: 'place', denominator: 2, target: 1 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'Place 3/4 on the number line.',
        hint: 'Count 3 spaces to the right of 0 out of 4 total.',
        correctAnswer: '3/4',
        geometry: { mode: 'place', denominator: 4, target: 3 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'Place 2/3 on the number line.',
        hint: '2 out of 3 equal spaces from 0.',
        correctAnswer: '2/3',
        geometry: { mode: 'place', denominator: 3, target: 2 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'Place 3/8 on the number line.',
        hint: 'Count 3 spaces out of 8 from the left.',
        correctAnswer: '3/8',
        geometry: { mode: 'place', denominator: 8, target: 3 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'Place 4/5 on the number line.',
        hint: '4 spaces out of 5 — close to 1.',
        correctAnswer: '4/5',
        geometry: { mode: 'place', denominator: 5, target: 4 },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'Place 1/6 on the number line.',
        hint: 'Very close to 0 — just 1 out of 6 spaces.',
        correctAnswer: '1/6',
        geometry: { mode: 'place', denominator: 6, target: 1 },
      },
    ],
  },
};

const fractionNumberLine_order = {
  id: 'fraction_number_line_order',
  label: 'Fraction Number Line – Order',
  unit: {
    title: 'Fraction Number Line – Order Fractions',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'Tap the fractions in order from smallest to largest.',
        hint: 'Look at where each fraction falls on the number line.',
        correctAnswer: '1/4,2/4,3/4',
        geometry: { mode: 'order', denominator: 4, fractions: [3, 1, 2] },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'Tap the fractions in order from smallest to largest.',
        hint: '1/3 is close to 0; 2/3 is close to 1.',
        correctAnswer: '1/3,2/3,3/3',
        geometry: { mode: 'order', denominator: 3, fractions: [2, 3, 1] },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'Tap the fractions in order from smallest to largest.',
        hint: 'There are 5 equal spaces. Which number is furthest right?',
        correctAnswer: '1/5,3/5,4/5',
        geometry: { mode: 'order', denominator: 5, fractions: [4, 1, 3] },
      },
      {
        type: 'fill_in', measurementTool: 'fraction_number_line',
        question: 'Tap the fractions in order from smallest to largest.',
        hint: '0 is the very start of the number line.',
        correctAnswer: '0,3/6,1',
        geometry: { mode: 'order', denominator: 6, fractions: [6, 0, 3] },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// Export all sample sets grouped by category
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// MEASURING CUP – read
// ─────────────────────────────────────────────────────────────
const measuringCup_read = {
  id: 'measuring_cup_read',
  label: 'Measuring Cup – Read',
  unit: {
    title: 'Measuring Cup: Read',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'measuring_cup',
        question: 'How much liquid is in the cup?',
        hint: 'Find the line the top of the liquid touches.',
        correctAnswer: '½ cup',
        geometry: { mode: 'read', level: 0.5, unit: 'cup' },
      },
      {
        type: 'fill_in',
        measurementTool: 'measuring_cup',
        question: 'How much liquid is in the cup?',
        hint: 'Look at where the liquid reaches on the scale.',
        correctAnswer: '¾ cup',
        geometry: { mode: 'read', level: 0.75, unit: 'cup' },
      },
      {
        type: 'fill_in',
        measurementTool: 'measuring_cup',
        question: 'How much liquid is in the cup?',
        hint: 'Count the marks from the bottom.',
        correctAnswer: '¼ cup',
        geometry: { mode: 'read', level: 0.25, unit: 'cup' },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// MEASURING CUP – fill
// ─────────────────────────────────────────────────────────────
const measuringCup_fill = {
  id: 'measuring_cup_fill',
  label: 'Measuring Cup – Fill',
  unit: {
    title: 'Measuring Cup: Fill',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'measuring_cup',
        question: 'How much more liquid do you need to add to reach the yellow line?',
        hint: 'Target minus current = amount to add.',
        correctAnswer: '½ cup',
        geometry: { mode: 'fill', currentLevel: 0.25, targetLevel: 0.75, unit: 'cup' },
      },
      {
        type: 'fill_in',
        measurementTool: 'measuring_cup',
        question: 'How much more do you need to add to fill to the yellow line?',
        hint: 'Subtract what you have from the target.',
        correctAnswer: '¼ cup',
        geometry: { mode: 'fill', currentLevel: 0.5, targetLevel: 0.75, unit: 'cup' },
      },
      {
        type: 'fill_in',
        measurementTool: 'measuring_cup',
        question: 'The yellow line shows the target. How much more liquid is needed?',
        hint: 'The blue liquid is what you have. The yellow line is the goal.',
        correctAnswer: '¾ cup',
        geometry: { mode: 'fill', currentLevel: 0.25, targetLevel: 1.0, unit: 'cup' },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// MEASURING CUP – compare
// ─────────────────────────────────────────────────────────────
const measuringCup_compare = {
  id: 'measuring_cup_compare',
  label: 'Measuring Cup – Compare',
  unit: {
    title: 'Measuring Cup: Compare',
    subject: 'math',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'measuring_cup',
        question: 'Which cup has more liquid?',
        hint: 'Compare where the liquid reaches in each cup.',
        correctAnswer: 'left',
        geometry: { mode: 'compare', level: 0.75, level2: 0.5, unit: 'cup' },
      },
      {
        type: 'fill_in',
        measurementTool: 'measuring_cup',
        question: 'Which cup has more liquid?',
        hint: 'Look at the measurement lines.',
        correctAnswer: 'right',
        geometry: { mode: 'compare', level: 0.25, level2: 0.75, unit: 'cup' },
      },
      {
        type: 'fill_in',
        measurementTool: 'measuring_cup',
        question: 'Do both cups have the same amount?',
        hint: 'Check what line the liquid reaches in each cup.',
        correctAnswer: 'equal',
        geometry: { mode: 'compare', level: 0.5, level2: 0.5, unit: 'cup' },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// COORDINATE GRID — all 5 modes
// ─────────────────────────────────────────────────────────────
const coordGrid_plot = {
  id: 'cg_plot',
  label: 'Coordinate Grid – Plot a Point',
  unit: {
    title: 'Coordinate Grid: Plot',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'coordinate_grid',
        question: 'Plot the point (3, 2) on the grid.',
        hint: 'Move 3 right on the x-axis, then 2 up.',
        correctAnswer: '3,2',
        geometry: { mode: 'plot', target: [3, 2], gridRange: 5 },
      },
      {
        type: 'fill_in', measurementTool: 'coordinate_grid',
        question: 'Plot the point (−4, 1) on the grid.',
        hint: 'Move 4 left, then 1 up.',
        correctAnswer: '-4,1',
        geometry: { mode: 'plot', target: [-4, 1], gridRange: 5 },
      },
      {
        type: 'fill_in', measurementTool: 'coordinate_grid',
        question: 'Plot the point (2, −3) on the grid.',
        hint: 'Move 2 right, then 3 down.',
        correctAnswer: '2,-3',
        geometry: { mode: 'plot', target: [2, -3], gridRange: 5 },
      },
    ],
  },
};

const coordGrid_read = {
  id: 'cg_read',
  label: 'Coordinate Grid – Read a Point (Steppers)',
  unit: {
    title: 'Coordinate Grid: Read',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'coordinate_grid',
        question: 'What are the coordinates of the blue point?',
        hint: 'Read across first (x), then up or down (y).',
        correctAnswer: '-3,2',
        geometry: {
          mode: 'read', gridRange: 5,
          points: [{ x: -3, y: 2, color: 'blue', label: null }],
        },
      },
      {
        type: 'fill_in', measurementTool: 'coordinate_grid',
        question: 'What are the coordinates of the green point?',
        hint: 'Right is positive x, up is positive y.',
        correctAnswer: '4,-1',
        geometry: {
          mode: 'read', gridRange: 5,
          points: [{ x: 4, y: -1, color: 'green', label: null }],
        },
      },
      {
        type: 'fill_in', measurementTool: 'coordinate_grid',
        question: 'What are the coordinates of the orange point?',
        hint: 'Is x positive or negative? Is y positive or negative?',
        correctAnswer: '-2,-4',
        geometry: {
          mode: 'read', gridRange: 5,
          points: [{ x: -2, y: -4, color: 'orange', label: null }],
        },
      },
    ],
  },
};

const coordGrid_errorDetect = {
  id: 'cg_error_detect',
  label: 'Coordinate Grid – Error Detection',
  unit: {
    title: 'Coordinate Grid: Error Detection',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'coordinate_grid',
        question: 'Sam says this point is at (5, 2). Is Sam correct?',
        hint: 'Remember: x comes first (horizontal), y comes second (vertical).',
        correctAnswer: 'wrong',
        geometry: {
          mode: 'error_detect', gridRange: 5,
          points: [{ x: 2, y: 5, color: 'blue', label: 'P' }],
          claim: { name: 'Sam', x: 5, y: 2 },
          correctX: 2, correctY: 5,
        },
      },
      {
        type: 'fill_in', measurementTool: 'coordinate_grid',
        question: 'Nina says this point is at (−3, 4). Is Nina correct?',
        hint: 'Look at which axis goes left-right and which goes up-down.',
        correctAnswer: 'wrong',
        geometry: {
          mode: 'error_detect', gridRange: 5,
          points: [{ x: 4, y: -3, color: 'red', label: 'A' }],
          claim: { name: 'Nina', x: -3, y: 4 },
          correctX: 4, correctY: -3,
        },
      },
      {
        type: 'fill_in', measurementTool: 'coordinate_grid',
        question: 'Leo says this point is at (3, −2). Is Leo correct?',
        hint: 'Read the x-axis (horizontal) first to check.',
        correctAnswer: 'right',
        geometry: {
          mode: 'error_detect', gridRange: 5,
          points: [{ x: 3, y: -2, color: 'green', label: 'B' }],
          claim: { name: 'Leo', x: 3, y: -2 },
          correctX: 3, correctY: -2,
        },
      },
      {
        type: 'fill_in', measurementTool: 'coordinate_grid',
        question: 'Ava says this point is at (−4, −2). Is Ava correct?',
        hint: 'Both values are negative — check the quadrant first.',
        correctAnswer: 'wrong',
        geometry: {
          mode: 'error_detect', gridRange: 5,
          points: [{ x: -2, y: -4, color: 'purple', label: 'C' }],
          claim: { name: 'Ava', x: -4, y: -2 },
          correctX: -2, correctY: -4,
        },
      },
    ],
  },
};

const coordGrid_multiPlot = {
  id: 'cg_multi',
  label: 'Coordinate Grid – Plot Multiple Points',
  unit: {
    title: 'Coordinate Grid: Multi-Plot',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'coordinate_grid',
        question: 'Plot all of the points on the grid.',
        hint: 'Tap the correct intersection for each point.',
        correctAnswer: '-2,3;4,-1;1,-3',
        geometry: {
          mode: 'multi_plot', gridRange: 5,
          targets: [
            { x: -2, y:  3, label: 'A', color: 'red'    },
            { x:  4, y: -1, label: 'B', color: 'green'  },
            { x:  1, y: -3, label: 'C', color: 'purple' },
          ],
        },
      },
    ],
  },
};

const coordGrid_missing = {
  id: 'cg_missing',
  label: 'Coordinate Grid – Find the Missing Point',
  unit: {
    title: 'Coordinate Grid: Missing Point',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'coordinate_grid',
        question: 'Points A, B, and C are shown. Plot point D at (−4, −2).',
        hint: 'Move 4 left, then 2 down.',
        correctAnswer: '-4,-2',
        geometry: {
          mode: 'missing', gridRange: 5,
          shownPoints: [
            { x: -2, y:  3, label: 'A', color: 'red'   },
            { x:  4, y: -1, label: 'B', color: 'green' },
            { x:  1, y:  3, label: 'C', color: 'blue'  },
          ],
          target: { x: -4, y: -2, label: 'D' },
        },
      },
    ],
  },
};

const coordGrid_quadrant = {
  id: 'cg_quadrant',
  label: 'Coordinate Grid – Which Quadrant?',
  unit: {
    title: 'Coordinate Grid: Quadrant',
    subject: 'math',
    questions: [
      {
        type: 'fill_in', measurementTool: 'coordinate_grid',
        question: 'In which quadrant is the point (2, −3) located?',
        hint: 'Right is +x. Down is −y. What quadrant has positive x and negative y?',
        options: ['Quadrant I', 'Quadrant II', 'Quadrant III', 'Quadrant IV'],
        correctIndex: 3,
        correctAnswer: 'Quadrant IV',
        geometry: {
          mode: 'quadrant', gridRange: 5,
          points: [{ x: 2, y: -3, color: 'purple', label: null }],
        },
      },
      {
        type: 'fill_in', measurementTool: 'coordinate_grid',
        question: 'In which quadrant is the point (−3, 4) located?',
        hint: 'Negative x is to the left. Positive y is up.',
        options: ['Quadrant I', 'Quadrant II', 'Quadrant III', 'Quadrant IV'],
        correctIndex: 1,
        correctAnswer: 'Quadrant II',
        geometry: {
          mode: 'quadrant', gridRange: 5,
          points: [{ x: -3, y: 4, color: 'orange', label: null }],
        },
      },
      {
        type: 'fill_in', measurementTool: 'coordinate_grid',
        question: 'In which quadrant is the point (−2, −4) located?',
        hint: 'Both x and y are negative. That is the bottom-left section.',
        options: ['Quadrant I', 'Quadrant II', 'Quadrant III', 'Quadrant IV'],
        correctIndex: 2,
        correctAnswer: 'Quadrant III',
        geometry: {
          mode: 'quadrant', gridRange: 5,
          points: [{ x: -2, y: -4, color: 'red', label: null }],
        },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// CLASSIFICATION SORT (Enhanced)
// ─────────────────────────────────────────────────────────────
const classSort_twoWay = {
  id: 'class_sort_two_way',
  label: 'Classification Sort – Two Categories',
  unit: {
    title: 'Living vs. Non-Living',
    subject: 'science',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'classification_sort',
        question: 'Sort each item into the correct category.',
        hint: 'Living things grow, breathe, and reproduce. Non-living things do not.',
        correctAnswer: 'sorted',
        selfContained: true,
        geometry: {
          mode: 'two_way',
          categories: [
            { label: 'Living', color: 'green' },
            { label: 'Non-Living', color: 'blue' },
          ],
          items: [
            { text: 'Dog', correctCategory: 'Living' },
            { text: 'Rock', correctCategory: 'Non-Living' },
            { text: 'Tree', correctCategory: 'Living' },
            { text: 'Cloud', correctCategory: 'Non-Living' },
            { text: 'Mushroom', correctCategory: 'Living' },
            { text: 'Water', correctCategory: 'Non-Living' },
          ],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'classification_sort',
        question: 'Sort each word as a noun or a verb.',
        hint: 'Nouns name a person, place, or thing. Verbs describe an action.',
        correctAnswer: 'sorted',
        selfContained: true,
        geometry: {
          mode: 'two_way',
          categories: [
            { label: 'Noun', color: 'blue' },
            { label: 'Verb', color: 'orange' },
          ],
          items: [
            { text: 'Run', correctCategory: 'Verb' },
            { text: 'Mountain', correctCategory: 'Noun' },
            { text: 'Jump', correctCategory: 'Verb' },
            { text: 'Teacher', correctCategory: 'Noun' },
            { text: 'Laugh', correctCategory: 'Verb' },
            { text: 'City', correctCategory: 'Noun' },
          ],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'classification_sort',
        question: 'Sort each item as a need or a want.',
        hint: 'Needs are things you must have to survive. Wants are nice to have but not required.',
        correctAnswer: 'sorted',
        selfContained: true,
        geometry: {
          mode: 'two_way',
          categories: [
            { label: 'Need', color: 'green' },
            { label: 'Want', color: 'orange' },
          ],
          items: [
            { text: 'Food', correctCategory: 'Need' },
            { text: 'Video game', correctCategory: 'Want' },
            { text: 'Shelter', correctCategory: 'Need' },
            { text: 'Toy', correctCategory: 'Want' },
            { text: 'Water', correctCategory: 'Need' },
            { text: 'Bicycle', correctCategory: 'Want' },
          ],
        },
      },
    ],
  },
};

const classSort_threeWay = {
  id: 'class_sort_three_way',
  label: 'Classification Sort – Three Categories',
  unit: {
    title: 'States of Matter',
    subject: 'science',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'classification_sort',
        question: 'Sort each item into the correct state of matter.',
        hint: 'Solids have a fixed shape. Liquids flow. Gases spread out to fill their container.',
        correctAnswer: 'sorted',
        selfContained: true,
        geometry: {
          mode: 'three_way',
          categories: [
            { label: 'Solid', color: 'blue' },
            { label: 'Liquid', color: 'green' },
            { label: 'Gas', color: 'orange' },
          ],
          items: [
            { text: 'Ice', correctCategory: 'Solid' },
            { text: 'Water', correctCategory: 'Liquid' },
            { text: 'Steam', correctCategory: 'Gas' },
            { text: 'Rock', correctCategory: 'Solid' },
            { text: 'Juice', correctCategory: 'Liquid' },
            { text: 'Oxygen', correctCategory: 'Gas' },
          ],
        },
      },
      {
        type: 'fill_in',
        measurementTool: 'classification_sort',
        question: 'Sort each branch of government.',
        hint: 'Congress makes laws. The President carries out laws. Courts interpret laws.',
        correctAnswer: 'sorted',
        selfContained: true,
        geometry: {
          mode: 'three_way',
          categories: [
            { label: 'Legislative', color: 'blue' },
            { label: 'Executive', color: 'green' },
            { label: 'Judicial', color: 'orange' },
          ],
          items: [
            { text: 'Congress', correctCategory: 'Legislative' },
            { text: 'President', correctCategory: 'Executive' },
            { text: 'Supreme Court', correctCategory: 'Judicial' },
            { text: 'Senate', correctCategory: 'Legislative' },
            { text: 'Cabinet', correctCategory: 'Executive' },
            { text: 'Federal Judges', correctCategory: 'Judicial' },
          ],
        },
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// CAUSE & EFFECT MAPPER
// ─────────────────────────────────────────────────────────────
const causeEffect_weather = {
  id: 'cause_effect_weather',
  label: 'Cause & Effect – Weather',
  unit: {
    title: 'Weather Cause & Effect',
    subject: 'science',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'cause_effect_map',
        question: 'Match each cause to its effect.',
        hint: 'Think about what happens as a result of each weather event.',
        correctAnswer: 'matched',
        selfContained: true,
        geometry: {
          pairs: [
            { cause: 'Too much rain',    causeEmoji: '🌧️', effect: 'Flooding',       effectEmoji: '🌊' },
            { cause: 'No rain for weeks', causeEmoji: '☀️',  effect: 'Drought',        effectEmoji: '🏜️' },
            { cause: 'Strong winds',     causeEmoji: '💨',  effect: 'Trees fall down', effectEmoji: '🌳' },
            { cause: 'Freezing temps',   causeEmoji: '🥶',  effect: 'Ice on roads',    effectEmoji: '🧊' },
          ],
        },
      },
    ],
  },
};

const causeEffect_history = {
  id: 'cause_effect_history',
  label: 'Cause & Effect – History',
  unit: {
    title: 'Historical Causes & Effects',
    subject: 'social_studies',
    questions: [
      {
        type: 'fill_in',
        measurementTool: 'cause_effect_map',
        question: 'Match each cause to its effect.',
        hint: 'Think about what happened as a result of each event.',
        correctAnswer: 'matched',
        selfContained: true,
        geometry: {
          pairs: [
            { cause: 'Colonists taxed without vote', causeEmoji: '📜', effect: 'American Revolution', effectEmoji: '⚔️' },
            { cause: 'Gold found in California',     causeEmoji: '🪙', effect: 'Gold Rush begins',    effectEmoji: '⛏️' },
            { cause: 'Southern states secede',       causeEmoji: '🗺️', effect: 'Civil War starts',    effectEmoji: '🏳️' },
          ],
        },
      },
    ],
  },
};

export const SAMPLE_GROUPS = [
  {
    title: '⭐ Quick Showcases',
    items: [mixed_all, mixed_enhanced, mixed_coins],
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
    title: 'Coordinate Grid (Enhanced)',
    items: [coordGrid_plot, coordGrid_read, coordGrid_errorDetect, coordGrid_multiPlot, coordGrid_missing, coordGrid_quadrant],
  },
  {
    title: 'Number Line',
    items: [numberLine_place, numberLine_read, numberLine_count, numberLine_missing, numberLine_distance],
  },
  {
    title: 'Protractor (Enhanced)',
    items: [
      protractor_align,
      protractor_read,
      protractor_build,
      protractor_estimate,
      protractor_spotMistake,
      protractor_angleType,
      protractor_matching,
      protractor_wordProblem,
    ],
  },
  {
    title: 'Ruler (Enhanced)',
    items: [ruler_endpoint, ruler_offset, ruler_compare, ruler_difference],
  },
  {
    title: 'Measuring Cup (Enhanced)',
    items: [measuringCup_read, measuringCup_fill, measuringCup_compare],
  },
  {
    title: 'Coin / Money (Enhanced)',
    items: [coin_count, coin_make, coin_estimation, coin_spotMistake, coin_fewest, coin_dollars, coin_standard],
  },
  {
    title: 'Analog Clock (Enhanced)',
    items: [clock_read, clock_set, clock_estimate, clock_spotMistake],
  },
  {
    title: 'Fraction Bar (Enhanced)',
    items: [fractionBar_read, fractionBar_shade, fractionBar_compare, fractionBar_equivalent],
  },
  {
    title: 'Fraction – Build & Number Line',
    items: [fractionBuild, fractionNumberLine_read, fractionNumberLine_place, fractionNumberLine_order],
  },
  {
    title: 'Classification Sort (Enhanced)',
    items: [classSort_twoWay, classSort_threeWay],
  },
  {
    title: 'Cause & Effect Mapper (Enhanced)',
    items: [causeEffect_weather, causeEffect_history],
  },
  {
    title: 'Extras',
    items: [geometryDisplay, passage_readAlong],
  },
];
