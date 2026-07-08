// src/OfflineBanner.tsx — passive "Offline" strip that appears beneath the
// status bar when the device has no usable internet connection.
//
// Anchored absolute at the top, pointerEvents="none" so it never blocks
// the underlying UI. Brand-styled (ink stripe, mono small-caps), no icon.

import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { colors, text, space, hairline } from './lakelore-rn/theme';

function isOnline(state: NetInfoState): boolean {
  // `isInternetReachable` is null on first read; trust `isConnected` until
  // the OS has confirmed reachability so we don't flash the banner at boot.
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setOffline(!isOnline(s)));
    NetInfo.fetch().then(s => setOffline(!isOnline(s)));
    return unsub;
  }, []);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: offline ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [offline, opacity]);

  if (!offline) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.bar, { opacity, paddingTop: insets.top + 8 }]}
    >
      <View style={styles.dot} />
      <Text style={[text.labelM, { color: colors.paper }]}>OFFLINE — RECONNECT TO LOAD MORE</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: colors.ink,
    paddingHorizontal: space.lg,
    // paddingTop applied inline using insets.top so the banner clears the
    // status bar / Dynamic Island on iPhone and the transparent status bar
    // on Android edge-to-edge builds.
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: hairline,
    borderBottomColor: colors.walleye,
    zIndex: 999,
    elevation: 999,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.walleye,
  },
});
