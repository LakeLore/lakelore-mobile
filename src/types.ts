export type StateKey = 'sd' | 'mn' | 'nd' | 'ia' | 'ne' | 'wi' | 'mi';

export interface StateConfig {
  key: StateKey;
  label: string;
  agency: string;
  color: string;
  defaultGear: string;
  defaultSurveyTypes: string[];
  sortOptions: { value: string; label: string }[];
}

export const STATE_CONFIGS: Record<StateKey, StateConfig> = {
  nd: {
    key: 'nd',
    label: 'North Dakota',
    agency: 'ND Game, Fish & Parks',
    color: '#7c2d12',
    defaultGear: '',
    defaultSurveyTypes: [],
    sortOptions: [
      { value: 'cpue', label: 'CPUE' },
      { value: 'length', label: 'Avg Length' },
      { value: 'year', label: 'Survey Year' },
      { value: 'lake', label: 'Lake Name' },
      { value: 'acres', label: 'Lake Size' },
    ],
  },
  sd: {
    key: 'sd',
    label: 'South Dakota',
    agency: 'SD Game, Fish & Parks',
    color: '#1e3a5f',
    defaultGear: '',
    defaultSurveyTypes: [],
    sortOptions: [
      { value: 'cpue', label: 'CPUE' },
      { value: 'length', label: 'Avg Length' },
      { value: 'psd', label: 'PSD' },
      { value: 'psd_p', label: 'PSD-P' },
      { value: 'wr', label: 'Relative Weight (Wr)' },
      { value: 'stocked', label: 'Stocked / 100ac' },
      { value: 'year', label: 'Survey Year' },
      { value: 'lake', label: 'Lake Name' },
      { value: 'acres', label: 'Lake Size' },
      { value: 'depth', label: 'Lake Depth' },
    ],
  },
  ia: {
    key: 'ia',
    label: 'Iowa',
    agency: 'Iowa DNR',
    color: '#1b5e20',
    defaultGear: '',
    defaultSurveyTypes: [],
    sortOptions: [
      { value: 'cpue',    label: 'CPUE' },
      { value: 'catch',   label: 'Total Catch' },
      { value: 'length',  label: 'Avg Length' },
      { value: 'stocked', label: 'Stocked / 100ac' },
      { value: 'date',    label: 'Survey Date' },
      { value: 'lake',    label: 'Lake Name' },
      { value: 'acres',   label: 'Lake Size' },
    ],
  },
  ne: {
    key: 'ne',
    label: 'Nebraska',
    agency: 'Nebraska Game & Parks',
    color: '#b91c1c',
    defaultGear: '',
    defaultSurveyTypes: [],
    sortOptions: [
      { value: 'cpue', label: 'Catch / Net' },
      { value: 'length', label: 'Avg Length' },
      { value: 'stocked', label: 'Stocked / 100ac' },
      { value: 'year', label: 'Survey Year' },
      { value: 'lake', label: 'Lake Name' },
      { value: 'acres', label: 'Lake Size' },
    ],
  },
  wi: {
    key: 'wi',
    label: 'Wisconsin',
    agency: 'WI DNR',
    color: '#155e75',
    defaultGear: '',
    defaultSurveyTypes: [],
    sortOptions: [
      { value: 'cpue',    label: 'CPUE' },
      { value: 'length',  label: 'Avg Length' },
      { value: 'stocked', label: 'Stocked / 100ac' },
      { value: 'year',    label: 'Survey Year' },
      { value: 'lake',    label: 'Lake Name' },
      { value: 'acres',   label: 'Lake Size' },
    ],
  },
  mn: {
    key: 'mn',
    label: 'Minnesota',
    agency: 'MN DNR',
    color: '#14532d',
    defaultGear: '',
    defaultSurveyTypes: ['Standard Survey'],
    sortOptions: [
      { value: 'cpue', label: 'CPUE' },
      { value: 'weight', label: 'Avg Weight' },
      { value: 'catch', label: 'Total Catch' },
      { value: 'stocked', label: 'Stocked / 100ac' },
      { value: 'date', label: 'Survey Date' },
      { value: 'lake', label: 'Lake Name' },
      { value: 'acres', label: 'Lake Size' },
      { value: 'depth', label: 'Lake Depth' },
    ],
  },
  mi: {
    key: 'mi',
    label: 'Michigan',
    agency: 'MI DNR',
    color: '#1e40af',
    defaultGear: '',
    defaultSurveyTypes: [],
    sortOptions: [
      { value: 'cpue',    label: 'CPUE' },
      { value: 'length',  label: 'Avg Length' },
      { value: 'catch',   label: 'Total Catch' },
      { value: 'stocked', label: 'Stocked / 100ac' },
      { value: 'year',    label: 'Survey Year' },
      { value: 'lake',    label: 'Lake Name' },
      { value: 'acres',   label: 'Lake Size' },
      { value: 'depth',   label: 'Lake Depth' },
    ],
  },
};

export interface FilterState {
  species: string;
  lakeName: string;
  gearTypes: string[];
  minCpue: string;
  maxCpue: string;
  minYear: string;
  maxYear: string;
  counties: string[];
  minAcres: string;
  maxAcres: string;
  minStocked: string;
  maxStocked: string;
  mostRecentOnly: boolean;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  // MN-specific
  surveyTypes: string[];
  cpueVsNormal: 'any' | 'above' | 'below' | 'within';
  minWeight: string;
  maxWeight: string;
  minCatch: string;
  maxCatch: string;
  minGearCount: string;
  maxGearCount: string;
}

export function defaultFilters(state: StateKey): FilterState {
  const cfg = STATE_CONFIGS[state];
  return {
    species: '',
    lakeName: '',
    gearTypes: cfg.defaultGear ? [cfg.defaultGear] : [],
    minCpue: '',
    maxCpue: '',
    minYear: '',
    maxYear: '',
    counties: [],
    minAcres: '',
    maxAcres: '',
    minStocked: '',
    maxStocked: '',
    mostRecentOnly: true,
    sortBy: cfg.sortOptions[0]?.value ?? 'cpue',
    sortDir: 'desc',
    surveyTypes: cfg.defaultSurveyTypes,
    cpueVsNormal: 'any',
    minWeight: '',
    maxWeight: '',
    minCatch: '',
    maxCatch: '',
    minGearCount: '',
    maxGearCount: '',
  };
}

export interface SpeciesOption {
  species: string;
  lake_count: number;
}

export interface FilterOptions {
  species: SpeciesOption[];
  gearTypes: string[];
  gearTypeCounts?: Record<string, number>;
  counties: string[];
  surveyTypes?: string[];
  yearRange: { min: number; max: number };
  defaultGear?: string;
}

export interface Result {
  lake_id: number | string;
  lake_name: string;
  county: string;
  area_acres: number | null;
  survey_id: number | string;
  survey_year: number;
  species: string;
  gear: string | null;
  stocked_per_100ac: number | null;
  // SD fields
  sample_n?: number | null;
  cpue?: number | null;
  psd?: number | null;
  psd_p?: number | null;
  wr?: number | null;
  wr_sq?: number | null;
  wr_qp?: number | null;
  wr_pm?: number | null;
  wr_m?: number | null;
  n_sq?: number | null;
  n_qp?: number | null;
  n_pm?: number | null;
  n_m?: number | null;
  report_id?: number | null;
  max_depth_feet?: number | null;
  // MN fields
  survey_date?: string | null;
  survey_type?: string | null;
  gear_count?: number | null;
  total_catch?: number | null;
  average_weight?: number | null;
  // ND fields
  average_length?: number | null;
  species_name?: string | null;
  // IA fields
  n_measured?: number | null;
  min_length?: number | null;
  max_length?: number | null;
  ef_cpue?: number | null;
  ef_stations?: number | null;
  hn_cpue?: number | null;
  hn_stations?: number | null;
  fn_cpue?: number | null;
  fn_stations?: number | null;
}

export interface ResultsResponse {
  total: number;
  results: Result[];
}

export const SD_SPECIES_NAMES: Record<string, string> = {
  WAE: 'Walleye', NOP: 'Northern Pike', LMB: 'Largemouth Bass', SMB: 'Smallmouth Bass',
  MUE: 'Muskellunge', YEP: 'Yellow Perch', BLC: 'Black Crappie', WHC: 'White Crappie',
  BLG: 'Bluegill', RKB: 'Rock Bass', WTS: 'White Sucker', PMK: 'Pumpkinseed',
  CAP: 'Common Carp', BLB: 'Black Bullhead', YEB: 'Yellow Bullhead', BRB: 'Brown Bullhead',
  FRD: 'Freshwater Drum', CCF: 'Channel Catfish', SAU: 'Saugeye', SAR: 'Sauger',
  BKT: 'Brook Trout', RBT: 'Rainbow Trout', BNT: 'Brown Trout', WHB: 'White Bass',
  STH: 'Striped Bass Hybrid (Wiper)', GSH: 'Gizzard Shad', GOS: 'Green Sunfish',
};

export const MN_SPECIES_NAMES: Record<string, string> = {
  WAE: 'Walleye', NOP: 'Northern Pike', LMB: 'Largemouth Bass', SMB: 'Smallmouth Bass',
  MUE: 'Muskellunge', TME: 'Tiger Muskellunge', YEP: 'Yellow Perch', BLC: 'Black Crappie',
  WHC: 'White Crappie', BLG: 'Bluegill', PMK: 'Pumpkinseed', RKB: 'Rock Bass',
  WHB: 'White Bass', TLC: 'Tullibee (Cisco)', BUR: 'Burbot', FRD: 'Freshwater Drum',
  CAP: 'Common Carp', CCF: 'Channel Catfish', BLB: 'Black Bullhead', YEB: 'Yellow Bullhead',
  BRB: 'Brown Bullhead', LAK: 'Lake Trout', BNT: 'Brown Trout', RBT: 'Rainbow Trout',
  BKT: 'Brook Trout', LKS: 'Lake Sturgeon', SAR: 'Sauger', SAU: 'Saugeye',
  WTS: 'White Sucker', SHR: 'Shorthead Redhorse',
};

export const WI_SPECIES_NAMES: Record<string, string> = {
  WAE: 'Walleye', NOP: 'Northern Pike', LMB: 'Largemouth Bass', SMB: 'Smallmouth Bass',
  MUE: 'Muskellunge', TGM: 'Tiger Muskie', YEP: 'Yellow Perch', BLC: 'Black Crappie',
  WHC: 'White Crappie', BLG: 'Bluegill', PMK: 'Pumpkinseed', RKB: 'Rock Bass',
  WHB: 'White Bass', CAP: 'Common Carp', CCF: 'Channel Catfish',
  BLB: 'Black Bullhead', YEB: 'Yellow Bullhead', BRB: 'Brown Bullhead',
  FRD: 'Freshwater Drum', RBT: 'Rainbow Trout', BNT: 'Brown Trout', BKT: 'Brook Trout',
  LAK: 'Lake Trout', LKS: 'Lake Sturgeon', SAR: 'Sauger', WTS: 'White Sucker',
  CIS: 'Cisco (Tullibee)', BUR: 'Burbot', GSH: 'Gizzard Shad', SAU: 'Saugeye',
  STH: 'Striped Bass Hybrid (Wiper)',
};

// ND uses species codes matching the ArcGIS Species field (same codes as MN/SD for common species)
export const ND_SPECIES_NAMES: Record<string, string> = {
  WAE: 'Walleye', NOP: 'Northern Pike', LMB: 'Largemouth Bass', SMB: 'Smallmouth Bass',
  MUE: 'Muskellunge', YEP: 'Yellow Perch', BLC: 'Black Crappie', WHC: 'White Crappie',
  BLG: 'Bluegill', RKB: 'Rock Bass', WHB: 'White Bass', FRD: 'Freshwater Drum',
  CAP: 'Common Carp', BLB: 'Black Bullhead', YEB: 'Yellow Bullhead', BRB: 'Brown Bullhead',
  CCF: 'Channel Catfish', SAU: 'Saugeye', SAR: 'Sauger', BKT: 'Brook Trout',
  RBT: 'Rainbow Trout', BNT: 'Brown Trout', PMK: 'Pumpkinseed', WTS: 'White Sucker',
  GSH: 'Gizzard Shad', BUF: 'Bigmouth Buffalo', GOS: 'Green Sunfish',
};

// SD stores species as full names in DB; reverse map for PSD lookups
// WI DNR survey gear codes — human-readable labels for the gear filter UI
export const WI_GEAR_LABELS: Record<string, string> = {
  SE1: 'Spring EF (SE1)',
  SE2: 'Spring EF (SE2)',
  SN1: 'Fyke Net (SN1)',
  SN2: 'Fyke Net (SN2)',
  SN3: 'Mini-Fyke (SN3)',
  FE:  'Fall EF (FE)',
  GN:  'Gill Net',
  TL:  'Tow Line (TL)',
};

export const SD_SPECIES_FROM_NAME: Record<string, string> = {
  'Walleye':'WAE','Northern Pike':'NOP','Largemouth Bass':'LMB','Smallmouth Bass':'SMB',
  'Muskellunge':'MUE','Yellow Perch':'YEP','Black Crappie':'BLC','White Crappie':'WHC',
  'Bluegill':'BLG','Rock Bass':'RKB','White Sucker':'WTS','Pumpkinseed':'PMK',
  'Common Carp':'CAP','Black Bullhead':'BLB','Yellow Bullhead':'YEB','Brown Bullhead':'BRB',
  'Freshwater Drum':'FRD','Channel Catfish':'CCF','Saugeye':'SAU','Sauger':'SAR',
  'Brook Trout':'BKT','Rainbow Trout':'RBT','Brown Trout':'BNT','White Bass':'WHB',
  'Striped Bass Hybrid (Wiper)':'STH','Gizzard Shad':'GSH','Green Sunfish':'GOS',
};

export function speciesDisplayName(speciesOrCode: string, state: StateKey): string {
  if (state === 'mn') return MN_SPECIES_NAMES[speciesOrCode] ?? speciesOrCode;
  if (state === 'nd') return ND_SPECIES_NAMES[speciesOrCode] ?? speciesOrCode;
  if (state === 'wi') return WI_SPECIES_NAMES[speciesOrCode] ?? speciesOrCode;
  if (state === 'ia' || state === 'ne' || state === 'mi') return speciesOrCode; // full English names stored directly
  // SD: input may be full name or code
  const asCode = SD_SPECIES_FROM_NAME[speciesOrCode] ?? speciesOrCode;
  return SD_SPECIES_NAMES[asCode] ?? speciesOrCode;
}
