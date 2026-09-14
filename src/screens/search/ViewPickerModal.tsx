// View picker — "View Ranking As" (owner request 2026-09-12): List vs Scatter
// Plot as a dropdown sheet, identical in format and feel to the species and
// measure pickers (same page-sheet modal, PaperHeader, option-row styling as
// MeasurePickerModal).
import React from 'react';
import {
  Modal, View, Pressable, Text, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, text, space, hairline } from '../../lakelore-rn/theme';
import { PaperHeader } from '../../lakelore-rn/components';

export type ViewMode = 'list' | 'scatter';

type Props = {
  visible: boolean;
  /** null = nothing chosen yet (no row shows the checkmark). */
  viewMode: ViewMode | null;
  /** Scatter needs both an abundance signal and a size metric in this
   *  state's data — when false the option shows disabled with the reason. */
  scatterAvailable: boolean;
  /** Why the scatter option is disabled (state capability, trophy measure). */
  disabledReason?: string;
  onClose: () => void;
  onChange: (v: ViewMode) => void;
};

const OPTIONS: Array<{ id: ViewMode; label: string; blurb: string }> = [
  { id: 'list', label: 'List', blurb: 'Ranked rows — every matching lake with its numbers.' },
  { id: 'scatter', label: 'Scatter Plot', blurb: 'Abundance vs. average size, colored by stocking impact — each dot is a lake.' },
];

export function ViewPickerModal({
  visible, viewMode, scatterAvailable, disabledReason, onClose, onChange,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <PaperHeader
          modal
          title="View Ranking As"
          right={
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[text.labelL, { color: colors.ink }]}>Done</Text>
            </Pressable>
          }
        />
        {OPTIONS.map(o => {
          const active = o.id === viewMode;
          const disabled = o.id === 'scatter' && !scatterAvailable;
          return (
            <Pressable
              key={o.id}
              disabled={disabled}
              style={({ pressed }) => [
                styles.option,
                { backgroundColor: pressed || active ? colors.paper2 : 'transparent' },
                disabled && { opacity: 0.4 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled }}
              accessibilityLabel={`View ranking as ${o.label}`}
              onPress={() => { onChange(o.id); onClose(); }}
            >
              <View style={{ flex: 1, paddingRight: space.md }}>
                <Text style={[text.bodyL, { color: active ? colors.walleye2 : colors.ink }]}>
                  {o.label}
                </Text>
                <Text style={[text.labelM, { color: colors.inkSoft, marginTop: 2 }]}>
                  {disabled ? (disabledReason ?? 'Not available for this state.') : o.blurb}
                </Text>
              </View>
              <Text style={[text.labelM, { color: active ? colors.walleye2 : colors.inkSoft, flexShrink: 0 }]}>
                {active ? '✓' : ''}
              </Text>
            </Pressable>
          );
        })}
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
