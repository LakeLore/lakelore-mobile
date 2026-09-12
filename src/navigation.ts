import { StateKey } from './types';

export type RootStackParamList = {
  // Launch chooser (2026-09-12): "give me recommendations" → Ask, "I'll review
  // the rankings myself" → StateSelect/Search. Only the initial route when the
  // Ask feature is enabled (src/askFeature.ts); otherwise the app opens
  // straight into StateSelect (first run) or Search.
  Home: undefined;
  StateSelect: undefined;
  Search: undefined;
  Ask: undefined;
  LakeDetail: {
    lakeId: number | string;
    lakeName: string;
    species: string;
    state: StateKey;
  };
};
