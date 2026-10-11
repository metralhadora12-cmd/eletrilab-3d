/** Registro único das regras (normativas e heurísticas), separadas por tipo. */
import { DOCUMENTS } from './sources';
import { HEURISTIC_RULES } from './rules/heuristicRules';
import { NORMATIVE_RULES } from './rules/normativeRules';
import type { NormativeRule } from './types';

export const ALL_RULES: NormativeRule[] = [...NORMATIVE_RULES, ...HEURISTIC_RULES];

const byId = new Map(ALL_RULES.map((r) => [r.id, r]));

export function getRule(id: string): NormativeRule | undefined {
  return byId.get(id);
}

export function ruleEdition(rule: NormativeRule): string {
  return DOCUMENTS[rule.source.document].edition;
}

export function ruleDocumentTitle(rule: NormativeRule): string {
  return DOCUMENTS[rule.source.document].title;
}

export const VERIFICATION_LABEL = {
  'verificado-fonte-primaria': 'Verificada na fonte primária',
  'fonte-secundaria': 'Fonte secundária — requer conferência na norma',
  didatico: 'Critério didático (não normativo)',
  pendente: 'Verificação pendente',
} as const;

export { NORMATIVE_RULES, HEURISTIC_RULES };
