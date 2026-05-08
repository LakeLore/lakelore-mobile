// src/Toast.tsx — lightweight toast surface.
//
// One ToastProvider near the top of the tree, used via useToast() from any
// screen below it. Brand-consistent (paper-and-ink rectangle, mono caption),
// fades in for 180 ms, holds for 2.5 s by default, fades out for 220 ms.
// Replaces the heavy Alert.alert flow for non-blocking validation messages.

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, Animated, StyleSheet, Pressable, SafeAreaView,
  Easing,
} from 'react-native';
import { colors, text, space, hairline } from './lakelore-rn/theme';

interface ToastContextValue {
  /** Show a toast. Default duration 2500 ms. */
  toast: (message: string, opts?: { duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0, duration: 220, useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(translateY, {
        toValue: 8, duration: 220, useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start(() => {
      if (mountedRef.current) setMessage(null);
    });
  }, [opacity, translateY]);

  const toast = useCallback((msg: string, opts?: { duration?: number }) => {
    const duration = opts?.duration ?? 2500;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setMessage(msg);
    opacity.setValue(0);
    translateY.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 180, useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(translateY, {
        toValue: 0, duration: 180, useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start();
    dismissTimer.current = setTimeout(dismiss, duration);
  }, [dismiss, opacity, translateY]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {message != null && (
        <SafeAreaView pointerEvents="box-none" style={styles.container}>
          <Animated.View
            style={[
              styles.toast,
              { opacity, transform: [{ translateY }] },
            ]}
            pointerEvents="auto"
          >
            <Pressable onPress={dismiss} style={styles.pressable}>
              <Text style={[text.bodyM, { color: colors.paper }]} numberOfLines={3}>
                {message}
              </Text>
            </Pressable>
          </Animated.View>
        </SafeAreaView>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    paddingBottom: space.xl,
  },
  toast: {
    backgroundColor: colors.ink,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    borderWidth: hairline,
    borderColor: colors.ink,
    maxWidth: 480,
    minWidth: 220,
    // Faint paper-edge so it stands out from underlying paper background.
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  pressable: {
    paddingVertical: 0,
  },
});
