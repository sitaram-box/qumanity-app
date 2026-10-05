/**
 * Country / Zone Perception (same as the website dashboard): members' yearly Pro/Anti view of a
 * place. Voting is open 1 Oct – 31 Dec. The tally stays hidden (results_visible false) until the
 * Founder opens it — the vote buttons work either way (website visibility_core.py).
 */

import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Q from "@/api/qumanity";
import { colors, fonts, radius, space } from "@/theme";

export function PerceptionCard({
  kind,
  id,
  name,
}: {
  kind: "country" | "zone";
  id: string;
  name: string;
}) {
  const [data, setData] = useState<Q.Perception | null>(null);
  const [error, setError] = useState<string>();

  const load = () => Q.perception(kind, id).then(setData, () => undefined);
  useEffect(() => {
    setData(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id]);

  if (!data) return null;
  const shown =
    data.results_visible !== false &&
    data.pro_count !== null &&
    data.anti_count !== null;
  const total = shown ? data.pro_count! + data.anti_count! : 0;
  const pro = total ? Math.round((100 * data.pro_count!) / total) : 0;

  async function vote(v: "pro" | "anti") {
    setError(undefined);
    try {
      await Q.perceptionVote(kind, id, v);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>🧭 {name} perception</Text>
        {shown && <Text style={styles.meta}>results {data.voting_year}</Text>}
      </View>
      {shown ? (
        <>
          <View style={styles.bar}>
            <View
              style={{
                flex: Math.max(pro, total ? 0 : 50),
                backgroundColor: colors.earth,
              }}
            />
            <View
              style={{
                flex: Math.max(100 - pro, total ? 0 : 50),
                backgroundColor: total ? colors.fire : colors.line,
              }}
            />
          </View>
          <Text style={styles.meta}>
            👍 Pro {data.pro_count} · 👎 Anti {data.anti_count}
          </Text>
        </>
      ) : (
        <Text style={styles.meta}>
          {data.results_reason ?? "Results are not shown yet."}
        </Text>
      )}
      {data.my_vote ? (
        <Text style={styles.meta}>You voted {data.my_vote} this year.</Text>
      ) : data.can_vote ? (
        <View style={styles.actions}>
          <Pressable
            style={styles.btn}
            onPress={() => vote("pro")}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>👍 Vote Pro</Text>
          </Pressable>
          <Pressable
            style={styles.btn}
            onPress={() => vote("anti")}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>👎 Vote Anti</Text>
          </Pressable>
        </View>
      ) : (
        !!data.vote_reason && (
          <Text style={styles.meta}>{data.vote_reason}</Text>
        )
      )}
      {!!error && (
        <Text style={[styles.meta, { color: colors.danger }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    gap: 6,
  },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 13.5 },
  meta: { color: colors.faint, fontFamily: fonts.body, fontSize: 11.5 },
  bar: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden" },
  actions: { flexDirection: "row", gap: 6 },
  btn: {
    flex: 1,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.panelRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: colors.text, fontFamily: fonts.medium, fontSize: 12.5 },
});
