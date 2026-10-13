export const GUIDE_SLUGS = [
  'risk-equivalent-age-vs-biological-age',
  'how-to-read-associations',
  'limits-of-biological-age-calculators',
] as const;
export type GuideSlug = (typeof GUIDE_SLUGS)[number];
