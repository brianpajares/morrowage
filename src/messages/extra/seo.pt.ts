import type { Shape } from '../util';
import type { seoEs } from './seo.es';

export const seoPt: Shape<typeof seoEs> = {
  calculatorPage: {
    metaTitle: 'Calculadora de idade equivalente de risco',
    metaDescription:
      'Calcule a sua idade equivalente de risco populacional com 8 dados do dia a dia em menos de 90 segundos. Fórmula pública, fontes visíveis, sem laboratório. Não é idade biológica.',
    h1: 'Calculadora de idade equivalente de risco',
    lede: 'Informe oito dados do dia a dia e compare o seu perfil com um benchmark de um modelo publicado. O cálculo é determinístico e a fórmula é pública.',
    sections: [
      {
        title: 'O que é uma idade equivalente de risco?',
        body: [
          'É a idade em que um perfil de referência teria, dentro do mesmo modelo, um risco relativo parecido com o seu. Serve para dar contexto aos seus dados, não para medir a idade dos seus órgãos.',
        ],
      },
      {
        title: 'Quais dados você precisa?',
        body: [
          'Sua idade (40–69), horas de sono, como você avalia a sua saúde, cigarros por dia, seu tempo de reação (há um teste integrado), cintura e altura, álcool semanal e frequência cardíaca de repouso. Nenhum exige laboratório.',
        ],
      },
      {
        title: 'O que você verá?',
        body: [
          'Uma prévia gratuita com o seu MorrowAge e a associação que mais pesa no resultado. No relatório completo: sensibilidade de medição, todas as associações, cenários educativos, metodologia e um PDF.',
        ],
      },
      {
        title: 'O que não é?',
        body: [
          'Não é idade biológica, nem um diagnóstico, nem uma previsão de quanto tempo você viverá, nem uma probabilidade de morte. É uma estimativa educativa baseada em associações populacionais.',
        ],
      },
    ],
    cta: 'Calcular meu MorrowAge',
  },
  country: {
    metaTitle: 'Idade equivalente de risco em {country}',
    metaDescription:
      'O MorrowAge não está calibrado especificamente para {country}: o que isso significa, o que não mostramos e como usar o resultado com cautela.',
    h1: 'Idade equivalente de risco em {country}',
    notice: 'O modelo não está calibrado especificamente para este país',
    paragraphs: [
      'O MorrowAge usa os coeficientes do modelo de Clift et al. (2021), construído com dados do UK Biobank. Essa coorte não é uma amostra representativa de {country}.',
      'Por isso não mostramos percentis nem comparações nacionais para {country} e não afirmamos que o resultado esteja calibrado localmente. É uma estimativa educativa que compara o seu perfil com o benchmark do próprio modelo.',
      'Se você tem entre 40 e 69 anos, pode calcular o seu MorrowAge mesmo assim; interprete o resultado tendo em mente esses limites. A calibração local será avaliada com dados verificados antes de oferecer qualquer comparação nacional.',
    ],
    cta: 'Calcular meu MorrowAge',
    methodLink: 'Ver metodologia e limites',
  },
  guides: {
    metaTitle: 'Guias · MorrowAge',
    indexTitle: 'Guias',
    indexLede: 'Textos curtos para interpretar com critério uma idade equivalente de risco.',
    readGuide: 'Ler o guia',
    cta: 'Calcular meu MorrowAge',
    items: {
      'risk-equivalent-age-vs-biological-age': {
        title: 'Idade equivalente de risco versus idade biológica',
        description: 'Duas ideias que se confundem: o que cada uma calcula, o que sabemos e por que o MorrowAge não usa o termo «biológica».',
        sections: [
          {
            title: 'Duas ideias diferentes',
            body: [
              'A «idade biológica» costuma ser apresentada como a idade do seu corpo segundo marcadores biológicos (por exemplo, exames laboratoriais ou epigenéticos). Uma idade equivalente de risco é outra coisa: traduz um risco relativo, calculado com um modelo estatístico, na idade que um perfil de referência teria com esse mesmo risco.',
            ],
          },
          {
            title: 'O que o MorrowAge calcula',
            body: [
              'O MorrowAge combina oito dados do dia a dia com coeficientes publicados de um modelo de sobrevivência. O resultado compara o seu perfil com um benchmark do mesmo modelo. Não mede nenhum biomarcador.',
            ],
          },
          {
            title: 'Por que evitamos o termo «biológica»',
            body: [
              'Porque sugere uma medição do estado dos seus órgãos que este cálculo não faz. Preferimos um nome que diga o que é: uma idade equivalente de risco populacional.',
            ],
          },
          {
            title: 'Como ler o seu resultado',
            body: [
              'Use-o como contexto, junto com seus limites: é uma associação populacional, não um diagnóstico nem uma previsão individual. Se gerar dúvidas sobre a sua saúde, converse com um profissional de saúde.',
            ],
          },
        ],
      },
      'how-to-read-associations': {
        title: 'Como ler associações: por que um dado pode parecer contraintuitivo',
        description: 'Associação não é causa: confusão, relações não lineares e por que nunca transformamos o sinal de um coeficiente em conselho.',
        sections: [
          {
            title: 'Associação não é causa',
            body: [
              'Um modelo estatístico descreve como as variáveis se movem juntas em um grande grupo de pessoas. Que duas coisas andem juntas nos dados não significa que uma cause a outra.',
            ],
          },
          {
            title: 'Por que algo pode parecer contraintuitivo',
            body: [
              'Há fatores que não aparecem no modelo (confusão) e relações que não são uma linha reta. Um coeficiente pode sair com um sinal inesperado sem que isso seja uma recomendação.',
            ],
          },
          {
            title: 'O que fazemos a respeito',
            body: [
              'Nunca transformamos o sinal de um coeficiente em conselho (por exemplo, não sugerimos dormir menos ou beber mais). Os cenários do relatório exploram apenas reduções de dados que uma pessoa reconhece como modificáveis, e são exercícios de recálculo, não previsões.',
            ],
          },
        ],
      },
      'limits-of-biological-age-calculators': {
        title: 'Limites das calculadoras de idade biológica',
        description: 'Calibração, populações de origem e precisão aparente: o que perguntar a qualquer calculadora de idade.',
        sections: [
          {
            title: 'Calibração',
            body: [
              'Um modelo pode ordenar bem as pessoas de maior para menor risco e, ainda assim, não estar calibrado para o seu país. Por isso apresentamos a c-statistic como capacidade de ordenar, não como porcentagem de acerto.',
            ],
          },
          {
            title: 'A população de origem',
            body: [
              'Os coeficientes vêm de uma coorte específica. Antes de generalizar é preciso validação externa por sexo, idade e subgrupos; enquanto ela não existir, é preciso dizer isso.',
            ],
          },
          {
            title: 'Precisão aparente',
            body: [
              'Uma casa decimal não é precisão. Fora da faixa da coorte (40–69), o MorrowAge mostra «<40» ou «>69» em vez de um número exato, e a sua «sensibilidade de medição» não é um intervalo de confiança.',
            ],
          },
          {
            title: 'O que pedir a uma calculadora',
            body: [
              'Que mostre a sua fonte, a sua fórmula, os seus limites e o que não faz. E que não se apresente como diagnóstico.',
            ],
          },
        ],
      },
    },
  },
};
