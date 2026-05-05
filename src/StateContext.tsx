import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StateKey, StateConfig, STATE_CONFIGS } from './types';

interface StateContextValue {
  state: StateKey;
  stateConfig: StateConfig;
  setState: (s: StateKey) => void;
}

const StateContext = createContext<StateContextValue | null>(null);

export function StateProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateKey] = useState<StateKey>('sd');

  useEffect(() => {
    AsyncStorage.getItem('selectedState').then(saved => {
      if (saved === 'sd' || saved === 'mn' || saved === 'nd' || saved === 'ia' || saved === 'ne' || saved === 'wi') setStateKey(saved as StateKey);
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
