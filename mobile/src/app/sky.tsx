/**
 * Time-box & Kundali (same cards as the website dashboard): today's Panchang and sky at your place,
 * the Moon's phase and next events, your Kundali summary, and your Karma score.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { BackHeader, Card, ErrorText, Screen, SectionTitle } from '@/components/ui';
import { useApp } from '@/state/app';
import { colors, fonts, space, type } from '@/theme';

export default function Sky() {
  const { me } = useApp();
  const [tb, setTb] = useState<Q.TimeBox | null>(null);
  const [moon, setMoon] = useState<Q.LunarPhase | null>(null);
  const [karma, setKarma] = useState<Q.Karma | null>(null);
  const [error, setError] = useState<string>();

  useFocusEffect(
    useCallback(() => {
      Q.timebox().then(setTb, (e) => setError((e as Error).message));
      Q.lunarPhase().then(setMoon, () => undefined);
      Q.karma().then(setKarma, () => undefined);
    }, []),
  );

  return (
    <Screen>
      <BackHeader title="Time-box & Kundali" subtitle={tb?.place} />
      <ErrorText>{error}</ErrorText>

      {tb && (
        <Card>
          <Text style={styles.big}>{tb.time} <Text style={type.small}>{tb.tz_abbr}</Text></Text>
          <Text style={type.small}>{tb.date}</Text>
          <Row k="Sunrise · Sunset" v={`${tb.sunrise} · ${tb.sunset}`} />
          <Row k="Vaar" v={tb.panchang.vaar} />
          <Row k="Tithi" v={tb.panchang.tithi} />
          <Row k="Nakshatra" v={tb.panchang.nakshatra} />
          <Row k="Chandra maas" v={tb.panchang.chandra_maas} />
          <Row k="Surya maas" v={tb.panchang.surya_maas} />
          <Row k="Rising now" v={tb.sky.ascendant} />
          <Text style={[type.micro, { marginTop: space.sm }]}>
            {tb.sky.houses.filter((h) => h.planets.length).map((h) => `${h.sign}: ${h.planets.map((p) => p.planet).join(', ')}`).join(' · ')}
          </Text>
        </Card>
      )}

      {moon && (
        <>
          <SectionTitle>Moon</SectionTitle>
          <Card>
            <Text style={styles.big}>
              {moon.current.phase_name} <Text style={type.small}>{Math.round(moon.current.illuminated_fraction * 100)}% lit</Text>
            </Text>
            {moon.upcoming.slice(0, 4).map((u) => (
              <Row key={`${u.date}${u.event_type}`} k={`${u.event_type}`} v={`${u.date} ${u.time}${u.nakshatra ? ` · ${u.nakshatra}` : ''}`} />
            ))}
          </Card>
        </>
      )}

      {me?.sun_sign && (
        <>
          <SectionTitle>My Kundali</SectionTitle>
          <Card>
            <Row k="Sun" v={`${me.sun_sign} (${me.sun_element})`} />
            {me.moon_sign && <Row k="Moon" v={`${me.moon_sign} · ${me.moon_nakshatra ?? ''}`} />}
            {me.ascendant_sign && <Row k="Ascendant" v={me.ascendant_sign} />}
            {me.kundali_summary && <Text style={[type.body, { marginTop: space.sm }]}>{me.kundali_summary}</Text>}
          </Card>
        </>
      )}

      {karma && (
        <>
          <SectionTitle>Karma</SectionTitle>
          <Card>
            <Text style={styles.big}>{karma.score.total}</Text>
            <Row k="Service (non-commercial)" v={String(karma.score.noncommercial)} />
            <Row k="Commercial" v={String(karma.score.commercial)} />
            {karma.history.length === 0 && <Text style={type.small}>Karma grows as you serve your village — volunteering, helping others register, good posts.</Text>}
          </Card>
        </>
      )}
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  big: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, marginTop: 6 },
  k: { color: colors.dim, fontFamily: fonts.body, fontSize: 13 },
  v: { color: colors.text, fontFamily: fonts.medium, fontSize: 13, flexShrink: 1, textAlign: 'right' },
});
