// src/screens/AboutScreen.tsx — modal "About / Sources" page.
//
// Surfaces credit and attribution for every state agency whose data
// LakeLore aggregates, and an explicit independence statement. Apple's
// App Review occasionally asks "what is your relationship to these
// agencies?" — having a dedicated, prominent screen that answers that
// question is the cleanest defense.

import React from 'react';
import {
  Modal, View, Text, ScrollView, Pressable, StyleSheet, SafeAreaView, Linking,
} from 'react-native';
import { colors, text, space, hairline } from '../lakelore-rn/theme';
import { PaperHeader } from '../lakelore-rn/components';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface AgencySource {
  state: string;
  agency: string;
  abbr: string;
  url: string;
  blurb: string;
}

const AGENCIES: AgencySource[] = [
  {
    state: 'Minnesota',
    agency: 'Minnesota Department of Natural Resources',
    abbr: 'MN DNR',
    url: 'https://www.dnr.state.mn.us/lakefind/',
    blurb: 'Standardized netting and electrofishing surveys, plus stocking records, published through MN DNR LakeFinder.',
  },
  {
    state: 'Wisconsin',
    agency: 'Wisconsin Department of Natural Resources',
    abbr: 'WI DNR',
    url: 'https://dnr.wi.gov/lakes/',
    blurb: 'Treaty-area netting and electrofishing surveys with length and weight measurements, published through the WI DNR Lake Pages.',
  },
  {
    state: 'Michigan',
    agency: 'Michigan Department of Natural Resources',
    abbr: 'MI DNR',
    url: 'https://www.michigan.gov/dnr/things-to-do/fishing',
    blurb: 'Inland-lake survey reports and fish stocking records published in the MI DNR Status of Fishery Resource Reports.',
  },
  {
    state: 'North Dakota',
    agency: 'North Dakota Game and Fish Department',
    abbr: 'ND Game & Fish',
    url: 'https://gf.nd.gov/fishing',
    blurb: 'Standardized gill-net surveys and stocking records published through the ND Game and Fish public ArcGIS portal.',
  },
  {
    state: 'South Dakota',
    agency: 'South Dakota Game, Fish and Parks',
    abbr: 'SD GFP',
    url: 'https://gfp.sd.gov/fishing-reports/',
    blurb: 'Annual fisheries survey reports with PSD, Wr, and CPUE statistics, published as PDFs through the SD GFP report portal.',
  },
  {
    state: 'Nebraska',
    agency: 'Nebraska Game and Parks Commission',
    abbr: 'NE Game & Parks',
    url: 'https://outdoornebraska.gov/fishing/',
    blurb: 'Standardized netting surveys and stocking records, published as agency PDFs.',
  },
  {
    state: 'Iowa',
    agency: 'Iowa Department of Natural Resources',
    abbr: 'IA DNR',
    url: 'https://www.iowadnr.gov/Things-to-Do/Fishing',
    blurb: 'Comprehensive lake surveys (electrofishing, fyke, hoop) published through the Iowa DNR Fisheries Data Dashboard.',
  },
];

export default function AboutScreen({ visible, onClose }: Props) {
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

          <Text style={[text.displayM, { color: colors.ink, marginTop: 8 }]}>
            Public records,{' '}
            <Text style={{ fontStyle: 'italic' }}>quietly assembled.</Text>
          </Text>

          <Text style={[text.bodyL, { color: colors.ink2, marginTop: 16 }]}>
            LakeLore is an independent project that gathers fish-population data from
            seven U.S. state fish &amp; wildlife agencies, normalizes their assessment
            methods, and renders the result as a single field guide.
          </Text>

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

          <View style={styles.sectionHeader}>
            <Text style={[text.labelL, { color: colors.inkSoft }]}>DATA SOURCES</Text>
          </View>

          {AGENCIES.map(a => (
            <Pressable
              key={a.abbr}
              onPress={() => Linking.openURL(a.url)}
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
            </Pressable>
          ))}

          <View style={styles.sectionHeader}>
            <Text style={[text.labelL, { color: colors.inkSoft }]}>NOTES ON THE DATA</Text>
          </View>

          <Text style={[text.bodyM, { color: colors.ink2, marginTop: 8 }]}>
            <Text style={{ fontWeight: '600', color: colors.ink }}>Survey methods vary by agency.</Text>{' '}
            Each state runs its own protocol — gill-net mesh sizes, electrofishing
            voltage, fyke / hoop net configurations, and seasonal timing differ. The
            CPUE numbers between states are roughly comparable but not interchangeable.
          </Text>

          <Text style={[text.bodyM, { color: colors.ink2, marginTop: 12 }]}>
            <Text style={{ fontWeight: '600', color: colors.ink }}>The estimated &ldquo;adults per 100 acres&rdquo; metric</Text>{' '}
            comes from a survival model applied to stocking records — not from observed
            catches. It assumes a constant survival rate per life stage and does not
            model natural reproduction or density-dependent mortality. Treat it as a
            rough indicator, not a fish count.
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
              onPress={() => Linking.openURL('https://lakeloreapp.com')}
              style={styles.linkRow}
            >
              <Text style={[text.bodyM, { color: colors.ink }]}>lakeloreapp.com</Text>
              <Text style={[text.labelS, { color: colors.walleye2 }]}>↗</Text>
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL('https://lakeloreapp.com/privacy')}
              style={styles.linkRow}
            >
              <Text style={[text.bodyM, { color: colors.ink }]}>Privacy policy</Text>
              <Text style={[text.labelS, { color: colors.walleye2 }]}>↗</Text>
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL('https://lakeloreapp.com/terms')}
              style={styles.linkRow}
            >
              <Text style={[text.bodyM, { color: colors.ink }]}>Terms of use</Text>
              <Text style={[text.labelS, { color: colors.walleye2 }]}>↗</Text>
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL('mailto:support@lakeloreapp.com')}
              style={styles.linkRow}
            >
              <Text style={[text.bodyM, { color: colors.ink }]}>support@lakeloreapp.com</Text>
              <Text style={[text.labelS, { color: colors.walleye2 }]}>↗</Text>
            </Pressable>
          </View>

          <Text style={[text.labelS, { color: colors.paper3, textAlign: 'center', marginTop: 32 }]}>
            © {new Date().getFullYear()} LAKELORE CO.
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
