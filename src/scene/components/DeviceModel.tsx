/** Modelos 3D dos dispositivos modulares (geometria procedural a partir do catálogo). */
import { useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { effectiveElectrical, getCatalogItem } from '../../catalog';
import type { BreakerElectrical, CatalogItem, RcdElectrical, SpdElectrical } from '../../catalog/schema';
import type { DeviceInstance } from '../../model/schema';
import { RAIL_Z, deviceBox, type BoardLayout } from '../../model/geometry';
import { THERMAL_MODEL } from '../../electrical/core/constants';
import { useUiStore } from '../../app/uiStore';
import { useProjectStore } from '../../app/projectStore';
import { formatNumberBR } from '../../electrical/core/units';
import { labelTexture, type LabelLine } from '../textures';
import { beginMove } from '../interaction/Placement';

const PX_PER_M = 6000;

function frontLines(device: DeviceInstance, item: CatalogItem): { lines: LabelLine[]; bg: string } {
  const e = effectiveElectrical(device, item);
  switch (e.category) {
    case 'disjuntor': {
      const b = e as BreakerElectrical;
      return {
        bg: '#f4f4f1',
        lines: [
          { text: device.label, size: 30, bold: true, color: '#2d5fb0' },
          { text: `${b.curve ?? '?'}${b.ratedCurrentA ?? '?'}`, size: 46, bold: true },
          { text: b.breakingCapacityKA !== null ? `${formatNumberBR(b.breakingCapacityKA * 1000, 0)}` : '????', size: 24, mono: true, color: '#333' },
        ],
      };
    }
    case 'dr': {
      const r = e as RcdElectrical;
      return {
        bg: '#f2f5fa',
        lines: [
          { text: device.label, size: 30, bold: true, color: '#2d5fb0' },
          { text: `${r.ratedCurrentA ?? '?'} A`, size: 38, bold: true },
          { text: `IΔn ${r.residualCurrentMA ?? '?'} mA`, size: 26, color: '#333' },
          { text: `tipo ${r.rcdType ?? '?'}`, size: 22, color: '#555' },
        ],
      };
    }
    case 'dps': {
      const s = e as SpdElectrical;
      return {
        bg: '#f6f1ea',
        lines: [
          { text: device.label, size: 26, bold: true, color: '#b04a10' },
          { text: `T${s.spdClass ?? '?'}`, size: 34, bold: true },
          { text: `${s.ucV ?? '?'}V`, size: 22, color: '#333' },
        ],
      };
    }
    case 'barramento':
      return { bg: item.appearance.bodyColor, lines: [{ text: device.label, size: 30, bold: true, color: '#fff' }] };
    default:
      return { bg: item.appearance.bodyColor, lines: [{ text: device.label, size: 26, bold: true, color: '#111' }] };
  }
}

export function DeviceModel({
  device,
  layout,
  selected,
  heat,
}: {
  device: DeviceInstance;
  layout: BoardLayout;
  selected: boolean;
  heat: number;
}) {
  const item = getCatalogItem(device.catalogId);
  const box = deviceBox(device, layout);
  const [hover, setHover] = useState(false);
  if (!item) return null;

  const onBodyDown = (e: ThreeEvent<PointerEvent>) => {
    const ui = useUiStore.getState();
    if (ui.tool === 'wire' || ui.tool === 'instrument' || ui.tool === 'place') return;
    e.stopPropagation();
    ui.select({ kind: 'device', id: device.id });
    if (ui.mode === 'montagem' && e.button === 0) beginMove(device.id);
  };

  const common = { selected, hover, setHover, onBodyDown, box, item, device, heat };
  return (
    <group position={[box.left, layout.rowY(device.row), RAIL_Z]}>
      {item.category === 'disjuntor' || item.category === 'dr' || item.category === 'dps' ? (
        <ModularBody {...common} />
      ) : item.category === 'barramento' ? (
        <BusbarBody {...common} />
      ) : (
        <TerminalBlockBody {...common} />
      )}
      {selected && <Outline w={box.width} h={box.height} d={box.depth} />}
    </group>
  );
}

interface BodyProps {
  selected: boolean;
  hover: boolean;
  setHover: (b: boolean) => void;
  onBodyDown: (e: ThreeEvent<PointerEvent>) => void;
  box: { width: number; height: number; depth: number };
  item: CatalogItem;
  device: DeviceInstance;
  heat: number;
}

function Outline({ w, h, d }: { w: number; h: number; d: number }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.003, h + 0.003, d + 0.003)), [w, h, d]);
  return (
    <lineSegments geometry={geo} position={[w / 2, 0, d / 2]}>
      <lineBasicMaterial color="#4d9bff" />
    </lineSegments>
  );
}

function ModularBody({ hover, setHover, onBodyDown, box, item, device, heat }: BodyProps) {
  const { width: w, height: h, depth: d } = box;
  const backD = 0.046;
  const front = useMemo(() => frontLines(device, item), [device, item]);
  const tex = useMemo(
    () => labelTexture(front.lines, { w: Math.max(80, Math.round(w * 0.9 * PX_PER_M)), h: 240, bg: front.bg }),
    [front, w],
  );
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: item.appearance.bodyColor, roughness: 0.48, metalness: 0.02 }), [item]);
  const k = Math.max(0, Math.min(1, (heat / THERMAL_MODEL.thresholdMultiple ** 2 - 0.45) * 2));
  bodyMat.emissive.set(k > 0 ? '#ff5a14' : hover ? '#2a4466' : '#000000');
  bodyMat.emissiveIntensity = k > 0 ? 0.55 * k : hover ? 0.35 : 0;

  return (
    <group onPointerDown={onBodyDown} onPointerOver={(e) => (e.stopPropagation(), setHover(true))} onPointerOut={() => setHover(false)}>
      <mesh position={[w / 2, 0, backD / 2]} material={bodyMat} castShadow receiveShadow>
        <boxGeometry args={[w - 0.0006, h, backD]} />
      </mesh>
      <mesh position={[w / 2, 0, backD + (d - backD) / 2]} material={bodyMat} castShadow>
        <boxGeometry args={[w - 0.0006, 0.045, d - backD]} />
      </mesh>
      {/* chanfros do ombro */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[w / 2, s * 0.0265, backD + 0.004]} rotation={[s * 0.6, 0, 0]} material={bodyMat}>
          <boxGeometry args={[w - 0.0008, 0.012, 0.006]} />
        </mesh>
      ))}
      {/* bornes: aberturas e parafusos */}
      {item.terminals.map((t) => {
        const y = (t.side === 'top' ? 1 : -1) * (h / 2 - 0.011);
        return (
          <group key={t.id}>
            <mesh position={[t.xMm / 1000, (t.side === 'top' ? 1 : -1) * (h / 2 - 0.001), 0.03]}>
              <boxGeometry args={[0.011, 0.003, 0.012]} />
              <meshStandardMaterial color="#141618" roughness={0.9} />
            </mesh>
            <mesh position={[t.xMm / 1000, y, backD + 0.0006]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.0034, 0.0034, 0.0016, 16]} />
              <meshStandardMaterial color="#b9bdc1" metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[t.xMm / 1000, y, backD + 0.0016]}>
              <boxGeometry args={[0.005, 0.0008, 0.0005]} />
              <meshStandardMaterial color="#555" />
            </mesh>
          </group>
        );
      })}
      {/* placa frontal */}
      <mesh position={[w / 2, -0.004, d + 0.0002]}>
        <planeGeometry args={[w * 0.88, 0.036]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {item.category === 'dps' ? <SpdWindow device={device} w={w} d={d} /> : <Lever device={device} item={item} w={w} d={d} />}
      {item.category === 'dr' && <TestButton device={device} w={w} d={d} />}
    </group>
  );
}

function Lever({ device, item, w, d }: { device: DeviceInstance; item: CatalogItem; w: number; d: number }) {
  const ref = useRef<THREE.Group>(null);
  const target = device.state === 'on' ? -0.55 : device.state === 'off' ? 0.55 : 0;
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.x += (target - ref.current.rotation.x) * Math.min(1, dt * 14);
  });
  const toggle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const st = useProjectStore.getState();
    const next = device.state === 'on' ? 'off' : device.state === 'off' ? 'on' : 'off';
    st.setDeviceState(device.id, next);
    useUiStore.getState().addLog('info', `${device.label}: ${next === 'on' ? 'ligado' : device.state === 'tripped' ? 'rearmado (desligado)' : 'desligado'}`);
  };
  const lw = Math.max(0.008, w * 0.62);
  return (
    <group position={[w / 2, 0.012, d]}>
      <group ref={ref} rotation={[target, 0, 0]}>
        <mesh
          position={[0, 0, 0.007]}
          onClick={toggle}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = '')}
          castShadow
        >
          <boxGeometry args={[lw, 0.007, 0.016]} />
          <meshStandardMaterial color={item.appearance.accentColor} roughness={0.4} />
        </mesh>
      </group>
      {device.state === 'tripped' && (
        <mesh position={[w * 0.32, -0.03, 0.0008]}>
          <planeGeometry args={[0.004, 0.006]} />
          <meshBasicMaterial color="#e5534b" toneMapped={false} />
        </mesh>
      )}
      <mesh position={[-w * 0.32, -0.03, 0.0008]}>
        <planeGeometry args={[0.004, 0.006]} />
        <meshBasicMaterial color={device.state === 'on' ? '#d1342b' : '#2f9d55'} toneMapped={false} />
      </mesh>
    </group>
  );
}

function TestButton({ device, w, d }: { device: DeviceInstance; w: number; d: number }) {
  const press = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const project = useProjectStore.getState().project;
    const ui = useUiStore.getState();
    if (!project.simulation.energized) {
      ui.toast('info', 'Botão de teste: o DR precisa estar energizado para atuar.');
      return;
    }
    if (device.state !== 'on') {
      ui.toast('info', `${device.label} não está ligado.`);
      return;
    }
    useProjectStore.getState().applyTrips([device.id]);
    ui.addLog('trip', `${device.label}: atuou pelo botão de teste (circuito interno cria desequilíbrio entre os polos).`);
  };
  return (
    <mesh position={[w - 0.009, -0.02, d + 0.002]} rotation={[Math.PI / 2, 0, 0]} onClick={press} onPointerDown={(e) => e.stopPropagation()}>
      <cylinderGeometry args={[0.0032, 0.0032, 0.004, 16]} />
      <meshStandardMaterial color="#f2c230" roughness={0.4} />
    </mesh>
  );
}

function SpdWindow({ device, w, d }: { device: DeviceInstance; w: number; d: number }) {
  const eol = device.spd?.endOfLife;
  return (
    <mesh position={[w / 2, 0.014, d + 0.0004]}>
      <planeGeometry args={[w * 0.5, 0.006]} />
      <meshBasicMaterial color={eol ? '#e5534b' : '#3fb26f'} toneMapped={false} />
    </mesh>
  );
}

function BusbarBody({ hover, setHover, onBodyDown, box, item, device }: BodyProps) {
  const { width: w, height: h } = box;
  const tex = useMemo(() => labelTexture(frontLines(device, item).lines, { w: 200, h: 80, bg: item.appearance.bodyColor }), [device, item]);
  return (
    <group onPointerDown={onBodyDown} onPointerOver={(e) => (e.stopPropagation(), setHover(true))} onPointerOut={() => setHover(false)}>
      <mesh position={[w / 2, 0, 0.015]} castShadow>
        <boxGeometry args={[w - 0.002, h, 0.03]} />
        <meshStandardMaterial color={item.appearance.bodyColor} roughness={0.5} emissive={hover ? '#2a4466' : '#000'} emissiveIntensity={hover ? 0.4 : 0} />
      </mesh>
      <mesh position={[w / 2, 0, 0.034]} castShadow>
        <boxGeometry args={[w - 0.006, 0.012, 0.008]} />
        <meshStandardMaterial color="#c9a23a" metalness={0.9} roughness={0.28} />
      </mesh>
      {item.terminals.map((t) => (
        <mesh key={t.id} position={[t.xMm / 1000, (t.side === 'top' ? 1 : -1) * 0.012, 0.039]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.002, 14]} />
          <meshStandardMaterial color="#d8dadc" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[w / 2, 0, 0.0302]}>
        <planeGeometry args={[w * 0.3, 0.006]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  );
}

function TerminalBlockBody({ hover, setHover, onBodyDown, box, item }: BodyProps) {
  const { width: w, height: h, depth: d } = box;
  const stripes = item.id === 'borne-terra';
  return (
    <group onPointerDown={onBodyDown} onPointerOver={(e) => (e.stopPropagation(), setHover(true))} onPointerOut={() => setHover(false)}>
      <mesh position={[w / 2, 0, d / 2]} castShadow>
        <boxGeometry args={[w - 0.003, h, d]} />
        <meshStandardMaterial color={item.appearance.bodyColor} roughness={0.55} emissive={hover ? '#2a4466' : '#000'} emissiveIntensity={hover ? 0.4 : 0} />
      </mesh>
      {stripes && (
        <mesh position={[w / 2, 0, d + 0.0003]}>
          <planeGeometry args={[w * 0.6, h * 0.5]} />
          <meshStandardMaterial color="#e8c414" />
        </mesh>
      )}
      {item.terminals.map((t) => (
        <mesh key={t.id} position={[t.xMm / 1000, (t.side === 'top' ? 1 : -1) * (h / 2 - 0.009), d + 0.0006]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[t.id === 'IN' ? 0.0045 : 0.003, t.id === 'IN' ? 0.0045 : 0.003, 0.0016, 14]} />
          <meshStandardMaterial color="#c9cdd1" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}
