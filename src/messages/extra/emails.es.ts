export const emailsEs = {
  emails: {
    common: {
      brand: 'MorrowAge',
      openReport: 'Abrir mi informe',
      linkFallback: 'Si el botón no funciona, copia este enlace en tu navegador:',
      verificationId: 'ID de verificación',
      expiry: 'Por privacidad, este enlace caduca en {days} días (el {date}).',
      whyReceived:
        'Recibes este correo porque solicitaste tu informe en MorrowAge. Si no fuiste tú, puedes ignorarlo.',
      deleteData: 'Si quieres que borremos tus datos, puedes solicitarlo aquí: {url}',
      notBio: 'No es tu edad biológica ni una predicción de cuántos años vivirás.',
      disclaimer: 'Estimación educativa poblacional. No diagnostica ni sustituye atención médica.',
      pdfNote: 'Puedes descargar el PDF desde el informe web.',
    },
    user: {
      subject: 'Tu informe de MorrowAge está listo',
      preheader: 'Abre tu informe completo con tu enlace personal. Caduca en {days} días.',
      title: 'Tu informe está listo',
      intro:
        'Gracias por usar MorrowAge. Este es el enlace personal a tu informe completo, con sensibilidad de medición, asociaciones, escenarios y metodología.',
    },
    preview: {
      subject: 'Tu vista previa de MorrowAge · desbloquea tu informe completo',
      preheader: 'Adjuntamos tu vista previa. Desbloquea el informe completo cuando quieras.',
      title: 'Gracias por confiar en MorrowAge',
      intro:
        'Preparamos tu análisis personalizado. En el PDF adjunto tienes la vista previa: tu resultado y la estructura de tu informe completo, con {pages} páginas de información útil sobre tus datos.',
      includesTitle: 'Tu informe completo incluye',
      includes: [
        'Tu perfil dato por dato frente al benchmark',
        'Sensibilidad de medición y todas las asociaciones ordenadas por peso',
        'Escenarios educativos que puedes explorar',
        'Guía para medir cada dato con calidad y registro de seguimiento',
        'Preguntas para llevar a un profesional, glosario, metodología y fuentes',
      ],
      cta: 'Desbloquear mi informe completo · {price}',
      mission:
        'Tu aporte permite que nuestro equipo de desarrolladores siga creando herramientas que ayudan a personas de todo el mundo a entender mejor sus datos de salud.',
      securePay: 'Pago único y seguro con PayPal o tarjeta. Al confirmarse, recibirás el PDF completo en este mismo correo.',
      later: 'Sin prisa: tu enlace sigue activo hasta que caduque.',
    },
    paid: {
      subject: 'Pago confirmado · tu informe de MorrowAge',
      preheader: 'Gracias por tu compra. Tu informe y el PDF están listos.',
      title: 'Pago confirmado',
      intro:
        'Gracias por tu compra. Aquí tienes el enlace personal a tu informe completo; el PDF va adjunto a este correo.',
      pdfAttached: 'El PDF completo va adjunto.',
    },
  },
} as const;
