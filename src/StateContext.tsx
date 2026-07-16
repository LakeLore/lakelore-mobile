import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StateKey, StateConfig, STATE_CONFIGS } from './types';
import { isActiveState } from './activeStates';

interface StateContextValue {
  state: StateKey;
  stateConfig: StateConfig;
  setState: (s: StateKey) => void;
  /** null while AsyncStorage is loading; then whether a persisted state was
   *  restored. App.tsx skips the state-select screen on restored launches
   *  (2026-07-15 feedback: open to the last selected state, like counties). */
  hadPersistedState: boolean | null;
  /** Set by every EXPLICIT setState (state map / in-search switcher) and
   *  consumed by SearchScreen to auto-open the county picker. Restored
   *  launches never set it, so cold launches land straight on results. */
  pendingCountyPick: boolean;
  consumeCountyPick: () => void;
}

const StateContext = createContext<StateContextValue | null>(null);

export function StateProvider({ children }: { children: React.ReactNode }) {
  // Default to MN (the free tier). Anything else risks a 402 on first render
  // if a code path ever bypasses StateSelectScreen before AsyncStorage resolves.
  const [state, setStateKey] = useState<StateKey>('mn');
  const [hadPersistedState, setHadPersistedState] = useState<boolean | null>(null);
  const [pendingCountyPick, setPendingCountyPick] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('selectedState')
      .then(saved => {
        if (saved && isActiveState(saved as StateKey)) {
          setStateKey(saved as StateKey);
          setHadPersistedState(true);
        } else {
          setHadPersistedState(false);
        }
      })
      .catch(() => setHadPersistedState(false));
  }, []);

  const setState = useCallback((s: StateKey) => {
    AsyncStorage.setItem('selectedState', s);
    setStateKey(s);
    setPendingCountyPick(true);
  }, []);

  const consumeCountyPick = useCallback(() => setPendingCountyPick(false), []);

  return (
    <StateContext.Provider value={{
      state, stateConfig: STATE_CONFIGS[state], setState,
      hadPersistedState, pendingCountyPick, consumeCountyPick,
    }}>
      {children}
    </StateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error('useAppState must be used within StateProvider');
  return ctx;
}
