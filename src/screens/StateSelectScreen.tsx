import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useAppState } from '../StateContext';
import { StateKey } from '../types';
import { ACTIVE_STATES } from '../activeStates';
import { colors, text, space, hairline } from '../lakelore-rn/theme';
import { LockIcon } from '../lakelore-rn/components';
import { useEntitlement } from '../useEntitlement';
import PaywallScreen from './PaywallScreen';
import AboutScreen from './AboutScreen';

interface Props {
  onSelect: () => void;
}

// Display order: MN first (free tier, marquee state), then by current lake
// count desc. Order is intentionally static — re-sorting as `fetchStatus`
// counts trickle in shifted the list under the user. If counts shift enough
// to change rankings, update this list manually.
const ALL_STATE_ROWS: { key: StateKey; name: string; agency: string; stripe: string }[] = [
  { key: 'mn', name: 'Minnesota',    agency: 'MN DNR',                stripe: '#2a4a3a' },
  { key: 'ia', name: 'Iowa',         agency: 'Iowa DNR',              stripe: colors.moss },
  { key: 'ne', name: 'Nebraska',     agency: 'Nebraska Game & Parks', stripe: '#a04030' },
  { key: 'nd', name: 'North Dakota', agency: 'ND Game, Fish & Parks', stripe: colors.rust },
  { key: 'sd', name: 'South Dakota', agency: 'SD Game, Fish & Parks', stripe: colors.lakeInk },
  { key: 'wi', name: 'Wisconsin',    agency: 'WI DNR',                stripe: colors.lake3 },
  { key: 'mi', name: 'Michigan',     agency: 'MI DNR',                stripe: colors.lakeInk },
];
const STATE_ROWS = ALL_STATE_ROWS.filter(s => ACTIVE_STATES.includes(s.key));

// MN is the free tier. Tapping any other state without entitlement opens
// the paywall instead of entering the state.
const FREE_STATE: StateKey = 'mn';

export default function StateSelectScreen({ onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const { setState } = useAppState();
  const { hasAllStates, loading: entitlementLoading } = useEntitlement();
  const [paywallFor, setPaywallFor] = useState<StateKey | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  const pick = (s: StateKey) => {
    if (s !== FREE_STATE && !hasAllStates) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setPaywallFor(s);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
      <Pressable
        onPress={() => setShowAbout(true)}
        hitSlop={12}
        style={({ pressed }) => [
          styles.aboutBadge,
          // SafeAreaView applies the safe-area inset as padding on its outer
          // box, but `position: absolute` positions from that outer edge — so
          // we add the top inset manually here to clear the status bar /
          // Dynamic Island.
          { top: insets.top + 12 },
          { backgroundColor: pressed ? colors.paper2 : colors.paper },
        ]}>
        <Text style={[text.labelM, { color: colors.walleye2 }]}>ⓘ ABOUT</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.intro}>
          <Text style={[text.labelL, { color: colors.walleye2 }]}>LAKELORE · ATLAS</Text>
          <Text style={[text.displayXL, { color: colors.ink, marginTop: 6 }]}>Select a State</Text>
          <Text style={[text.editorialS, { color: colors.inkSoft, marginTop: 6 }]}>
            A field guide to fish populations in surveyed lakes across the upper Midwest.
          </Text>
        </View>

        {STATE_ROWS.map(s => {
          // While entitlement is still loading (no cached value on first
          // launch), don't render either chip — avoids the flash of "locked"
          // for users who turn out to be subscribed.
          const locked = !entitlementLoading && s.key !== FREE_STATE && !hasAllStates;
          const showFreeChip = !entitlementLoading && s.key === FREE_STATE;
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
                      <LockIcon size={10} />
                      <Text style={[text.labelS, { color: colors.walleye2 }]}>
                        ALL-STATES
                      </Text>
                    </View>
                  ) : showFreeChip ? (
                    <View style={styles.freeChip}>
                      <Text style={[text.labelS, { color: colors.moss }]}>FREE</Text>
                    </View>
                  ) : null}
                </View>
                {/* Lake-count column intentionally omitted — we no longer
                    advertise raw totals at the state-select entry point. */}
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
  aboutBadge: {
    position: 'absolute',
    // `top` is set inline using insets.top so the badge clears the status bar
    // on Dynamic Island / notched iPhones. Don't add a static top here.
    right: 16,
    zIndex: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: hairline,
    borderColor: colors.walleye2,
  },
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
  lockChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: hairline,
    borderColor: colors.walleye2,
    backgroundColor: colors.paper2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
