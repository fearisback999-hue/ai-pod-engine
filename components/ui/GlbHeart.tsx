"use client";

import { Suspense, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment, Center } from "@react-three/drei";
import * as THREE from "three";

function HeartModel({ url, color }: { url: string; color: string }) {
  const { scene } = useGLTF(url, true);
  const groupRef = useRef<THREE.Group>(null);

  // The compressed model lost its textures (renders white), so paint it
  // with an anatomical red, slightly glossy so it catches the lighting.
  const tinted = useMemo(() => {
    const clone = scene.clone(true);
    const base = new THREE.Color(color);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: base,
          roughness: 0.4,
          metalness: 0.1,
        });
      }
    });
    return clone;
  }, [scene, color]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    // Heartbeat pulse (lub-dub at ~70 BPM = 0.85s cycle) — no rotation
    const cycle = (t % 0.85) / 0.85;
    let scale = 1;
    if (cycle < 0.15) scale = 1 + 0.06 * (cycle / 0.15);
    else if (cycle < 0.3) scale = 1.06 - 0.06 * ((cycle - 0.15) / 0.15);
    else if (cycle < 0.45) scale = 1 + 0.09 * ((cycle - 0.3) / 0.15);
    else if (cycle < 0.7) scale = 1.09 - 0.09 * ((cycle - 0.45) / 0.25);
    groupRef.current.scale.setScalar(scale);
  });

  return (
    <Center>
      <group ref={groupRef}>
        <primitive object={tinted} />
      </group>
    </Center>
  );
}

interface GlbHeartProps {
  url?: string;
  className?: string;
  color?: string;
}

export function GlbHeart({
  url = "/models/hero-heart.glb",
  className,
  color = "#c4243a",
}: GlbHeartProps) {
  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.3} color="#fff5e6" />
        <directionalLight position={[-5, 3, -2]} intensity={0.7} color="#ff6b8a" />
        <pointLight position={[0, -3, 3]} intensity={0.6} color="#C9A84C" />

        <Suspense fallback={null}>
          <HeartModel url={url} color={color} />
          <Environment preset="studio" />
        </Suspense>

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={(Math.PI * 2) / 3}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload("/models/hero-heart.glb", true);
