import { describe, expect, it } from 'vitest';
import { UnitError, convert, formatCurrent, formatResistance, parseDecimalBR } from '../electrical/core/units';

describe('conversão de unidades', () => {
  it('converte dentro da mesma dimensão', () => {
    expect(convert(5.5, 'kW', 'W')).toBe(5500);
    expect(convert(30, 'mA', 'A')).toBeCloseTo(0.03, 12);
    expect(convert(4.5, 'kA', 'A')).toBe(4500);
    expect(convert(250, 'mm', 'm')).toBeCloseTo(0.25, 12);
    expect(convert(1, 'km', 'm')).toBe(1000);
    expect(convert(7.98, 'Ω', 'mΩ')).toBeCloseTo(7980, 9);
    expect(convert(1, 'h', 's')).toBe(3600);
  });

  it('rejeita conversão entre dimensões diferentes (W → VA depende do fator de potência)', () => {
    expect(() => convert(1000, 'W', 'VA')).toThrow(UnitError);
    expect(() => convert(10, 'A', 'V')).toThrow(UnitError);
  });

  it('rejeita valores não finitos', () => {
    expect(() => convert(Number.NaN, 'W', 'kW')).toThrow(UnitError);
    expect(() => convert(Infinity, 'A', 'mA')).toThrow(UnitError);
  });
});

describe('entrada numérica no formato brasileiro', () => {
  it('interpreta vírgula decimal e separador de milhar', () => {
    expect(parseDecimalBR('2,5')).toBe(2.5);
    expect(parseDecimalBR('1.234,5')).toBe(1234.5);
    expect(parseDecimalBR('2.5')).toBe(2.5);
    expect(parseDecimalBR(' 127 ')).toBe(127);
    expect(parseDecimalBR('-3,25')).toBe(-3.25);
  });

  it('retorna null para entradas inválidas (nunca NaN)', () => {
    expect(parseDecimalBR('')).toBeNull();
    expect(parseDecimalBR('abc')).toBeNull();
    expect(parseDecimalBR('2,5,1')).toBeNull();
    expect(parseDecimalBR('1.23,4')).toBeNull();
    expect(parseDecimalBR('12a')).toBeNull();
  });

  it('formata grandezas escolhendo prefixos', () => {
    expect(formatCurrent(0.03)).toContain('mA');
    expect(formatCurrent(2500)).toContain('kA');
    expect(formatResistance(Infinity)).toBe('OL');
    expect(formatResistance(0.25)).toContain('mΩ');
  });
});
