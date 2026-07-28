// UpdateGate (2026-07-25, IMPROVEMENT_PLAN_2026-07-25 T1.1) — the upgrade
// nudge / kill switch the fleet never had. On launch and on every
// foreground, fetches GET /api/client-config (env-var driven server-side,
// 5-min CDN-cacheable) and compares this binary's version:
//
//   killedVersions includes us  → full-screen BLOCKING update screen
//                                 (bad-release kill switch — flipped with
//                                 `flyctl secrets set LAKELORE_KILLED_VERSIONS=…`)
//   minVersion is newer than us → dismissible once-per-session "please update"
//
// Failure-soft by design: any network/parse hiccup means 'ok' — never block
// a fisherman on a config fetch. Because runtimeVersion.policy=appVersion
// strands old fleets OTA-wise, this component shipping IN the binary is the
// only lever that reaches them later.
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Platform, Pressable, Text, View } from 'react-native';
import * as Application from 'expo-application';
import { API_BASE_URL } from './api';
import { colors, text, space } from './lakelore-rn/theme';
import { cmpVersions } from './version';

const STORE_URL =
  Platform.OS === 'android'
    ? 'https://play.google.com/store/apps/details?id=com.lakeloreapp.lakelore'
    : 'https://apps.apple.com/app/id6767341863';

const CURRENT_VERSION = Application.nativeApplicationVersion ?? '0.0.0';


interface ClientConfig {
  minVersion: string | null;
  killedVersions: string[];
  message: string | null;
}

type Verdict = { kind: 'ok' } | { kind: 'nudge' | 'killed'; message: string | null };

async function checkClientConfig(): Promise<Verdict> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    let res;
    try {
      res = await fetch(`${API_BASE_URL}/api/client-config`, { signal: controller.signal });
    } finally { clearTimeout(timer); }
    if (!res.ok) return { kind: 'ok' };
    const cfg: ClientConfig = await res.json();
    // Kill entries match either "1.1.1" (whole version) or "1.1.1+24"
    // (one specific build — lets a bad build 25 die while the in-review
    // build 26 on the same version survives; store red-team #15).
    const buildTag = `${CURRENT_VERSION}+${Application.nativeBuildVersion ?? '0'}`;
    if (Array.isArray(cfg.killedVersions)
        && (cfg.killedVersions.includes(CURRENT_VERSION) || cfg.killedVersions.includes(buildTag))) {
      return { kind: 'killed', message: cfg.message ?? null };
    }
    if (cfg.minVersion && cmpVersions(CURRENT_VERSION, cfg.minVersion) < 0) {
      return { kind: 'nudge', message: cfg.message ?? null };
    }
    return { kind: 'ok' };
  } catch {
    return { kind: 'ok' };
  }
}

export function UpdateGate() {
  const [verdict, setVerdict] = useState<Verdict>({ kind: 'ok' });
  const [dismissed, setDismissed] = useState(false);
  const checking = useRef(false);

  useEffect(() => {
    const run = () => {
      if (checking.current) return;
      checking.current = true;
      checkClientConfig()
        .then(setVerdict)
        .finally(() => { checking.current = false; });
    };
    run();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') run(); });
    return () => sub.remove();
  }, []);

  if (verdict.kind === 'ok') return null;

  const defaultCopy =
    verdict.kind === 'killed'
      ? 'This version of LakeLore has a problem we fixed in an update. Please update to keep fishing.'
      : 'A newer version of LakeLore is available, with fixes and fresher data.';
  const body = verdict.message ?? defaultCopy;

  if (verdict.kind === 'killed') {
    // Native Modal, not an in-tree overlay (bug-hunt #4): RN Modals present in
    // their own native window, so an absolute View could be covered by any of
    // the app's nine open Modals (paywall, pickers...) until the user closed
    // them — defeating "blocking".
    return (
      <Modal visible animationType="fade" onRequestClose={() => { /* blocking */ }}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center',
          padding: space.xl,
        }}
        accessibilityViewIsModal
      >
        <Text style={[text.displayM, { color: colors.ink, textAlign: 'center' }]}>Update required</Text>
        <Text style={[text.bodyM, { color: colors.ink2, textAlign: 'center', marginTop: space.md, maxWidth: 320 }]}>
          {body}
        </Text>
        <Pressable
          onPress={() => Linking.openURL(STORE_URL)}
          accessibilityRole="button"
          accessibilityLabel="Open the app store to update"
          style={{
            marginTop: space.xl, backgroundColor: colors.ink, borderRadius: 2,
            paddingVertical: 14, paddingHorizontal: 36,
          }}
        >
          <Text style={[text.labelM, { color: colors.paper }]}>UPDATE NOW</Text>
        </Pressable>
      </View>
      </Modal>
    );
  }

  // Soft nudge — dismissible once per app session.
  return (
    <Modal visible={!dismissed} transparent animationType="fade" onRequestClose={() => setDismissed(true)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(26,31,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: space.lg }}>
        <View style={{ backgroundColor: colors.paper, borderRadius: 2, padding: space.xl, maxWidth: 360, width: '100%' }}>
          <Text style={[text.displayM, { color: colors.ink }]}>Update available</Text>
          <Text style={[text.bodyM, { color: colors.ink2, marginTop: space.sm }]}>{body}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: space.lg }}>
            <Pressable onPress={() => setDismissed(true)} accessibilityRole="button" accessibilityLabel="Dismiss update prompt" style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
              <Text style={[text.labelM, { color: colors.ink2 }]}>LATER</Text>
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL(STORE_URL)}
              accessibilityRole="button"
              accessibilityLabel="Open the app store to update"
              style={{ backgroundColor: colors.ink, borderRadius: 2, paddingVertical: 10, paddingHorizontal: 20 }}
            >
              <Text style={[text.labelM, { color: colors.paper }]}>UPDATE</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
