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
    ['la', 'LDWF MP: gill net (fish/100 net-night)', 'Catch / 100 Nets'],
    ['la', 'LDWF MP: gill net (fish/100ft net-night)', 'Catch / 100 ft Net'],
    ['la', 'LDWF MP: gill net (number/100ft/net-night)', 'Catch / 100 ft Net'],
    ['la', 'LDWF MP: gill net (pounds/100ft net-night)', 'Lbs / 100 ft Net'],
  ] as const)('%s %s -> %s', (st, gear, label) => {
    expect(cpueLabelForGear(st as never, gear, 'gear')).toBe(label);
  });
});
