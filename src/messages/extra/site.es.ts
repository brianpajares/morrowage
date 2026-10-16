export const siteEs = {
  meta: {
    siteName: 'MorrowAge',
    title: 'MorrowAge · Tu edad equivalente de riesgo, con contexto',
    description:
      'Convierte 8 datos cotidianos en una edad equivalente de riesgo poblacional en menos de 90 segundos. Cálculo determinista, fuentes visibles y límites explícitos. No es edad biológica ni diagnóstico.',
    ogAlt: 'MorrowAge: edad equivalente de riesgo con contexto',
  },
  nav: {
    home: 'MorrowAge, inicio',
    primary: 'Navegación principal',
    howItWorks: 'Cómo funciona',
    methodology: 'Metodología',
    faq: 'Preguntas frecuentes',
    menu: 'Menú',
    start: 'Calcular',
  },
  a11y: {
    skipToContent: 'Saltar al contenido',
    language: 'Idioma',
    theme: 'Tema de color',
    themeSystem: 'Sistema',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
    opensInNewTab: 'se abre en una pestaña nueva',
    loading: 'Cargando',
    close: 'Cerrar',
    required: 'obligatorio',
  },
  footer: {
    tagline: 'Estimación educativa basada en datos poblacionales.',
    notMedical: 'Estimación educativa poblacional · No es consejo médico.',
    legal: 'Legal',
    privacy: 'Privacidad',
    terms: 'Términos',
    deleteData: 'Borrar mis datos',
    methodology: 'Metodología',
    guides: 'Guías',
    copyright: '© {year} MorrowAge. Nombre de trabajo; disponibilidad de marca en revisión.',
    version: 'Modelo v{model} · App v{app}',
  },
  landing: {
    demoLabel: 'Ejemplo ilustrativo · datos sintéticos',
    demoCaption: 'Comparación entre edad cronológica y edad equivalente de riesgo (ejemplo).',
    demoChrono: 'Cronológica',
    demoMorrow: 'Equivalente de riesgo',
    howLink: 'Cómo funciona',
    stepsTitle: 'Qué hace MorrowAge',
    steps: [
      {
        title: '8 datos cotidianos',
        body: 'Edad, sueño, salud autopercibida, cigarrillos, tiempo de reacción, cintura/altura, alcohol y pulso en reposo. Sin laboratorio.',
      },
      {
        title: 'Cálculo determinista',
        body: 'Coeficientes publicados de un modelo de supervivencia. El número sale de una fórmula reproducible, no de un LLM.',
      },
      {
        title: 'Contexto, no solo la cifra',
        body: 'Una edad equivalente de riesgo frente al benchmark del mismo modelo, con fuentes, supuestos y límites a la vista.',
      },
    ],
    inputsTitle: 'Los 8 datos que usamos',
    inputsBody: 'No pedimos nombre, fecha de nacimiento ni dirección para calcular.',
    deliverTitle: 'Qué recibes',
    freeTitle: 'Vista previa gratuita',
    freeItems: [
      'Tu MorrowAge (edad equivalente de riesgo) junto a tu edad cronológica',
      'Hazard relativo frente al benchmark, como detalle técnico',
      'La asociación que más movió tu resultado',
    ],
    fullTitle: 'Informe completo',
    fullBadge: 'Gratis en esta fase',
    fullBadgePaid: 'Pago único {price}',
    fullItemsPaid: [
      'Perfil dato por dato frente al benchmark y sensibilidad de medición',
      'Todas las asociaciones ordenadas por peso',
      'Escenarios educativos que puedes explorar',
      'Guía de medición, registro de seguimiento y preguntas para tu profesional',
      'Glosario, metodología y fuentes · PDF de {pages} páginas',
    ],
    faqPricePaid: 'Tu resultado y la vista previa son gratis. El informe completo de {pages} páginas es un pago único de {price}, sin suscripción, y lo ves antes de pagar.',
    fullItems: [
      'Sensibilidad de medición (no es un intervalo de confianza)',
      'Todas las asociaciones ordenadas por peso',
      'Escenarios educativos que puedes explorar',
      'Metodología, supuestos y fuentes · PDF descargable',
    ],
    notTitle: 'Lo que MorrowAge no es',
    notItems: [
      'No es tu edad biológica ni mide la edad de tus órganos.',
      'No es un diagnóstico ni consejo médico.',
      'No predice cuánto vas a vivir ni calcula una probabilidad de muerte.',
      'No usa un LLM para generar la cifra: es una fórmula pública y reproducible.',
    ],
    methodTitle: 'Metodología a la vista',
    methodBody:
      'Usamos los coeficientes publicados del modelo de Cox «raw-input» de Clift et al. (2021), calculado con datos de UK Biobank. Tu resultado compara tu perfil con un benchmark del mismo modelo. Está pensado para adultos de 40 a 69 años.',
    finalTitle: 'Listo en menos de 90 segundos',
    finalBody: 'Rango de uso: 40–69 años. Estimación educativa; no sustituye atención médica.',
  },
  howItWorks: {
    metaTitle: 'Cómo funciona MorrowAge',
    metaDescription:
      'De ocho datos a una edad equivalente de riesgo: la fórmula, el benchmark y qué significa el resultado. Sin LLM para la cifra.',
    title: 'Cómo funciona',
    lede: 'MorrowAge traduce ocho datos sencillos a una edad equivalente de riesgo poblacional usando coeficientes publicados. Aquí está el camino completo, sin cajas negras.',
    s1Title: '1 · Ocho datos',
    s1Body:
      'Edad, horas de sueño, salud autopercibida, cigarrillos al día, tiempo de reacción, relación cintura/altura, alcohol semanal (en unidades UK) y pulso en reposo.',
    s2Title: '2 · Un predictor lineal',
    s2Body:
      'Cada dato se compara con un perfil de referencia (benchmark) del mismo modelo. La diferencia, ponderada por los coeficientes del modelo, forma el predictor lineal sin edad.',
    s3Title: '3 · Edad equivalente de riesgo',
    s3Body:
      'Se invierte el término de edad del modelo: ¿a qué edad tendría el perfil de referencia el mismo riesgo relativo que tú? Esa edad es tu MorrowAge.',
    formulaTitle: 'La fórmula',
    formulaNote:
      'LP_nonage es la suma de coeficiente × valor de los siete datos que no son edad; LP_benchmark es la misma suma para el perfil de referencia; β_log_age es el coeficiente del logaritmo de la edad en el modelo publicado.',
    meansTitle: 'Qué significa',
    means:
      'Si tu MorrowAge es 47 y tu edad es 52, tu combinación de datos tiene un predictor de riesgo parecido al de un perfil de referencia de menor edad dentro de este modelo.',
    notMeansTitle: 'Qué no significa',
    notMeans:
      'No significa que tus órganos tengan 47 años ni que vayas a vivir más o menos una cantidad concreta de años.',
    limitsTitle: 'Límites que verás siempre',
    limits: [
      'Fuera de 40–69 mostramos «<40» o «>69», nunca una cifra exacta: el modelo se construyó con personas de 40 a 69 años.',
      'La «sensibilidad de medición» muestra cómo cambia el resultado si algunas mediciones varían; no es un intervalo de confianza.',
      'No mostramos riesgo absoluto a 10 años ni percentiles por país: faltan datos de calibración verificados.',
      'Las variables son asociaciones poblacionales, no pruebas de causalidad.',
    ],
    cta: 'Calcular mi MorrowAge',
    methodLink: 'Ver metodología completa',
  },
  faq: {
    metaTitle: 'Preguntas frecuentes · MorrowAge',
    metaDescription:
      '¿Es edad biológica? ¿Predice cuánto viviré? ¿Qué significan <40 o >69? Respuestas claras sobre alcance, límites y datos.',
    title: 'Preguntas frecuentes',
    lede: 'Las respuestas cortas a las dudas más comunes. Para el detalle técnico, visita la metodología.',
    items: [
      {
        q: '¿Es mi edad biológica?',
        a: 'No. MorrowAge es una edad equivalente de riesgo poblacional: compara tu perfil con un benchmark del mismo modelo. No mide la edad de tus órganos ni usa análisis de laboratorio o epigenéticos.',
      },
      {
        q: '¿Predice cuánto viviré?',
        a: 'No. Es una estimación educativa basada en asociaciones de una cohorte grande, no una predicción individual de longevidad ni una probabilidad de muerte.',
      },
      {
        q: '¿Por qué no veo un riesgo de mortalidad a 10 años?',
        a: 'Para convertir un modelo de Cox en probabilidad absoluta hace falta, además de los coeficientes, una curva de supervivencia basal verificada. La fuente que usamos no la publica de forma reconstruible y no la inventamos. Se habilitará solo tras una recalibración y validación adecuadas.',
      },
      {
        q: '¿Qué significan «<40» y «>69»?',
        a: 'La transformación matemática puede dar una edad equivalente fuera del rango de 40 a 69 años, que es el de la cohorte de origen. Para no fingir una precisión que no existe, mostramos «<40» o «>69» en lugar de una cifra exacta.',
      },
      {
        q: '¿La «sensibilidad de medición» es un intervalo de confianza?',
        a: 'No. Muestra cómo cambiaría el resultado si algunas mediciones variaran dentro de rangos razonables (siempre dentro de los límites del modelo). Es un escenario de medición, no un intervalo estadístico.',
      },
      {
        q: '¿Qué pasa con mis datos?',
        a: 'Pedimos solo lo necesario: los ocho datos para calcular y tu email si quieres recibir el informe. El consentimiento de marketing es opcional y separado. El análisis y el panel de administración no reciben tus datos de salud. Puedes solicitar el borrado en cualquier momento.',
      },
      {
        q: '¿Por qué un dato puede «empeorar» el resultado de forma contraintuitiva?',
        a: 'Porque el modelo recoge asociaciones poblacionales y no causas. Algunos coeficientes pueden resultar contraintuitivos por confusión o por relaciones no lineales; por eso no convertimos el signo de un coeficiente en un consejo.',
      },
      {
        q: '¿Por qué solo de 40 a 69 años?',
        a: 'Es el rango de edad de la cohorte con la que se estimó el modelo. Fuera de ese rango no extrapolamos.',
      },
      {
        q: '¿Cuánto cuesta?',
        a: 'En esta fase de validación, la vista previa y el informe completo son gratis. Si esto cambia, lo verás antes de aportar ningún dato de pago.',
      },
      {
        q: '¿Cómo borro mis datos?',
        a: 'Desde la página «Borrar mis datos» puedes registrar una solicitud. La resolvemos según las obligaciones legales y de retención aplicables.',
      },
    ],
    stillQuestions: '¿Quieres ver cómo se calcula exactamente?',
    methodLink: 'Ir a la metodología',
  },
  notFound: {
    title: 'No encontramos esa página',
    body: 'La dirección puede haber cambiado o el enlace puede haber caducado.',
    home: 'Volver al inicio',
  },
  common: {
    loading: 'Cargando…',
    retry: 'Reintentar',
    close: 'Cerrar',
    yes: 'Sí',
    no: 'No',
    optional: 'opcional',
    learnMore: 'Saber más',
    backHome: 'Volver al inicio',
    sources: 'Fuentes',
  },
  variables: {
    age_years: {
      label: 'Edad',
      driver: 'tu edad',
      unit: 'años',
    },
    sleep_hours: {
      label: 'Horas de sueño',
      driver: 'tus horas de sueño',
      unit: 'h/noche',
    },
    self_rated_health: {
      label: 'Salud autopercibida',
      driver: 'tu salud autopercibida',
      unit: '',
    },
    cigarettes_per_day: {
      label: 'Cigarrillos al día',
      driver: 'los cigarrillos que fumas al día',
      unit: 'cig/día',
    },
    reaction_time_ms: {
      label: 'Tiempo de reacción',
      driver: 'tu tiempo de reacción',
      unit: 'ms',
    },
    waist_to_height_ratio: {
      label: 'Relación cintura/altura',
      driver: 'tu relación cintura/altura',
      unit: '',
    },
    alcohol_units_week: {
      label: 'Alcohol semanal',
      driver: 'tu consumo semanal de alcohol',
      unit: 'unidades UK/sem.',
    },
    resting_hr_bpm: {
      label: 'Pulso en reposo',
      driver: 'tu pulso en reposo',
      unit: 'bpm',
    },
    direction: {
      higher: 'Asociado a una estimación mayor que el benchmark',
      lower: 'Asociado a una estimación menor que el benchmark',
      neutral: 'Sin diferencia relevante frente al benchmark',
    },
    benchmarkWeighted: 'media ponderada UK Biobank',
    benchmarkNever: '0 (referencia: nunca fumó)',
  },
} as const;
