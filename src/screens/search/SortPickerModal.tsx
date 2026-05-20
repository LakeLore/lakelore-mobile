// Sort-by picker — each metric the current state supports. Descending only.
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
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
            const active = opt.value === sortBy && sortDir === 'desc';
            // When the user has narrowed to one gear (or the species/state only
            // has one), show the gear-specific unit on the catch-rate row so it
            // matches what the list rows display.
            const label = opt.value === 'cpue' && gear
              ? cpueLabelForGear(state, gear)
              : opt.label;
            return (
              <Pressable
                key={opt.value}
                style={({ pressed }) => [
                  styles.sortOption,
                  { backgroundColor: pressed ? colors.paper2 : 'transparent' },
                ]}
                onPress={() => { onChange(opt.value, 'desc'); onClose(); }}
              >
                <Text style={[
                  text.bodyL,
                  { color: active ? colors.walleye2 : colors.ink },
                ]}>
                  {label} ↓
                </Text>
                {active && <Text style={[text.labelL, { color: colors.walleye2 }]}>✓</Text>}
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
