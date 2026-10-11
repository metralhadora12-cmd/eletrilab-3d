/** Bornes de entrada, barramentos principais, bornes de saída, pentes e cargas virtuais. */
import { useMemo } from 'react';
import * as THREE from 'three';
import { getCatalogItem } from '../../catalog';
import { MODULE_MM } from '../../catalog/devices';
import type { Comb, Project } from '../../model/schema';
import {
  MODULE_M,
  RAIL_Z,
  barOrigin,
  entryBlockOrigin,
  outputOrigin,
  type BoardLayout,
} from '../../model/geometry';
import { OUTPUT_PITCH_MM, circuitTerminals, entryTerminals, mainBarTerminals } from '../../model/terminals';
import { labelTexture } from '../textures';
import { useUiStore } from '../../app/uiStore';
import type { CircuitReading } from '../../electrical/simulation/engine';
import { formatNumberBR } from '../../electrical/core/units';

const SERVICE_COLOR: Record<string, string> = { L1: '#1c1c1e', L2: '#c0182c', L3: '#6b3d24', N: '#4b9fe0', PE: '#1d8a3a' };

function Screw({ position, r = 0.003 }: { position: [number, number, number]; r?: number }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[r, r, 0.002, 14]} />
      <meshStandardMaterial color="#cfd2d5" metalness={0.85} roughness={0.28} />
    </mesh>
  );
}

function tube(points: THREE.Vector3[], r: number) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal'), 40, r, 10, false);
}

export function EntryBlock({ project, layout }: { project: Project; layout: BoardLayout }) {
  const terms = entryTerminals(project.supply);
  const [x0, y0, z0] = entryBlockOrigin(layout);
  const width = terms.length * 0.016 + 0.004;
  const label = useMemo(
    () => labelTexture([{ text: `ENTRADA ${project.supply.systemVoltage} V · ${project.supply.earthing}`, size: 26, bold: true, color: '#e9edf2' }], { w: 520, h: 48, bg: '#2a3038' }),
    [project.supply.systemVoltage, project.supply.earthing],
  );
  const service = useMemo(() => {
    const top = layout.height / 2 + 0.25;
    const gx = layout.railLeftX + 0.04;
    return terms.map((t) => {
      const tx = x0 + t.xMm / 1000;
      return {
        id: t.id,
        geo: tube(
          [
            new THREE.Vector3(gx, top, 0.035),
            new THREE.Vector3(gx, layout.height / 2 + 0.01, 0.035),
            new THREE.Vector3(gx + (tx - gx) * 0.5, y0 + 0.05, 0.033),
            new THREE.Vector3(tx, y0 + 0.022, z0),
          ],
          0.0028,
        ),
      };
    });
  }, [terms, layout, x0, y0, z0]);
  const sheath = useMemo(() => {
    const gx = layout.railLeftX + 0.04;
    return tube([new THREE.Vector3(gx, layout.height / 2 + 0.3, 0.035), new THREE.Vector3(gx, layout.height / 2 + 0.012, 0.035)], 0.011);
  }, [layout]);
  return (
    <group>
      <mesh position={[x0 + width / 2 - 0.002, y0, z0 / 2]} castShadow>
        <boxGeometry args={[width, 0.045, z0]} />
        <meshStandardMaterial color="#5b636c" roughness={0.6} />
      </mesh>
      {terms.map((t) => (
        <group key={t.id}>
          <Screw position={[x0 + t.xMm / 1000, y0 - 0.008, z0 + 0.001]} />
          <mesh position={[x0 + t.xMm / 1000, y0 + 0.013, z0 + 0.0005]}>
            <planeGeometry args={[0.012, 0.008]} />
            <meshBasicMaterial color={SERVICE_COLOR[t.id]} />
          </mesh>
        </group>
      ))}
      <mesh position={[x0 + width / 2, y0 + 0.034, 0.02]}>
        <planeGeometry args={[Math.max(width, 0.11), 0.011]} />
        <meshBasicMaterial map={label} />
      </mesh>
      <mesh geometry={sheath}>
        <meshStandardMaterial color="#3b3f45" roughness={0.7} />
      </mesh>
      {service.map((s) => (
        <mesh key={s.id} geometry={s.geo}>
          <meshStandardMaterial color={SERVICE_COLOR[s.id]} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

export function MainBars({ layout }: { layout: BoardLayout }) {
  return (
    <group>
      {(['PE', 'N'] as const).map((fn) => {
        const [x0, y0, z0] = barOrigin(layout, fn);
        const terms = mainBarTerminals(fn);
        const len = terms.length * 0.014;
        const insulator = fn === 'N' ? '#2f6db5' : '#2e8b3e';
        return (
          <group key={fn}>
            {[0.012, len - 0.012].map((x) => (
              <mesh key={x} position={[x0 + x, y0, z0 / 2]}>
                <boxGeometry args={[0.012, 0.018, z0]} />
                <meshStandardMaterial color={insulator} roughness={0.5} />
              </mesh>
            ))}
            <mesh position={[x0 + len / 2, y0, z0]} castShadow>
              <boxGeometry args={[len, 0.012, 0.008]} />
              <meshStandardMaterial color="#c9a23a" metalness={0.9} roughness={0.28} />
            </mesh>
            {terms.map((t) => (
              <Screw key={t.id} position={[x0 + t.xMm / 1000, y0, z0 + 0.005]} r={0.0026} />
            ))}
            <BarTag x={x0 + len / 2} y={y0 - 0.017} text={fn === 'N' ? 'BARRAMENTO N' : 'BARRAMENTO PE'} color={insulator} />
          </group>
        );
      })}
    </group>
  );
}

function BarTag({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  const tex = useMemo(() => labelTexture([{ text, size: 24, bold: true, color: '#fff' }], { w: 300, h: 40, bg: color }), [text, color]);
  return (
    <mesh position={[x, y, 0.02]}>
      <planeGeometry args={[0.075, 0.01]} />
      <meshBasicMaterial map={tex} />
    </mesh>
  );
}

export function CircuitOutputs({ project, layout, readings }: { project: Project; layout: BoardLayout; readings: Map<string, CircuitReading> }) {
  const select = useUiStore((s) => s.select);
  const selection = useUiStore((s) => s.selection);
  return (
    <group>
      {project.circuits.map((c) => {
        const o = outputOrigin(project, layout, c.id);
        if (!o) return null;
        const terms = circuitTerminals(c);
        const w = terms.length * (OUTPUT_PITCH_MM / 1000);
        const sel = selection?.kind === 'circuit' && selection.id === c.id;
        return (
          <group key={c.id}>
            {terms.map((t) => {
              const color = t.id === 'N' ? '#3b82c4' : t.id === 'PE' ? '#3c9a4a' : '#8d939a';
              return (
                <group key={t.id}>
                  <mesh
                    position={[o[0] + t.xMm / 1000, o[1], o[2] / 2]}
                    onPointerDown={(e) => {
                      const ui = useUiStore.getState();
                      if (ui.tool !== 'select') return;
                      e.stopPropagation();
                      select({ kind: 'circuit', id: c.id });
                    }}
                    castShadow
                  >
                    <boxGeometry args={[OUTPUT_PITCH_MM / 1000 - 0.0012, 0.03, o[2]]} />
                    <meshStandardMaterial color={color} roughness={0.55} emissive={sel ? '#1f4f9a' : '#000'} emissiveIntensity={sel ? 0.6 : 0} />
                  </mesh>
                  <Screw position={[o[0] + t.xMm / 1000, o[1] + 0.006, o[2] + 0.001]} r={0.0022} />
                </group>
              );
            })}
            <OutputTag x={o[0] + w / 2} y={o[1] - 0.022} text={`C${c.number}`} />
            <OutgoingCable project={project} layout={layout} circuitId={c.id} x={o[0] + w / 2} y={o[1]} reading={readings.get(c.id)} />
          </group>
        );
      })}
    </group>
  );
}

function OutputTag({ x, y, text }: { x: number; y: number; text: string }) {
  const tex = useMemo(() => labelTexture([{ text, size: 30, bold: true }], { w: 120, h: 44, bg: '#f3f2ec' }), [text]);
  return (
    <mesh position={[x, y, 0.026]}>
      <planeGeometry args={[0.026, 0.0095]} />
      <meshBasicMaterial map={tex} />
    </mesh>
  );
}

/** Cabo do circuito saindo pela parte inferior até a carga virtual. */
function OutgoingCable({
  project,
  layout,
  circuitId,
  x,
  y,
  reading,
}: {
  project: Project;
  layout: BoardLayout;
  circuitId: string;
  x: number;
  y: number;
  reading?: CircuitReading;
}) {
  const c = project.circuits.find((cc) => cc.id === circuitId)!;
  const loadY = -layout.height / 2 - 0.13;
  const geo = useMemo(
    () => tube([new THREE.Vector3(x, y - 0.016, 0.02), new THREE.Vector3(x, -layout.height / 2 + 0.01, 0.025), new THREE.Vector3(x, loadY + 0.05, 0.03)], 0.0042),
    [x, y, layout.height, loadY],
  );
  const v = reading?.voltageV ?? 0;
  const glow = reading?.energized ? Math.min(1.4, (v / reading.nominalV) ** 2) : 0;
  const fault = reading?.status === 'falta' || (reading?.touchVoltageV ?? 0) > 50;
  const tex = useMemo(
    () =>
      labelTexture(
        [
          { text: `C${c.number}`, size: 34, bold: true, color: '#e9edf2' },
          { text: c.name.slice(0, 18), size: 22, color: '#b9c3cf' },
          { text: reading?.energized ? `${formatNumberBR(v, 1)} V · ${formatNumberBR(reading.currentA, 2)} A` : 'desenergizado', size: 22, mono: true, color: reading?.energized ? '#8ef0b4' : '#8a96a5' },
        ],
        { w: 260, h: 150, bg: '#1d242d', border: fault ? '#e5534b' : '#3a4656' },
      ),
    [c.number, c.name, reading?.energized, v, reading?.currentA, fault],
  );
  const select = useUiStore((s) => s.select);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#5a5f66" roughness={0.75} />
      </mesh>
      <group position={[x, loadY, 0.03]}>
        <mesh
          onPointerDown={(e) => {
            if (useUiStore.getState().tool !== 'select') return;
            e.stopPropagation();
            select({ kind: 'circuit', id: c.id });
          }}
        >
          <boxGeometry args={[0.07, 0.042, 0.012]} />
          <meshStandardMaterial color="#1d242d" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.0062]}>
          <planeGeometry args={[0.068, 0.04]} />
          <meshBasicMaterial map={tex} />
        </mesh>
        <mesh position={[0, 0.034, 0]}>
          <sphereGeometry args={[0.011, 20, 16]} />
          <meshStandardMaterial
            color={fault ? '#e5534b' : glow > 0 ? '#fff3c4' : '#6d7177'}
            emissive={fault ? '#e5534b' : '#ffc940'}
            emissiveIntensity={fault ? 1.2 : glow * 2.2}
            roughness={0.3}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

export function CombModel({ comb, layout, selected }: { comb: Comb; layout: BoardLayout; selected: boolean }) {
  const item = getCatalogItem(comb.catalogId);
  const y = layout.rowY(comb.row) + 0.0425 + 0.005;
  const x0 = layout.railLeftX + comb.startModule * MODULE_M;
  const len = comb.lengthModules * MODULE_M;
  const onDown = (e: { stopPropagation: () => void }) => {
    const ui = useUiStore.getState();
    if (ui.tool !== 'select') return;
    e.stopPropagation();
    ui.select({ kind: 'comb', id: comb.id });
  };
  return (
    <group>
      <mesh position={[x0 + len / 2, y + 0.004, RAIL_Z + 0.03]} onPointerDown={onDown} castShadow>
        <boxGeometry args={[len - 0.002, 0.008, 0.01]} />
        <meshStandardMaterial color={item?.appearance.bodyColor ?? '#c4532a'} roughness={0.45} emissive={selected ? '#1f4f9a' : '#000'} emissiveIntensity={selected ? 0.7 : 0} />
      </mesh>
      {Array.from({ length: comb.lengthModules }, (_, i) => (
        <mesh key={i} position={[x0 + i * MODULE_M + MODULE_MM / 2000, y - 0.004, RAIL_Z + 0.03]}>
          <boxGeometry args={[0.004, 0.01, 0.003]} />
          <meshStandardMaterial color="#b87333" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}
