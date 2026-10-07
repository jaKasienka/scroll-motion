import * as THREE from 'three';

// 1. Scene Setup
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

// WebGLRenderer with high precision for accurate vertex calculations
const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ 
  antialias: true, 
  alpha: true,
  precision: 'highp'
});

// Set up the renderer and attach it to the container
//renderer.setSize(window.innerWidth, window.innerHeight);
//renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

// Force crisp rendering on canvas styling
renderer.domElement.style.width = '100vw';
renderer.domElement.style.height = '100vh';

// 2. Parametric Plane Geometry
const width = 8;
const height = 4;
const segmentsX = 140;
const segmentsY = 70;

const geometry: THREE.PlaneGeometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);

// Store original 2D vertex positions for interpolation
const positionAttribute = geometry.attributes.position as THREE.BufferAttribute;
const originalPositions: Float32Array = Float32Array.from(positionAttribute.array as Float32Array);

const material: THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({
  color: 0x10b981, // Emerald Green accent
  wireframe: true,
  transparent: true,
  opacity: 0.85
});

const mesh: THREE.Mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

// 3. Scroll Tracking & Lerp State
let targetT = 0;   // Raw scroll progress [0, 1]
let currentT = 0;  // Lerped progress for smooth momentum

function getScrollProgress(): number {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  return maxScroll > 0 ? Math.min(Math.max(window.scrollY / maxScroll, 0), 1) : 0;
}

window.addEventListener('scroll', () => {
  targetT = getScrollProgress();
});

// Linear Interpolation helper
function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

// 4. Animation Loop
function animate(): void {
  requestAnimationFrame(animate);

  // Smooth trailing momentum on scroll
  currentT = lerp(currentT, targetT, 0.08);

  // A. Parametric Vertex Deformation
  const currentPositions = positionAttribute.array as Float32Array;

  for (let i = 0; i < currentPositions.length; i += 3) {
    const x = originalPositions[i];
    const y = originalPositions[i + 1];

    // Compute 3D depth wave using sin/cos harmonics driven by currentT
    const wave1 = Math.sin(x * 2 + currentT * Math.PI * 2) * 0.8;
    const wave2 = Math.cos(y * 3 + currentT * Math.PI) * 0.4;
    
    // Morph z-coordinate from 0 (flat 2D) to spatial 3D wave
    currentPositions[i + 2] = (wave1 + wave2) * currentT;
  }

  positionAttribute.needsUpdate = true;

  // B. Camera Perspective Transition
  mesh.rotation.x = currentT * 0.8; // Tilt plane forward
  mesh.rotation.y = currentT * 0.4; // Rotate slightly on Y

  renderer.render(scene, camera);
}

animate();

// 5. Responsive Resize Handler
// Handle window resize to maintain proper aspect ratio and pixel density
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Re-sync pixel ratio on display changes
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});