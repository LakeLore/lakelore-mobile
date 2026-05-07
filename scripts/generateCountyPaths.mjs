import * as topojson from 'topojson-client';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SD_FIPS = {
  '46003':'Aurora','46005':'Beadle','46007':'Bennett','46009':'Bon Homme',
  '46011':'Brookings','46013':'Brown','46015':'Brule','46017':'Buffalo',
  '46019':'Butte','46021':'Campbell','46023':'Charles Mix','46025':'Clark',
  '46027':'Clay','46029':'Codington','46031':'Corson','46033':'Custer',
  '46035':'Davison','46037':'Day','46039':'Deuel','46041':'Dewey',
  '46043':'Douglas','46045':'Edmunds','46047':'Fall River','46049':'Faulk',
  '46051':'Grant','46053':'Gregory','46055':'Haakon','46057':'Hamlin',
  '46059':'Hand','46061':'Hanson','46063':'Harding','46065':'Hughes',
  '46067':'Hutchinson','46069':'Hyde','46071':'Jackson','46073':'Jerauld',
  '46075':'Jones','46077':'Kingsbury','46079':'Lake','46081':'Lawrence',
  '46083':'Lincoln','46085':'Lyman','46087':'McCook','46089':'McPherson',
  '46091':'Marshall','46093':'Meade','46095':'Mellette','46097':'Miner',
  '46099':'Minnehaha','46101':'Moody','46102':'Oglala Lakota','46103':'Pennington',
  '46105':'Perkins','46107':'Potter','46109':'Roberts','46111':'Sanborn',
  '46113':'Shannon','46115':'Spink','46117':'Stanley','46119':'Sully',
  '46121':'Todd','46123':'Tripp','46125':'Turner','46127':'Union',
  '46129':'Walworth','46135':'Yankton','46137':'Ziebach',
};

const NE_FIPS = {
  '31001':'Adams','31003':'Antelope','31005':'Arthur','31007':'Banner','31009':'Blaine',
  '31011':'Boone','31013':'Box Butte','31015':'Boyd','31017':'Brown','31019':'Buffalo',
  '31021':'Burt','31023':'Butler','31025':'Cass','31027':'Cedar','31029':'Chase',
  '31031':'Cherry','31033':'Cheyenne','31035':'Clay','31037':'Colfax','31039':'Cuming',
  '31041':'Custer','31043':'Dakota','31045':'Dawes','31047':'Dawson','31049':'Deuel',
  '31051':'Dixon','31053':'Dodge','31055':'Douglas','31057':'Dundy','31059':'Fillmore',
  '31061':'Franklin','31063':'Frontier','31065':'Furnas','31067':'Gage','31069':'Garden',
  '31071':'Garfield','31073':'Gosper','31075':'Grant','31077':'Greeley','31079':'Hall',
  '31081':'Hamilton','31083':'Harlan','31085':'Hayes','31087':'Hitchcock','31089':'Holt',
  '31091':'Hooker','31093':'Howard','31095':'Jefferson','31097':'Johnson','31099':'Kearney',
  '31101':'Keith','31103':'Keya Paha','31105':'Kimball','31107':'Knox','31109':'Lancaster',
  '31111':'Lincoln','31113':'Logan','31115':'Loup','31117':'McPherson','31119':'Madison',
  '31121':'Merrick','31123':'Morrill','31125':'Nance','31127':'Nemaha','31129':'Nuckolls',
  '31131':'Otoe','31133':'Pawnee','31135':'Perkins','31137':'Phelps','31139':'Pierce',
  '31141':'Platte','31143':'Polk','31145':'Red Willow','31147':'Richardson','31149':'Rock',
  '31151':'Saline','31153':'Sarpy','31155':'Saunders','31157':'Scotts Bluff','31159':'Seward',
  '31161':'Sheridan','31163':'Sherman','31165':'Sioux','31167':'Stanton','31169':'Thayer',
  '31171':'Thomas','31173':'Thurston','31175':'Valley','31177':'Washington','31179':'Wayne',
  '31181':'Webster','31183':'Wheeler','31185':'York',
};

const IA_FIPS = {
  '19001':'Adair','19003':'Adams','19005':'Allamakee','19007':'Appanoose','19009':'Audubon',
  '19011':'Benton','19013':'Black Hawk','19015':'Boone','19017':'Bremer','19019':'Buchanan',
  '19021':'Buena Vista','19023':'Butler','19025':'Calhoun','19027':'Carroll','19029':'Cass',
  '19031':'Cedar','19033':'Cerro Gordo','19035':'Cherokee','19037':'Chickasaw','19039':'Clarke',
  '19041':'Clay','19043':'Clayton','19045':'Clinton','19047':'Crawford','19049':'Dallas',
  '19051':'Davis','19053':'Decatur','19055':'Delaware','19057':'Des Moines','19059':'Dickinson',
  '19061':'Dubuque','19063':'Emmet','19065':'Fayette','19067':'Floyd','19069':'Franklin',
  '19071':'Fremont','19073':'Greene','19075':'Grundy','19077':'Guthrie','19079':'Hamilton',
  '19081':'Hancock','19083':'Hardin','19085':'Harrison','19087':'Henry','19089':'Howard',
  '19091':'Humboldt','19093':'Ida','19095':'Iowa','19097':'Jackson','19099':'Jasper',
  '19101':'Jefferson','19103':'Johnson','19105':'Jones','19107':'Keokuk','19109':'Kossuth',
  '19111':'Lee','19113':'Linn','19115':'Louisa','19117':'Lucas','19119':'Lyon',
  '19121':'Madison','19123':'Mahaska','19125':'Marion','19127':'Marshall','19129':'Mills',
  '19131':'Mitchell','19133':'Monona','19135':'Monroe','19137':'Montgomery','19139':'Muscatine',
  "19141":"O'Brien",'19143':'Osceola','19145':'Page','19147':'Palo Alto','19149':'Plymouth',
  '19151':'Pocahontas','19153':'Polk','19155':'Pottawattamie','19157':'Poweshiek','19159':'Ringgold',
  '19161':'Sac','19163':'Scott','19165':'Shelby','19167':'Sioux','19169':'Story',
  '19171':'Tama','19173':'Taylor','19175':'Union','19177':'Van Buren','19179':'Wapello',
  '19181':'Warren','19183':'Washington','19185':'Wayne','19187':'Webster','19189':'Winnebago',
  '19191':'Winneshiek','19193':'Woodbury','19195':'Worth','19197':'Wright',
};

const ND_FIPS = {
  '38001':'Adams','38003':'Barnes','38005':'Benson','38007':'Billings',
  '38009':'Bottineau','38011':'Bowman','38013':'Burke','38015':'Burleigh',
  '38017':'Cass','38019':'Cavalier','38021':'Dickey','38023':'Divide',
  '38025':'Dunn','38027':'Eddy','38029':'Emmons','38031':'Foster',
  '38033':'Golden Valley','38035':'Grand Forks','38037':'Grant','38039':'Griggs',
  '38041':'Hettinger','38043':'Kidder','38045':'LaMoure','38047':'Logan',
  '38049':'McHenry','38051':'McIntosh','38053':'McKenzie','38055':'McLean',
  '38057':'Mercer','38059':'Morton','38061':'Mountrail','38063':'Nelson',
  '38065':'Oliver','38067':'Pembina','38069':'Pierce','38071':'Ramsey',
  '38073':'Ransom','38075':'Renville','38077':'Richland','38079':'Rolette',
  '38081':'Sargent','38083':'Sheridan','38085':'Sioux','38087':'Slope',
  '38089':'Stark','38091':'Steele','38093':'Stutsman','38095':'Towner',
  '38097':'Traill','38099':'Walsh','38101':'Ward','38103':'Wells',
  '38105':'Williams',
};

const WI_FIPS = {
  '55001':'Adams','55003':'Ashland','55005':'Barron','55007':'Bayfield',
  '55009':'Brown','55011':'Buffalo','55013':'Burnett','55015':'Calumet',
  '55017':'Chippewa','55019':'Clark','55021':'Columbia','55023':'Crawford',
  '55025':'Dane','55027':'Dodge','55029':'Door','55031':'Douglas',
  '55033':'Dunn','55035':'Eau Claire','55037':'Florence','55039':'Fond du Lac',
  '55041':'Forest','55043':'Grant','55045':'Green','55047':'Green Lake',
  '55049':'Iowa','55051':'Iron','55053':'Jackson','55055':'Jefferson',
  '55057':'Juneau','55059':'Kenosha','55061':'Kewaunee','55063':'La Crosse',
  '55065':'Lafayette','55067':'Langlade','55069':'Lincoln','55071':'Manitowoc',
  '55073':'Marathon','55075':'Marinette','55077':'Marquette','55079':'Menominee',
  '55081':'Milwaukee','55083':'Monroe','55085':'Oconto','55087':'Oneida',
  '55089':'Outagamie','55091':'Ozaukee','55093':'Pepin','55095':'Pierce',
  '55097':'Polk','55099':'Portage','55101':'Price','55103':'Racine',
  '55105':'Richland','55107':'Rock','55109':'Rusk','55111':'St. Croix',
  '55113':'Sauk','55115':'Sawyer','55117':'Shawano','55119':'Sheboygan',
  '55121':'Taylor','55123':'Trempealeau','55125':'Vernon','55127':'Vilas',
  '55129':'Walworth','55131':'Washburn','55133':'Washington','55135':'Waukesha',
  '55137':'Waupaca','55139':'Waushara','55141':'Winnebago','55143':'Wood',
};

const MI_FIPS = {
  '26001':'Alcona','26003':'Alger','26005':'Allegan','26007':'Alpena',
  '26009':'Antrim','26011':'Arenac','26013':'Baraga','26015':'Barry',
  '26017':'Bay','26019':'Benzie','26021':'Berrien','26023':'Branch',
  '26025':'Calhoun','26027':'Cass','26029':'Charlevoix','26031':'Cheboygan',
  '26033':'Chippewa','26035':'Clare','26037':'Clinton','26039':'Crawford',
  '26041':'Delta','26043':'Dickinson','26045':'Eaton','26047':'Emmet',
  '26049':'Genesee','26051':'Gladwin','26053':'Gogebic','26055':'Grand Traverse',
  '26057':'Gratiot','26059':'Hillsdale','26061':'Houghton','26063':'Huron',
  '26065':'Ingham','26067':'Ionia','26069':'Iosco','26071':'Iron',
  '26073':'Isabella','26075':'Jackson','26077':'Kalamazoo','26079':'Kalkaska',
  '26081':'Kent','26083':'Keweenaw','26085':'Lake','26087':'Lapeer',
  '26089':'Leelanau','26091':'Lenawee','26093':'Livingston','26095':'Luce',
  '26097':'Mackinac','26099':'Macomb','26101':'Manistee','26103':'Marquette',
  '26105':'Mason','26107':'Mecosta','26109':'Menominee','26111':'Midland',
  '26113':'Missaukee','26115':'Monroe','26117':'Montcalm','26119':'Montmorency',
  '26121':'Muskegon','26123':'Newaygo','26125':'Oakland','26127':'Oceana',
  '26129':'Ogemaw','26131':'Ontonagon','26133':'Osceola','26135':'Oscoda',
  '26137':'Otsego','26139':'Ottawa','26141':'Presque Isle','26143':'Roscommon',
  '26145':'Saginaw','26147':'St. Clair','26149':'St. Joseph','26151':'Sanilac',
  '26153':'Schoolcraft','26155':'Shiawassee','26157':'Tuscola','26159':'Van Buren',
  '26161':'Washtenaw','26163':'Wayne','26165':'Wexford',
};

const MN_FIPS = {
  '27001':'Aitkin','27003':'Anoka','27005':'Becker','27007':'Beltrami',
  '27009':'Benton','27011':'Big Stone','27013':'Blue Earth','27015':'Brown',
  '27017':'Carlton','27019':'Carver','27021':'Cass','27023':'Chippewa',
  '27025':'Chisago','27027':'Clay','27029':'Clearwater','27031':'Cook',
  '27033':'Cottonwood','27035':'Crow Wing','27037':'Dakota','27039':'Dodge',
  '27041':'Douglas','27043':'Faribault','27045':'Fillmore','27047':'Freeborn',
  '27049':'Goodhue','27051':'Grant','27053':'Hennepin','27055':'Houston',
  '27057':'Hubbard','27059':'Isanti','27061':'Itasca','27063':'Jackson',
  '27065':'Kanabec','27067':'Kandiyohi','27069':'Kittson','27071':'Koochiching',
  '27073':'Lac qui Parle','27075':'Lake','27077':'Lake of the Woods',
  '27079':'Le Sueur','27081':'Lincoln','27083':'Lyon','27085':'McLeod',
  '27087':'Mahnomen','27089':'Marshall','27091':'Martin','27093':'Meeker',
  '27095':'Mille Lacs','27097':'Morrison','27099':'Mower','27101':'Murray',
  '27103':'Nicollet','27105':'Nobles','27107':'Norman','27109':'Olmsted',
  '27111':'Otter Tail','27113':'Pennington','27115':'Pine','27117':'Pipestone',
  '27119':'Polk','27121':'Pope','27123':'Ramsey','27125':'Red Lake',
  '27127':'Redwood','27129':'Renville','27131':'Rice','27133':'Rock',
  '27135':'Roseau','27137':'St. Louis','27139':'Scott','27141':'Sherburne',
  '27143':'Sibley','27145':'Stearns','27147':'Steele','27149':'Stevens',
  '27151':'Swift','27153':'Todd','27155':'Traverse','27157':'Wabasha',
  '27159':'Wadena','27161':'Waseca','27163':'Washington','27165':'Watonwan',
  '27167':'Wilkin','27169':'Winona','27171':'Wright','27173':'Yellow Medicine',
};

console.log('Fetching US counties TopoJSON...');
const res = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json');
const us = await res.json();

const allCounties = topojson.feature(us, us.objects.counties);

function generateState(fipsMap, statePrefix, viewW, viewH, padding) {
  const features = allCounties.features.filter(f => {
    const id = String(f.id).padStart(5, '0');
    return id.startsWith(statePrefix);
  });

  const collection = { type: 'FeatureCollection', features };

  const projection = geoMercator().fitExtent(
    [[padding, padding], [viewW - padding, viewH - padding]],
    collection
  );
  const pathGen = geoPath().projection(projection);

  const result = {};
  for (const f of features) {
    const id = String(f.id).padStart(5, '0');
    const name = fipsMap[id];
    if (!name) { console.warn('Unknown FIPS', id); continue; }
    const d = pathGen(f);
    const centroid = projection(geoCentroid(f));
    result[name] = { d, cx: Math.round(centroid[0] * 10) / 10, cy: Math.round(centroid[1] * 10) / 10 };
  }
  return { counties: result, viewBox: `0 0 ${viewW} ${viewH}` };
}

console.log('Generating SD county paths...');
const sd = generateState(SD_FIPS, '46', 500, 320, 4);

console.log('Generating MN county paths...');
const mn = generateState(MN_FIPS, '27', 380, 500, 4);

console.log('Generating ND county paths...');
const nd = generateState(ND_FIPS, '38', 500, 300, 4);

console.log('Generating IA county paths...');
const ia = generateState(IA_FIPS, '19', 500, 380, 4);

console.log('Generating NE county paths...');
const ne = generateState(NE_FIPS, '31', 500, 300, 4);

console.log('Generating WI county paths...');
const wi = generateState(WI_FIPS, '55', 380, 500, 4);

console.log('Generating MI county paths...');
// Michigan spans both peninsulas — wider east-west than the others; 500x420
// gives the L-shaped extent room without too much whitespace.
const mi = generateState(MI_FIPS, '26', 500, 420, 4);

const outDir = path.join(__dirname, '../src/data');

fs.writeFileSync(
  path.join(outDir, 'sdCountyPaths.ts'),
  `// Auto-generated by scripts/generateCountyPaths.mjs — do not edit\n` +
  `export const SD_VIEWBOX = '${sd.viewBox}';\n` +
  `export const SD_COUNTIES: Record<string, { d: string; cx: number; cy: number }> = ${JSON.stringify(sd.counties, null, 2)};\n`
);

fs.writeFileSync(
  path.join(outDir, 'mnCountyPaths.ts'),
  `// Auto-generated by scripts/generateCountyPaths.mjs — do not edit\n` +
  `export const MN_VIEWBOX = '${mn.viewBox}';\n` +
  `export const MN_COUNTIES: Record<string, { d: string; cx: number; cy: number }> = ${JSON.stringify(mn.counties, null, 2)};\n`
);

fs.writeFileSync(
  path.join(outDir, 'ndCountyPaths.ts'),
  `// Auto-generated by scripts/generateCountyPaths.mjs — do not edit\n` +
  `export const ND_VIEWBOX = '${nd.viewBox}';\n` +
  `export const ND_COUNTIES: Record<string, { d: string; cx: number; cy: number }> = ${JSON.stringify(nd.counties, null, 2)};\n`
);

fs.writeFileSync(
  path.join(outDir, 'iaCountyPaths.ts'),
  `// Auto-generated by scripts/generateCountyPaths.mjs — do not edit\n` +
  `export const IA_VIEWBOX = '${ia.viewBox}';\n` +
  `export const IA_COUNTIES: Record<string, { d: string; cx: number; cy: number }> = ${JSON.stringify(ia.counties, null, 2)};\n`
);

fs.writeFileSync(
  path.join(outDir, 'neCountyPaths.ts'),
  `// Auto-generated by scripts/generateCountyPaths.mjs — do not edit\n` +
  `export const NE_VIEWBOX = '${ne.viewBox}';\n` +
  `export const NE_COUNTIES: Record<string, { d: string; cx: number; cy: number }> = ${JSON.stringify(ne.counties, null, 2)};\n`
);

fs.writeFileSync(
  path.join(outDir, 'wiCountyPaths.ts'),
  `// Auto-generated by scripts/generateCountyPaths.mjs — do not edit\n` +
  `export const WI_VIEWBOX = '${wi.viewBox}';\n` +
  `export const WI_COUNTIES: Record<string, { d: string; cx: number; cy: number }> = ${JSON.stringify(wi.counties, null, 2)};\n`
);

fs.writeFileSync(
  path.join(outDir, 'miCountyPaths.ts'),
  `// Auto-generated by scripts/generateCountyPaths.mjs — do not edit\n` +
  `export const MI_VIEWBOX = '${mi.viewBox}';\n` +
  `export const MI_COUNTIES: Record<string, { d: string; cx: number; cy: number }> = ${JSON.stringify(mi.counties, null, 2)};\n`
);

console.log(`SD: ${Object.keys(sd.counties).length} counties`);
console.log(`MN: ${Object.keys(mn.counties).length} counties`);
console.log(`ND: ${Object.keys(nd.counties).length} counties`);
console.log(`IA: ${Object.keys(ia.counties).length} counties`);
console.log(`NE: ${Object.keys(ne.counties).length} counties`);
console.log(`WI: ${Object.keys(wi.counties).length} counties`);
console.log(`MI: ${Object.keys(mi.counties).length} counties`);
console.log('Done.');
