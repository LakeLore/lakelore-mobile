import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, SafeAreaView, ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAppState } from '../StateContext';
import { StateKey } from '../types';
import { fetchStatus } from '../api';
import { colors, text, space, hairline } from '../lakelore-rn/theme';

interface Props {
  onSelect: () => void;
}

const STATE_ROWS: { key: StateKey; name: string; agency: string; stripe: string }[] = [
  { key: 'sd', name: 'South Dakota', agency: 'SD Game, Fish & Parks', stripe: colors.lakeInk },
  { key: 'mn', name: 'Minnesota',    agency: 'MN DNR',                stripe: '#2a4a3a' },
  { key: 'nd', name: 'North Dakota', agency: 'ND Game, Fish & Parks', stripe: colors.rust },
  { key: 'ia', name: 'Iowa',         agency: 'Iowa DNR',              stripe: colors.moss },
  { key: 'ne', name: 'Nebraska',     agency: 'Nebraska Game & Parks', stripe: '#a04030' },
  { key: 'wi', name: 'Wisconsin',    agency: 'WI DNR',                stripe: colors.lake3 },
  { key: 'mi', name: 'Michigan',     agency: 'MI DNR',                stripe: colors.lakeInk },
];

export default function StateSelectScreen({ onSelect }: Props) {
  const { setState } = useAppState();
  const [lakeCounts, setLakeCounts] = useState<Partial<Record<StateKey, number>>>({});

  useEffect(() => {
    STATE_ROWS.forEach(s =>
      fetchStatus(s.key).then(st => {
        if (st.ready && st.lakes != null)
          setLakeCounts(prev => ({ ...prev, [s.key]: st.lakes }));
      }).catch(() => {})
    );
  }, []);

  const pick = (s: StateKey) => {
    setState(s);
    onSelect();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.intro}>
          <Text style={[text.labelL, { color: colors.walleye2 }]}>LAKELORE · ATLAS</Text>
          <Text style={[text.displayXL, { color: colors.ink, marginTop: 6 }]}>Lakes by State</Text>
          <Text style={[text.editorialS, { color: colors.inkSoft, marginTop: 6 }]}>
            A field guide to fish populations in surveyed lakes across the upper Midwest.
          </Text>
        </View>

        {STATE_ROWS.map(s => (
          <Pressable key={s.key} onPress={() => pick(s.key)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: pressed ? colors.paper2 : colors.paper },
            ]}>
            <View style={[styles.stripe, { backgroundColor: s.stripe }]} />
            <View style={styles.rowBody}>
              <View style={{ flex: 1 }}>
                <Text style={[text.displayL, { color: colors.ink }]}>{s.name}</Text>
                <Text style={[text.labelM, { color: colors.inkSoft, marginTop: 6 }]}>
                  {s.agency}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {lakeCounts[s.key] != null ? (
                  <>
                    <Text style={[text.dataL, { color: colors.ink }]}>
                      {lakeCounts[s.key]!.toLocaleString()}
                    </Text>
                    <Text style={[text.labelS, { color: colors.walleye2, marginTop: 2 }]}>
                      LAKES
                    </Text>
                  </>
                ) : (
                  <Text style={[text.labelS, { color: colors.paper3 }]}>···</Text>
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { paddingBottom: space.xxxl },
  intro: {
    paddingHorizontal: space.xl,
    paddingTop: space.xxxl,
    paddingBottom: space.xxl,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },
  stripe: { width: 8 },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
  },
});
