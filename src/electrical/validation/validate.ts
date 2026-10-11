/** Execução das regras e montagem do relatório de validação. */
import type { FindingSeverity, Project, ValidationSnapshot } from '../../model/schema';
import { ALL_RULES } from '../../normative/registry';
import { buildValidationContext, type Finding, type ValidationContext } from './context';
import type { TopologyAnalysis } from '../simulation/topology';

export const SEVERITY_ORDER: FindingSeverity[] = ['erro', 'alerta', 'inconclusivo', 'info'];

export interface ValidationReport {
  findings: Finding[];
  counts: Record<FindingSeverity, number>;
  rulesEvaluated: number;
  normativeCount: number;
  heuristicCount: number;
  statement: string;
  ruleErrors: string[];
  ctx: ValidationContext;
}

export function validateProject(project: Project, topology?: TopologyAnalysis): ValidationReport {
  const ctx = buildValidationContext(project, topology);
  const findings: Finding[] = [];
  const ruleErrors: string[] = [];
  for (const rule of ALL_RULES) {
    try {
      findings.push(...rule.validate(ctx));
    } catch (e) {
      ruleErrors.push(`${rule.id}: ${(e as Error).message}`);
    }
  }
  findings.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  const counts = { erro: 0, alerta: 0, inconclusivo: 0, info: 0 } as Record<FindingSeverity, number>;
  for (const f of findings) counts[f.severity]++;
  const normativeCount = ALL_RULES.filter((r) => r.kind === 'normativa').length;
  const heuristicCount = ALL_RULES.length - normativeCount;

  const parts: string[] = [];
  if (counts.erro > 0) {
    parts.push(`${counts.erro} erro(s) confirmado(s) pelo modelo.`);
  } else {
    parts.push(
      `Nenhum erro detectado nas ${ALL_RULES.length} verificações implementadas (${normativeCount} regras normativas de fonte secundária e ${heuristicCount} heurísticas educacionais).`,
    );
  }
  if (counts.alerta) parts.push(`${counts.alerta} alerta(s) de possível incompatibilidade.`);
  if (counts.inconclusivo) parts.push(`${counts.inconclusivo} verificação(ões) inconclusiva(s) por falta de dados.`);
  parts.push(
    'Este resultado NÃO declara conformidade com a ABNT NBR 5410: as regras não foram conferidas no texto primário da norma e o modelo é simplificado.',
  );

  return {
    findings,
    counts,
    rulesEvaluated: ALL_RULES.length,
    normativeCount,
    heuristicCount,
    statement: parts.join(' '),
    ruleErrors,
    ctx,
  };
}

export function toSnapshot(report: ValidationReport, project: Project): ValidationSnapshot {
  return {
    at: new Date().toISOString(),
    profile: project.validationProfile,
    counts: report.counts,
    findings: report.findings.map((f) => ({ ruleId: f.ruleId, severity: f.severity, message: f.message, targetId: f.targetId })),
  };
}
