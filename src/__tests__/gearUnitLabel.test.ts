// Consolidated gear labels (lakelore-data GEAR_CONSOLIDATION.md, 2026-10-27)
// carry their unit as "(#/<unit>)"; the row label must follow it.
import { cpueLabelForGear } from '../components/ResultRow';

describe('cpueLabelForGear on consolidated gear labels', () => {
  it.each([
    ['nd', 'Gill net (#/net-night, 80-ft equivalent)', 'Catch / Net'],
    ['sd', 'SD standard gill net, to 2017 (#/net-night)', 'Catch / Net'],
    ['sd', 'Night boat electrofishing (#/hour)', 'Catch / Hour'],
    ['sd', 'Small seine, all fish (#/haul)', 'Catch / Haul'],
    ['wi', 'Spring electrofishing (#/mile)', 'Catch / Mile'],
    ['wi', 'Fyke net (#/net-night)', 'Catch / Net'],
    // Units with a count or a minute (review 2026-10-27: these read "Catch / Hour").
    ['ca', 'Boat electrofishing (fish/min)', 'Catch / Min'],
    ['il', 'IDNR electrofishing (fish/min)', 'Catch / Min'],
    ['il', 'IDNR electrofishing (fish/30min)', 'Catch / 30 Min'],
    ['la', 'LDWF MP: gill net (fish/100ft net-night)', 'Catch / 100 ft Net'],
    ['la', 'LDWF MP: gill net (number/100ft/net-night)', 'Catch / 100 ft Net'],
    ['la', 'LDWF MP: gill net (pounds/100ft net-night)', 'Lbs / 100 ft Net'],
    ['wi', 'Gill net (#/500-ft net)', 'Catch / 500 ft Net'],
    ['wi', 'Population estimate (fish/acre)', 'Fish / Acre'],
  ] as const)('%s %s -> %s', (st, gear, label) => {
    expect(cpueLabelForGear(st as never, gear, 'gear')).toBe(label);
  });
});

// Tap-to-define follows the label's unit (final review 2026-10-27).
import { metricDefinition } from '../components/ResultRow';
describe('metricDefinition for catch-rate labels', () => {
  it.each([
    ['Catch / Hour', /per hour of electrofishing/],
    ['Catch / Min', /per minute of electrofishing/],
    ['Catch / 30 Min', /per 30 minutes of electrofishing/],
    ['Catch / Mile', /per mile of shoreline/],
    ['Catch / Net', /per net set/],
    ['Catch / 100 Nets', /per 100 net sets/],
    ['Catch / 100 ft Net', /per 100 feet of net/],
    ['Lbs / 100 ft Net', /^Pounds of fish/],
    ['Catch / Haul', /per seine haul/],
    ['Fish / Acre', /population estimate/],
    ['Index', /relative-abundance index/],
    ['Angler Rate', /creel/],
  ])('%s', (label, re) => {
    expect(metricDefinition('cpue', label)).toMatch(re);
  });
});
