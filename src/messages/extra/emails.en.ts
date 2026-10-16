import type { Shape } from '../util';
import type { emailsEs } from './emails.es';

export const emailsEn: Shape<typeof emailsEs> = {
  emails: {
    common: {
      brand: 'MorrowAge',
      openReport: 'Open my report',
      linkFallback: 'If the button doesn’t work, copy this link into your browser:',
      verificationId: 'Verification ID',
      expiry: 'For privacy, this link expires in {days} days (on {date}).',
      whyReceived:
        'You are receiving this email because you requested your report on MorrowAge. If it wasn’t you, you can ignore it.',
      deleteData: 'If you would like us to delete your data, you can request it here: {url}',
      notBio: 'This is not your biological age or a prediction of how long you will live.',
      disclaimer: 'Educational population-based estimate. It does not diagnose or replace medical care.',
      pdfNote: 'You can download the PDF from the web report.',
    },
    user: {
      subject: 'Your MorrowAge report is ready',
      preheader: 'Open your full report with your personal link. It expires in {days} days.',
      title: 'Your report is ready',
      intro:
        'Thank you for using MorrowAge. This is the personal link to your full report, with measurement sensitivity, associations, scenarios and methodology.',
    },
    preview: {
      subject: 'Your MorrowAge preview · unlock your full report',
      preheader: 'Your preview is attached. Unlock the full report whenever you like.',
      title: 'Thank you for trusting MorrowAge',
      intro:
        'We prepared your personalized analysis. The attached PDF is your preview: your result and the structure of your full report, with {pages} pages of useful information about your data.',
      includesTitle: 'Your full report includes',
      includes: [
        'Your profile, input by input, versus the benchmark',
        'Measurement sensitivity and all associations ranked by weight',
        'Educational scenarios you can explore',
        'A guide to measure each input well, plus a follow-up log',
        'Questions to bring to a professional, glossary, methodology and sources',
      ],
      cta: 'Unlock my full report · {price}',
      mission:
        'Your contribution lets our team of developers keep building tools that help people around the world better understand their health data.',
      securePay: 'One-time, secure payment with PayPal or card. Once confirmed, you will receive the complete PDF in this same inbox.',
      later: 'No rush: your link stays active until it expires.',
    },
    paid: {
      subject: 'Payment confirmed · your MorrowAge report',
      preheader: 'Thank you for your purchase. Your report and PDF are ready.',
      title: 'Payment confirmed',
      intro:
        'Thank you for your purchase. Here is the personal link to your full report; the PDF is attached to this email.',
      pdfAttached: 'The full PDF is attached.',
    },
  },
};
