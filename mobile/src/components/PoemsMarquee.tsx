/**
 * PoemsMarquee — the website's Vinay Patrika poems strip (Qumanity_DPG
 * templates/_poems_marquee.html + static/js/poems.js), ported to React Native.
 *
 * Mounted once as the BOTTOM strip of the app (app/_layout.tsx), on every
 * screen, signed in or not — a real strip in the layout, so it never covers
 * anything. While a keyboard is open it sits right above the keyboard.
 *
 * Streaming like poems.js: poems are cut into short word segments that flow
 * through a small sliding window (next poem appended right after the last
 * word, no gap). Rendering one huge line of text instead leaves the strip
 * blank on Android, which cannot draw a view tens of thousands of px wide.
 *
 * Same behaviour as the website: starts on a random poem, plays in sequence
 * (wrapping 237 → 1), starts paused on a fresh launch, remembers language,
 * speed, play state and position. ⋮ holds Speed and Language.
 */

import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { useApp } from '@/state/app';
import { colors, fonts, radius, space } from '@/theme';

const BASE_SPEED = 60; // px per second at 1×
const SPEEDS = [1, 1.25, 1.5, 2];
const SPEED_LABELS = ['1.0', '1.25', '1.5', '2.0'];
const BAR_HEIGHT = 36;
const SEGMENT_CHARS = 40; // short pieces keep every text view small enough for Android to draw
const WINDOW_SEGMENTS = 14; // segments kept on screen / just off it

const LANG_KEY = 'qm_poem_lang';
const SPEED_KEY = 'qm_poem_speed';
const PLAY_KEY = 'qm_poem_playing';
const IDX_KEY = 'qm_poem_idx';

async function prefGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}
function prefSet(key: string, value: string) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    else SecureStore.setItemAsync(key, value).catch(() => undefined);
  } catch {
    // best effort only
  }
}

interface Segment {
  key: number;
  text: string;
  kind: 'marker' | 'text' | 'sep';
  poemIndex: number;
  marker: string;
}

/** A poem as marker + short word segments + separator. */
export function segmentsOf(p: Q.Poem, poemIndex: number, nextKey: () => number): Segment[] {
  const marker = p.marker || `#${p.id}`;
  const out: Segment[] = [{ key: nextKey(), text: `${marker}  `, kind: 'marker', poemIndex, marker }];
  let chunk = '';
  for (const word of p.text.replace(/\s+/g, ' ').trim().split(' ')) {
    if (chunk && chunk.length + word.length + 1 > SEGMENT_CHARS) {
      out.push({ key: nextKey(), text: `${chunk} `, kind: 'text', poemIndex, marker });
      chunk = word;
    } else {
      chunk = chunk ? `${chunk} ${word}` : word;
    }
  }
  if (chunk) out.push({ key: nextKey(), text: `${chunk} `, kind: 'text', poemIndex, marker });
  out.push({ key: nextKey(), text: '   ❖   ', kind: 'sep', poemIndex, marker });
  return out;
}

export default function PoemsMarquee() {
  const { server } = useApp();

  const [meta, setMeta] = useState<Q.PoemsMeta | null>(null);
  const [failed, setFailed] = useState(false);
  const [lang, setLang] = useState('hi');
  const [playing, setPlaying] = useState(false);
  const [speedIx, setSpeedIx] = useState(0);
  const [queue, setQueue] = useState<Segment[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<'speed' | 'lang' | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);
  const widths = useRef(new Map<number, number>());
  const dropping = useRef<number | null>(null); // key of the segment being removed from the front
  const keySeq = useRef(0);
  const cache = useRef(new Map<string, Q.Poem>());
  const nextPoem = useRef(0); // index of the next poem to append
  const filling = useRef(false);
  const generation = useRef(0); // bumps on reset (language / previous / next) to drop stale fills
  const settings = useRef({ playing, speedIx });
  settings.current = { playing, speedIx };

  const nextKey = useCallback(() => ++keySeq.current, []);

  const fetchPoem = useCallback(async (l: string, i: number) => {
    const k = `${l}:${i}`;
    const hit = cache.current.get(k);
    if (hit) return hit;
    const p = await Q.poem(l, i);
    cache.current.set(k, p);
    return p;
  }, []);

  /** Append poems until the window is full. */
  const fill = useCallback(
    async (l: string, count: number, current: Segment[]) => {
      if (filling.current) return;
      filling.current = true;
      const gen = generation.current;
      try {
        let length = current.length;
        while (length < WINDOW_SEGMENTS) {
          const i = nextPoem.current;
          const p = await fetchPoem(l, i);
          if (gen !== generation.current) return;
          nextPoem.current = (i + 1) % count;
          const segs = segmentsOf(p, i, nextKey);
          length += segs.length;
          setQueue((q) => [...q, ...segs]);
        }
      } catch {
        // network hiccup: the next frame's refill check tries again
      } finally {
        if (gen === generation.current) filling.current = false; // a reset already released it
      }
    },
    [fetchPoem, nextKey],
  );

  /** Restart the strip at poem `start` (first load, language change, previous/next). */
  const resetAt = useCallback(
    (l: string, count: number, start: number) => {
      generation.current += 1;
      filling.current = false;
      offset.current = 0;
      translateX.setValue(0);
      widths.current.clear();
      dropping.current = null;
      nextPoem.current = ((start % count) + count) % count;
      setQueue([]);
      prefSet(IDX_KEY, String(nextPoem.current));
      fill(l, count, []);
    },
    [fill, translateX],
  );

  // Load meta and preferences; retry every 4 s until the website answers (also re-runs when
  // the server address becomes known or is changed in Settings).
  useEffect(() => {
    if (meta) return;
    let live = true;
    (async () => {
      try {
        const m = await Q.poemsMeta();
        if (!live) return;
        const usable = m.languages.filter((l) => l.available !== false);
        const saved = await prefGet(LANG_KEY);
        const chosen =
          (saved && usable.some((l) => l.code === saved) && saved) ||
          (m.default && usable.some((l) => l.code === m.default) && m.default) ||
          usable[0]?.code ||
          'hi';
        const savedSpeed = SPEEDS.indexOf(parseFloat((await prefGet(SPEED_KEY)) || '1'));
        const savedIdx = parseInt((await prefGet(IDX_KEY)) ?? '', 10);
        const savedPlay = await prefGet(PLAY_KEY);
        if (!live) return;
        setFailed(false);
        setLang(chosen);
        setSpeedIx(savedSpeed >= 0 ? savedSpeed : 0);
        setPlaying(savedPlay === '1');
        setMeta(m);
        resetAt(chosen, m.count, Number.isFinite(savedIdx) ? savedIdx : Math.floor(Math.random() * m.count));
      } catch {
        if (!live) return;
        setFailed(true);
        setTimeout(() => live && setRetryTick((t) => t + 1), 4000);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, retryTick]);

  // Once the front segment has been removed from the screen, pull the strip back by its width.
  useLayoutEffect(() => {
    const k = dropping.current;
    if (k !== null && queue[0]?.key !== k) {
      offset.current -= widths.current.get(k) ?? 0;
      widths.current.delete(k);
      dropping.current = null;
      translateX.setValue(-offset.current);
    }
  }, [queue, translateX]);

  // The scroll loop (requestAnimationFrame, like poems.js).
  const queueRef = useRef(queue);
  queueRef.current = queue;
  useEffect(() => {
    if (!meta) return;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      const dt = last ? Math.min(t - last, 100) : 0;
      last = t;
      const q = queueRef.current;
      if (settings.current.playing && q.length) {
        offset.current += (BASE_SPEED * SPEEDS[settings.current.speedIx] * dt) / 1000;
        translateX.setValue(-offset.current);
        const first = q[0];
        const w = widths.current.get(first.key);
        if (dropping.current === null && w && offset.current >= w) {
          dropping.current = first.key;
          setQueue((cur) => cur.slice(1));
          if (first.kind === 'sep') prefSet(IDX_KEY, String((first.poemIndex + 1) % meta.count));
        }
      }
      if (q.length < WINDOW_SEGMENTS) fill(lang, meta.count, q);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [meta, lang, fill, translateX]);

  function togglePlay() {
    setPlaying((p) => {
      prefSet(PLAY_KEY, p ? '0' : '1');
      return !p;
    });
  }

  function changeLang(code: string) {
    setMenuOpen(false);
    setExpanded(null);
    if (!meta || code === lang) return;
    setLang(code);
    prefSet(LANG_KEY, code);
    resetAt(code, meta.count, queue[0]?.poemIndex ?? 0); // same position = same poem in every language
  }

  function setSpeed(ix: number) {
    setSpeedIx(ix);
    prefSet(SPEED_KEY, String(SPEEDS[ix]));
    setMenuOpen(false);
    setExpanded(null);
  }

  const marker = queue[0]?.marker ?? '';

  return (
    <View style={styles.bar}>
      {/* सीताराम + poem number and Play/Pause sit tight together, leaving the width to the poem. */}
      <View style={styles.left}>
        <View style={styles.chip}>
          <Text style={styles.chipName}>सीताराम</Text>
          <Text style={styles.chipMarker} numberOfLines={1}>
            {marker}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause poems' : 'Play poems'}
          disabled={!meta}
          onPress={togglePlay}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }}
          style={styles.playBtn}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={17} color={meta ? colors.gold : colors.faint} />
        </TouchableOpacity>
      </View>

      <View style={styles.viewport}>
        {queue.length ? (
          <Animated.View style={[styles.track, { transform: [{ translateX }] }]}>
            {queue.map((s) => (
              <Text
                key={s.key}
                numberOfLines={1}
                style={[styles.seg, s.kind === 'marker' && styles.segMarker, s.kind === 'sep' && styles.segSep]}
                onLayout={(e) => widths.current.set(s.key, e.nativeEvent.layout.width)}
              >
                {s.text}
              </Text>
            ))}
          </Animated.View>
        ) : (
          <Text style={styles.status} numberOfLines={1}>
            {failed ? 'Poems: waiting for the Qumanity website…' : 'Loading poems…'}
          </Text>
        )}
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Poem speed and language"
        disabled={!meta}
        onPress={() => {
          setExpanded(null);
          setMenuOpen(true);
        }}
        style={styles.dot}
      >
        <Ionicons name="ellipsis-vertical" size={14} color={colors.dim} />
      </TouchableOpacity>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menu}>
            <TouchableOpacity style={styles.accHead} onPress={() => setExpanded((e) => (e === 'speed' ? null : 'speed'))} accessibilityRole="button">
              <Text style={styles.accHeadLabel}>Speed</Text>
              <View style={styles.accHeadRight}>
                <Text style={styles.accHeadVal}>{SPEED_LABELS[speedIx]}×</Text>
                <Ionicons name={expanded === 'speed' ? 'chevron-up' : 'chevron-down'} size={13} color={colors.faint} />
              </View>
            </TouchableOpacity>
            {expanded === 'speed' &&
              SPEEDS.map((s, ix) => (
                <TouchableOpacity key={s} onPress={() => setSpeed(ix)} style={styles.menuRow}>
                  <Text style={styles.menuLabel}>{SPEED_LABELS[ix]}×</Text>
                  {ix === speedIx && <Ionicons name="checkmark" size={14} color={colors.gold} />}
                </TouchableOpacity>
              ))}
            <TouchableOpacity style={styles.accHead} onPress={() => setExpanded((e) => (e === 'lang' ? null : 'lang'))} accessibilityRole="button">
              <Text style={styles.accHeadLabel}>Language</Text>
              <View style={styles.accHeadRight}>
                <Text style={styles.accHeadVal}>{meta?.languages.find((l) => l.code === lang)?.label ?? lang}</Text>
                <Ionicons name={expanded === 'lang' ? 'chevron-up' : 'chevron-down'} size={13} color={colors.faint} />
              </View>
            </TouchableOpacity>
            {expanded === 'lang' &&
              meta?.languages.map((l) => (
                <TouchableOpacity key={l.code} disabled={l.available === false} onPress={() => changeLang(l.code)} style={styles.menuRow}>
                  <Text style={[styles.menuLabel, l.available === false && { color: colors.faint }]}>
                    {l.label}
                    {l.available === false ? ' (soon)' : ''}
                  </Text>
                  {l.code === lang && <Ionicons name="checkmark" size={14} color={colors.gold} />}
                </TouchableOpacity>
              ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    backgroundColor: colors.panel,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  chip: { alignItems: 'center' },
  chipName: { color: colors.saffron, fontFamily: fonts.medium, fontSize: 11 },
  chipMarker: { color: colors.faint, fontFamily: fonts.body, fontSize: 9, maxWidth: 52 },
  playBtn: { width: 22, height: 30, alignItems: 'center', justifyContent: 'center' },
  viewport: { flex: 1, alignSelf: 'stretch', overflow: 'hidden', justifyContent: 'center' },
  // Absolutely positioned so the row takes its content's width instead of being squeezed to the viewport.
  track: { position: 'absolute', left: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center' },
  seg: { flexShrink: 0, color: colors.text, fontFamily: fonts.body, fontSize: 13, includeFontPadding: false },
  segMarker: { color: colors.gold, fontFamily: fonts.medium },
  segSep: { color: colors.saffron },
  status: { color: colors.faint, fontFamily: fonts.body, fontSize: 12 },
  dot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.panelRaised, alignItems: 'center', justifyContent: 'center' },
  menuBackdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end', paddingBottom: 100 },
  menu: { marginHorizontal: space.lg, backgroundColor: colors.panelRaised, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm, maxHeight: '60%' },
  accHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm },
  accHeadLabel: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  accHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  accHeadVal: { color: colors.dim, fontFamily: fonts.medium, fontSize: 11 },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingLeft: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  menuLabel: { color: colors.text, fontFamily: fonts.body, fontSize: 13 },
});
