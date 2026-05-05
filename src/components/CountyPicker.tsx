import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  Modal, StyleSheet, SafeAreaView,
} from 'react-native';

interface Props {
  visible: boolean;
  counties: string[];
  selected: string[];
  onConfirm: (selected: string[]) => void;
  onClose: () => void;
}

export default function CountyPicker({ visible, counties, selected, onConfirm, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<string[]>(selected);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return counties.filter(c => c.toLowerCase().includes(q));
  }, [counties, query]);

  const toggle = (county: string) => {
    setDraft(prev =>
      prev.includes(county) ? prev.filter(c => c !== county) : [...prev, county]
    );
  };

  const handleOpen = () => {
    setDraft(selected);
    setQuery('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={handleOpen}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Counties</Text>
          <TouchableOpacity onPress={() => { onConfirm(draft); onClose(); }}>
            <Text style={styles.done}>Done ({draft.length})</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.search}
          placeholder="Search counties..."
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
        />
        {draft.length > 0 && (
          <TouchableOpacity
            style={styles.clearRow}
            onPress={() => setDraft([])}
          >
            <Text style={styles.clearText}>Clear all ({draft.length} selected)</Text>
          </TouchableOpacity>
        )}
        <FlatList
          data={filtered}
          keyExtractor={item => item}
          renderItem={({ item }) => {
            const isSelected = draft.includes(item);
            return (
              <TouchableOpacity style={styles.row} onPress={() => toggle(item)}>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.rowText}>{item}</Text>
              </TouchableOpacity>
            );
          }}
          keyboardShouldPersistTaps="handled"
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 17, fontWeight: '600', color: '#1e293b' },
  cancel: { fontSize: 16, color: '#94a3b8', minWidth: 60 },
  done: { fontSize: 16, color: '#3b82f6', fontWeight: '600', minWidth: 60, textAlign: 'right' },
  search: {
    margin: 12, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#f1f5f9', borderRadius: 10, fontSize: 15,
  },
  clearRow: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0',
  },
  clearText: { color: '#ef4444', fontSize: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0',
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: '#cbd5e1', marginRight: 12, alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rowText: { fontSize: 16, color: '#1e293b' },
});
