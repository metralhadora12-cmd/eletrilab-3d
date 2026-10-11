/** Aritmética de números complexos (fasores) usada pelo solver nodal. */
export interface Complex {
  re: number;
  im: number;
}

export const C = (re: number, im = 0): Complex => ({ re, im });
export const ZERO: Complex = { re: 0, im: 0 };

export const cadd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const csub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
export const cmul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
export const cscale = (a: Complex, k: number): Complex => ({ re: a.re * k, im: a.im * k });
export const cconj = (a: Complex): Complex => ({ re: a.re, im: -a.im });
export const cabs = (a: Complex): number => Math.hypot(a.re, a.im);
export const carg = (a: Complex): number => Math.atan2(a.im, a.re);
export const cneg = (a: Complex): Complex => ({ re: -a.re, im: -a.im });

export function cdiv(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) throw new Error('Divisão complexa por zero');
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}

export const cinv = (a: Complex): Complex => cdiv(C(1), a);

export const polar = (mag: number, angleDeg: number): Complex => {
  const r = (angleDeg * Math.PI) / 180;
  return { re: mag * Math.cos(r), im: mag * Math.sin(r) };
};

/**
 * Resolve A·x = b (sistema complexo denso) por eliminação de Gauss com pivotamento parcial.
 * A e b são copiados; as entradas não são modificadas.
 */
export function solveComplexLinear(A: Complex[][], b: Complex[]): Complex[] {
  const n = b.length;
  const M = A.map((row) => row.map((v) => ({ ...v })));
  const x = b.map((v) => ({ ...v }));
  for (let col = 0; col < n; col++) {
    let piv = col;
    let best = cabs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = cabs(M[r][col]);
      if (v > best) {
        best = v;
        piv = r;
      }
    }
    if (best < 1e-18) throw new Error('Matriz singular no solver nodal');
    if (piv !== col) {
      [M[col], M[piv]] = [M[piv], M[col]];
      [x[col], x[piv]] = [x[piv], x[col]];
    }
    const pivot = M[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col];
      if (f.re === 0 && f.im === 0) continue;
      const factor = cdiv(f, pivot);
      const rowR = M[r];
      const rowC = M[col];
      for (let k = col; k < n; k++) {
        const v = rowC[k];
        if (v.re === 0 && v.im === 0) continue;
        rowR[k] = csub(rowR[k], cmul(factor, v));
      }
      x[r] = csub(x[r], cmul(factor, x[col]));
    }
  }
  const out: Complex[] = new Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let acc = x[r];
    for (let k = r + 1; k < n; k++) acc = csub(acc, cmul(M[r][k], out[k]));
    out[r] = cdiv(acc, M[r][r]);
  }
  return out;
}
