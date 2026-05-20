// In-Search state switcher — same paper-and-ink card layout as
// StateSelectScreen, scoped to active states.
import React from 'react';
import {
  Modal, View, Pressable, Text, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StateKey, STATE_CONFIGS } from '../../types';
import { ACTIVE_STATES } from '../../activeStates';
import { colors, text, space, hairline } from '../../lakelore-rn/theme';
import { PaperHeader, LockIcon } from '../../lakelore-rn/components';

type Props = {
  visible: boolean;
  hasAllStates: boolean;
  stripes: Record<StateKey, string>;
  onSelect: (s: StateKey) => void;
  onLocked: (s: StateKey) => void;
  onClose: () => void;
};

export function StatePickerModal({
  visible, hasAllStates, stripes, onSelect, onLocked, onClose,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <PaperHeader
          modal
          title="Select State"
          right={
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[text.labelL, { color: colors.destructive }]}>Cancel</Text>
            </Pressable>
          }
        />
        <ScrollView>
          {ACTIVE_STATES.map(s => {
            const cfg = STATE_CONFIGS[s];
            const locked = s !== 'mn' && !hasAllStates;
            return (
              <Pressable
                key={s}
                onPress={() => (locked ? onLocked(s) : onSelect(s))}
                style={({ pressed }) => [
                  styles.stateOption,
                  { backgroundColor: pressed ? colors.paper2 : colors.paper },
                ]}>
                <View style={[styles.stripeNarrow, { backgroundColor: stripes[s] ?? colors.lake3 }]} />
                <View style={styles.stateOptionBody}>
                  <View style={{ flex: 1 }}>
                    <Text style={[text.displayL, { color: colors.ink }]}>{cfg.label}</Text>
                    <Text style={[text.labelM, { color: colors.inkSoft, marginTop: 4 }]}>{cfg.agency}</Text>
                    {locked && (
                      <View style={styles.lockRow}>
                        <LockIcon size={10} />
                        <Text style={[text.labelS, { color: colors.walleye2 }]}>ALL-STATES</Text>
                      </View>
                    )}
                  </View>
                  {/* Raw lake totals intentionally not surfaced here. */}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stateOption: {
    flexDirection: 'row',
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },
  stripeNarrow: { width: 8 },
  stateOptionBody: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
});
