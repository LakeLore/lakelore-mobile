import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useAppState } from '../StateContext';
import { StateKey, GENERATED_STATES } from '../types';

// Title adapts to the active fleet: with zero Canadian provinces active
// (US-only submission, 2026-08-13) "or Province" would advertise something
// unselectable. Self-heals when a province is reactivated.
const HAS_CA_ACTIVE = Object.values(GENERATED_STATES).some(st => st.active && st.country === 'CA');
import { colors, text, space, hairline } from '../lakelore-rn/theme';
import { useEntitlement } from '../useEntitlement';
import StateMapPicker from '../components/StateMapPicker';
import AboutScreen from './AboutScreen';

interface Props {
  onSelect: () => void;
}

// Map-first state/province selection (2026-07-15 all-states launch): a
// pan/zoom atlas of the US + Canada replaces the old 5-row list, with a
// grouped A-Z list below the map as the accessible path. Picking a state
// proceeds straight into the county selector (SearchScreen auto-opens it on
// every state change).
export default function StateSelectScreen({ onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const { setState } = useAppState();
  const { hasAllStates, loading: entitlementLoading } = useEntitlement();
  const [showAbout, setShowAbout] = useState(false);

  // Every state is enterable. Paid states without entitlement open in
  // PREVIEW mode: all metrics visible, lake identity (name/county/acres)
  // redacted server-side, unlock path in the search + detail banners.
  const pick = (s: StateKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setState(s);
    onSelect();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <Pressable
        onPress={() => setShowAbout(true)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="About and sources"
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

      <View style={styles.intro}>
        <Text style={[text.labelL, { color: colors.walleye2 }]}>LAKELORE · ATLAS</Text>
        <Text style={[text.displayXL, { color: colors.ink, marginTop: 6 }]}>
          {HAS_CA_ACTIVE ? 'Select a State or Province' : 'Select a State'}
        </Text>
        <Text style={[text.editorialS, { color: colors.inkSoft, marginTop: 6 }]}>
          A field guide to fish populations in surveyed lakes across the US and Canada.
        </Text>
      </View>

      <StateMapPicker
        hasAllStates={hasAllStates}
        entitlementLoading={entitlementLoading}
        onSelect={pick}
      />

      <AboutScreen visible={showAbout} onClose={() => setShowAbout(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
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
    paddingBottom: space.md,
  },
});
