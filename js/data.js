// The simulated run: a coding agent adds a pricing page to "Lumen", a made-up app.
// Any field may be a function of the run state; it is resolved when the event plays,
// so the same script follows whatever the designer chose.

export const TASK = {
  title: 'Add a pricing page',
  brief:
    'Add a pricing page with Free, Pro and Team plans and a switch between monthly and yearly billing. It should match the rest of the app.',
  app: 'Lumen',
};

export const RECEIPT = { model: 'Frontier model', effort: 'High effort', pricePerK: 0.015 };

export const TOGGLE_NAME = { new: 'BillingSwitch', segmented: 'SegmentedControl', switch: 'Toggle' };
export const SAVINGS = { months: '2 months free', percent: 'Save 17%', none: null };

export const INITIAL_PAGE = {
  cards: false,
  copy: false,
  toggle: 'none',
  yearly: false,
  format: 'raw',
  badge: null,
  mobileFix: false,
};

export const SCRIPT = [
  { id: 's1', type: 'status', text: 'Reading your brief', tokens: 400 },
  {
    id: 'k1', type: 'think', kind: 'plan', tokens: 1800,
    text: 'Three plans and a monthly or yearly switch. Plan: see what the app already has, lay out the cards, add the switch, wire up the prices, then test.',
  },
  {
    id: 'n1', type: 'say', from: 'k1', tokens: 300,
    text: "I'll start by looking at what your app already has, so the page matches it.",
    short: 'Checking what the app already has.',
  },
  {
    id: 'a1', type: 'tool', tool: 'Read', from: 'k1', touches: ['cards', 'price'], dur: 0.8, tokens: 900,
    plain: 'Read the pricing brief', cmd: 'cat docs/briefs/pricing.md',
    out: 'Plans: Free $0 · Pro $15/mo · Team $29/mo\nYearly billing: ten months for the price of twelve\nMust match the rest of the app',
    result: 'Three plans; a year costs ten months',
  },
  {
    id: 'a2', type: 'tool', tool: 'Search', from: 'k1', touches: ['toggle'], dur: 0.7, tokens: 600,
    plain: 'Searched your components for the word "Toggle"', cmd: 'rg -l "Toggle" src/components',
    out: 'src/components/ui/Toggle.tsx',
    result: 'One match: Toggle',
  },
  {
    id: 'a3', type: 'tool', tool: 'Read', from: 'k1', touches: ['toggle'], dur: 0.6, tokens: 700,
    plain: 'Opened Toggle to see how it works', cmd: 'sed -n 1,12p src/components/ui/Toggle.tsx',
    out: '// On/off switch, used on Settings › Notifications\nexport function Toggle({ checked, onChange, label }) {\n  …',
    result: 'An on/off switch with a single label',
  },
  {
    id: 'k2', type: 'think', kind: 'observation', tokens: 1400,
    text: 'Toggle only knows on and off, with one label. Pricing needs two named options side by side.',
  },
  {
    id: 'k3', type: 'think', kind: 'decision', decisionOf: 'n2', tokens: 1100,
    text: 'Build a new BillingSwitch with Monthly and Yearly labels rather than bending Toggle to fit.',
  },
  {
    id: 'n2', type: 'say', from: 'k3', touches: ['toggle'], tokens: 300,
    text: "Your Toggle is an on/off switch, so I'll build a new BillingSwitch with Monthly and Yearly labels.",
    short: 'Building a new BillingSwitch.',
    more: 'I searched the components for "Toggle" and found only the on/off one.',
    decision: {
      key: 'toggle',
      made: 'Build a new BillingSwitch',
      options: [
        { id: 'segmented', label: 'Reuse our SegmentedControl', detail: 'The one on Settings › Appearance' },
        { id: 'switch', label: 'Use the on/off Toggle', detail: 'Labelled "Bill yearly"' },
      ],
    },
  },
  { id: 's2', type: 'status', text: 'Laying out the plan cards', tokens: 200 },
  {
    id: 'n3', type: 'say', tokens: 250,
    text: "I'll hand the plan descriptions to a copy helper while I build the layout.",
    short: 'A helper is writing the copy.',
  },
  {
    id: 'g1', type: 'subagent', name: 'Copy helper', touches: ['copy'], dur: 2.2, tokens: 5200,
    task: 'Write one line for each plan: Free, Pro and Team',
    summary: 'Wrote three plan descriptions in your brand voice',
    steps: [
      {
        type: 'tool', tool: 'Read', plain: 'Read the brand voice guide', cmd: 'cat docs/brand-voice.md',
        out: 'Plain and warm. Say what people can do. No exclamation marks.', result: 'Plain, warm, no exclamation marks',
      },
      { type: 'think', kind: 'plan', text: 'Lead with what each plan lets someone do, not a feature list.' },
      {
        type: 'tool', tool: 'Write', plain: 'Wrote the three descriptions', cmd: 'write src/pages/pricing-copy.json',
        out: '{ "free": "For trying Lumen on your own.",\n  "pro": "For people who ship every week.",\n  "team": "For teams who review together." }',
        result: 'Three lines written',
      },
    ],
  },
  {
    id: 'a4', type: 'tool', tool: 'Write', from: 'k1', touches: ['cards', 'copy', 'price'], dur: 1.2, tokens: 3600,
    plain: 'Created the pricing page with three plan cards', cmd: 'write src/pages/Pricing.tsx  (+58 lines)',
    out: '+ export default function Pricing() {\n+   const plans = usePlans();\n+   return <section className="plans">{plans.map(p => <PlanCard {...p} />)}</section>\n+ }',
    result: 'Page created',
  },
  { id: 'v1', type: 'artifact', label: 'Three plan cards, monthly prices', touches: ['cards'], patch: { cards: true, copy: true }, tokens: 100 },
  { id: 's3', type: 'status', text: s => (s.toggle === 'new' ? 'Building the billing switch' : 'Adding the billing switch'), tokens: 200 },
  {
    id: 'a5', type: 'tool', tool: 'Write', if: s => s.toggle === 'new', assumes: 'toggle', from: 'k3', touches: ['toggle'], dur: 1.0, tokens: 2400,
    plain: 'Created a new BillingSwitch component', cmd: 'write src/components/BillingSwitch.tsx  (+31 lines)',
    out: '+ export function BillingSwitch({ value, onChange }) {\n+   return <button className="pill" aria-pressed={value === "yearly"}>…</button>\n+ }',
    result: 'New component created',
    effect: s => { s.flags.billingWritten = true; },
  },
  {
    id: 'v2', type: 'artifact', label: s => `${TOGGLE_NAME[s.toggle]} added`, assumes: 'toggle', touches: ['toggle'],
    patch: s => ({ toggle: s.toggle }), tokens: 100,
  },
  {
    id: 'k4', type: 'think', kind: 'observation', tokens: 1600,
    text: 'A year costs ten months of the monthly price, shown per month: 150 ÷ 12 for Pro and 290 ÷ 12 for Team.',
  },
  {
    id: 'a6', type: 'tool', tool: 'Edit', from: 'k4', touches: ['price'], dur: 0.9, tokens: 1900,
    plain: 'Made the prices change when the switch flips', cmd: 'edit src/pages/Pricing.tsx  (+9 −2)',
    out: '+ const perMonth = cycle === "yearly" ? (plan.monthly * 10) / 12 : plan.monthly;\n+ <Price value={"$" + perMonth} />',
    result: 'Prices now follow the switch',
  },
  { id: 'v3', type: 'artifact', label: 'Yearly prices wired up', touches: ['price'], patch: { yearly: true }, tokens: 100 },
  {
    id: 'k5', type: 'think', kind: 'observation', tokens: 900,
    text: 'The brief doesn\'t say how to show the yearly saving. "2 months free" and "Save 17%" are both common, and it\'s a brand call.',
  },
  {
    id: 'q1', type: 'question', key: 'savings', from: 'k5', touches: ['badge'], tokens: 200,
    text: 'How should the yearly saving read?',
    why: "The brief doesn't say, and it's a brand decision rather than a technical one.",
    options: [
      { id: 'months', label: '2 months free' },
      { id: 'percent', label: 'Save 17%' },
      { id: 'none', label: "Don't show it" },
    ],
  },
  {
    id: 'a7', type: 'tool', tool: 'Edit', if: s => s.savings !== 'none', from: 'q1', touches: ['badge'], dur: 0.6, tokens: 900,
    plain: s => `Added a "${SAVINGS[s.savings]}" badge next to Yearly`, cmd: 'edit src/pages/Pricing.tsx  (+4)',
    out: s => `+ <Badge tone="accent">${SAVINGS[s.savings]}</Badge>`,
    result: 'Badge added',
  },
  { id: 'v4', type: 'artifact', if: s => s.savings !== 'none', label: 'Savings badge', touches: ['badge'], patch: s => ({ badge: s.savings }), tokens: 100 },
  { id: 's4', type: 'status', text: 'Running the tests', tokens: 150 },
  {
    id: 'a8', type: 'tool', tool: 'Bash', check: true, ok: false, from: 'k1', touches: ['price'], dur: 2.0, tokens: 1500,
    plain: 'Ran the tests', cmd: 'npm test -- pricing',
    out: '✓ shows three plans\n✓ monthly prices\n✓ switch changes billing\n✓ …3 more\n✕ Pro yearly shows $12.50  (received "$12.5")\n✕ Team yearly shows $24.17  (received "$24.166666666666668")\n\n6 passed, 2 failed',
    result: "2 of 8 tests failed: yearly prices aren't rounded to cents",
    effect: s => { s.flags.testsRan = true; },
  },
  {
    id: 'k6', type: 'think', kind: 'self-correction', tokens: 1300,
    text: 'I divided the prices but never formatted them. Money needs two decimals, so $12.5 should read $12.50.',
  },
  {
    id: 'a9', type: 'tool', tool: 'Edit', from: 'k6', touches: ['price'], dur: 0.7, tokens: 1100,
    plain: 'Rounded prices to cents', cmd: 'edit src/pages/Pricing.tsx  (+3 −1)',
    out: '+ const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });\n+ <Price value={money.format(perMonth)} />',
    result: 'Prices now show cents',
  },
  { id: 'v5', type: 'artifact', label: 'Prices rounded to cents', touches: ['price'], patch: { format: 'fixed' }, tokens: 100 },
  {
    id: 'a10', type: 'tool', tool: 'Bash', check: true, ok: true, from: 'k6', touches: ['price', 'toggle'], dur: 1.8, tokens: 1200,
    plain: 'Ran the tests again', cmd: 'npm test -- pricing',
    out: '✓ shows three plans\n✓ monthly prices\n✓ switch changes billing\n✓ Pro yearly shows $12.50\n✓ Team yearly shows $24.17\n✓ …3 more\n\n8 passed',
    result: 'All 8 tests passed',
  },
  {
    id: 'a11', type: 'tool', tool: 'Screenshot', check: true, ok: true, from: 'k1', touches: ['cards'], dur: 1.2, tokens: 900,
    plain: 'Took a screenshot at desktop width', cmd: 'screenshot /pricing --width 1440',
    out: 'Saved pricing-1440.png · cards aligned · 0 console errors',
    result: 'Looks right at 1440 pixels wide',
  },
  {
    id: 'n4', type: 'say', touches: ['price', 'toggle'], tokens: 300,
    text: 'All 8 tests pass, and the switch moves every price between monthly and yearly.',
    short: 'Tests pass.',
    claims: [
      { id: 'c1', text: 'All 8 tests pass', checkedBy: ['a10'] },
      { id: 'c2', text: 'The switch moves every price between monthly and yearly', checkedBy: ['a10'] },
    ],
  },
  {
    id: 'n5', type: 'say', touches: ['cards'], tokens: 200,
    text: 'It looks right on mobile too.',
    short: 'Mobile looks right.',
    claims: [{ id: 'c3', text: 'It looks right on mobile', checkedBy: [], nearMiss: 'a11', fix: 'mobile' }],
  },
  { id: 's5', type: 'status', text: 'Done: the pricing page is ready', tokens: 100 },
];

// Inserted when the designer rejects the switch decision.
export function toggleSegment(s, choice) {
  const name = TOGGLE_NAME[choice];
  const removing = s.flags.billingWritten;
  return [
    {
      type: 'say', touches: ['toggle'], tokens: 300,
      text: `Got it. I'll use your ${name}${choice === 'switch' ? ', labelled "Bill yearly"' : ''}${removing ? ' and remove BillingSwitch' : ''}.`,
      short: `Switching to ${name}.`,
    },
    {
      type: 'think', kind: 'self-correction', tokens: 1200,
      text:
        choice === 'segmented'
          ? 'I only searched for the word "Toggle", so I missed SegmentedControl. Next time, search for what a component does, not what it is called.'
          : 'An on/off switch labelled "Bill yearly" is a common pricing pattern. I ruled it out too quickly.',
    },
    choice === 'segmented' && {
      type: 'tool', tool: 'Search', touches: ['toggle'], dur: 0.6, tokens: 500,
      plain: 'Found SegmentedControl in your components', cmd: 'rg -l "SegmentedControl" src',
      out: 'src/components/ui/SegmentedControl.tsx\nsrc/pages/settings/Appearance.tsx',
      result: 'Used on Settings › Appearance',
    },
    removing && {
      type: 'tool', tool: 'Bash', touches: ['toggle'], dur: 0.4, tokens: 300,
      plain: 'Deleted BillingSwitch', cmd: 'rm src/components/BillingSwitch.tsx', out: '', result: 'Removed',
      effect: st => { st.flags.billingWritten = false; },
    },
    {
      type: 'tool', tool: 'Edit', touches: ['toggle'], dur: 0.8, tokens: 1200,
      plain: `Put ${name} on the pricing page`, cmd: 'edit src/pages/Pricing.tsx  (+3 −3)',
      out:
        choice === 'segmented'
          ? '+ <SegmentedControl options={["Monthly", "Yearly"]} value={cycle} onChange={setCycle} />'
          : '+ <Toggle label="Bill yearly" checked={cycle === "yearly"} onChange={flipCycle} />',
      result: 'Switch replaced',
    },
    s.page.toggle !== 'none' && {
      type: 'artifact', label: `Switch replaced with ${name}`, touches: ['toggle'], patch: { toggle: choice }, tokens: 100,
    },
    s.flags.testsRan && {
      type: 'tool', tool: 'Bash', check: true, ok: true, touches: ['toggle', 'price'], dur: 1.6, tokens: 1000,
      plain: 'Ran the tests again', cmd: 'npm test -- pricing', out: '✓ …8 tests\n\n8 passed', result: 'All 8 tests passed',
    },
  ].filter(Boolean);
}

// Inserted when the designer asks the agent to check its unchecked mobile claim.
export function mobileSegment() {
  return [
    {
      type: 'say', touches: ['cards'], tokens: 250,
      text: "Fair question. I hadn't actually looked at a phone-sized screen.",
      short: 'Checking mobile.',
    },
    { type: 'status', text: 'Checking a phone-sized screen', tokens: 100 },
    {
      id: 'm1', type: 'tool', tool: 'Screenshot', check: true, ok: false, touches: ['cards'], dur: 1.2, tokens: 900,
      plain: 'Took a screenshot at phone width', cmd: 'screenshot /pricing --width 390',
      out: 'Saved pricing-390.png\n✕ page is 790px wide on a 390px screen\n✕ Team card is cut off',
      result: "Failed: the cards don't fit and the Team card is cut off",
    },
    {
      type: 'think', kind: 'self-correction', tokens: 1200,
      text: 'I said mobile looked right without looking. The three cards keep their desktop widths, so the row is wider than a phone.',
    },
    {
      type: 'tool', tool: 'Edit', touches: ['cards'], dur: 0.8, tokens: 900,
      plain: 'Stacked the cards on narrow screens', cmd: 'edit src/pages/pricing.css  (+5)',
      out: '+ @container (max-width: 640px) {\n+   .plans { grid-template-columns: 1fr; }\n+ }',
      result: 'Cards stack below 640 pixels',
    },
    { type: 'artifact', label: 'Cards stack on phones', touches: ['cards'], patch: { mobileFix: true }, tokens: 100 },
    {
      id: 'm2', type: 'tool', tool: 'Screenshot', check: true, ok: true, touches: ['cards'], dur: 1.1, tokens: 800,
      plain: 'Took another screenshot at phone width', cmd: 'screenshot /pricing --width 390',
      out: 'Saved pricing-390.png · 390px wide · nothing cut off', result: 'Fits: the cards stack and nothing is cut off',
    },
    {
      type: 'say', touches: ['cards'], tokens: 250,
      text: 'Checked at phone width this time: the cards stack and nothing is cut off.',
      short: 'Mobile checked.',
      resolves: { claim: 'c3', checkedBy: ['m1', 'm2'] },
    },
  ];
}
