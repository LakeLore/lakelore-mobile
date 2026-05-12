// src/screens/PaywallScreen.tsx — the LakeLore All-States paywall modal.
//
// Visual style: paper-and-ink, matches the rest of the app. Apple is strict
// about pre-purchase disclosures on subscription apps — title, length,
// auto-renew language, links to terms + privacy must all be visible
// *before* the user taps subscribe. Missing any of these is a common
// rejection reason. Everything below is built to be correct by construction.

import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Linking, SafeAreaView,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import {
  isIapConfigured,
  getOffering,
  purchasePackage,
  restorePurchases,
} from '../iap';
import { colors, text, space, hairline } from '../lakelore-rn/theme';
import { PaperHeader, PrimaryButton } from '../lakelore-rn/components';

const TERMS_URL   = 'https://lakeloreapp.com/terms';
const PRIVACY_URL = 'https://lakeloreapp.com/privacy';

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

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setLoadingPkg(true);
    (async () => {
      const offering = await getOffering();
      const annual = offering?.annual ?? offering?.availablePackages?.[0] ?? null;
      setPkg(annual);
      setLoadingPkg(false);
    })();
  }, [visible]);

  const handleSubscribe = async () => {
    if (!pkg) return;
    setPurchasing(true);
    setError(null);
    const result = await purchasePackage(pkg);
    setPurchasing(false);
    if ('ok' in result) {
      onPurchased();
      onClose();
    } else if ('cancelled' in result) {
      // User dismissed the system sheet — no error, just stay on paywall.
    } else {
      setError(result.error || 'Purchase failed. Please try again.');
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);
    const ok = await restorePurchases();
    setRestoring(false);
    if (ok) {
      onPurchased();
      onClose();
    } else {
      setError('No active subscription found on this account.');
    }
  };

  // Display price — pulled live from the store via RC, so currency formatting
  // is correct for the user's region. Fallback to the hardcoded USD value
  // when the package hasn't loaded yet.
  const priceLabel = pkg?.product.priceString ?? '$5.99';

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
            Unlock the rest of the atlas.
          </Text>

          <Text style={[text.bodyL, { color: colors.ink2, marginTop: 16 }]}>
            Minnesota is free, with all 9,000+ surveyed lakes. Add an annual
            All-States Pass for the rest of the upper Midwest.
          </Text>

          {/* Value props */}
          <View style={styles.valuePropsBox}>
            {VALUE_PROPS.map(line => (
              <View key={line.label} style={styles.valuePropRow}>
                <Text style={[text.dataM, { color: colors.walleye2, width: 26 }]}>›</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyM, { color: colors.ink }]}>{line.label}</Text>
                  {line.detail && (
                    <Text style={[text.bodyS, { color: colors.inkSoft, marginTop: 2 }]}>
                      {line.detail}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Pricing card */}
          <View style={styles.priceCard}>
            <Text style={[text.labelS, { color: colors.inkSoft }]}>ANNUAL · AUTO-RENEWS</Text>
            <Text style={[text.displayM, { color: colors.ink, marginTop: 6 }]}>
              {priceLabel}{' '}
              <Text style={[text.bodyM, { color: colors.inkSoft }]}>/ year</Text>
            </Text>
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
              {purchasing ? 'Subscribing…' : `Subscribe — ${priceLabel}/yr`}
            </PrimaryButton>
          ) : !isIapConfigured() ? (
            <View style={styles.unavailable}>
              <Text style={[text.bodyS, { color: colors.inkSoft, textAlign: 'center' }]}>
                Subscriptions aren&rsquo;t available in this build yet.
              </Text>
            </View>
          ) : (
            <View style={styles.unavailable}>
              <Text style={[text.bodyS, { color: colors.inkSoft, textAlign: 'center' }]}>
                Couldn&rsquo;t load the subscription. Please try again.
              </Text>
            </View>
          )}

          {/* Restore */}
          <Pressable onPress={restoring ? undefined : handleRestore} style={styles.restore}>
            <Text style={[text.labelM, { color: colors.walleye2 }]}>
              {restoring ? 'Restoring…' : 'Restore purchases'}
            </Text>
          </Pressable>

          {/* Required disclosures (Apple checks for these at review) */}
          <View style={styles.disclosures}>
            <Text style={[text.bodyS, { color: colors.inkSoft }]}>
              Subscription auto-renews each year for {priceLabel} unless cancelled at
              least 24 hours before the end of the current period. You can manage or
              cancel in your device&rsquo;s subscription settings any time. Payment is
              charged to your{' '}
              <Text style={{ color: colors.ink2 }}>App Store</Text> or{' '}
              <Text style={{ color: colors.ink2 }}>Google Play</Text> account.
            </Text>
            <View style={styles.legalRow}>
              <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
                <Text style={[text.labelS, { color: colors.walleye2 }]}>TERMS OF USE</Text>
              </Pressable>
              <Text style={[text.labelS, { color: colors.paper3 }]}>·</Text>
              <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
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

const VALUE_PROPS = [
  {
    label: 'Wisconsin DNR',
    detail: '2,329 lakes — DNR netting, electrofishing, length data',
  },
  {
    label: 'Michigan DNR',
    detail: '367 lakes — survey reports + stocking',
  },
  {
    label: 'North Dakota Game & Fish',
    detail: '452 lakes — netting CPUE + average length',
  },
  {
    label: 'South Dakota GFP',
    detail: '327 lakes — PSD, Wr, gill-net + electrofishing',
  },
  {
    label: 'Nebraska Game & Parks',
    detail: '487 lakes — survey PDFs linked inline',
  },
  {
    label: 'Iowa DNR',
    detail: '1,258 lakes — fyke, hoop, electrofishing comprehensives',
  },
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
  restore: {
    marginTop: 14,
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
