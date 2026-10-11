import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ============================================================================
// 1. Scene, Camera, and High-Precision Renderer
// ============================================================================
const container = document.getElementById('canvas-container') as HTMLDivElement | null;
if (!container) throw new Error('Canvas container element missing');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x242428);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.05,
  1000
);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  precision: 'highp',
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// ============================================================================
// 2. High-End Studio Lighting Rig (Double-Sided Illumination)
// ============================================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x18181e, 0.75);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
keyLight.position.set(6, 7, 7);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xa1a1aa, 1.1);
fillLight.position.set(-6, -4, 4);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xd4d4d8, 2.2);
rimLight.position.set(0, 6, -6);
scene.add(rimLight);

// Internal Headlight following camera down the tube bore
const headlight = new THREE.PointLight(0xffffff, 2.0, 14);
headlight.position.set(0, 0, 10);
scene.add(headlight);

// ============================================================================
// 3. Parametric Geometry & Kinematic Rolling Math
// ============================================================================
// Sheet dimensions: Width = 8.0, Length/Height = 6.0
// When rolled into a cylinder, circumference C = 8.0 -> Radius R = 8.0 / (2 * PI) = ~1.2732
const SHEET_WIDTH = 8.0;
const SHEET_HEIGHT = 6.0;
const TUBE_RADIUS = SHEET_WIDTH / (Math.PI * 2); // ~1.27324
const SEGMENTS_X = 220;
const SEGMENTS_Y = 90;

const planeGeometry = new THREE.PlaneGeometry(
  SHEET_WIDTH,
  SHEET_HEIGHT,
  SEGMENTS_X,
  SEGMENTS_Y
);

const positionAttribute = planeGeometry.attributes.position as THREE.BufferAttribute;
const originalPositions = Float32Array.from(positionAttribute.array as Float32Array);

// Parent group for smooth coordinate centering and telescope gimbal rotation
const tubeGroup = new THREE.Group();
scene.add(tubeGroup);

// Sub-group containing the meshes and interior optics
const meshGroup = new THREE.Group();
tubeGroup.add(meshGroup);

// A. Solid Onyx Ceramic Material (DoubleSide allows viewing both outer shell and inner bore)
const solidMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x121216,
  roughness: 0.16,
  metalness: 0.08,
  clearcoat: 1.0,
  clearcoatRoughness: 0.08,
  reflectivity: 0.92,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: 2,
  polygonOffsetUnits: 2,
});

const solidMesh = new THREE.Mesh(planeGeometry, solidMaterial);
meshGroup.add(solidMesh);

// B. Technical Slate Hairline Wireframe Overlay
const wireframeMaterial = new THREE.MeshBasicMaterial({
  color: 0x71717a,
  wireframe: true,
  transparent: true,
  opacity: 0.24,
  side: THREE.DoubleSide,
});

const wireframeMesh = new THREE.Mesh(planeGeometry, wireframeMaterial);
wireframeMesh.scale.set(1.0015, 1.0015, 1.0015);
meshGroup.add(wireframeMesh);

// C. Interior Telescope Optical Baffles & End Bevel Rings
// Concentric metallic rib rings inside the barrel to create authentic astronomical tube reflections
const baffleGroup = new THREE.Group();
baffleGroup.position.set(SHEET_WIDTH * 0.5, 0, TUBE_RADIUS);
baffleGroup.visible = false; // Appears only after looking through the telescope
meshGroup.add(baffleGroup);

const baffleMaterial = new THREE.MeshStandardMaterial({
  color: 0x222228,
  metalness: 0.75,
  roughness: 0.35,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.0,
});

const baffleCount = 7;
for (let i = 0; i < baffleCount; i++) {
  // Tube axis is along Y before gimbal pitch
  const yPos = -SHEET_HEIGHT * 0.42 + (i / (baffleCount - 1)) * (SHEET_HEIGHT * 0.84);
  const ringGeo = new THREE.RingGeometry(TUBE_RADIUS * 0.90, TUBE_RADIUS * 0.985, 64);
  const ringMesh = new THREE.Mesh(ringGeo, baffleMaterial);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.set(0, yPos, 0);
  baffleGroup.add(ringMesh);
}

// ============================================================================
// 4. Mandelbrot GLSL Shaders (Far Aperture Lens & Fullscreen Portal)
// ============================================================================
const mandelbrotVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const mandelbrotFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform vec2 uCenter;
  uniform float uZoom;
  uniform float uAspect;
  uniform int uMaxIterations;
  uniform float uPaletteShift;
  uniform float uOpacity;
  uniform bool uIsCircular;

  void main() {
    // If mapped onto the circular lens disk, clip to unit circle
    if (uIsCircular) {
      vec2 d = (vUv - 0.5) * 2.0;
      if (dot(d, d) > 0.98) {
        // Metallic aperture bevel boundary ring
        float edge = smoothstep(0.98, 1.0, dot(d, d));
        gl_FragColor = mix(vec4(0.12, 0.12, 0.16, uOpacity), vec4(0.04, 0.04, 0.06, uOpacity), edge);
        return;
      }
    }

    // Map screen UV to complex coordinate plane
    vec2 coord = (vUv - 0.5) * vec2(uAspect, 1.0) * (3.0 / uZoom);
    vec2 c = uCenter + coord;

    // Standard high-efficiency Mandelbrot escape loop
    vec2 z = vec2(0.0);
    float n = 0.0;
    float maxIter = float(uMaxIterations);

    for (int i = 0; i < 360; i++) {
      if (float(i) >= maxIter) break;
      if (dot(z, z) > 4.0) {
        n = float(i);
        break;
      }
      z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    }

    // Smooth continuous escape time coloring
    if (n < maxIter) {
      float log_zn = log(dot(z, z)) / 2.0;
      float nu = log(log_zn / 0.69314718) / 0.69314718;
      float iter = n + 1.0 - nu;

      // Onyx Ceramic & Specular Platinum Palette
      float t = iter * 0.045 + uPaletteShift;

      vec3 cVoid = vec3(0.05, 0.05, 0.07);     // Deep obsidian void
      vec3 cSlate = vec3(0.40, 0.40, 0.45);    // Slate technical grid
      vec3 cTitanium = vec3(0.72, 0.70, 0.66); // Warm titanium sheen
      vec3 cPlatinum = vec3(0.95, 0.95, 0.98); // Crisp specular crests

      float f1 = clamp(sin(t * 2.2) * 0.5 + 0.5, 0.0, 1.0);
      float f2 = clamp(sin(t * 4.4 + 1.2) * 0.5 + 0.5, 0.0, 1.0);

      vec3 col = mix(cVoid, cSlate, f1);
      col = mix(col, cTitanium, f2 * 0.45);

      // Micro-filament platinum specular glint
      float filament = pow(clamp(sin(iter * 0.75), 0.0, 1.0), 9.0);
      col += cPlatinum * filament * 0.85;

      gl_FragColor = vec4(col, uOpacity);
    } else {
      // Inside set: deep velvet onyx cavity
      gl_FragColor = vec4(0.025, 0.025, 0.035, uOpacity);
    }
  }
`;

// Uniforms for Mandelbrot
// Seahorse Valley Triple Spiral coordinates: (-0.7436438870371587, 0.1318259042053119)
const TARGET_CENTER = new THREE.Vector2(-0.743643887037, 0.131825904205);
const START_CENTER = new THREE.Vector2(-0.65, 0.0);

const mandelbrotUniforms = {
  uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uCenter: { value: START_CENTER.clone() },
  uZoom: { value: 1.0 },
  uAspect: { value: window.innerWidth / window.innerHeight },
  uMaxIterations: { value: 120 },
  uPaletteShift: { value: 0.0 },
  uOpacity: { value: 0.0 },
  uIsCircular: { value: true },
};

// 1. Circular Aperture Disc at Far End of Telescope Barrel (Lens inside 3D world)
const lensGeometry = new THREE.CircleGeometry(TUBE_RADIUS * 0.98, 64);
const lensMaterial = new THREE.ShaderMaterial({
  vertexShader: mandelbrotVertexShader,
  fragmentShader: mandelbrotFragmentShader,
  uniforms: {
    ...mandelbrotUniforms,
    uIsCircular: { value: true },
    uOpacity: { value: 0.0 },
  },
  side: THREE.DoubleSide,
  transparent: true,
});

const lensMesh = new THREE.Mesh(lensGeometry, lensMaterial);
// Far end is at y = -SHEET_HEIGHT/2 before gimbal pitch, perfectly concentric with cylinder axis
lensMesh.rotation.x = Math.PI / 2;
lensMesh.position.set(SHEET_WIDTH * 0.5, -SHEET_HEIGHT * 0.495, TUBE_RADIUS);
lensMesh.visible = false;
meshGroup.add(lensMesh);

// 2. Fullscreen Fractal Quad for Deep Infinite Zoom Stage
const quadGeometry = new THREE.PlaneGeometry(2, 2);
const quadUniforms = {
  ...mandelbrotUniforms,
  uIsCircular: { value: false },
  uOpacity: { value: 0.0 }, // Fades in as camera reaches the lens
};

const quadMaterial = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.9999, 1.0);
    }
  `,
  fragmentShader: mandelbrotFragmentShader,
  uniforms: quadUniforms,
  depthTest: false,
  depthWrite: false,
  transparent: true,
});

const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadScene = new THREE.Scene();
const quadMesh = new THREE.Mesh(quadGeometry, quadMaterial);
quadScene.add(quadMesh);

// ============================================================================
// 5. Minimalist Hardware HUD Elements
// ============================================================================
const stageTitleEl = document.getElementById('hud-stage-title');
const progressBarEl = document.getElementById('hud-progress-bar');
const geomValEl = document.getElementById('hud-geom-val');
const trajValEl = document.getElementById('hud-traj-val');
const zoomValEl = document.getElementById('hud-zoom-val');
const audioBtnEl = document.getElementById('hud-audio-btn');
const audioLabelEl = document.getElementById('hud-audio-label');
const audioSubEl = document.getElementById('hud-audio-sub');

// ============================================================================
// 6. Interactive Web Audio Synthesizer
// ============================================================================
let audioCtx: AudioContext | null = null;
let isAudioActive = false;
let subOsc: OscillatorNode | null = null;
let humOsc: OscillatorNode | null = null;
let filterNode: BiquadFilterNode | null = null;
let masterGain: GainNode | null = null;

function initAudio(): void {
  if (audioCtx) return;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  audioCtx = new AudioContextClass();

  masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
  masterGain.connect(audioCtx.destination);

  filterNode = audioCtx.createBiquadFilter();
  filterNode.type = 'lowpass';
  filterNode.frequency.setValueAtTime(240, audioCtx.currentTime);
  filterNode.Q.setValueAtTime(4.0, audioCtx.currentTime);
  filterNode.connect(masterGain);

  // Sub drone
  subOsc = audioCtx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(55, audioCtx.currentTime);
  subOsc.connect(filterNode);
  subOsc.start();

  // Harmonic resonant drone
  humOsc = audioCtx.createOscillator();
  humOsc.type = 'triangle';
  humOsc.frequency.setValueAtTime(110, audioCtx.currentTime);
  humOsc.connect(filterNode);
  humOsc.start();
}

function toggleAudio(): void {
  if (!audioCtx) initAudio();
  if (!audioCtx || !masterGain) return;

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  isAudioActive = !isAudioActive;
  if (isAudioActive) {
    masterGain.gain.setTargetAtTime(0.24, audioCtx.currentTime, 0.15);
    if (audioBtnEl) audioBtnEl.classList.add('active');
    if (audioLabelEl) audioLabelEl.textContent = 'RESONANCE ACTIVE';
    if (audioSubEl) audioSubEl.textContent = '44.1kHz SYNTH // ON';
  } else {
    masterGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.15);
    if (audioBtnEl) audioBtnEl.classList.remove('active');
    if (audioLabelEl) audioLabelEl.textContent = 'ACOUSTIC DRONE';
    if (audioSubEl) audioSubEl.textContent = 'TAP TO SYNTHESIZE';
  }
}

if (audioBtnEl) {
  audioBtnEl.addEventListener('click', toggleAudio);
}

// Update audio resonance driven by kinematics
function updateAudio(progress: number, rollAlpha: number, zoomLevel: number): void {
  if (!audioCtx || !isAudioActive || !filterNode || !subOsc || !humOsc) return;

  const now = audioCtx.currentTime;
  // Sub frequency glides up as tube tightens
  const baseFreq = 50 + rollAlpha * 25 + Math.min(progress, 0.65) * 40;
  subOsc.frequency.setTargetAtTime(baseFreq, now, 0.08);

  // Filter sweeps open during bore traversal and fractal zoom
  const filterFreq = 180 + Math.pow(progress, 2.2) * 2800 + Math.log10(Math.max(1, zoomLevel)) * 180;
  filterNode.frequency.setTargetAtTime(Math.min(filterFreq, 6500), now, 0.08);

  // Fractal pitch harmonics
  const harmonicFreq = 110 + (Math.log10(Math.max(1, zoomLevel)) * 48);
  humOsc.frequency.setTargetAtTime(harmonicFreq, now, 0.08);
}

// ============================================================================
// 7. Mouse Parallax & Interactive Coordinate Pan
// ============================================================================
const mouse = {
  targetX: 0,
  targetY: 0,
  currentX: 0,
  currentY: 0,
};

window.addEventListener('pointermove', (e: PointerEvent) => {
  const normX = (e.clientX / window.innerWidth) * 2 - 1;
  const normY = (e.clientY / window.innerHeight) * 2 - 1;
  mouse.targetX = normX;
  mouse.targetY = normY;
});

// ============================================================================
// 8. ScrollTrigger Pinning & Momentum Interpolation
// ============================================================================
let targetScrollProgress = 0;
let currentProgress = 0;

const telescopeSection = document.querySelector('.telescope-section') as HTMLElement | null;
const stickyContainer = document.querySelector('.sticky-container') as HTMLElement | null;

if (telescopeSection && stickyContainer) {
  ScrollTrigger.create({
    trigger: telescopeSection,
    start: 'top top',
    end: 'bottom bottom',
    pin: stickyContainer,
    pinSpacing: true,
    scrub: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      targetScrollProgress = self.progress;
    },
  });

  ScrollTrigger.refresh();
}

// Helper: Smoothstep interpolation
function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

// Helper: Segment progress
function segment(val: number, start: number, end: number): number {
  return Math.max(0, Math.min(1, (val - start) / (end - start)));
}

// ============================================================================
// 9. Main Animation Loop (Four Kinematic Phases)
// ============================================================================
let paletteClock = 0;

function animate(): void {
  requestAnimationFrame(animate);

  paletteClock += 0.008;

  // Buttery lerp for scroll and pointer
  currentProgress += (targetScrollProgress - currentProgress) * 0.09;
  mouse.currentX += (mouse.targetX - mouse.currentX) * 0.06;
  mouse.currentY += (mouse.targetY - mouse.currentY) * 0.06;

  const p = currentProgress;

  // --------------------------------------------------------------------------
  // Phase 1: Rolling the Flat Rectangle from Left to Right (p: 0.00 -> 0.28)
  // --------------------------------------------------------------------------
  const rollSegment = segment(p, 0.0, 0.28);
  const rollAlpha = smoothstep(rollSegment); // 0.0 (flat) to 1.0 (complete cylinder)

  // Position of rolling crease front across X: from -W/2 to +W/2
  const xRoll = -SHEET_WIDTH * 0.5 + rollAlpha * SHEET_WIDTH;
  const currentPositions = positionAttribute.array as Float32Array;

  for (let i = 0; i < currentPositions.length; i += 3) {
    const x0 = originalPositions[i];
    const y0 = originalPositions[i + 1];

    if (x0 >= xRoll) {
      // Ahead of rolling front: remains flat
      currentPositions[i] = x0;
      currentPositions[i + 1] = y0;
      currentPositions[i + 2] = 0;
    } else {
      // Behind rolling front: rolled onto cylinder of radius TUBE_RADIUS
      const dist = xRoll - x0;
      const theta = dist / TUBE_RADIUS; // Angle wrapped

      currentPositions[i] = xRoll - TUBE_RADIUS * Math.sin(theta);
      currentPositions[i + 1] = y0;
      currentPositions[i + 2] = TUBE_RADIUS * (1 - Math.cos(theta));
    }
  }

  positionAttribute.needsUpdate = true;
  planeGeometry.computeVertexNormals();

  // Keep rolling mass centered on screen as cylinder forms
  meshGroup.position.x = - (SHEET_WIDTH * 0.5) * rollAlpha;
  meshGroup.position.z = - TUBE_RADIUS * rollAlpha;

  // --------------------------------------------------------------------------
  // Phase 2: Telescope Gimbal Orientation into Central Perspective (p: 0.28 -> 0.44)
  // --------------------------------------------------------------------------
  const gimbalSegment = segment(p, 0.28, 0.44);
  const gimbalAlpha = smoothstep(gimbalSegment);

  // Initial isometric angle at p=0
  const initRotX = 0.28;
  const initRotY = -0.32;

  // At gimbalAlpha = 1.0, tube axis (originally Y) rotates 90 deg on X to point along Z
  const targetRotX = Math.PI * 0.5;
  const targetRotY = 0.0;

  const curRotX = THREE.MathUtils.lerp(initRotX, targetRotX, gimbalAlpha);
  const curRotY = THREE.MathUtils.lerp(initRotY, targetRotY, gimbalAlpha);

  // Add subtle mouse parallax (diminishes as we enter the tube)
  const parallaxDamping = 1.0 - segment(p, 0.40, 0.55);
  tubeGroup.rotation.x = curRotX - mouse.currentY * 0.08 * parallaxDamping;
  tubeGroup.rotation.y = curRotY + mouse.currentX * 0.10 * parallaxDamping;

  // --------------------------------------------------------------------------
  // Phase 3: Bore Traversal & Ring / Fractal Appearance (p: 0.44 -> 0.65)
  // --------------------------------------------------------------------------
  // Tube length = SHEET_HEIGHT = 6.0.
  // Front circular mouth is at z = +3.0. Far lens aperture is at z = -3.0.
  // Camera moves from z = 10.0 forward to z = -2.86 (just 14cm short of the far lens!).
  const dollySegment = segment(p, 0.44, 0.65);
  const dollyAlpha = smoothstep(dollySegment);

  const startCamZ = 10.0;
  const endCamZ = - (SHEET_HEIGHT * 0.5) + 0.14; // -2.86m
  const curCamZ = THREE.MathUtils.lerp(startCamZ, endCamZ, dollyAlpha);
  camera.position.z = curCamZ;
  headlight.position.z = curCamZ;

  // Baffle Rings: appear only AFTER looking through the telescope (p >= 0.44)
  if (p < 0.44) {
    baffleGroup.visible = false;
    baffleMaterial.opacity = 0.0;
  } else {
    baffleGroup.visible = true;
    const baffleFade = smoothstep(segment(p, 0.44, 0.52));
    baffleMaterial.opacity = baffleFade * 0.85;
  }

  // Fractal Lens: starts subtle and reaches FULL 1.0 OPACITY after scrolling inside the tube
  let currentLensOpacity = 0.0;
  if (p < 0.42) {
    lensMesh.visible = false;
    currentLensOpacity = 0.0;
  } else {
    lensMesh.visible = true;
    // Ramps smoothly from 0.0 at p=0.44 to FULL 1.0 opacity by p=0.60
    currentLensOpacity = smoothstep(segment(p, 0.44, 0.60));
  }
  lensMaterial.uniforms.uOpacity.value = currentLensOpacity;

  // --------------------------------------------------------------------------
  // Phase 4: Mandelbrot Horizon & Deep Infinite Zoom (p: 0.60 -> 1.00)
  // --------------------------------------------------------------------------
  const fractalSegment = segment(p, 0.60, 1.00);
  const fractalAlpha = smoothstep(fractalSegment);

  // Fullscreen portal cross-fades seamlessly as camera reaches the end of the tube
  const quadFadeIn = smoothstep(segment(p, 0.63, 0.68));
  quadUniforms.uOpacity.value = quadFadeIn;

  // Exponential zoom into Seahorse Valley triple spiral
  // Zoom scales from 1.0x to over 65,000,000x!
  const zoomFactor = Math.exp(fractalAlpha * 17.8);
  const curCenter = new THREE.Vector2();
  curCenter.lerpVectors(START_CENTER, TARGET_CENTER, smoothstep(segment(p, 0.55, 0.88)));

  // Subtle interactive complex coordinate exploration with mouse
  if (fractalAlpha > 0.01) {
    const mousePanScale = (1.5 / zoomFactor) * 0.15;
    curCenter.x += mouse.currentX * mousePanScale;
    curCenter.y += -mouse.currentY * mousePanScale;
  }

  // Dynamic iteration depth scaling with zoom
  const currentIterations = Math.floor(100 + fractalAlpha * 220);

  // Update Mandelbrot uniforms on both lens disc and fullscreen quad
  lensMaterial.uniforms.uZoom.value = zoomFactor;
  lensMaterial.uniforms.uCenter.value.copy(curCenter);
  lensMaterial.uniforms.uMaxIterations.value = currentIterations;
  lensMaterial.uniforms.uPaletteShift.value = paletteClock;

  quadUniforms.uZoom.value = zoomFactor;
  quadUniforms.uCenter.value.copy(curCenter);
  quadUniforms.uMaxIterations.value = currentIterations;
  quadUniforms.uPaletteShift.value = paletteClock;

  // --------------------------------------------------------------------------
  // Synchronize Hardware HUD Telemetry
  // --------------------------------------------------------------------------
  if (progressBarEl) {
    progressBarEl.style.width = `${(p * 100).toFixed(1)}%`;
  }

  if (stageTitleEl) {
    if (p < 0.28) {
      stageTitleEl.textContent = '01 // PLANAR TO CYLINDER ROLL';
    } else if (p < 0.44) {
      stageTitleEl.textContent = '02 // CENTRAL TELESCOPE GIMBAL';
    } else if (p < 0.65) {
      stageTitleEl.textContent = '03 // BARREL BORE TRAVERSAL';
    } else {
      stageTitleEl.textContent = '04 // DEEP FRACTAL SINGULARITY';
    }
  }

  if (geomValEl) {
    if (p < 0.28) {
      const rolledPct = (rollAlpha * 100).toFixed(0);
      geomValEl.textContent = `ROLL FORMING: ${rolledPct}% (R=${TUBE_RADIUS.toFixed(2)}m)`;
    } else if (p < 0.44) {
      geomValEl.textContent = `CYLINDRICAL TUBE (R=${TUBE_RADIUS.toFixed(2)}m · L=6.0m)`;
    } else if (p < 0.65) {
      geomValEl.textContent = 'INTERNAL BORE OPTICS · CONCENTRIC BAFFLES';
    } else {
      geomValEl.textContent = 'MANDELBROT SET · SEAHORSE VALLEY';
    }
  }

  if (trajValEl) {
    if (p < 0.28) {
      trajValEl.textContent = `ROLL CURVATURE: \u03BA = ${(rollAlpha / TUBE_RADIUS).toFixed(2)}`;
    } else if (p < 0.44) {
      const deg = (gimbalAlpha * 90).toFixed(0);
      trajValEl.textContent = `GIMBAL PITCH: ${deg}\u00B0 CENTRAL ALIGNMENT`;
    } else if (p < 0.65) {
      const distToFar = Math.max(0.14, curCamZ - (-3.0));
      trajValEl.textContent = `BORE PROXIMITY: ${distToFar.toFixed(2)}m TO APERTURE`;
    } else {
      trajValEl.textContent = `COORDINATE: (${curCenter.x.toFixed(6)}, ${curCenter.y.toFixed(6)})`;
    }
  }

  if (zoomValEl) {
    if (p < 0.44) {
      zoomValEl.textContent = 'OPTICAL APERTURE: INACTIVE';
    } else if (p < 0.65) {
      const pct = (currentLensOpacity * 100).toFixed(0);
      zoomValEl.textContent = `FRACTAL HORIZON: ${pct}% OPACITY`;
    } else {
      let zoomStr = '';
      if (zoomFactor < 1000) {
        zoomStr = `${zoomFactor.toFixed(1)}x`;
      } else if (zoomFactor < 1e6) {
        zoomStr = `${(zoomFactor / 1e3).toFixed(1)}k\u00D7`;
      } else {
        zoomStr = `${(zoomFactor / 1e6).toFixed(2)}M\u00D7`;
      }
      zoomValEl.textContent = `SINGULARITY ZOOM: ${zoomStr} · ${currentIterations} ITER`;
    }
  }

  // Update Audio drone synthesis
  updateAudio(p, rollAlpha, zoomFactor);

  // --------------------------------------------------------------------------
  // Render Scene
  // --------------------------------------------------------------------------
  renderer.autoClear = true;
  renderer.render(scene, camera);

  // If fullscreen fractal quad is active, render it over the 3D scene
  if (quadFadeIn > 0.001) {
    renderer.autoClear = false;
    renderer.render(quadScene, quadCamera);
  }
}

animate();

// ============================================================================
// 10. Responsive Viewport Resize Handler
// ============================================================================
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;

  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  mandelbrotUniforms.uResolution.value.set(w, h);
  mandelbrotUniforms.uAspect.value = aspect;
  quadUniforms.uResolution.value.set(w, h);
  quadUniforms.uAspect.value = aspect;

  ScrollTrigger.refresh();
});
