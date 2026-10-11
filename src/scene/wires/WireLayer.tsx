/** Condutores 3D: traçado com cantos arredondados, cor normativa/gráfica, fluxo de corrente. */
import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { WIRE_COLORS } from '../../catalog/colors';
import { routeWire, type BoardLayout } from '../../model/geometry';
import { roundedPath, wireRadius } from './curve';
import type { Project, Wire } from '../../model/schema';
import { useUiStore } from '../../app/uiStore';
import { stripeTexture } from '../textures';
import { formatCurrent } from '../../electrical/core/units';

interface Built {
  wire: Wire;
  curve: THREE.CurvePath<THREE.Vector3>;
  geometry: THREE.TubeGeometry;
  length: number;
}

export function WireLayer({
  project,
  layout,
  currents,
  overloaded,
}: {
  project: Project;
  layout: BoardLayout;
  currents: Map<string, number>;
  overloaded: Set<string>;
}) {
  const built = useMemo<Built[]>(() => {
    return project.wires
      .map((w, i) => {
        const r = routeWire(project, w, i, layout);
        if (!r) return null;
        const curve = roundedPath(r.points);
        const len = curve.getLength();
        const geometry = new THREE.TubeGeometry(curve, Math.min(420, Math.max(40, Math.round(len * 320))), wireRadius(w), 8, false);
        return { wire: w, curve, geometry, length: len };
      })
      .filter((x): x is Built => x !== null);
  }, [project, layout]);

  const showFlow = useUiStore((s) => s.showFlow);
  const selection = useUiStore((s) => s.selection);
  const energized = project.simulation.energized;

  return (
    <group>
      {built.map((b) => (
        <WireMesh key={b.wire.id} b={b} selected={selection?.kind === 'wire' && selection.id === b.wire.id} current={currents.get(b.wire.id) ?? 0} hot={overloaded.has(b.wire.id)} />
      ))}
      {energized &&
        showFlow &&
        built.map((b) => {
          const i = currents.get(b.wire.id) ?? 0;
          return i > 0.02 ? <Flow key={`f-${b.wire.id}`} curve={b.curve} length={b.length} current={i} hot={overloaded.has(b.wire.id)} /> : null;
        })}
    </group>
  );
}

function WireMesh({ b, selected, current, hot }: { b: Built; selected: boolean; current: number; hot: boolean }) {
  const info = WIRE_COLORS[b.wire.color];
  const map = useMemo(() => {
    if (!info.stripeHex) return null;
    const t = stripeTexture(info.hex, info.stripeHex).clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, b.length / 0.012), 1);
    return t;
  }, [info, b.length]);
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    const ui = useUiStore.getState();
    if (ui.tool === 'wire' || ui.tool === 'place') return;
    e.stopPropagation();
    if (ui.tool === 'instrument' && (ui.instrument === 'alicate' || ui.instrument === 'multimetro-a')) {
      ui.set({ probes: [`wire:${b.wire.id}`] });
      ui.addLog('measure', `Corrente no condutor: ${formatCurrent(current)}`);
      return;
    }
    ui.select({ kind: 'wire', id: b.wire.id });
  };
  return (
    <mesh geometry={b.geometry} onPointerDown={onDown} castShadow>
      <meshStandardMaterial
        color={map ? '#ffffff' : info.hex}
        map={map ?? undefined}
        roughness={0.42}
        metalness={0.02}
        emissive={selected ? '#3d8bfd' : hot ? '#ff4d1a' : '#000000'}
        emissiveIntensity={selected ? 0.55 : hot ? 0.5 : 0}
        transparent={b.wire.broken}
        opacity={b.wire.broken ? 0.35 : 1}
      />
    </mesh>
  );
}

const flowGeo = new THREE.SphereGeometry(0.0016, 8, 6);

function Flow({ curve, length, current, hot }: { curve: THREE.CurvePath<THREE.Vector3>; length: number; current: number; hot: boolean }) {
  const count = Math.max(2, Math.min(28, Math.round(length / 0.028)));
  const ref = useRef<THREE.InstancedMesh>(null);
  const phase = useRef(Math.random());
  const speed = 0.035 + 0.05 * Math.log10(1 + current);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: hot ? '#ff6a3d' : '#ffe58a', toneMapped: false, transparent: true, opacity: 0.9 }),
    [hot],
  );
  useFrame((_, dt) => {
    phase.current = (phase.current + (dt * speed) / Math.max(length, 0.05)) % 1;
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < count; i++) {
      const t = (phase.current + i / count) % 1;
      curve.getPointAt(t, p);
      m.makeTranslation(p.x, p.y, p.z + 0.0008);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[flowGeo, mat, count]} frustumCulled={false} />;
}
