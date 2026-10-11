/** Curvas dos condutores: polilinha ortogonal com cantos arredondados. */
import * as THREE from 'three';
import { findConductor } from '../../catalog/conductors';
import type { Vec3 } from '../../model/geometry';
import type { Wire } from '../../model/schema';

export function roundedPath(points: Vec3[], radius = 0.007): THREE.CurvePath<THREE.Vector3> {
  const v = points.map((p) => new THREE.Vector3(...p));
  const path = new THREE.CurvePath<THREE.Vector3>();
  let prev = v[0];
  for (let i = 1; i < v.length - 1; i++) {
    const a = v[i - 1];
    const c = v[i];
    const b = v[i + 1];
    const dIn = c.clone().sub(a);
    const dOut = b.clone().sub(c);
    const r = Math.min(radius, dIn.length() / 2, dOut.length() / 2);
    const p1 = c.clone().sub(dIn.normalize().multiplyScalar(r));
    const p2 = c.clone().add(dOut.normalize().multiplyScalar(r));
    if (prev.distanceTo(p1) > 1e-6) path.add(new THREE.LineCurve3(prev, p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, c, p2));
    prev = p2;
  }
  path.add(new THREE.LineCurve3(prev, v[v.length - 1]));
  return path;
}

/** Raio visual proporcional ao diâmetro externo do condutor, com mínimo para visibilidade. */
export function wireRadius(w: Wire) {
  const d = findConductor(w.sectionMm2, w.material, w.insulation)?.approxOuterDiameterMm ?? Math.sqrt(w.sectionMm2) * 2 + 1.6;
  return Math.max(0.0012, Math.min(0.0055, d / 2000));
}
