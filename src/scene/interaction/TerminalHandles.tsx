/** Pontos de conexão (bornes) clicáveis: criação de condutores e pontas de prova. */
import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { colorAllowsFunction } from '../../catalog/colors';
import { terminalKey, type Project, type TerminalRef } from '../../model/schema';
import { listAllTerminals, type ResolvedTerminal } from '../../model/terminals';
import { outputOrigin, terminalPose, type BoardLayout } from '../../model/geometry';
import { useUiStore } from '../../app/uiStore';
import { useProjectStore } from '../../app/projectStore';
import { loadNode } from '../../electrical/simulation/solver';
import { circuitTerminalIds } from '../../electrical/core/systems';

const FN_COLOR = { L: '#f2b632', N: '#4b9fe0', PE: '#3fb26f', R: '#d0d0d0' } as const;

function baseColor(t: ResolvedTerminal) {
  if (t.def.accepts.length === 1) return FN_COLOR[t.def.accepts[0]];
  if (t.def.accepts.includes('L') && !t.def.accepts.includes('PE') && t.def.accepts.length === 2 && t.def.accepts.includes('N')) return '#f0d9a0';
  return '#c9ced4';
}

export function TerminalHandles({ project, layout }: { project: Project; layout: BoardLayout }) {
  const tool = useUiStore((s) => s.tool);
  const coverOn = useUiStore((s) => s.coverOn);
  const wireStart = useUiStore((s) => s.wireStart);
  const wireDraft = useUiStore((s) => s.wireDraft);
  const probes = useUiStore((s) => s.probes);
  const [hover, setHover] = useState<string | null>(null);

  const items = useMemo(
    () =>
      listAllTerminals(project)
        .map((t) => ({ t, pose: terminalPose(project, t.ref, layout) }))
        .filter((x): x is { t: ResolvedTerminal; pose: NonNullable<ReturnType<typeof terminalPose>> } => x.pose !== null),
    [project, layout],
  );
  const startDef = useMemo(() => items.find((x) => wireStart && x.t.key === terminalKey(wireStart))?.t, [items, wireStart]);

  if (coverOn) return null;
  const active = tool === 'wire' || tool === 'instrument';
  const strict = project.validationProfile !== 'aprendizado';

  const click = (t: ResolvedTerminal) => (e: ThreeEvent<PointerEvent>) => {
    const ui = useUiStore.getState();
    if (ui.tool === 'wire') {
      e.stopPropagation();
      if (!ui.wireStart) {
        ui.set({ wireStart: t.ref });
        return;
      }
      if (terminalKey(ui.wireStart) === t.key) return;
      completeWire(ui.wireStart, t.ref, strict);
    } else if (ui.tool === 'instrument') {
      e.stopPropagation();
      addProbe(t.key);
    }
  };
  const up = (t: ResolvedTerminal) => (e: ThreeEvent<PointerEvent>) => {
    const ui = useUiStore.getState();
    if (ui.tool !== 'wire' || !ui.wireStart || terminalKey(ui.wireStart) === t.key) return;
    e.stopPropagation();
    completeWire(ui.wireStart, t.ref, strict);
  };

  return (
    <group>
      {items.map(({ t, pose }) => {
        let color: string = baseColor(t);
        let scale = active ? 1 : 0.6;
        if (tool === 'wire' && startDef) {
          if (startDef.key === t.key) {
            color = '#ffffff';
            scale = 1.4;
          } else {
            const shared = startDef.def.accepts.filter((f) => t.def.accepts.includes(f));
            const ok = shared.length > 0 && shared.some((f) => colorAllowsFunction(wireDraft.color, f));
            color = ok ? '#3fe07f' : strict ? '#ff4a3d' : '#ff9a3d';
          }
        }
        if (probes.includes(t.key)) {
          color = probes[0] === t.key ? '#ff3b30' : '#111111';
          scale = 1.5;
        }
        if (hover === t.key) scale *= 1.3;
        return (
          <mesh
            key={t.key}
            position={pose.position}
            scale={scale}
            onPointerDown={click(t)}
            onPointerUp={up(t)}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHover(t.key);
              document.body.style.cursor = active ? 'crosshair' : '';
            }}
            onPointerOut={() => {
              setHover((h) => (h === t.key ? null : h));
              document.body.style.cursor = '';
            }}
          >
            <sphereGeometry args={[0.0032, 14, 10]} />
            <meshBasicMaterial color={color} toneMapped={false} transparent opacity={active ? 0.95 : 0.55} />
            {hover === t.key && (
              <Html distanceFactor={0.35} position={[0, 0.012, 0]} center style={{ pointerEvents: 'none' }}>
                <div style={{ background: 'rgba(12,16,22,.92)', color: '#e4e9f0', padding: '3px 8px', borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap', border: '1px solid #3a4656' }}>
                  {t.ownerLabel} · {t.def.label} <span style={{ color: '#8e9aab' }}>({t.def.accepts.join('/')})</span>
                </div>
              </Html>
            )}
          </mesh>
        );
      })}
      {tool === 'instrument' && <LoadProbes project={project} layout={layout} />}
      {tool === 'wire' && wireStart && <WirePreview start={wireStart} project={project} layout={layout} />}
    </group>
  );
}

function completeWire(from: TerminalRef, to: TerminalRef, strict: boolean) {
  const ui = useUiStore.getState();
  const r = useProjectStore.getState().addWire(from, to, ui.wireDraft.color, ui.wireDraft.sectionMm2, strict);
  if (r.ok) {
    ui.set({ wireStart: null });
    ui.toast('ok', 'Condutor ligado.');
  } else {
    ui.toast(strict ? 'error' : 'warn', `Ligação recusada: ${r.message}`);
  }
}

export function addProbe(key: string) {
  const ui = useUiStore.getState();
  const two = ui.instrument === 'multimetro-v' || ui.instrument === 'multimetro-ohm';
  if (!two) {
    ui.set({ probes: [key] });
    return;
  }
  const p = ui.probes.filter((k) => !k.startsWith('wire:'));
  ui.set({ probes: p.length >= 2 ? [key] : [...p, key] });
}

function LoadProbes({ project, layout }: { project: Project; layout: BoardLayout }) {
  const probes = useUiStore((s) => s.probes);
  const loadY = -layout.height / 2 - 0.13;
  return (
    <group>
      {project.circuits.map((c) => {
        const o = outputOrigin(project, layout, c.id);
        if (!o) return null;
        const ids = circuitTerminalIds(c.connection);
        const cx = o[0] + (ids.length * 0.011) / 2;
        return ids.map((id, i) => {
          const key = loadNode(c.id, id);
          const sel = probes.includes(key);
          const color = sel ? (probes[0] === key ? '#ff3b30' : '#111') : id === 'N' ? FN_COLOR.N : id === 'PE' ? FN_COLOR.PE : FN_COLOR.L;
          return (
            <mesh
              key={key}
              position={[cx + (i - (ids.length - 1) / 2) * 0.014, loadY - 0.03, 0.035]}
              onPointerDown={(e) => {
                e.stopPropagation();
                addProbe(key);
              }}
            >
              <sphereGeometry args={[sel ? 0.0045 : 0.0034, 14, 10]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
          );
        });
      })}
    </group>
  );
}

function WirePreview({ start, project, layout }: { start: TerminalRef; project: Project; layout: BoardLayout }) {
  const pose = terminalPose(project, start, layout);
  const { camera, pointer } = useThree();
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), []);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.05), []);
  const tmp = useRef(new THREE.Vector3());
  const color = useUiStore((s) => s.wireDraft.color);
  useFrame(() => {
    if (!pose) return;
    ray.setFromCamera(pointer, camera);
    if (!ray.ray.intersectPlane(plane, tmp.current)) return;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, ...pose.position);
    pos.setXYZ(1, tmp.current.x, tmp.current.y, tmp.current.z);
    pos.needsUpdate = true;
    geo.computeBoundingSphere();
  });
  if (!pose) return null;
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={color === 'preto' ? '#cccccc' : undefined} linewidth={2} />
    </lineSegments>
  );
}
