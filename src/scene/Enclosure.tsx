/** Invólucro do quadro: caixa, chapa de montagem, trilhos DIN, porta e tampa (espelho). */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useUiStore } from '../app/uiStore';
import { MODULE_M, RAIL_Z, type BoardLayout } from '../model/geometry';
import { labelTexture } from './textures';

const FRONT_WINDOW = 0.047;

export function Enclosure({ layout, mounting, label }: { layout: BoardLayout; mounting: 'embutir' | 'sobrepor'; label: string }) {
  const transparent = useUiStore((s) => s.transparent);
  const cutaway = useUiStore((s) => s.cutaway);
  const { width: w, height: h, depth: d } = layout;
  const t = 0.002;

  const shell = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: mounting === 'embutir' ? '#e8e7e1' : '#d7d6cf',
        metalness: mounting === 'embutir' ? 0.05 : 0.35,
        roughness: 0.55,
      }),
    [mounting],
  );
  shell.transparent = transparent;
  shell.opacity = transparent ? 0.14 : 1;
  shell.depthWrite = !transparent;

  const railLen = layout.modulesPerRow * MODULE_M + 0.012;
  return (
    <group>
      <Wall layout={layout} mounting={mounting} />
      {/* Fundo e chapa de montagem */}
      <mesh position={[0, 0, -t / 2]} material={shell} receiveShadow>
        <boxGeometry args={[w, h, t]} />
      </mesh>
      <mesh position={[0, 0, 0.0015]} receiveShadow>
        <boxGeometry args={[w - 0.03, h - 0.03, 0.002]} />
        <meshStandardMaterial color="#b8bcbf" metalness={0.65} roughness={0.42} />
      </mesh>
      {/* Laterais */}
      <mesh position={[-w / 2 + t / 2, 0, d / 2]} material={shell} castShadow>
        <boxGeometry args={[t, h, d]} />
      </mesh>
      {!cutaway && (
        <mesh position={[w / 2 - t / 2, 0, d / 2]} material={shell} castShadow>
          <boxGeometry args={[t, h, d]} />
        </mesh>
      )}
      {!cutaway && (
        <mesh position={[0, h / 2 - t / 2, d / 2]} material={shell} castShadow>
          <boxGeometry args={[w, t, d]} />
        </mesh>
      )}
      <mesh position={[0, -h / 2 + t / 2, d / 2]} material={shell}>
        <boxGeometry args={[w, t, d]} />
      </mesh>
      {/* Flange frontal */}
      {[
        [0, h / 2 - 0.008, w, 0.016],
        [0, -h / 2 + 0.008, w, 0.016],
        [-w / 2 + 0.008, 0, 0.016, h],
        [w / 2 - 0.008, 0, 0.016, h],
      ].map(([x, y, sw, sh], i) =>
        cutaway && (i === 0 || i === 3) ? null : (
          <mesh key={i} position={[x, y, d - 0.002]} material={shell}>
            <boxGeometry args={[sw, sh, 0.004]} />
          </mesh>
        ),
      )}
      {/* Prensa-cabos superior (entrada) e inferior (saída) */}
      <mesh position={[layout.railLeftX + 0.04, h / 2 + 0.006, 0.035]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.016, 0.014, 24]} />
        <meshStandardMaterial color="#2a2d31" roughness={0.6} />
      </mesh>
      {/* Trilhos DIN 35 mm */}
      {Array.from({ length: layout.rows }, (_, r) => (
        <group key={r} position={[0, layout.rowY(r), 0]}>
          <mesh position={[0, 0, 0.0035]} castShadow receiveShadow>
            <boxGeometry args={[railLen, 0.027, 0.001]} />
            <meshStandardMaterial color="#c9cdd0" metalness={0.8} roughness={0.32} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh position={[0, s * 0.0135, RAIL_Z / 2 + 0.002]}>
                <boxGeometry args={[railLen, 0.001, RAIL_Z - 0.002]} />
                <meshStandardMaterial color="#c3c7ca" metalness={0.8} roughness={0.35} />
              </mesh>
              <mesh position={[0, s * 0.0155, RAIL_Z - 0.0005]}>
                <boxGeometry args={[railLen, 0.005, 0.001]} />
                <meshStandardMaterial color="#cfd3d6" metalness={0.8} roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      <Cover layout={layout} />
      <Door layout={layout} mounting={mounting} label={label} />
    </group>
  );
}

function Wall({ layout, mounting }: { layout: BoardLayout; mounting: 'embutir' | 'sobrepor' }) {
  const { width: w, height: h, depth: d } = layout;
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: 0.95, metalness: 0 }), []);
  if (mounting === 'sobrepor') {
    return (
      <mesh position={[0, -0.12, -0.004]} material={mat} receiveShadow>
        <planeGeometry args={[3.2, 2.6]} />
      </mesh>
    );
  }
  const z = d - 0.004;
  const W = 3.2;
  const H = 2.6;
  const cy = -0.12;
  const top = H / 2 + cy - h / 2;
  const bottom = H / 2 - cy - h / 2;
  return (
    <group>
      <mesh position={[0, h / 2 + top / 2, z]} material={mat} receiveShadow>
        <planeGeometry args={[W, top]} />
      </mesh>
      <mesh position={[0, -h / 2 - bottom / 2, z]} material={mat} receiveShadow>
        <planeGeometry args={[W, bottom]} />
      </mesh>
      <mesh position={[-(w / 2 + (W / 2 - w / 2) / 2), 0, z]} material={mat} receiveShadow>
        <planeGeometry args={[W / 2 - w / 2, h]} />
      </mesh>
      <mesh position={[w / 2 + (W / 2 - w / 2) / 2, 0, z]} material={mat} receiveShadow>
        <planeGeometry args={[W / 2 - w / 2, h]} />
      </mesh>
      <mesh position={[0, 0, -0.03]} material={mat}>
        <planeGeometry args={[w + 0.1, h + 0.1]} />
      </mesh>
    </group>
  );
}

/** Tampa de proteção (espelho) com janelas para as frentes dos dispositivos. */
function Cover({ layout }: { layout: BoardLayout }) {
  const coverOn = useUiStore((s) => s.coverOn);
  const group = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ecebe6', roughness: 0.5, transparent: true }), []);
  const k = useRef(coverOn ? 1 : 0);
  useFrame((_, dt) => {
    const target = coverOn ? 1 : 0;
    k.current += (target - k.current) * Math.min(1, dt * 7);
    if (!group.current) return;
    group.current.position.z = (1 - k.current) * 0.3;
    mat.opacity = k.current;
    group.current.visible = k.current > 0.02;
  });
  const { width: w, height: h, depth: d } = layout;
  const iw = w - 0.03;
  const winW = layout.modulesPerRow * MODULE_M + 0.004;
  const strips: Array<[number, number, number, number]> = [];
  const edges: number[] = [h / 2 - 0.015];
  for (let r = 0; r < layout.rows; r++) edges.push(layout.rowY(r) + FRONT_WINDOW / 2, layout.rowY(r) - FRONT_WINDOW / 2);
  edges.push(-h / 2 + 0.015);
  for (let i = 0; i < edges.length; i += 2) {
    const top = edges[i];
    const bot = edges[i + 1];
    strips.push([0, (top + bot) / 2, iw, top - bot]);
  }
  for (let r = 0; r < layout.rows; r++) {
    const side = (iw - winW) / 2;
    strips.push([-(winW / 2 + side / 2), layout.rowY(r), side, FRONT_WINDOW], [winW / 2 + side / 2, layout.rowY(r), side, FRONT_WINDOW]);
  }
  return (
    <group ref={group}>
      {strips.map(([x, y, sw, sh], i) => (
        <mesh key={i} position={[x, y, d - 0.012]} material={mat} castShadow>
          <boxGeometry args={[sw, sh, 0.003]} />
        </mesh>
      ))}
    </group>
  );
}

function Door({ layout, mounting, label }: { layout: BoardLayout; mounting: 'embutir' | 'sobrepor'; label: string }) {
  const doorOpen = useUiStore((s) => s.doorOpen);
  const transparent = useUiStore((s) => s.transparent);
  const hinge = useRef<THREE.Group>(null);
  const angle = useRef(doorOpen ? -1.95 : 0);
  useFrame((_, dt) => {
    const target = doorOpen ? -1.95 : 0;
    angle.current += (target - angle.current) * Math.min(1, dt * 5);
    if (hinge.current) hinge.current.rotation.y = angle.current;
  });
  const { width: w, height: h, depth: d } = layout;
  const tex = useMemo(
    () =>
      labelTexture(
        [
          { text: '⚡', size: 64, color: '#d6a400', bold: true },
          { text: label || 'QDC', size: 40, bold: true },
          { text: 'Quadro de distribuição', size: 22, color: '#555' },
        ],
        { w: 360, h: 220, bg: mounting === 'embutir' ? '#f1f0eb' : '#dddcd5' },
      ),
    [label, mounting],
  );
  return (
    <group ref={hinge} position={[-w / 2, 0, d + 0.002]}>
      <mesh position={[w / 2, 0, 0.006]} castShadow>
        <boxGeometry args={[w, h, 0.01]} />
        <meshStandardMaterial
          color={mounting === 'embutir' ? '#f1f0eb' : '#d9d8d1'}
          metalness={mounting === 'embutir' ? 0.05 : 0.35}
          roughness={0.5}
          transparent={transparent}
          opacity={transparent ? 0.2 : 1}
          depthWrite={!transparent}
        />
      </mesh>
      <mesh position={[w / 2, h * 0.2, 0.0115]}>
        <planeGeometry args={[Math.min(0.2, w * 0.5), Math.min(0.12, w * 0.3)]} />
        <meshBasicMaterial map={tex} transparent={transparent} opacity={transparent ? 0.3 : 1} />
      </mesh>
      <mesh position={[w - 0.025, 0, 0.016]}>
        <boxGeometry args={[0.012, 0.07, 0.012]} />
        <meshStandardMaterial color="#3a3f45" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}
