import type { Shape } from '../util';
import type { legalEs } from './legal.es';

export const legalEn: Shape<typeof legalEs> = {
  privacy: {
    metaTitle: 'Privacy policy · MorrowAge',
    metaDescription:
      'What data MorrowAge processes, why, how long it is kept, who it is shared with and how to exercise your rights, including deletion.',
    title: 'Privacy policy',
    updated: 'Preliminary version subject to legal review before public launch · Last updated: {date}',
    lede: 'We ask for the minimum necessary. Here we explain what we process, why, and how you can control it.',
    contactLine: 'You can also write to us at {email}.',
    sections: [
      {
        title: 'Who processes your data',
        body: [
          'MorrowAge (working name) is the controller of the data described in this policy. The legal entity that owns the service will be identified on this page before public launch.',
          'To exercise your rights, including deletion, use the “Delete my data” page.',
        ],
      },
      {
        title: 'What data we process',
        body: [
          'To calculate: the eight inputs you enter (age, sleep, self-rated health, cigarettes, reaction time, waist and height —which we turn into a ratio—, weekly alcohol and resting heart rate). They are wellness data and, depending on your jurisdiction, may count as sensitive health data.',
          'To deliver your report: your email, the date of your service consent and, only if you tick them, your marketing consent and your subscription waitlist consent (separate and optional).',
          'Minimal technical data: a technical session cookie, your IP address to limit abuse (as a hash in the request limiter) and the device type in aggregate form.',
          'We do not ask for your name, date of birth or address.',
        ],
      },
      {
        title: 'What we use it for',
        body: [
          'To calculate your result, show you the preview and deliver your report: this is the service you request.',
          'Security and abuse prevention (legitimate interest).',
          'Improving the product with aggregate journey metrics (no health data, no email and no results).',
          'Marketing: only if you accept it expressly and separately; you can withdraw it at any time.',
          'We design the processing to respect the GDPR (EU), CCPA/CPRA (California), LGPD (Brazil) and Law 29733 (Peru). Your specific rights depend on where you live.',
        ],
      },
      {
        title: 'Operational copy during the validation phase',
        body: [
          'While MorrowAge is in its validation phase, the team receives a copy of your request (email, the data you entered, the result and the PDF) in a restricted-access operational mailbox, solely to validate the product and provide support.',
          'That copy is not sent to analytics tools or to the admin dashboard, and it is deleted according to the retention stated below.',
        ],
      },
      {
        title: 'How long we keep it',
        body: [
          'Calculations and reports: {retentionDays} days at most. Report links expire after {tokenDays} days.',
          'Your email and consents are kept as long as they are needed to deliver the service; marketing consent, until you withdraw it.',
          'If you buy a report, we keep the order record for as long as accounting regulations require.',
        ],
      },
      {
        title: 'Who we share it with',
        body: [
          'Hosting and database: Vercel and Supabase. Email delivery: Resend.',
          'Abuse protection: Cloudflare Turnstile and Upstash (request limiting).',
          'Journey analytics, without health data: PostHog. Error monitoring with redacted data: Sentry.',
          'Product configuration files, without personal data: Google Drive. Payments (when active): PayPal, which processes the charge with PayPal or card; Stripe, only if enabled.',
          'These providers may process data in the United States and other countries; we apply the relevant contractual safeguards. We do not sell your data.',
        ],
      },
      {
        title: 'Your rights',
        body: [
          'You can request access, rectification, erasure, objection or restriction, portability, and withdraw your consent where processing is based on it. You can also complain to your data protection authority.',
          'Request deletion on the “Delete my data” page; we resolve it in line with applicable legal and retention obligations.',
        ],
      },
      {
        title: 'Security',
        body: [
          'Encrypted connections (HTTPS with HSTS), unguessable report links with an expiry, tokens stored only as a hash, data access restricted by row-level security rules, and logs without personal data.',
        ],
      },
      {
        title: 'Cookies and local storage',
        body: [
          'We use one technical cookie (HttpOnly) to link your calculation to your browser for 24 hours, and tab storage to remember your answers during the session and your theme preference.',
          'We do not use advertising or tracking cookies, and we honor the Global Privacy Control and Do Not Track signals.',
        ],
      },
      {
        title: 'Minors and scope',
        body: ['MorrowAge is for adults aged 40 to 69. It is not directed at minors.'],
      },
      {
        title: 'Changes',
        body: ['We will publish any relevant change here before it takes effect.'],
      },
    ],
  },
  terms: {
    metaTitle: 'Terms of service · MorrowAge',
    metaDescription:
      'Terms of use of MorrowAge: an educational and wellness service, not medical advice, a scope of ages 40 to 69 and the limitations of the model.',
    title: 'Terms of service',
    updated: 'Preliminary version subject to legal review before public launch · Last updated: {date}',
    lede: 'Using MorrowAge means accepting these terms. Read them calmly: they are short.',
    sections: [
      {
        title: 'What the service is',
        body: [
          'MorrowAge provides an educational and wellness estimate: a population-based risk-equivalent age, calculated with published coefficients from a statistical model and compared with a benchmark from the same model.',
        ],
      },
      {
        title: 'It is not medical advice',
        body: [
          'The service does not diagnose, treat, prevent or mitigate any disease, and does not replace the care of a healthcare professional. Do not use it in emergencies or to make medical decisions.',
          'If you have questions about your health, consult a professional who can assess you individually.',
        ],
      },
      {
        title: 'Who can use it and for what',
        body: [
          'MorrowAge v1 is for adults aged 40 to 69. It must not be used during pregnancy or with a terminal illness.',
          'Do not use the result for employment, insurance, credit or eligibility decisions of any kind.',
        ],
      },
      {
        title: 'Accuracy and limitations',
        body: [
          'The result is based on population associations and does not establish causes. The model is not calibrated specifically for your country and has not been externally validated by subgroups.',
          'Outside the 40–69 range we show “<40” or “>69”; we do not show absolute 10-year risk or national percentiles. We do not guarantee that the result is accurate or fit for a particular purpose.',
        ],
      },
      {
        title: 'Your data and consents',
        body: ['The processing of your data is described in the privacy policy. Marketing consent is optional and independent of the service.'],
      },
      {
        title: 'Reports and links',
        body: [
          'Your report link is personal and expires after {tokenDays} days. Do not share it: anyone who has it can see your report.',
          'You can download the PDF while the link is valid.',
        ],
      },
      {
        title: 'Price',
        body: [
          'Your result and the report preview are free. The full report is a one-time digital product, with no subscription; its price is shown before you pay.',
          'Payment is processed by PayPal (with PayPal or card). MorrowAge does not store your card details. The full report is delivered immediately by email as a PDF.',
          'By purchasing you accept immediate delivery of the digital content and acknowledge that, once delivered, you waive the right of withdrawal. If you do not receive the report or are charged incorrectly, write to us and we will resolve it, including a refund where applicable.',
        ],
      },
      {
        title: 'Intellectual property and licenses',
        body: [
          'The calculation uses the coefficients published by Clift et al. (2021), available under the article’s CC BY license. The proprietary C-Score is not used. The MorrowAge brand, design and code belong to the owner of the service.',
        ],
      },
      {
        title: 'Limitation of liability',
        body: [
          'To the extent permitted by law, the service is provided “as is”, without warranties, and we accept no liability for decisions you make based on the result.',
        ],
      },
      {
        title: 'Changes, governing law and contact',
        body: [
          'We may update these terms and will say so on this page. The governing law and jurisdiction will depend on where you live and on the entity that owns the service, which will be identified before public launch.',
        ],
      },
    ],
  },
  deleteRequest: {
    metaTitle: 'Delete my data · MorrowAge',
    metaDescription: 'Request deletion of your data on MorrowAge. We record your request and resolve it according to applicable legal obligations.',
    title: 'Delete my data',
    lede: 'Enter the email you used to request your report. We record your request and resolve it in line with applicable legal and retention obligations.',
    emailLabel: 'Email of your request',
    vidLabel: 'Verification ID (optional)',
    vidHelp: 'It appears in your report and your email. It helps us locate your request.',
    submit: 'Request deletion',
    submitting: 'Sending…',
    successTitle: 'Request received',
    successBody: 'We recorded your request under number {id}. We will reply by email once it is resolved.',
    note: 'No sensitive data is sent to analytics tools when this request is recorded.',
    errors: {
      generic: 'We couldn’t record your request. Please try again.',
      rate: 'Too many attempts. Wait a while and try again.',
      vid: 'The verification ID does not have the expected format (for example MA-26-8F3C2A).',
      turnstile: 'We couldn’t verify that you are a person. Reload the page and try again.',
    },
  },
};
