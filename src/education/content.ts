/**
 * Academia Elétrica — conteúdo didático original do EletriLab 3D.
 * Referências normativas citadas remetem às regras implementadas (ver aba "Regras").
 */

export interface Lesson {
  id: string;
  title: string;
  paragraphs: string[];
  keyPoints: string[];
  ruleRefs?: string[];
}

export interface Level {
  id: number;
  title: string;
  goal: string;
  lessons: Lesson[];
}

export const LEVELS: Level[] = [
  {
    id: 1,
    title: 'Fundamentos',
    goal: 'Reconhecer os condutores, as grandezas elétricas e os componentes de um quadro.',
    lessons: [
      {
        id: 'l1-condutores',
        title: 'Fase, neutro e proteção (PE)',
        paragraphs: [
          'A fase é o condutor que está em potencial em relação à terra: é por ela que a energia chega à carga. O neutro é o condutor de retorno ligado ao ponto neutro da fonte; em funcionamento normal ele conduz a corrente de volta, mas fica próximo do potencial de terra.',
          'O condutor de proteção (PE) não conduz corrente em funcionamento normal. Ele liga as partes metálicas dos equipamentos (massas) ao aterramento, oferecendo um caminho de baixa impedância para a corrente de falta e permitindo que a proteção atue.',
          'Neutro e PE têm funções diferentes e não são intercambiáveis. Por isso usam bornes, barramentos e cores próprios: azul-claro para o neutro, verde-amarelo (ou verde) para o PE.',
        ],
        keyPoints: ['Fase leva a energia; neutro retorna; PE protege.', 'Azul-claro = neutro; verde-amarelo/verde = PE.', 'Neutro e PE só se encontram na origem (conforme o esquema de aterramento).'],
        ruleRefs: ['NBR5410-IDENTIFICACAO-CORES'],
      },
      {
        id: 'l1-grandezas',
        title: 'Tensão, corrente e potência',
        paragraphs: [
          'Tensão (V) é a diferença de potencial que impulsiona a corrente. Corrente (A) é o fluxo de cargas. Potência ativa (W) é a energia convertida em trabalho ou calor por unidade de tempo.',
          'Em corrente alternada, cargas com motores ou eletrônica têm fator de potência (cos φ) menor que 1: a potência aparente (VA) é maior que a ativa. Para um circuito fase-neutro, a corrente é I = P / (U0 · cos φ).',
          'Em circuitos trifásicos equilibrados usa-se I = P / (√3 · U · cos φ). Usar a fórmula errada para o tipo de ligação é um erro comum de dimensionamento.',
        ],
        keyPoints: ['P = U · I · cos φ (monofásico).', 'S = P / cos φ.', 'Trifásico: I = P / (√3 · U · cos φ).'],
      },
      {
        id: 'l1-secao',
        title: 'Seção dos condutores',
        paragraphs: [
          'A seção nominal (mm²) é a área do condutor metálico. Quanto maior a seção, menor a resistência e maior a corrente que o condutor suporta sem ultrapassar a temperatura da isolação.',
          'A capacidade de condução não é um número fixo por seção: depende de como o cabo está instalado (embutido, em eletroduto, ao ar), da temperatura ambiente e de quantos circuitos estão agrupados.',
        ],
        keyPoints: ['Não existe "tabela universal" de ampères por bitola.', 'Seções mínimas: 1,5 mm² iluminação; 2,5 mm² força (cobre).'],
        ruleRefs: ['NBR5410-SECAO-MINIMA', 'NBR5410-CAPACIDADE'],
      },
      {
        id: 'l1-disjuntor',
        title: 'Para que serve o disjuntor',
        paragraphs: [
          'O disjuntor termomagnético protege o CONDUTOR contra sobrecargas (elemento térmico, atuação lenta) e curtos-circuitos (elemento magnético, atuação instantânea).',
          'Ele não protege pessoas contra choques de baixa intensidade: correntes de dezenas de miliampères, perigosas para o corpo humano, estão muito abaixo do que um disjuntor detecta. Essa é a função do DR.',
        ],
        keyPoints: ['Disjuntor protege o cabo.', 'DR protege pessoas (proteção adicional).', 'DPS protege equipamentos contra surtos.'],
      },
      {
        id: 'l1-componentes',
        title: 'Componentes do quadro de distribuição',
        paragraphs: [
          'Um quadro residencial típico tem: bornes de entrada, disjuntor geral, DPS, dispositivos DR, disjuntores dos circuitos terminais, barramentos de neutro e de proteção e bornes de saída.',
          'Os dispositivos modulares encaixam em trilhos DIN de 35 mm; cada módulo tem cerca de 18 mm de largura. Organização, identificação e espaço reserva facilitam a manutenção.',
        ],
        keyPoints: ['Trilho DIN 35 mm, módulos de ~18 mm.', 'Identifique cada circuito no quadro e no diagrama.'],
      },
    ],
  },
  {
    id: 2,
    title: 'Componentes de proteção',
    goal: 'Entender disjuntores, curvas de disparo, DR, DPS e barramentos.',
    lessons: [
      {
        id: 'l2-dim-disjuntor',
        title: 'Dimensionamento básico do disjuntor',
        paragraphs: [
          'A regra fundamental de coordenação é Ib ≤ In ≤ Iz: a corrente nominal do disjuntor deve ser maior que a corrente de projeto do circuito e menor que a capacidade de condução corrigida do condutor.',
          'Também é preciso que a corrente convencional de atuação I2 não ultrapasse 1,45·Iz. Para minidisjuntores I2 = 1,45·In, então essa condição é atendida quando In ≤ Iz.',
          'A capacidade de interrupção (Icn, em kA) deve ser no mínimo a corrente de curto-circuito presumida no ponto de instalação.',
        ],
        keyPoints: ['Ib ≤ In ≤ Iz.', 'I2 ≤ 1,45·Iz.', 'Icn ≥ Icc presumida.'],
        ruleRefs: ['NBR5410-SOBRECARGA', 'NBR5410-CAPACIDADE-INTERRUPCAO'],
      },
      {
        id: 'l2-curvas',
        title: 'Curvas de disparo B, C e D',
        paragraphs: [
          'A curva define a faixa de atuação instantânea (magnética): B entre 3 e 5·In, C entre 5 e 10·In, D entre 10 e 20·In. Abaixo do limite inferior não há disparo instantâneo; acima do superior o disparo é garantido.',
          'Cargas com correntes de partida altas (motores, transformadores) podem exigir curva C ou D para evitar disparos na partida. Mas quanto mais alta a curva, maior a corrente de curto necessária no fim do circuito para garantir disparo rápido.',
          'O simulador adota o limite superior (disparo garantido) e indica quando a corrente cai na faixa incerta.',
        ],
        keyPoints: ['B: 3–5·In; C: 5–10·In; D: 10–20·In.', 'Curva mais alta exige maior corrente de curto para atuar instantaneamente.'],
      },
      {
        id: 'l2-dr',
        title: 'DR e proteção diferencial',
        paragraphs: [
          'O DR compara a soma das correntes que passam por todos os seus polos. Em condições normais, o que vai pela fase volta pelo neutro e a soma é zero. Se parte da corrente escapa para a terra (fuga, choque), a soma deixa de ser zero e o DR atua.',
          'A corrente nominal In do DR indica quanto ele suporta continuamente; a sensibilidade IΔn (30 mA, 300 mA...) indica a diferença que provoca a atuação. São grandezas diferentes.',
          'Para funcionar, fase E neutro do circuito precisam passar pelo mesmo DR. Um neutro "emprestado" de outro grupo causa disparos indevidos.',
          'O teste por botão e o ensaio com instrumento verificam o funcionamento; o simulador apenas reproduz o modelo didático.',
        ],
        keyPoints: ['In ≠ IΔn.', 'Fase e neutro pelo mesmo DR.', '30 mA em banheiros, cozinhas, áreas de serviço, garagens e áreas externas.'],
        ruleRefs: ['NBR5410-DR-30MA', 'H-DR-NEUTRO'],
      },
      {
        id: 'l2-dps',
        title: 'DPS e surtos',
        paragraphs: [
          'O DPS limita sobretensões transitórias (descargas atmosféricas, manobras) desviando o surto para o PE. Liga-se entre cada condutor vivo e o PE, com condutores curtos.',
          'Seus parâmetros principais: Uc (tensão máxima de operação contínua), Up (nível de proteção), In e Imax (correntes de descarga) e Iimp (para Tipo 1). A escolha depende do esquema de aterramento, da exposição a surtos e das instruções do fabricante.',
          'O DPS não substitui disjuntor, DR nem aterramento — sem PE ele não tem para onde desviar o surto.',
        ],
        keyPoints: ['DPS entre vivo e PE.', 'Não substitui outras proteções.', 'Indicador de fim de vida exige substituição.'],
        ruleRefs: ['H-DPS-LIGACAO', 'H-DPS-UC'],
      },
      {
        id: 'l2-barramentos',
        title: 'Barramentos e distribuição',
        paragraphs: [
          'Barramentos distribuem neutro e PE para os circuitos. O barramento de neutro de um grupo de DR deve ser isolado e alimentado pelo borne de saída N\' do DR.',
          'O barramento pente interliga os bornes de linha de disjuntores adjacentes, evitando vários condutores no mesmo borne. Ele só é compatível com dispositivos da mesma família.',
        ],
        keyPoints: ['Um barramento de neutro por grupo de DR.', 'PE nunca passa por dispositivo de manobra.'],
        ruleRefs: ['NBR5410-PE-SEM-SECCIONAMENTO', 'H-PENTE'],
      },
    ],
  },
  {
    id: 3,
    title: 'Montagem',
    goal: 'Organizar o trilho, distribuir circuitos e executar as ligações.',
    lessons: [
      {
        id: 'l3-trilho',
        title: 'Organização do trilho DIN',
        paragraphs: [
          'Uma sequência lógica facilita a leitura do quadro: entrada → disjuntor geral → DPS → DR → disjuntores terminais. Agrupe os circuitos de cada DR e reserve espaço para ampliações.',
          'No EletriLab, arraste os itens da biblioteca para o trilho; eles encaixam em módulos de 18 mm. Itens sobrepostos não são aceitos.',
        ],
        keyPoints: ['Ordem: geral, DPS, DR, terminais.', 'Deixe módulos reserva.'],
      },
      {
        id: 'l3-ligacoes',
        title: 'Conexão dos condutores e identificação dos bornes',
        paragraphs: [
          'Bornes superiores costumam ser de linha (alimentação) e os inferiores de carga. Disjuntores são numerados 1-2, 3-4...; o DR identifica o neutro como N e N\'.',
          'Use a ferramenta Fio: escolha cor e seção, clique no borne de origem e depois no de destino. Em validação técnica, ligações incompatíveis (ex.: PE no barramento de neutro) são bloqueadas.',
          'Respeite o número máximo de condutores por borne; quando precisar derivar, use borne de distribuição ou pente.',
        ],
        keyPoints: ['Linha em cima, carga embaixo.', 'Um condutor por borne quando possível.'],
        ruleRefs: ['H-BORNE-COMPATIVEL', 'H-OCUPACAO-BORNE'],
      },
      {
        id: 'l3-unifilar',
        title: 'Diagrama unifilar',
        paragraphs: [
          'O diagrama unifilar representa a instalação com uma única linha por circuito, mostrando a hierarquia de proteção, seções, correntes e identificação.',
          'No EletriLab ele é gerado a partir da montagem: se um fio é removido no quadro, o circuito aparece como desconectado no diagrama. Clicar em um elemento do diagrama seleciona o mesmo elemento no quadro.',
        ],
        keyPoints: ['O diagrama é derivado da montagem real.', 'Exportação marcada como projeto didático.'],
      },
    ],
  },
  {
    id: 4,
    title: 'Dimensionamento',
    goal: 'Calcular corrente de projeto, escolher seção, verificar queda de tensão e coordenar proteções.',
    lessons: [
      {
        id: 'l4-ib',
        title: 'Corrente de projeto',
        paragraphs: [
          'Some as cargas vetorialmente (potência ativa e reativa) para obter a potência aparente do circuito. Para motores, use a potência absorvida (potência útil dividida pelo rendimento).',
          'A corrente de projeto depende do tipo de ligação (F-N, F-F, trifásico). O simulador mostra a fórmula aplicada em cada caso.',
        ],
        keyPoints: ['Motor: Pabs = Pútil / η.', 'Fórmula conforme a ligação.'],
      },
      {
        id: 'l4-metodo',
        title: 'Métodos de instalação e fatores de correção',
        paragraphs: [
          'O método de referência descreve como o cabo troca calor com o ambiente: A1 (condutores em eletroduto em parede termicamente isolante), B1 (condutores em eletroduto embutido em alvenaria ou aparente), C (cabo fixado diretamente em parede), entre outros.',
          'A capacidade de referência é corrigida pela temperatura ambiente (kθ) e pelo agrupamento de circuitos (kg): Iz = I0 · kθ · kg.',
          'Sem essas informações o simulador declara o dimensionamento inconclusivo em vez de supor condições.',
        ],
        keyPoints: ['Iz = I0 · kθ · kg.', 'Dados ausentes → inconclusivo.'],
        ruleRefs: ['NBR5410-CAPACIDADE'],
      },
      {
        id: 'l4-queda',
        title: 'Queda de tensão',
        paragraphs: [
          'A queda de tensão cresce com a corrente e o comprimento e diminui com a seção: ΔU = b · Ib · L · (R·cos φ + X·sen φ), com b = 2 para circuitos de dois condutores e √3 para trifásicos.',
          'Nos circuitos terminais a queda não pode passar de 4 %; a queda total desde o ponto de entrega é limitada a 5 % quando a alimentação é em baixa tensão da rede pública. Exercícios podem definir metas mais rígidas — elas não são limites normativos.',
        ],
        keyPoints: ['Limite terminal 4 %.', 'Limite total 5 % (fornecimento em BT).'],
        ruleRefs: ['NBR5410-QUEDA-TERMINAL', 'NBR5410-QUEDA-TOTAL'],
      },
      {
        id: 'l4-coordenacao',
        title: 'Coordenação das proteções e dados necessários',
        paragraphs: [
          'Além da sobrecarga, verifique a proteção contra curto-circuito (I²t ≤ k²S²) e a capacidade de interrupção. Sem a energia de passagem I²t informada pelo fabricante, a verificação de curto só é conclusiva com folga.',
          'Seletividade real entre disjuntores exige tabelas do fabricante; ter In a montante maior que a jusante é apenas condição necessária.',
          'Um dimensionamento completo exige: cargas, tensão, ligação, comprimento, método, temperatura, agrupamento, Icc presumida e dados do dispositivo.',
        ],
        keyPoints: ['I²t ≤ k²S².', 'Seletividade depende do fabricante.', 'Liste os dados que faltam.'],
        ruleRefs: ['NBR5410-CURTO-CIRCUITO', 'H-SELETIVIDADE'],
      },
    ],
  },
  {
    id: 5,
    title: 'Diagnóstico',
    goal: 'Localizar falhas de ligação, sobrecargas, continuidade e identificação.',
    lessons: [
      {
        id: 'l5-metodo',
        title: 'Método de diagnóstico',
        paragraphs: [
          'Comece pelo terminal de diagnóstico: erros confirmados primeiro, depois alertas e itens inconclusivos. Em seguida use os instrumentos virtuais para confirmar hipóteses.',
          'Com a instalação desenergizada, meça continuidade e resistência. Energizada, meça tensões e correntes. O ohmímetro é bloqueado com a instalação energizada.',
        ],
        keyPoints: ['Erros → alertas → inconclusivos.', 'Continuidade só desenergizado.'],
      },
      {
        id: 'l5-medicoes',
        title: 'Interpretação de medições',
        paragraphs: [
          'Tensão de fase entre o neutro na carga e o PE indica neutro interrompido. Tensão entre massa e terra indica PE ausente com falha de isolação.',
          'O alicate em torno de fase e neutro juntos (sem o PE) mede a soma vetorial: o resultado é a corrente de fuga. Envolver também o PE anula a leitura, porque a fuga retorna pelo próprio PE.',
          'Corrente acima de In por muito tempo leva ao disparo térmico; corrente muito alta leva ao disparo magnético instantâneo.',
        ],
        keyPoints: ['Alicate em F+N = fuga.', 'Neutro aberto = tensão no neutro da carga.'],
      },
    ],
  },
  {
    id: 6,
    title: 'Projeto completo',
    goal: 'Montar e validar o quadro de uma residência fictícia.',
    lessons: [
      {
        id: 'l6-roteiro',
        title: 'Roteiro de projeto',
        paragraphs: [
          '1) Defina alimentação, tensão e esquema de aterramento. 2) Cadastre os circuitos com cargas, ambientes, comprimento e condições de instalação. 3) Dimensione seções e disjuntores. 4) Monte o quadro: geral, DPS, DR, terminais e barramentos. 5) Ligue os condutores com cores corretas. 6) Valide e corrija. 7) Energize e teste.',
          'A avaliação não aceita a atividade como concluída enquanto houver erros confirmados.',
        ],
        keyPoints: ['Siga o roteiro.', 'Sem erros críticos para concluir.'],
      },
    ],
  },
];
