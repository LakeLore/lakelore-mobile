// src/ErrorBoundary.tsx — top-level crash safety net.
//
// Anything that throws inside the React tree lands here, is reported to
// Sentry (via the imported Sentry singleton in src/sentry.ts), and the
// user gets a brand-styled recovery screen instead of a white void.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sentry } from './sentry';
import { colors, text, space, hairline } from './lakelore-rn/theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    try {
      Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    } catch {
      // Sentry failing to report is not itself a reason to re-throw.
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.box}>
          <Text style={[text.labelL, { color: colors.walleye2 }]}>LAKELORE · UNEXPECTED ERROR</Text>
          <Text style={[text.displayL, { color: colors.ink, marginTop: 10 }]}>
            Something tipped the canoe.
          </Text>
          <Text style={[text.bodyM, { color: colors.ink2, marginTop: 12 }]}>
            The app hit a problem it couldn&rsquo;t recover from on its own. The
            error has been reported. Try again — if it keeps happening, restart
            the app or email{' '}
            <Text style={{ color: colors.ink }}>support@lakeloreapp.com</Text>.
          </Text>
          <Pressable
            onPress={this.reset}
            style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.85 : 1 }]}>
            <Text style={[text.labelL, { color: colors.paper }]}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  box: {
    flex: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.xxxl,
  },
  cta: {
    marginTop: space.xxl,
    alignSelf: 'flex-start',
    backgroundColor: colors.ink,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: hairline,
    borderColor: colors.ink,
  },
});
