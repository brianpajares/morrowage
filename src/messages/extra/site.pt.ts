import type { Shape } from '../util';
import type { siteEs } from './site.es';

export const sitePt: Shape<typeof siteEs> = {
  meta: {
    siteName: 'MorrowAge',
    title: 'MorrowAge · Sua idade equivalente de risco, com contexto',
    description:
      'Transforme 8 dados do dia a dia em uma idade equivalente de risco populacional em menos de 90 segundos. Cálculo determinístico, fontes visíveis e limites explícitos. Não é idade biológica nem diagnóstico.',
    ogAlt: 'MorrowAge: idade equivalente de risco com contexto',
  },
  nav: {
    home: 'MorrowAge, início',
    primary: 'Navegação principal',
    howItWorks: 'Como funciona',
    methodology: 'Metodologia',
    faq: 'Perguntas frequentes',
    menu: 'Menu',
    start: 'Calcular',
  },
  a11y: {
    skipToContent: 'Ir para o conteúdo',
    language: 'Idioma',
    theme: 'Tema de cores',
    themeSystem: 'Sistema',
    themeLight: 'Claro',
    themeDark: 'Escuro',
    opensInNewTab: 'abre em uma nova aba',
    loading: 'Carregando',
    close: 'Fechar',
    required: 'obrigatório',
  },
  footer: {
    tagline: 'Estimativa educativa baseada em dados populacionais.',
    notMedical: 'Estimativa educativa populacional · Não é aconselhamento médico.',
    legal: 'Legal',
    privacy: 'Privacidade',
    terms: 'Termos',
    deleteData: 'Apagar meus dados',
    methodology: 'Metodologia',
    guides: 'Guias',
    copyright: '© {year} MorrowAge. Nome de trabalho; disponibilidade de marca em revisão.',
    version: 'Modelo v{model} · App v{app}',
  },
  landing: {
    demoLabel: 'Exemplo ilustrativo · dados sintéticos',
    demoCaption: 'Comparação entre idade cronológica e idade equivalente de risco (exemplo).',
    demoChrono: 'Cronológica',
    demoMorrow: 'Equivalente de risco',
    howLink: 'Como funciona',
    stepsTitle: 'O que o MorrowAge faz',
    steps: [
      {
        title: '8 dados do dia a dia',
        body: 'Idade, sono, saúde autoavaliada, cigarros, tempo de reação, cintura/altura, álcool e frequência cardíaca de repouso. Sem exames de laboratório.',
      },
      {
        title: 'Cálculo determinístico',
        body: 'Coeficientes publicados de um modelo de sobrevivência. O número sai de uma fórmula reproduzível, não de um LLM.',
      },
      {
        title: 'Contexto, não só o número',
        body: 'Uma idade equivalente de risco frente ao benchmark do mesmo modelo, com fontes, premissas e limites à vista.',
      },
    ],
    inputsTitle: 'Os 8 dados que usamos',
    inputsBody: 'Não pedimos nome, data de nascimento nem endereço para calcular.',
    deliverTitle: 'O que você recebe',
    freeTitle: 'Prévia gratuita',
    freeItems: [
      'Seu MorrowAge (idade equivalente de risco) ao lado da sua idade cronológica',
      'Hazard relativo frente ao benchmark, como detalhe técnico',
      'A associação que mais moveu o seu resultado',
    ],
    fullTitle: 'Relatório completo',
    fullBadge: 'Grátis nesta fase',
    fullItems: [
      'Sensibilidade de medição (não é um intervalo de confiança)',
      'Todas as associações, ordenadas por peso',
      'Cenários educativos que você pode explorar',
      'Metodologia, premissas e fontes · PDF para baixar',
    ],
    notTitle: 'O que o MorrowAge não é',
    notItems: [
      'Não é a sua idade biológica nem mede a idade dos seus órgãos.',
      'Não é um diagnóstico nem aconselhamento médico.',
      'Não prevê quanto tempo você viverá nem calcula uma probabilidade de morte.',
      'Não usa um LLM para gerar o número: é uma fórmula pública e reproduzível.',
    ],
    methodTitle: 'Metodologia à vista',
    methodBody:
      'Usamos os coeficientes publicados do modelo de Cox «raw-input» de Clift et al. (2021), construído com dados do UK Biobank. Seu resultado compara o seu perfil com um benchmark do mesmo modelo. Foi pensado para adultos de 40 a 69 anos.',
    finalTitle: 'Pronto em menos de 90 segundos',
    finalBody: 'Faixa de uso: 40–69 anos. Estimativa educativa; não substitui cuidados médicos.',
  },
  howItWorks: {
    metaTitle: 'Como o MorrowAge funciona',
    metaDescription:
      'De oito dados a uma idade equivalente de risco: a fórmula, o benchmark e o que o resultado significa. Sem LLM para o número.',
    title: 'Como funciona',
    lede: 'O MorrowAge transforma oito dados simples em uma idade equivalente de risco populacional usando coeficientes publicados. Aqui está o caminho completo, sem caixas-pretas.',
    s1Title: '1 · Oito dados',
    s1Body:
      'Idade, horas de sono, saúde autoavaliada, cigarros por dia, tempo de reação, relação cintura/altura, álcool semanal (em unidades UK) e frequência cardíaca de repouso.',
    s2Title: '2 · Um preditor linear',
    s2Body:
      'Cada dado é comparado com um perfil de referência (benchmark) do mesmo modelo. A diferença, ponderada pelos coeficientes do modelo, forma o preditor linear sem idade.',
    s3Title: '3 · Idade equivalente de risco',
    s3Body:
      'O termo de idade do modelo é invertido: em que idade o perfil de referência teria o mesmo risco relativo que você? Essa idade é o seu MorrowAge.',
    formulaTitle: 'A fórmula',
    formulaNote:
      'LP_nonage é a soma de coeficiente × valor dos sete dados que não são idade; LP_benchmark é a mesma soma para o perfil de referência; β_log_age é o coeficiente do logaritmo da idade no modelo publicado.',
    meansTitle: 'O que significa',
    means:
      'Se o seu MorrowAge é 47 e a sua idade é 52, a sua combinação de dados tem um preditor de risco parecido com o de um perfil de referência mais jovem dentro deste modelo.',
    notMeansTitle: 'O que não significa',
    notMeans:
      'Não significa que os seus órgãos tenham 47 anos nem que você viverá mais ou menos uma quantidade concreta de anos.',
    limitsTitle: 'Limites que você sempre verá',
    limits: [
      'Fora de 40–69 mostramos «<40» ou «>69», nunca um número exato: o modelo foi construído com pessoas de 40 a 69 anos.',
      'A «sensibilidade de medição» mostra como o resultado muda se algumas medições variarem; não é um intervalo de confiança.',
      'Não mostramos risco absoluto em 10 anos nem percentis por país: faltam dados de calibração verificados.',
      'As variáveis são associações populacionais, não provas de causalidade.',
    ],
    cta: 'Calcular meu MorrowAge',
    methodLink: 'Ver a metodologia completa',
  },
  faq: {
    metaTitle: 'Perguntas frequentes · MorrowAge',
    metaDescription:
      'É idade biológica? Prevê quanto tempo viverei? O que significam <40 ou >69? Respostas claras sobre escopo, limites e dados.',
    title: 'Perguntas frequentes',
    lede: 'Respostas curtas às dúvidas mais comuns. Para o detalhe técnico, visite a metodologia.',
    items: [
      {
        q: 'É a minha idade biológica?',
        a: 'Não. O MorrowAge é uma idade equivalente de risco populacional: compara o seu perfil com um benchmark do mesmo modelo. Não mede a idade dos seus órgãos nem usa exames laboratoriais ou epigenéticos.',
      },
      {
        q: 'Prevê quanto tempo eu viverei?',
        a: 'Não. É uma estimativa educativa baseada em associações de uma grande coorte, não uma previsão individual de longevidade nem uma probabilidade de morte.',
      },
      {
        q: 'Por que não vejo um risco de mortalidade em 10 anos?',
        a: 'Para converter um modelo de Cox em probabilidade absoluta é preciso, além dos coeficientes, uma curva de sobrevivência basal verificada. A fonte que usamos não a publica de forma reconstruível e não a inventamos. Só será habilitada após uma recalibração e validação adequadas.',
      },
      {
        q: 'O que significam «<40» e «>69»?',
        a: 'A transformação matemática pode gerar uma idade equivalente fora da faixa de 40 a 69 anos, que é a da coorte de origem. Para não fingir uma precisão que não existe, mostramos «<40» ou «>69» em vez de um número exato.',
      },
      {
        q: 'A «sensibilidade de medição» é um intervalo de confiança?',
        a: 'Não. Mostra como o resultado mudaria se algumas medições variassem dentro de faixas razoáveis (sempre dentro dos limites do modelo). É um cenário de medição, não um intervalo estatístico.',
      },
      {
        q: 'O que acontece com os meus dados?',
        a: 'Pedimos apenas o necessário: os oito dados para calcular e o seu e-mail se quiser receber o relatório. O consentimento de marketing é opcional e separado. A análise e o painel de administração não recebem os seus dados de saúde. Você pode solicitar a exclusão a qualquer momento.',
      },
      {
        q: 'Por que um dado pode «piorar» o resultado de forma contraintuitiva?',
        a: 'Porque o modelo capta associações populacionais, não causas. Alguns coeficientes podem parecer contraintuitivos por confusão ou por relações não lineares; por isso nunca transformamos o sinal de um coeficiente em conselho.',
      },
      {
        q: 'Por que apenas de 40 a 69 anos?',
        a: 'É a faixa etária da coorte com a qual o modelo foi estimado. Fora dela não extrapolamos.',
      },
      {
        q: 'Quanto custa?',
        a: 'Nesta fase de validação, a prévia e o relatório completo são gratuitos. Se isso mudar, você verá antes de informar qualquer dado de pagamento.',
      },
      {
        q: 'Como apago os meus dados?',
        a: 'Na página «Apagar meus dados» você pode registrar uma solicitação. Nós a resolvemos conforme as obrigações legais e de retenção aplicáveis.',
      },
    ],
    stillQuestions: 'Quer ver exatamente como é calculado?',
    methodLink: 'Ir para a metodologia',
  },
  notFound: {
    title: 'Não encontramos essa página',
    body: 'O endereço pode ter mudado ou o link pode ter expirado.',
    home: 'Voltar ao início',
  },
  common: {
    loading: 'Carregando…',
    retry: 'Tentar novamente',
    close: 'Fechar',
    yes: 'Sim',
    no: 'Não',
    optional: 'opcional',
    learnMore: 'Saiba mais',
    backHome: 'Voltar ao início',
    sources: 'Fontes',
  },
  variables: {
    age_years: { label: 'Idade', driver: 'a sua idade', unit: 'anos' },
    sleep_hours: { label: 'Horas de sono', driver: 'as suas horas de sono', unit: 'h/noite' },
    self_rated_health: { label: 'Saúde autoavaliada', driver: 'a sua saúde autoavaliada', unit: '' },
    cigarettes_per_day: {
      label: 'Cigarros por dia',
      driver: 'os cigarros que você fuma por dia',
      unit: 'cig/dia',
    },
    reaction_time_ms: { label: 'Tempo de reação', driver: 'o seu tempo de reação', unit: 'ms' },
    waist_to_height_ratio: {
      label: 'Relação cintura/altura',
      driver: 'a sua relação cintura/altura',
      unit: '',
    },
    alcohol_units_week: {
      label: 'Álcool semanal',
      driver: 'o seu consumo semanal de álcool',
      unit: 'unidades UK/sem.',
    },
    resting_hr_bpm: { label: 'Frequência cardíaca de repouso', driver: 'a sua frequência cardíaca de repouso', unit: 'bpm' },
    direction: {
      higher: 'Associado a uma estimativa maior que o benchmark',
      lower: 'Associado a uma estimativa menor que o benchmark',
      neutral: 'Sem diferença relevante frente ao benchmark',
    },
    benchmarkWeighted: 'média ponderada do UK Biobank',
    benchmarkNever: '0 (referência: nunca fumou)',
  },
};
