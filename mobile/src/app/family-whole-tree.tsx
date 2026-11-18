/**
 * Family Tree → "Whole tree": the family around one person on a single zoomable canvas —
 * grandparents, parents, siblings, the person ♥ spouse (with the spouse's parents and siblings),
 * and children. Pinch to zoom, drag to move, "Fit" to see it all again. Read-only: adding people
 * and linking accounts stay on the one-unit Family Tree screen, which is the main view; Back
 * returns there exactly as it was.
 *
 * Data: the website's /api/family/person/<id>/cascade for the person, and again for their spouse
 * (the in-laws' side). Layout: components/familyWholeTree.logic.ts. Drawing: react-native-svg.
 *
 * Siblings run eldest (left) to youngest (right), in the website's order (date of birth, else the
 * order an admin set). "Reorder" lets an admin set that order for the centre person and their
 * siblings (POST /api/family/node/<id>/birth-order); a known date of birth always decides.
 */

import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { ApiError } from '@/api/client';
import * as Q from '@/api/qumanity';
import { BottomSheet } from '@/components/BottomSheet';
import { moveItem } from '@/components/familyAdd.logic';
import { BOX_H, BOX_W, centreIndex, layoutWholeTree, shortName, type TreeBox, type TreeLayout } from '@/components/familyWholeTree.logic';
import { BackHeader, Button, ErrorText, Screen } from '@/components/ui';
import { ZoomCanvas } from '@/components/ZoomCanvas';
import { colors, fonts, radius, space } from '@/theme';

export default function FamilyWholeTree() {
  const { node, name } = useLocalSearchParams<{ node: string; name?: string }>();
  const [layout, setLayout] = useState<TreeLayout | null>(null);
  const [note, setNote] = useState<string>();
  const [error, setError] = useState<string>();
  const [fitKey, setFitKey] = useState(0);
  const [me, setMe] = useState<Q.FamilyCascade | null>(null);
  const [spouseSide, setSpouseSide] = useState<Q.FamilyCascade | null>(null);
  // Where the centre person stands among their siblings, once an admin has set the order here.
  // (The website doesn't send that for the centre person, so a reload falls back to age, then last.)
  const [centreAt, setCentreAt] = useState<number | undefined>(undefined);
  const [order, setOrder] = useState<Q.FamilyPerson[] | null>(null);
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderError, setOrderError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = useCallback(async () => {
    try {
      const me = await Q.familyCascade(Number(node));
      let spouseSide: Q.FamilyCascade | null = null;
      if (me.spouse) {
        try {
          spouseSide = await Q.familyCascade(me.spouse.id);
        } catch (e) {
          // The website only shows a person's family to members of a unit they're in.
          if (e instanceof ApiError && e.status === 404) setNote(`${me.spouse.name}'s own parents and siblings aren't shown here.`);
          else throw e;
        }
      }
      setMe(me);
      setSpouseSide(spouseSide);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [node]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (me) setLayout(layoutWholeTree(me, spouseSide, centreAt));
  }, [me, spouseSide, centreAt]);

  function openReorder() {
    if (!me) return;
    const sibs = me.siblings.slice();
    sibs.splice(centreAt ?? centreIndex(me), 0, me.node);
    setOrderError(undefined);
    setNotice(undefined);
    setOrder(sibs);
  }

  // Saves the chosen order as birth order 0, 1, 2… (eldest first), then re-reads the tree.
  async function saveOrder() {
    if (!order || !me) return;
    setOrderBusy(true);
    setOrderError(undefined);
    try {
      for (let i = 0; i < order.length; i++) await Q.familySetBirthOrder(order[i].id, i);
      const at = order.findIndex((p) => p.id === me.node.id);
      setOrder(null);
      setCentreAt(at);
      await load();
      setNotice('Order saved. Anyone whose date of birth is known is placed by it.');
    } catch (e) {
      setOrderError((e as Error).message); // e.g. only an admin of the family unit can change this
    } finally {
      setOrderBusy(false);
    }
  }

  // For screen readers: the drawing, generation by generation.
  const spoken = layout
    ? [...new Set(layout.boxes.map((b) => b.y))]
        .map((y) =>
          layout.boxes
            .filter((b) => b.y === y)
            .map((b) => [b.person.name, label(b), b.person.is_deceased ? 'passed away' : ''].filter(Boolean).join(', '))
            .join('; '),
        )
        .join('. Next generation: ')
    : '';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Screen scroll={false}>
        <BackHeader
          title="Whole tree"
          subtitle={name ? `Around ${name}` : undefined}
          right={
            layout ? (
              <View style={styles.headActions}>
                {me && me.siblings.length > 0 && (
                  <Pressable onPress={openReorder} accessibilityRole="button" accessibilityLabel="Reorder siblings, eldest first" hitSlop={10}>
                    <Text style={styles.fit}>Reorder</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setFitKey((k) => k + 1)} accessibilityRole="button" accessibilityLabel="Fit the whole tree on screen" hitSlop={10}>
                  <Text style={styles.fit}>Fit</Text>
                </Pressable>
              </View>
            ) : undefined
          }
        />
        <ErrorText>{error}</ErrorText>
        {!layout && !error && <ActivityIndicator color={colors.gold} style={{ marginTop: space.xl }} />}
        {layout && (
          <>
            <View style={styles.canvas} accessible accessibilityLabel={`Family tree. ${spoken}`}>
              <ZoomCanvas width={layout.width} height={layout.height} fitKey={fitKey}>
                <Svg width={layout.width} height={layout.height}>
                  {layout.links.map((l) => (
                    <Path key={l.key} d={l.d} stroke={colors.faint} strokeWidth={2} fill="none" />
                  ))}
                  {layout.hearts.map((h) => (
                    <SvgText key={h.key} x={h.x} y={h.y + 5} fontSize={13} fill={colors.fire} textAnchor="middle">
                      ♥
                    </SvgText>
                  ))}
                  {layout.boxes.map((b) => {
                    const p = b.person;
                    return (
                      <G key={b.key} transform={`translate(${b.x} ${b.y})`} opacity={p.is_deceased ? 0.6 : 1}>
                        <Rect
                          x={1}
                          y={1}
                          width={BOX_W - 2}
                          height={BOX_H - 2}
                          rx={radius.md}
                          fill={colors.panel}
                          stroke={p.is_viewer ? colors.gold : colors.line}
                          strokeWidth={p.is_viewer ? 2 : 1}
                        />
                        <SvgText x={BOX_W / 2} y={25} fontSize={14} fontFamily={fonts.bold} fill={colors.text} textAnchor="middle">
                          {shortName(p.name)}
                        </SvgText>
                        <SvgText x={BOX_W / 2} y={43} fontSize={11} fontFamily={fonts.body} fill={colors.dim} textAnchor="middle">
                          {p.is_deceased ? `🕊️ ${label(b) || 'Deceased'}` : label(b)}
                        </SvgText>
                      </G>
                    );
                  })}
                </Svg>
              </ZoomCanvas>
            </View>
            <Text style={styles.hint}>Pinch to zoom · drag to move · 🕊️ passed away</Text>
            {note && <Text style={styles.hint}>{note}</Text>}
            {notice && <Text style={[styles.hint, { color: colors.earth }]}>{notice}</Text>}
          </>
        )}
      </Screen>
      <BottomSheet visible={!!order} onClose={() => setOrder(null)} style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Order of the siblings</Text>
          <Pressable onPress={() => setOrder(null)} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <Text style={styles.fit}>Close</Text>
          </Pressable>
        </View>
        <Text style={styles.sheetNote}>Eldest first. Anyone whose date of birth is known is always placed by it.</Text>
        {order?.map((p, i) => (
          <View key={p.id} style={styles.orderRow}>
            <Text style={styles.orderNo}>{i + 1}</Text>
            <Text style={[styles.orderName, p.id === me?.node.id && { color: colors.gold }]} numberOfLines={1}>
              {p.name}
            </Text>
            {(
              [
                [-1, 'arrow-up', 'earlier', i === 0],
                [1, 'arrow-down', 'later', i === order.length - 1],
              ] as const
            ).map(([dir, icon, word, off]) => (
              <Pressable
                key={dir}
                onPress={() => setOrder((o) => (o ? moveItem(o, i, dir) : o))}
                disabled={off}
                accessibilityRole="button"
                accessibilityLabel={`Move ${p.name} ${word}`}
                hitSlop={6}
                style={[styles.orderBtn, off && { opacity: 0.3 }]}
              >
                <Ionicons name={icon} size={18} color={colors.gold} />
              </Pressable>
            ))}
          </View>
        ))}
        <ErrorText>{orderError}</ErrorText>
        <Button title="Save order" icon="checkmark" onPress={saveOrder} busy={orderBusy} />
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

/** The line under a name: you, how they're related to you (the website's label), or for in-laws the
 * website doesn't name, their place in the drawing ("Priya's mother"). */
const label = (b: TreeBox) => (b.person.is_viewer ? 'You' : (b.person.relationship_to_viewer ?? b.hint ?? ''));

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    marginTop: space.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.ink,
    overflow: 'hidden',
  },
  fit: { color: colors.gold, fontFamily: fonts.medium, paddingHorizontal: space.sm },
  headActions: { flexDirection: 'row', alignItems: 'center' },
  sheet: { padding: space.lg, paddingBottom: space.xl, gap: space.sm },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
  sheetNote: { color: colors.dim, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  orderNo: { width: 22, color: colors.faint, fontFamily: fonts.bold, fontSize: 13 },
  orderName: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  orderBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panelRaised },
  hint: { color: colors.faint, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: space.sm },
});
