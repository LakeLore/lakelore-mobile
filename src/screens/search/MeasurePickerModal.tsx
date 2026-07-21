// Measure picker — the primary metric control (DATA_MODEL_PROPOSAL_2026-07-20).
// A Measure is WHAT is being quantified: Abundance / Avg Size / Stocking Impact
// / Presence. This is the "Sort by" control, labelled by measure. Selecting a
// measure adopts its default Gear/Source; the separate Source picker refines it.
// Tapping the active measure flips sort direction (Presence has no ranking).
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
  abundance: 'How many fish — pick a survey method under Gear / Source.',
  size: 'How big the fish run, on average.',
  stocking: 'Stocking impact — includes lakes with no survey on record.',
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
          title="Measure"
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
                accessibilityLabel={
                  `${m.label}, ${coverage(m)}` +
                  (active && sortable
                    ? `, currently ${sortDir === 'desc' ? 'descending' : 'ascending'} — tap to flip`
                    : '')
                }
                onPress={() => {
                  if (active && sortable) {
                    onChange(m, sortDir === 'desc' ? 'asc' : 'desc');
                  } else {
                    onChange(m, 'desc');
                    if (!active) onClose();
                  }
                }}
              >
                <View style={{ flexShrink: 1 }}>
                  <Text style={[text.bodyL, { color: active ? colors.walleye2 : colors.ink }]}>
                    {m.label}{arrow ? ` ${arrow}` : ''}
                  </Text>
                  <Text style={[text.labelM, { color: colors.inkSoft, marginTop: 2 }]}>
                    {BLURB[m.id] ?? coverage(m)}
                  </Text>
                </View>
                <Text style={[text.labelM, { color: active ? colors.walleye2 : colors.inkSoft }]}>
                  {active ? (sortable ? '✓ tap to flip' : '✓') : coverage(m)}
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
