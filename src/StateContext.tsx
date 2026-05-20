import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StateKey, StateConfig, STATE_CONFIGS } from './types';
import { isActiveState } from './activeStates';

interface StateContextValue {
  state: StateKey;
  stateConfig: StateConfig;
  setState: (s: StateKey) => void;
}

const StateContext = createContext<StateContextValue | null>(null);

export function StateProvider({ children }: { children: React.ReactNode }) {
  // Default to MN (the free tier). Anything else risks a 402 on first render
  // if a code path ever bypasses StateSelectScreen before AsyncStorage resolves.
  const [state, setStateKey] = useState<StateKey>('mn');

  useEffect(() => {
    AsyncStorage.getItem('selectedState').then(saved => {
      if (saved && isActiveState(saved as StateKey)) setStateKey(saved as StateKey);
    });
  }, []);

  const setState = useCallback((s: StateKey) => {
    AsyncStorage.setItem('selectedState', s);
    setStateKey(s);
  }, []);

  return (
    <StateContext.Provider value={{ state, stateConfig: STATE_CONFIGS[state], setState }}>
      {children}
    </StateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error('useAppState must be used within StateProvider');
  return ctx;
}
