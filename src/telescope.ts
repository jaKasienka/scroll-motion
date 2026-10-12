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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.50);
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
const headlight = new THREE.PointLight(0xffffff, 2.4, 18);
headlight.position.set(0, 0, 10);
scene.add(headlight);

// Soft internal bore glow so the tube interior is never pitch black
const boreGlow = new THREE.PointLight(0xa1a1aa, 1.2, 8);
boreGlow.position.set(0, 0, 0);
scene.add(boreGlow);

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
// Slender concentric metallic ribs inside the barrel that cling to the wall
// (Never thick discs that block the far lens aperture or create black silhouettes)
const baffleGroup = new THREE.Group();
baffleGroup.position.set(SHEET_WIDTH * 0.5, 0, TUBE_RADIUS);
baffleGroup.visible = false;
meshGroup.add(baffleGroup);

interface BaffleRingItem {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  normPos: number; // 0.0 (near far lens) to 1.0 (near front entrance)
}

const baffleRings: BaffleRingItem[] = [];
const baffleCount = 6;
for (let i = 0; i < baffleCount; i++) {
  // yPos along tube: from -SHEET_HEIGHT * 0.35 (rear) to +SHEET_HEIGHT * 0.40 (front)
  const normPos = i / (baffleCount - 1);
  const yPos = -SHEET_HEIGHT * 0.35 + normPos * (SHEET_HEIGHT * 0.75);

  // Slender precision rib (inner radius 0.955 * R, outer radius 0.998 * R)
  const ringGeo = new THREE.RingGeometry(TUBE_RADIUS * 0.955, TUBE_RADIUS * 0.998, 64);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3a3a44,
    metalness: 0.85,
    roughness: 0.30,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0,
    depthWrite: false, // Prevents depth occlusion artifacts / black halos!
  });

  const ringMesh = new THREE.Mesh(ringGeo, mat);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.set(0, yPos, 0);
  baffleGroup.add(ringMesh);
  baffleRings.push({ mesh: ringMesh, material: mat, normPos });
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
  uniform vec2 uCenterReal; // vec2(high, low) for emulated 64-bit double precision
  uniform vec2 uCenterImag; // vec2(high, low) for emulated 64-bit double precision
  uniform float uZoom;
  uniform float uAspect;
  uniform int uMaxIterations;
  uniform float uPaletteShift;
  uniform float uOpacity;
  uniform bool uIsCircular;

  // Double-single arithmetic routines for non-pixelating deep zoom
  vec2 ds_set(float a) {
    return vec2(a, 0.0);
  }

  vec2 ds_add(vec2 a, vec2 b) {
    float t1 = a.x + b.x;
    float e = t1 - a.x;
    float t2 = ((b.x - e) + (a.x - (t1 - e))) + a.y + b.y;
    float hi = t1 + t2;
    float lo = t2 - (hi - t1);
    return vec2(hi, lo);
  }

  vec2 ds_sub(vec2 a, vec2 b) {
    float t1 = a.x - b.x;
    float e = t1 - a.x;
    float t2 = ((-b.x - e) + (a.x - (t1 - e))) + a.y - b.y;
    float hi = t1 + t2;
    float lo = t2 - (hi - t1);
    return vec2(hi, lo);
  }

  vec2 ds_mul(vec2 a, vec2 b) {
    float p = a.x * b.x;
    const float split = 4097.0; // 2^12 + 1 for Dekker splitting
    float a_big = a.x * split;
    float a_hi = a_big - (a_big - a.x);
    float a_lo = a.x - a_hi;

    float b_big = b.x * split;
    float b_hi = b_big - (b_big - b.x);
    float b_lo = b.x - b_hi;

    float err = p - (a_hi * b_hi);
    err -= (a_lo * b_hi);
    err -= (a_hi * b_lo);
    err -= (a_lo * b_lo);

    err += a.x * b.y + a.y * b.x;

    float hi = p + err;
    float lo = err - (hi - p);
    return vec2(hi, lo);
  }

  vec2 ds_sqr(vec2 a) {
    float p = a.x * a.x;
    const float split = 4097.0;
    float a_big = a.x * split;
    float a_hi = a_big - (a_big - a.x);
    float a_lo = a.x - a_hi;

    float err = p - (a_hi * a_hi);
    err -= 2.0 * (a_hi * a_lo);
    err -= (a_lo * a_lo);

    err += 2.0 * (a.x * a.y);

    float hi = p + err;
    float lo = err - (hi - p);
    return vec2(hi, lo);
  }

  void main() {
    // If mapped onto the circular lens disk, clip to unit circle with precision bevel
    if (uIsCircular) {
      vec2 d = (vUv - 0.5) * 2.0;
      float r2 = dot(d, d);
      if (r2 > 1.0) {
        discard;
      }
      if (r2 > 0.94) {
        // Metallic aperture bevel boundary ring
        float edge = smoothstep(0.94, 1.0, r2);
        gl_FragColor = mix(vec4(0.20, 0.20, 0.24, uOpacity), vec4(0.04, 0.04, 0.06, uOpacity), edge);
        return;
      }
    }

    // Optical Window Aperture:
    // Looking down the telescope bore reveals the celestial fractal cosmos at optical infinity.
    // By using screen-space gl_FragCoord.xy / uResolution.xy for both the 3D lens aperture and
    // the fullscreen quad, every pixel on screen maps to the exact same complex coordinate.
    // As the camera travels down the barrel, the circular aperture expands smoothly without
    // artificially magnifying the fractal before the deep zoom begins!
    vec2 screenUv = gl_FragCoord.xy / uResolution.xy;
    vec2 coord = (screenUv - 0.5) * vec2(uAspect, 1.0) * (3.0 / uZoom);

    // Compute pixel coordinate with double-single precision
    vec2 cx = ds_add(uCenterReal, ds_set(coord.x));
    vec2 cy = ds_add(uCenterImag, ds_set(coord.y));

    // High-efficiency double-single Mandelbrot iteration loop (500 steps prevents black voids)
    vec2 zx = vec2(0.0);
    vec2 zy = vec2(0.0);
    bool escaped = false;
    float n = 0.0;
    float maxIter = float(uMaxIterations);

    for (int i = 0; i < 500; i++) {
      if (float(i) >= maxIter) break;

      vec2 x2 = ds_sqr(zx);
      vec2 y2 = ds_sqr(zy);

      if (x2.x + y2.x > 4.0) {
        n = float(i);
        escaped = true;
        break;
      }

      vec2 xy = ds_mul(zx, zy);
      zx = ds_add(ds_sub(x2, y2), cx);
      zy = ds_add(vec2(2.0 * xy.x, 2.0 * xy.y), cy);
    }

    // Smooth continuous escape time coloring
    if (escaped) {
      float magSq = zx.x * zx.x + zy.x * zy.x;
      float log_zn = log(max(magSq, 1.0)) / 2.0;
      float nu = log(max(log_zn / 0.69314718, 0.0001)) / 0.69314718;
      float iter = n + 1.0 - nu;

      // Onyx Ceramic & Specular Platinum Palette (Controlled luminescence, never blown out)
      float t = iter * 0.042 + uPaletteShift;

      vec3 cVoid = vec3(0.035, 0.035, 0.045);   // Deep obsidian cavity
      vec3 cSlate = vec3(0.32, 0.33, 0.38);    // Precision slate technical grid
      vec3 cTitanium = vec3(0.62, 0.60, 0.56); // Warm brushed titanium sheen
      vec3 cPlatinum = vec3(0.88, 0.88, 0.94); // Crisp specular glint

      float f1 = clamp(sin(t * 2.2) * 0.5 + 0.5, 0.0, 1.0);
      float f2 = clamp(sin(t * 4.4 + 1.2) * 0.5 + 0.5, 0.0, 1.0);

      vec3 col = mix(cVoid, cSlate, f1);
      col = mix(col, cTitanium, f2 * 0.40);

      // Controlled platinum specular glint on filament crests (never blown out)
      float filament = pow(clamp(sin(iter * 0.75), 0.0, 1.0), 9.0);
      col += cPlatinum * filament * 0.45;

      gl_FragColor = vec4(col, uOpacity);
    } else {
      // Inside set: velvet obsidian onyx - identical solid shade for cardioid, period-2 bulb, and all satellite bulbs
      gl_FragColor = vec4(0.02, 0.02, 0.028, uOpacity);
    }
  }
`;

// Overview Center: Centers the entire Mandelbrot set symmetrically with ample margins
const OVERVIEW_REAL = -0.75;
const OVERVIEW_IMAG = 0.0;
const OVERVIEW_ZOOM = 0.85;

// Legendary Seahorse Valley Spiral Singularity on the fractal boundary
const TARGET_REAL = -0.7436438870371587;
const TARGET_IMAG = 0.1318259042053120;
// Maximum zoom calibrated to stop before precision breakdown, mathematical noise, or pixelation
const MAX_ZOOM = 4500.0;

function splitDouble(val: number): [number, number] {
  const hi = Math.fround(val);
  const lo = Math.fround(val - hi);
  return [hi, lo];
}

const [overviewRealHi, overviewRealLo] = splitDouble(OVERVIEW_REAL);
const [overviewImagHi, overviewImagLo] = splitDouble(OVERVIEW_IMAG);

const mandelbrotUniforms = {
  uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uCenterReal: { value: new THREE.Vector2(overviewRealHi, overviewRealLo) },
  uCenterImag: { value: new THREE.Vector2(overviewImagHi, overviewImagLo) },
  uZoom: { value: OVERVIEW_ZOOM },
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
  uOpacity: { value: 0.0 },
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

// Quad mesh for fullscreen Mandelbrot stage
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
const hudLayerEl = document.querySelector('.hud-layer') as HTMLElement | null;

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
  // Sub frequency glides up as tube rolls closed
  const baseFreq = 50 + rollAlpha * 25 + Math.min(progress, 0.45) * 45;
  subOsc.frequency.setTargetAtTime(baseFreq, now, 0.08);

  // Filter sweeps open during bore traversal and deep fractal zoom
  const filterFreq = 180 + Math.pow(progress, 2.0) * 2800 + Math.log10(Math.max(1, zoomLevel)) * 220;
  filterNode.frequency.setTargetAtTime(Math.min(filterFreq, 6500), now, 0.08);

  // Fractal pitch harmonics
  const harmonicFreq = 110 + (Math.log10(Math.max(1, zoomLevel)) * 42);
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

(window as any).__telescope = {
  ScrollTrigger,
  setProgress: (p: number) => {
    const triggers = ScrollTrigger.getAll();
    if (triggers[0]) {
      triggers[0].scroll(triggers[0].start + (triggers[0].end - triggers[0].start) * p);
      triggers[0].update();
    }
  },
  getProgress: () => currentProgress,
};

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
  // Phase 1: Rolling the Flat Rectangle from Left to Right (p: 0.00 -> 0.16)
  // --------------------------------------------------------------------------
  const rollSegment = segment(p, 0.00, 0.16);
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
  // Phase 2: Telescope Gimbal Orientation into Central Perspective (p: 0.16 -> 0.28)
  // --------------------------------------------------------------------------
  const gimbalSegment = segment(p, 0.16, 0.28);
  const gimbalAlpha = smoothstep(gimbalSegment);

  // Initial isometric angle at p=0
  const initRotX = 0.28;
  const initRotY = -0.32;

  // At gimbalAlpha = 1.0, tube axis rotates 90 deg on X to point along Z
  const targetRotX = Math.PI * 0.5;
  const targetRotY = 0.0;

  const curRotX = THREE.MathUtils.lerp(initRotX, targetRotX, gimbalAlpha);
  const curRotY = THREE.MathUtils.lerp(initRotY, targetRotY, gimbalAlpha);

  // Add subtle mouse parallax (diminishes as we enter the tube)
  const parallaxDamping = 1.0 - segment(p, 0.26, 0.38);
  tubeGroup.rotation.x = curRotX - mouse.currentY * 0.08 * parallaxDamping;
  tubeGroup.rotation.y = curRotY + mouse.currentX * 0.10 * parallaxDamping;

  // --------------------------------------------------------------------------
  // Phase 3: Bore Traversal & Ring / Fractal Appearance (p: 0.28 -> 0.44)
  // --------------------------------------------------------------------------
  // Tube length = SHEET_HEIGHT = 6.0.
  // Front mouth is at z = +3.0. Far lens aperture is at z = -3.0.
  // Camera moves from z = 10.0 forward to z = -2.89 (just 8cm from the far lens!)
  const dollySegment = segment(p, 0.28, 0.44);
  const dollyAlpha = smoothstep(dollySegment);

  const startCamZ = 10.0;
  const endCamZ = - (SHEET_HEIGHT * 0.5) + 0.11; // -2.89m
  const curCamZ = THREE.MathUtils.lerp(startCamZ, endCamZ, dollyAlpha);
  camera.position.z = curCamZ;
  headlight.position.z = curCamZ;

  // Baffle Rings: appear softly only as we enter the tube, with staggered fade from front to rear
  if (p < 0.26) {
    baffleGroup.visible = false;
    for (const ring of baffleRings) {
      ring.material.opacity = 0.0;
    }
  } else {
    baffleGroup.visible = true;
    const masterFade = smoothstep(segment(p, 0.26, 0.35));
    for (const ring of baffleRings) {
      // Front rings (normPos = 1) fade in first; rear rings (normPos = 0) fade in very gently afterwards
      const ringStagger = smoothstep(segment(p, 0.26 + (1.0 - ring.normPos) * 0.05, 0.38));
      ring.material.opacity = ringStagger * 0.65 * masterFade;
    }
  }

  // Fractal Lens on 3D aperture: ramps smoothly to full opacity during bore approach
  let currentLensOpacity = 0.0;
  if (p < 0.26) {
    lensMesh.visible = false;
    currentLensOpacity = 0.0;
  } else {
    lensMesh.visible = true;
    currentLensOpacity = smoothstep(segment(p, 0.26, 0.35));
  }
  lensMaterial.uniforms.uOpacity.value = currentLensOpacity;

  // --------------------------------------------------------------------------
  // Phase 4: Mandelbrot Horizon & Deep Infinite Zoom (p: 0.44 -> 1.00)
  // --------------------------------------------------------------------------
  // The fullscreen quad cross-fades seamlessly as the 3D lens rim passes off-screen
  const quadFadeIn = smoothstep(segment(p, 0.42, 0.46));
  quadUniforms.uOpacity.value = quadFadeIn;

  // Zoom progress begins as camera approaches the aperture disc down the bore (p = 0.32),
  // accelerating with natural inertia, then smoothly decelerating to a calm stop by p = 0.88
  // so the user settles on the pristine, high-res spiral details without ever hitting pixelation.
  const zoomT = segment(p, 0.32, 0.88);
  const zoomEased = smoothstep(zoomT);
  const zoomFactor = OVERVIEW_ZOOM * Math.pow(MAX_ZOOM / OVERVIEW_ZOOM, zoomEased);

  // Center frames Seahorse Valley early while magnification is low (p = 0.30 -> 0.46).
  // Once the telescope barrel clears at p = 0.46, the center is 100% locked onto the target!
  // From p = 0.46 onward, there is ZERO lateral translation or sideways flight:
  // it is a pure, hypnotic radial zoom expanding directly outward from the vortex center.
  const centerT = smoothstep(segment(p, 0.30, 0.46));
  let curReal = THREE.MathUtils.lerp(OVERVIEW_REAL, TARGET_REAL, centerT);
  let curImag = THREE.MathUtils.lerp(OVERVIEW_IMAG, TARGET_IMAG, centerT);

  // Interactive mouse coordinate exploration (gentle pan scaled to current zoom)
  if (zoomT > 0.01) {
    const viewSpan = 3.0 / zoomFactor;
    const panScale = viewSpan * 0.05;
    curReal += mouse.currentX * panScale;
    curImag += -mouse.currentY * panScale;
  }

  // Double-single 64-bit coordinate split
  const [crHi, crLo] = splitDouble(curReal);
  const [ciHi, ciLo] = splitDouble(curImag);

  // Dynamic iteration depth scaling: gracefully scales from 130 to 280 to keep filaments smooth and clean
  const currentIterations = Math.min(280, Math.floor(130 + Math.log10(Math.max(1, zoomFactor)) * 42));

  // Synchronize both lens disc and fullscreen quad (ensures 100% seamless transition with ZERO jump)
  lensMaterial.uniforms.uZoom.value = zoomFactor;
  lensMaterial.uniforms.uCenterReal.value.set(crHi, crLo);
  lensMaterial.uniforms.uCenterImag.value.set(ciHi, ciLo);
  lensMaterial.uniforms.uMaxIterations.value = currentIterations;
  lensMaterial.uniforms.uPaletteShift.value = paletteClock;

  quadUniforms.uZoom.value = zoomFactor;
  quadUniforms.uCenterReal.value.set(crHi, crLo);
  quadUniforms.uCenterImag.value.set(ciHi, ciLo);
  quadUniforms.uMaxIterations.value = currentIterations;
  quadUniforms.uPaletteShift.value = paletteClock;

  // --------------------------------------------------------------------------
  // Synchronize Hardware HUD Telemetry
  // --------------------------------------------------------------------------
  if (progressBarEl) {
    progressBarEl.style.width = `${(p * 100).toFixed(1)}%`;
  }

  if (stageTitleEl) {
    if (p < 0.16) {
      stageTitleEl.textContent = '01 // PLANAR TO CYLINDER ROLL';
    } else if (p < 0.28) {
      stageTitleEl.textContent = '02 // CENTRAL TELESCOPE GIMBAL';
    } else if (p < 0.44) {
      stageTitleEl.textContent = '03 // BARREL BORE TRAVERSAL';
    } else {
      stageTitleEl.textContent = '04 // DEEP FRACTAL SINGULARITY';
    }
  }

  if (geomValEl) {
    if (p < 0.16) {
      const rolledPct = (rollAlpha * 100).toFixed(0);
      geomValEl.textContent = `ROLL FORMING: ${rolledPct}% (R=${TUBE_RADIUS.toFixed(2)}m)`;
    } else if (p < 0.28) {
      geomValEl.textContent = `CYLINDRICAL TUBE (R=${TUBE_RADIUS.toFixed(2)}m · L=6.0m)`;
    } else if (p < 0.44) {
      geomValEl.textContent = 'INTERNAL BORE OPTICS · CONCENTRIC BAFFLES';
    } else {
      geomValEl.textContent = 'MANDELBROT SET · SEAHORSE VALLEY SPIRAL';
    }
  }

  if (trajValEl) {
    if (p < 0.16) {
      trajValEl.textContent = `ROLL CURVATURE: \u03BA = ${(rollAlpha / TUBE_RADIUS).toFixed(2)}`;
    } else if (p < 0.28) {
      const deg = (gimbalAlpha * 90).toFixed(0);
      trajValEl.textContent = `GIMBAL PITCH: ${deg}\u00B0 CENTRAL ALIGNMENT`;
    } else if (p < 0.44) {
      const distToFar = Math.max(0.08, curCamZ - (-3.0));
      trajValEl.textContent = `BORE PROXIMITY: ${distToFar.toFixed(2)}m TO APERTURE`;
    } else {
      trajValEl.textContent = `COORDINATE: (${curReal.toFixed(8)}, ${curImag.toFixed(8)})`;
    }
  }

  if (zoomValEl) {
    if (p < 0.28) {
      zoomValEl.textContent = 'OPTICAL APERTURE: INACTIVE';
    } else if (p < 0.44) {
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
      zoomValEl.textContent = `SINGULARITY ZOOM: ${zoomStr} · ${currentIterations} ITER (DS-48)`;
    }
  }

  // Gracefully fade out the HUD as we complete exploration and approach the editorial card
  if (hudLayerEl) {
    const hudFade = 1.0 - smoothstep(segment(p, 0.91, 0.965));
    hudLayerEl.style.opacity = hudFade.toFixed(3);
    hudLayerEl.style.pointerEvents = hudFade < 0.05 ? 'none' : 'auto';
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
