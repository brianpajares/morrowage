export const seoEs = {
  calculatorPage: {
    metaTitle: 'Calculadora de edad equivalente de riesgo',
    metaDescription:
      'Calcula tu edad equivalente de riesgo poblacional con 8 datos cotidianos en menos de 90 segundos. Fórmula pública, fuentes visibles, sin laboratorio. No es edad biológica.',
    h1: 'Calculadora de edad equivalente de riesgo',
    lede: 'Introduce ocho datos cotidianos y compara tu perfil con un benchmark de un modelo publicado. El cálculo es determinista y la fórmula es pública.',
    sections: [
      {
        title: '¿Qué es una edad equivalente de riesgo?',
        body: [
          'Es la edad a la que un perfil de referencia tendría, dentro del mismo modelo, un riesgo relativo parecido al tuyo. Sirve para ponerle contexto a tus datos, no para medir la edad de tus órganos.',
        ],
      },
      {
        title: '¿Qué datos necesitas?',
        body: [
          'Tu edad (40–69), horas de sueño, cómo calificas tu salud, cigarrillos al día, tu tiempo de reacción (hay una prueba integrada), cintura y altura, alcohol semanal y pulso en reposo. Ninguno requiere laboratorio.',
        ],
      },
      {
        title: '¿Qué verás?',
        body: [
          'Una vista previa gratuita con tu MorrowAge y la asociación que más pesa en el resultado. En el informe completo: sensibilidad de medición, todas las asociaciones, escenarios educativos, metodología y un PDF.',
        ],
      },
      {
        title: '¿Qué no es?',
        body: [
          'No es edad biológica, ni un diagnóstico, ni una predicción de cuánto vas a vivir, ni una probabilidad de muerte. Es una estimación educativa basada en asociaciones poblacionales.',
        ],
      },
    ],
    cta: 'Calcular mi MorrowAge',
  },
  country: {
    metaTitle: 'Edad equivalente de riesgo en {country}',
    metaDescription:
      'MorrowAge no está calibrado específicamente para {country}: qué significa, qué no mostramos y cómo usar el resultado con cautela.',
    h1: 'Edad equivalente de riesgo en {country}',
    notice: 'El modelo no está calibrado específicamente para este país',
    paragraphs: [
      'MorrowAge usa los coeficientes del modelo de Clift et al. (2021), construido con datos de UK Biobank. Esa cohorte no es una muestra representativa de {country}.',
      'Por eso no mostramos percentiles ni comparativas nacionales para {country}, y no afirmamos que el resultado esté calibrado localmente. Es una estimación educativa que compara tu perfil con el benchmark del propio modelo.',
      'Si tienes entre 40 y 69 años puedes calcular tu MorrowAge igualmente; interpreta el resultado teniendo presentes estos límites. La calibración local se evaluará con datos verificados antes de ofrecer cualquier comparación nacional.',
    ],
    cta: 'Calcular mi MorrowAge',
    methodLink: 'Ver metodología y límites',
  },
  guides: {
    metaTitle: 'Guías · MorrowAge',
    indexTitle: 'Guías',
    indexLede: 'Textos cortos para interpretar con criterio una edad equivalente de riesgo.',
    readGuide: 'Leer la guía',
    cta: 'Calcular mi MorrowAge',
    items: {
      'risk-equivalent-age-vs-biological-age': {
        title: 'Edad equivalente de riesgo frente a edad biológica',
        description: 'Dos ideas que se confunden: qué calcula cada una, qué sabemos y por qué MorrowAge no usa el término «biológica».',
        sections: [
          {
            title: 'Dos ideas distintas',
            body: [
              'La «edad biológica» suele presentarse como la edad de tu cuerpo según marcadores biológicos (por ejemplo, análisis de laboratorio o epigenéticos). Una edad equivalente de riesgo es otra cosa: traduce un riesgo relativo, calculado con un modelo estadístico, a la edad que tendría un perfil de referencia con ese mismo riesgo.',
            ],
          },
          {
            title: 'Qué calcula MorrowAge',
            body: [
              'MorrowAge combina ocho datos cotidianos con coeficientes publicados de un modelo de supervivencia. El resultado compara tu perfil con un benchmark del mismo modelo. No mide ningún biomarcador.',
            ],
          },
          {
            title: 'Por qué evitamos el término «biológica»',
            body: [
              'Porque sugiere una medición del estado de tus órganos que este cálculo no hace. Preferimos un nombre que diga lo que es: una edad equivalente de riesgo poblacional.',
            ],
          },
          {
            title: 'Cómo leer tu resultado',
            body: [
              'Úsalo como contexto, junto con sus límites: es una asociación poblacional, no un diagnóstico ni una predicción individual. Si te genera dudas sobre tu salud, coméntalas con un profesional sanitario.',
            ],
          },
        ],
      },
      'how-to-read-associations': {
        title: 'Cómo leer asociaciones: por qué un dato puede parecer contraintuitivo',
        description: 'Asociación no es causa: confusión, relaciones no lineales y por qué no convertimos el signo de un coeficiente en un consejo.',
        sections: [
          {
            title: 'Asociación no es causa',
            body: [
              'Un modelo estadístico describe cómo se mueven juntas las variables en un grupo grande de personas. Que dos cosas vayan unidas en los datos no significa que una cause la otra.',
            ],
          },
          {
            title: 'Por qué algo puede parecer contraintuitivo',
            body: [
              'Hay factores que no aparecen en el modelo (confusión) y relaciones que no son una línea recta. Un coeficiente puede salir con un signo inesperado sin que eso sea una recomendación.',
            ],
          },
          {
            title: 'Qué hacemos con eso',
            body: [
              'Nunca convertimos el signo de un coeficiente en un consejo (por ejemplo, no sugerimos dormir menos o beber más). Los escenarios del informe solo exploran reducciones de datos que una persona reconoce como modificables, y son ejercicios de recálculo, no predicciones.',
            ],
          },
        ],
      },
      'limits-of-biological-age-calculators': {
        title: 'Límites de las calculadoras de edad biológica',
        description: 'Calibración, poblaciones de origen y precisión aparente: qué preguntarle a cualquier calculadora de edad.',
        sections: [
          {
            title: 'Calibración',
            body: [
              'Un modelo puede ordenar bien a las personas de mayor a menor riesgo y aun así no estar calibrado para tu país. Por eso mostramos la c-statistic como capacidad de ordenar, no como porcentaje de acierto.',
            ],
          },
          {
            title: 'La población de origen',
            body: [
              'Los coeficientes proceden de una cohorte concreta. Antes de generalizar hace falta validación externa por sexo, edad y subgrupos; mientras no exista, hay que decirlo.',
            ],
          },
          {
            title: 'Precisión aparente',
            body: [
              'Un decimal no es precisión. Fuera del rango de la cohorte (40–69) MorrowAge muestra «<40» o «>69» en lugar de una cifra exacta, y su «sensibilidad de medición» no es un intervalo de confianza.',
            ],
          },
          {
            title: 'Qué pedirle a una calculadora',
            body: [
              'Que muestre su fuente, su fórmula, sus límites y lo que no hace. Y que no se presente como diagnóstico.',
            ],
          },
        ],
      },
    },
  },
} as const;
