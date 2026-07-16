// generateCountyPaths.mjs — generate per-state county map data for the
// CountyMapPicker, for EVERY US state (2026-07 all-states launch).
//
//   node scripts/generateCountyPaths.mjs
//
// Source geometry: us-atlas counties-10m.json (unprojected lon/lat, census
// cartographic boundaries, `properties.name` carries the county name).
//
// Key contract: each emitted county key must EQUAL the `lakes.county` value
// in that state's canonical DB (lakelore-data/out/{st}.db) — the picker's
// selections go straight into the server's county filter. For every census
// shape we look up the matching DB value (normalized compare: case,
// punctuation, County/Parish/Borough suffixes, Saint/St.) and key by the DB
// string when found, falling back to the census name so the full map still
// draws.
//
// States NOT emitted (list-only picker fallback in CountyMapPicker):
//   ri — DB "county" values are TOWNS, not the 5 census counties
//   ak — DB values are ADF&G areas / REAAs, not census boroughs
//   mb/sk — region divisions with no readily-available boundary layer
//   bc/ab — no county/region vocabulary at all (picker skipped entirely)
//
// SPECIAL SOURCE — on (Ontario): county = Fisheries Management Zone; polygons
// come from the official LIO Open Data FMZ layer (20 zones), keyed "FMZ {id}"
// to match on.db lakes.county exactly.
import * as topojson from 'topojson-client';
import { geoMercator, geoPath, geoCentroid, geoArea } from 'd3-geo';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../src/data/countyPaths');
const CACHE = path.join(os.tmpdir(), 'us-atlas-counties-10m.json');

const FIPS = {
  al: '01', az: '04', ar: '05', ca: '06', co: '08', ct: '09', de: '10',
  fl: '12', ga: '13', hi: '15', id: '16', il: '17', in: '18', ia: '19',
  ks: '20', ky: '21', la: '22', me: '23', md: '24', ma: '25', mi: '26',
  mn: '27', ms: '28', mo: '29', mt: '30', ne: '31', nv: '32', nh: '33',
  nj: '34', nm: '35', ny: '36', nc: '37', nd: '38', oh: '39', ok: '40',
  or: '41', pa: '42', sc: '45', sd: '46', tn: '47', tx: '48', ut: '49',
  vt: '50', va: '51', wa: '53', wv: '54', wi: '55', wy: '56',
  // ri + ak intentionally absent — see header.
};

// Match a DB county string to a census name: lowercase, strip diacritics,
// drop jurisdiction-type suffixes, unify Saint/St, drop punctuation.
const norm = (s) => String(s).toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\b(county|parish|borough|census area|municipality|city and borough)\b/g, '')
  .replace(/\bsaint\b/g, 'st')
  .replace(/[.'’-]/g, ' ')
  .replace(/\s+/g, ' ').trim();

function dbCounties(st) {
  const db = path.join(os.homedir(), 'lakelore-data', 'out', `${st}.db`);
  if (!fs.existsSync(db)) return [];
  try {
    const out = execFileSync('sqlite3', [db, "SELECT DISTINCT county FROM lakes WHERE county IS NOT NULL AND county <> ''"], { encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

async function loadCounties() {
  if (fs.existsSync(CACHE)) return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  console.log('Fetching US counties TopoJSON…');
  const res = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json');
  const json = await res.json();
  fs.writeFileSync(CACHE, JSON.stringify(json));
  return json;
}

const us = await loadCounties();
const allCounties = topojson.feature(us, us.objects.counties);

function generateState(st, prefix) {
  const features = allCounties.features.filter(f =>
    String(f.id).padStart(5, '0').startsWith(prefix));
  const collection = { type: 'FeatureCollection', features };

  // Auto viewBox: fit into a 500-max square preserving the state's aspect.
  const PAD = 4, MAX = 500;
  const probe = geoMercator().fitSize([MAX, MAX], collection);
  const [[bx0, by0], [bx1, by1]] = geoPath().projection(probe).bounds(collection);
  const aspect = (by1 - by0) / (bx1 - bx0);
  const viewW = aspect > 1 ? Math.round(MAX / aspect) : MAX;
  const viewH = aspect > 1 ? MAX : Math.round(MAX * aspect);

  const projection = geoMercator().fitExtent(
    [[PAD, PAD], [viewW - PAD, viewH - PAD]], collection);
  const pathGen = geoPath().projection(projection);

  // census-name → preferred display/filter key (the DB's exact string).
  const dbVals = dbCounties(st);
  const dbByNorm = new Map();
  for (const v of dbVals) if (!dbByNorm.has(norm(v))) dbByNorm.set(norm(v), v);

  let matched = 0;
  const result = {};
  for (const f of features) {
    const censusName = f.properties?.name ?? String(f.id);
    const dbName = dbByNorm.get(norm(censusName));
    if (dbName) matched++;
    const key = dbName ?? censusName;
    if (result[key]) continue; // e.g. St. Louis city vs county normalizing together
    const d = pathGen(f);
    const centroid = projection(geoCentroid(f));
    result[key] = { d, cx: Math.round(centroid[0] * 10) / 10, cy: Math.round(centroid[1] * 10) / 10 };
  }
  return {
    counties: result,
    viewBox: `0 0 ${viewW} ${viewH}`,
    matched,
    dbCount: dbVals.length,
  };
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const emitted = [];
for (const [st, prefix] of Object.entries(FIPS)) {
  const { counties, viewBox, matched, dbCount } = generateState(st, prefix);
  const n = Object.keys(counties).length;
  fs.writeFileSync(
    path.join(OUT_DIR, `${st}.ts`),
    `// Auto-generated by scripts/generateCountyPaths.mjs — do not edit\n` +
    `export const VIEWBOX = '${viewBox}';\n` +
    `export const COUNTIES: Record<string, { d: string; cx: number; cy: number }> = ${JSON.stringify(counties, null, 1)};\n`,
  );
  emitted.push(st);
  console.log(`${st}: ${n} shapes, ${matched}/${dbCount} DB counties matched`);
}

// ── Ontario FMZs (LIO Open Data) ─────────────────────────────────────────────
const ON_FMZ_URL = 'https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open07/MapServer/14/query'
  + '?where=1%3D1&outFields=FISHERIES_MANAGEMENT_ZONE_ID&returnGeometry=true'
  + '&outSR=4326&maxAllowableOffset=0.02&f=geojson';
const ON_CACHE = path.join(os.tmpdir(), 'on-fmz-4326.json');

async function generateOntario() {
  let gj;
  if (fs.existsSync(ON_CACHE)) {
    gj = JSON.parse(fs.readFileSync(ON_CACHE, 'utf8'));
  } else {
    console.log('Fetching Ontario FMZ polygons (LIO)…');
    const res = await fetch(ON_FMZ_URL);
    gj = await res.json();
    if (!gj?.features?.length) throw new Error('LIO FMZ fetch returned no features');
    fs.writeFileSync(ON_CACHE, JSON.stringify(gj));
  }
  // ArcGIS emits rings in the opposite winding from what d3-geo's spherical
  // interpretation expects — without a rewind each zone reads as "the whole
  // Earth minus the zone" and the fit collapses. Reverse any polygon whose
  // spherical area exceeds a hemisphere.
  const rewind = (feature) => {
    const g = feature.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) {
      const probeArea = geoArea({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: poly } });
      if (probeArea > 2 * Math.PI) for (const ring of poly) ring.reverse();
    }
    return feature;
  };
  const collection = { type: 'FeatureCollection', features: gj.features.map(rewind) };

  const PAD = 4, MAX = 500;
  const probe = geoMercator().fitSize([MAX, MAX], collection);
  const [[bx0, by0], [bx1, by1]] = geoPath().projection(probe).bounds(collection);
  const aspect = (by1 - by0) / (bx1 - bx0);
  const viewW = aspect > 1 ? Math.round(MAX / aspect) : MAX;
  const viewH = aspect > 1 ? MAX : Math.round(MAX * aspect);
  const projection = geoMercator().fitExtent([[PAD, PAD], [viewW - PAD, viewH - PAD]], collection);
  const pathGen = geoPath().projection(projection);

  const dbVals = new Set(dbCounties('on'));
  let matched = 0;
  const result = {};
  for (const f of gj.features) {
    const key = `FMZ ${f.properties.FISHERIES_MANAGEMENT_ZONE_ID}`;
    if (dbVals.has(key)) matched++;
    const d = pathGen(f);
    if (!d) continue;
    const centroid = projection(geoCentroid(f));
    result[key] = { d, cx: Math.round(centroid[0] * 10) / 10, cy: Math.round(centroid[1] * 10) / 10 };
  }
  fs.writeFileSync(
    path.join(OUT_DIR, 'on.ts'),
    `// Auto-generated by scripts/generateCountyPaths.mjs — do not edit\n` +
    `// Ontario Fisheries Management Zones (LIO Open Data layer 14).\n` +
    `export const VIEWBOX = '0 0 ${viewW} ${viewH}';\n` +
    `export const COUNTIES: Record<string, { d: string; cx: number; cy: number }> = ${JSON.stringify(result, null, 1)};\n`,
  );
  emitted.push('on');
  console.log(`on: ${Object.keys(result).length} FMZ shapes, ${matched}/${dbVals.size} DB regions matched`);
}

try {
  await generateOntario();
} catch (err) {
  console.warn(`on: FMZ generation FAILED (${err.message}) — Ontario stays list-only`);
}

let index = `// Auto-generated by scripts/generateCountyPaths.mjs — do not edit\n`;
index += `// States absent here (ri, ak, Canadian provinces) fall back to the\n`;
index += `// list-only county picker fed by the server's /filters counties.\n`;
index += `import type { StateKey } from '../../generated/states';\n\n`;
for (const st of emitted) {
  index += `import { VIEWBOX as ${st.toUpperCase()}_VB, COUNTIES as ${st.toUpperCase()}_C } from './${st}';\n`;
}
index += `\nexport interface CountyMapData {\n  viewBox: string;\n  counties: Record<string, { d: string; cx: number; cy: number }>;\n}\n\n`;
index += `export const COUNTY_MAPS: Partial<Record<StateKey, CountyMapData>> = {\n`;
for (const st of emitted) {
  index += `  ${st}: { viewBox: ${st.toUpperCase()}_VB, counties: ${st.toUpperCase()}_C },\n`;
}
index += `};\n`;
fs.writeFileSync(path.join(OUT_DIR, 'index.ts'), index);
console.log(`Done — ${emitted.length} states emitted to src/data/countyPaths/`);
