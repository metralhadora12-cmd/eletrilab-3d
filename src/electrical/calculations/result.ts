/** Tipos de resultado dos cálculos: nunca inventar valores ausentes. */
export interface CalcOk<T> {
  status: 'ok';
  value: T;
  assumptions: string[];
}
export interface CalcInconclusive {
  status: 'inconclusivo';
  missing: string[];
  message: string;
}
export interface CalcInvalid {
  status: 'invalido';
  errors: string[];
}
export type CalcResult<T> = CalcOk<T> | CalcInconclusive | CalcInvalid;

export const INCONCLUSIVE_INSTALL_MSG = 'Dimensionamento inconclusivo: informe as condições de instalação';

export const ok = <T>(value: T, assumptions: string[] = []): CalcOk<T> => ({ status: 'ok', value, assumptions });
export const inconclusive = (message: string, missing: string[] = []): CalcInconclusive => ({
  status: 'inconclusivo',
  missing,
  message,
});
export const invalid = (...errors: string[]): CalcInvalid => ({ status: 'invalido', errors });

export function isOk<T>(r: CalcResult<T>): r is CalcOk<T> {
  return r.status === 'ok';
}

export function describeNotOk(r: CalcInconclusive | CalcInvalid): string {
  return r.status === 'inconclusivo' ? r.message : `Entrada inválida: ${r.errors.join('; ')}`;
}
