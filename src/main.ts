import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// 1. Scene & Camera Setup
const container = document.getElementById('canvas-container') as HTMLDivElement | null;
if (!container) throw new Error("Canvas container element missing");

const scene: THREE.Scene = new THREE.Scene();

const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 10);

const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ 
  antialias: true, 
  alpha: true,
  precision: 'highp'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// 2. Lighting Setup
const ambientLight = new THREE.AmbientLight(0x0f172a, 1.8);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0x34d399, 3.5);
keyLight.position.set(6, 8, 5);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x38bdf8, 2.2);
rimLight.position.set(-6, -4, -2);
scene.add(rimLight);

// Backlight sphere behind the wave
const glowGeo = new THREE.SphereGeometry(2, 32, 32);
const glowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
const glowMesh = new THREE.Mesh(glowGeo, glowMat);
glowMesh.position.set(0, 0, -4);
scene.add(glowMesh);

// 3. Parametric Geometry (Reduced density slightly to fix grid line shimmer)
const width = 8;
const height = 4;
//const segmentsX = 80;
const segmentsX = 100;
//const segmentsY = 40;
const segmentsY = 50;

const geometry: THREE.PlaneGeometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);

const positionAttribute = geometry.attributes.position as THREE.BufferAttribute;
const originalPositions: Float32Array = Float32Array.from(positionAttribute.array as Float32Array);

// 4. Shared-Geometry Hybrid Meshes
// A. Solid Phong Body
const solidMaterial = new THREE.MeshPhongMaterial({
  color: 0x064e3b,
  emissive: 0x022c22,
  specular: 0x6ee7b7,
  shininess: 50,
  transparent: true,
  opacity: 0.90,
  side: THREE.FrontSide, // FrontSide prevents back-face depth bleed
  polygonOffset: true,
  polygonOffsetFactor: 2,
  polygonOffsetUnits: 2
});

const solidMesh = new THREE.Mesh(geometry, solidMaterial);
scene.add(solidMesh);

// B. Wireframe Overlay (Uses SAME geometry reference)
const wireframeMaterial = new THREE.MeshBasicMaterial({
  color: 0xa7f3d0,
  wireframe: true,
  transparent: true,
  opacity: 0.25,
  side: THREE.FrontSide
});

const wireframeMesh = new THREE.Mesh(geometry, wireframeMaterial);
// Tiny Z offset + scale bump keeps wireframe cleanly on top
wireframeMesh.scale.set(1.002, 1.002, 1.002);
wireframeMesh.position.z = 0.005;
scene.add(wireframeMesh);

// 5. Scroll-jacked pinning (GSAP ScrollTrigger)
let scrollProgress = 0;

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
      scrollProgress = self.progress;
    },
  });

  ScrollTrigger.refresh();
}

// 6. Clean, Single-Loop Animation
function animate(): void {
  requestAnimationFrame(animate);

  const currentT = scrollProgress;

  const time1 = currentT * Math.PI * 2;
  const time2 = currentT * Math.PI * 3;
  const time3 = currentT * Math.PI * 1.5;

  const currentPositions = positionAttribute.array as Float32Array;

  for (let i = 0; i < currentPositions.length; i += 3) {
    const x = originalPositions[i];
    const y = originalPositions[i + 1];

    // Concentric Depth (radius = Math.sqrt(...)): Adds a water-drop pulse origin right behind your central hero text that ripples outwards as you scroll.
    const radius = Math.sqrt(x * x + y * y);
    const radialRipple = Math.sin(radius * 2.8 - time1) * 0.45;
    
    // Non-linear Cross Waves (Math.sin(x) * Math.cos(y)): Replaces rigid grid-based waves with asymmetrical fluid motion, so crests merge and separate organically.
    const directionalSwell =
      Math.sin(x * 1.2 + time1) * Math.cos(y * 1.8 + time3) * 0.4;
    
    // Logarithmic Falloff (Math.log1p): Keeps high-frequency detail crisp at the focal center while gently smoothing out edges before they hit the viewport bounds.
    const logDecay = 1 / (1 + Math.log1p(radius * 0.5));

    // Micro-texture (Math.sin(...)): Adds subtle depth-based pixelation that's especially noticeable when scrolling near the origin, creating a subtle 'video game' visual effect.
    const microTexture =
      Math.sin((x * 2.0 + y * 3.0) * 15.0 + time2) * 0.08 * logDecay;

    currentPositions[i + 2] = (radialRipple + directionalSwell + microTexture) * currentT;
  }

  // Updating the single shared attribute deforms both meshes at once
  positionAttribute.needsUpdate = true;
  geometry.computeVertexNormals();

  // Sync Rotations
  const tiltX = currentT * 0.75;
  const tiltY = currentT * 0.35;

  solidMesh.rotation.x = tiltX;
  solidMesh.rotation.y = tiltY;
  wireframeMesh.rotation.x = tiltX;
  wireframeMesh.rotation.y = tiltY;

  // Orbit key light
  keyLight.position.x = 6 + Math.sin(currentT * Math.PI) * 2;
  keyLight.position.y = 8 + Math.cos(currentT * Math.PI) * 2;

  renderer.render(scene, camera);
}

animate();

// 7. Resize Handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  ScrollTrigger.refresh();
});