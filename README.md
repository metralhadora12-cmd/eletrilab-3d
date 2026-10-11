# EletriLab 3D

Laboratório virtual **educacional** de instalações elétricas residenciais: montagem 3D de quadros de distribuição (QDC), dimensionamento de condutores e proteções, simulação de funcionamento e falhas, diagrama unifilar sincronizado e uma Academia Elétrica com desafios progressivos.

> ⚠️ **Ferramenta educacional.** O EletriLab 3D não substitui projeto elétrico, profissional legalmente habilitado, inspeções ou ensaios de campo. Nenhum resultado do simulador constitui declaração de conformidade com a ABNT NBR 5410. Veja [Limitações](#limitações) e [TECHNICAL_SOURCES.md](TECHNICAL_SOURCES.md).

---

## Instalação e execução

Requisitos: **Node.js 18+** (testado com Node 24) e npm.

```bash
npm install
```

```bash
npm run dev
```

Abra `http://localhost:5173`. Outros comandos:

| Comando | Função |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | Verificação de tipos (`tsc`) + build de produção em `dist/` |
| `npm run preview` | Serve o build de produção |
| `npm test` | Executa os testes automatizados (Vitest) |
| `npm run typecheck` | Somente verificação de tipos |

Nenhuma funcionalidade essencial depende de serviços externos: texturas e rótulos 3D são gerados em canvas, o mapa de ambiente é procedural (`RoomEnvironment`) e os projetos ficam no armazenamento local do navegador.

---

## O que o aplicativo faz

### Montagem 3D
- Quadro de **sobrepor** ou **embutir**, com 1 a 5 trilhos DIN de 12 a 36 módulos, porta animada, tampa de proteção (espelho) removível, modos de **transparência** e **corte**.
- Biblioteca pesquisável: disjuntores 1P–4P (curvas B/C/D, In, Icn configuráveis), DR 2P/4P (In, IΔn, tipo AC/A/F/B), DPS Tipo 1, 2 e 3, barramentos de neutro e PE para trilho, bornes de passagem/terra/distribuição, barramentos pente 1F/2F/3F e um disjuntor “sem ficha técnica” para demonstrar dados desconhecidos.
- Inserção por **clique** ou **arrastar e soltar**, com encaixe magnético em módulos de 18 mm; reposicionamento arrastando; remoção (Del).
- **Ferramenta Fio**: escolha cor e seção, clique no borne de origem e no de destino (ou arraste). Bornes compatíveis ficam verdes; em validação técnica, ligações incompatíveis são bloqueadas.
- Condutores 3D com traçado ortogonal pelos canais entre trilhos, cantos arredondados, espessura proporcional à seção, verde-amarelo listrado, folga ajustável (altera traçado **e** comprimento elétrico).
- Câmera: órbita, zoom, pan, enquadrar, perspectiva, **frontal ortográfica**, aproximação dos bornes, vista lateral e alternância 3D ↔ diagrama.

### Motor elétrico (independente da interface)
- Corrente de projeto por tipo de ligação (F-N, F-F, 3F, 3F+N), soma vetorial de cargas, fator de potência e rendimento.
- Capacidade de condução corrigida (`Iz = I0·kθ·kg`), queda de tensão com R e X, seção mínima por critério, coordenação `Ib ≤ In ≤ Iz` e `I2 ≤ 1,45·Iz`, verificação adiabática `I²t ≤ k²S²`, capacidade de interrupção e estimativa de curto-circuito.
- **Resultados inconclusivos** quando faltam dados (“Dimensionamento inconclusivo: informe as condições de instalação”) — nada é presumido.
- O dimensionamento informa, para **cada seção**, o motivo de aprovação ou reprovação.

### Simulação (modo seguro, totalmente virtual)
- **Solver nodal complexo** (fasores 60 Hz) de todo o quadro: fonte trifásica com impedância, fios com resistência real (comprimento do traçado 3D), polos, cabos dos circuitos, cargas e falhas.
- Energização, manobra de disjuntores/DR (clique na alavanca), fluxo de corrente animado, lâmpadas das cargas com brilho proporcional a V².
- Falhas: sobrecarga, curto F-N / F-F / F-massa, fuga à massa, PE interrompido, neutro interrompido, toque de pessoa na massa, condutor interrompido, ligações incorretas de N/PE.
- Atuação didática: disparo magnético, modelo térmico, disparo diferencial do DR (inclusive por neutro “misturado”), botão de teste do DR, surto ilustrativo com DPS normal/fim de vida.

### Instrumentos virtuais
Multímetro (V, Ω/continuidade — bloqueado se energizado —, A em série), alicate (fase ou fase+neutro = fuga), testador de DR (0,5/1/2/5×IΔn), indicador de tensão, verificador de continuidade do PE, medidor de potência e parâmetros da alimentação. Todas as leituras vêm do solver — nenhum número aleatório.

### Validação técnica (NormativeRules)
- Camada independente em `src/normative/` com identificador, descrição, fonte, edição, cláusula (com indicação “a confirmar”), aplicabilidade, parâmetros, severidade, mensagem didática e **estado de verificação** de cada regra.
- Regras **normativas** separadas das **heurísticas educacionais**.
- Perfis: **aprendizado** (permite experimentar), **técnico** (bloqueia incompatibilidades e destaca dados ausentes) e **desafio**.
- Severidades distintas: erro confirmado, alerta (incompatibilidade potencial), inconclusivo e informação.

### Diagrama unifilar
Gerado a partir da mesma análise topológica da montagem: atualiza ao alterar ligações, mostra dispositivos desarmados, seções, correntes e circuitos desconectados. Clicar em um elemento o seleciona no quadro e abre as propriedades para edição. Exportação **SVG** e **PDF** (impressão), com aviso de projeto didático.

### Academia Elétrica
Seis níveis (Fundamentos, Proteção, Montagem, Dimensionamento, Diagnóstico, Projeto completo) com aulas, quizzes, cálculos (respostas calculadas pelo próprio motor), desafios de montagem avaliados pela validação e pela simulação, dicas graduais, pontuação, histórico de tentativas e relatório de desempenho. Uma atividade **nunca** é aprovada com erros críticos de validação.

### Projetos
Salvar/abrir/duplicar/excluir no navegador, exportar/importar JSON (validado por Zod + integridade referencial antes de carregar), desfazer/refazer (100 níveis), histórico de alterações, salvamento automático e recuperação de sessão, projetos de exemplo.

---

## Atalhos

| Tecla | Ação |
| --- | --- |
| Ctrl+Z / Ctrl+Y | Desfazer / refazer |
| Ctrl+S / Ctrl+O | Salvar / abrir projetos |
| Del | Remover seleção |
| Esc | Cancelar ferramenta ou seleção |
| V / W / I | Selecionar / Fio / Instrumentos |
| F, 1, 2, 3, 4 | Enquadrar, perspectiva, frontal ortográfica, bornes, lateral |
| D / C / T / X | Porta / tampa / transparência / corte |
| U | 3D ↔ unifilar |
| E | Energizar/desenergizar (modo Simulação) |
| F1 | Ajuda |

---

## Arquitetura

```
src/
  app/             estado global (Zustand + Immer), análise derivada, execução da simulação, autosave
  components/ui/   componentes de interface reutilizáveis
  components/panels/ barra superior, biblioteca, propriedades, editor de circuitos, terminal, instrumentos, academia, diálogos
  scene/           cena Three.js (React Three Fiber): câmera, luzes, invólucro
  scene/components/  modelos 3D procedurais dos dispositivos, bornes fixos, cargas
  scene/wires/     traçado e malhas dos condutores, fluxo de corrente
  scene/interaction/ bornes clicáveis, encaixe no trilho, pré-visualização de fios
  model/           schemas Zod do projeto (fonte única de tipos), fábricas, terminais, geometria do quadro
  electrical/core/ unidades, números complexos, constantes, sistemas de tensão
  electrical/calculations/ potência, condutores, queda de tensão, capacidade de condução, proteção, curto, dimensionamento
  electrical/simulation/   grafo, análise topológica, solver nodal, atuação das proteções, instrumentos
  electrical/validation/   contexto de validação e execução das regras
  normative/       documentos de referência, dados de referência, regras normativas e heurísticas
  catalog/         schema do catálogo, dispositivos genéricos didáticos, condutores, cores
  diagrams/        geração e renderização do diagrama unifilar
  education/       aulas, desafios, avaliação, progresso
  persistence/     serialização/validação, armazenamento local, projetos de exemplo
  tests/           testes automatizados (Vitest)
```

Princípios:
- **Uma única fonte de verdade**: o projeto (schema Zod). Cena 3D, diagrama, validação, simulação e instrumentos são *derivados* dele (`app/analysis.tsx` calcula topologia, validação e leituras uma vez por versão do projeto).
- **Geometria pura** (`model/geometry.ts`, sem Three.js): o comprimento de cada fio usado no solver é o mesmo do traçado desenhado.
- **Motor elétrico sem dependência de interface**, testável isoladamente.

---

## Modelo de simulação (resumo)

| Elemento | Modelo |
| --- | --- |
| Fonte | Tensões de fase U0∠0°, ∠−120°, ∠+120°; impedância resistiva derivada da Icc presumida (ilustrativa se não informada) |
| Condutores | Resistência IEC 60228 (classe 5) corrigida para a temperatura máxima da isolação; reatância desprezada no solver |
| Polos fechados | 5 mΩ (ilustrativo) |
| Cargas | Impedância constante calculada na tensão nominal (P + jQ) |
| Aterramento | Nó TERRA ligado à fonte por RB; PE ligado à terra por RA; TN-S/TN-C-S/TT diferenciados |
| Disjuntor | Magnético no limite superior da curva; térmico de 1ª ordem calibrado nos pontos convencionais (1,13·In não atua; 1,45·In < 1 h; 2,55·In entre 1 e 60 s) |
| DR | Atua quando \|ΣI dos polos\| ≥ IΔn |
| DPS | Surto ilustrativo: verifica DPS operante entre cada condutor vivo e PE; fim de vida se o surto excede Imax/Iimp |

Resultados **calculados**: tensões, correntes, somas diferenciais, potências. Resultados **ilustrativos**: tempos de atuação, surtos, corrente no corpo humano.

---

## Limitações

- **Normas**: o texto primário da ABNT NBR 5410 e das normas de produto **não foi acessado**. As regras foram implementadas a partir de fontes técnicas secundárias e estão marcadas como “fonte secundária — requer conferência”. A NBR 5410 está em revisão. Detalhes em [TECHNICAL_SOURCES.md](TECHNICAL_SOURCES.md).
- **Capacidade de condução**: subconjunto mínimo de dados (cobre; PVC e EPR/XLPE; métodos A1, A2, B1, C; 1,5 a 35 mm²). Métodos B2 e D e condutores de alumínio não são dimensionados (resultado inconclusivo). O conjunto pode ser substituído por dados licenciados (`setAmpacityDataset`).
- **Agrupamento**: apenas a disposição em feixe/conduto fechado.
- **Curto-circuito**: sem a energia I²t de passagem do fabricante, a verificação adiabática só é conclusiva com folga; seletividade não é modelada.
- **Simulação**: regime permanente senoidal; sem harmônicas, transitórios reais, partida de motores ou variação térmica dos condutores; atuação do DR determinística em IΔn (a norma de produto admite 0,5–1·IΔn).
- **Catálogo**: somente componentes **genéricos didáticos**. Nenhum dado de fabricante foi incluído por não ter sido possível verificá-lo; itens comerciais podem ser importados (JSON) com ficha técnica e URL verificáveis.
- **Demanda**: fatores de demanda/simultaneidade não são modelados.
- **Instrumentos e testador de DR** não substituem medições com instrumentos reais calibrados.
- Persistência apenas no navegador (localStorage) e em arquivos JSON exportados.

---

## Testes

`npm test` executa 93 testes (Vitest) cobrindo: potência e corrente, unidades, queda de tensão, dimensionamento sob diferentes condições de instalação, coordenação condutor × proteção, ligações de fase/neutro/PE, conexões ausentes, parâmetros desconhecidos, abertura e fechamento de dispositivos, atuação didática de disjuntores e DR, persistência e recuperação, sincronização 3D × unifilar e avaliação dos desafios. Os valores de referência têm memória de cálculo manual nos próprios testes.
