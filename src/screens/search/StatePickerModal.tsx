// In-Search state switcher — the same US + Canada map picker as
// StateSelectScreen, inside a sheet modal.
import React from 'react';
import {
  Modal, Pressable, Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StateKey } from '../../types';
import { colors, text } from '../../lakelore-rn/theme';
import { PaperHeader } from '../../lakelore-rn/components';
import StateMapPicker from '../../components/StateMapPicker';

type Props = {
  visible: boolean;
  hasAllStates: boolean;
  /** Currently-selected state — highlighted on the map. */
  selected?: StateKey;
  onSelect: (s: StateKey) => void;
  onClose: () => void;
};

export function StatePickerModal({
  visible, hasAllStates, selected, onSelect, onClose,
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
        <StateMapPicker
          selected={selected}
          hasAllStates={hasAllStates}
          onSelect={onSelect}
        />
      </SafeAreaView>
    </Modal>
  );
}
