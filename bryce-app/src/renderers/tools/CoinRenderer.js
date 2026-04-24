import React, { useState, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, TextInput, TouchableOpacity,
  Image, StyleSheet, Keyboard,
} from 'react-native';
import { measStyles } from '../shared/measurementStyles';

// ── Coin image registry ───────────────────────────────────────────────────────
const COIN_IMG = {
  penny:       require('../../../assets/tool-icons/penny_icon.png'),
  nickel:      require('../../../assets/tool-icons/nickel_icon.png'),
  dime:        require('../../../assets/tool-icons/dime_icon.png'),
  quarter:     require('../../../assets/tool-icons/quarter_icon.png'),
  dollar:      require('../../../assets/tool-icons/onedollar_icon.png'),
  five_dollar: require('../../../assets/tool-icons/fivedollar_icon.png'),
  ten_dollar:  require('../../../assets/tool-icons/tendollar_icon.png'),
};

// ── Avatar registry for Spot the Mistake ─────────────────────────────────────
const AVATAR_IMG = {
  nina: require('../../../assets/child-avatars/nina_avatar.png'),
  sam:  require('../../../assets/child-avatars/sam_avatar.png'),
  mia:  require('../../../assets/child-avatars/mia_avatar.png'),
  leo:  require('../../../assets/child-avatars/leo_avatar.png'),
  ava:  require('../../../assets/child-avatars/ava_avatar.png'),
  max:  require('../../../assets/child-avatars/max_avatar.png'),
};

// ── Coin values and labels ────────────────────────────────────────────────────
const COIN_CENTS = {
  penny: 1, nickel: 5, dime: 10, quarter: 25,
  dollar: 100, five_dollar: 500, ten_dollar: 1000,
};

const COIN_LABEL = {
  penny: '1¢', nickel: '5¢', dime: '10¢', quarter: '25¢',
  dollar: '$1', five_dollar: '$5', ten_dollar: '$10',
};

const COIN_NAME = {
  penny: 'Penny', nickel: 'Nickel', dime: 'Dime', quarter: 'Quarter',
  dollar: 'Dollar', five_dollar: '$5 Bill', ten_dollar: '$10 Bill',
};

// Default coin pool for interactive (make/fewest) modes
const DEFAULT_POOL = ['quarter', 'dime', 'nickel', 'penny'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(cents) {
  if (cents === 0) return '0¢';
  if (cents < 100) return `${cents}¢`;
  const d = Math.floor(cents / 100);
  const c = cents % 100;
  return c === 0 ? `$${d}.00` : `$${d}.${String(c).padStart(2, '0')}`;
}

function totalCents(coins) {
  return (coins ?? []).reduce((sum, { denomination, count = 1 }) => {
    return sum + (COIN_CENTS[denomination] ?? 0) * (typeof count === 'number' ? count : 1);
  }, 0);
}

function expandCoins(coins) {
  const out = [];
  (coins ?? []).forEach(({ denomination, count = 1 }) => {
    for (let i = 0; i < count; i++) out.push(denomination);
  });
  return out;
}

// Generate 4 MC estimation options bracketing the actual total (rounded to nearest 5¢)
function buildEstimationOptions(actualCents) {
  const rounded = Math.round(actualCents / 5) * 5 || 5;
  const pool = new Set([rounded]);
  const offsets = [-25, -20, -15, -10, -5, 5, 10, 15, 20, 25];
  offsets.forEach(d => {
    if (pool.size < 8) {
      const v = rounded + d;
      if (v > 0) pool.add(v);
    }
  });
  const sorted = [...pool].sort((a, b) => Math.abs(a - rounded) - Math.abs(b - rounded));
  const opts = sorted.slice(0, 4).sort((a, b) => a - b);
  if (!opts.includes(rounded)) {
    opts[3] = rounded;
    opts.sort((a, b) => a - b);
  }
  return { options: opts.map(fmt), correctIndex: opts.indexOf(rounded) };
}

// ── Shared: CoinGrid ──────────────────────────────────────────────────────────
function CoinGrid({ denoms, size = 52 }) {
  return (
    <View style={coinStyles.coinGrid}>
      {denoms.map((d, i) => (
        <View key={i} style={coinStyles.coinCell}>
          {COIN_IMG[d] ? (
            <Image source={COIN_IMG[d]} style={[coinStyles.coinImg, { width: size, height: size }]} />
          ) : (
            <View style={[coinStyles.coinFallback, { width: size, height: size, borderRadius: size / 2 }]}>
              <Text style={coinStyles.coinFallbackText}>{COIN_LABEL[d] ?? '?'}</Text>
            </View>
          )}
          <Text style={coinStyles.coinCellLabel}>{COIN_LABEL[d] ?? ''}</Text>
        </View>
      ))}
    </View>
  );
}

// Wallet summary — groups by denomination and shows count badges
function WalletSummary({ wallet, size = 44 }) {
  const groups = useMemo(() => {
    const map = {};
    wallet.forEach(d => { map[d] = (map[d] ?? 0) + 1; });
    return Object.entries(map).map(([denomination, count]) => ({ denomination, count }));
  }, [wallet]);

  if (groups.length === 0) return null;

  return (
    <View style={coinStyles.coinGrid}>
      {groups.map(({ denomination, count }, i) => (
        <View key={i} style={coinStyles.coinCell}>
          <View style={{ position: 'relative' }}>
            {COIN_IMG[denomination] ? (
              <Image source={COIN_IMG[denomination]} style={[coinStyles.coinImg, { width: size, height: size }]} />
            ) : (
              <View style={[coinStyles.coinFallback, { width: size, height: size, borderRadius: size / 2 }]}>
                <Text style={coinStyles.coinFallbackText}>{COIN_LABEL[denomination]}</Text>
              </View>
            )}
            {count > 1 && (
              <View style={coinStyles.countBadge}>
                <Text style={coinStyles.countBadgeText}>×{count}</Text>
              </View>
            )}
          </View>
          <Text style={coinStyles.coinCellLabel}>{COIN_LABEL[denomination]}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Mode: Count ───────────────────────────────────────────────────────────────
function CountMode({ q, onResolve, styles }) {
  const geo      = q.geometry ?? {};
  const coins    = expandCoins(geo.coins);
  const actual   = totalCents(geo.coins);
  const isDollar = actual >= 100;

  const [typed,    setTyped]    = useState('');
  const [feedback, setFeedback] = useState(null);

  function handleCheck() {
    if (feedback || !typed.trim()) return;
    Keyboard.dismiss();
    let num;
    if (isDollar) {
      // Accept "$1.35" or "1.35" (dollar format) and also bare cents "135"
      const stripped = typed.replace(/[^0-9.]/g, '');
      const asDollars = Math.round(parseFloat(stripped) * 100);
      const asCents   = parseInt(stripped, 10);
      num = asDollars === actual ? asDollars : asCents;
    } else {
      num = parseInt(typed.replace(/[^\d]/g, ''), 10);
    }
    const isCorrect = num === actual;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    Haptics.notificationAsync(
      isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    );
    setTimeout(() => onResolve(isCorrect), isCorrect ? 600 : 1800);
  }

  return (
    <View style={coinStyles.modeWrap}>
      <Text style={coinStyles.modeLabel}>COUNT THE MONEY</Text>
      <CoinGrid denoms={coins} size={54} />

      <View style={coinStyles.inputRow}>
        <View style={[
          coinStyles.inputWrap,
          feedback === 'correct' && coinStyles.inputWrapCorrect,
          feedback === 'wrong'   && coinStyles.inputWrapWrong,
        ]}>
          {isDollar ? (
            <>
              <Text style={coinStyles.inputUnit}>$</Text>
              <TextInput
                style={coinStyles.input}
                value={typed}
                onChangeText={setTyped}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#475569"
                editable={!feedback}
                maxLength={8}
                onSubmitEditing={handleCheck}
              />
            </>
          ) : (
            <>
              <TextInput
                style={coinStyles.input}
                value={typed}
                onChangeText={setTyped}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#475569"
                editable={!feedback}
                maxLength={6}
                onSubmitEditing={handleCheck}
              />
              <Text style={coinStyles.inputUnit}>¢</Text>
            </>
          )}
        </View>
      </View>

      {feedback === 'wrong' && (
        <Text style={coinStyles.wrongMsg}>
          Not quite — the total is {fmt(actual)}. Count each coin carefully!
        </Text>
      )}
      {feedback === 'correct' && (
        <Text style={coinStyles.correctMsg}>Correct! 🎉</Text>
      )}

      {!feedback && (
        <TouchableOpacity
          style={[styles.fillInSubmit, !typed.trim() && { opacity: 0.45 }]}
          onPress={handleCheck}
          disabled={!typed.trim()}
          activeOpacity={0.8}>
          <Text style={styles.fillInSubmitText}>Check Answer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Mode: Make ────────────────────────────────────────────────────────────────
function MakeMode({ q, onResolve, styles }) {
  const geo    = q.geometry ?? {};
  const target = geo.target ?? parseInt(q.correctAnswer ?? '0', 10);
  const pool   = geo.availableCoins ?? DEFAULT_POOL;

  const [wallet,   setWallet]   = useState([]);
  const [feedback, setFeedback] = useState(null);

  const walletTotal = wallet.reduce((s, d) => s + (COIN_CENTS[d] ?? 0), 0);
  const isOver      = walletTotal > target;
  const isMatch     = walletTotal === target;

  function addCoin(d) {
    if (feedback) return;
    setWallet(prev => [...prev, d]);
  }

  function handleCheck() {
    if (feedback) return;
    const isCorrect = walletTotal === target;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    Haptics.notificationAsync(
      isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    );
    if (isCorrect) setTimeout(() => onResolve(true), 600);
  }

  function handleReset() {
    setWallet([]);
    setFeedback(null);
  }

  return (
    <View style={coinStyles.modeWrap}>
      <View style={coinStyles.targetBox}>
        <Text style={coinStyles.targetLabel}>MAKE</Text>
        <Text style={coinStyles.targetAmount}>{fmt(target)}</Text>
      </View>

      <View style={[coinStyles.walletArea, isOver && coinStyles.walletAreaOver, isMatch && !feedback && coinStyles.walletAreaMatch]}>
        <Text style={[coinStyles.walletLabel, isOver && coinStyles.walletLabelOver]}>
          YOUR TOTAL — {fmt(walletTotal)} {isOver ? '⚠️ Too much!' : isMatch ? '✓' : ''}
        </Text>
        {wallet.length === 0 ? (
          <Text style={coinStyles.walletEmpty}>Tap coins below to add them</Text>
        ) : (
          <WalletSummary wallet={wallet} size={40} />
        )}
      </View>

      <View style={coinStyles.poolRow}>
        {pool.map(d => (
          <TouchableOpacity
            key={d}
            style={coinStyles.poolBtn}
            onPress={() => addCoin(d)}
            disabled={!!feedback}
            activeOpacity={0.7}>
            {COIN_IMG[d] ? (
              <Image source={COIN_IMG[d]} style={coinStyles.poolCoinImg} />
            ) : (
              <View style={[coinStyles.coinFallback, { width: 48, height: 48, borderRadius: 24 }]}>
                <Text style={coinStyles.coinFallbackText}>{COIN_LABEL[d]}</Text>
              </View>
            )}
            <Text style={coinStyles.poolCoinLabel}>{COIN_LABEL[d]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {feedback === 'wrong' && (
        <Text style={coinStyles.wrongMsg}>
          {isOver
            ? `You have ${fmt(walletTotal)} — that's too much! Reset and try again.`
            : `You have ${fmt(walletTotal)} — you need ${fmt(target - walletTotal)} more.`}
        </Text>
      )}
      {feedback === 'correct' && (
        <Text style={coinStyles.correctMsg}>You made {fmt(target)}! 🎉</Text>
      )}

      <View style={coinStyles.actionRow}>
        <TouchableOpacity style={coinStyles.resetBtn} onPress={handleReset} activeOpacity={0.8}>
          <Text style={coinStyles.resetBtnText}>↺ Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fillInSubmit, { flex: 2 }, (wallet.length === 0 || (!!feedback && feedback === 'correct')) && { opacity: 0.45 }]}
          onPress={handleCheck}
          disabled={wallet.length === 0 || (!!feedback && feedback === 'correct')}
          activeOpacity={0.8}>
          <Text style={styles.fillInSubmitText}>✓ Check</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Mode: Estimation ──────────────────────────────────────────────────────────
function EstimationMode({ q, onResolve }) {
  const geo    = q.geometry ?? {};
  const coins  = expandCoins(geo.coins);
  const actual = totalCents(geo.coins);

  const { options, correctIndex } = useMemo(
    () => buildEstimationOptions(actual),
    [actual],
  );

  const [chosen, setChosen] = useState(null);

  function handlePick(i) {
    if (chosen !== null) return;
    setChosen(i);
    const isCorrect = i === correctIndex;
    Haptics.notificationAsync(
      isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    );
    setTimeout(() => onResolve(isCorrect), isCorrect ? 600 : 1800);
  }

  function btnStyle(i) {
    if (chosen === null) return measStyles.estimateBtn;
    if (i === correctIndex) return [measStyles.estimateBtn, measStyles.estimateBtnCorrect];
    if (i === chosen)       return [measStyles.estimateBtn, measStyles.estimateBtnWrong];
    return [measStyles.estimateBtn, measStyles.estimateBtnDimmed];
  }

  return (
    <View style={coinStyles.modeWrap}>
      <Text style={coinStyles.modeLabel}>ABOUT HOW MUCH?</Text>
      <CoinGrid denoms={coins} size={52} />
      <View style={measStyles.estimateGrid}>
        {options.map((opt, i) => (
          <TouchableOpacity key={i} style={btnStyle(i)} onPress={() => handlePick(i)} activeOpacity={0.8}>
            <Text style={measStyles.estimateBtnText}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {chosen !== null && (
        <View style={measStyles.estimateBanner}>
          <Text style={measStyles.estimateBannerText}>
            {chosen === correctIndex
              ? `Correct! The total is ${fmt(actual)}.`
              : `The actual total is ${fmt(actual)}. Keep practicing your coin counting!`}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Mode: Spot the Mistake ────────────────────────────────────────────────────
function SpotMistakeMode({ q, onResolve }) {
  const geo     = q.geometry ?? {};
  const coins   = expandCoins(geo.coins);
  const claimA  = geo.claimA ?? { name: 'Nina', valueCents: 0 };
  const claimB  = geo.claimB ?? { name: 'Sam', valueCents: 0 };
  const correct = (geo.correctClaim ?? 'A').toUpperCase();
  const actual  = totalCents(geo.coins);

  const [chosen, setChosen] = useState(null);

  const avatarA = AVATAR_IMG[(claimA.name ?? '').toLowerCase()] ?? null;
  const avatarB = AVATAR_IMG[(claimB.name ?? '').toLowerCase()] ?? null;

  function handlePick(pick) {
    if (chosen) return;
    setChosen(pick);
    const isCorrect = pick === correct;
    Haptics.notificationAsync(
      isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    );
    setTimeout(() => onResolve(isCorrect), isCorrect ? 600 : 2000);
  }

  function claimBtnStyle(which) {
    if (!chosen) return measStyles.claimBtn;
    if (which === correct) return [measStyles.claimBtn, measStyles.claimBtnCorrect];
    if (which === chosen)  return [measStyles.claimBtn, measStyles.claimBtnWrong];
    return [measStyles.claimBtn, measStyles.claimBtnDimmed];
  }

  const winnerName = correct === 'A' ? claimA.name : claimB.name;

  return (
    <View style={coinStyles.modeWrap}>
      <Text style={coinStyles.modeLabel}>SPOT THE MISTAKE</Text>
      <CoinGrid denoms={coins} size={52} />
      <Text style={coinStyles.spotPrompt}>Who counted the coins correctly?</Text>

      <View style={measStyles.claimRow}>
        <TouchableOpacity style={claimBtnStyle('A')} onPress={() => handlePick('A')} activeOpacity={0.8}>
          {avatarA && <Image source={avatarA} style={measStyles.claimAvatar} />}
          <Text style={measStyles.claimName}>{claimA.name}</Text>
          <Text style={measStyles.claimValue}>{fmt(claimA.valueCents)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={claimBtnStyle('B')} onPress={() => handlePick('B')} activeOpacity={0.8}>
          {avatarB && <Image source={avatarB} style={measStyles.claimAvatar} />}
          <Text style={measStyles.claimName}>{claimB.name}</Text>
          <Text style={measStyles.claimValue}>{fmt(claimB.valueCents)}</Text>
        </TouchableOpacity>
      </View>

      {chosen && (
        <View style={measStyles.spotExplanation}>
          <Text style={measStyles.spotExplanationText}>
            {chosen === correct
              ? `Correct! ${winnerName} counted it right — the total is ${fmt(actual)}.`
              : `The correct total is ${fmt(actual)}. ${winnerName} was right!`}
          </Text>
        </View>
      )}

      <Text style={measStyles.spotHint}>Count each coin carefully.</Text>
    </View>
  );
}

// ── Mode: Fewest Coins ────────────────────────────────────────────────────────
function FewestMode({ q, onResolve, styles }) {
  const geo      = q.geometry ?? {};
  const target   = geo.target ?? 0;
  const minCount = parseInt(q.correctAnswer ?? '0', 10);
  const pool     = geo.availableCoins ?? DEFAULT_POOL;

  const [wallet,   setWallet]   = useState([]);
  const [feedback, setFeedback] = useState(null);

  const walletTotal = wallet.reduce((s, d) => s + (COIN_CENTS[d] ?? 0), 0);

  function addCoin(d) {
    if (feedback) return;
    const val = COIN_CENTS[d] ?? 0;
    if (walletTotal + val > target) return;
    setWallet(prev => [...prev, d]);
  }

  function handleCheck() {
    if (feedback) return;
    if (walletTotal !== target) {
      setFeedback('wrong-amount');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const usedCount = wallet.length;
    const isFewest  = usedCount <= minCount;
    setFeedback(isFewest ? 'correct' : 'wrong-count');
    Haptics.notificationAsync(
      isFewest ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    );
    if (isFewest) setTimeout(() => onResolve(true), 600);
  }

  function handleReset() {
    setWallet([]);
    setFeedback(null);
  }

  function isCoinDisabled(d) {
    return (walletTotal + (COIN_CENTS[d] ?? 0)) > target;
  }

  return (
    <View style={coinStyles.modeWrap}>
      <View style={coinStyles.targetBox}>
        <Text style={coinStyles.targetLabel}>FEWEST COINS FOR</Text>
        <Text style={coinStyles.targetAmount}>{fmt(target)}</Text>
      </View>

      <View style={[
        coinStyles.walletArea,
        feedback === 'correct' && coinStyles.walletAreaMatch,
      ]}>
        <Text style={coinStyles.walletLabel}>
          YOUR COINS ({wallet.length}) — {fmt(walletTotal)}
        </Text>
        {wallet.length === 0 ? (
          <Text style={coinStyles.walletEmpty}>Tap coins below to build the amount</Text>
        ) : (
          <WalletSummary wallet={wallet} size={40} />
        )}
      </View>

      <View style={coinStyles.poolRow}>
        {pool.map(d => {
          const disabled = isCoinDisabled(d) || !!feedback;
          return (
            <TouchableOpacity
              key={d}
              style={[coinStyles.poolBtn, disabled && coinStyles.poolBtnDisabled]}
              onPress={() => addCoin(d)}
              disabled={disabled}
              activeOpacity={0.7}>
              {COIN_IMG[d] ? (
                <Image source={COIN_IMG[d]} style={coinStyles.poolCoinImg} />
              ) : (
                <View style={[coinStyles.coinFallback, { width: 48, height: 48, borderRadius: 24 }]}>
                  <Text style={coinStyles.coinFallbackText}>{COIN_LABEL[d]}</Text>
                </View>
              )}
              <Text style={coinStyles.poolCoinLabel}>{COIN_LABEL[d]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {feedback === 'wrong-amount' && (
        <Text style={coinStyles.wrongMsg}>
          {`You have ${fmt(walletTotal)} — you need ${fmt(target - walletTotal)} more.`}
        </Text>
      )}
      {feedback === 'wrong-count' && (
        <View style={coinStyles.fewestHintBox}>
          <Text style={coinStyles.fewestHintText}>
            {`You made ${fmt(target)} with ${wallet.length} coin${wallet.length !== 1 ? 's' : ''} — great start! Try using larger-value coins. The minimum is ${minCount}.`}
          </Text>
        </View>
      )}
      {feedback === 'correct' && (
        <Text style={coinStyles.correctMsg}>
          {`${wallet.length} coin${wallet.length !== 1 ? 's' : ''} — that's the fewest! 🎉`}
        </Text>
      )}

      <View style={coinStyles.actionRow}>
        <TouchableOpacity
          style={coinStyles.resetBtn}
          onPress={handleReset}
          disabled={feedback === 'correct'}
          activeOpacity={0.8}>
          <Text style={coinStyles.resetBtnText}>↺ Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.fillInSubmit,
            { flex: 2 },
            (wallet.length === 0 || feedback === 'correct') && { opacity: 0.45 },
          ]}
          onPress={handleCheck}
          disabled={wallet.length === 0 || feedback === 'correct'}
          activeOpacity={0.8}>
          <Text style={styles.fillInSubmitText}>✓ Check</Text>
        </TouchableOpacity>
      </View>

      <Text style={coinStyles.fewestTip}>
        💡 Think about the largest-value coin you can use first.
      </Text>
    </View>
  );
}

// ── Main dispatcher ───────────────────────────────────────────────────────────
export default function CoinRenderer({ q, onResolve, styles }) {
  const mode = q.geometry?.mode ?? 'count';
  if (mode === 'make')         return <MakeMode         q={q} onResolve={onResolve} styles={styles} />;
  if (mode === 'estimation')   return <EstimationMode   q={q} onResolve={onResolve} styles={styles} />;
  if (mode === 'spot_mistake') return <SpotMistakeMode  q={q} onResolve={onResolve} styles={styles} />;
  if (mode === 'fewest')       return <FewestMode       q={q} onResolve={onResolve} styles={styles} />;
  return <CountMode q={q} onResolve={onResolve} styles={styles} />;
}

// ── Local styles ──────────────────────────────────────────────────────────────
const coinStyles = StyleSheet.create({
  modeWrap: {
    paddingHorizontal: 2,
    paddingBottom: 8,
  },
  modeLabel: {
    fontSize: 11, color: '#64748b', fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase',
    textAlign: 'center', marginBottom: 14,
  },

  // Coin grid
  coinGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 10,
    marginBottom: 16,
  },
  coinCell: {
    alignItems: 'center', gap: 3,
  },
  coinImg: {
    borderRadius: 100,
  },
  coinFallback: {
    backgroundColor: '#334155',
    alignItems: 'center', justifyContent: 'center',
  },
  coinFallbackText: {
    fontSize: 11, color: '#e2e8f0', fontWeight: '800',
  },
  coinCellLabel: {
    fontSize: 10, color: '#94a3b8', fontWeight: '600',
  },

  // Count badge on wallet summary
  countBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#7c3aed', borderRadius: 10,
    paddingHorizontal: 5, paddingVertical: 1,
    minWidth: 20, alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 10, color: '#fff', fontWeight: '800',
  },

  // Count mode input
  inputRow: {
    alignSelf: 'center', marginBottom: 12,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 14,
    borderWidth: 2, borderColor: '#334155',
    paddingHorizontal: 18, paddingVertical: 6, gap: 6,
  },
  inputWrapCorrect: { borderColor: '#22c55e', backgroundColor: '#14532d' },
  inputWrapWrong:   { borderColor: '#ef4444', backgroundColor: '#7f1d1d' },
  input: {
    fontSize: 32, fontWeight: '900', color: '#e2e8f0',
    minWidth: 60, textAlign: 'center',
  },
  inputUnit: {
    fontSize: 26, fontWeight: '800', color: '#7c3aed',
  },

  // Shared feedback text
  wrongMsg: {
    fontSize: 13, color: '#fca5a5', textAlign: 'center',
    marginBottom: 10, fontStyle: 'italic', lineHeight: 18,
  },
  correctMsg: {
    fontSize: 16, color: '#4ade80', textAlign: 'center',
    fontWeight: '800', marginBottom: 10,
  },

  // Make / Fewest — target box
  targetBox: {
    alignSelf: 'center', alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderRadius: 16, borderWidth: 2, borderColor: 'rgba(124,58,237,0.35)',
    paddingVertical: 12, paddingHorizontal: 32,
    marginBottom: 14,
  },
  targetLabel: {
    fontSize: 11, color: '#a78bfa', fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  targetAmount: {
    fontSize: 40, fontWeight: '900', color: '#e2e8f0',
  },

  // Wallet area
  walletArea: {
    backgroundColor: '#1e293b', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#334155',
    padding: 12, marginBottom: 14, minHeight: 80,
  },
  walletAreaOver:  { borderColor: '#ef4444', backgroundColor: 'rgba(127,29,29,0.4)' },
  walletAreaMatch: { borderColor: '#22c55e', backgroundColor: 'rgba(20,83,45,0.4)' },
  walletLabel: {
    fontSize: 10, color: '#64748b', fontWeight: '700',
    letterSpacing: 0.5, textTransform: 'uppercase',
    marginBottom: 8,
  },
  walletLabelOver: { color: '#fca5a5' },
  walletEmpty: {
    fontSize: 13, color: '#475569', fontStyle: 'italic',
    textAlign: 'center', marginTop: 6,
  },

  // Coin pool
  poolRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 10,
    marginBottom: 16,
  },
  poolBtn: {
    alignItems: 'center', gap: 4,
    backgroundColor: '#1e293b', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#334155',
    paddingVertical: 8, paddingHorizontal: 10,
    minWidth: 64,
  },
  poolBtnDisabled: {
    opacity: 0.3,
  },
  poolCoinImg: {
    width: 48, height: 48, borderRadius: 24,
  },
  poolCoinLabel: {
    fontSize: 12, color: '#94a3b8', fontWeight: '700',
  },

  // Action row (reset + check)
  actionRow: {
    flexDirection: 'row', gap: 10, marginBottom: 10,
  },
  resetBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 2, borderColor: '#334155',
    backgroundColor: '#1e293b', alignItems: 'center',
  },
  resetBtnText: {
    fontSize: 14, color: '#94a3b8', fontWeight: '700',
  },

  // Spot the mistake
  spotPrompt: {
    fontSize: 14, color: '#cbd5e1', fontWeight: '600',
    textAlign: 'center', marginBottom: 8, marginTop: 4,
  },

  // Fewest mode hint
  fewestHintBox: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.2)',
    padding: 12, marginBottom: 10,
  },
  fewestHintText: {
    fontSize: 13, color: '#fde68a', lineHeight: 18, textAlign: 'center',
  },
  fewestTip: {
    fontSize: 12, color: '#64748b', textAlign: 'center',
    marginTop: 4, fontStyle: 'italic',
  },
});
