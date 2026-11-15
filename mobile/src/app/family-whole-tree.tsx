/**
 * Family Tree → "Whole tree": the family around one person on a single zoomable canvas —
 * grandparents, parents, siblings, the person ♥ spouse (with the spouse's parents and siblings),
 * and children. Pinch to zoom, drag to move, "Fit" to see it all again. Read-only: adding people
 * and linking accounts stay on the one-unit Family Tree screen, which is the main view; Back
 * returns there exactly as it was.
 *
 * Data: the website's /api/family/person/<id>/cascade for the person, and again for their spouse
 * (the in-laws' side). Layout: components/familyWholeTree.logic.ts. Drawing: react-native-svg.
 */

import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { ApiError } from '@/api/client';
import * as Q from '@/api/qumanity';
import { BOX_H, BOX_W, layoutWholeTree, shortName, type TreeBox, type TreeLayout } from '@/components/familyWholeTree.logic';
import { BackHeader, ErrorText, Screen } from '@/components/ui';
import { ZoomCanvas } from '@/components/ZoomCanvas';
import { colors, fonts, radius, space } from '@/theme';

export default function FamilyWholeTree() {
  const { node, name } = useLocalSearchParams<{ node: string; name?: string }>();
  const [layout, setLayout] = useState<TreeLayout | null>(null);
  const [note, setNote] = useState<string>();
  const [error, setError] = useState<string>();
  const [fitKey, setFitKey] = useState(0);

  useEffect(() => {
    (async () => {
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
        setLayout(layoutWholeTree(me, spouseSide));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [node]);

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
              <Pressable onPress={() => setFitKey((k) => k + 1)} accessibilityRole="button" accessibilityLabel="Fit the whole tree on screen" hitSlop={10}>
                <Text style={styles.fit}>Fit</Text>
              </Pressable>
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
          </>
        )}
      </Screen>
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
  hint: { color: colors.faint, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: space.sm },
});
