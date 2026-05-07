import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable,
  Modal, StyleSheet, SafeAreaView, Keyboard, Platform,
} from 'react-native';
import { SpeciesOption, StateKey, SD_SPECIES_NAMES, MN_SPECIES_NAMES, ND_SPECIES_NAMES } from '../types';
import { colors, text, space, hairline } from '../lakelore-rn/theme';
import { PaperHeader } from '../lakelore-rn/components';

interface Props {
  visible: boolean;
  species: SpeciesOption[];
  selected: string;
  state: StateKey;
  onSelect: (s: string) => void;
  onClose: () => void;
}

const GAME_FISH = new Set([
  'WAE','NOP','LMB','SMB','MUE','TME','BLC','WHC','BLG','YEP',
  'SAU','SAR','RBT','BNT','BKT','LAK','LKS','CCF','WHB','STH','TLC','RKB','PMK',
]);

export default function SpeciesPicker({ visible, species, selected, state, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    if (!visible) { setKbHeight(0); return; }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, e => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, [visible]);
  const usesFullNames = state === 'ia' || state === 'ne';
  const namesMap = state === 'mn' ? MN_SPECIES_NAMES
    : state === 'nd' ? ND_SPECIES_NAMES
    : usesFullNames ? {} as Record<string,string>
    : SD_SPECIES_NAMES;

  const GAME_FISH_NAMES = new Set([
    'walleye','northern pike','largemouth bass','smallmouth bass','muskellunge',
    'tiger muskie','yellow perch','black crappie','white crappie','bluegill',
    'saugeye','sauger','rainbow trout','brown trout','brook trout','lake trout',
    'channel catfish','flathead catfish','white bass','wiper','hybrid striped bass',
  ]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const base = species.filter(s => {
      const name = (namesMap[s.species] ?? s.species).toLowerCase();
      return name.includes(q) || s.species.toLowerCase().includes(q);
    });
    return base.sort((a, b) => {
      const ag = usesFullNames ? GAME_FISH_NAMES.has(a.species.toLowerCase()) : GAME_FISH.has(a.species);
      const bg = usesFullNames ? GAME_FISH_NAMES.has(b.species.toLowerCase()) : GAME_FISH.has(b.species);
      if (ag && !bg) return -1;
      if (!ag && bg) return 1;
      return 0;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [species, query, namesMap, usesFullNames]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe}>
        <PaperHeader
          modal
          title="Select Species"
          right={
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[text.labelL, { color: colors.destructive }]}>Cancel</Text>
            </Pressable>
          }
        />
        <TextInput
          style={styles.search}
          placeholder="Search species…"
          placeholderTextColor={colors.inkSoft}
          value={query}
          onChangeText={setQuery}
          autoFocus
          clearButtonMode="while-editing"
        />
        <Pressable
          onPress={() => { onSelect(''); onClose(); }}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: pressed ? colors.paper2 : colors.paper },
          ]}>
          <Text style={[
            text.bodyL,
            { flex: 1, color: !selected ? colors.walleye2 : colors.ink },
          ]}>
            All Species
          </Text>
          {!selected && <Text style={[text.labelL, { color: colors.walleye2 }]}>✓</Text>}
        </Pressable>
        <FlatList
          data={filtered}
          keyExtractor={item => item.species}
          contentContainerStyle={{ paddingBottom: kbHeight }}
          renderItem={({ item }) => {
            const name = namesMap[item.species] ?? item.species;
            const isSelected = selected === item.species;
            return (
              <Pressable
                onPress={() => { onSelect(item.species); onClose(); }}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? colors.paper2 : colors.paper },
                ]}>
                <View style={{ flex: 1 }}>
                  <Text style={[
                    text.bodyL,
                    { color: isSelected ? colors.walleye2 : colors.ink },
                  ]}>
                    {name}
                  </Text>
                  <Text style={[text.dataS, { color: colors.inkSoft, marginTop: 2 }]}>
                    {item.species} · {item.lake_count.toLocaleString()} lakes
                  </Text>
                </View>
                {isSelected && <Text style={[text.labelL, { color: colors.walleye2 }]}>✓</Text>}
              </Pressable>
            );
          }}
          keyboardShouldPersistTaps="handled"
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  search: {
    margin: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderWidth: hairline,
    borderColor: colors.paper3,
    backgroundColor: colors.paper2,
    color: colors.ink,
    ...text.dataS,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: 12,
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },
});
