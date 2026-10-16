import type { Shape } from '../util';
import type { legalEs } from './legal.es';

export const legalPt: Shape<typeof legalEs> = {
  privacy: {
    metaTitle: 'Política de privacidade · MorrowAge',
    metaDescription:
      'Quais dados o MorrowAge trata, para quê, por quanto tempo os mantém, com quem os compartilha e como exercer seus direitos, incluindo a exclusão.',
    title: 'Política de privacidade',
    updated: 'Versão preliminar sujeita a revisão jurídica antes do lançamento público · Última atualização: {date}',
    lede: 'Pedimos o mínimo necessário. Aqui explicamos o que tratamos, por quê e como você pode controlar.',
    contactLine: 'Você também pode escrever para {email}.',
    sections: [
      {
        title: 'Quem trata os seus dados',
        body: [
          'O MorrowAge (nome de trabalho) é o controlador dos dados descritos nesta política. A entidade jurídica titular do serviço será identificada nesta página antes do lançamento público.',
          'Para exercer seus direitos, inclusive a exclusão, use a página «Apagar meus dados».',
        ],
      },
      {
        title: 'Quais dados tratamos',
        body: [
          'Para calcular: os oito dados que você informa (idade, sono, saúde autoavaliada, cigarros, tempo de reação, cintura e altura —que convertemos em uma relação—, álcool semanal e frequência cardíaca de repouso). São dados de bem-estar e, conforme a sua jurisdição, podem ser considerados dados sensíveis de saúde.',
          'Para entregar o seu relatório: seu e-mail, a data do seu consentimento de serviço e, apenas se você marcar, o consentimento de marketing e o da lista de espera de assinatura (separados e opcionais).',
          'Dados técnicos mínimos: um cookie técnico de sessão, seu endereço IP para limitar abusos (como hash no limitador de requisições) e o tipo de dispositivo de forma agregada.',
          'Não pedimos nome, data de nascimento nem endereço.',
        ],
      },
      {
        title: 'Para que os usamos',
        body: [
          'Calcular o seu resultado, mostrar a prévia e entregar o seu relatório: é o serviço que você solicita.',
          'Segurança e prevenção de abuso (legítimo interesse).',
          'Melhorar o produto com métricas agregadas da jornada (sem dados de saúde, sem e-mail e sem resultados).',
          'Marketing: somente se você aceitar de forma expressa e separada; pode retirar quando quiser.',
          'Projetamos o tratamento para respeitar o GDPR (UE), a CCPA/CPRA (Califórnia), a LGPD (Brasil) e a Lei 29733 (Peru). Seus direitos concretos dependem de onde você vive.',
        ],
      },
      {
        title: 'Cópia operacional na fase de validação',
        body: [
          'Enquanto o MorrowAge estiver em fase de validação, a equipe recebe uma cópia da sua solicitação (e-mail, dados informados, resultado e PDF) em uma caixa operacional de acesso restrito, apenas para validar o produto e prestar suporte.',
          'Essa cópia não é enviada a ferramentas de análise nem ao painel de administração, e é eliminada conforme a retenção indicada abaixo.',
        ],
      },
      {
        title: 'Por quanto tempo os mantemos',
        body: [
          'Cálculos e relatórios: no máximo {retentionDays} dias. Os links de relatório expiram após {tokenDays} dias.',
          'Seu e-mail e seus consentimentos são mantidos enquanto forem necessários para entregar o serviço; o consentimento de marketing, até você retirá-lo.',
          'Se você comprar um relatório, mantemos o registro do pedido pelo tempo que a norma contábil exigir.',
        ],
      },
      {
        title: 'Com quem os compartilhamos',
        body: [
          'Hospedagem e banco de dados: Vercel e Supabase. Envio de e-mails: Resend.',
          'Proteção contra abuso: Cloudflare Turnstile e Upstash (limite de requisições).',
          'Análise da jornada, sem dados de saúde: PostHog. Monitoramento de erros com dados redigidos: Sentry.',
          'Arquivos de configuração do produto, sem dados pessoais: Google Drive. Pagamentos (quando ativos): PayPal, que processa a cobrança com PayPal ou cartão; Stripe, apenas se for ativado.',
          'Esses provedores podem tratar dados nos Estados Unidos e em outros países; aplicamos as garantias contratuais correspondentes. Não vendemos os seus dados.',
        ],
      },
      {
        title: 'Seus direitos',
        body: [
          'Você pode solicitar acesso, retificação, eliminação, oposição ou limitação, portabilidade e retirar o consentimento quando o tratamento se basear nele. Também pode reclamar à sua autoridade de proteção de dados.',
          'Solicite a exclusão na página «Apagar meus dados»; resolvemos conforme as obrigações legais e de retenção aplicáveis.',
        ],
      },
      {
        title: 'Segurança',
        body: [
          'Conexões criptografadas (HTTPS com HSTS), links de relatório não adivinháveis e com expiração, tokens guardados apenas como hash, acesso aos dados restrito por regras de segurança em nível de linha e registros sem dados pessoais.',
        ],
      },
      {
        title: 'Cookies e armazenamento local',
        body: [
          'Usamos um cookie técnico (HttpOnly) para vincular o seu cálculo ao seu navegador por 24 horas, e o armazenamento da aba para lembrar as suas respostas durante a sessão e a sua preferência de tema.',
          'Não usamos cookies de publicidade nem de rastreamento e respeitamos os sinais Global Privacy Control e Do Not Track.',
        ],
      },
      {
        title: 'Menores e escopo',
        body: ['O MorrowAge é para adultos de 40 a 69 anos. Não é direcionado a menores de idade.'],
      },
      {
        title: 'Alterações',
        body: ['Publicaremos aqui qualquer alteração relevante antes de ela entrar em vigor.'],
      },
    ],
  },
  terms: {
    metaTitle: 'Termos de serviço · MorrowAge',
    metaDescription:
      'Condições de uso do MorrowAge: serviço educativo e de bem-estar, não é aconselhamento médico, escopo de 40 a 69 anos e limitações do modelo.',
    title: 'Termos de serviço',
    updated: 'Versão preliminar sujeita a revisão jurídica antes do lançamento público · Última atualização: {date}',
    lede: 'Usar o MorrowAge implica aceitar estas condições. Leia com calma: são curtas.',
    sections: [
      {
        title: 'O que é o serviço',
        body: [
          'O MorrowAge oferece uma estimativa educativa e de bem-estar: uma idade equivalente de risco populacional, calculada com coeficientes publicados de um modelo estatístico e comparada com um benchmark do mesmo modelo.',
        ],
      },
      {
        title: 'Não é aconselhamento médico',
        body: [
          'O serviço não diagnostica, não trata, não previne nem mitiga nenhuma doença e não substitui o atendimento de um profissional de saúde. Não o use em emergências nem para tomar decisões médicas.',
          'Se tiver dúvidas sobre a sua saúde, consulte um profissional que possa avaliá-lo individualmente.',
        ],
      },
      {
        title: 'Quem pode usar e para quê',
        body: [
          'O MorrowAge v1 é para adultos de 40 a 69 anos. Não deve ser usado durante a gravidez nem em doença terminal.',
          'Não use o resultado para decisões trabalhistas, de seguros, de crédito nem de elegibilidade de nenhum tipo.',
        ],
      },
      {
        title: 'Exatidão e limitações',
        body: [
          'O resultado baseia-se em associações populacionais e não estabelece causas. O modelo não está calibrado especificamente para o seu país e não foi validado externamente por subgrupos.',
          'Fora da faixa de 40 a 69 anos mostramos «<40» ou «>69»; não mostramos risco absoluto em 10 anos nem percentis nacionais. Não garantimos que o resultado seja exato nem adequado a uma finalidade específica.',
        ],
      },
      {
        title: 'Seus dados e consentimentos',
        body: ['O tratamento dos seus dados está descrito na política de privacidade. O consentimento de marketing é opcional e independente do serviço.'],
      },
      {
        title: 'Relatórios e links',
        body: [
          'O link do seu relatório é pessoal e expira após {tokenDays} dias. Não o compartilhe: quem o tiver pode ver o seu relatório.',
          'Você pode baixar o PDF enquanto o link estiver vigente.',
        ],
      },
      {
        title: 'Preço',
        body: [
          'Seu resultado e a prévia do relatório são gratuitos. O relatório completo é um produto digital de pagamento único, sem assinatura; o preço é mostrado antes de pagar.',
          'O pagamento é processado pelo PayPal (com PayPal ou cartão). O MorrowAge não armazena os dados do seu cartão. O relatório completo é entregue imediatamente por e-mail, em PDF.',
          'Ao comprar, você aceita a entrega imediata do conteúdo digital e reconhece que, depois de entregue, renuncia ao direito de arrependimento. Se você não receber o relatório ou houver uma cobrança incorreta, escreva para nós e resolveremos, inclusive com reembolso quando aplicável.',
        ],
      },
      {
        title: 'Propriedade intelectual e licenças',
        body: [
          'O cálculo usa os coeficientes publicados por Clift et al. (2021), disponíveis sob a licença CC BY do artigo. Não se usa o C-Score proprietário. A marca, o design e o código do MorrowAge pertencem ao titular do serviço.',
        ],
      },
      {
        title: 'Limitação de responsabilidade',
        body: [
          'Na medida permitida por lei, o serviço é oferecido «como está», sem garantias, e não assumimos responsabilidade pelas decisões que você tomar com base no resultado.',
        ],
      },
      {
        title: 'Alterações, lei aplicável e contato',
        body: [
          'Podemos atualizar estes termos e indicaremos nesta página. A lei e a jurisdição aplicáveis dependerão do seu local de residência e da entidade titular do serviço, que será identificada antes do lançamento público.',
        ],
      },
    ],
  },
  deleteRequest: {
    metaTitle: 'Apagar meus dados · MorrowAge',
    metaDescription: 'Solicite a exclusão dos seus dados no MorrowAge. Registramos o seu pedido e o resolvemos conforme as obrigações legais aplicáveis.',
    title: 'Apagar meus dados',
    lede: 'Informe o e-mail com o qual você pediu o seu relatório. Registramos o seu pedido e o resolvemos conforme as obrigações legais e de retenção aplicáveis.',
    emailLabel: 'E-mail do seu pedido',
    vidLabel: 'ID de verificação (opcional)',
    vidHelp: 'Aparece no seu relatório e no seu e-mail. Ajuda a localizar o seu pedido.',
    submit: 'Solicitar exclusão',
    submitting: 'Enviando…',
    successTitle: 'Solicitação recebida',
    successBody: 'Registramos o seu pedido com o número {id}. Responderemos por e-mail quando estiver resolvido.',
    note: 'Nenhum dado sensível é enviado a ferramentas de análise ao registrar este pedido.',
    errors: {
      generic: 'Não conseguimos registrar o seu pedido. Tente novamente.',
      rate: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
      vid: 'O ID de verificação não tem o formato esperado (por exemplo MA-26-8F3C2A).',
      turnstile: 'Não conseguimos verificar que você é uma pessoa. Recarregue a página e tente novamente.',
    },
  },
};
