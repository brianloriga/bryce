// Polyfill must run before any three / expo-three touch happens.
import './polyfills';

import * as THREE from 'three';

// Module-level debug logger — set by buildScene so helper functions can use it.
let _dbgLog = null;
function dlog(msg) { console.log(msg); if (_dbgLog) _dbgLog(msg); }
import { Platform } from 'react-native';
import { Renderer } from 'expo-three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Asset } from 'expo-asset';

import {
  BOARD_ROWS, TILE, TILE_H,
  BOARD_CELLS, PATH_CELLS,
  tileToWorld,
  TOWER_SLOTS, STARTING_TOWER_SLOT_IDS,
} from './boardConfig';

// ── Weapon GLB per tower type ─────────────────────────────────────────────────
const TOWER_WEAPON_GLB = {
  arrow:    'weapon-ballista',
  cannon:   'weapon-cannon',
  catapult: 'weapon-catapult',
  turret:   'weapon-turret',
  ice:      'tower-round-crystals',  // crystal structure doubles as ice tower weapon
};

// ── Complete GLB registry ─────────────────────────────────────────────────────
const ALL_GLBS = {
  // Terrain tiles
  'tile':                     require('./assets/tdkit/tile.glb'),
  'tile-tree':                require('./assets/tdkit/tile-tree.glb'),
  'tile-tree-double':         require('./assets/tdkit/tile-tree-double.glb'),
  'tile-tree-quad':           require('./assets/tdkit/tile-tree-quad.glb'),
  'tile-rock':                require('./assets/tdkit/tile-rock.glb'),
  'tile-crystal':             require('./assets/tdkit/tile-crystal.glb'),
  'tile-dirt':                require('./assets/tdkit/tile-dirt.glb'),
  'tile-hill':                require('./assets/tdkit/tile-hill.glb'),
  'tile-bump':                require('./assets/tdkit/tile-bump.glb'),
  'tile-slope':               require('./assets/tdkit/tile-slope.glb'),
  'tile-straight-slope':      require('./assets/tdkit/tile-straight-slope.glb'),
  'tile-straight-slope-large':require('./assets/tdkit/tile-straight-slope-large.glb'),
  'tile-transition':          require('./assets/tdkit/tile-transition.glb'),
  // Path tiles
  'tile-straight':            require('./assets/tdkit/tile-straight.glb'),
  'tile-corner-round':        require('./assets/tdkit/tile-corner-round.glb'),
  'tile-corner-square':       require('./assets/tdkit/tile-corner-square.glb'),
  'tile-corner-inner':        require('./assets/tdkit/tile-corner-inner.glb'),
  'tile-corner-outer':        require('./assets/tdkit/tile-corner-outer.glb'),
  'tile-corner-large':        require('./assets/tdkit/tile-corner-large.glb'),
  'tile-crossing':            require('./assets/tdkit/tile-crossing.glb'),
  'tile-split':               require('./assets/tdkit/tile-split.glb'),
  'tile-end':                 require('./assets/tdkit/tile-end.glb'),
  'tile-end-round':           require('./assets/tdkit/tile-end-round.glb'),
  'tile-spawn':               require('./assets/tdkit/tile-spawn.glb'),
  'tile-spawn-round':         require('./assets/tdkit/tile-spawn-round.glb'),
  'tile-spawn-end':           require('./assets/tdkit/tile-spawn-end.glb'),
  'tile-spawn-end-round':     require('./assets/tdkit/tile-spawn-end-round.glb'),
  'tile-wide-straight':       require('./assets/tdkit/tile-wide-straight.glb'),
  'tile-wide-corner':         require('./assets/tdkit/tile-wide-corner.glb'),
  'tile-wide-split':          require('./assets/tdkit/tile-wide-split.glb'),
  'tile-wide-transition':     require('./assets/tdkit/tile-wide-transition.glb'),
  // River/water tiles
  'tile-river-straight':      require('./assets/tdkit/tile-river-straight.glb'),
  'tile-river-corner':        require('./assets/tdkit/tile-river-corner.glb'),
  'tile-river-bridge':        require('./assets/tdkit/tile-river-bridge.glb'),
  'tile-river-slope':         require('./assets/tdkit/tile-river-slope.glb'),
  'tile-river-slope-large':   require('./assets/tdkit/tile-river-slope-large.glb'),
  'tile-river-transition':    require('./assets/tdkit/tile-river-transition.glb'),
  'tile-river-waterfall':     require('./assets/tdkit/tile-river-waterfall.glb'),
  // Snow terrain tiles
  'snow-tile':                require('./assets/tdkit/snow-tile.glb'),
  'snow-tile-tree':           require('./assets/tdkit/snow-tile-tree.glb'),
  'snow-tile-tree-double':    require('./assets/tdkit/snow-tile-tree-double.glb'),
  'snow-tile-tree-quad':      require('./assets/tdkit/snow-tile-tree-quad.glb'),
  'snow-tile-rock':           require('./assets/tdkit/snow-tile-rock.glb'),
  'snow-tile-crystal':        require('./assets/tdkit/snow-tile-crystal.glb'),
  'snow-tile-dirt':           require('./assets/tdkit/snow-tile-dirt.glb'),
  'snow-tile-hill':           require('./assets/tdkit/snow-tile-hill.glb'),
  'snow-tile-bump':           require('./assets/tdkit/snow-tile-bump.glb'),
  'snow-tile-slope':          require('./assets/tdkit/snow-tile-slope.glb'),
  'snow-tile-straight-slope': require('./assets/tdkit/snow-tile-straight-slope.glb'),
  'snow-tile-straight-slope-large': require('./assets/tdkit/snow-tile-straight-slope-large.glb'),
  'snow-tile-transition':     require('./assets/tdkit/snow-tile-transition.glb'),
  // Snow path tiles
  'snow-tile-straight':       require('./assets/tdkit/snow-tile-straight.glb'),
  'snow-tile-corner-round':   require('./assets/tdkit/snow-tile-corner-round.glb'),
  'snow-tile-corner-square':  require('./assets/tdkit/snow-tile-corner-square.glb'),
  'snow-tile-corner-inner':   require('./assets/tdkit/snow-tile-corner-inner.glb'),
  'snow-tile-corner-outer':   require('./assets/tdkit/snow-tile-corner-outer.glb'),
  'snow-tile-corner-large':   require('./assets/tdkit/snow-tile-corner-large.glb'),
  'snow-tile-crossing':       require('./assets/tdkit/snow-tile-crossing.glb'),
  'snow-tile-split':          require('./assets/tdkit/snow-tile-split.glb'),
  'snow-tile-end':            require('./assets/tdkit/snow-tile-end.glb'),
  'snow-tile-end-round':      require('./assets/tdkit/snow-tile-end-round.glb'),
  'snow-tile-spawn':          require('./assets/tdkit/snow-tile-spawn.glb'),
  'snow-tile-spawn-round':    require('./assets/tdkit/snow-tile-spawn-round.glb'),
  'snow-tile-spawn-end':      require('./assets/tdkit/snow-tile-spawn-end.glb'),
  'snow-tile-spawn-end-round':require('./assets/tdkit/snow-tile-spawn-end-round.glb'),
  'snow-tile-wide-straight':  require('./assets/tdkit/snow-tile-wide-straight.glb'),
  'snow-tile-wide-corner':    require('./assets/tdkit/snow-tile-wide-corner.glb'),
  'snow-tile-wide-split':     require('./assets/tdkit/snow-tile-wide-split.glb'),
  'snow-tile-wide-transition':require('./assets/tdkit/snow-tile-wide-transition.glb'),
  // Snow river
  'snow-tile-river-straight': require('./assets/tdkit/snow-tile-river-straight.glb'),
  'snow-tile-river-corner':   require('./assets/tdkit/snow-tile-river-corner.glb'),
  'snow-tile-river-bridge':   require('./assets/tdkit/snow-tile-river-bridge.glb'),
  'snow-tile-river-slope':    require('./assets/tdkit/snow-tile-river-slope.glb'),
  'snow-tile-river-slope-large': require('./assets/tdkit/snow-tile-river-slope-large.glb'),
  'snow-tile-river-transition': require('./assets/tdkit/snow-tile-river-transition.glb'),
  'snow-tile-river-waterfall':require('./assets/tdkit/snow-tile-river-waterfall.glb'),
  // Round towers
  'tower-round-base':         require('./assets/tdkit/tower-round-base.glb'),
  'tower-round-bottom-a':     require('./assets/tdkit/tower-round-bottom-a.glb'),
  'tower-round-bottom-b':     require('./assets/tdkit/tower-round-bottom-b.glb'),
  'tower-round-bottom-c':     require('./assets/tdkit/tower-round-bottom-c.glb'),
  'tower-round-middle-a':     require('./assets/tdkit/tower-round-middle-a.glb'),
  'tower-round-middle-b':     require('./assets/tdkit/tower-round-middle-b.glb'),
  'tower-round-middle-c':     require('./assets/tdkit/tower-round-middle-c.glb'),
  'tower-round-roof-a':       require('./assets/tdkit/tower-round-roof-a.glb'),
  'tower-round-roof-b':       require('./assets/tdkit/tower-round-roof-b.glb'),
  'tower-round-roof-c':       require('./assets/tdkit/tower-round-roof-c.glb'),
  'tower-round-top-a':        require('./assets/tdkit/tower-round-top-a.glb'),
  'tower-round-top-b':        require('./assets/tdkit/tower-round-top-b.glb'),
  'tower-round-top-c':        require('./assets/tdkit/tower-round-top-c.glb'),
  'tower-round-build-a':      require('./assets/tdkit/tower-round-build-a.glb'),
  'tower-round-build-b':      require('./assets/tdkit/tower-round-build-b.glb'),
  'tower-round-build-c':      require('./assets/tdkit/tower-round-build-c.glb'),
  'tower-round-build-d':      require('./assets/tdkit/tower-round-build-d.glb'),
  'tower-round-build-e':      require('./assets/tdkit/tower-round-build-e.glb'),
  'tower-round-build-f':      require('./assets/tdkit/tower-round-build-f.glb'),
  'tower-round-crystals':     require('./assets/tdkit/tower-round-crystals.glb'),
  // Square towers
  'tower-square-bottom-a':    require('./assets/tdkit/tower-square-bottom-a.glb'),
  'tower-square-bottom-b':    require('./assets/tdkit/tower-square-bottom-b.glb'),
  'tower-square-bottom-c':    require('./assets/tdkit/tower-square-bottom-c.glb'),
  'tower-square-middle-a':    require('./assets/tdkit/tower-square-middle-a.glb'),
  'tower-square-middle-b':    require('./assets/tdkit/tower-square-middle-b.glb'),
  'tower-square-middle-c':    require('./assets/tdkit/tower-square-middle-c.glb'),
  'tower-square-roof-a':      require('./assets/tdkit/tower-square-roof-a.glb'),
  'tower-square-roof-b':      require('./assets/tdkit/tower-square-roof-b.glb'),
  'tower-square-roof-c':      require('./assets/tdkit/tower-square-roof-c.glb'),
  'tower-square-top-a':       require('./assets/tdkit/tower-square-top-a.glb'),
  'tower-square-top-b':       require('./assets/tdkit/tower-square-top-b.glb'),
  'tower-square-top-c':       require('./assets/tdkit/tower-square-top-c.glb'),
  'tower-square-build-a':     require('./assets/tdkit/tower-square-build-a.glb'),
  'tower-square-build-b':     require('./assets/tdkit/tower-square-build-b.glb'),
  'tower-square-build-c':     require('./assets/tdkit/tower-square-build-c.glb'),
  'tower-square-build-d':     require('./assets/tdkit/tower-square-build-d.glb'),
  'tower-square-build-e':     require('./assets/tdkit/tower-square-build-e.glb'),
  'tower-square-build-f':     require('./assets/tdkit/tower-square-build-f.glb'),
  // Details
  'detail-tree':              require('./assets/tdkit/detail-tree.glb'),
  'detail-tree-large':        require('./assets/tdkit/detail-tree-large.glb'),
  'detail-rocks':             require('./assets/tdkit/detail-rocks.glb'),
  'detail-rocks-large':       require('./assets/tdkit/detail-rocks-large.glb'),
  'detail-crystal':           require('./assets/tdkit/detail-crystal.glb'),
  'detail-crystal-large':     require('./assets/tdkit/detail-crystal-large.glb'),
  'detail-dirt':              require('./assets/tdkit/detail-dirt.glb'),
  'detail-dirt-large':        require('./assets/tdkit/detail-dirt-large.glb'),
  // Snow details
  'snow-detail-tree':         require('./assets/tdkit/snow-detail-tree.glb'),
  'snow-detail-tree-large':   require('./assets/tdkit/snow-detail-tree-large.glb'),
  'snow-detail-rocks':        require('./assets/tdkit/snow-detail-rocks.glb'),
  'snow-detail-rocks-large':  require('./assets/tdkit/snow-detail-rocks-large.glb'),
  'snow-detail-crystal':      require('./assets/tdkit/snow-detail-crystal.glb'),
  'snow-detail-crystal-large':require('./assets/tdkit/snow-detail-crystal-large.glb'),
  'snow-detail-dirt':         require('./assets/tdkit/snow-detail-dirt.glb'),
  'snow-detail-dirt-large':   require('./assets/tdkit/snow-detail-dirt-large.glb'),
  // Weapons
  'weapon-cannon':            require('./assets/tdkit/weapon-cannon.glb'),
  'weapon-catapult':          require('./assets/tdkit/weapon-catapult.glb'),
  'weapon-ballista':          require('./assets/tdkit/weapon-ballista.glb'),
  'weapon-turret':            require('./assets/tdkit/weapon-turret.glb'),
  'weapon-ammo-cannonball':   require('./assets/tdkit/weapon-ammo-cannonball.glb'),
  'weapon-ammo-boulder':      require('./assets/tdkit/weapon-ammo-boulder.glb'),
  'weapon-ammo-arrow':        require('./assets/tdkit/weapon-ammo-arrow.glb'),
  'weapon-ammo-bullet':       require('./assets/tdkit/weapon-ammo-bullet.glb'),
  // Structures
  'spawn-round':              require('./assets/tdkit/spawn-round.glb'),
  'spawn-square':             require('./assets/tdkit/spawn-square.glb'),
  'wood-structure':           require('./assets/tdkit/wood-structure.glb'),
  'wood-structure-high':      require('./assets/tdkit/wood-structure-high.glb'),
  'wood-structure-part':      require('./assets/tdkit/wood-structure-part.glb'),
  'wood-structure-high-part': require('./assets/tdkit/wood-structure-high-part.glb'),
  'snow-wood-structure':      require('./assets/tdkit/snow-wood-structure.glb'),
  'snow-wood-structure-high': require('./assets/tdkit/snow-wood-structure-high.glb'),
  'snow-wood-structure-part': require('./assets/tdkit/snow-wood-structure-part.glb'),
  'snow-wood-structure-high-part': require('./assets/tdkit/snow-wood-structure-high-part.glb'),
  // Enemies
  'enemy-ufo-a':              require('./assets/tdkit/enemy-ufo-a.glb'),
  'enemy-ufo-b':              require('./assets/tdkit/enemy-ufo-b.glb'),
  'enemy-ufo-c':              require('./assets/tdkit/enemy-ufo-c.glb'),
  'enemy-ufo-d':              require('./assets/tdkit/enemy-ufo-d.glb'),
  // Characters — enemies + hero
  'character-a': require('./assets/GLB format/character-a.glb'),
  'character-b': require('./assets/GLB format/character-b.glb'),
  'character-c': require('./assets/GLB format/character-c.glb'),
  'character-d': require('./assets/GLB format/character-d.glb'),
  'character-e': require('./assets/GLB format/character-e.glb'),
  'character-f': require('./assets/GLB format/character-f.glb'),
  'character-g': require('./assets/GLB format/character-g.glb'),
  'character-h': require('./assets/GLB format/character-h.glb'),
  'character-i': require('./assets/GLB format/character-i.glb'),
  'character-j': require('./assets/GLB format/character-j.glb'),
  'character-k': require('./assets/GLB format/character-k.glb'),
  'character-l': require('./assets/GLB format/character-l.glb'),
  'character-m': require('./assets/GLB format/character-m.glb'),
  'character-n': require('./assets/GLB format/character-n.glb'),
  'character-o': require('./assets/GLB format/character-o.glb'),
  'character-p': require('./assets/GLB format/character-p.glb'),
  'character-q': require('./assets/GLB format/character-q.glb'),
  'character-r': require('./assets/GLB format/character-r.glb'),
};

// ── Character texture registry ────────────────────────────────────────────────

const LEGACY = {
  tileGrass: 'tile', tileTree: 'tile-tree', tileTree2: 'tile-tree-double',
  tileRock: 'tile-rock', tileCrystal: 'tile-crystal', tileWater: 'tile-river-straight',
  tileSpawn: 'tile-spawn-round', tileStraight: 'tile-straight',
  tileCorner: 'tile-corner-round', tileEnd: 'tile-end-round',
  towerRound: 'tower-round-top-a', towerSquare: 'tower-square-top-a',
  towerRoundBottom: 'tower-round-bottom-a', towerRoundMiddle: 'tower-round-middle-a',
  towerRoundRoof: 'tower-round-roof-a', towerSquareBottom: 'tower-square-bottom-a',
  towerSquareMiddle: 'tower-square-middle-a', towerSquareRoof: 'tower-square-roof-a',
  cannon: 'weapon-cannon', catapult: 'weapon-catapult', spawnStruct: 'spawn-round',
  detailTree: 'detail-tree', detailTreeLg: 'detail-tree-large',
  detailRocks: 'detail-rocks', detailCrystal: 'detail-crystal',
  enemyA: 'enemy-ufo-a', enemyB: 'enemy-ufo-b', enemyC: 'enemy-ufo-c', enemyD: 'enemy-ufo-d',
};

function resolveKey(k) { return LEGACY[k] ?? k; }

function parseStackKey(raw) {
  const m = String(raw).match(/^([^(]+)\((-?\d+(?:\.\d+)?)\)$/);
  if (m) return { key: m[1].trim(), rotY: parseFloat(m[2]) * (Math.PI / 180) };
  return { key: String(raw), rotY: 0 };
}

// ── Enemy GLB model map ───────────────────────────────────────────────────────
// goblin = character-o (small, quick), knight = character-d (armored),
// giant  = character-l (large, slow), boss = character-l (max scale, red tint)
export const MONSTER_GLB_KEY = {
  goblin: 'character-o',
  knight: 'character-d',
  giant:  'character-l',
  boss:   'character-l',
};

// ── PATH type → tile filename key ─────────────────────────────────────────────
const PATH_TYPE_GLB = {
  spawn: 'tile-spawn-round', straight: 'tile-straight',
  corner: 'tile-corner-round', end: 'tile-end-round',
};

// ── Keys that trigger castle game-logic ───────────────────────────────────────
const CASTLE_KEYS = new Set([
  'tower-square-top-a', 'tower-square-top-b', 'tower-square-top-c', 'tower-square-build-a',
  'towerSquare',
]);

// ── Modular tower part heights ─────────────────────────────────────────────────
const PART_H = {
  'tower-round-bottom-a': 0.60 * TILE, 'tower-round-bottom-b': 0.60 * TILE,
  'tower-round-bottom-c': 0.60 * TILE, 'tower-round-base':     0.60 * TILE,
  'tower-round-middle-a': 0.60 * TILE, 'tower-round-middle-b': 0.60 * TILE,
  'tower-round-middle-c': 0.60 * TILE,
  'tower-round-roof-a':   1.15 * TILE, 'tower-round-roof-b':   1.15 * TILE,
  'tower-round-roof-c':   1.15 * TILE,
  'tower-round-top-a':    0.50 * TILE, 'tower-round-top-b':    0.50 * TILE,
  'tower-round-top-c':    0.50 * TILE,
  'tower-round-crystals': 0.80 * TILE,
  'tower-square-bottom-a':0.50 * TILE, 'tower-square-bottom-b':0.50 * TILE,
  'tower-square-bottom-c':0.50 * TILE,
  'tower-square-middle-a':0.50 * TILE, 'tower-square-middle-b':0.50 * TILE,
  'tower-square-middle-c':0.50 * TILE,
  'tower-square-roof-a':  1.28 * TILE, 'tower-square-roof-b':  1.28 * TILE,
  'tower-square-roof-c':  1.28 * TILE,
  'tower-square-top-a':   0.50 * TILE, 'tower-square-top-b':   0.50 * TILE,
  'tower-square-top-c':   0.50 * TILE,
  towerRoundBottom: 0.60 * TILE, towerRoundMiddle: 0.60 * TILE,
  towerRoundRoof:   1.15 * TILE, towerSquareBottom: 0.50 * TILE,
  towerSquareMiddle: 0.50 * TILE, towerSquareRoof: 1.28 * TILE,
  'weapon-cannon':   0.35 * TILE, 'weapon-catapult': 0.45 * TILE,
  'weapon-ballista': 0.40 * TILE, 'weapon-turret':   0.50 * TILE,
};

// ── GLB loading helpers ───────────────────────────────────────────────────────
function readAsArrayBuffer(uri) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;
      if (xhr.status === 200 || xhr.status === 0) resolve(xhr.response);
      else reject(new Error(`XHR ${xhr.status} for ${uri}`));
    };
    xhr.onerror = () => reject(new Error(`XHR network error for ${uri}`));
    xhr.open('GET', uri, true);
    xhr.send();
  });
}

async function loadGLB(mod, manager) {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  const buffer = await readAsArrayBuffer(asset.localUri ?? asset.uri);
  return new Promise((resolve, reject) => {
    new GLTFLoader(manager).parse(buffer, '', g => resolve(g.scene), reject);
  });
}

function loadGLBSafe(mod, key, ms = 25000, manager) {
  return Promise.race([
    loadGLB(mod, manager),
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${key}`)), ms)),
  ]);
}

export function cloneModel(t) { return t.clone(true); }

function applyColormap(obj, tex) {
  if (!tex) return;
  obj.traverse(c => {
    if (c.isMesh) c.material = new THREE.MeshLambertMaterial({ map: tex });
  });
}


// ═══════════════════════════════════════════════════════════════════════════════
export async function buildScene(gl, opts = {}) {

  // ── Renderer ──────────────────────────────────────────────────────────────
  const renderer = new Renderer({ gl });
  if (renderer.domElement) {
    const el = renderer.domElement;
    if (!el.parentElement) el.parentElement = { contains: () => false };
    if (!el.ownerDocument) el.ownerDocument = { contains: () => false, body: { contains: () => false } };
    if (!el.style)         el.style         = {};
    if (!el.contains)      el.contains      = () => false;
  }
  const W = gl.drawingBufferWidth  || 1;
  const H = gl.drawingBufferHeight || 1;
  renderer.setSize(W, H);
  renderer.setClearColor(0x111827, 1);

  const scene = new THREE.Scene();

  // ── Camera ────────────────────────────────────────────────────────────────
  const aspect  = W / H;
  const portrait = aspect < 1;
  const halfH   = (BOARD_ROWS * TILE * 0.78) + (portrait ? 7.5 : 2.5);
  const halfW   = halfH * aspect;
  const camera  = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, -100, 100);

  const CAMERA_RADIUS = Math.hypot(12, 12);
  const CAMERA_ELEV   = 14;
  const cameraState   = { azimuth: Math.PI / 4 };
  camera.position.set(12, CAMERA_ELEV, 12);
  camera.lookAt(0, 0, 0);

  // ── Lighting ──────────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x3c4a5a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff5d6, 1.4);
  sun.position.set(8, 14, 5);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xa8c8ff, 0.4);
  rim.position.set(-6, 6, -6);
  scene.add(rim);

  // ── Collect GLB keys ──────────────────────────────────────────────────────
  const usedKeys = new Set();
  BOARD_CELLS.forEach(([, , rawBase, ...keys]) => {
    usedKeys.add(resolveKey(parseStackKey(rawBase).key));
    keys.forEach(k => usedKeys.add(resolveKey(parseStackKey(k).key)));
  });
  PATH_CELLS.forEach(([, , type]) => { if (PATH_TYPE_GLB[type]) usedKeys.add(PATH_TYPE_GLB[type]); });

  // Enemy characters are now Lottie 2D sprites — no GLBs needed.

  // Always load all weapon types for runtime tower building (including ice tower crystal)
  ['weapon-cannon', 'weapon-catapult', 'weapon-ballista', 'weapon-turret', 'tower-round-crystals'].forEach(k => usedKeys.add(k));
  // Always load all ammo models for in-flight projectiles
  ['weapon-ammo-arrow', 'weapon-ammo-cannonball', 'weapon-ammo-boulder', 'weapon-ammo-bullet'].forEach(k => usedKeys.add(k));

  // Always load tower structure variants
  ['round', 'square'].forEach(shape => {
    ['bottom', 'middle', 'roof'].forEach(part => {
      ['a', 'b', 'c'].forEach(v => usedKeys.add(`tower-${shape}-${part}-${v}`));
    });
  });

  const keysToLoad = [...usedKeys].filter(k => ALL_GLBS[k]);

  let colormap = null;
  const models = {};
  const urlRedirects = {};
  const glbManager = new THREE.LoadingManager();
  const onProgress = opts.onProgress ?? null;
  _dbgLog = opts.dbgLog ?? null;

  // Progress: 1 colormap texture + all GLBs
  const totalItems = 1 + keysToLoad.length;
  let   doneItems  = 0;
  function reportProgress() {
    if (onProgress) onProgress(doneItems, totalItems);
  }
  function onTextureLoaded() { doneItems += 1; reportProgress(); }
  function onOneLoaded()     { doneItems += 1; reportProgress(); }

  // ── Stub image loader (native only) ──────────────────────────────────────
  // On React Native, `global.Image` is the RN Image component, not an
  // HTMLImageElement. THREE's ImageLoader sets img.src and waits for onload,
  // which never fires on RN → every GLB hangs. We stub out all image loads
  // and then override materials after the GLB parses.
  // On web the browser's native <img> path works perfectly, so we skip the
  // stub and let GLTFLoader load textures naturally (correct flipY, colorSpace).
  const STUB_TEXTURE = new THREE.Texture();
  STUB_TEXTURE.image = { width: 1, height: 1 };
  const stubImageLoader = {
    load(url, onLoad) {
      setTimeout(() => onLoad(STUB_TEXTURE.clone()), 0);
    },
    loadAsync(url) {
      return new Promise(resolve => this.load(url, resolve));
    },
  };
  if (Platform.OS !== 'web') {
    glbManager.addHandler(/\.(png|jpg|jpeg|webp|gif)$/i, stubImageLoader);
  }

  async function loadAllInParallel(keys) {
    await Promise.all(
      keys.map(k => loadGLBSafe(ALL_GLBS[k], k, 30000, glbManager).then(result => {
        if (result) {
          applyColormap(result, colormap);
          models[k] = result;
        }
        onOneLoaded();
      }).catch(e => {
        console.warn(`[scene3d] GLB failed: ${k}`, e?.message ?? e);
        onOneLoaded();
      }))
    );
  }

  try {
    const cmAsset = Asset.fromModule(require('./assets/tdkit/Textures/colormap.png'));

    // Download and load the terrain colormap texture.
    await cmAsset.downloadAsync();
    const cmUri = cmAsset.localUri ?? cmAsset.uri;
    if (cmUri) urlRedirects['colormap.png'] = cmUri;
    if (Platform.OS === 'web') {
      colormap = await new Promise(resolve => {
        new THREE.TextureLoader().load(cmUri, t => resolve(t), undefined, () => resolve(null));
      });
    } else {
      const tex = new THREE.Texture();
      tex.image       = { localUri: cmUri, width: cmAsset.width ?? 512, height: cmAsset.height ?? 512 };
      tex.flipY       = false;
      tex.colorSpace  = THREE.NoColorSpace;
      tex.needsUpdate = true;
      colormap = tex;
    }
    if (colormap) colormap.flipY = false;
    onTextureLoaded();
    dlog(`[textures] colormap=${colormap ? 'OK' : 'null'}`);

    glbManager.setURLModifier(url => {
      const filename = url.split('/').pop();
      return urlRedirects[filename] ?? url;
    });

    await loadAllInParallel(keysToLoad);
  } catch (e) {
    console.warn('[scene3d] load error:', e?.message ?? e);
  }

  // ── Placement helpers ─────────────────────────────────────────────────────
  function getModel(key) { return models[resolveKey(key)]; }

  function placeTile(col, row, key, rotY = 0) {
    const { x, z } = tileToWorld(col, row);
    const mdl = getModel(key);
    if (mdl) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0, z);
      pivot.rotation.y = rotY;
      const obj = cloneModel(mdl);
      obj.scale.setScalar(TILE);
      pivot.add(obj);
      scene.add(pivot);
      return pivot;
    }
    const FBCOL = {
      'tile-river-straight': 0x3dafde, 'tile-tree': 0x4fa94f,
      'tile-tree-double': 0x4fa94f, 'tile-rock': 0x8a9ab0,
      'tile-crystal': 0xd966ee, 'tile-spawn-round': 0x9b30e0,
    };
    const fb = new THREE.Mesh(
      new THREE.BoxGeometry(TILE * 0.97, 0.28, TILE * 0.97),
      new THREE.MeshLambertMaterial({ color: FBCOL[resolveKey(key)] ?? 0x6dc56d }),
    );
    fb.position.set(x, 0.14, z);
    scene.add(fb);
    return fb;
  }

  function placeAtY(col, row, key, y, scale, rotY = 0) {
    const mdl = getModel(key);
    if (!mdl) return;
    const { x, z } = tileToWorld(col, row);
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, z);
    pivot.rotation.y = rotY;
    const obj = cloneModel(mdl);
    obj.scale.setScalar(scale ?? TILE);
    obj.position.y = y;
    pivot.add(obj);
    scene.add(pivot);
  }

  // ── Modular tower builder ─────────────────────────────────────────────────
  function buildModularTower(group, bottomKey, middleKey, roofKey) {
    [[bottomKey, 0], [middleKey, PART_H[bottomKey] ?? 0],
     [roofKey, (PART_H[bottomKey] ?? 0) + (PART_H[middleKey] ?? 0)]
    ].forEach(([k, yOff]) => {
      const mdl = getModel(k);
      if (!mdl) return;
      const m = cloneModel(mdl);
      m.scale.setScalar(TILE);
      m.position.y = yOff;
      group.add(m);
    });
  }

  // ── Decorative castle builder (square towers on castle edge) ─────────────
  function placeCastle(col, row, variant = 'a') {
    const { x, z }    = tileToWorld(col, row);
    const castleGroup = new THREE.Group();
    castleGroup.position.set(x, TILE_H, z);
    scene.add(castleGroup);

    const bKey = `tower-square-bottom-${variant}`;
    const mKey = `tower-square-middle-${variant}`;
    const rKey = `tower-square-roof-${variant}`;
    if (getModel(bKey) && getModel(mKey) && getModel(rKey)) {
      buildModularTower(castleGroup, bKey, mKey, rKey);
    } else {
      const keep = new THREE.Mesh(
        new THREE.BoxGeometry(TILE * 0.9, 1.4, TILE * 0.9),
        new THREE.MeshLambertMaterial({ color: 0x7a838e }),
      );
      keep.position.y = 0.7;
      castleGroup.add(keep);
    }
    const flagH = (PART_H[bKey] ?? 0) + (PART_H[mKey] ?? 0) + (PART_H[rKey] ?? 0);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.15),
      new THREE.MeshLambertMaterial({ color: 0xfbbf24, side: THREE.DoubleSide }),
    );
    flag.position.set(0.15, flagH + 0.1, 0);
    flag.userData.isFlag = true;
    castleGroup.add(flag);
  }

  // ── Runtime tower builder (called both at startup and when player places) ─
  // Uses square bottom + middle (no conical roof) so the weapon model on top
  // is the dominant visual — clearly readable as the tower's type.
  // Returns { slotId, col, row, x, z, towerGroup, weaponGroup }
  const towerSlotRings = new Array(TOWER_SLOTS.length).fill(null);

  function buildTowerMesh(slotId, col, row, towerTypeKey) {
    const { x, z } = tileToWorld(col, row);
    const towerGroup = new THREE.Group();
    towerGroup.position.set(x, TILE_H, z);
    scene.add(towerGroup);

    // Square base + one middle section — flat top so weapon is clearly visible
    const bKey = 'tower-square-bottom-a';
    const mKey = 'tower-square-middle-a';
    const bH   = PART_H[bKey] ?? (0.50 * TILE);
    const mH   = PART_H[mKey] ?? (0.50 * TILE);

    if (getModel(bKey) && getModel(mKey)) {
      [[bKey, 0], [mKey, bH]].forEach(([k, yOff]) => {
        const mdl = getModel(k);
        if (!mdl) return;
        const m = cloneModel(mdl);
        m.scale.setScalar(TILE);
        m.position.y = yOff;
        towerGroup.add(m);
      });
    } else {
      // Primitive fallback — chunky box
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(TILE * 0.78, bH + mH, TILE * 0.78),
        new THREE.MeshLambertMaterial({ color: 0x7a838e }),
      );
      box.position.y = (bH + mH) / 2;
      towerGroup.add(box);
    }

    // Weapon sits right on top of the tower — scaled large so it reads clearly
    const weaponGlbKey = TOWER_WEAPON_GLB[towerTypeKey] ?? 'weapon-cannon';
    const weaponHeight = bH + mH + 0.05;
    const weaponGroup  = new THREE.Group();
    weaponGroup.position.set(0, weaponHeight, 0);
    const weaponMdl = getModel(weaponGlbKey);
    if (weaponMdl) {
      const wm = cloneModel(weaponMdl);
      wm.scale.setScalar(TILE * 1.15); // larger scale = clearly visible weapon
      weaponGroup.add(wm);
    }
    towerGroup.add(weaponGroup);

    // Hide the slot ring now that a tower occupies this spot
    const ring = towerSlotRings[slotId];
    if (ring) ring.visible = false;

    return { slotId, col, row, x, z, towerGroup, weaponGroup };
  }

  // ── Place all BOARD_CELLS ─────────────────────────────────────────────────
  for (const entry of BOARD_CELLS) {
    const [col, row, rawBaseKey, ...stackKeys] = entry;
    const { key: baseKey, rotY } = parseStackKey(rawBaseKey);
    placeTile(col, row, baseKey, rotY);

    const resolvedStack = stackKeys.map(raw => resolveKey(parseStackKey(raw).key));

    const roundMarker  = resolvedStack.find(k => /^tower-round-(top|build)-[a-f]$/.test(k));
    const squareMarker = resolvedStack.find(k => /^tower-square-(top|build)-[a-f]$/.test(k));

    if (roundMarker) {
      // Decorative round tower (not a game tower) — just render it
      const variant  = roundMarker.match(/-([a-c])$/)?.[1] ?? 'a';
      const { x, z } = tileToWorld(col, row);
      const tg = new THREE.Group();
      tg.position.set(x, TILE_H, z);
      scene.add(tg);
      buildModularTower(tg, `tower-round-bottom-${variant}`, `tower-round-middle-${variant}`, `tower-round-roof-${variant}`);
    } else if (squareMarker) {
      const variant = squareMarker.match(/-([a-c])$/)?.[1] ?? 'a';
      placeCastle(col, row, variant);
    } else {
      let stackTop = TILE_H;
      for (const rawKey of stackKeys) {
        const { key: bk, rotY: itemRotY } = parseStackKey(rawKey);
        const key = resolveKey(bk);
        placeAtY(col, row, key, stackTop, undefined, itemRotY);
        stackTop += PART_H[key] ?? PART_H[bk] ?? 0;
      }
    }
  }

  // ── Portal glow disc at spawn ─────────────────────────────────────────────
  const [spawnC, spawnR] = PATH_CELLS[0];
  const { x: spX, z: spZ } = tileToWorld(spawnC, spawnR);
  const portalDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.30, 0.30, 0.06, 20),
    new THREE.MeshLambertMaterial({
      color: 0x9b30e0, emissive: 0xc040ff, emissiveIntensity: 1.0,
      transparent: true, opacity: 0.88,
    }),
  );
  portalDisc.position.set(spX, TILE_H + 0.52, spZ);
  scene.add(portalDisc);

  // ── Tower slot rings — blue rings on empty buildable slots ────────────────
  TOWER_SLOTS.forEach(slot => {
    const isStarting = STARTING_TOWER_SLOT_IDS.includes(slot.id);
    if (isStarting) {
      // Starting slots get pre-built towers; no ring needed
      towerSlotRings[slot.id] = null;
      return;
    }
    const { x, z } = tileToWorld(slot.col, slot.row);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(TILE * 0.36, TILE * 0.50, 36),
      new THREE.MeshLambertMaterial({
        color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.6,
        transparent: true, opacity: 0.30, side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, TILE_H + 0.06, z);
    scene.add(ring);
    towerSlotRings[slot.id] = ring;
  });

  // ── Pre-build any starting towers (empty by default — all earned via Q&A) ──
  const startingTowers = [];
  for (const slotId of STARTING_TOWER_SLOT_IDS) {
    const slot = TOWER_SLOTS.find(s => s.id === slotId);
    if (slot) {
      const td = buildTowerMesh(slotId, slot.col, slot.row, 'arrow');
      startingTowers.push(td);
    }
  }

  // ── Debug tile labels ─────────────────────────────────────────────────────
  // Set to true to show col,row coordinates on every tile.
  // Useful for editing boardConfig.js / TOWER_SLOTS.
  // Labels are canvas sprites — works in web preview; silently skipped on native.
  const DEBUG_TILE_LABELS = false;
  if (DEBUG_TILE_LABELS) {
    const pathSet  = new Set(PATH_CELLS.map(([c, r]) => `${c},${r}`));
    const slotSet  = new Set(TOWER_SLOTS.map(s => `${s.col},${s.row}`));
    const startSet = new Set(
      STARTING_TOWER_SLOT_IDS
        .map(id => TOWER_SLOTS.find(s => s.id === id))
        .filter(Boolean)
        .map(s => `${s.col},${s.row}`),
    );

    BOARD_CELLS.forEach(([col, row]) => {
      try {
        const key     = `${col},${row}`;
        const isPath  = pathSet.has(key);
        const isSlot  = slotSet.has(key);
        const isStart = startSet.has(key);

        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Background tint by tile category
        ctx.fillStyle = isPath  ? 'rgba(180,60,0,0.50)'
                      : isStart ? 'rgba(22,163,74,0.55)'
                      : isSlot  ? 'rgba(56,189,248,0.45)'
                      : 'rgba(0,0,0,0.38)';
        ctx.fillRect(0, 0, 128, 128);

        // Border colour
        ctx.strokeStyle = isPath  ? '#ff8800'
                        : isStart ? '#4ade80'
                        : isSlot  ? '#38bdf8'
                        : '#ffff00';
        ctx.lineWidth = 5;
        ctx.strokeRect(3, 3, 122, 122);

        // Coordinate label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${col},${row}`, 64, 52);

        // Category tag
        const tag = isPath ? 'PATH' : isStart ? 'START' : isSlot ? 'SLOT' : '';
        if (tag) {
          ctx.font = 'bold 28px monospace';
          ctx.fillText(tag, 64, 92);
        }

        const tex    = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: tex, depthTest: false }),
        );
        const { x, z } = tileToWorld(col, row);
        sprite.position.set(x, TILE_H + 0.82, z);
        sprite.scale.set(0.92, 0.92, 1);
        scene.add(sprite);
      } catch (_) { /* canvas unavailable in native — silently skip */ }
    });
  }

  return {
    renderer, scene, camera, cameraState,
    CAMERA_RADIUS, CAMERA_ELEV,
    models, projectiles: [],
    portalDisc,
    towerSlotRings,
    startingTowers,
    buildTowerMesh,
  };
}
