# Fontes técnicas do EletriLab 3D

Este documento registra a origem de **todos** os parâmetros elétricos, conjuntos de dados e regras normativas usados pelo simulador, com o respectivo estado de verificação.

Data da revisão: **2026-10-11**.

## Política adotada

1. **Nenhuma regra é apresentada como “validada pela ABNT”.** O texto primário das normas ABNT/IEC não foi acessado durante o desenvolvimento. Todas as regras normativas têm status `fonte-secundaria` (consistentes em fontes técnicas secundárias; requerem conferência na edição vigente) ou `pendente`.
2. **Cláusulas não confirmadas são identificadas** como “numeração a confirmar” (`clauseConfirmed: false`) — não foram inventadas cláusulas, tabelas ou limites.
3. **Tabelas protegidas não são reproduzidas integralmente.** Apenas o subconjunto mínimo de valores numéricos necessário ao funcionamento didático foi incluído, com identificação da origem e possibilidade de substituição por dados licenciados.
4. **Heurísticas educacionais** são separadas das regras normativas (`kind: 'heuristica'`, documento `ELETRILAB`) e nunca são apresentadas como exigência de norma.
5. **Dados desconhecidos permanecem desconhecidos** (`null`) e tornam inconclusivas as verificações que dependem deles.
6. O catálogo contém apenas **componentes genéricos didáticos**; nenhuma especificação de fabricante foi atribuída a item algum.

## Estados de verificação

| Estado | Significado |
| --- | --- |
| `verificado-fonte-primaria` | Conferido no documento primário. **Nenhum item do projeto tem este estado.** |
| `fonte-secundaria` | Consistente em fontes técnicas secundárias; requer conferência na edição vigente. |
| `didatico` | Conjunto didático explicitamente identificado; não representa produto real nem requisito normativo. |
| `pendente` | Necessita verificação antes de qualquer uso técnico. |

## Documentos de referência e edições

Situação levantada em 2026-10-11 por consulta a catálogos de normas e à imprensa técnica (resumos de busca; os documentos não foram lidos na íntegra).

| Documento | Edição considerada | Observação |
| --- | --- | --- |
| ABNT NBR 5410 — Instalações elétricas de baixa tensão | 2004, Versão Corrigida 2008 | Vigente. **Revisão em andamento** (1ª consulta nacional nov/2023–fev/2024; 2ª consulta prevista; publicação estimada pela imprensa setorial para até o fim de 2026). Regras podem mudar. |
| ABNT NBR IEC 61643-11 — DPS de baixa tensão | 03/2021 (errata/edição corrigida 05/2022) | A IEC 61643-11:2025 (Ed. 2) foi publicada internacionalmente; adoção pela ABNT não confirmada. |
| ABNT NBR NM 60898 — Disjuntores para instalações domésticas e similares | 07/2004 (confirmada em 2022) | Não foi localizada uma “ABNT NBR IEC 60898-1”; partes 2 (2019) e 3 (2021) existem como NBR IEC. |
| ABNT NBR IEC 60947-2 — Disjuntores (uso industrial) | edição não confirmada | Citada apenas como referência; não usada nas regras. |
| ABNT NBR NM 61008 — Interruptores DR (RCCB) | parte 2-1: 08/2005 | Referência nacional encontrada para interruptores DR. |
| ABNT NBR IEC 61009-1 — Disjuntores DR (RCBO) | 06/2023 (IEC 61009-1:2010+A1+A2) | — |
| IEC 60364-5-52 | 2009 + AMD1:2011 | Referência internacional análoga (métodos de instalação, Anexo G de queda de tensão). |
| IEC 60364-4-43 | 2008 | Coordenação Ib ≤ In ≤ Iz, I²t ≤ k²S², fatores k. |
| IEC 60364-5-54 | 2011 | Condutores de proteção (PE não seccionado). |
| IEC 60228 / ABNT NBR NM 280 | IEC 60228:2004 | Resistência máxima de condutores a 20 °C. |

## Conjuntos de dados

| Dado | Arquivo | Valores | Origem | Estado |
| --- | --- | --- | --- | --- |
| Capacidade de condução de referência I0 | `src/normative/data/referenceData.ts` | Cobre; PVC 70 °C e EPR/XLPE 90 °C; 2 e 3 condutores carregados; métodos A1, A2, B1, C; 1,5–35 mm²; 30 °C | Valores análogos às tabelas de capacidade de condução da NBR 5410:2004 e IEC 60364-5-52, conforme publicados em guias técnicos de fabricantes de cabos | `fonte-secundaria` |
| Métodos **B2 e D** | — | **Excluídos** | Valores divergem entre IEC 60364-5-523:1999 e IEC 60364-5-52:2009; sem o texto primário não foi possível confirmar qual corresponde à NBR 5410:2004 | — |
| Fator de temperatura kθ | `src/electrical/calculations/ampacity.ts` | `k = √((θp − θa)/(θp − 30))` | Relação física de aquecimento; reproduz os fatores tabelados (ar) com 2 casas decimais — verificado em teste | `fonte-secundaria` |
| Fator de agrupamento kg | `referenceData.ts` | 1,00 / 0,80 / 0,70 / 0,65 / 0,60 / 0,57 / 0,54 / 0,52 / 0,50 / 0,45 / 0,41 / 0,38 | Linha “feixe / conduto fechado” análoga à IEC 60364-5-52 Tab. B.52.17 | `fonte-secundaria` |
| Seções mínimas | `referenceData.ts` | Iluminação 1,5 mm²; força 2,5 mm² (cobre) | NBR 5410 6.2.6.1.1 (tabela de seções mínimas, numeração a confirmar) | `fonte-secundaria` |
| Resistência dos condutores | `src/catalog/conductors.ts` | Cobre classe 5: 13,3 / 7,98 / 4,95 / 3,30 / 1,91 / 1,21 / 0,780 / 0,554 Ω/km; alumínio classe 2: 1,91 / 1,20 / 0,868 Ω/km | IEC 60228 / NBR NM 280 | `fonte-secundaria` |
| Resistividade e coeficiente de temperatura | `src/electrical/core/constants.ts` | Cu 0,017241 Ω·mm²/m, α 0,00393/K; Al 0,028264, α 0,00403/K | IEC 60028 (cobre recozido padrão); IEC 60889 (alumínio) | `fonte-secundaria` |
| Reatância típica | `constants.ts` | 0,08 mΩ/m | IEC 60364-5-52, Anexo G (informativo) | `fonte-secundaria` |
| Fator k (I²t ≤ k²S²) | `constants.ts` | Cu: PVC 115, EPR/XLPE 143; Al: PVC 76, EPR/XLPE 94 | IEC 60364-4-43 Tab. 43A | `fonte-secundaria` |
| Curvas de disparo instantâneo | `constants.ts` | B 3–5·In; C 5–10·In; D 10–20·In | IEC 60898-1 / NBR NM 60898 | `fonte-secundaria` |
| Correntes convencionais | `constants.ts` | 1,13·In (não atua em 1 h); 1,45·In (atua < 1 h) | IEC 60898-1 | `fonte-secundaria` |
| Tempos máximos do DR | `constants.ts` | 1·IΔn ≤ 300 ms; 2·IΔn ≤ 150 ms; 5·IΔn ≤ 40 ms; não atuação a 0,5·IΔn | IEC 61008-1 / NBR NM 61008 | `fonte-secundaria` |
| Tensão de contato limite UL | `constants.ts` | 50 V | NBR 5410 (situação 1) | `fonte-secundaria` |
| Modelo térmico do disjuntor | `constants.ts` | τ = 50 s; limiar 1,3·In | **Didático**, calibrado para respeitar os pontos convencionais; não é curva de fabricante | `didatico` |
| Valores ilustrativos da simulação | `constants.ts` | Icc 5 kA, RA 30 Ω, RB 10 Ω, comprimento 10 m, seção 2,5 mm², polo 5 mΩ, corpo humano 1 kΩ | Usados apenas quando o usuário não informa o dado; sempre sinalizados na interface | `didatico` |
| Catálogo de dispositivos | `src/catalog/devices.ts` | In, curvas, Icn, IΔn, Uc, Up, In/Imax/Iimp dos DPS | Conjunto didático genérico dentro das faixas preferenciais das normas de produto | `didatico` |

## Regras implementadas

### Regras normativas (`src/normative/rules/normativeRules.ts`)

| ID | Documento / item | Item confirmado? | Estado |
| --- | --- | --- | --- |
| NBR5410-SECAO-MINIMA | NBR 5410 6.2.6.1.1 + tabela de seções mínimas | não (numeração da tabela) | fonte-secundaria |
| NBR5410-CAPACIDADE | NBR 5410 6.2.5 | não | fonte-secundaria |
| NBR5410-SOBRECARGA | NBR 5410 5.3.4.1 (Ib ≤ In ≤ Iz; I2 ≤ 1,45·Iz) | não | fonte-secundaria |
| NBR5410-QUEDA-TERMINAL | NBR 5410 6.2.7.2 (≤ 4 %) | não | fonte-secundaria |
| NBR5410-QUEDA-TOTAL | NBR 5410 6.2.7.1 c) (≤ 5 % desde o ponto de entrega) | não | fonte-secundaria |
| NBR5410-CURTO-CIRCUITO | NBR 5410 5.3.5 (I²t ≤ k²S²) | não | fonte-secundaria |
| NBR5410-CAPACIDADE-INTERRUPCAO | NBR 5410 5.3.5 | não | fonte-secundaria |
| NBR5410-DR-30MA | NBR 5410 5.1.3.2.2 | não | fonte-secundaria |
| NBR5410-IDENTIFICACAO-CORES | NBR 5410 6.1.5.3 | não | fonte-secundaria |
| NBR5410-SECAO-PE | NBR 5410 6.4.3 / tabela de seção do PE (numeração a confirmar) | não | fonte-secundaria |
| NBR5410-NEUTRO | NBR 5410 6.2.6.2 | não | fonte-secundaria |
| NBR5410-TT-SECCIONAMENTO | NBR 5410 5.1.2.2.4 (subitem a confirmar) | não | fonte-secundaria |
| NBR5410-PE-SEM-SECCIONAMENTO | IEC 60364-5-54 543.3 (correspondente NBR a confirmar) | não | fonte-secundaria |
| NBR5410-CIRCUITO-INDEPENDENTE | NBR 5410 9.5.3 (subitem a confirmar) | não | fonte-secundaria |

### Heurísticas educacionais (`src/normative/rules/heuristicRules.ts`)

H-CONEXAO, H-SEM-PROTECAO, H-DR-NEUTRO, H-CURTO-MONTAGEM, H-BORNE-COMPATIVEL, H-OCUPACAO-BORNE, H-CONDUTOR-SEM-ORIGEM, H-PENTE, H-DISJUNTOR-NO-NEUTRO (`pendente`), H-PROTECAO-DEDICADA, H-MULTIPOLAR, H-FASES-DISTINTAS, H-DPS-LIGACAO, H-DPS-UC (`pendente` — critério simplificado Uc ≥ 1,1·U0; a tabela da NBR 5410 varia com o esquema de aterramento), H-DR-SOBRECORRENTE, H-SELETIVIDADE, H-FIACAO-INTERNA (hipótese didática B1/30 °C), H-DEMANDA, H-QUEDA-META, H-LACOS, H-DADOS-DESCONHECIDOS, H-FALHAS-ATIVAS.

Todos os metadados (descrição, aplicabilidade, parâmetros, severidade, mensagem didática) podem ser consultados na interface em **Regras técnicas e fontes** (ícone de balança na barra superior).

## Fórmulas utilizadas

| Grandeza | Fórmula | Arquivo |
| --- | --- | --- |
| Corrente de projeto | F-N: `Ib = P/(U0·cosφ)`; F-F: `Ib = P/(U·cosφ)`; 3F: `Ib = P/(√3·U·cosφ)`; motores: `P = Pútil/η` | `calculations/power.ts` |
| Resistência | `R(θ) = R20·[1 + α·(θ − 20)]` | `calculations/conductor.ts` |
| Queda de tensão | `ΔU = b·Ib·L·(R·cosφ + X·senφ)`, b = 2 (dois condutores) ou √3 (trifásico) | `calculations/voltageDrop.ts` |
| Capacidade corrigida | `Iz = I0·kθ·kg` | `calculations/ampacity.ts` |
| Suportabilidade adiabática | `t = (k·S/I)²` | `calculations/protection.ts` |
| Curto-circuito mínimo (estimativa) | `Icc = Uf/(Zfonte + 2·R·L)`, `Zfonte = U0/Icc,origem` | `calculations/shortCircuit.ts` |
| Modelo térmico didático | `dθ/dt = ((I/In)² − θ)/τ`; atua quando θ ≥ 1,3² | `simulation/engine.ts` |

## Fontes consultadas (resumos de busca, 2026-10-11)

- Revisão da NBR 5410 — Revista O Setor Elétrico: <https://www.osetoreletrico.com.br/?p=165324>; Canal Solar: <https://canalsolar.com.br/revisao-da-nbr-5410-abrangera-instalacoes-em-vias-publicas/>
- ABNT NBR IEC 61643-11 (catálogo): <https://normas.com.br/visualizar/genius-faq/9060/conforme-nbriec61643-11-de-03-2021-dispositivos-de-protecao-contra-surtos-de-baixa-tensao-parte-11-dispositivos-de-protecao-contra-surtos-conectados-aos-sistemas-de-baixa-tensao-requisitos-e-metodos-de-ensaio>; IEC 61643-11:2025: <https://webstore.iec.ch/en/publication/65314>
- ABNT NBR NM 60898: <https://normas.com.br/visualizar/abnt-nbr-nm/23706/abnt-nbrnm60898-disjuntores-para-protecao-de-sobrecorrentes-para-instalacoes-domesticas-e-similares-iec-60898-1995-mod>
- ABNT NBR IEC 61009-1: <https://normas.com.br/visualizar/abnt-nbr-nm/13652/abnt-nbriec61009-1-disjuntores-a-corrente-diferencial-residual-para-uso-domestico-e-similar-com-dispositivo-de-protecao-de-sobrecorrentes-ddr-parte-1-regras-gerais>
- ABNT NBR NM 61008-2-1: <https://www.normas.com.br/visualizar/abnt-nbr-nm/24642/abnt-nm61008-2-1-interruptores-a-corrente-diferencial-residual-para-usos-domestico-e-analogos-sem-dispositivo-de-protecao-contra-sobrecorrentes-rccb-parte-2-1-aplicabilidade-das-regras-gerais-aos-rccb-funcionalmente-independentes-da-tensao-de>
- DR de alta sensibilidade (item 5.1.3.2.2) — catálogo Siemens: <https://assets.new.siemens.com/siemens/assets/api/uuid:48701b57-34c5-4389-96f4-f86ba6a95dec/catalogo-dr.pdf>; Sienge: <https://sienge.com.br/blog/dispositivo-dr/>
- Queda de tensão (6.2.7): <https://engehall.com.br/queda-de-tensao-descubra-o-que-e-segredo-para-evitar/>; <https://www.voltflow.net/blog/queda-de-tensao-calculo-formula-nbr-5410>
- Identificação por cores: <https://www.qconcursos.com/questoes-de-concursos/questoes/7711a780-f8>
- Guia de dimensionamento de baixa tensão (Prysmian): <https://br.prysmian.com/sites/default/files/atoms/files/Guia_de_Dimensionamento-Baixa_Tensao_Rev9.pdf>

## Como substituir ou ampliar os dados

- **Capacidade de condução**: `setAmpacityDataset(json)` em `src/normative/data/referenceData.ts` aceita um conjunto validado por Zod (`AmpacityDatasetSchema`), com campo `info.status` obrigatório.
- **Componentes comerciais**: Configurações → “Importar itens de catálogo” (JSON validado por `CatalogItemSchema`). Itens `comercial` exigem fabricante, modelo, fonte `catalogo-fabricante` com URL e não podem ter parâmetros livres.
- **Regras**: adicione objetos `NormativeRule` em `src/normative/rules/` preenchendo fonte, edição (via `DOCUMENTS`), cláusula, `clauseConfirmed` e `verification.status`.
