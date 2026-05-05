# LakeLore RN — Theme & Components

A drop-in design system for the LakeLore Expo app. Restyles the entire flow without changing any logic.

## What's in the box

```
lakelore-rn/
  theme/
    colors.ts         Named color tokens. Import `colors` everywhere; never hex.
    typography.ts     Named text roles (display, body, mono, labels). One import to swap fonts.
    spacing.ts        4/8/12/16/24/32px scale + hairline border helper.
    index.ts          Barrel — `import { colors, text, space } from '../lakelore-rn/theme'`
  components/
    PaperHeader.tsx   Replaces your green band. Dark variant for app, light for modals.
    Chip.tsx          Replaces all rounded blue pills. Active = walleye gold.
    Toggle.tsx        Replaces iOS-blue Switch. Gold = on.
    Segmented.tsx     Replaces the List/Scatter/CPUE↓ control.
    PrimaryButton.tsx Replaces blue rounded "Search" button. Ink-on-paper, square.
    StatPill.tsx      The "Avg wt 1.11 lb" tags under each lake.
    LakeRow.tsx       One row of the results list. CPUE on the right.
    SectionLabel.tsx  "ALL COUNTIES" / "SELECTED · 7" small-caps headers.
    index.ts          Barrel.
```

## 1 — Install the folder

```bash
# from your Expo project root
mkdir -p src
cp -R /path/to/lakelore-rn src/
```

If you keep your code under `app/` (Expo Router) or somewhere else, put it next to your other shared code. Adjust import paths accordingly.

## 2 — Install the fonts

```bash
npx expo install expo-font \
  @expo-google-fonts/young-serif \
  @expo-google-fonts/instrument-serif \
  @expo-google-fonts/newsreader \
  @expo-google-fonts/jetbrains-mono
```

Then in `App.tsx` (or your root layout for Expo Router):

```tsx
import { useFonts } from 'expo-font';
import { YoungSerif_400Regular } from '@expo-google-fonts/young-serif';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import {
  Newsreader_400Regular,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  Newsreader_700Bold,
} from '@expo-google-fonts/newsreader';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

export default function App() {
  const [loaded] = useFonts({
    YoungSerif_400Regular,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Newsreader_400Regular,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Newsreader_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });
  if (!loaded) return null;        // or your existing splash
  // ... your existing root
}
```

Bundle cost: ~600 KB (one weight of Young Serif + Instrument Serif + four of Newsreader + four of JetBrains Mono).

## 3 — Set the global background

Wherever your screens render, set the root background to `colors.paper`:

```tsx
import { colors } from './src/lakelore-rn/theme';

<SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
  {/* ... */}
</SafeAreaView>
```

## 4 — Port the screens, one at a time

Each screen is a 10–30 line change. **Don't rewrite — replace.** Keep your existing data, hooks, and navigation; swap component imports and a handful of inline styles.

### State picker (entry screen)

**Before** — six colored cards.
**After** — paper rows with a hairline color stripe on the left.

```tsx
import { View, Text, ScrollView, Pressable } from 'react-native';
import { colors, text, hairline } from '../lakelore-rn/theme';

const STATE_STRIPES: Record<string, string> = {
  'South Dakota': colors.lakeInk,
  'Minnesota':    '#2a4a3a',
  'North Dakota': colors.rust,
  'Iowa':         colors.moss,
  'Nebraska':     '#a04030',
  'Wisconsin':    colors.lake3,
};

function StateRow({ state }: { state: StateRecord }) {
  return (
    <Pressable onPress={() => navigate(state)}>
      <View style={{
        flexDirection: 'row',
        borderBottomWidth: hairline,
        borderBottomColor: colors.paper3,
      }}>
        <View style={{ width: 8, backgroundColor: STATE_STRIPES[state.name] }} />
        <View style={{ flex: 1, padding: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={text.displayL}>{state.name}</Text>
            <Text style={[text.labelM, { color: colors.inkSoft, marginTop: 6 }]}>
              {state.agency}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={text.dataL}>{state.lakeCount.toLocaleString()}</Text>
            <Text style={[text.labelS, { color: colors.walleye2 }]}>LAKES</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
```

### Search screen — header + filters

```tsx
import { PaperHeader, Chip, Toggle, PrimaryButton } from '../lakelore-rn/components';
import { colors, text, space, hairline } from '../lakelore-rn/theme';

<PaperHeader title={`${state.name} ▾`} eyebrow={`ATLAS · ${state.code}`} right={`${count.toLocaleString()} LAKES`} />

{/* Species selector — replaces grey rounded card */}
<Pressable onPress={openSpeciesModal} style={{
  borderWidth: hairline, borderColor: colors.ink,
  padding: 12, marginHorizontal: 16, marginTop: 14,
  flexDirection: 'row', justifyContent: 'space-between',
}}>
  <Text style={text.displayM}>{species?.name ?? 'All Species'}</Text>
  <Text style={{ color: colors.inkSoft }}>›</Text>
</Pressable>

{/* Lake name + Search button — replaces blue rounded button */}
<View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 8 }}>
  <TextInput
    placeholder="Lake name…"
    placeholderTextColor={colors.inkSoft}
    style={{
      flex: 1,
      borderWidth: hairline, borderColor: colors.paper3,
      backgroundColor: colors.paper2,
      padding: 12,
      ...text.dataS,
      color: colors.ink,
    }}
  />
  <PrimaryButton onPress={runSearch}>Search</PrimaryButton>
</View>

{/* Filter pills — replaces blue rounded chips */}
<View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', margin: 16, flexWrap: 'wrap' }}>
  <Chip dot={hasActiveFilters} onPress={openFilters}>Filters</Chip>
  <Chip onPress={openCounties}>{countyCount} Counties</Chip>
  <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Text style={[text.labelM, { color: colors.inkSoft }]}>Latest Only</Text>
    <Toggle value={latestOnly} onValueChange={setLatestOnly} />
  </View>
</View>
```

### Results list

Replace your row component with `LakeRow`:

```tsx
import { LakeRow, Segmented } from '../lakelore-rn/components';

<View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.paper2,
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                borderBottomWidth: hairline, borderBottomColor: colors.paper3 }}>
  <Text style={[text.labelL, { color: colors.inkSoft }]}>{count} results</Text>
  <Segmented options={['List', 'Scatter', 'CPUE ↓']} active={mode} onChange={setMode} />
</View>

<FlatList
  data={results}
  keyExtractor={r => r.id}
  renderItem={({ item }) => (
    <LakeRow
      name={item.name}
      location={`${item.county} · ${item.acres} ac · ${item.maxDepth} ft · ${item.surveyDate}`}
      stats={[
        ['Avg wt', `${item.avgWeight} lb`],
        ['Catch', `${item.catch}`],
        ...(item.stocked != null ? [['stck/100ac', `${item.stocked}`] as const] : []),
      ]}
      rightValue={item.cpue.toFixed(1)}
      onPress={() => openLake(item)}
    />
  )}
/>
```

### Lake detail — header + tabs

```tsx
import { PaperHeader, Chip } from '../lakelore-rn/components';

<PaperHeader
  title={lake.name}
  eyebrow={`${lake.county.toUpperCase()} CO · ${state.code}`}
  right={`${lake.maxDepth} FT`}
  onBack={() => nav.goBack()}
  backLabel="← Back"
/>

{/* Headline reading — replaces blue strip */}
<View style={{ padding: 16, backgroundColor: colors.paper2,
               borderBottomWidth: hairline, borderBottomColor: colors.paper3 }}>
  <Text style={[text.labelS, { color: colors.inkSoft }]}>
    {species.name} · POPULATION READING
  </Text>
  <Text style={[text.dataXL, { color: colors.ink, marginTop: 4 }]}>
    {value} <Text style={[text.bodyS, { color: colors.inkSoft }]}>est. adults / 100 ac</Text>
  </Text>
</View>

{/* Tabs — replaces blue underline */}
<View style={{ flexDirection: 'row', borderBottomWidth: hairline, borderBottomColor: colors.ink }}>
  {['CPUE Over Time', 'Stocking History'].map((label, i) => {
    const on = activeTab === i;
    return (
      <Pressable key={label} onPress={() => setTab(i)} style={{
        flex: 1, paddingVertical: 12, alignItems: 'center',
        borderBottomWidth: on ? 2 : 0, borderBottomColor: colors.walleye,
      }}>
        <Text style={[text.labelL, { color: on ? colors.ink : colors.inkSoft, fontWeight: on ? '600' : '400' }]}>
          {label}
        </Text>
      </Pressable>
    );
  })}
</View>
```

## 5 — Charts

Your existing chart library (Victory / Skia / whatever) keeps its structure. Just swap **colors and fonts**:

```ts
// chart palette
import { colors } from '../lakelore-rn/theme';

const SERIES_COLORS = {
  gillNets:        colors.rust,
  trapNets:        colors.walleye,
  electrofishing:  colors.moss,
  beachSeine:      colors.lake3,
  surveySeining:   '#8a6aa8',  // purple — only used here, keep inline
};

const STOCKING_BARS = {
  fry:      colors.walleye,
  yearling: colors.lake3,
  adult:    colors.rust,
};

const CHART_FONT = {
  fontFamily: 'JetBrainsMono_400Regular',
  fontSize: 9,
  fill: colors.inkSoft,
};

const AXIS_LINE = { stroke: colors.ink, strokeWidth: 0.8 };
const GRID_LINE = { stroke: colors.paper3, strokeWidth: 0.5, strokeDasharray: '2 3' };
```

Apply to gridlines, axis tick labels, line strokes, bar fills, and dot fills.

## 6 — Things you'll need to do that aren't in this folder

These weren't possible to ship as drop-ins because they depend on your existing code:

- **County map** — your current pinch/pan map keeps its behavior. Just restyle: selected county fill = `colors.lake3`, unselected = `colors.paper`, county border = `colors.paper3`. Selected chips below the map become `<Chip active>` with an `×` glyph.
- **Empty-state fish drawing** — drop the `<Image>` source for the rod-and-fish emoji. Replace with the SVG line-fish from `RN Preview · Rest of Flow.html` — or ask me to extract it as a standalone `components/EmptyFish.tsx`.
- **Status bar** — set `<StatusBar style="dark" />` (`expo-status-bar`) on screens with the paper background; `"light"` on the `PaperHeader` ink screens.
- **Year-detail card on stocking chart** — use `<View>` with `borderWidth: hairline, borderColor: colors.ink, backgroundColor: colors.paper2`. See `RN Preview.html` for the exact structure.

## 7 — Order I'd port them in

1. **App.tsx** — load fonts, set root background → confirms theme is wired.
2. **State picker** — easiest screen, builds confidence.
3. **PaperHeader** rolled into search screen → biggest visual change for one component swap.
4. **LakeRow** in results → the heart of the app.
5. **Lake detail** header + tabs → second-most-used surface.
6. **Charts** — slowest, do last when everything else looks right.
7. **Modals** (county, species, filters) — clean up at the end.

Push to TestFlight after step 4. By that point the app already feels different on every primary surface; the rest is polish.

## 8 — When you want to tweak

- **All color decisions** live in `theme/colors.ts`. One file edit, everywhere updates.
- **All type decisions** live in `theme/typography.ts`. Want to lighten Young Serif to `_300Light`? Change one line.
- **Active state color** is `colors.walleye`. Don't hard-code gold anywhere else.
- **Border decisions** — every border is `hairline` from `theme/spacing.ts`. Never `borderWidth: 1` inline.

## Questions or drift?

If a screen feels "off" after porting, the most common causes are:

1. A hex color survived from the old screen — search the file for `#` and replace.
2. A `borderRadius` survived — this system is square. Set to 0.
3. A `fontFamily` survived as a system font — every Text needs a `text.*` role.
4. iOS-blue tint slipped through — check `tintColor`, `accentColor`, `Switch trackColor`.
