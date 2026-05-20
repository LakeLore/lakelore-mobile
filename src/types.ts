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
      { value: 'cpue', label: 'Catch / Net' },
      { value: 'length', label: 'Avg Length' },
      { value: 'catch', label: 'Total Catch' },
      { value: 'stocked', label: 'Stck Adults / 100AC' },
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
      { value: 'cpue', label: 'Catch / Net' },
      { value: 'length', label: 'Avg Length' },
      { value: 'stocked', label: 'Stck Adults / 100AC' },
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
      { value: 'cpue',    label: 'Catch / Net' },
      { value: 'length',  label: 'Avg Length' },
      { value: 'catch',   label: 'Total Catch' },
      { value: 'stocked', label: 'Stck Adults / 100AC' },
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
      { value: 'stocked', label: 'Stck Adults / 100AC' },
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
      { value: 'cpue',    label: 'Catch / Net' },
      { value: 'length',  label: 'Avg Length' },
      { value: 'catch',   label: 'Total Catch' },
      { value: 'stocked', label: 'Stck Adults / 100AC' },
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
      { value: 'cpue', label: 'Catch / Net' },
      { value: 'weight', label: 'Avg Weight' },
      { value: 'catch', label: 'Total Catch' },
      { value: 'stocked', label: 'Stck Adults / 100AC' },
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
      { value: 'cpue',    label: 'Catch / Net' },
      { value: 'length',  label: 'Avg Length' },
      { value: 'catch',   label: 'Total Catch' },
      { value: 'stocked', label: 'Stck Adults / 100AC' },
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
  minLength: string;
  maxLength: string;
  minCatch: string;
  maxCatch: string;
  mostRecentOnly: boolean;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  // MN-specific
  surveyTypes: string[];
  minWeight: string;
  maxWeight: string;
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
    minLength: '',
    maxLength: '',
    minCatch: '',
    maxCatch: '',
    mostRecentOnly: true,
    sortBy: cfg.sortOptions[0]?.value ?? 'cpue',
    sortDir: 'desc',
    surveyTypes: cfg.defaultSurveyTypes,
    minWeight: '',
    maxWeight: '',
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
  ef_stations?: number | null;
  hn_stations?: number | null;
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
  // Game fish
  WAE: 'Walleye', NOP: 'Northern Pike', LMB: 'Largemouth Bass', SMB: 'Smallmouth Bass',
  MUE: 'Muskellunge', TME: 'Tiger Muskellunge', YEP: 'Yellow Perch',
  BLC: 'Black Crappie', WHC: 'White Crappie', BLG: 'Bluegill', PMK: 'Pumpkinseed',
  RKB: 'Rock Bass', WHB: 'White Bass',
  // Sunfish
  GSF: 'Green Sunfish', OSS: 'Orangespotted Sunfish', HSF: 'Hybrid Sunfish',
  SUN: 'Sunfish',
  // Coldwater
  TLC: 'Tullibee (Cisco)', LKW: 'Lake Whitefish', BUR: 'Burbot',
  LAK: 'Lake Trout', BNT: 'Brown Trout', RBT: 'Rainbow Trout',
  BKT: 'Brook Trout', SPT: 'Splake',
  // Sturgeon / paddlefish / gar
  LKS: 'Lake Sturgeon', BOF: 'Bowfin',
  // Perch family
  SAR: 'Sauger', SAU: 'Saugeye',
  // Catfish / bullheads
  CCF: 'Channel Catfish', BLB: 'Black Bullhead', YEB: 'Yellow Bullhead',
  BRB: 'Brown Bullhead', TPM: 'Tadpole Madtom',
  // Buffalo / sucker family
  BIB: 'Bigmouth Buffalo', BUB: 'Black Buffalo',
  WTS: 'White Sucker', SHR: 'Shorthead Redhorse', GLR: 'Golden Redhorse',
  SLR: 'Silver Redhorse', GRR: 'Greater Redhorse', RHS: 'River Redhorse',
  QBS: 'Quillback',
  // Other
  FRD: 'Freshwater Drum', CAP: 'Common Carp',
  // Minnows / shiners / darters
  CSH: 'Common Shiner', EMS: 'Emerald Shiner', GOS: 'Golden Shiner',
  SFS: 'Spotfin Shiner', MMS: 'Mimic Shiner', SPO: 'Spottail Shiner',
  BNM: 'Bluntnose Minnow', FHM: 'Fathead Minnow', CRC: 'Creek Chub',
  CNM: 'Central Mudminnow',
  JND: 'Johnny Darter', IOD: 'Iowa Darter', LGP: 'Logperch',
  LED: 'Least Darter', BST: 'Brook Stickleback', BKS: 'Brook Silverside',
  BKF: 'Banded Killifish', MTS: 'Mottled Sculpin', TRP: 'Trout-Perch',
  PGS: 'Pugnose Shiner', NRD: 'Northern Redbelly Dace', FND: 'Finescale Dace',
  PRD: 'Pearl Dace', BRM: 'Brassy Minnow',
  // Other generics + less common
  CRP: 'Crappie', CIS: 'Cisco', GIS: 'Gizzard Shad',
  RBS: 'Rainbow Smelt', LNG: 'Longnose Gar', SNG: 'Shortnose Gar',
  SAB: 'Smallmouth Buffalo',
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

// ND species codes — these come from the GF&P ArcGIS Species field. NOT the
// same as MN/SD codes for several common species (e.g. Common Carp is CAR in
// ND but CAP in MN; White Sucker is WHS in ND but WTS in MN; Bigmouth Buffalo
// is BIB in ND but BUF in MN). Built directly from `fish_catch.species` ↔
// `species_name` in the ND DB.
export const ND_SPECIES_NAMES: Record<string, string> = {
  WAE: 'Walleye', NOP: 'Northern Pike', LMB: 'Largemouth Bass', SMB: 'Smallmouth Bass',
  MUE: 'Muskellunge', MUH: 'Tiger Muskellunge', YEP: 'Yellow Perch',
  BLC: 'Black Crappie', WHC: 'White Crappie', CRP: 'Crappie Species',
  BLG: 'Bluegill', PSD: 'Pumpkinseed', GSF: 'Green Sunfish',
  HSF: 'Hybrid Sunfish', OSS: 'Orangespotted Sunfish',
  WHB: 'White Bass', WXS: 'Saugeye', SAR: 'Sauger',
  BKT: 'Brook Trout', BNT: 'Brown Trout', RBT: 'Rainbow Trout',
  CUT: 'Cutthroat Trout', TGT: 'Tiger Trout', FCS: 'Chinook Salmon',
  LWF: 'Lake Whitefish', CIS: 'Cisco', BUR: 'Burbot (Ling)',
  CCF: 'Channel Catfish', FCF: 'Flathead Catfish', ZAN: 'Zander',
  BLB: 'Black Bullhead', BRB: 'Brown Bullhead', BHS: 'Bullhead Species',
  FWD: 'Freshwater Drum', GIS: 'Gizzard Shad', GOE: 'Goldeye',
  CAR: 'Common Carp', SLC: 'Silver Carp',
  WHS: 'White Sucker', LNS: 'Longnose Sucker', BLS: 'Blue Sucker',
  RCS: 'River Carpsucker', SHR: 'Shorthead Redhorse', QUK: 'Quillback',
  BIB: 'Bigmouth Buffalo', SAB: 'Smallmouth Buffalo', BFS: 'Buffalo Species',
  PAH: 'Paddlefish', PLS: 'Pallid Sturgeon', SNS: 'Shovelnose Sturgeon',
  SNG: 'Shortnose Gar', RBS: 'Rainbow Smelt',
  CMS: 'Common Shiner', ESH: 'Emerald Shiner', GOS: 'Golden Shiner',
  SPS: 'Spottail Shiner', BMS: 'Bigmouth Shiner', RDS: 'Red Shiner',
  SDS: 'Sand Shiner', FHM: 'Fathead Minnow', CRC: 'Creek Chub',
  IOD: 'Iowa Darter', JND: 'Johnny Darter', BSD: 'Blackside Darter',
  BRS: 'Brook Stickleback', SNC: 'Stonecat', TPM: 'Tadpole Madtom',
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
