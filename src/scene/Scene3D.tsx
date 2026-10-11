/** Cena 3D principal do quadro de distribuição. */
import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useProjectStore } from '../app/projectStore';
import { useUiStore } from '../app/uiStore';
import { useSimStore } from '../app/simStore';
import { useAnalysis } from '../app/analysis';
import { boardLayout, type BoardLayout } from '../model/geometry';
import type { Project } from '../model/schema';
import { conductorAmpacity } from '../electrical/calculations/ampacity';
import type { SimulationSnapshot } from '../electrical/simulation/engine';
import { CameraRig } from './CameraRig';
import { Enclosure } from './Enclosure';
import { DeviceModel } from './components/DeviceModel';
import { CircuitOutputs, CombModel, EntryBlock, MainBars } from './components/FixedBlocks';
import { WireLayer } from './wires/WireLayer';
import { TerminalHandles } from './interaction/TerminalHandles';
import { Ghost, PlacementPlane } from './interaction/Placement';

function EnvironmentLight() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

const izCache = new Map<number, number>();
function referenceIz(section: number) {
  if (!izCache.has(section)) {
    const r = conductorAmpacity({ sectionMm2: section, material: 'cobre', insulation: 'PVC', method: 'B1', loadedConductors: 2, ambientTempC: 30, groupedCircuits: 1 });
    izCache.set(section, r.status === 'ok' ? r.value.izA : Infinity);
  }
  return izCache.get(section)!;
}

function Board({ project, layout, snapshot }: { project: Project; layout: BoardLayout; snapshot: SimulationSnapshot }) {
  const selection = useUiStore((s) => s.selection);
  const thermal = useSimStore((s) => s.thermal);
  const overloaded = useMemo(() => {
    const s = new Set<string>();
    if (!project.simulation.energized) return s;
    for (const w of project.wires) {
      const i = snapshot.wireCurrentsA.get(w.id) ?? 0;
      if (i > referenceIz(w.sectionMm2)) s.add(w.id);
    }
    return s;
  }, [project, snapshot]);

  return (
    <group>
      <Enclosure layout={layout} mounting={project.enclosure.mounting} label={project.enclosure.label} />
      <EntryBlock project={project} layout={layout} />
      <MainBars layout={layout} />
      <CircuitOutputs project={project} layout={layout} readings={snapshot.circuits} />
      {project.devices.map((d) => (
        <DeviceModel key={d.id} device={d} layout={layout} selected={selection?.kind === 'device' && selection.id === d.id} heat={thermal[d.id] ?? 0} />
      ))}
      {project.combs.map((c) => (
        <CombModel key={c.id} comb={c} layout={layout} selected={selection?.kind === 'comb' && selection.id === c.id} />
      ))}
      <WireLayer project={project} layout={layout} currents={snapshot.wireCurrentsA} overloaded={overloaded} />
      <TerminalHandles project={project} layout={layout} />
      <PlacementPlane project={project} layout={layout} />
      <Ghost layout={layout} />
    </group>
  );
}

export function Scene3D() {
  const project = useProjectStore((s) => s.project);
  const { snapshot } = useAnalysis();
  const layout = useMemo(() => boardLayout(project), [project]);
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      onPointerMissed={(e) => {
        const ui = useUiStore.getState();
        if (e.button !== 0) return;
        if (ui.tool === 'select') ui.select(null);
        if (ui.tool === 'wire' && ui.wireStart) ui.set({ wireStart: null });
      }}
    >
      <color attach="background" args={['#161c23']} />
      <EnvironmentLight />
      <hemisphereLight args={['#e6eef8', '#2a2f36', 0.42]} />
      <directionalLight
        position={[0.7, 1.4, 1.6]}
        intensity={1.25}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-1}
        shadow-camera-right={1}
        shadow-camera-top={1}
        shadow-camera-bottom={-1}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-1.1, 0.3, 0.9]} intensity={0.35} />
      <CameraRig layout={layout} />
      <Board project={project} layout={layout} snapshot={snapshot} />
    </Canvas>
  );
}
