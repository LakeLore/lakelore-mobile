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
import PaywallScreen from './PaywallScreen';
import { STATE_CONFIGS } from '../types';
import type { RootStackParamList } from '../navigation';
import { colors, text, space, hairline } from '../lakelore-rn/theme';
import { PaperHeader, LakeRow, Chip } from '../lakelore-rn/components';

interface Turn {
  role: 'user' | 'assistant';
  /** Plain text — what goes back to the server as history. */
  content: string;
  /** Assistant only: the answer with [[id|Name]] markers, for rendering. */
  display?: string;
  lakes?: AskLake[];
  /** Local error note (network, quota) — never sent back as history. */
  error?: boolean;
}

const STARTERS = [
  'Where should I fish for walleye this weekend?',
  'Small lake with big northern pike',
  'Which lakes have the most crappie?',
];

function fmtAcres(a?: number | null) {
  return a != null ? `${Math.round(a).toLocaleString()} ac` : null;
}

function lakeLocation(l: AskLake): string {
  return [l.county, fmtAcres(l.acres), l.max_depth_ft != null ? `${l.max_depth_ft} ft` : null,
    l.survey_year ? `${l.survey_year}` : null].filter(Boolean).join(' · ');
}

function lakeRight(l: AskLake): { value: string; label: string } {
  if (l.cpue != null) return { value: String(l.cpue), label: 'Catch Rate' };
  if (l.avg_weight_lb != null) return { value: `${l.avg_weight_lb}`, label: 'Avg lb' };
  if (l.avg_length_in != null) return { value: `${l.avg_length_in}`, label: 'Avg in' };
  if (l.stocked_adults_per_100ac != null) return { value: `${l.stocked_adults_per_100ac}`, label: 'Stocked /100ac' };
  if (l.rating) return { value: l.rating, label: 'Rating' };
  return { value: '—', label: '' };
}

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
  const [turns, setTurns] = useState<Turn[]>([]);
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
    setTurns(next);
    setInput('');
    setBusy(true);
    try {
      const r = await askLakes(state, [...history, { role: 'user', content: question }]);
      setTurns([...next, {
        role: 'assistant',
        content: r.answer_text || stripAskMarkers(r.answer),
        display: r.answer,
        lakes: r.lakes ?? [],
      }]);
    } catch (err) {
      if (err instanceof SubscriptionRequiredError) {
        setPaywall(true);
        setTurns(next.slice(0, -1));
      } else {
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        setTurns([...next, { role: 'assistant', content: msg, error: true }]);
      }
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [busy, state, turns]);

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
        {(t.lakes?.length ?? 0) > 0 && (
          <View style={styles.cards}>
            {t.lakes!.map(l => {
              const right = lakeRight(l);
              const stats: [string, string][] = [];
              if (l.species) stats.push(['Species', l.species]);
              if (l.gear) stats.push(['Gear', l.gear]);
              return (
                <LakeRow
                  key={l.lake_id}
                  name={l.lake_name ?? 'Lake'}
                  location={lakeLocation(l)}
                  stats={stats}
                  rightValue={right.value}
                  rightLabel={right.label}
                  onPress={() => openLake(l)}
                />
              );
            })}
          </View>
        )}
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
        onBack={canGoBack ? () => navigation.goBack() : undefined}
        backLabel="←"
        right={(
          <Pressable
            onPress={goRankings}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Review the lake rankings myself"
            style={styles.rankingsBtn}>
            <Text style={[text.labelL, { color: colors.paper }]}>Rankings ›</Text>
          </Pressable>
        )}
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
        </ScrollView>
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
      </KeyboardAvoidingView>

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
  thread: { paddingHorizontal: space.xl, paddingVertical: space.xl, gap: space.xl },
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
  cards: {
    marginTop: space.lg,
    borderTopWidth: hairline,
    borderColor: colors.paper3,
  },
  inputRow: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderTopWidth: hairline,
    borderColor: colors.paper3,
    backgroundColor: colors.paper,
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
  rankingsBtn: {
    borderWidth: hairline,
    borderColor: colors.paper3,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
});
