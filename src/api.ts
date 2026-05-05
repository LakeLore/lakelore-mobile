import { FilterState, FilterOptions, ResultsResponse, StateKey } from './types';

// ── Server URL configuration ───────────────────────────────────────────────────
// Production: Fly.io unified server (lake-fish-api.fly.dev)
// Development: unified server running locally on port 3100
// Custom domain (e.g. api.lakelore.com) can be added in Fly.io dashboard
// and swapped in here without any server changes.

const DEV_API_BASE = 'http://192.168.1.8:3100';
const PROD_API_BASE = 'https://lake-fish-api.fly.dev';

export const API_BASE_URL: string = __DEV__ ? DEV_API_BASE : PROD_API_BASE;

function baseUrl(state: StateKey) {
  return `${API_BASE_URL}/api/${state}`;
}

// ── Fetch wrapper with timeout and user-friendly errors ───────────────────────

async function get<T>(url: string, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    return res.json() as Promise<T>;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out — check your connection');
    }
    if (err instanceof TypeError && err.message.includes('Network request failed')) {
      throw new Error('Could not reach server — check your network connection');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── API surface ───────────────────────────────────────────────────────────────

export interface DbStatus {
  ready: boolean;
  lakes?: number;
  surveys?: number;
  catches?: number;
  message?: string;
}

export async function fetchStatus(state: StateKey): Promise<DbStatus> {
  return get(`${baseUrl(state)}/status`);
}

export async function fetchFilters(state: StateKey): Promise<FilterOptions> {
  return get(`${baseUrl(state)}/filters`);
}

export async function fetchResults(
  state: StateKey,
  filters: FilterState,
  page: number,
  pageSize: number,
): Promise<ResultsResponse> {
  const params = buildParams(state, filters, page, pageSize);
  return get(`${baseUrl(state)}/results?${params}`);
}

export async function fetchAllResults(
  state: StateKey,
  filters: FilterState,
): Promise<ResultsResponse> {
  const params = buildParams(state, filters, 0, 9999);
  return get(`${baseUrl(state)}/results?${params}`, 30_000); // scatter plots may fetch many rows
}

export async function fetchLakeWithSpecies(
  lakeId: number | string,
  state: StateKey,
  species: string,
): Promise<unknown> {
  return get(`${baseUrl(state)}/lake/${lakeId}?species=${encodeURIComponent(species)}`);
}

// ── Query param builder ────────────────────────────────────────────────────────

function buildParams(
  state: StateKey,
  f: FilterState,
  page: number,
  pageSize: number,
): URLSearchParams {
  const params = new URLSearchParams({
    sortBy: f.sortBy,
    sortDir: f.sortDir,
    mostRecentOnly: String(f.mostRecentOnly),
    limit: String(pageSize),
    offset: String(page * pageSize),
  });

  if (f.species)          params.set('species', f.species);
  if (f.lakeName)         params.set('lakeName', f.lakeName);
  if (f.gearTypes.length) params.set('gear', f.gearTypes.join(','));
  if (f.minCpue)          params.set('minCpue', f.minCpue);
  if (f.maxCpue)          params.set('maxCpue', f.maxCpue);
  if (f.minYear)          params.set('minYear', f.minYear);
  if (f.maxYear)          params.set('maxYear', f.maxYear);
  if (f.counties.length)  params.set('county', f.counties.join(','));
  if (f.minAcres)         params.set('minAcres', f.minAcres);
  if (f.maxAcres)         params.set('maxAcres', f.maxAcres);
  if (f.minStocked)       params.set('minStocked', f.minStocked);
  if (f.maxStocked)       params.set('maxStocked', f.maxStocked);

  if (state === 'mn') {
    if (f.surveyTypes?.length) params.set('surveyType', f.surveyTypes.join(','));
    if (f.minWeight)           params.set('minWeight', f.minWeight);
    if (f.maxWeight)           params.set('maxWeight', f.maxWeight);
    if (f.minCatch)            params.set('minCatch', f.minCatch);
    if (f.maxCatch)            params.set('maxCatch', f.maxCatch);
    if (f.minGearCount)        params.set('minGearCount', f.minGearCount);
    if (f.maxGearCount)        params.set('maxGearCount', f.maxGearCount);
    if (f.cpueVsNormal && f.cpueVsNormal !== 'any')
      params.set('cpueVsNormal', f.cpueVsNormal);
  }

  return params;
}
