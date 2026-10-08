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

const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ 
  antialias: true, 
  alpha: true,
  precision: 'highp'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// 2. Soft, Natural 3-Point Lighting
// A. Soft Ambient Base (Prevents harsh black shadows)
const ambientLight = new THREE.AmbientLight(0x0f172a, 2.0);
scene.add(ambientLight);

// B. Key Light (Warm top-right sunlight feel)
const keyLight = new THREE.DirectionalLight(0x34d399, 3.5);
keyLight.position.set(6, 8, 5);
scene.add(keyLight);

// C. Soft Rim Light (Cool cyan backlight for depth separation)
const rimLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
rimLight.position.set(-6, -4, -2);
scene.add(rimLight);

// 3. Parametric Geometry Setup
const width = 8;
const height = 4;
const segmentsX = 100;
const segmentsY = 50;

const geometry: THREE.PlaneGeometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);

const positionAttribute = geometry.attributes.position as THREE.BufferAttribute;
const originalPositions: Float32Array = Float32Array.from(positionAttribute.array as Float32Array);

// Add a glowing backlight sphere behind the mesh to show off transmission & refraction
const glowGeo = new THREE.SphereGeometry(2, 32, 32);
const glowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 }); // Cyan backlight
const glowMesh = new THREE.Mesh(glowGeo, glowMat);
glowMesh.position.set(0, 0, -4); // Placed behind the wave plane
scene.add(glowMesh);

// 4. Hybrid Mesh Setup (Solid Surface + Wireframe Contour)
// A. Solid Smooth Surface for Realistic Shading & Specular Catching
const solidMaterial = new THREE.MeshPhongMaterial({
  color: 0x064e3b,        // Rich emerald base
  emissive: 0x022c22,     // Warm ambient glow
  specular: 0x6ee7b7,     // Bright crest highlights
  shininess: 50,          // Satiny sheen
  transparent: true,
  opacity: 0.90,
  side: THREE.DoubleSide
});

const solidMesh = new THREE.Mesh(geometry, solidMaterial);
scene.add(solidMesh);

/* const physicalMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x064e3b,             // Deep emerald
  transmission: 0.85,          // High light pass-through
  opacity: 1.0,                // Kept at 1.0 for true physical PBR reflections
  roughness: 0.1,              // High gloss
  ior: 1.4,                    // Water/Glass refraction index
  thickness: 1.5,              // Deep refraction volume
  specularIntensity: 1.0,
  specularColor: 0x34d399,
  clearcoat: 1.0,              // Crisp top sheen
  clearcoatRoughness: 0.05,
  side: THREE.DoubleSide
});

const physicalMesh = new THREE.Mesh(geometry, physicalMaterial);
scene.add(physicalMesh); */

// B. Wireframe Overlay Mesh (Follows exact same geometry deformation)
const wireframeMaterial = new THREE.MeshBasicMaterial({
  color: 0xa7f3d0,
  wireframe: true,
  transparent: true,
  opacity: 0.25,          // Soft outline contrast
  side: THREE.DoubleSide
});

const wireframeMesh = new THREE.Mesh(geometry, wireframeMaterial);
scene.add(wireframeMesh);

// Add a soft ground floor plane beneath the wave
const floorGeo = new THREE.PlaneGeometry(30, 30);
const floorMat = new THREE.ShadowMaterial({ opacity: 0.3 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -3;
floor.receiveShadow = true;
scene.add(floor);

// 5. Scroll Tracking & Lerp State
let targetT = 0;
let currentT = 0;

function getScrollProgress(): number {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  return maxScroll > 0 ? Math.min(Math.max(window.scrollY / maxScroll, 0), 1) : 0;
}

window.addEventListener('scroll', () => {
  targetT = getScrollProgress();
});

function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

// 6. Animation Loop
function animate(): void {
  requestAnimationFrame(animate);

  // Smooth scroll momentum
  currentT = lerp(currentT, targetT, 0.08);

  // A. Parametric Vertex Deformation
  const currentPositions = positionAttribute.array as Float32Array;

  for (let i = 0; i < currentPositions.length; i += 3) {
    const x = originalPositions[i];
    const y = originalPositions[i + 1];

    // Multi-harmonic sine waves for natural liquid/terrain flow
    const primaryWave = Math.sin(x * 1.5 + currentT * Math.PI * 2) * 0.7;
    const secondaryWave = Math.cos(y * 2.5 + currentT * Math.PI) * 0.35;
    const microRipple = Math.sin((x + y) * 3.0 + currentT * Math.PI * 3) * 0.15;
    
    currentPositions[i + 2] = (primaryWave + secondaryWave + microRipple) * currentT;
  }

  positionAttribute.needsUpdate = true;
  geometry.computeVertexNormals(); // Recomputes smooth lighting vectors every frame

  // B. Organic Camera & Light Movement
  const tiltX = currentT * 0.75;
  const tiltY = currentT * 0.35;

  solidMesh.rotation.x = tiltX;
  solidMesh.rotation.y = tiltY;
  wireframeMesh.rotation.x = tiltX;
  wireframeMesh.rotation.y = tiltY;
  /* physicalMesh.rotation.x = tiltX;
  physicalMesh.rotation.y = tiltY; */

  // Gentle light orbit for natural highlight shifts
  keyLight.position.x = 6 + Math.sin(currentT * Math.PI) * 2;
  keyLight.position.y = 8 + Math.cos(currentT * Math.PI) * 2;

  renderer.render(scene, camera);
}

animate();

// 7. Responsive Resize Handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});