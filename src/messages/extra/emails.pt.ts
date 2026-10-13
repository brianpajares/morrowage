import type { Shape } from '../util';
import type { emailsEs } from './emails.es';

export const emailsPt: Shape<typeof emailsEs> = {
  emails: {
    common: {
      brand: 'MorrowAge',
      openReport: 'Abrir meu relatório',
      linkFallback: 'Se o botão não funcionar, copie este link no seu navegador:',
      verificationId: 'ID de verificação',
      expiry: 'Por privacidade, este link expira em {days} dias (em {date}).',
      whyReceived:
        'Você está recebendo este e-mail porque solicitou o seu relatório no MorrowAge. Se não foi você, pode ignorá-lo.',
      deleteData: 'Se quiser que apaguemos os seus dados, você pode solicitar aqui: {url}',
      notBio: 'Isto não é a sua idade biológica nem uma previsão de quantos anos você viverá.',
      disclaimer: 'Estimativa educativa populacional. Não diagnostica nem substitui cuidados médicos.',
      pdfNote: 'Você pode baixar o PDF pelo relatório na web.',
    },
    user: {
      subject: 'Seu relatório do MorrowAge está pronto',
      preheader: 'Abra o seu relatório completo com o seu link pessoal. Expira em {days} dias.',
      title: 'Seu relatório está pronto',
      intro:
        'Obrigado por usar o MorrowAge. Este é o link pessoal do seu relatório completo, com sensibilidade de medição, associações, cenários e metodologia.',
    },
    paid: {
      subject: 'Pagamento confirmado · seu relatório do MorrowAge',
      preheader: 'Obrigado pela compra. Seu relatório e o PDF estão prontos.',
      title: 'Pagamento confirmado',
      intro:
        'Obrigado pela compra. Aqui está o link pessoal do seu relatório completo; o PDF segue em anexo neste e-mail.',
      pdfAttached: 'O PDF completo segue em anexo.',
    },
  },
};
