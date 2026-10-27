// Consolidated gear labels (lakelore-data GEAR_CONSOLIDATION.md, 2026-10-27)
// carry their unit as "(#/<unit>)"; the row label must follow it.
import { cpueLabelForGear } from '../components/ResultRow';

describe('cpueLabelForGear on consolidated gear labels', () => {
  it.each([
    ['nd', 'Gill net (#/net-night, 80-ft standard)', 'Catch / Net'],
    ['sd', 'SD standard gill net, to 2017 (#/net-night)', 'Catch / Net'],
    ['sd', 'Night boat electrofishing (#/hour)', 'Catch / Hour'],
    ['sd', 'Small seine, all fish (#/haul)', 'Catch / Haul'],
    ['wi', 'Spring electrofishing (#/mile)', 'Catch / Mile'],
    ['wi', 'Fyke net (#/net-night)', 'Catch / Net'],
  ] as const)('%s %s -> %s', (st, gear, label) => {
    expect(cpueLabelForGear(st as never, gear, 'gear')).toBe(label);
  });
});
