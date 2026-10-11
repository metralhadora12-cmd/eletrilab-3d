/** Camada NormativeRules: metadados rastreáveis + função de validação. */
import type { FindingSeverity } from '../model/schema';
import type { VerificationStatus } from '../catalog/schema';
import type { Finding, ValidationContext } from '../electrical/validation/context';
import type { DocumentId } from './sources';

export type RuleKind = 'normativa' | 'heuristica';

export interface RuleSource {
  document: DocumentId;
  /** Item/cláusula de referência. */
  clause: string;
  /** false quando a numeração veio apenas de fontes secundárias e precisa ser conferida. */
  clauseConfirmed: boolean;
}

export interface NormativeRule {
  id: string;
  kind: RuleKind;
  title: string;
  description: string;
  source: RuleSource;
  /** Condições em que a regra se aplica. */
  applicability: string;
  parameters: Record<string, string | number | boolean>;
  /** Severidade padrão quando a regra é violada. */
  severity: FindingSeverity;
  didacticMessage: string;
  verification: {
    status: VerificationStatus;
    notes: string;
    reviewedAt: string;
  };
  validate: (ctx: ValidationContext) => Finding[];
}
