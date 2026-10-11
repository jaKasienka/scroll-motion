import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// 1. Scene & Camera Setup
const container = document.getElementById('canvas-container') as HTMLDivElement | null;
if (!container) throw new Error('Canvas container element missing');

const scene: THREE.Scene = new THREE.Scene();
scene.background = new THREE.Color(0x242428);

const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 10);

const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({
  antialias: true,
  precision: 'highp',
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// 2. High-End Studio Lighting Rig (Neutral Onyx Aesthetic)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x18181e, 0.75);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
keyLight.position.set(6, 7, 6);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xa1a1aa, 1.1);
fillLight.position.set(-6, -4, 4);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xd4d4d8, 2.0);
rimLight.position.set(0, -6, -4);
scene.add(rimLight);

const frontSpecLight = new THREE.DirectionalLight(0xffffff, 1.0);
frontSpecLight.position.set(0, 0, 8);
scene.add(frontSpecLight);

// 3. Parametric Geometry (Restored from commit 1d9c818)
const width = 8;
const height = 4;
const segmentsX = 100;
const segmentsY = 50;

const geometry: THREE.PlaneGeometry = new THREE.PlaneGeometry(
  width,
  height,
  segmentsX,
  segmentsY
);

const positionAttribute = geometry.attributes.position as THREE.BufferAttribute;
const originalPositions: Float32Array = Float32Array.from(
  positionAttribute.array as Float32Array
);

// 4. Shared-Geometry Hybrid Meshes
// A. Deep Onyx Physical Ceramic Material
const solidMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x121216,
  roughness: 0.16,
  metalness: 0.1,
  clearcoat: 1.0,
  clearcoatRoughness: 0.08,
  reflectivity: 0.92,
  polygonOffset: true,
  polygonOffsetFactor: 2,
  polygonOffsetUnits: 2,
  side: THREE.FrontSide,
});

const solidMesh = new THREE.Mesh(geometry, solidMaterial);
scene.add(solidMesh);

// B. Technical Slate Hairline Wireframe Overlay
const wireframeMaterial = new THREE.MeshBasicMaterial({
  color: 0x71717a,
  wireframe: true,
  transparent: true,
  opacity: 0.22,
  side: THREE.FrontSide,
});

const wireframeMesh = new THREE.Mesh(geometry, wireframeMaterial);
wireframeMesh.scale.set(1.002, 1.002, 1.002);
wireframeMesh.position.z = 0.005;
scene.add(wireframeMesh);

// 5. HUD References
const stageTitleEl = document.getElementById('hud-stage-title');
const progressBarEl = document.getElementById('hud-progress-bar');
const surfaceValEl = document.getElementById('hud-surface-val');
const dispValEl = document.getElementById('hud-disp-val');

// 6. Natural 3D Mouse Parallax Tilt
const mouseParallax = {
  targetX: 0,
  targetY: 0,
  currentX: 0,
  currentY: 0,
};

window.addEventListener('pointermove', (e: PointerEvent) => {
  const normX = (e.clientX / window.innerWidth) * 2 - 1;
  const normY = (e.clientY / window.innerHeight) * 2 - 1;
  // Natural pitch: moving pointer up tilts surface up, right yaws right
  mouseParallax.targetX = normX * 0.14;
  mouseParallax.targetY = -normY * 0.10;
});

// 7. Scroll-Jacked Pinning & Smooth Target Progress
let targetProgress = 0;
let currentT = 0;

const parametricSection = document.querySelector('.parametric-section') as HTMLElement | null;
const stickyContainer = document.querySelector('.sticky-container') as HTMLElement | null;

if (parametricSection && stickyContainer) {
  ScrollTrigger.create({
    trigger: parametricSection,
    start: 'top top',
    end: 'bottom bottom',
    pin: stickyContainer,
    pinSpacing: true,
    scrub: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      targetProgress = self.progress;
    },
  });

  ScrollTrigger.refresh();
}

// 8. Render & Kinematic Loop
function animate(): void {
  requestAnimationFrame(animate);

  // Smooth interpolation for buttery kinematics
  currentT += (targetProgress - currentT) * 0.10;

  // Smooth mouse parallax lerp
  mouseParallax.currentX += (mouseParallax.targetX - mouseParallax.currentX) * 0.05;
  mouseParallax.currentY += (mouseParallax.targetY - mouseParallax.currentY) * 0.05;

  const currentPositions = positionAttribute.array as Float32Array;

  // Mathematical sine/cosine harmonic wave loop from commit 1d9c818
  for (let i = 0; i < currentPositions.length; i += 3) {
    const x = originalPositions[i];
    const y = originalPositions[i + 1];

    const primaryWave = Math.sin(x * 1.5 + currentT * Math.PI * 2) * 0.7;
    const secondaryWave = Math.cos(y * 2.5 + currentT * Math.PI) * 0.35;
    const microRipple = Math.sin((x + y) * 3 + currentT * Math.PI * 3) * 0.15;

    currentPositions[i + 2] = (primaryWave + secondaryWave + microRipple) * currentT;
  }

  // Deforms both solid and wireframe meshes simultaneously
  positionAttribute.needsUpdate = true;
  geometry.computeVertexNormals();

  // Rotational choreography with natural mouse parallax tilt (from 1d9c818: tiltX = 0.75, tiltY = 0.35)
  const tiltX = currentT * 0.75;
  const tiltY = currentT * 0.35;

  solidMesh.rotation.x = tiltX + mouseParallax.currentY;
  solidMesh.rotation.y = tiltY + mouseParallax.currentX;
  wireframeMesh.rotation.x = tiltX + mouseParallax.currentY;
  wireframeMesh.rotation.y = tiltY + mouseParallax.currentX;

  // Orbit key light (from 1d9c818)
  keyLight.position.x = 6 + Math.sin(currentT * Math.PI) * 2;
  keyLight.position.y = 8 + Math.cos(currentT * Math.PI) * 2;

  // Synchronize Hardware HUD
  if (progressBarEl) {
    progressBarEl.style.width = `${(currentT * 100).toFixed(1)}%`;
  }

  if (stageTitleEl) {
    if (currentT < 0.33) {
      stageTitleEl.textContent = '01 // 2D Harmonic Spline';
    } else if (currentT < 0.66) {
      stageTitleEl.textContent = '02 // Dual-Harmonic Swell';
    } else {
      stageTitleEl.textContent = '03 // Spatial Architecture';
    }
  }

  if (dispValEl) {
    dispValEl.textContent = `HARMONIC SWELL +${(currentT * 1.2).toFixed(1)}mm`;
  }

  if (surfaceValEl) {
    surfaceValEl.textContent =
      currentT > 0.45
        ? 'ONYX CERAMIC · COMPOUND TOPOLOGY'
        : 'ONYX CERAMIC · HYBRID MESH';
  }

  renderer.render(scene, camera);
}

animate();

// 9. Resize Handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  ScrollTrigger.refresh();
});
