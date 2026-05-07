import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, SafeAreaView, ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAppState } from '../StateContext';
import { StateKey } from '../types';
import { fetchStatus } from '../api';
import { colors, text, space, hairline } from '../lakelore-rn/theme';
import { useEntitlement } from '../useEntitlement';
import PaywallScreen from './PaywallScreen';
import AboutScreen from './AboutScreen';

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

// MN is the free tier. Tapping any other state without entitlement opens
// the paywall instead of entering the state.
const FREE_STATE: StateKey = 'mn';

export default function StateSelectScreen({ onSelect }: Props) {
  const { setState } = useAppState();
  const [lakeCounts, setLakeCounts] = useState<Partial<Record<StateKey, number>>>({});
  const { hasAllStates } = useEntitlement();
  const [paywallFor, setPaywallFor] = useState<StateKey | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    STATE_ROWS.forEach(s =>
      fetchStatus(s.key).then(st => {
        if (st.ready && st.lakes != null)
          setLakeCounts(prev => ({ ...prev, [s.key]: st.lakes }));
      }).catch(() => {})
    );
  }, []);

  const pick = (s: StateKey) => {
    if (s !== FREE_STATE && !hasAllStates) {
      setPaywallFor(s);
      return;
    }
    setState(s);
    onSelect();
  };

  const handlePurchased = () => {
    // useEntitlement will pick up the new state via RC listener; just enter
    // the state the user originally tried to open.
    if (paywallFor) {
      setState(paywallFor);
      onSelect();
    }
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
          <Pressable onPress={() => setShowAbout(true)} style={styles.aboutLink} hitSlop={8}>
            <Text style={[text.labelM, { color: colors.walleye2 }]}>About &amp; data sources ›</Text>
          </Pressable>
        </View>

        {STATE_ROWS.map(s => {
          const locked = s.key !== FREE_STATE && !hasAllStates;
          return (
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
                  {locked ? (
                    <View style={styles.lockChip}>
                      <Text style={[text.labelS, { color: colors.walleye2 }]}>
                        🔒  ALL-STATES
                      </Text>
                    </View>
                  ) : s.key === FREE_STATE ? (
                    <View style={styles.freeChip}>
                      <Text style={[text.labelS, { color: colors.moss }]}>FREE</Text>
                    </View>
                  ) : null}
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
          );
        })}
      </ScrollView>

      <PaywallScreen
        visible={paywallFor != null}
        triggeredFrom={paywallFor ?? undefined}
        onClose={() => setPaywallFor(null)}
        onPurchased={handlePurchased}
      />

      <AboutScreen visible={showAbout} onClose={() => setShowAbout(false)} />
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
  aboutLink: {
    marginTop: 14,
    alignSelf: 'flex-start',
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
  lockChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: hairline,
    borderColor: colors.walleye2,
    backgroundColor: colors.paper2,
  },
  freeChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: hairline,
    borderColor: colors.moss,
    backgroundColor: colors.paper,
  },
});
