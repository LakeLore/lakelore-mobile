// Measure picker — the primary metric control (DATA_MODEL_PROPOSAL_2026-07-20).
// A Measure is WHAT is being quantified: Abundance / Avg Size / Stocking Impact
// / Presence. This is the "Sort by" control, labelled by measure. Selecting a
// measure adopts its default Gear/Source (most records); the Gear Type filter
// inside the Filters modal refines it (2026-07-21 owner call — no separate
// Source picker). Selection always applies descending order — the tap-to-flip
// affordance was removed 2026-09-14 (accidental flips).
import React from 'react';
import {
  Modal, View, Pressable, Text, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Measure } from '../../types';
import { colors, text, space, hairline } from '../../lakelore-rn/theme';
import { PaperHeader } from '../../lakelore-rn/components';

type Props = {
  visible: boolean;
  measures: Measure[];
  activeMeasureId: string | null;
  sortDir: 'asc' | 'desc';
  onClose: () => void;
  onChange: (measure: Measure, sortDir: 'asc' | 'desc') => void;
};

// One-line explanation shown under each measure so switching feels legible.
const BLURB: Record<string, string> = {
  abundance: 'How many fish — change the survey method under Gear Type in Filters.',
  size: 'How big the fish run, on average.',
  stocking: 'Stocking impact — includes lakes with no survey on record.',
  trophy: 'Catch rate of true trophies only — fish above the trophy length class, like a 25″ walleye or 20″ largemouth.',
  presence: 'Every species recorded present. No ranking — the complete list.',
};

function coverage(m: Measure): string {
  return `${m.lakes.toLocaleString()} lake${m.lakes === 1 ? '' : 's'}`;
}

export function MeasurePickerModal({
  visible, measures, activeMeasureId, sortDir, onClose, onChange,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <PaperHeader
          modal
          title="Rank Lakes By"
          right={
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[text.labelL, { color: colors.ink }]}>Done</Text>
            </Pressable>
          }
        />
        <ScrollView>
          {measures.map(m => {
            const active = m.id === activeMeasureId;
            // A measure is sortable unless it's the Presence union (no ranking).
            const sortable = m.id !== 'presence';
            const arrow = !sortable ? '' : active ? (sortDir === 'desc' ? '↓' : '↑') : '↓';
            return (
              <Pressable
                key={m.id}
                style={({ pressed }) => [
                  styles.option,
                  { backgroundColor: pressed || active ? colors.paper2 : 'transparent' },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${m.label}, ${coverage(m)}`}
                // Tap-to-flip removed (owner 2026-09-14: too easy to hit by
                // accident) — selecting always applies the default descending
                // order and closes; re-tapping the active row is a no-op close.
                onPress={() => {
                  onChange(m, 'desc');
                  onClose();
                }}
              >
                {/* flex:1 + paddingRight keeps a wrapping blurb clear of the
                    right column ("…no survey on29 LAKESrecord", post-launch
                    minor); flexShrink:0 stops the count label compressing. */}
                <View style={{ flex: 1, paddingRight: space.md }}>
                  <Text style={[text.bodyL, { color: active ? colors.walleye2 : colors.ink }]}>
                    {m.label}{arrow ? ` ${arrow}` : ''}
                  </Text>
                  <Text style={[text.labelM, { color: colors.inkSoft, marginTop: 2 }]}>
                    {BLURB[m.id] ?? coverage(m)}
                  </Text>
                </View>
                <Text style={[text.labelM, { color: active ? colors.walleye2 : colors.inkSoft, flexShrink: 0 }]}>
                  {active ? '✓' : coverage(m)}
                </Text>
              </Pressable>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: 15,
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },
});
