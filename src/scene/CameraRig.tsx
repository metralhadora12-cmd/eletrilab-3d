/** Câmeras (perspectiva / ortográfica frontal), controles orbitais e vistas predefinidas animadas. */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useUiStore } from '../app/uiStore';
import { useProjectStore } from '../app/projectStore';
import { deviceBox, type BoardLayout } from '../model/geometry';
import { registerScene } from './sceneApi';

const FOV = 38;

export function CameraRig({ layout }: { layout: BoardLayout }) {
  const ortho = useUiStore((s) => s.ortho);
  const dragging = useUiStore((s) => s.dragging);
  const req = useUiStore((s) => s.cameraRequest);
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, gl } = useThree();
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; zFrom: number; zTo: number; t: number } | null>(null);

  useEffect(() => {
    registerScene({ camera, dom: gl.domElement });
    return () => registerScene(null);
  }, [camera, gl]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const totalH = layout.height + 0.32;
    const centerY = -0.13;
    const aspect = size.width / Math.max(1, size.height);
    const fitDist = Math.max(totalH / 2 / Math.tan((FOV * Math.PI) / 360), layout.width / 2 / Math.tan((FOV * Math.PI) / 360) / aspect) * 1.12;
    let to = new THREE.Vector3(fitDist * 0.07, centerY + fitDist * 0.04, fitDist);
    let target = new THREE.Vector3(0, centerY, 0.03);
    let zoom = 1;
    if (ortho) {
      to = new THREE.Vector3(0, centerY, 2);
      zoom = Math.min(size.width / (layout.width * 1.25), size.height / (totalH * 1.08));
    } else if (req.kind === 'terminals') {
      const { project } = useProjectStore.getState();
      const sel = useUiStore.getState().selection;
      const dev = sel?.kind === 'device' ? project.devices.find((d) => d.id === sel.id) : project.devices[0];
      if (dev) {
        const b = deviceBox(dev, layout);
        target = new THREE.Vector3(b.center[0], b.center[1] + 0.03, 0.04);
      } else {
        target = new THREE.Vector3(0, layout.rowY(0) + 0.04, 0.04);
      }
      to = target.clone().add(new THREE.Vector3(0.04, 0.11, 0.2));
    } else if (req.kind === 'side') {
      to = new THREE.Vector3(fitDist * 0.75, centerY + 0.15, fitDist * 0.62);
    }
    anim.current = {
      from: camera.position.clone(),
      to,
      tFrom: c.target.clone(),
      tTo: target,
      zFrom: (camera as THREE.OrthographicCamera).zoom ?? 1,
      zTo: zoom,
      t: 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req.nonce, ortho, layout.width, layout.height]);

  useFrame((_, dt) => {
    const a = anim.current;
    const c = controls.current;
    if (!a || !c) return;
    a.t = Math.min(1, a.t + dt / 0.65);
    const k = 1 - Math.pow(1 - a.t, 3);
    camera.position.lerpVectors(a.from, a.to, k);
    c.target.lerpVectors(a.tFrom, a.tTo, k);
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      (camera as THREE.OrthographicCamera).zoom = a.zFrom + (a.zTo - a.zFrom) * k;
      camera.updateProjectionMatrix();
    }
    c.update();
    if (a.t >= 1) anim.current = null;
  });

  return (
    <>
      {ortho ? (
        <OrthographicCamera makeDefault position={[0, -0.13, 2]} zoom={600} near={0.01} far={10} />
      ) : (
        <PerspectiveCamera makeDefault fov={FOV} position={[0.2, 0, 1.4]} near={0.005} far={30} />
      )}
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        enableRotate={!ortho}
        enabled={!dragging}
        minDistance={0.06}
        maxDistance={5}
        zoomSpeed={0.9}
        screenSpacePanning
      />
    </>
  );
}
