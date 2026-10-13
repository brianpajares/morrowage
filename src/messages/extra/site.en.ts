import type { Shape } from '../util';
import type { siteEs } from './site.es';

export const siteEn: Shape<typeof siteEs> = {
  meta: {
    siteName: 'MorrowAge',
    title: 'MorrowAge · Your risk-equivalent age, with context',
    description:
      'Turn 8 everyday inputs into a population-based risk-equivalent age in under 90 seconds. Deterministic calculation, visible sources and explicit limits. Not biological age or a diagnosis.',
    ogAlt: 'MorrowAge: a risk-equivalent age with context',
  },
  nav: {
    home: 'MorrowAge, home',
    primary: 'Main navigation',
    howItWorks: 'How it works',
    methodology: 'Methodology',
    faq: 'FAQ',
    menu: 'Menu',
    start: 'Calculate',
  },
  a11y: {
    skipToContent: 'Skip to content',
    language: 'Language',
    theme: 'Color theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    opensInNewTab: 'opens in a new tab',
    loading: 'Loading',
    close: 'Close',
    required: 'required',
  },
  footer: {
    tagline: 'An educational estimate based on population data.',
    notMedical: 'Educational population-based estimate · Not medical advice.',
    legal: 'Legal',
    privacy: 'Privacy',
    terms: 'Terms',
    deleteData: 'Delete my data',
    methodology: 'Methodology',
    guides: 'Guides',
    copyright: '© {year} MorrowAge. Working name; trademark availability under review.',
    version: 'Model v{model} · App v{app}',
  },
  landing: {
    demoLabel: 'Illustrative example · synthetic data',
    demoCaption: 'Comparison between chronological age and risk-equivalent age (example).',
    demoChrono: 'Chronological',
    demoMorrow: 'Risk-equivalent',
    howLink: 'How it works',
    stepsTitle: 'What MorrowAge does',
    steps: [
      {
        title: '8 everyday inputs',
        body: 'Age, sleep, self-rated health, cigarettes, reaction time, waist/height, alcohol and resting heart rate. No lab work.',
      },
      {
        title: 'Deterministic calculation',
        body: 'Published coefficients from a survival model. The number comes from a reproducible formula, not from an LLM.',
      },
      {
        title: 'Context, not just a number',
        body: 'A risk-equivalent age against a benchmark from the same model, with sources, assumptions and limits in plain sight.',
      },
    ],
    inputsTitle: 'The 8 inputs we use',
    inputsBody: 'We don’t ask for your name, date of birth or address to calculate.',
    deliverTitle: 'What you get',
    freeTitle: 'Free preview',
    freeItems: [
      'Your MorrowAge (risk-equivalent age) next to your chronological age',
      'Relative hazard versus the benchmark, as a technical detail',
      'The association that moved your result the most',
    ],
    fullTitle: 'Full report',
    fullBadge: 'Free in this phase',
    fullItems: [
      'Measurement sensitivity (not a confidence interval)',
      'Every association, ranked by weight',
      'Educational scenarios you can explore',
      'Methodology, assumptions and sources · downloadable PDF',
    ],
    notTitle: 'What MorrowAge is not',
    notItems: [
      'It is not your biological age and does not measure the age of your organs.',
      'It is not a diagnosis or medical advice.',
      'It does not predict how long you will live or compute a probability of death.',
      'It does not use an LLM to generate the number: it is a public, reproducible formula.',
    ],
    methodTitle: 'Methodology in plain sight',
    methodBody:
      'We use the published coefficients of the “raw-input” Cox model by Clift et al. (2021), built on UK Biobank data. Your result compares your profile with a benchmark from the same model. It is designed for adults aged 40 to 69.',
    finalTitle: 'Ready in under 90 seconds',
    finalBody: 'Range of use: ages 40–69. Educational estimate; it does not replace medical care.',
  },
  howItWorks: {
    metaTitle: 'How MorrowAge works',
    metaDescription:
      'From eight inputs to a risk-equivalent age: the formula, the benchmark and what the result means. No LLM for the number.',
    title: 'How it works',
    lede: 'MorrowAge turns eight simple inputs into a population-based risk-equivalent age using published coefficients. Here is the whole path, no black boxes.',
    s1Title: '1 · Eight inputs',
    s1Body:
      'Age, hours of sleep, self-rated health, cigarettes per day, reaction time, waist-to-height ratio, weekly alcohol (in UK units) and resting heart rate.',
    s2Title: '2 · A linear predictor',
    s2Body:
      'Each input is compared with a reference profile (benchmark) from the same model. The difference, weighted by the model’s coefficients, forms the non-age linear predictor.',
    s3Title: '3 · Risk-equivalent age',
    s3Body:
      'The model’s age term is inverted: at what age would the reference profile have the same relative risk as you? That age is your MorrowAge.',
    formulaTitle: 'The formula',
    formulaNote:
      'LP_nonage is the sum of coefficient × value for the seven non-age inputs; LP_benchmark is the same sum for the reference profile; β_log_age is the coefficient on the logarithm of age in the published model.',
    meansTitle: 'What it means',
    means:
      'If your MorrowAge is 47 and your age is 52, your combination of inputs has a risk predictor similar to that of a younger reference profile within this model.',
    notMeansTitle: 'What it does not mean',
    notMeans:
      'It does not mean your organs are 47 years old, or that you will live a specific number of years more or less.',
    limitsTitle: 'Limits you will always see',
    limits: [
      'Outside 40–69 we show “<40” or “>69”, never an exact figure: the model was built on people aged 40 to 69.',
      '“Measurement sensitivity” shows how the result changes if some measurements vary; it is not a confidence interval.',
      'We do not show absolute 10-year risk or country percentiles: verified calibration data is missing.',
      'The variables are population associations, not proof of causation.',
    ],
    cta: 'Calculate my MorrowAge',
    methodLink: 'See the full methodology',
  },
  faq: {
    metaTitle: 'FAQ · MorrowAge',
    metaDescription:
      'Is it biological age? Does it predict how long I will live? What do <40 or >69 mean? Clear answers about scope, limits and data.',
    title: 'Frequently asked questions',
    lede: 'Short answers to the most common questions. For technical detail, visit the methodology.',
    items: [
      {
        q: 'Is this my biological age?',
        a: 'No. MorrowAge is a population-based risk-equivalent age: it compares your profile with a benchmark from the same model. It does not measure the age of your organs and uses no lab or epigenetic tests.',
      },
      {
        q: 'Does it predict how long I will live?',
        a: 'No. It is an educational estimate based on associations in a large cohort, not an individual prediction of lifespan or a probability of death.',
      },
      {
        q: 'Why don’t I see a 10-year mortality risk?',
        a: 'To turn a Cox model into an absolute probability you need, besides the coefficients, a verified baseline survival curve. The source we use does not publish it in a reconstructable form and we do not make it up. It will only be enabled after proper recalibration and validation.',
      },
      {
        q: 'What do “<40” and “>69” mean?',
        a: 'The mathematical transformation can produce an equivalent age outside the 40–69 range of the source cohort. To avoid implying precision that does not exist, we show “<40” or “>69” instead of an exact figure.',
      },
      {
        q: 'Is “measurement sensitivity” a confidence interval?',
        a: 'No. It shows how the result would change if some measurements varied within reasonable ranges (always within the model’s limits). It is a measurement scenario, not a statistical interval.',
      },
      {
        q: 'What happens to my data?',
        a: 'We ask only for what is needed: the eight inputs to calculate and your email if you want the report. Marketing consent is optional and separate. Analytics and the admin dashboard do not receive your health data. You can request deletion at any time.',
      },
      {
        q: 'Why can an input “worsen” the result in a counterintuitive way?',
        a: 'Because the model captures population associations, not causes. Some coefficients can look counterintuitive because of confounding or non-linear relationships, which is why we never turn the sign of a coefficient into advice.',
      },
      {
        q: 'Why only ages 40 to 69?',
        a: 'It is the age range of the cohort the model was estimated on. We do not extrapolate outside it.',
      },
      {
        q: 'How much does it cost?',
        a: 'In this validation phase, the preview and the full report are free. If that changes, you will see it before providing any payment details.',
      },
      {
        q: 'How do I delete my data?',
        a: 'From the “Delete my data” page you can submit a request. We resolve it according to applicable legal and retention obligations.',
      },
    ],
    stillQuestions: 'Want to see exactly how it is calculated?',
    methodLink: 'Go to the methodology',
  },
  notFound: {
    title: 'We couldn’t find that page',
    body: 'The address may have changed or the link may have expired.',
    home: 'Back to home',
  },
  common: {
    loading: 'Loading…',
    retry: 'Try again',
    close: 'Close',
    yes: 'Yes',
    no: 'No',
    optional: 'optional',
    learnMore: 'Learn more',
    backHome: 'Back to home',
    sources: 'Sources',
  },
  variables: {
    age_years: { label: 'Age', driver: 'your age', unit: 'years' },
    sleep_hours: { label: 'Hours of sleep', driver: 'your hours of sleep', unit: 'h/night' },
    self_rated_health: { label: 'Self-rated health', driver: 'your self-rated health', unit: '' },
    cigarettes_per_day: {
      label: 'Cigarettes per day',
      driver: 'the cigarettes you smoke per day',
      unit: 'cig/day',
    },
    reaction_time_ms: { label: 'Reaction time', driver: 'your reaction time', unit: 'ms' },
    waist_to_height_ratio: {
      label: 'Waist-to-height ratio',
      driver: 'your waist-to-height ratio',
      unit: '',
    },
    alcohol_units_week: {
      label: 'Weekly alcohol',
      driver: 'your weekly alcohol intake',
      unit: 'UK units/week',
    },
    resting_hr_bpm: { label: 'Resting heart rate', driver: 'your resting heart rate', unit: 'bpm' },
    direction: {
      higher: 'Associated with a higher estimate than the benchmark',
      lower: 'Associated with a lower estimate than the benchmark',
      neutral: 'No meaningful difference from the benchmark',
    },
    benchmarkWeighted: 'UK Biobank weighted mean',
    benchmarkNever: '0 (reference: never smoked)',
  },
};
