// src/screens/AboutScreen.tsx — modal "About / Sources" page.
//
// Surfaces credit and attribution for every state agency whose data
// LakeLore aggregates, and an explicit independence statement. Apple's
// App Review occasionally asks "what is your relationship to these
// agencies?" — having a dedicated, prominent screen that answers that
// question is the cleanest defense.

import React, { useState } from 'react';
import {
  Modal, View, Text, ScrollView, Pressable, StyleSheet, Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Purchases from 'react-native-purchases';
import { colors, text, space, hairline } from '../lakelore-rn/theme';
import { PaperHeader, SectionLabel } from '../lakelore-rn/components';
import { useEntitlement } from '../useEntitlement';
import { restorePurchases } from '../iap';
import { useToast } from '../Toast';
import { ACTIVE_STATES } from '../activeStates';
import { APP_VERSION, OTA_UPDATE_ID } from '../api';
import { StateKey, GENERATED_STATES } from '../types';

// Subscription product IDs — used to deep-link Play Store directly to the
// LakeLore row rather than the user's full subscription list. iOS uses the
// native StoreKit "manage" sheet via RC's SDK; it doesn't take a product ID.
const ANDROID_SKU = 'lakelore_allstates_annual';
const ANDROID_PACKAGE = 'com.lakeloreapp.lakelore';

const ANDROID_MANAGE_URL =
  `https://play.google.com/store/account/subscriptions?sku=${ANDROID_SKU}&package=${ANDROID_PACKAGE}`;
const IOS_FALLBACK_MANAGE_URL = 'itms-apps://apps.apple.com/account/subscriptions';
const WEB_FALLBACK_MANAGE_URL = 'https://www.lakeloreapp.com/support';

/**
 * Open the platform's subscription management surface.
 * - iOS 13+: native StoreKit sheet via RC SDK (stays in-app). Falls back to
 *   the App Store account-subscriptions URL if the native call fails.
 * - Android: deep-link straight to the LakeLore row in Play subscriptions.
 * - Web / unknown: support page (Linking.openURL handles the same way).
 */
async function openManageSubscription(): Promise<void> {
  if (Platform.OS === 'ios') {
    try {
      await Purchases.showManageSubscriptions();
      return;
    } catch {
      // Native sheet failed (rare; usually iOS <13). Fall through to URL.
      Linking.openURL(IOS_FALLBACK_MANAGE_URL).catch(() => {});
      return;
    }
  }
  const url = Platform.OS === 'android' ? ANDROID_MANAGE_URL : WEB_FALLBACK_MANAGE_URL;
  Linking.openURL(url).catch(() => {});
}

interface Props {
  visible: boolean;
  /** Current state — when provided, renders a state-specific glossary block
   *  with CPUE / gear / agency-specific terminology. Omit (or undefined)
   *  from StateSelectScreen where no state has been entered yet. */
  state?: StateKey;
  onClose: () => void;
}

interface AgencySource {
  key: StateKey;
  state: string;
  agency: string;
  abbr: string;
  url: string;
  blurb: string;
  /** Licence-mandated (or licence-requested) credit line, rendered verbatim
   *  under the blurb. Populated from ATTRIBUTIONS. */
  attribution?: string;
}

// ── Required attribution strings (2026-08-04 data-licensing audit) ─────────
// These are the credit lines the source licences/terms REQUIRE or request —
// exact wording matters for NJ (mandatory verbatim disclaimer) and MB (OpenMB
// licence text). Keyed by state; states without a stated requirement rely on
// the agency row itself as the credit. See ~/DATA_LICENSING_AUDIT_2026-07-28.md.
const ATTRIBUTIONS: Partial<Record<StateKey, string>> = {
  mn: 'Includes data contributed by the Minnesota Department of Natural Resources (MNDNR). MNDNR has not participated in this product and does not endorse it.',
  ca: 'Includes CDFW BIOS data, © California Department of Fish and Wildlife, licensed under CC BY 4.0 (creativecommons.org/licenses/by/4.0).',
  pa: 'Data credit: Pennsylvania Fish and Boat Commission (PFBC). LakeLore modifies PFBC data as described under "How LakeLore modifies agency data" below; those modifications are LakeLore’s own and are not approved by the PFBC.',
  tn: 'Source: Tennessee Wildlife Resources Agency — tn.gov/twra.',
  nj: 'This product was developed using New Jersey Department of Environmental Protection Geographic Information System digital data, but this secondary product has not been verified by NJDEP and is not state-authorized or endorsed.',
  ok: 'Byline: Oklahoma Department of Wildlife Conservation.',
  mb: 'Contains information from the Government of Manitoba, licensed under the OpenMB Information and Data Use Licence (Manitoba.ca/OpenMB).',
};

const ALL_AGENCIES: AgencySource[] = [
  {
    key: 'mn',
    state: 'Minnesota',
    agency: 'Minnesota Department of Natural Resources',
    abbr: 'MN DNR',
    url: 'https://www.dnr.state.mn.us/lakefind/',
    blurb: 'Standardized netting and electrofishing surveys, plus stocking records, published through MN DNR LakeFinder.',
  },
  {
    key: 'wi',
    state: 'Wisconsin',
    agency: 'Wisconsin Department of Natural Resources',
    abbr: 'WI DNR',
    url: 'https://dnr.wi.gov/lakes/',
    blurb: 'Treaty-area netting and electrofishing surveys with length and weight measurements, published through the WI DNR Lake Pages.',
  },
  {
    key: 'mi',
    state: 'Michigan',
    agency: 'Michigan Department of Natural Resources',
    abbr: 'MI DNR',
    url: 'https://www.michigan.gov/dnr/things-to-do/fishing',
    blurb: 'Inland-lake survey reports and fish stocking records published in the MI DNR Status of Fishery Resource Reports.',
  },
  {
    key: 'nd',
    state: 'North Dakota',
    agency: 'North Dakota Game and Fish Department',
    abbr: 'ND Game & Fish',
    url: 'https://gf.nd.gov/fishing',
    blurb: 'Standardized gill-net surveys and stocking records published through the ND Game and Fish public ArcGIS portal.',
  },
  {
    key: 'sd',
    state: 'South Dakota',
    agency: 'South Dakota Game, Fish and Parks',
    abbr: 'SD GFP',
    url: 'https://gfp.sd.gov/fishing-reports/',
    blurb: 'Annual fisheries survey reports with PSD, Wr, and Catch / Net statistics, published as PDFs through the SD GFP report portal.',
  },
  {
    key: 'ne',
    state: 'Nebraska',
    agency: 'Nebraska Game and Parks Commission',
    abbr: 'NE Game & Parks',
    url: 'https://outdoornebraska.gov/fishing/',
    blurb: 'Standardized netting surveys and stocking records, published as agency PDFs.',
  },
  {
    key: 'ia',
    state: 'Iowa',
    agency: 'Iowa Department of Natural Resources',
    abbr: 'IA DNR',
    url: 'https://www.iowadnr.gov/things-do/fishing',
    blurb: 'Comprehensive lake surveys (electrofishing, fyke, hoop) published through the Iowa DNR Fisheries Data Dashboard.',
  },
];

// One credit per active state. The original launch states keep their
// hand-written entries above; everything else derives from the generated
// registry export (agency name + homepage) with a generic blurb.
const AGENCIES: AgencySource[] = ACTIVE_STATES.map(k => {
  const hand = ALL_AGENCIES.find(a => a.key === k);
  const base = hand ?? (() => {
    const g = GENERATED_STATES[k];
    return {
      key: k,
      state: g.name,
      agency: g.agency,
      abbr: g.agency,
      url: g.agencyUrl,
      blurb: `Lake survey${g.hasStocking ? ' and stocking' : ''} data published by ${g.agency}.`,
    };
  })();
  return { ...base, attribution: ATTRIBUTIONS[k] };
});

// ── State-specific glossary blocks ────────────────────────────────────────
// Previously lived in src/screens/search/InfoModal.tsx (the "Glossary &
// Help" modal). Merged here so users have one combined "What is this and
// how do I read it" surface per state.

function StateGlossarySection({ state }: { state: StateKey }) {
  const isSD = state === 'sd';
  const isMN = state === 'mn';
  const isND = state === 'nd';
  const isIA = state === 'ia';
  const isNE = state === 'ne';
  const legacy = isSD || isMN || isND || isIA || isNE;
  const g = GENERATED_STATES[state];
  const stateLabel = g?.name ?? state.toUpperCase();
  // Fleet states get glossary text keyed off what their cpue ACTUALLY is
  // (D3, 2026-07-17): the old generic fallback told relative-index and
  // creel states their number was "fish caught per net set" — most wrong
  // for exactly the states with the least familiar metrics.
  const kind = g?.cpueKind ?? null;
  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={[text.labelL, { color: colors.inkSoft }]}>
          FOR {stateLabel.toUpperCase()} — HOW TO READ THIS
        </Text>
      </View>

      {!isIA && legacy && (
        <GlossarySection title="Catch Rate">
          {isSD
            ? 'Fish caught per standard sampling unit. Gill nets: Catch / Net (fish per net-night). Electrofishing: Catch / Hour. Higher catch rate = more abundant fish population.'
            : isND
            ? 'Catch / Net — fish caught per net-night across all net configurations (mesh-graded gill nets and others). Electrofishing surveys use Catch / Hour. Higher = more abundant fish population.'
            : 'Catch / Net — fish caught per net set, across all net types (gill nets, frame nets, trap nets). Electrofishing surveys use Catch / Hour. Higher = more abundant fish population.'}
        </GlossarySection>
      )}

      {!legacy && kind === 'gear' && g?.hasCpue && (
        <GlossarySection title="Catch Rate">
          Fish caught per unit of standardized sampling effort in {g.agency} surveys. The unit follows the gear that produced each number — Catch / Net (per net set or net-night), Catch / Hour (electrofishing), or the unit shown on the row. Higher = more abundant fish population. Compare lakes for the same species; different species are caught at inherently different rates.
        </GlossarySection>
      )}

      {!legacy && kind === 'relative' && (
        <GlossarySection title="Rel. Catch Index">
          {g.agency}&rsquo;s relative-abundance index — a standardized score, not a true fish-per-net catch rate. Use it to compare lakes for the SAME species; the numbers are not comparable across species or against other states&rsquo; catch rates.
        </GlossarySection>
      )}

      {!legacy && kind === 'creel' && (
        <GlossarySection title="Angler Catch Rate">
          Catch rate derived from angler and tournament reports rather than standardized agency survey netting. It reflects fishing success, which tracks abundance but also skill, season, and effort — compare lakes for the same species with that in mind.
        </GlossarySection>
      )}

      {g?.hasRating && (
        <GlossarySection title="Forecast Rating & Best Bets">
          The agency&rsquo;s own published fishing outlook per species and lake (e.g. Poor to Excellent). &ldquo;Best Bet&rdquo; marks the waters the agency features as top picks — they sort above every rated lake. Trajectory words like &ldquo;Developing&rdquo; or &ldquo;Improving&rdquo; describe direction, not a rank, and appear in their own bucket. Ratings are within-state only; never compare them across states.
        </GlossarySection>
      )}

      {state === 'wi' && (
        <GlossarySection title="Norm. Catch Rate">
          A catch rate normalized across gear types for lakes surveyed with mixed gear, expressed in spring-fyke-net-equivalent fish per net so mixed-gear lakes compare against net-sampled lakes.
        </GlossarySection>
      )}

      {!legacy && g?.hasLength && (
        <GlossarySection title="Avg vs Est. Length">
          &ldquo;Avg length&rdquo; is a mean of individually measured fish. &ldquo;Est. length&rdquo; is derived from published size ranges, size classes, or length charts — an estimate, not a measurement, and not comparable against measured averages.
        </GlossarySection>
      )}

      {g?.hasStocking && (
        <GlossarySection title="Stck Adults / 100AC">
          Estimated stocked fish surviving to adulthood per 100 lake acres — the last 10 years of stocking records run through a survival model (fry survive at far lower rates than yearlings). Lakes without recorded acreage show an absolute estimate instead (&ldquo;Stck Adults (est)&rdquo;).
        </GlossarySection>
      )}

      {!legacy && (
        <GlossarySection title="Present / Presence Only">
          The agency lists the species in this water but published no survey metric for it. &ldquo;Stocked · Inferred&rdquo; means the presence comes from stocking records — the agency stocked it there but hasn&rsquo;t published a survey observing it.
        </GlossarySection>
      )}

      {isIA && (
        <GlossarySection title="Catch Rate">
          Fish caught per gear unit. Calculated separately for each gear type:{'\n'}
          • FN Catch / Net: fish per fyke net{'\n'}
          • HN Catch / Net: fish per hoop net{'\n'}
          • EF Catch / Hour: fish per hour of electrofishing{'\n'}
          Higher catch rate = more abundant fish population. The gear filter defaults to whichever gear the Iowa DNR returns as the most-used for the selected lake — switch to a different gear from the filter to see other results.
        </GlossarySection>
      )}

      {isIA && (
        <GlossarySection title="Gear Types (IA)">
          • FN — Fyke Net: A mesh trap with funnel-shaped entrance wings staked along the shoreline. Set overnight or for multiple nights; effective for most species in shallow to mid-depth water.{'\n'}
          • HN — Hoop Net: A cylindrical mesh trap held open by rigid hoops and anchored on the bottom. Commonly used in rivers and reservoirs; good for catfish, buffalo, and rough fish.{'\n'}
          • EF — Electrofishing: A boat-mounted electric current temporarily stuns fish near the surface. Used in spring and fall for walleye, bass, and other nearshore species.{'\n'}
          Iowa DNR surveys often combine multiple gear types in a single Comprehensive survey visit.
        </GlossarySection>
      )}

      {isIA && (
        <GlossarySection title="Avg Length">
          Average length in inches for measured fish from Iowa DNR individual fish measurement records.
        </GlossarySection>
      )}

      {isSD && (
        <GlossarySection title="PSD — Proportional Size Distribution">
          Percentage of stock-length fish that are at or above quality size. Ranges 0–100; higher = better size structure (more large fish).{'\n'}
          • PSD-Q (default): stock → quality size{'\n'}
          • PSD-P: stock → preferred size (larger, trophy-potential fish)
        </GlossarySection>
      )}

      {isSD && (
        <GlossarySection title="Wr — Relative Weight">
          Actual weight compared to the expected weight for a fish of that length. Wr = 100 means average condition; above 100 means well-fed, healthy fish.
        </GlossarySection>
      )}

      {isSD && (
        <GlossarySection title="Gear Types (SD)">
          • AFS Std Gill Net: Multi-mesh overnight gill net; the SD GFP standard for most open-water species.{'\n'}
          • Trap Net: Mesh trap set at the shoreline; used for panfish and rough fish.{'\n'}
          • Electrofishing: Electric current temporarily stuns fish; used for bass, pike, and walleye in shallow water.{'\n'}
          • Seine: Encircling net dragged through the water; used for small or schooling fish.
        </GlossarySection>
      )}

      {isMN && (
        <GlossarySection title="Gear Types (MN)">
          • Standard Gill Net: Multi-mesh overnight gill net following MN DNR protocol; primary gear for most open-water species.{'\n'}
          • Trap Net: Mesh trap set at the shoreline; used for panfish, carp, and rough fish.{'\n'}
          • Electrofishing: Electric current temporarily stuns fish; used for bass, pike, and walleye in shallow water.{'\n'}
          • Seine: Encircling net dragged through the water; used for small or schooling fish.
        </GlossarySection>
      )}

      {isMN && (
        <GlossarySection title="Survey Types (MN)">
          • Standard Survey: Full population assessment conducted on a rotating basin schedule.{'\n'}
          • Special Assessment: Targeted survey addressing a specific management question.{'\n'}
          • Targeted Survey: Survey focused on a single species or issue.{'\n'}
          • Population Assessment: Comprehensive multi-species evaluation.
        </GlossarySection>
      )}

      {isND && (
        <GlossarySection title="Avg Length">
          Average length of fish caught in each sample, converted from millimeters to inches. Only fish with recorded lengths are included in the average.
        </GlossarySection>
      )}

      {isND && (
        <GlossarySection title="Gear Types (ND)">
          Gear types shown are those used in ND GF&P standardized netting surveys. The most common is monofilament multi-mesh gill nets set overnight (net-nights).
        </GlossarySection>
      )}

      {isNE && (
        <GlossarySection title="Avg Length">
          Average length in inches for fish sampled during Nebraska Game & Parks standardized netting surveys.
        </GlossarySection>
      )}

      {isNE && (
        <GlossarySection title="Gear Types (NE)">
          • Gill Net: Multi-mesh monofilament overnight gill net; the NE Game & Parks standard for walleye, pike, and perch assessments.{'\n'}
          • Frame Net / Trap Net: Mesh trap set at the shoreline; used for panfish (crappie, bluegill) and rough fish.{'\n'}
          • Electrofishing: Electric current temporarily stuns fish; used for bass, pike, and walleye in shallow water.
        </GlossarySection>
      )}
    </View>
  );
}

function GlossarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.glossaryItem}>
      <SectionLabel>{title}</SectionLabel>
      <Text style={[text.bodyM, { color: colors.ink2, marginTop: 6 }]}>{children}</Text>
    </View>
  );
}

export default function AboutScreen({ visible, state, onClose }: Props) {
  const { hasAllStates, refresh } = useEntitlement();
  const { toast } = useToast();
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (result === 'restored') {
      await refresh();
      toast('Subscription restored.');
    } else if (result === 'none') {
      toast('No active subscription found on this account.');
    } else {
      toast("Couldn't reach the store — check your connection and try again.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <PaperHeader
          modal
          title="About & Sources"
          onBack={onClose}
          backLabel="Done"
        />

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.eyebrow}>
            <View style={styles.dot} />
            <Text style={[text.labelM, { color: colors.walleye2 }]}>LAKELORE · FIELD GUIDE</Text>
          </View>

          {hasAllStates && (
            <View style={styles.subscriberPill}>
              <Text style={[text.labelS, { color: colors.moss }]}>
                ALL-STATES PASS · ACTIVE
              </Text>
            </View>
          )}

          <View style={styles.callout}>
            <Text style={[text.labelS, { color: colors.walleye2, marginBottom: 6 }]}>
              INDEPENDENCE
            </Text>
            <Text style={[text.bodyM, { color: colors.ink2 }]}>
              LakeLore is not affiliated with, endorsed by, or sponsored by any of the
              state agencies listed below. All data is sourced from public records.
              When an agency&rsquo;s data has changed or contains an error, the
              agency&rsquo;s own portal is the authoritative source — links to each are
              provided.
            </Text>
          </View>

          {/* Glossary ABOVE the 50 agency rows (D3): the explanatory content
              users open this screen for was buried below a full page of
              credits. */}
          {state && <StateGlossarySection state={state} />}

          <View style={styles.sectionHeader}>
            <Text style={[text.labelL, { color: colors.inkSoft }]}>DATA SOURCES</Text>
          </View>

          {AGENCIES.map(a => (
            <Pressable
              key={a.abbr}
              onPress={() => Linking.openURL(a.url)}
              accessibilityRole="link"
              accessibilityLabel={`${a.state} — ${a.agency}`}
              accessibilityHint="Opens agency website in browser"
              style={({ pressed }) => [
                styles.agencyRow,
                { backgroundColor: pressed ? colors.paper2 : colors.paper },
              ]}
            >
              <View style={styles.agencyHeader}>
                <Text style={[text.displayM, { color: colors.ink }]}>{a.state}</Text>
                <Text style={[text.labelS, { color: colors.walleye2 }]}>{a.abbr} ↗</Text>
              </View>
              <Text style={[text.labelM, { color: colors.inkSoft, marginTop: 2 }]}>
                {a.agency}
              </Text>
              <Text style={[text.bodyS, { color: colors.ink2, marginTop: 8 }]}>
                {a.blurb}
              </Text>
              {a.attribution && (
                <Text style={[text.bodyS, { color: colors.inkSoft, marginTop: 6, fontStyle: 'italic' }]}>
                  {a.attribution}
                </Text>
              )}
            </Pressable>
          ))}

          <View style={styles.sectionHeader}>
            <Text style={[text.labelL, { color: colors.inkSoft }]}>NOTES ON THE DATA</Text>
          </View>

          <Text style={[text.bodyM, { color: colors.ink2, marginTop: 8 }]}>
            <Text style={{ fontWeight: '600', color: colors.ink }}>Survey methods vary by agency.</Text>{' '}
            Each state runs its own protocol — gill-net mesh sizes, electrofishing
            voltage, fyke / hoop net configurations, and seasonal timing differ. The
            catch-rate numbers between states are roughly comparable but not interchangeable.
          </Text>

          <Text style={[text.bodyM, { color: colors.ink2, marginTop: 12 }]}>
            <Text style={{ fontWeight: '600', color: colors.ink }}>How LakeLore modifies agency data.</Text>{' '}
            LakeLore does not republish agency reports. It extracts the underlying
            measurements and restructures them: species names are normalized to one
            vocabulary, units are converted (metric to inches / pounds), catch rates
            are derived where an agency publishes counts and effort separately,
            stocking-survival estimates are computed by LakeLore&rsquo;s own model, and
            records are joined across sources by lake. These modifications are
            LakeLore&rsquo;s own work and are not reviewed or approved by any agency.
          </Text>

          <Text style={[text.bodyM, { color: colors.ink2, marginTop: 12 }]}>
            <Text style={{ fontWeight: '600', color: colors.ink }}>The &ldquo;Stck Adults / 100AC&rdquo; metric</Text>{' '}
            is an estimate of adult fish per 100 acres derived from stocking records
            and a per-species survival model. Survival is compounded year-by-year
            through each life stage.{'\n\n'}
            Example — walleye (other species have their own assumptions):{'\n'}
            • fry → fingerling (yr 1): 1%{'\n'}
            • fingerling → yearling (yr 2): 10%{'\n'}
            • yearling → adult (yr 3): 40%{'\n'}
            • adult → adult (each year thereafter): 55%{'\n\n'}
            Example math: 100,000 walleye fry stocked → 1,000 fingerlings → 100
            yearlings → 40 catchable adults by yr 3. Each subsequent year the
            survivor count is multiplied by 55%. Does not model natural reproduction
            or density-dependent mortality. Treat as a rough indicator, not a fish
            count.
          </Text>

          <Text style={[text.bodyM, { color: colors.ink2, marginTop: 12 }]}>
            <Text style={{ fontWeight: '600', color: colors.ink }}>Latest Survey Only.</Text>{' '}
            The toggle near the search bar limits results to each lake&rsquo;s most
            recent survey. Turn it off to see every historical survey record.
          </Text>

          <Text style={[text.bodyM, { color: colors.ink2, marginTop: 12 }]}>
            <Text style={{ fontWeight: '600', color: colors.ink }}>Always defer to the agency for regulations.</Text>{' '}
            Fishing licenses, season dates, slot limits, and access permissions come
            from the relevant state agency — not from LakeLore. Tap any state above to
            visit their official portal.
          </Text>

          <View style={styles.sectionHeader}>
            <Text style={[text.labelL, { color: colors.inkSoft }]}>LAKELORE</Text>
          </View>

          <View style={styles.linkList}>
            <Pressable
              onPress={() => Linking.openURL('https://www.lakeloreapp.com')}
              accessibilityRole="link"
              accessibilityLabel="lakeloreapp.com"
              accessibilityHint="Opens in browser"
              style={styles.linkRow}
            >
              <Text style={[text.bodyM, { color: colors.ink }]}>lakeloreapp.com</Text>
              <Text style={[text.labelS, { color: colors.walleye2 }]} accessibilityElementsHidden>↗</Text>
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL('https://www.lakeloreapp.com/privacy')}
              accessibilityRole="link"
              accessibilityLabel="Privacy policy"
              accessibilityHint="Opens in browser"
              style={styles.linkRow}
            >
              <Text style={[text.bodyM, { color: colors.ink }]}>Privacy policy</Text>
              <Text style={[text.labelS, { color: colors.walleye2 }]} accessibilityElementsHidden>↗</Text>
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL('https://www.lakeloreapp.com/terms')}
              accessibilityRole="link"
              accessibilityLabel="Terms of use"
              accessibilityHint="Opens in browser"
              style={styles.linkRow}
            >
              <Text style={[text.bodyM, { color: colors.ink }]}>Terms of use</Text>
              <Text style={[text.labelS, { color: colors.walleye2 }]} accessibilityElementsHidden>↗</Text>
            </Pressable>
            <Pressable
              onPress={openManageSubscription}
              accessibilityRole="button"
              accessibilityLabel="Manage subscription"
              accessibilityHint="Opens subscription management"
              style={styles.linkRow}
            >
              <Text style={[text.bodyM, { color: colors.ink }]}>Manage subscription</Text>
              <Text style={[text.labelS, { color: colors.walleye2 }]} accessibilityElementsHidden>↗</Text>
            </Pressable>
            <Pressable
              onPress={handleRestore}
              accessibilityRole="button"
              accessibilityLabel={restoring ? 'Restoring' : 'Restore purchases'}
              style={styles.linkRow}>
              <Text style={[text.bodyM, { color: colors.ink }]}>
                {restoring ? 'Restoring…' : 'Restore purchases'}
              </Text>
              <Text style={[text.labelS, { color: colors.walleye2 }]} accessibilityElementsHidden>›</Text>
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL('mailto:support@lakeloreapp.com')}
              accessibilityRole="link"
              accessibilityLabel="Email support"
              accessibilityHint="Opens email client"
              style={styles.linkRow}
            >
              <Text style={[text.bodyM, { color: colors.ink }]}>support@lakeloreapp.com</Text>
              <Text style={[text.labelS, { color: colors.walleye2 }]} accessibilityElementsHidden>↗</Text>
            </Pressable>
          </View>

          <Text style={[text.labelS, { color: colors.paper3, textAlign: 'center', marginTop: 32 }]}>
            © {new Date().getFullYear()} LAKELORE CO.
          </Text>
          <Text
            style={[text.labelS, { color: colors.paper3, textAlign: 'center', marginTop: 6 }]}
            accessibilityLabel={`App version ${APP_VERSION}`}
          >
            v{APP_VERSION}{OTA_UPDATE_ID ? ` · ${OTA_UPDATE_ID.slice(0, 8)}` : ''}
          </Text>

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: 40 },

  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.walleye },

  subscriberPill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: hairline,
    borderColor: colors.moss,
    backgroundColor: colors.paper2,
  },

  callout: {
    marginTop: 24,
    padding: space.lg,
    borderWidth: hairline,
    borderColor: colors.ink,
    backgroundColor: colors.paper2,
  },

  sectionHeader: {
    marginTop: 28,
    paddingTop: 14,
    borderTopWidth: hairline,
    borderTopColor: colors.paper3,
  },

  agencyRow: {
    paddingVertical: 14,
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },

  glossaryItem: {
    marginTop: 18,
    paddingBottom: 4,
  },
  agencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },

  linkList: {
    marginTop: 8,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },
});
