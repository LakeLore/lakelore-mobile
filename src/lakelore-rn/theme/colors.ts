// theme/colors.ts
// LakeLore palette — paper-and-ink field-guide system.
// Use named tokens, never hex codes, in screen code.

export const colors = {
  // surfaces
  paper:    '#f4efe4',  // primary background — warm cream
  paper2:   '#ebe4d3',  // pressed/elevated surface, alt rows
  paper3:   '#ded4bd',  // hairline borders, dividers, "no data" dots

  // ink
  ink:      '#1a1f2a',  // primary text + dark headers
  ink2:     '#3a3f4a',  // secondary text
  inkSoft:  '#6a6558',  // tertiary text, mono labels

  // brand accents
  walleye:  '#c89a3c',  // active state, primary CTA highlights
  walleye2: '#a67d25',  // small-caps labels, walleye-gold text on paper
  flash:    '#e8bc5a',  // bar fills, lighter gold

  // species + chart palette
  lake3:    '#4a6a7a',  // muted blue — generic species, scatter dots
  lakeInk:  '#1d2f3d',  // deep navy — South Dakota stripe
  moss:     '#6a7a4a',  // electrofishing series, Iowa stripe
  rust:     '#a85a3a',  // gill nets, North Dakota stripe, errors

  // semantic
  destructive: '#a85a3a',  // = rust. Cancel/Reset/Clear text.
} as const;

export type ColorName = keyof typeof colors;
