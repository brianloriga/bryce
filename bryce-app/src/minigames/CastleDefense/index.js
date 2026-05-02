// Polyfill must run before any three/expo-three related code
import './polyfills';

/**
 * Castle Defense — Tower Defense Edition
 *
 * Gameplay:
 *   1. 5 waves of enemies auto-spawn from the portal and walk toward the castle.
 *   2. 3 Arrow Towers are pre-built; answer questions to unlock new tower types.
 *   3. Correct answer → earn a build token (cycles: Cannon → Catapult → Turret).
 *      Press "Place [Tower]" then tap a blue ring to build it.
 *   4. Wrong answer  → frontmost enemy leaps forward 3 waypoints.
 *   5. Towers auto-fire at enemies in range (targeting the one closest to castle).
 *   6. Enemy HP: Goblin=1, Dark Knight=2, Giant=3.
 *   7. Enemies reaching the castle → lose 1 heart (3 max).
 *   8. Survive all 5 waves → Victory. Castle HP=0 → Defeat.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Animated, Platform, ScrollView,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GLView } from 'expo-gl';
import { Audio } from 'expo-av';
import * as THREE from 'three';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';

import {
  ENEMY_TYPES, TOWER_TYPES, WAVE_DEFS, TOTAL_WAVES, PICKABLE_TOWERS,
} from './gameData';
import {
  WAYPOINTS, PATH_A_WAYPOINTS, PATH_B_WAYPOINTS,
  tileToWorld, TILE_H, TILE, BOARD_COLS, BOARD_ROWS,
  TOWER_SLOTS, STARTING_TOWER_SLOT_IDS,
} from './boardConfig';
import { buildScene, cloneModel, MONSTER_GLB_KEY } from './scene3d';
import { buildPrimitiveEnemy } from './enemies';

// ── Constants ──────────────────────────────────────────────────────────────
const CASTLE_MAX_HP       = 3;
const OPTION_LABELS       = ['A', 'B', 'C', 'D'];
const OPTION_COLORS       = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

const TOWER_BADGE_COLORS  = { arrow: '#92400e', cannon: '#dc2626', catapult: '#7c3aed', turret: '#0284c7', ice: '#0891b2' };
const TOWER_BADGE_LABELS  = { arrow: 'ARW', cannon: 'CAN', catapult: 'CAT', turret: 'TUR', ice: 'ICE' };

// Towers unlocked progressively as waves increase (1-indexed wave → available set)
const WAVE_TOWER_UNLOCKS = [
  ['arrow'],                               // Wave 1 — arrow only
  ['arrow', 'cannon'],                     // Wave 2
  ['arrow', 'cannon', 'catapult'],         // Wave 3
  ['arrow', 'cannon', 'catapult', 'ice'],  // Wave 4+
];

// HP multiplier per wave (1-indexed)
const WAVE_HP_MULT = [1, 2, 3, 4, 5];
const WALK_MS             = Platform.OS === 'web' ? 500 : 1000; // mobile walks slower
const RESOLVE_MS          = 4000;
const MONSTER_AUTO_STEP_MS = Platform.OS === 'web' ? 620 : 1240; // mobile: half-speed
const MAX_MONSTERS        = 24;
const QUESTION_TIMER_MS   = 8000;
const WAVE_SPAWN_GAP_MS   = 200; // gap between reading gapMs from WAVE_DEFS
const BETWEEN_WAVE_MS     = 8000;
const FLOAT_MS            = 1400;
const TOTAL_QUESTIONS     = 20; // question pool loop max

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ═══════════════════════════════════════════════════════════════════════════
// GameEngine
// ═══════════════════════════════════════════════════════════════════════════
function GameEngine({ questions, onFinish, playerName }) {
  // Build an infinite question pool that loops through shuffled questions
  const pool = useMemo(() => {
    const base = shuffleArr(questions);
    const out  = [];
    while (out.length < TOTAL_QUESTIONS) {
      const q = base[out.length % base.length];
      const indices = q.options.map((_, idx) => idx);
      for (let j = indices.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [indices[j], indices[k]] = [indices[k], indices[j]];
      }
      out.push({
        ...q,
        options:      indices.map(idx => q.options[idx]),
        correctIndex: indices.indexOf(q.correctIndex ?? 0),
      });
    }
    return out;
  }, [questions]);

  // ── Mutable game state ────────────────────────────────────────────────────
  const gs = useRef({
    monsters:       [],
    towers:         [],        // active game towers (auto-firing)
    towerSlotFilled:{},        // slotId → true
    nextId:         1,
    castleHp:       CASTLE_MAX_HP,
    score:          0,
    qIdx:           0,
    waveIdx:        0,         // 1-based, 0 = not started
    waveActive:     false,
    waveDone:       false,
    waveSpawnQueue: [],
    nextSpawnTime:  0,
    nextWaveTime:   0,
    buildToken:     null,      // null | tower type key
    pendingResolve: null,
    done:           false,
  }).current;

  // ── React state (for UI renders) ──────────────────────────────────────────
  const [castleHp,       setCastleHp]       = useState(CASTLE_MAX_HP);
  const [score,          setScore]          = useState(0);
  const [phase,          setPhase]          = useState('LOADING');
  const [currentQ,       setCurrentQ]       = useState(null);
  const [selectedIdx,    setSelectedIdx]    = useState(null);
  const [feedback,       setFeedback]       = useState(null);
  const [toast,          setToast]          = useState(null);
  const [buildToken,        setBuildToken]        = useState(null);
  const [buildMode,         setBuildMode]         = useState(false);
  const [towerChoicePending,setTowerChoicePending] = useState(false);
  const [timeLeft,       setTimeLeft]       = useState(QUESTION_TIMER_MS);
  const [waveNum,        setWaveNum]        = useState(0);
  const [floats,         setFloats]         = useState([]);
  const [wavePreview,    setWavePreview]    = useState(null);  // wave def to preview before start
  const [waveIntro,      setWaveIntro]      = useState(null);  // {waveDef, waveIdx} for pre-wave Lottie intro
  const [selectedTowerSlot, setSelectedTowerSlot] = useState(null); // slotId of tapped placed tower
  const [loadPct,        setLoadPct]        = useState(0);
  const [dbgLines,       setDbgLines]       = useState([]);
  const [monsterSprites, setMonsterSprites] = useState([]);
  const [deathSprites,   setDeathSprites]   = useState([]);
  const [muteBgm,        setMuteBgm]        = useState(false);
  const [muteSfx,        setMuteSfx]        = useState(false);
  const muteSfxRef = useRef(false);
  const spritesRef     = useRef([]);
  const deathSpritesRef = useRef([]);  // [{id, x, y, startedAt}]
  const timerRef        = useRef(null);
  const floatIdRef      = useRef(0);
  const rangeRingsRef   = useRef([]);  // THREE.Mesh[] range preview rings

  // Refs for animate-loop access without stale closures
  const phaseRef               = useRef('LOADING');
  const buildModeRef           = useRef(false);
  const towerChoicePendingRef  = useRef(false);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { towerChoicePendingRef.current = towerChoicePending; }, [towerChoicePending]);

  const sceneRef  = useRef(null);
  const aliveRef  = useRef(true);
  const glDimsRef = useRef({ width: 1, height: 1 });

  useEffect(() => () => { aliveRef.current = false; }, []);

  // Sync Lottie sprite positions from animation loop refs at ~20fps.
  useEffect(() => {
    const id = setInterval(() => {
      setMonsterSprites(spritesRef.current.slice());
      setDeathSprites(deathSpritesRef.current.slice());
    }, 50);
    return () => clearInterval(id);
  }, []);

  // ── Audio setup ────────────────────────────────────────────────────────────
  const sfxRef = useRef({});  // keyed by tower type
  const bgmRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });

        // Background music (looping, quiet)
        const { sound: bgm } = await Audio.Sound.createAsync(
          require('./sounds/backgroundmusic.mp3'),
          { isLooping: true, volume: 0.3 },
        );
        if (!cancelled) { bgmRef.current = bgm; await bgm.playAsync(); }

        // Tower SFX — preloaded so first fire has no delay
        const sfxSources = {
          arrow:    require('./sounds/arrowshooting.mp3'),
          cannon:   require('./sounds/cannonshooting.mp3'),
          catapult: require('./sounds/catapultshooting.mp3'),
          turret:   require('./sounds/arrowshooting.mp3'),
          ice:      require('./sounds/icetowershot.mp3'),
        };
        for (const [key, src] of Object.entries(sfxSources)) {
          if (cancelled) break;
          const { sound } = await Audio.Sound.createAsync(src, { volume: 0.65 });
          sfxRef.current[key] = sound;
        }
      } catch (e) {
        console.warn('[audio] setup failed:', e?.message ?? e);
      }
    })();
    return () => {
      cancelled = true;
      bgmRef.current?.unloadAsync().catch(() => {});
      Object.values(sfxRef.current).forEach(s => s.unloadAsync().catch(() => {}));
    };
  }, []);

  // ── Pause question timer while wave intro is on screen ───────────────────
  useEffect(() => {
    if (waveIntro) stopTimer();
    // Timer is restarted in the onStart callback below, so nothing more needed here
  }, [waveIntro]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audio mute sync ───────────────────────────────────────────────────────
  useEffect(() => {
    bgmRef.current?.setVolumeAsync(muteBgm ? 0 : 0.3).catch(() => {});
  }, [muteBgm]);

  useEffect(() => { muteSfxRef.current = muteSfx; }, [muteSfx]);

  // ── Timer ─────────────────────────────────────────────────────────────────
  function startTimer() {
    clearInterval(timerRef.current);
    setTimeLeft(QUESTION_TIMER_MS);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const left = Math.max(0, QUESTION_TIMER_MS - (Date.now() - start));
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(timerRef.current);
        if (phaseRef.current === 'QUESTION') autoWrong();
      }
    }, 80);
  }

  function stopTimer() {
    clearInterval(timerRef.current);
    setTimeLeft(0);
  }

  function autoWrong() {
    setFeedback('wrong');
    setPhase('RESOLVING');
    addFloat('TOO SLOW!', '#ef4444', 'center');
    spawnPenaltyMonster();
    clearTimeout(gs.pendingResolve);
    gs.pendingResolve = setTimeout(() => onResolveFinished(false), RESOLVE_MS);
  }

  // ── Floating text ─────────────────────────────────────────────────────────
  function addFloat(text, color = '#fbbf24', side = 'right') {
    const id = floatIdRef.current++;
    setFloats(prev => [...prev, { id, text, color, side }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), FLOAT_MS);
  }

  // ── Path helpers ──────────────────────────────────────────────────────────
  function getWaypoints(pathKey) {
    return pathKey === 'A' ? PATH_A_WAYPOINTS : PATH_B_WAYPOINTS;
  }

  function getTileXZ(waypointArr, idx) {
    const clamped = Math.max(0, Math.min(waypointArr.length - 1, idx));
    const [c, r] = waypointArr[clamped];
    return tileToWorld(c, r);
  }

  // ── Enemy mesh factory ────────────────────────────────────────────────────
  function createEnemyMesh(typeKey) {
    const sr = sceneRef.current;
    if (!sr) return null;
    const eDef    = ENEMY_TYPES[typeKey] ?? ENEMY_TYPES.goblin;
    const glbKey  = MONSTER_GLB_KEY[typeKey];
    const template = glbKey ? sr.models[glbKey] : null;
    if (template) {
      const m = cloneModel(template);
      m.scale.setScalar(eDef.scale);
      return m;
    }
    return buildPrimitiveEnemy(typeKey);
  }

  // ── Spawn a monster ───────────────────────────────────────────────────────
  function spawnMonster(typeKey) {
    if (gs.done) return;
    const sr = sceneRef.current;
    if (!sr || gs.monsters.length >= MAX_MONSTERS) return;

    const eDef   = ENEMY_TYPES[typeKey] ?? ENEMY_TYPES.goblin;
    const pathKey = Math.random() < 0.5 ? 'A' : 'B';
    const wp     = getWaypoints(pathKey);
    const mesh   = createEnemyMesh(typeKey);
    const { x, z } = getTileXZ(wp, 0);

    // Alternate lane side each spawn so monsters walk in parallel, not stacked.
    const laneSign   = gs.nextId % 2 === 0 ? 1 : -1;
    const laneOffset = laneSign * 0.19;

    if (mesh) {
      mesh.visible = false; // hidden — Lottie 2D sprite overlay handles rendering

      // Set initial lane position using the first segment direction
      const p0   = getTileXZ(wp, 0);
      const p1   = getTileXZ(wp, 1);
      const dx0  = p1.x - p0.x;
      const dz0  = p1.z - p0.z;
      const mag0 = Math.sqrt(dx0 * dx0 + dz0 * dz0) || 1;
      mesh.position.set(
        x + (-dz0 / mag0) * laneOffset,
        TILE_H + 0.15,
        z + ( dx0 / mag0) * laneOffset,
      );


      // ── Boss: glowing ring on the ground ──────────────────────────────────
      if (typeKey === 'boss') {
        const bossRing = new THREE.Mesh(
          new THREE.RingGeometry(TILE * 0.30, TILE * 0.52, 32),
          new THREE.MeshLambertMaterial({
            color: 0xff4500, emissive: 0xff2200, emissiveIntensity: 1.8,
            transparent: true, opacity: 0.85, side: THREE.DoubleSide,
          }),
        );
        bossRing.rotation.x = -Math.PI / 2;
        bossRing.position.y = -(TILE_H + 0.12);  // relative to mesh (which sits at TILE_H)
        mesh.add(bossRing);
        mesh.userData.bossRing = bossRing;
      }

      sr.scene.add(mesh);
    }

    const hpMult  = WAVE_HP_MULT[Math.min(gs.waveIdx - 1, WAVE_HP_MULT.length - 1)] ?? 1;
    const scaledHp = Math.ceil(eDef.hp * hpMult);

    gs.monsters.push({
      id:           gs.nextId++,
      typeKey,
      pathKey,
      waypointIdx:  0,
      mesh,
      hp:           scaledHp,
      maxHp:        scaledHp,
      speed:        eDef.speed,
      laneOffset,
      perpX:        0,
      perpZ:        0,
      walkFrom:     null,
      walkTo:       null,
      walkStart:    0,
      lastAutoStep: Date.now() - Math.round(MONSTER_AUTO_STEP_MS / eDef.speed) + 150,
      dying:        false,
      deathStart:   0,
      slowedUntil:  0,   // timestamp until which this enemy is slowed
    });
  }

  // ── Wave management ───────────────────────────────────────────────────────
  function startNextWave() {
    if (gs.done || gs.waveIdx >= TOTAL_WAVES) return;
    gs.waveIdx += 1;
    setWaveNum(gs.waveIdx);
    const wDef = WAVE_DEFS[gs.waveIdx - 1];
    gs.waveSpawnQueue = [...wDef.enemies];
    gs.waveActive     = true;
    gs.waveDone       = false;
    gs.nextSpawnTime  = Date.now() + 800;

    addFloat(`Wave ${gs.waveIdx}!`, '#f59e0b', 'center');
    setToast({ type: 'wrong', text: `${wDef.label} — ${wDef.enemies.length} enemies incoming!` });
    setTimeout(() => setToast(t => t?.text?.includes(wDef.label) ? null : t), 2500);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  }

  function onWaveComplete() {
    if (gs.done) return;
    addFloat(`Awesome job, ${playerName}!`, '#4ade80', 'center');

    if (gs.waveIdx >= TOTAL_WAVES) {
      setTimeout(() => { if (!gs.done) finishGame(true); }, 1500);
    } else {
      gs.nextWaveTime = 0; // disable animate-loop auto-start; intro panel calls startNextWave
      setToast({ type: 'correct', text: `Wave ${gs.waveIdx} cleared! Get ready for Wave ${gs.waveIdx + 1}, ${playerName}!` });
      setTimeout(() => setToast(null), 2500);
      // Show wave intro panel after a short breather
      const nextWaveIdx = gs.waveIdx + 1;
      const nextDef = WAVE_DEFS[nextWaveIdx - 1];
      if (nextDef) {
        setTimeout(() => {
          if (!gs.done) setWaveIntro({ waveDef: nextDef, waveIdx: nextWaveIdx });
        }, 1500);
      }
    }
  }

  function checkWaveCompletion() {
    if (!gs.waveActive || gs.waveDone) return;
    const alive = gs.monsters.filter(m => !m.dying).length;
    if (gs.waveSpawnQueue.length === 0 && alive === 0) {
      gs.waveDone   = true;
      gs.waveActive = false;
      onWaveComplete();
    }
  }

  // ── Kill an enemy ─────────────────────────────────────────────────────────
  function killMonster(m) {
    if (m.dying) return;
    m.dying      = true;
    m.deathStart = Date.now();
  }

  // ── Deal damage to an enemy (respects armor immunities) ─────────────────
  function damageMonster(m, damage, towerTypeKey = null) {
    if (m.dying) return;
    const eDef = ENEMY_TYPES[m.typeKey];
    if (towerTypeKey && eDef?.immuneTo?.includes(towerTypeKey)) {
      addFloat('BLOCKED!', '#94a3b8', 'left');
      return;
    }
    m.hp -= damage;
    if (m.hp <= 0) {
      killMonster(m);
      gs.score += (eDef?.scoreValue ?? 10);
      setScore(gs.score);
      addFloat(`+${eDef?.scoreValue ?? 10}`, '#4ade80', 'right');
    }
  }

  // ── Spawn a penalty monster on wrong answer / timeout ────────────────────
  // Picks an enemy type from the current wave pool so difficulty scales properly.
  function spawnPenaltyMonster() {
    const wDef      = gs.waveIdx > 0 ? WAVE_DEFS[Math.min(gs.waveIdx - 1, WAVE_DEFS.length - 1)] : null;
    const pool      = wDef ? wDef.enemies : ['goblin'];
    const typeKey   = pool[Math.floor(Math.random() * pool.length)];
    spawnMonster(typeKey);
  }

  // ── Correct answer → show tower picker ───────────────────────────────────
  function earnBuildToken() {
    setTowerChoicePending(true);
    addFloat('Pick a tower!', '#fbbf24', 'center');
  }

  // ── Player picks a tower type from the picker ─────────────────────────────
  function selectTowerType(type) {
    const tDef = TOWER_TYPES[type];
    gs.buildToken = type;
    setBuildToken(type);
    setTowerChoicePending(false);
    buildModeRef.current = true;
    setBuildMode(true);
    showRangeRings(type);
    setToast({ type: 'correct', text: `Tap a blue spot to place your ${tDef.name}!` });
    setTimeout(() => setToast(null), 2200);
  }

  // ── Range preview rings ───────────────────────────────────────────────────
  function showRangeRings(towerTypeKey) {
    clearRangeRings();
    const sr = sceneRef.current;
    if (!sr) return;
    const tDef = TOWER_TYPES[towerTypeKey];
    if (!tDef) return;
    TOWER_SLOTS.forEach(slot => {
      if (gs.towerSlotFilled[slot.id]) return;
      const { x, z } = tileToWorld(slot.col, slot.row);

      // Dark-blue placement disc — marks available tower slots
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.34, 48),
        new THREE.MeshBasicMaterial({
          color: 0x0033aa, transparent: true, opacity: 0.90, side: THREE.DoubleSide,
        }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x, TILE_H + 0.08, z);
      sr.scene.add(disc);
      rangeRingsRef.current.push(disc);
    });
  }

  function clearRangeRings() {
    const sr = sceneRef.current;
    if (sr) rangeRingsRef.current.forEach(r => sr.scene.remove(r));
    rangeRingsRef.current = [];
  }

  // ── Toggle build placement mode ───────────────────────────────────────────
  function toggleBuildMode() {
    if (!gs.buildToken) return;
    const next = !buildModeRef.current;
    buildModeRef.current = next;
    setBuildMode(next);
    if (!next) clearRangeRings();
  }

  // ── Place a tower at a slot ───────────────────────────────────────────────
  function placeTowerAtSlot(slot) {
    const sr = sceneRef.current;
    if (!sr || !gs.buildToken) return;

    const td = sr.buildTowerMesh(slot.id, slot.col, slot.row, gs.buildToken);
    const tDef = TOWER_TYPES[gs.buildToken];

    gs.towers.push({
      slotId:      slot.id,
      col:         slot.col,
      row:         slot.row,
      type:        gs.buildToken,
      x:           td.x,
      z:           td.z,
      towerGroup:  td.towerGroup,
      weaponGroup: td.weaponGroup,
      lastFire:    0,
      level:       1,
    });
    gs.towerSlotFilled[slot.id] = true;
    clearRangeRings();
    setSelectedTowerSlot(null);

    addFloat(`${tDef.name} Built!`, '#22c55e', 'right');
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setToast({ type: 'correct', text: `${tDef.name} built!` });
    setTimeout(() => setToast(null), 1500);

    gs.buildToken = null;
    setBuildToken(null);
    buildModeRef.current = false;
    setBuildMode(false);
  }

  // ── Sell a placed tower ───────────────────────────────────────────────────
  function sellTower(slotId) {
    const sr  = sceneRef.current;
    const idx = gs.towers.findIndex(t => t.slotId === slotId);
    if (idx === -1) return;
    const tower = gs.towers[idx];
    if (sr) {
      if (tower.towerGroup) sr.scene.remove(tower.towerGroup);
      // Restore the slot ring
      if (sr.towerSlotRings?.[slotId]) sr.towerSlotRings[slotId].visible = true;
    }
    gs.towers.splice(idx, 1);
    gs.towerSlotFilled[slotId] = false;
    setSelectedTowerSlot(null);
    // Give back a free tower choice
    setTowerChoicePending(true);
    addFloat('Sold! Pick a new tower', '#fbbf24', 'center');
  }

  // ── Upgrade a placed tower (free, once per tower) ─────────────────────────
  function upgradeTower(slotId) {
    const tower = gs.towers.find(t => t.slotId === slotId);
    if (!tower || (tower.level ?? 1) >= 2) return;
    tower.level = 2;
    setSelectedTowerSlot(null);
    addFloat('Tower Upgraded!', '#a78bfa', 'center');
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
  }

  // ── Screen tap → tile ─────────────────────────────────────────────────────
  function screenToTile(locationX, locationY) {
    const sr = sceneRef.current;
    if (!sr) return null;
    const { width, height } = glDimsRef.current;
    const ndcX = (locationX / width)  *  2 - 1;
    const ndcY = (locationY / height) * -2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, sr.camera);
    const plane    = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TILE_H);
    const hitPoint = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hitPoint)) return null;
    const col = Math.round(hitPoint.x / TILE + (BOARD_COLS - 1) / 2);
    const row = Math.round(hitPoint.z / TILE + (BOARD_ROWS - 1) / 2);
    if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) return null;
    return { col, row };
  }

  function handleGLTap(event) {
    const tile = screenToTile(event.nativeEvent.locationX, event.nativeEvent.locationY);
    if (!tile) return;
    const { col, row } = tile;

    if (buildModeRef.current && gs.buildToken) {
      // Place tower: find closest empty slot
      let best = null;
      let bestDist = Infinity;
      TOWER_SLOTS.forEach(slot => {
        if (gs.towerSlotFilled[slot.id]) return;
        const d = Math.hypot(slot.col - col, slot.row - row);
        if (d < bestDist) { bestDist = d; best = slot; }
      });
      if (!best || bestDist > 1.5) return;
      placeTowerAtSlot(best);
    } else {
      // Select placed tower for sell/info
      let best = null;
      let bestDist = Infinity;
      gs.towers.forEach(tw => {
        const d = Math.hypot(tw.col - col, tw.row - row);
        if (d < bestDist) { bestDist = d; best = tw; }
      });
      if (best && bestDist <= 1.2) {
        setSelectedTowerSlot(prev => (prev === best.slotId ? null : best.slotId));
      } else {
        setSelectedTowerSlot(null);
      }
    }
  }

  // ── Answer handling ────────────────────────────────────────────────────────
  function handleAnswer(index) {
    if (phaseRef.current !== 'QUESTION' || feedback !== null) return;
    const q = currentQ;
    if (!q) return;
    const safeCorrect = Math.min(Math.max(q.correctIndex ?? 0, 0), (q.options?.length ?? 1) - 1);
    const isCorrect   = index === safeCorrect;

    setSelectedIdx(index);
    setFeedback(isCorrect ? 'correct' : 'wrong');
    setPhase('RESOLVING');
    stopTimer();

    if (isCorrect) {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      earnBuildToken();
      addFloat(`Great job, ${playerName}!`, '#4ade80', 'right');
    } else {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      addFloat('Wrong!', '#f87171', 'left');
      spawnPenaltyMonster();
      setToast({ type: 'wrong', text: 'New enemy spawned!' });
      setTimeout(() => setToast(t => t?.text === 'New enemy spawned!' ? null : t), 1500);
    }

    clearTimeout(gs.pendingResolve);
    gs.pendingResolve = setTimeout(() => onResolveFinished(isCorrect), RESOLVE_MS);
  }

  function onResolveFinished(wasCorrect) {
    if (gs.done) return;
    setToast(null);
    gs.qIdx++;

    // Loop questions indefinitely until waves are done
    const nextQIdx = gs.qIdx % pool.length;
    setCurrentQ(pool[nextQIdx]);
    setSelectedIdx(null);
    setFeedback(null);
    setPhase('QUESTION');
    startTimer();
  }

  function finishGame(won) {
    gs.done = true;
    clearInterval(timerRef.current);
    setPhase(won && gs.castleHp > 0 ? 'VICTORY' : 'DEFEAT');
  }

  // ── INTRO → wave 1 intro panel (questions hidden until panel dismissed) ────
  useEffect(() => {
    if (phase !== 'INTRO') return;
    const t = setTimeout(() => {
      setCurrentQ(pool[0]);
      setPhase('QUESTION');
      // Show the wave 1 intro panel immediately — question modal is hidden while
      // waveIntro is set (see render condition: phase==='QUESTION' && !waveIntro).
      // Timer is started inside the WaveIntroPanel onStart callback.
      if (!gs.done) setWaveIntro({ waveDef: WAVE_DEFS[0], waveIdx: 1 });
    }, 1500);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (gs.pendingResolve) clearTimeout(gs.pendingResolve);
    };
  }, []);

  // ── GLView → build scene + animation loop ──────────────────────────────────
  const onContextCreate = async (gl) => {
    try {
      const sr = await buildScene(gl, {
        stillAlive: () => aliveRef.current,
        onProgress: (loaded, total) => {
          if (total > 0) setLoadPct(Math.round((loaded / total) * 100));
        },
        dbgLog: (msg) => {
          setDbgLines(prev => [...prev.slice(-14), msg]);
        },
      });
      sceneRef.current = sr;

      // Register starting towers into game state
      sr.startingTowers.forEach(td => {
        gs.towers.push({
          slotId:      td.slotId,
          col:         td.col,
          row:         td.row,
          type:        'arrow',
          x:           td.x,
          z:           td.z,
          towerGroup:  td.towerGroup,
          weaponGroup: td.weaponGroup,
          lastFire:    0,
          level:       1,
        });
        gs.towerSlotFilled[td.slotId] = true;
      });

      let frameId;
      const animate = () => {
        if (!aliveRef.current) return;
        frameId = requestAnimationFrame(animate);
        const cur = sceneRef.current;
        if (!cur) return;

        const now = Date.now();
        const t   = now * 0.001;

        // Portal pulse
        if (cur.portalDisc) {
          cur.portalDisc.rotation.y = t;
          const p = 1 + Math.sin(t * 3) * 0.1;
          cur.portalDisc.scale.set(p, 1, p);
        }

        // Tower slot rings — pulse when build mode active
        if (cur.towerSlotRings) {
          const active = buildModeRef.current;
          cur.towerSlotRings.forEach((ring, i) => {
            if (!ring || !ring.visible) return;
            if (active) {
              ring.material.opacity         = 0.55 + Math.sin(t * 5 + i * 1.2) * 0.38;
              ring.material.emissiveIntensity = 1.8 + Math.sin(t * 5) * 0.5;
            } else {
              ring.material.opacity         = 0.18 + Math.sin(t * 1.4 + i) * 0.07;
              ring.material.emissiveIntensity = 0.4;
            }
          });
        }

        // Flag wobble
        cur.scene.traverse(obj => {
          if (obj.userData?.isFlag) obj.rotation.z = Math.sin(t * 2.2) * 0.25;
        });

        // ── Wave spawn queue ──────────────────────────────────────────────────
        if (!gs.done && gs.waveActive && gs.waveSpawnQueue.length > 0) {
          if (now >= gs.nextSpawnTime && gs.monsters.length < MAX_MONSTERS) {
            const enemyType = gs.waveSpawnQueue.shift();
            const wDef = WAVE_DEFS[gs.waveIdx - 1];
            spawnMonster(enemyType);
            gs.nextSpawnTime = now + (wDef?.gapMs ?? 3000);
          }
        }

        // ── Auto-start next wave when between-wave timer elapses ─────────────
        if (!gs.done && !gs.waveActive &&
            gs.waveIdx < TOTAL_WAVES && gs.nextWaveTime > 0 && now >= gs.nextWaveTime) {
          gs.nextWaveTime = 0;
          startNextWave();
        }

        // ── Tower auto-fire — paused while player is choosing a tower ────────
        for (const tower of gs.towers) {
          const tDef = TOWER_TYPES[tower.type];
          if (!tDef || towerChoicePendingRef.current) continue;
          const lvl2       = (tower.level ?? 1) >= 2;
          const effFireRate = lvl2 ? tDef.fireRateMs * 0.70 : tDef.fireRateMs;
          const effRange    = lvl2 ? tDef.range    * 1.20 : tDef.range;
          const effDamage   = lvl2 ? Math.ceil(tDef.damage * 1.5) : tDef.damage;
          if (now - tower.lastFire < effFireRate) continue;

          // Target: enemy in range with highest waypointIdx (closest to castle)
          let target = null;
          let bestWpIdx = -1;
          gs.monsters.forEach(m => {
            if (m.dying || !m.mesh) return;
            const dist = Math.hypot(m.mesh.position.x - tower.x, m.mesh.position.z - tower.z);
            if (dist <= effRange && m.waypointIdx > bestWpIdx) {
              bestWpIdx = m.waypointIdx;
              target = m;
            }
          });
          if (!target) continue;

          tower.lastFire = now;

          // Play tower fire SFX (replay from start so rapid fires work)
          const snd = sfxRef.current[tower.type];
          if (snd && !muteSfxRef.current) snd.replayAsync().catch(() => {});

          // Aim weapon
          if (tower.weaponGroup) {
            const dx = target.mesh.position.x - tower.x;
            const dz = target.mesh.position.z - tower.z;
            tower.weaponGroup.rotation.y = Math.atan2(dx, dz);
          }

          // Projectile — use GLB ammo model, fall back to a sphere if not loaded
          const startPos  = new THREE.Vector3(tower.x, TILE_H + 1.65, tower.z);
          const snapX     = target.mesh.position.x;
          const snapZ     = target.mesh.position.z;
          const snapTgt   = target;
          const ammoModel = tDef.ammoGlb ? cur.models[tDef.ammoGlb] : null;
          let proj;
          if (ammoModel) {
            proj = cloneModel(ammoModel);
            proj.scale.setScalar(tDef.ammoScale ?? 0.30);
            // Face arrow toward target on spawn
            const dx = snapX - tower.x, dz = snapZ - tower.z;
            proj.rotation.y = Math.atan2(dx, dz);
          } else {
            const projSize = tDef.splash > 0 ? 0.16 : 0.09;
            proj = new THREE.Mesh(
              new THREE.SphereGeometry(projSize, 8, 6),
              new THREE.MeshLambertMaterial({
                color: tDef.ammoColor, emissive: tDef.ammoColor, emissiveIntensity: 0.55,
              }),
            );
          }
          proj.position.copy(startPos);
          cur.scene.add(proj);

          const towerTypeKey  = tower.type;
          const hitDamage     = effDamage; // capture upgraded value for this projectile
          cur.projectiles.push({
            mesh:      proj,
            startPos:  startPos.clone(),
            endPos:    new THREE.Vector3(snapX, TILE_H + 0.3, snapZ),
            startTime: now,
            dur:       tDef.flightMs ?? 700,
            arcHeight: tDef.arcHeight ?? 0.5,
            onHit: () => {
              if (tDef.splash > 0) {
                let hitCount = 0;
                [...gs.monsters].forEach(m => {
                  if (m.dying) return;
                  const d = Math.hypot(
                    (m.mesh?.position.x ?? snapX) - snapX,
                    (m.mesh?.position.z ?? snapZ) - snapZ,
                  );
                  if (d <= tDef.splash) {
                    hitCount++;
                    if (tDef.slowDuration) {
                      m.slowedUntil = Date.now() + tDef.slowDuration;
                    } else {
                      damageMonster(m, hitDamage, towerTypeKey);
                    }
                  }
                });
                if (tDef.slowDuration) {
                  addFloat('FROZEN!', '#7dd3fc', 'center');
                } else {
                  addFloat('SPLASH!', '#fbbf24', 'right');
                }
              } else {
                if (!snapTgt.dying) damageMonster(snapTgt, hitDamage, towerTypeKey);
              }
              checkWaveCompletion();
            },
          });
        }

        // ── Update each monster ───────────────────────────────────────────────
        for (let i = gs.monsters.length - 1; i >= 0; i--) {
          const m = gs.monsters[i];
          if (!m) continue;

          // Walk animation — positions monster in its lane (perpendicular offset)
          if (m.walkFrom && m.walkTo && m.mesh) {
            const k    = Math.min(1, (now - m.walkStart) / WALK_MS);
            const baseX = m.walkFrom.x + (m.walkTo.x - m.walkFrom.x) * k;
            const baseZ = m.walkFrom.z + (m.walkTo.z - m.walkFrom.z) * k;
            const dx = m.walkTo.x - m.walkFrom.x;
            const dz = m.walkTo.z - m.walkFrom.z;
            const mag = Math.sqrt(dx * dx + dz * dz);
            if (mag > 0.001) {
              // Perpendicular = 90° left of travel direction
              m.perpX = (-dz / mag) * m.laneOffset;
              m.perpZ = ( dx / mag) * m.laneOffset;
            }
            m.mesh.position.x = baseX + m.perpX;
            m.mesh.position.z = baseZ + m.perpZ;
            if (dx || dz) m.mesh.rotation.y = Math.atan2(dx, dz);
            if (k >= 1) { m.walkFrom = null; m.walkTo = null; }
          }

          // Auto-advance along path — frozen while player is choosing or placing a tower
          if (!m.dying && !m.walkFrom && !towerChoicePendingRef.current && !buildModeRef.current) {
            const slowMult = (m.slowedUntil > now) ? 2.5 : 1.0;
            const stepMs = MONSTER_AUTO_STEP_MS / m.speed * slowMult;
            if (now - m.lastAutoStep > stepMs) {
              const wp      = getWaypoints(m.pathKey);
              const nextIdx = m.waypointIdx + 1;
              if (nextIdx >= wp.length) {
                // Reached castle gate
                killMonster(m);
                gs.castleHp = Math.max(0, gs.castleHp - 1);
                setCastleHp(gs.castleHp);
                addFloat('-1 HP', '#ef4444', 'center');
                try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
                if (gs.castleHp <= 0 && !gs.done) finishGame(false);
                checkWaveCompletion();
              } else {
                const from = getTileXZ(wp, m.waypointIdx);
                const to   = getTileXZ(wp, nextIdx);
                m.walkFrom    = from;
                m.walkTo      = to;
                m.walkStart   = now;
                m.waypointIdx = nextIdx;
                m.lastAutoStep = now;
              }
            }
          }

          // Slow tint — blue tinge on slowed monsters
          if (!m.dying && m.mesh) {
            const slowed = m.slowedUntil > now;
            m.mesh.traverse(c => {
              if (!c.isMesh || !c.material) return;
              if (slowed) {
                c.material.emissive?.setHex(0x3b82f6);
                c.material.emissiveIntensity = 0.4;
              } else if (c.material.emissiveIntensity > 0) {
                c.material.emissive?.setHex(0x000000);
                c.material.emissiveIntensity = 0;
              }
            });
          }

          // Boss ring pulse
          if (!m.dying && m.mesh?.userData?.bossRing) {
            const ring = m.mesh.userData.bossRing;
            ring.material.opacity = 0.65 + Math.sin(t * 4) * 0.25;
            ring.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
          }

          // Death shrink/fade
          if (m.dying && m.mesh) {
            const scale = ENEMY_TYPES[m.typeKey]?.scale ?? 0.32;
            const k = Math.min(1, (now - m.deathStart) / 400);
            m.mesh.scale.setScalar(scale * (1 - k));
            m.mesh.position.y += 0.008;
            if (k >= 1) {
              cur.scene.remove(m.mesh);
              m.mesh = null;
              gs.monsters.splice(i, 1);
            }
          }
        }

        // ── Projectile flight ─────────────────────────────────────────────────
        cur.projectiles = cur.projectiles.filter(p => {
          const k = Math.min(1, (now - p.startTime) / p.dur);
          p.mesh.position.lerpVectors(p.startPos, p.endPos, k);
          p.mesh.position.y += Math.sin(k * Math.PI) * (p.arcHeight ?? 0.5);
          if (k >= 1) {
            cur.scene.remove(p.mesh);
            if (p.onHit) p.onHit();
            return false;
          }
          return true;
        });

        // Project monster 3D positions to 2D for Lottie overlay.
        const glDims = glDimsRef.current;
        if (glDims.width > 1) {
          const cam = cur.camera;
          const EXPLOSION_MS = 1600;

          // Prune expired explosion sprites
          deathSpritesRef.current = deathSpritesRef.current.filter(
            d => now - d.startedAt < EXPLOSION_MS
          );

          const live = [];
          for (const m of gs.monsters) {
            if (!m.mesh) continue;
            // Project using the actual mesh world position for accurate sprite alignment
            const v = m.mesh.position.clone().project(cam);
            const sx = ((v.x + 1) / 2) * glDims.width;
            const sy = ((-v.y + 1) / 2) * glDims.height;

            if (m.dying) {
              // Record death position once so explosion outlives the mesh
              if (!m.deathSpriteRecorded) {
                m.deathSpriteRecorded = true;
                deathSpritesRef.current.push({
                  id: `death-${m.id}`,
                  x:  sx,
                  y:  sy,
                  startedAt: now,
                });
              }
            } else {
              live.push({
                id:     m.id,
                type:   m.typeKey,
                x:      sx,
                y:      sy,
                hp:     m.hp,
                maxHp:  m.maxHp,
                slowed: m.slowedUntil > now,
              });
            }
          }
          spritesRef.current = live;
        }

        cur.renderer.render(cur.scene, cur.camera);
        gl.endFrameEXP();
      };
      animate();

      setPhase('INTRO');
    } catch (err) {
      console.warn('[CastleDefense] scene build failed:', err?.message ?? err);
      try {
        gl.clearColor(0.07, 0.09, 0.16, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.endFrameEXP();
      } catch {}
      setPhase('INTRO');
    }
  };

  // ── End screens ────────────────────────────────────────────────────────────
  if (phase === 'DEFEAT' || (gs.done && gs.castleHp <= 0)) {
    return <EndScreen title="💀 Castle Fallen" score={score} won={false} onFinish={onFinish} />;
  }
  if (phase === 'VICTORY') {
    return <EndScreen title="🏆 Kingdom Saved!" score={score} won={true} onFinish={onFinish} />;
  }

  const tDef = buildToken ? TOWER_TYPES[buildToken] : null;

  // ── Main UI ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* 3D diorama */}
      <View style={styles.glWrap}>
        <GLView
          style={StyleSheet.absoluteFill}
          onContextCreate={onContextCreate}
          onLayout={({ nativeEvent: { layout } }) => {
            glDimsRef.current = { width: layout.width, height: layout.height };
          }}
        />

        {/* Tap interceptor — always active for build & tower-select */}
        <View
          style={[StyleSheet.absoluteFill, styles.tapOverlay, !buildMode && { backgroundColor: 'transparent' }]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={handleGLTap}
        />

        {/* Lottie 2D monster sprites — projected from 3D positions */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {monsterSprites.map(s => <MonsterSprite key={s.id} sprite={s} />)}
          {deathSprites.map(d => <ExplosionSprite key={d.id} sprite={d} />)}
        </View>

        {/* Floating texts */}
        {floats.map(f => <FloatingText key={f.id} text={f.text} color={f.color} side={f.side} />)}

        {/* HUD */}
        <View style={styles.hudTop} pointerEvents="none">
          <View style={styles.hudPill}>
            {Array.from({ length: CASTLE_MAX_HP }).map((_, i) => (
              <Text key={i} style={[styles.hudHeart, { color: i < castleHp ? '#ef4444' : '#475569' }]}>{'●'}</Text>
            ))}
          </View>
          <View style={styles.hudCenter}>
            <View style={styles.hudPill}>
              <Text style={[styles.hudLabel, { color: '#a78bfa' }]}>
                {waveNum > 0 ? `Wave ${waveNum}/${TOTAL_WAVES}` : 'Get Ready!'}
              </Text>
            </View>
          </View>
          <View style={styles.hudPill}>
            <Text style={styles.hudVal}>{score}</Text>
            <Text style={styles.hudLabel}>pts</Text>
          </View>
        </View>

        {/* Audio mute buttons */}
        <View style={styles.audioControls}>
          <TouchableOpacity
            style={[styles.audioBtn, muteBgm && styles.audioBtnMuted]}
            onPress={() => setMuteBgm(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={[styles.audioBtnText, muteBgm && styles.audioBtnTextMuted]}>
              {muteBgm ? 'BGM OFF' : 'BGM ON'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.audioBtn, muteSfx && styles.audioBtnMuted]}
            onPress={() => setMuteSfx(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={[styles.audioBtnText, muteSfx && styles.audioBtnTextMuted]}>
              {muteSfx ? 'SFX OFF' : 'SFX ON'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tower legend strip */}
        <View style={styles.towerLegend} pointerEvents="none">
          {gs.towers.map((tw, i) => {
            const td = TOWER_TYPES[tw.type];
            return (
              <View key={i} style={[styles.towerPip, { backgroundColor: TOWER_BADGE_COLORS[tw.type] ?? '#334155' }]}>
                <Text style={styles.towerPipEmoji}>{TOWER_BADGE_LABELS[tw.type] ?? tw.type[0].toUpperCase()}</Text>
              </View>
            );
          })}
        </View>

        {/* Tower picker — appears after a correct answer, same bottom-sheet as question modal */}
        {towerChoicePending && (
          <View style={styles.towerPicker}>
            <Text style={styles.towerPickerTitle}>Choose a Tower — Wave {waveNum}</Text>
            <ScrollView showsVerticalScrollIndicator={true} bounces={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
              {(WAVE_TOWER_UNLOCKS[Math.max(0, Math.min(waveNum - 1, WAVE_TOWER_UNLOCKS.length - 1))]).map(key => {
                const td = TOWER_TYPES[key];
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.towerPickerBtn}
                    onPress={() => selectTowerType(key)}
                    activeOpacity={0.78}
                  >
                    <View style={[styles.towerPickerBadge, { backgroundColor: TOWER_BADGE_COLORS[key] ?? '#334155' }]}>
                      <Text style={styles.towerPickerBadgeText}>{TOWER_BADGE_LABELS[key] ?? key[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.towerPickerInfo}>
                      <Text style={styles.towerPickerName}>{td.name}</Text>
                      <Text style={styles.towerPickerDesc}>{td.description}</Text>
                    </View>
                    <View style={styles.towerPickerStats}>
                      <Text style={styles.towerPickerStat}>
                        {td.key === 'ice' ? 'Slow' : `${td.damage} dmg`}
                      </Text>
                      {td.key === 'ice'
                        ? <Text style={styles.towerPickerIce}>Area</Text>
                        : td.splash > 0
                          ? <Text style={styles.towerPickerSplash}>Splash</Text>
                          : <Text style={styles.towerPickerSingle}>Single</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Wave intro panel — shown before each wave with Lottie monster previews */}
        {waveIntro && (
          <WaveIntroPanel
            waveIntro={waveIntro}
            playerName={playerName}
            onStart={() => {
              setWaveIntro(null);
              startNextWave();
              startTimer();
            }}
          />
        )}

        {/* Selected tower info — sell button */}
        {selectedTowerSlot !== null && !towerChoicePending && !buildMode && (() => {
          const tw = gs.towers.find(t => t.slotId === selectedTowerSlot);
          if (!tw) return null;
          const td  = TOWER_TYPES[tw.type];
          const lvl = tw.level ?? 1;
          return (
            <View style={styles.towerInfoPanel}>
              <Text style={styles.towerInfoTitle}>
                {td?.name}{lvl >= 2 ? '  ★ MAX' : '  Lv 1'}
              </Text>
              <Text style={styles.towerInfoDesc}>
                {td?.description}
                {lvl >= 2 ? '  •  +50% dmg  •  +20% range  •  30% faster' : ''}
              </Text>
              <View style={styles.towerInfoRow}>
                {lvl < 2 && (
                  <TouchableOpacity
                    style={styles.towerUpgradeBtn}
                    onPress={() => upgradeTower(selectedTowerSlot)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.towerUpgradeText}>Upgrade (Free)</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.towerSellBtn}
                  onPress={() => sellTower(selectedTowerSlot)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.towerSellText}>Sell</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.towerCloseBtn}
                  onPress={() => setSelectedTowerSlot(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.towerCloseTxt}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {/* Build token bar — hidden while tower picker is open so it doesn't overlap */}
        {!towerChoicePending && <View style={styles.buildBar} pointerEvents="box-none">
          {tDef ? (
            <>
              <TouchableOpacity
                style={[styles.buildBtn, buildMode && styles.buildBtnActive]}
                onPress={toggleBuildMode}
                activeOpacity={0.75}
              >
                <Text style={styles.buildBtnLabel}>
                  {buildMode ? 'TAP A RING' : `PLACE ${tDef.name.toUpperCase()}`}
                </Text>
                <Text style={styles.buildBtnSub}>{tDef.description}</Text>
              </TouchableOpacity>
              {buildMode && (
                <TouchableOpacity style={styles.cancelBtn} onPress={toggleBuildMode}>
                  <Text style={styles.cancelBtnText}>✕ Cancel</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.buildBtnLocked}>
              <Text style={styles.buildBtnLabel}>ANSWER CORRECTLY</Text>
              <Text style={styles.buildBtnSub}>to unlock a tower</Text>
            </View>
          )}
        </View>}

        {/* Build mode hint */}
        {buildMode && !towerChoicePending && (
          <View style={styles.tapHint} pointerEvents="none">
            <Text style={styles.tapHintText}>
              Tap a blue spot to place your {tDef?.name}
            </Text>
          </View>
        )}

        {/* Toast */}
        {toast && (
          <View
            style={[styles.toast, toast.type === 'correct' ? styles.toastCorrect : styles.toastWrong]}
            pointerEvents="none"
          >
            <Text style={styles.toastText}>{toast.text}</Text>
          </View>
        )}

        {/* Intro overlay */}
        {phase === 'INTRO' && (
          <View style={styles.introOverlay} pointerEvents="none">
            <Text style={styles.introTitle}>Defend the Castle!</Text>
            <Text style={styles.introSub}>Answer questions to unlock towers.</Text>
            <Text style={styles.introSub}>Towers fire automatically!</Text>
          </View>
        )}
        {phase === 'LOADING' && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <Text style={styles.loadingTitle}>Castle Defense</Text>
            <Text style={styles.loadingSub}>Building the battlefield…</Text>
            <View style={styles.loadingBarTrack}>
              <View style={[styles.loadingBarFill, { width: `${loadPct}%` }]} />
            </View>
            <Text style={styles.loadingPct}>{loadPct}%</Text>
          </View>
        )}
        {/* Question modal — floats over game board only while answering */}
        {phase === 'QUESTION' && !waveIntro && (
          <View style={styles.questionModal} pointerEvents="box-none">
            {/* Timer bar */}
            <View style={styles.timerTrack}>
              {phase === 'QUESTION' && (
                <View style={[
                  styles.timerFill,
                  {
                    width: `${(timeLeft / QUESTION_TIMER_MS) * 100}%`,
                    backgroundColor: timeLeft > QUESTION_TIMER_MS * 0.5 ? '#22c55e'
                      : timeLeft > QUESTION_TIMER_MS * 0.25 ? '#f59e0b'
                      : '#ef4444',
                  },
                ]} />
              )}
            </View>
            <QuestionCard
              q={currentQ}
              selectedIdx={selectedIdx}
              feedback={feedback}
              disabled={phase !== 'QUESTION' || feedback !== null}
              onAnswer={handleAnswer}
            />
          </View>
        )}
      </View>
    </View>
  );
}

// ── Monster & explosion Lottie sprites ───────────────────────────────────
const MONSTER_LOTTIE        = require('./assets/Monster.json');
const LARGER_MONSTER_LOTTIE = require('./assets/largermonster.json');
const EXPLOSION_LOTTIE      = require('./assets/Explosion.json');
// Mobile base sizes; desktop (web) gets +50%
const SPRITE_SIZE_BASE = { goblin: 40, knight: 50, giant: 60, largermonster: 36, boss: 80 };
const SPRITE_SCALE = Platform.OS === 'web' ? 1.5 : 1.0;

// Lottie file per monster type key
const MONSTER_LOTTIE_MAP = {
  largermonster: LARGER_MONSTER_LOTTIE,
};

// ── Wave intro panel (shown before each wave, displays incoming monster types) ──
function WaveIntroPanel({ waveIntro, onStart, playerName = 'Champion' }) {
  const { waveDef, waveIdx } = waveIntro;
  const [countdown, setCountdown] = React.useState(5);

  React.useEffect(() => {
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(id); onStart(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Unique enemy type keys in this wave (preserve order of first appearance)
  const uniqueTypes = waveDef.enemies.filter((k, i, a) => a.indexOf(k) === i);
  const hpMult = WAVE_HP_MULT[Math.min(waveIdx - 1, WAVE_HP_MULT.length - 1)] ?? 1;

  return (
    <View style={introStyles.overlay}>
      <View style={introStyles.panel}>
        <Text style={introStyles.waveLabel}>{waveDef.label}</Text>
        <Text style={introStyles.subtitle}>
          {waveIdx === 1
            ? `Get ready, ${playerName}! Know your foes!`
            : `Great work, ${playerName}! Here comes Wave ${waveIdx}!`}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={introStyles.cardsRow}
        >
          {uniqueTypes.map(key => {
            const eDef = ENEMY_TYPES[key];
            const lottie = MONSTER_LOTTIE_MAP[key] ?? MONSTER_LOTTIE;
            const scaledHp = Math.ceil((eDef?.hp ?? 2) * hpMult);
            return (
              <View key={key} style={introStyles.card}>
                <LottieView source={lottie} autoPlay loop style={introStyles.cardLottie} />
                <Text style={introStyles.cardName}>{eDef?.name ?? key}</Text>
                <Text style={introStyles.cardHp}>{scaledHp} HP</Text>
                {eDef?.hint ? <Text style={introStyles.cardHint}>{eDef.hint}</Text> : null}
                {eDef?.immuneTo?.length > 0 && (
                  <Text style={introStyles.cardImmune}>
                    Immune: {eDef.immuneTo.map(t => TOWER_TYPES[t]?.name).join(', ')}
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={introStyles.startBtn} onPress={onStart} activeOpacity={0.75}>
          <Text style={introStyles.startBtnText}>Start Wave ({countdown})</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const introStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          100,
  },
  panel: {
    width:            '90%',
    maxWidth:         420,
    backgroundColor:  'rgba(8,13,28,0.97)',
    borderRadius:     20,
    borderWidth:      1.5,
    borderColor:      '#6366f1',
    paddingVertical:  22,
    paddingHorizontal:18,
    alignItems:       'center',
    gap:              12,
  },
  waveLabel: {
    color:      '#fbbf24',
    fontSize:   22,
    fontWeight: '800',
    textAlign:  'center',
  },
  subtitle: {
    color:     '#94a3b8',
    fontSize:  12,
    textAlign: 'center',
  },
  cardsRow: {
    flexDirection: 'row',
    gap:           12,
    paddingHorizontal: 4,
    paddingVertical:   4,
  },
  card: {
    width:            110,
    backgroundColor:  'rgba(255,255,255,0.05)',
    borderRadius:     14,
    borderWidth:      1,
    borderColor:      '#334155',
    alignItems:       'center',
    paddingVertical:  12,
    paddingHorizontal:8,
    gap:              4,
  },
  cardLottie: { width: 72, height: 72 },
  cardName:   { color: '#f1f5f9', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  cardHp:     { color: '#4ade80', fontSize: 11, fontWeight: '700' },
  cardHint:   { color: '#94a3b8', fontSize: 9, textAlign: 'center', lineHeight: 13 },
  cardImmune: { color: '#fca5a5', fontSize: 9, textAlign: 'center', fontWeight: '600', lineHeight: 13 },
  startBtn: {
    marginTop:        4,
    backgroundColor:  '#6366f1',
    borderRadius:     12,
    paddingVertical:  12,
    paddingHorizontal:36,
  },
  startBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});

function MonsterSprite({ sprite }) {
  const size  = Math.round((SPRITE_SIZE_BASE[sprite.type] ?? 44) * SPRITE_SCALE);
  const lottie = sprite.type === 'largermonster' ? LARGER_MONSTER_LOTTIE : MONSTER_LOTTIE;
  const hpPct = Math.max(0, sprite.hp / sprite.maxHp);
  const hpColor = sprite.slowed ? '#3b82f6'
    : hpPct > 0.5 ? '#22c55e'
    : hpPct > 0.25 ? '#f59e0b'
    : '#ef4444';
  return (
    <View
      pointerEvents="none"
      style={{
        position:   'absolute',
        left:       sprite.x - size / 2,
        top:        sprite.y - size * 0.9, // slight upward nudge so feet meet tile surface
        width:      size,
        alignItems: 'center',
      }}
    >
      <LottieView
        source={lottie}
        autoPlay
        loop
        style={{ width: size, height: size }}
      />
      <View style={{ height: 3, width: size - 4, backgroundColor: '#0f172a', borderRadius: 2, marginTop: 1 }}>
        <View style={{ height: 3, width: `${hpPct * 100}%`, backgroundColor: hpColor, borderRadius: 2 }} />
      </View>
    </View>
  );
}

function ExplosionSprite({ sprite }) {
  // Mobile: 25% smaller; web: keep base size
  const size = Platform.OS === 'web' ? 72 : 54;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left:     sprite.x - size / 2,
        top:      sprite.y - size * 0.9,
        width:    size,
        height:   size,
      }}
    >
      <LottieView
        source={EXPLOSION_LOTTIE}
        autoPlay
        loop={false}
        style={{ width: size, height: size }}
      />
    </View>
  );
}

// ── Floating text ──────────────────────────────────────────────────────────
function FloatingText({ text, color, side }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(anim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);
  const posStyle = side === 'left'  ? { left: 16 }
                 : side === 'right' ? { right: 16 }
                 : { alignSelf: 'center' };
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.floatText,
        posStyle,
        {
          color,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-60, -30] }) }],
        },
      ]}
    >
      {text}
    </Animated.Text>
  );
}

// ── Question card ──────────────────────────────────────────────────────────
function QuestionCard({ q, selectedIdx, feedback, disabled, onAnswer }) {
  const { width: winW } = useWindowDimensions();
  const btnWidth = (winW - 40) / 2;

  if (!q) {
    return (
      <View style={styles.qCard}>
        <Text style={styles.qPlaceholder}>Loading questions…</Text>
      </View>
    );
  }

  const opts        = q.options ?? [];
  const safeCorrect = Math.min(Math.max(q.correctIndex ?? 0, 0), opts.length - 1);

  return (
    <View style={styles.qCard}>
      <Text style={styles.qText} numberOfLines={3}>{q.question ?? ''}</Text>
      <View style={styles.optGrid}>
        {[0, 1, 2, 3].map(i => {
          if (i >= opts.length) return (
            <View key={i} style={[styles.optBtn, { width: btnWidth, backgroundColor: 'transparent', borderColor: 'transparent' }]} />
          );
          const base = OPTION_COLORS[i % OPTION_COLORS.length];
          let bg      = base + '1a';
          let border  = base + '66';
          let textClr = '#e2e8f0';
          if (feedback) {
            if (i === safeCorrect)      { bg = '#14532d'; border = '#22c55e'; textClr = '#4ade80'; }
            else if (i === selectedIdx) { bg = '#7f1d1d'; border = '#ef4444'; textClr = '#f87171'; }
            else                        { bg = base + '08'; border = base + '1f'; textClr = '#475569'; }
          }
          return (
            <TouchableOpacity
              key={i}
              style={[styles.optBtn, { width: btnWidth, backgroundColor: bg, borderColor: border }]}
              onPress={() => onAnswer(i)}
              disabled={disabled}
              activeOpacity={0.8}
            >
              <View style={[styles.optBadge, { backgroundColor: base }]}>
                <Text style={styles.optBadgeText}>{OPTION_LABELS[i]}</Text>
              </View>
              <Text style={[styles.optText, { color: textClr }]} numberOfLines={2}>{opts[i]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── End screen ─────────────────────────────────────────────────────────────
function EndScreen({ title, score, won, onFinish }) {
  return (
    <View style={styles.endRoot}>
      <LinearGradient
        colors={won ? ['#022c22', '#064e3b'] : ['#1a0a0a', '#3b1515']}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.endTitle}>{title}</Text>
      <Text style={styles.endScore}>Score: {score}</Text>
      <TouchableOpacity
        style={[styles.endBtn, { backgroundColor: won ? '#16a34a' : '#1e40af' }]}
        onPress={() => onFinish(score, won)}
      >
        <Text style={styles.endBtnText}>Continue →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Screen wrapper
// ═══════════════════════════════════════════════════════════════════════════
export default function CastleDefenseScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { activeKid } = useAuth();

  const rawUnit   = route.params?.unit ?? null;
  const questions = useMemo(() => {
    if (!rawUnit) return [];
    const items = rawUnit.studyItems ?? rawUnit.items ?? rawUnit.questions ?? [];
    return items
      .filter(it => ['mc', 'multiple_choice'].includes(it.type) && Array.isArray(it.options) && it.options.length >= 2)
      .map(it => ({
        question:     it.question ?? it.front ?? '',
        options:      it.options,
        correctIndex: it.correctIndex ?? 0,
      }));
  }, [rawUnit]);

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.endRoot}>
          <Text style={styles.noQ}>⚠️ No multiple-choice questions in this unit.</Text>
          <TouchableOpacity style={styles.endBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.endBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <GameEngine
        questions={questions}
        onFinish={(s, w) => navigation.goBack()}
        playerName={activeKid?.name ?? 'Champion'}
      />
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0b1020',
  },

  glWrap: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },

  tapOverlay: {
    backgroundColor: 'rgba(56,189,248,0.04)',
  },

  // ── HUD ─────────────────────────────────────────────────────────────────
  hudTop: {
    position:      'absolute',
    top:           8,
    left:          10,
    right:         10,
    flexDirection: 'row',
    justifyContent:'space-between',
    alignItems:    'center',
  },
  hudCenter: {
    position:   'absolute',
    left:       0,
    right:      0,
    top:        0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  hudPill: {
    backgroundColor:  'rgba(15,23,42,0.75)',
    borderRadius:     999,
    paddingHorizontal:10,
    paddingVertical:  4,
    flexDirection:    'row',
    alignItems:       'center',
    gap:              4,
  },
  hudHeart: { fontSize: 14 },
  hudLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  hudVal:   { color: '#fbbf24', fontSize: 13, fontWeight: '800' },

  // ── Audio controls ───────────────────────────────────────────────────────
  audioControls: {
    position:      'absolute',
    top:           44,
    right:         10,
    flexDirection: 'row',
    gap:           5,
  },
  audioBtn: {
    backgroundColor:  'rgba(15,23,42,0.80)',
    borderRadius:     8,
    paddingHorizontal:7,
    paddingVertical:  4,
    borderWidth:      1,
    borderColor:      '#334155',
  },
  audioBtnMuted: {
    borderColor:      '#ef4444',
    backgroundColor:  'rgba(127,29,29,0.65)',
  },
  audioBtnText: {
    color:      '#94a3b8',
    fontSize:   9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  audioBtnTextMuted: { color: '#fca5a5' },

  // ── Tower legend ─────────────────────────────────────────────────────────
  towerLegend: {
    position:      'absolute',
    top:           44,
    left:          10,
    flexDirection: 'row',
    gap:           4,
  },
  towerPip: {
    borderRadius:    6,
    paddingHorizontal: 5,
    paddingVertical:   3,
    alignItems:        'center',
    justifyContent:    'center',
  },
  towerPipEmoji: { fontSize: 9, color: '#fff', fontWeight: '700', letterSpacing: 0.3 },

  // ── Tower picker overlay ─────────────────────────────────────────────────
  towerPicker: {
    position:              'absolute',
    bottom:                0,
    left:                  0,
    right:                 0,
    maxHeight:             '72%',
    backgroundColor:       'rgba(8,13,28,0.97)',
    borderTopLeftRadius:   22,
    borderTopRightRadius:  22,
    borderTopWidth:        1.5,
    borderLeftWidth:       1.5,
    borderRightWidth:      1.5,
    borderColor:           '#fbbf24',
    paddingHorizontal:     14,
    paddingTop:            12,
    paddingBottom:         34,
  },
  towerPickerTitle: {
    color:        '#fbbf24',
    fontSize:     13,
    fontWeight:   '800',
    textAlign:    'center',
    marginBottom: 8,
  },
  towerPickerBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     '#334155',
    paddingHorizontal:12,
    paddingVertical: 10,
    marginBottom:    8,
    gap:             10,
  },
  towerPickerBadge: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  towerPickerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  towerPickerInfo:  { flex: 1 },
  towerPickerName:  { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },
  towerPickerDesc:  { color: '#94a3b8', fontSize: 11, marginTop: 1 },
  towerPickerStats: { alignItems: 'flex-end', gap: 2 },
  towerPickerStat:  { color: '#fbbf24', fontSize: 11, fontWeight: '700' },
  towerPickerSplash:{ color: '#f97316', fontSize: 10, fontWeight: '600' },
  towerPickerSingle:{ color: '#38bdf8', fontSize: 10, fontWeight: '600' },
  towerPickerIce:   { color: '#7dd3fc', fontSize: 10, fontWeight: '600' },

  // ── Build bar ────────────────────────────────────────────────────────────
  buildBar: {
    position:      'absolute',
    bottom:        28,
    left:          8,
    right:         8,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  buildBtn: {
    flex:             1,
    alignItems:       'center',
    justifyContent:   'center',
    paddingVertical:  10,
    borderRadius:     14,
    borderWidth:      2,
    borderColor:      '#fbbf24',
    backgroundColor:  'rgba(251,191,36,0.12)',
  },
  buildBtnActive: {
    borderColor:     '#38bdf8',
    backgroundColor: 'rgba(56,189,248,0.18)',
  },
  buildBtnLocked: {
    flex:             1,
    alignItems:       'center',
    justifyContent:   'center',
    paddingVertical:  10,
    borderRadius:     14,
    borderWidth:      2,
    borderColor:      '#334155',
    backgroundColor:  'rgba(15,23,42,0.8)',
    opacity:          0.55,
  },
  buildBtnEmoji: { fontSize: 24 },
  buildBtnLabel: { color: '#f8fafc', fontSize: 10, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
  buildBtnSub:   { color: '#94a3b8', fontSize: 9,  fontWeight: '500', marginTop: 1 },
  cancelBtn: {
    paddingHorizontal:12,
    paddingVertical:  10,
    borderRadius:     14,
    borderWidth:      1.5,
    borderColor:      '#ef4444',
    backgroundColor:  'rgba(127,29,29,0.5)',
  },
  cancelBtnText: { color: '#f87171', fontSize: 12, fontWeight: '700' },

  // ── Tap hint ─────────────────────────────────────────────────────────────
  tapHint: {
    position:         'absolute',
    top:              44,
    alignSelf:        'center',
    backgroundColor:  'rgba(15,23,42,0.85)',
    paddingHorizontal:14,
    paddingVertical:  6,
    borderRadius:     999,
    borderWidth:      1,
    borderColor:      '#38bdf8',
  },
  tapHintText: { color: '#bae6fd', fontSize: 12, fontWeight: '700' },

  // ── Toast ────────────────────────────────────────────────────────────────
  toast: {
    position:         'absolute',
    top:              54,
    alignSelf:        'center',
    paddingHorizontal:14,
    paddingVertical:  7,
    borderRadius:     999,
    borderWidth:      1.5,
  },
  toastCorrect: { backgroundColor: 'rgba(20,83,45,0.92)',  borderColor: '#22c55e' },
  toastWrong:   { backgroundColor: 'rgba(127,29,29,0.92)', borderColor: '#ef4444' },
  toastText:    { color: '#f8fafc', fontSize: 13, fontWeight: '700' },

  // ── Loading overlay ──────────────────────────────────────────────────────
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems:       'center',
    justifyContent:   'center',
    backgroundColor:  '#111827',
    gap:              12,
    paddingHorizontal:40,
  },
  loadingTitle: {
    color:      '#f1f5f9',
    fontSize:   28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  loadingSub: {
    color:      '#94a3b8',
    fontSize:   13,
    fontWeight: '500',
  },
  loadingBarTrack: {
    width:           '100%',
    height:          8,
    borderRadius:    999,
    backgroundColor: '#1e293b',
    overflow:        'hidden',
    marginTop:       4,
  },
  loadingBarFill: {
    height:          '100%',
    borderRadius:    999,
    backgroundColor: '#38bdf8',
  },
  loadingPct: {
    color:      '#38bdf8',
    fontSize:   12,
    fontWeight: '700',
  },

  // ── Dev debug overlay ────────────────────────────────────────────────────
  dbgOverlay: {
    position:        'absolute',
    bottom:          4,
    left:            4,
    right:           4,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius:    6,
    padding:         6,
    gap:             1,
  },
  dbgLine: {
    color:      '#a3e635',
    fontSize:   9,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    lineHeight: 13,
  },

  // ── Intro overlay ────────────────────────────────────────────────────────
  introOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems:       'center',
    justifyContent:   'center',
    backgroundColor:  'rgba(0,0,0,0.42)',
  },
  introTitle: {
    color:           '#fbbf24',
    fontSize:        26,
    fontWeight:      '800',
    marginBottom:    8,
    textShadowColor: '#000',
    textShadowOffset:{ width: 1, height: 2 },
    textShadowRadius:4,
  },
  introSub: {
    color:           '#e2e8f0',
    fontSize:        13,
    marginTop:       4,
    textShadowColor: '#000',
    textShadowOffset:{ width: 0, height: 1 },
    textShadowRadius:2,
  },

  // ── Question modal overlay ───────────────────────────────────────────────
  questionModal: {
    position:              'absolute',
    bottom:                0,
    left:                  0,
    right:                 0,
    backgroundColor:       'rgba(6, 10, 24, 0.97)',
    borderTopLeftRadius:   22,
    borderTopRightRadius:  22,
    borderTopWidth:        2,
    borderLeftWidth:       2,
    borderRightWidth:      2,
    borderColor:           'rgba(99,102,241,0.55)',
    paddingHorizontal:     14,
    paddingTop:            12,
    paddingBottom:         28,
    gap:                   8,
  },

  // ── Question card ────────────────────────────────────────────────────────
  qCard: {
    backgroundColor: 'transparent',
  },
  qText: {
    color:          '#f1f5f9',
    fontSize:       15,
    fontWeight:     '700',
    textAlign:      'center',
    marginBottom:   10,
    lineHeight:     20,
  },
  qPlaceholder: { color: '#64748b', fontSize: 13, textAlign: 'center' },
  optGrid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            8,
    justifyContent: 'space-between',
  },
  optBtn: {
    minHeight:        46,
    flexDirection:    'row',
    alignItems:       'center',
    borderRadius:     12,
    borderWidth:      1.5,
    paddingHorizontal:10,
    paddingVertical:  6,
    gap:              8,
  },
  optBadge: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  optBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  optText:      { flex: 1, fontSize: 13, lineHeight: 17, fontWeight: '600' },

  // ── End screen ───────────────────────────────────────────────────────────
  endRoot:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  endTitle:   { color: '#f8fafc', fontSize: 34, fontWeight: '800', marginBottom: 10 },
  endScore:   { color: '#94a3b8', fontSize: 17, marginBottom: 28 },
  endBtn:     { paddingHorizontal: 32, paddingVertical: 13, borderRadius: 12 },
  endBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  noQ:        { color: '#94a3b8', fontSize: 15, textAlign: 'center', marginBottom: 24 },

  // ── Timer bar ────────────────────────────────────────────────────────────
  timerTrack: {
    height:          6,
    backgroundColor: '#1e293b',
    borderRadius:    4,
    overflow:        'hidden',
    marginBottom:    6,
  },
  timerFill: {
    height:       '100%',
    borderRadius: 4,
  },

  // ── Wave preview panel ────────────────────────────────────────────────────
  wavePreview: {
    position:        'absolute',
    top:             52,
    left:            8,
    right:           8,
    backgroundColor: 'rgba(10,17,35,0.93)',
    borderRadius:    14,
    borderWidth:     1.5,
    borderColor:     '#f97316',
    padding:         10,
    gap:             6,
  },
  wavePreviewTitle: {
    color: '#f97316', fontSize: 13, fontWeight: '800', textAlign: 'center',
  },
  wavePreviewRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 12, flexWrap: 'wrap',
  },
  wavePreviewEnemy: {
    alignItems: 'center', gap: 2,
  },
  wavePreviewEmoji: { fontSize: 10, color: '#e2e8f0', fontWeight: '700', textAlign: 'center' },
  wavePreviewCount: { color: '#f1f5f9', fontSize: 11, fontWeight: '700' },
  wavePreviewBoss:  {
    color: '#fbbf24', fontSize: 9, fontWeight: '800', backgroundColor: 'rgba(251,191,36,0.2)',
    paddingHorizontal: 4, borderRadius: 4,
  },
  wavePreviewWarnings: { gap: 2, marginTop: 2 },
  wavePreviewWarn: { color: '#fca5a5', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  wavePreviewHint: {
    color: '#94a3b8', fontSize: 10, textAlign: 'center', fontStyle: 'italic',
  },

  // ── Tower info / sell panel ────────────────────────────────────────────────
  towerInfoPanel: {
    position:        'absolute',
    bottom:          70,
    left:            8,
    right:           8,
    backgroundColor: 'rgba(10,17,35,0.96)',
    borderRadius:    14,
    borderWidth:     1.5,
    borderColor:     '#f59e0b',
    padding:         10,
    gap:             4,
  },
  towerInfoTitle: {
    color: '#fbbf24', fontSize: 14, fontWeight: '800', textAlign: 'center',
  },
  towerInfoDesc: {
    color: '#94a3b8', fontSize: 11, textAlign: 'center',
  },
  towerInfoRow: {
    flexDirection: 'row', gap: 8, marginTop: 4,
  },
  towerUpgradeBtn: {
    flex:            1,
    backgroundColor: 'rgba(91,33,182,0.55)',
    borderRadius:    10,
    borderWidth:     1.5,
    borderColor:     '#a78bfa',
    paddingVertical: 8,
    alignItems:      'center',
  },
  towerUpgradeText: { color: '#c4b5fd', fontSize: 12, fontWeight: '700' },
  towerSellBtn: {
    flex:            1,
    backgroundColor: 'rgba(127,29,29,0.6)',
    borderRadius:    10,
    borderWidth:     1.5,
    borderColor:     '#ef4444',
    paddingVertical: 8,
    alignItems:      'center',
  },
  towerSellText: { color: '#fca5a5', fontSize: 12, fontWeight: '700' },
  towerCloseBtn: {
    paddingHorizontal:14,
    paddingVertical:  8,
    borderRadius:     10,
    borderWidth:      1,
    borderColor:      '#334155',
    backgroundColor:  'rgba(15,23,42,0.8)',
    alignItems:       'center',
    justifyContent:   'center',
  },
  towerCloseTxt: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },

  // ── Floating text ─────────────────────────────────────────────────────────
  floatText: {
    position:       'absolute',
    bottom:         55,
    fontSize:       20,
    fontWeight:     '900',
    textShadowColor:'#000',
    textShadowOffset:{ width: 1, height: 1 },
    textShadowRadius:3,
  },
});
