export const legalEs = {
  privacy: {
    metaTitle: 'Política de privacidad · MorrowAge',
    metaDescription:
      'Qué datos trata MorrowAge, para qué, cuánto tiempo los conserva, con quién los comparte y cómo ejercer tus derechos, incluido el borrado.',
    title: 'Política de privacidad',
    updated: 'Versión preliminar sujeta a revisión legal antes del lanzamiento público · Última actualización: {date}',
    lede: 'Pedimos lo mínimo necesario. Aquí explicamos qué tratamos, por qué y cómo puedes controlarlo.',
    contactLine: 'También puedes escribirnos a {email}.',
    sections: [
      {
        title: 'Quién trata tus datos',
        body: [
          'MorrowAge (nombre de trabajo) es el responsable del tratamiento de los datos descritos en esta política. La entidad legal titular del servicio se identificará en esta página antes del lanzamiento público.',
          'Para ejercer tus derechos, incluido el borrado, usa la página «Borrar mis datos».',
        ],
      },
      {
        title: 'Qué datos tratamos',
        body: [
          'Para calcular: los ocho datos que introduces (edad, sueño, salud autopercibida, cigarrillos, tiempo de reacción, cintura y altura —que convertimos en una relación—, alcohol semanal y pulso en reposo). Son datos de bienestar y, según tu jurisdicción, pueden considerarse datos sensibles de salud.',
          'Para entregarte el informe: tu email, la fecha de tu consentimiento de servicio y, solo si los marcas, tu consentimiento de marketing y el de la lista de espera de suscripción (separados y opcionales).',
          'Datos técnicos mínimos: una cookie técnica de sesión, tu dirección IP para limitar abusos (en forma de hash en el limitador de peticiones) y el tipo de dispositivo de forma agregada.',
          'No pedimos nombre, fecha de nacimiento ni dirección.',
        ],
      },
      {
        title: 'Para qué los usamos',
        body: [
          'Calcular tu resultado, mostrarte la vista previa y entregarte el informe: es el servicio que solicitas.',
          'Seguridad y prevención de abuso (interés legítimo).',
          'Mejorar el producto con métricas agregadas del recorrido (sin datos de salud, sin email y sin resultados).',
          'Marketing: solo si lo aceptas de forma expresa y separada; puedes retirarlo cuando quieras.',
          'Diseñamos el tratamiento para respetar el RGPD/GDPR (UE), la CCPA/CPRA (California), la LGPD (Brasil) y la Ley 29733 (Perú). Tus derechos concretos dependen de dónde vivas.',
        ],
      },
      {
        title: 'Copia operativa en la fase de validación',
        body: [
          'Mientras MorrowAge esté en fase de validación, el equipo recibe una copia de tu solicitud (email, datos introducidos, resultado y PDF) en un buzón operacional de acceso restringido, solo para validar el producto y dar soporte.',
          'Esa copia no se envía a herramientas de analítica ni al panel de administración, y se elimina conforme a la retención indicada abajo.',
        ],
      },
      {
        title: 'Cuánto tiempo los conservamos',
        body: [
          'Cálculos e informes: {retentionDays} días como máximo. Los enlaces de informe caducan a los {tokenDays} días.',
          'Tu email y tus consentimientos se conservan mientras sean necesarios para entregar el servicio; el consentimiento de marketing, hasta que lo retires.',
          'Si compras un informe, conservamos el registro del pedido durante el tiempo que exija la normativa contable.',
        ],
      },
      {
        title: 'Con quién los compartimos',
        body: [
          'Alojamiento y base de datos: Vercel y Supabase. Envío de emails: Resend.',
          'Protección frente a abuso: Cloudflare Turnstile y Upstash (límite de peticiones).',
          'Analítica del recorrido, sin datos de salud: PostHog. Monitorización de errores con datos redactados: Sentry.',
          'Archivos de configuración del producto, sin datos personales: Google Drive. Pagos (cuando están activos): PayPal, que procesa el cobro con PayPal o tarjeta; Stripe, solo si se activa.',
          'Estos proveedores pueden tratar datos en Estados Unidos y en otros países; aplicamos las garantías contractuales correspondientes. No vendemos tus datos.',
        ],
      },
      {
        title: 'Tus derechos',
        body: [
          'Puedes pedir acceso, rectificación, supresión, oposición o limitación, portabilidad y retirar tu consentimiento cuando se base en él. También puedes reclamar ante tu autoridad de protección de datos.',
          'Solicita el borrado en la página «Borrar mis datos»; lo resolvemos conforme a las obligaciones legales y de retención aplicables.',
        ],
      },
      {
        title: 'Seguridad',
        body: [
          'Conexiones cifradas (HTTPS con HSTS), enlaces de informe no adivinables y con caducidad, tokens guardados solo como hash, acceso a los datos restringido por reglas de seguridad a nivel de fila y registros sin datos personales.',
        ],
      },
      {
        title: 'Cookies y almacenamiento local',
        body: [
          'Usamos una cookie técnica (HttpOnly) para vincular tu cálculo a tu navegador durante 24 horas, y el almacenamiento de la pestaña para recordar tus respuestas durante la sesión y tu preferencia de tema.',
          'No usamos cookies publicitarias ni de seguimiento, y respetamos las señales Global Privacy Control y Do Not Track.',
        ],
      },
      {
        title: 'Menores y alcance',
        body: ['MorrowAge es para adultos de 40 a 69 años. No está dirigido a menores de edad.'],
      },
      {
        title: 'Cambios',
        body: ['Publicaremos aquí cualquier cambio relevante antes de que se aplique.'],
      },
    ],
  },
  terms: {
    metaTitle: 'Términos del servicio · MorrowAge',
    metaDescription:
      'Condiciones de uso de MorrowAge: servicio educativo y de bienestar, no asesoramiento médico, alcance de 40 a 69 años y limitaciones del modelo.',
    title: 'Términos del servicio',
    updated: 'Versión preliminar sujeta a revisión legal antes del lanzamiento público · Última actualización: {date}',
    lede: 'Usar MorrowAge implica aceptar estas condiciones. Léelas con calma: son cortas.',
    sections: [
      {
        title: 'Qué es el servicio',
        body: [
          'MorrowAge ofrece una estimación educativa y de bienestar: una edad equivalente de riesgo poblacional, calculada con coeficientes publicados de un modelo estadístico, comparada con un benchmark del mismo modelo.',
        ],
      },
      {
        title: 'No es asesoramiento médico',
        body: [
          'El servicio no diagnostica, no trata, no previene ni mitiga ninguna enfermedad, y no sustituye la atención de un profesional sanitario. No lo uses en emergencias ni para tomar decisiones médicas.',
          'Si tienes dudas sobre tu salud, consulta con un profesional que pueda evaluarte de forma individual.',
        ],
      },
      {
        title: 'Quién puede usarlo y para qué',
        body: [
          'MorrowAge v1 es para adultos de 40 a 69 años. No debe usarse durante el embarazo ni en enfermedad terminal.',
          'No uses el resultado para decisiones laborales, de seguros, de crédito ni de elegibilidad de ningún tipo.',
        ],
      },
      {
        title: 'Exactitud y limitaciones',
        body: [
          'El resultado se basa en asociaciones poblacionales y no establece causas. El modelo no está calibrado específicamente para tu país y no se ha validado externamente por subgrupos.',
          'Fuera del rango de 40 a 69 años mostramos «<40» o «>69»; no mostramos riesgo absoluto a 10 años ni percentiles nacionales. No garantizamos que el resultado sea exacto ni adecuado para un fin concreto.',
        ],
      },
      {
        title: 'Tus datos y consentimientos',
        body: ['El tratamiento de tus datos se describe en la política de privacidad. El consentimiento de marketing es opcional y independiente del servicio.'],
      },
      {
        title: 'Informes y enlaces',
        body: [
          'El enlace de tu informe es personal y caduca a los {tokenDays} días. No lo compartas: quien lo tenga puede ver tu informe.',
          'Puedes descargar el PDF mientras el enlace esté vigente.',
        ],
      },
      {
        title: 'Precio',
        body: [
          'Tu resultado y la vista previa del informe son gratuitos. El informe completo es un producto digital de pago único, sin suscripción; su precio se muestra antes de pagar.',
          'El pago lo procesa PayPal (con PayPal o tarjeta). MorrowAge no almacena los datos de tu tarjeta. El informe completo se entrega de inmediato por correo electrónico, en PDF.',
          'Al comprar aceptas la entrega inmediata del contenido digital y reconoces que, una vez entregado, renuncias al derecho de desistimiento. Si no recibes el informe o se produce un cobro incorrecto, escríbenos y lo resolveremos, incluido el reembolso cuando corresponda.',
        ],
      },
      {
        title: 'Propiedad intelectual y licencias',
        body: [
          'El cálculo usa los coeficientes publicados por Clift et al. (2021), disponibles bajo la licencia CC BY del artículo. No se usa el C-Score propietario. La marca, el diseño y el código de MorrowAge pertenecen al titular del servicio.',
        ],
      },
      {
        title: 'Limitación de responsabilidad',
        body: [
          'En la medida permitida por la ley, el servicio se ofrece «tal cual», sin garantías, y no asumimos responsabilidad por las decisiones que tomes a partir del resultado.',
        ],
      },
      {
        title: 'Cambios, ley aplicable y contacto',
        body: [
          'Podemos actualizar estos términos y lo indicaremos en esta página. La ley y la jurisdicción aplicables dependerán de tu lugar de residencia y de la entidad titular del servicio, que se identificará antes del lanzamiento público.',
        ],
      },
    ],
  },
  deleteRequest: {
    metaTitle: 'Borrar mis datos · MorrowAge',
    metaDescription: 'Solicita el borrado de tus datos en MorrowAge. Registramos tu petición y la resolvemos según las obligaciones legales aplicables.',
    title: 'Borrar mis datos',
    lede: 'Indica el email con el que pediste tu informe. Registramos tu solicitud y la resolvemos conforme a las obligaciones legales y de retención aplicables.',
    emailLabel: 'Email de tu solicitud',
    vidLabel: 'ID de verificación (opcional)',
    vidHelp: 'Aparece en tu informe y en tu correo. Ayuda a localizar tu solicitud.',
    submit: 'Solicitar borrado',
    submitting: 'Enviando…',
    successTitle: 'Solicitud recibida',
    successBody: 'Registramos tu solicitud con el número {id}. Te responderemos por email cuando esté resuelta.',
    note: 'No se envía ningún dato sensible a herramientas de analítica al registrar esta solicitud.',
    errors: {
      generic: 'No pudimos registrar tu solicitud. Inténtalo de nuevo.',
      rate: 'Demasiados intentos. Espera un rato e inténtalo de nuevo.',
      vid: 'El ID de verificación no tiene el formato esperado (por ejemplo MA-26-8F3C2A).',
      turnstile: 'No pudimos verificar que eres una persona. Recarga la página e inténtalo de nuevo.',
    },
  },
} as const;
