import { StateKey } from './types';

export type RootStackParamList = {
  Search: undefined;
  LakeDetail: {
    lakeId: number | string;
    lakeName: string;
    species: string;
    state: StateKey;
  };
};
