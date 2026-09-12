import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import { YoungSerif_400Regular } from '@expo-google-fonts/young-serif';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import {
  Newsreader_400Regular,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  Newsreader_700Bold,
} from '@expo-google-fonts/newsreader';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { StateProvider, useAppState } from './src/StateContext';
import { initIAP } from './src/iap';
import { getUserId } from './src/userId';
import { migrateStorage } from './src/storage';
import { ToastProvider } from './src/Toast';
import { ErrorBoundary } from './src/ErrorBoundary';
import { OfflineBanner } from './src/OfflineBanner';
import { UpdateGate } from './src/UpdateGate';
import { Sentry } from './src/sentry';
import StateSelectScreen from './src/screens/StateSelectScreen';
import SearchScreen from './src/screens/SearchScreen';
import LakeDetailScreen from './src/screens/LakeDetailScreen';
import AskScreen from './src/screens/AskScreen';
import HomeScreen from './src/screens/HomeScreen';
import { ASK_FEATURE_ENABLED } from './src/askFeature';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './src/navigation';
import { colors } from './src/lakelore-rn/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Render-null micro-boundary for UpdateGate (round-2 review, 2026-08-25).
// The gate sits OUTSIDE the main ErrorBoundary so the kill switch survives an
// app crash — but that also puts any bug in the gate itself at the app root,
// where an uncaught render throw would take down a HEALTHY app. The gate is
// failure-soft by design (any config hiccup means 'ok'), so its render
// failure mode is the same: disappear quietly, report to Sentry.
class UpdateGateBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    try { Sentry.captureException(error); } catch { /* best-effort */ }
  }
  render() { return this.state.failed ? null : this.props.children; }
}

const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.paper,
    card: colors.ink,
    text: colors.paper,
    border: colors.ink,
    primary: colors.walleye,
  },
};

// StateSelect as a stack route (2026-09-12): it used to be a gate rendered
// OUTSIDE the navigator on first run. Now the launch chooser (Home) and the
// chat's "Rankings" button both need to reach it from inside the stack, so it
// is a screen; picking a state replaces it with Search (which auto-opens the
// county picker on the fresh pick, as before).
function StateSelectRoute() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return <StateSelectScreen onSelect={() => navigation.replace('Search')} />;
}

function AppInner() {
  const { hadPersistedState } = useAppState();

  // Wait for the persisted-state load so returning users skip the map and
  // land directly in their last state (counties restore silently too).
  if (hadPersistedState === null) {
    return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
  }
  // Launch chooser when the Ask feature is on (owner request 2026-09-12:
  // "recommendations" vs "review the rankings myself" on every open);
  // otherwise the pre-existing behavior — map on first run, last state after.
  const initialRoute: keyof RootStackParamList = ASK_FEATURE_ENABLED
    ? 'Home'
    : hadPersistedState ? 'Search' : 'StateSelect';

  return (
    <NavigationContainer theme={NavTheme}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="StateSelect" component={StateSelectRoute} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="LakeDetail" component={LakeDetailScreen} />
        <Stack.Screen name="Ask" component={AskScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function App() {
  const [fontsLoaded] = useFonts({
    YoungSerif_400Regular,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Newsreader_400Regular,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Newsreader_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    // Resolve the persistent anonymous UUID first so RevenueCat and the
    // API client agree on identity. No-ops if RevenueCat keys aren't
    // configured yet — the app launches cleanly during development
    // before paywall setup is complete.
    (async () => {
      const userId = await getUserId();
      await initIAP(userId);
    })();
    // Storage hygiene (T3.14): stamp the schema version + reclaim retired
    // keys. Fire-and-forget — must never delay or block boot.
    migrateStorage();
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StateProvider>
            <ToastProvider>
              <AppInner />
              <OfflineBanner />
            </ToastProvider>
          </StateProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
      {/* UpdateGate sits OUTSIDE ErrorBoundary (2026-08-25): a JS crash swaps
          the boundary's subtree for the crash screen, and the kill switch must
          survive exactly that scenario — a broken build is when we most need
          to reach the fleet. It renders native Modals (order-safe as a
          sibling) and depends on no context provider inside the boundary. Its
          own micro-boundary renders null on a gate bug so the trade never
          runs the other way (round-2 #1). */}
      <UpdateGateBoundary>
        <UpdateGate />
      </UpdateGateBoundary>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
