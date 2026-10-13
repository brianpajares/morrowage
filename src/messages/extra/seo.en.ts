import type { Shape } from '../util';
import type { seoEs } from './seo.es';

export const seoEn: Shape<typeof seoEs> = {
  calculatorPage: {
    metaTitle: 'Risk-equivalent age calculator',
    metaDescription:
      'Calculate your population-based risk-equivalent age from 8 everyday inputs in under 90 seconds. A public formula, visible sources, no lab work. Not biological age.',
    h1: 'Risk-equivalent age calculator',
    lede: 'Enter eight everyday inputs and compare your profile with a benchmark from a published model. The calculation is deterministic and the formula is public.',
    sections: [
      {
        title: 'What is a risk-equivalent age?',
        body: [
          'It is the age at which a reference profile would have, within the same model, a relative risk similar to yours. It adds context to your inputs; it does not measure the age of your organs.',
        ],
      },
      {
        title: 'What inputs do you need?',
        body: [
          'Your age (40–69), hours of sleep, how you rate your health, cigarettes per day, your reaction time (a built-in test is provided), waist and height, weekly alcohol and resting heart rate. None requires lab work.',
        ],
      },
      {
        title: 'What will you see?',
        body: [
          'A free preview with your MorrowAge and the association that weighs most in the result. In the full report: measurement sensitivity, every association, educational scenarios, methodology and a PDF.',
        ],
      },
      {
        title: 'What is it not?',
        body: [
          'It is not biological age, a diagnosis, a prediction of how long you will live or a probability of death. It is an educational estimate based on population associations.',
        ],
      },
    ],
    cta: 'Calculate my MorrowAge',
  },
  country: {
    metaTitle: 'Risk-equivalent age in {country}',
    metaDescription:
      'MorrowAge is not calibrated specifically for {country}: what that means, what we do not show and how to use the result with caution.',
    h1: 'Risk-equivalent age in {country}',
    notice: 'The model is not calibrated specifically for this country',
    paragraphs: [
      'MorrowAge uses the coefficients of the Clift et al. (2021) model, built on UK Biobank data. That cohort is not a representative sample of {country}.',
      'That is why we do not show percentiles or national comparisons for {country}, and we do not claim the result is locally calibrated. It is an educational estimate that compares your profile with the model’s own benchmark.',
      'If you are between 40 and 69 you can still calculate your MorrowAge; interpret the result with these limits in mind. Local calibration will be assessed with verified data before any national comparison is offered.',
    ],
    cta: 'Calculate my MorrowAge',
    methodLink: 'See methodology and limits',
  },
  guides: {
    metaTitle: 'Guides · MorrowAge',
    indexTitle: 'Guides',
    indexLede: 'Short texts to interpret a risk-equivalent age with good judgment.',
    readGuide: 'Read the guide',
    cta: 'Calculate my MorrowAge',
    items: {
      'risk-equivalent-age-vs-biological-age': {
        title: 'Risk-equivalent age versus biological age',
        description: 'Two ideas that get mixed up: what each one calculates, what we know and why MorrowAge avoids the term “biological”.',
        sections: [
          {
            title: 'Two different ideas',
            body: [
              '“Biological age” is usually presented as the age of your body according to biological markers (for example lab or epigenetic tests). A risk-equivalent age is something else: it translates a relative risk, calculated with a statistical model, into the age a reference profile would have with that same risk.',
            ],
          },
          {
            title: 'What MorrowAge calculates',
            body: [
              'MorrowAge combines eight everyday inputs with published coefficients from a survival model. The result compares your profile with a benchmark from the same model. It measures no biomarker.',
            ],
          },
          {
            title: 'Why we avoid the term “biological”',
            body: [
              'Because it suggests a measurement of the state of your organs that this calculation does not make. We prefer a name that says what it is: a population-based risk-equivalent age.',
            ],
          },
          {
            title: 'How to read your result',
            body: [
              'Use it as context, together with its limits: it is a population association, not a diagnosis or an individual prediction. If it raises questions about your health, discuss them with a healthcare professional.',
            ],
          },
        ],
      },
      'how-to-read-associations': {
        title: 'How to read associations: why an input can look counterintuitive',
        description: 'Association is not causation: confounding, non-linear relationships and why we never turn a coefficient’s sign into advice.',
        sections: [
          {
            title: 'Association is not causation',
            body: [
              'A statistical model describes how variables move together in a large group of people. That two things go together in the data does not mean one causes the other.',
            ],
          },
          {
            title: 'Why something can look counterintuitive',
            body: [
              'There are factors that are not in the model (confounding) and relationships that are not a straight line. A coefficient can come out with an unexpected sign without that being a recommendation.',
            ],
          },
          {
            title: 'What we do about it',
            body: [
              'We never turn the sign of a coefficient into advice (for example, we do not suggest sleeping less or drinking more). The report’s scenarios only explore reductions in inputs a person recognizes as modifiable, and they are recalculation exercises, not predictions.',
            ],
          },
        ],
      },
      'limits-of-biological-age-calculators': {
        title: 'The limits of biological age calculators',
        description: 'Calibration, source populations and apparent precision: what to ask of any age calculator.',
        sections: [
          {
            title: 'Calibration',
            body: [
              'A model can rank people well from higher to lower risk and still not be calibrated for your country. That is why we present the c-statistic as a ranking ability, not as a percentage of accuracy.',
            ],
          },
          {
            title: 'The source population',
            body: [
              'The coefficients come from a specific cohort. Before generalizing, external validation by sex, age and subgroups is needed; until it exists, it has to be said.',
            ],
          },
          {
            title: 'Apparent precision',
            body: [
              'A decimal is not precision. Outside the cohort’s range (40–69) MorrowAge shows “<40” or “>69” instead of an exact figure, and its “measurement sensitivity” is not a confidence interval.',
            ],
          },
          {
            title: 'What to ask of a calculator',
            body: [
              'That it shows its source, its formula, its limits and what it does not do. And that it does not present itself as a diagnosis.',
            ],
          },
        ],
      },
    },
  },
};
