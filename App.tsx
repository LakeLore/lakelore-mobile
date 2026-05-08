import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
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
import { ToastProvider } from './src/Toast';
import StateSelectScreen from './src/screens/StateSelectScreen';
import SearchScreen from './src/screens/SearchScreen';
import LakeDetailScreen from './src/screens/LakeDetailScreen';
import type { RootStackParamList } from './src/navigation';
import { colors } from './src/lakelore-rn/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

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

function AppInner() {
  const [stateSelected, setStateSelected] = useState(false);

  if (!stateSelected) {
    return <StateSelectScreen onSelect={() => setStateSelected(true)} />;
  }

  return (
    <NavigationContainer theme={NavTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="LakeDetail" component={LakeDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
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
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StateProvider>
        <ToastProvider>
          <AppInner />
        </ToastProvider>
      </StateProvider>
    </GestureHandlerRootView>
  );
}
