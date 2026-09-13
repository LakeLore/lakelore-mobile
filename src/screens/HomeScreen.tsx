// HomeScreen — launch chooser (2026-09-12, owner request). Every open offers
// two doors: be given recommendations (the Ask LakeLore chat) or review the
// lake rankings yourself (the state → county → search flow). Both destinations
// can cross over later: Search carries a floating "✦ Ask" button and the chat
// header carries a "Rankings" button. Only mounted as the initial route when
// the Ask feature is enabled (App.tsx).

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppState } from '../StateContext';
import type { RootStackParamList } from '../navigation';
import { colors, text, space, hairline } from '../lakelore-rn/theme';
import { PaperHeader } from '../lakelore-rn/components';

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { hasState } = useAppState();

  const goAsk = () => navigation.replace('Ask');
  const goRankings = () => navigation.replace(hasState ? 'Search' : 'StateSelect');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <PaperHeader title="LakeLore" eyebrow="FIELD GUIDE · LAKE SURVEYS" />
      <View style={styles.body}>
        <Text style={[text.editorialM, { color: colors.ink2, marginBottom: space.xxl }]}>
          How do you want to find your next lake?
        </Text>

        <Pressable
          onPress={goAsk}
          accessibilityRole="button"
          accessibilityLabel="Give me recommendations"
          accessibilityHint="Opens the Ask LakeLore chat"
          style={({ pressed }) => [styles.card, styles.cardPrimary, { opacity: pressed ? 0.88 : 1 }]}>
          <Text style={[text.labelL, { color: colors.flash, marginBottom: space.sm }]}>✦ ASK LAKELORE</Text>
          <Text style={[text.displayL, { color: colors.paper }]}>Ask LakeLore where to fish.</Text>
          <Text style={[text.bodyM, { color: colors.paper3, marginTop: space.sm }]}>
            Say what you’re after in plain words — a species, a place, big fish or lots of them — and get lakes picked for you from the survey data.
          </Text>
        </Pressable>

        <Pressable
          onPress={goRankings}
          accessibilityRole="button"
          accessibilityLabel="I'll review the lake rankings myself"
          accessibilityHint="Opens the state and county selectors"
          style={({ pressed }) => [styles.card, styles.cardSecondary, { backgroundColor: pressed ? colors.paper2 : colors.paper }]}>
          <Text style={[text.labelL, { color: colors.walleye2, marginBottom: space.sm }]}>BROWSE THE RANKINGS</Text>
          <Text style={[text.displayL, { color: colors.ink }]}>I’ll review the lake rankings myself</Text>
          <Text style={[text.bodyM, { color: colors.inkSoft, marginTop: space.sm }]}>
            Pick a state and county, then sort every surveyed lake by catch rate, size, stocking, or trophy fish.
          </Text>
        </Pressable>

        <Text style={[text.bodyS, { color: colors.inkSoft, marginTop: 'auto' }]}>
          You can switch between the two any time.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  body: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.xl },
  card: {
    paddingHorizontal: space.xl,
    paddingVertical: space.xxl,
    marginBottom: space.lg,
  },
  cardPrimary: { backgroundColor: colors.ink },
  cardSecondary: { borderWidth: hairline, borderColor: colors.ink },
});
