// Sort-by picker — each metric the current state supports. Tapping the
// active row flips the direction (D9, 2026-07-17): the toolbar's ↓/↑ arrow
// implied togglability, but the picker was hard-wired descending — ascending
// sorts (smallest lakes, oldest surveys) were unreachable.
import React from 'react';
import {
  Modal, View, Pressable, Text, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StateKey, STATE_CONFIGS } from '../../types';
import { colors, text, space, hairline } from '../../lakelore-rn/theme';
import { PaperHeader } from '../../lakelore-rn/components';
import { cpueLabelForGear } from '../../components/ResultRow';

type Props = {
  visible: boolean;
  state: StateKey;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  gear?: string | null;
  onClose: () => void;
  onChange: (sortBy: string, sortDir: 'asc' | 'desc') => void;
};

export function SortPickerModal({
  visible, state, sortBy, sortDir, gear, onClose, onChange,
}: Props) {
  const cfg = STATE_CONFIGS[state];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <PaperHeader
          modal
          title="Sort By"
          right={
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[text.labelL, { color: colors.ink }]}>Done</Text>
            </Pressable>
          }
        />
        <ScrollView>
          {cfg.sortOptions.map(opt => {
            const active = opt.value === sortBy;
            // When the user has narrowed to one gear (or the species/state only
            // has one), show the gear-specific unit on the catch-rate row so it
            // matches what the list rows display.
            const label = opt.value === 'cpue' && gear
              ? cpueLabelForGear(state, gear)
              : opt.label;
            const arrow = active ? (sortDir === 'desc' ? '↓' : '↑') : '↓';
            return (
              <Pressable
                key={opt.value}
                style={({ pressed }) => [
                  styles.sortOption,
                  { backgroundColor: pressed ? colors.paper2 : 'transparent' },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${label}${active ? `, currently ${sortDir === 'desc' ? 'descending' : 'ascending'} — tap to flip` : ''}`}
                onPress={() => {
                  if (active) {
                    // Tap the active row again to flip direction; stay open so
                    // the flip is visible.
                    onChange(opt.value, sortDir === 'desc' ? 'asc' : 'desc');
                  } else {
                    onChange(opt.value, 'desc');
                    onClose();
                  }
                }}
              >
                <Text style={[
                  text.bodyL,
                  { color: active ? colors.walleye2 : colors.ink },
                ]}>
                  {label} {arrow}
                </Text>
                {active && (
                  <Text style={[text.labelM, { color: colors.walleye2 }]}>
                    ✓ tap to flip
                  </Text>
                )}
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
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: 14,
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },
});
