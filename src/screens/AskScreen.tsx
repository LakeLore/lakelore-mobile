// AskScreen — "Ask LakeLore" (2026-09-10). A chat over POST /api/:state/ask:
// the angler says what they want in plain words, the server-side assistant
// searches the same survey data the Search screen filters, and answers with
// tappable lake names + lake cards that open LakeDetail.
//
// Conversation state is in-memory for this visit only; every turn re-sends
// the whole history (plain text, markers stripped) because the server is
// stateless. Dev-only until the route ships in production (src/askFeature.ts).

import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppState } from '../StateContext';
import { askLakes, AskLake, AskMessage, SubscriptionRequiredError } from '../api';
import { parseAskMarkers, stripAskMarkers } from '../askMarkers';
import { AskTurn, getAskSession, saveAskSession, clearAskSession } from '../askSession';
import PaywallScreen from './PaywallScreen';
import { STATE_CONFIGS } from '../types';
import type { RootStackParamList } from '../navigation';
import { colors, text, space, hairline } from '../lakelore-rn/theme';
import { PaperHeader, Chip } from '../lakelore-rn/components';

type Turn = AskTurn;

const STARTERS = [
  'Where should I fish for walleye this weekend?',
  'Small lake with big northern pike',
  'Which lakes have the most crappie?',
];

export default function AskScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state, hasState } = useAppState();
  const stateCfg = STATE_CONFIGS[state];
  // Reached from the launch chooser (replace → nothing to go back to) or
  // pushed from Search's floating button (back returns there). Either way
  // the header carries an explicit door to the rankings flow.
  const canGoBack = navigation.canGoBack();
  const goRankings = useCallback(() => {
    if (canGoBack) { navigation.goBack(); return; }
    navigation.replace(hasState ? 'Search' : 'StateSelect');
  }, [canGoBack, hasState, navigation]);
  // Conversation restores from the per-state session store (owner
  // 2026-09-14: switching to the data view and back keeps the chat).
  const [turns, setTurns] = useState<Turn[]>(() => getAskSession(state));
  const commit = useCallback((next: Turn[]) => {
    saveAskSession(state, next);   // store first — survives unmount mid-flight
    setTurns(next);
  }, [state]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const openLake = useCallback((l: AskLake) => {
    if (!l.lake_name) return;
    navigation.navigate('LakeDetail', {
      lakeId: l.lake_id,
      lakeName: l.lake_name,
      species: l.species_native ?? '',
      state,
    });
  }, [navigation, state]);

  const send = useCallback(async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const history: AskMessage[] = turns
      .filter(t => !t.error)
      .map(t => ({ role: t.role, content: t.content }));
    const next: Turn[] = [...turns, { role: 'user', content: question }];
    commit(next);
    setInput('');
    setBusy(true);
    try {
      const r = await askLakes(state, [...history, { role: 'user', content: question }]);
      commit([...next, {
        role: 'assistant',
        content: r.answer_text || stripAskMarkers(r.answer),
        display: r.answer,
        lakes: r.lakes ?? [],
      }]);
    } catch (err) {
      if (err instanceof SubscriptionRequiredError) {
        setPaywall(true);
        commit(next.slice(0, -1));
      } else {
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        commit([...next, { role: 'assistant', content: msg, error: true }]);
      }
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [busy, state, turns, commit]);

  const renderAssistant = (t: Turn, idx: number) => {
    const lakesById = new Map((t.lakes ?? []).map(l => [l.lake_id, l]));
    const segs = parseAskMarkers(t.display ?? t.content);
    return (
      <View key={idx} style={styles.assistantWrap}>
        <Text style={[text.labelS, { color: colors.walleye2, marginBottom: 4 }]}>LAKELORE</Text>
        <Text style={[text.bodyL, { color: t.error ? colors.destructive : colors.ink }]}>
          {segs.map((s, i) => {
            if (s.type === 'text') return <Text key={i}>{s.text}</Text>;
            const lake = lakesById.get(s.id);
            if (!lake || !lake.lake_name) return <Text key={i} style={{ fontFamily: text.bodyBold.fontFamily }}>{s.name}</Text>;
            return (
              <Text
                key={i}
                onPress={() => openLake(lake)}
                accessibilityRole="link"
                style={{ fontFamily: text.bodyBold.fontFamily, color: colors.walleye2, textDecorationLine: 'underline' }}>
                {s.name}
              </Text>
            );
          })}
        </Text>
        {/* Lake cards removed 2026-09-14 (owner: redundant with the
            inline tappable links). t.lakes still resolves the links. */}
      </View>
    );
  };

  return (
    // Bottom edge included (2026-09-12): without it the input row sat under
    // the home indicator and was clipped on the owner's phone.
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <PaperHeader
        title="Ask LakeLore"
        eyebrow={`${stateCfg.label.toUpperCase()} · ASSISTANT`}
        right={turns.length > 0 ? (
          <Pressable
            onPress={() => { clearAskSession(state); setTurns([]); setInput(''); }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Start a new chat"
            style={styles.newChatBtn}>
            <Text style={[text.labelL, { color: colors.paper }]}>＋ New chat</Text>
          </Pressable>
        ) : undefined}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {turns.length === 0 && (
            <View style={styles.empty}>
              <Text style={[text.editorialM, { color: colors.ink2 }]}>
                Say what you’re after — a species, a place, big fish or lots of fish — and I’ll search {stateCfg.label}’s survey data for you.
              </Text>
              <View style={styles.starters}>
                {STARTERS.map(s => (
                  <Chip key={s} soft onPress={() => send(s)} style={{ marginBottom: space.md }}>{s}</Chip>
                ))}
              </View>
              <Text style={[text.bodyS, { color: colors.inkSoft, marginTop: space.xl }]}>
                Answers come only from agency survey and stocking records. Always check current regulations.
              </Text>
            </View>
          )}
          {turns.map((t, i) => t.role === 'user'
            ? (
              <View key={i} style={styles.userWrap}>
                <Text style={[text.bodyL, { color: colors.paper }]}>{t.content}</Text>
              </View>
            )
            : renderAssistant(t, i))}
          {busy && (
            <View style={styles.assistantWrap}>
              <Text style={[text.labelS, { color: colors.walleye2, marginBottom: 4 }]}>LAKELORE</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <ActivityIndicator size="small" color={colors.ink} />
                <Text style={[text.bodyM, { color: colors.inkSoft }]}>Checking surveys…</Text>
              </View>
            </View>
          )}
          {/* Input flows RIGHT UNDER the conversation (owner 2026-09-13) —
              not pinned to the screen bottom — so the floating pill below
              never covers it. */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={`Ask about ${stateCfg.label} lakes…`}
              placeholderTextColor={colors.inkSoft}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
              editable={!busy}
              multiline
              maxLength={2000}
              accessibilityLabel="Your question"
            />
            <Pressable
              onPress={() => send(input)}
              disabled={busy || !input.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={({ pressed }) => [styles.sendBtn, { opacity: busy || !input.trim() ? 0.4 : pressed ? 0.85 : 1 }]}>
              <Text style={[text.labelL, { color: colors.paper }]}>Ask</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Return to the data view — same floating-pill treatment as the Ask
          entry on SearchScreen (owner 2026-09-13; replaces the top-right
          "Rankings ›" header button and the back arrow). */}
      <Pressable
        onPress={goRankings}
        accessibilityRole="button"
        accessibilityLabel="Review the lake rankings"
        style={({ pressed }) => [styles.dataFab, { opacity: pressed ? 0.88 : 1 }]}>
        <Text style={[text.displayM, { color: colors.flash, marginRight: space.sm }]}>≡</Text>
        <Text style={[text.labelL, { color: colors.paper, fontSize: 13 }]}>Review lake ranking data.</Text>
      </Pressable>

      <PaywallScreen
        visible={paywall}
        triggeredFrom={stateCfg.label}
        onClose={() => setPaywall(false)}
        onPurchased={() => setPaywall(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  thread: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: 96, gap: space.xl },
  empty: { paddingTop: space.md },
  starters: { marginTop: space.xl, alignItems: 'flex-start' },
  userWrap: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    backgroundColor: colors.ink,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  assistantWrap: {
    alignSelf: 'stretch',
    borderLeftWidth: 2,
    borderLeftColor: colors.walleye,
    paddingLeft: space.lg,
  },
  inputRow: {
    flexDirection: 'row',
    gap: space.md,
    marginTop: space.md,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: hairline,
    borderColor: colors.paper3,
    backgroundColor: colors.paper2,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    color: colors.ink,
    ...text.bodyM,
  },
  sendBtn: {
    backgroundColor: colors.ink,
    paddingHorizontal: space.xl,
    height: 44,
    justifyContent: 'center',
  },
  newChatBtn: {
    borderWidth: hairline,
    borderColor: colors.paper3,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  dataFab: {
    position: 'absolute',
    zIndex: 100,
    alignSelf: 'center',
    bottom: space.xl,
    height: 60,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 999,
    borderWidth: hairline,
    borderColor: colors.walleye,
    shadowColor: colors.ink,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
});
