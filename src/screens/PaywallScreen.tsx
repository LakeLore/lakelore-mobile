// src/screens/PaywallScreen.tsx — the LakeLore All-States paywall modal.
//
// Visual style: paper-and-ink, matches the rest of the app. Apple is strict
// about pre-purchase disclosures on subscription apps — title, length,
// auto-renew language, links to terms + privacy must all be visible
// *before* the user taps subscribe. Missing any of these is a common
// rejection reason. Everything below is built to be correct by construction.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal, View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { PurchasesPackage } from 'react-native-purchases';
import {
  isIapConfigured,
  getOffering,
  purchasePackage,
  restorePurchases,
} from '../iap';
import { fetchMyEntitlement } from '../api';
import { GENERATED_STATES } from '../types';
import { ACTIVE_STATES } from '../activeStates';
import { TOTAL_ACTIVE_LAKES, TOTAL_ACTIVE_RECORDS, type StateKey } from '../generated/states';
import { colors, text, space, hairline } from '../lakelore-rn/theme';
import { PaperHeader, PrimaryButton } from '../lakelore-rn/components';

const TERMS_URL   = 'https://www.lakeloreapp.com/terms';
const PRIVACY_URL = 'https://www.lakeloreapp.com/privacy';

interface Props {
  visible: boolean;
  /** Which state the user tapped to trigger the paywall — for context copy. */
  triggeredFrom?: string;
  onClose: () => void;
  onPurchased: () => void;
}

export default function PaywallScreen({ visible, triggeredFrom, onClose, onPurchased }: Props) {
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [loadingPkg, setLoadingPkg] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOffering = useCallback(async () => {
    setError(null);
    setLoadingPkg(true);
    const offering = await getOffering();
    const annual = offering?.annual ?? offering?.availablePackages?.[0] ?? null;
    setPkg(annual);
    setLoadingPkg(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    loadOffering();
  }, [visible, loadOffering]);

  const handleSubscribe = async () => {
    if (!pkg) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPurchasing(true);
    setError(null);
    const result = await purchasePackage(pkg);
    if ('ok' in result) {
      // Prime the server's per-user entitlement cache *before* handing back to
      // the caller. The server caches per-user for 5 min and the cache may
      // hold a stale "false" from before this purchase (e.g. from the request
      // that triggered the paywall). Without this, the immediate post-purchase
      // data fetch returns 402 and bounces the user right back to the paywall.
      // Worst case ~1 s added to the "Subscribing…" state.
      await fetchMyEntitlement().catch(() => {});
      setPurchasing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onPurchased();
      onClose();
    } else if ('cancelled' in result) {
      setPurchasing(false);
      // User dismissed the system sheet — no error, just stay on paywall.
    } else {
      setPurchasing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(result.error || 'Purchase failed. Please try again.');
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);
    const result = await restorePurchases();
    if (result === 'restored') {
      // Same priming rationale as handleSubscribe — restored entitlement
      // needs to land in the server cache before the caller refetches data.
      await fetchMyEntitlement().catch(() => {});
      setRestoring(false);
      onPurchased();
      onClose();
    } else {
      setRestoring(false);
      setError(result === 'none'
        ? 'No active subscription found on this account.'
        : "Couldn't reach the store — check your connection and try again.");
    }
  };

  // Display price — pulled live from the store via RC, so currency formatting
  // is correct for the user's region. When the package can't load (RC blip,
  // IAP not yet approved), the disclosure falls back to the STATIC USD price
  // (2026-07-26, store red-team #11): "auto-renews for the listed price" with
  // no amount is itself a 3.1.2 disclosure failure. The store sheet remains
  // authoritative at purchase time and localizes the currency.
  const priceLabel = pkg?.product.priceString ?? null;
  const priceLabelOrFallback = priceLabel ?? 'US$4.99';
  const paidStatesPhrase = PAID_CA > 0
    ? `${PAID_US} more states + ${PAID_CA} Canadian province${PAID_CA === 1 ? '' : 's'}`
    : `${PAID_US} more states`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <PaperHeader
          modal
          title="LakeLore All-States"
          onBack={onClose}
          backLabel="Cancel"
        />

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.heroEyebrow}>
            <View style={styles.dot} />
            <Text style={[text.labelM, { color: colors.walleye2 }]}>UPGRADE · ATLAS PASS</Text>
          </View>

          <Text style={[text.displayL, styles.headline]}>
            {contextName(triggeredFrom)
              ? `Unlock ${contextName(triggeredFrom)} — and every other state.`
              : PAID_CA > 0 ? 'Unlock every state & province.' : 'Unlock every state.'}
          </Text>

          <Text style={[text.bodyL, { color: colors.ink2, marginTop: 16 }]}>
            Minnesota stays free. Add an annual All-States Pass for {paidStatesPhrase}.
          </Text>

          {/* Value props */}
          <View style={styles.valuePropsBox}>
            {ACTIVE_VALUE_PROPS.map(line => (
              <View key={line.label} style={styles.valuePropRow}>
                <Text style={[text.dataM, { color: colors.walleye2, width: 26 }]}>›</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyM, { color: colors.ink }]}>{line.label}</Text>
                  <Text style={[text.bodyS, { color: colors.inkSoft, marginTop: 2 }]}>
                    {line.detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Pricing card */}
          <View style={styles.priceCard}>
            <Text style={[text.labelS, { color: colors.inkSoft }]}>ANNUAL · AUTO-RENEWS</Text>
            {priceLabel ? (
              <Text style={[text.displayM, { color: colors.ink, marginTop: 6 }]}>
                {priceLabel}{' '}
                <Text style={[text.bodyM, { color: colors.inkSoft }]}>/ year</Text>
              </Text>
            ) : (
              <Text style={[text.bodyM, { color: colors.inkSoft, marginTop: 6 }]}>
                Loading price…
              </Text>
            )}
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={[text.bodyS, { color: colors.paper }]}>{error}</Text>
            </View>
          )}

          {/* Primary CTA */}
          {loadingPkg ? (
            <View style={styles.ctaLoading}>
              <ActivityIndicator color={colors.ink} />
              <Text style={[text.labelM, { color: colors.inkSoft, marginTop: 8 }]}>
                Loading subscription…
              </Text>
            </View>
          ) : pkg ? (
            <PrimaryButton onPress={purchasing ? undefined : handleSubscribe} style={styles.cta}>
              {purchasing
                ? 'Subscribing…'
                : priceLabel
                  ? `Subscribe — ${priceLabel}/yr`
                  : 'Subscribe'}
            </PrimaryButton>
          ) : !isIapConfigured() ? (
            <View style={styles.unavailable}>
              <Text style={[text.bodyS, { color: colors.inkSoft, textAlign: 'center' }]}>
                Subscriptions aren&rsquo;t available in this build yet.
              </Text>
            </View>
          ) : (
            <View style={styles.unavailable}>
              <Text style={[text.bodyS, { color: colors.inkSoft, textAlign: 'center', marginBottom: 8 }]}>
                Couldn&rsquo;t load the subscription.
              </Text>
              {/* Static disclosure so length/price/renewal terms remain visible
                  even when the offering fails to load (2026-07-26, #11). */}
              <Text style={[text.bodyS, { color: colors.inkSoft, textAlign: 'center', marginBottom: 12 }]}>
                LakeLore All-States — US$4.99 / year, auto-renewing (shown in your local
                currency at purchase).
              </Text>
              <PrimaryButton onPress={loadOffering}>Try again</PrimaryButton>
            </View>
          )}

          {/* Continue with the free tier — explicit dismissal alternative to the
              header Cancel button. Apple reviewers reward clear opt-out paths. */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Continue with Minnesota, free"
            style={styles.freeTier}>
            <Text style={[text.labelM, { color: colors.inkSoft }]}>
              Continue with Minnesota — free
            </Text>
          </Pressable>

          {/* Restore */}
          <Pressable
            onPress={restoring ? undefined : handleRestore}
            accessibilityRole="button"
            accessibilityLabel={restoring ? 'Restoring' : 'Restore purchases'}
            style={styles.restore}>
            <Text style={[text.labelM, { color: colors.walleye2 }]}>
              {restoring ? 'Restoring…' : 'Restore purchases'}
            </Text>
          </Pressable>

          {/* Required disclosures (Apple checks for these at review) */}
          <View style={styles.disclosures}>
            <Text style={[text.bodyS, { color: colors.inkSoft }]}>
              Subscription auto-renews each year for {priceLabelOrFallback} unless
              cancelled at least 24 hours before the end of the current period. You
              can manage or cancel in your device&rsquo;s subscription settings any
              time. Payment is charged to your{' '}
              <Text style={{ color: colors.ink2 }}>
                {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}
              </Text>{' '}
              account.
            </Text>
            <View style={styles.legalRow}>
              <Pressable
                onPress={() => Linking.openURL(TERMS_URL)}
                accessibilityRole="link"
                accessibilityLabel="Terms of use"
                accessibilityHint="Opens in browser">
                <Text style={[text.labelS, { color: colors.walleye2 }]}>TERMS OF USE</Text>
              </Pressable>
              <Text style={[text.labelS, { color: colors.paper3 }]} accessibilityElementsHidden>·</Text>
              <Pressable
                onPress={() => Linking.openURL(PRIVACY_URL)}
                accessibilityRole="link"
                accessibilityLabel="Privacy policy"
                accessibilityHint="Opens in browser">
                <Text style={[text.labelS, { color: colors.walleye2 }]}>PRIVACY POLICY</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}


// Contextual headline (D5): callers historically pass triggeredFrom in mixed
// formats — a display label ("Wisconsin") or a raw state key ("wi"). Resolve
// keys through the generated registry; anything else passes through as-is.
function contextName(triggeredFrom?: string): string | null {
  if (!triggeredFrom) return null;
  const asKey = GENERATED_STATES[triggeredFrom as StateKey];
  return asKey ? asKey.name : triggeredFrom;
}

// "64,000+ lakes" style floor phrasing — truthful as data grows, never
// overstates.
const floorK = (n: number) => `${Math.floor(n / 1000).toLocaleString()},000+`;

// Coverage counts derived from the generated registry export — stay correct
// as states are added without touching this copy.
const PAID_STATES = ACTIVE_STATES.filter(s => !GENERATED_STATES[s].free);
const PAID_US = PAID_STATES.filter(s => GENERATED_STATES[s].country === 'US').length;
const PAID_CA = PAID_STATES.filter(s => GENERATED_STATES[s].country === 'CA').length;

// With the whole continent covered, per-state rows no longer scale — the
// value props aggregate instead.
const ACTIVE_VALUE_PROPS: { label: string; detail: string }[] = [
  { label: `${floorK(TOTAL_ACTIVE_LAKES)} lakes · ${floorK(TOTAL_ACTIVE_RECORDS)} records`,
    detail: 'Agency survey, stocking, and forecast data — counted at build time, growing every refresh' },
  { label: PAID_CA > 0
      ? `${PAID_US} more US states + ${PAID_CA} Canadian province${PAID_CA === 1 ? '' : 's'}`
      : `${PAID_US} more US states`,
    detail: PAID_CA > 0
      ? 'Every state and province LakeLore covers, in one pass'
      : 'Every state LakeLore covers, in one pass' },
  { label: 'Lake names & locations revealed',
    detail: 'Preview mode shows the numbers — the pass shows you which lakes' },
  { label: PAID_CA > 0 ? 'State & provincial agency survey data' : 'State agency survey data',
    detail: 'Netting + electrofishing catch rates, lengths, and stocking records' },
  { label: 'Every future state included',
    detail: 'New coverage lands in the same subscription at no extra cost' },
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: {
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: 40,
  },

  heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.walleye },

  headline: {
    color: colors.ink,
    marginTop: 6,
  },

  valuePropsBox: {
    marginTop: 28,
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: hairline,
    borderBottomWidth: hairline,
    borderColor: colors.paper3,
  },
  valuePropRow: {
    flexDirection: 'row',
    paddingVertical: 10,
  },

  priceCard: {
    marginTop: 28,
    padding: space.xl,
    borderWidth: hairline,
    borderColor: colors.ink,
    backgroundColor: colors.paper2,
  },

  errorBanner: {
    marginTop: 16,
    backgroundColor: colors.rust,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },

  ctaLoading: {
    marginTop: 24,
    alignItems: 'center',
  },
  cta: {
    marginTop: 24,
    paddingVertical: 16,
  },
  unavailable: {
    marginTop: 24,
    padding: space.lg,
    borderWidth: hairline,
    borderColor: colors.paper3,
    alignItems: 'center',
  },
  freeTier: {
    marginTop: 18,
    alignItems: 'center',
    padding: 8,
  },
  restore: {
    marginTop: 6,
    alignItems: 'center',
    padding: 8,
  },

  disclosures: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: hairline,
    borderTopColor: colors.paper3,
  },
  legalRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
});
