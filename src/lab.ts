import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const DEVICE_W = 2.4;
const DEVICE_H = 4.8;
const DEVICE_D = 0.38;
const CORNER_R = 0.52;

const WHITE = 0xffffff;

const container = document.getElementById('lab-canvas') as HTMLDivElement | null;
if (!container) throw new Error('lab-canvas element missing');

let targetScrollProgress = 0;
let scrollProgress = 0;
let ctaInteractive = false;

const membraneDriver = { energy: 0 };
let membraneTime = 0;
let membraneVisibleAmount = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x242428);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 9);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0xffffff, 0.62);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0xffffff, 0xe4e4e7, 0.55);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1.35);
key.position.set(4, 6, 8);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.bias = -0.0002;
scene.add(key);

const fill = new THREE.DirectionalLight(0xffffff, 0.55);
fill.position.set(-5, -2, 4);
scene.add(fill);

function glossyWhite(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: WHITE,
    roughness: 0.1,
    metalness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
}

const bodyMat = glossyWhite();
const ctaMat = glossyWhite();

const DEVICE_BEVEL = Math.min(0.1, DEVICE_D * 0.26);
const CTA_BEVEL = 0.055;
const CTA_W = DEVICE_W * 0.74;
const CTA_H = 0.52;
const CTA_DEPTH = 0.16;
const CTA_Y = -DEVICE_H * 0.28;

const CAVITY_W = DEVICE_W * 0.9;
const CAVITY_H = DEVICE_H * 0.61;
const CAVITY_CENTER_Y = DEVICE_H * 0.17;
const CAVITY_R = CORNER_R * (CAVITY_W / DEVICE_W);
const CAVITY_DEPTH = 0.18;
function pillRadius(width: number, height: number): number {
  return Math.min(width, height) / 2;
}

function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  return shape;
}

function roundedRectHolePath(
  width: number,
  height: number,
  radius: number,
  offsetX: number,
  offsetY: number
): THREE.Path {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  const path = new THREE.Path();
  path.moveTo(offsetX - w + r, offsetY - h);
  path.lineTo(offsetX + w - r, offsetY - h);
  path.quadraticCurveTo(offsetX + w, offsetY - h, offsetX + w, offsetY - h + r);
  path.lineTo(offsetX + w, offsetY + h - r);
  path.quadraticCurveTo(offsetX + w, offsetY + h, offsetX + w - r, offsetY + h);
  path.lineTo(offsetX - w + r, offsetY + h);
  path.quadraticCurveTo(offsetX - w, offsetY + h, offsetX - w, offsetY + h - r);
  path.lineTo(offsetX - w, offsetY - h + r);
  path.quadraticCurveTo(offsetX - w, offsetY - h, offsetX - w + r, offsetY - h);
  return path;
}

function extrudeShape(
  shape: THREE.Shape,
  depth: number,
  material: THREE.Material,
  bevel = DEVICE_BEVEL
): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 8,
    curveSegments: 32,
  });
  geo.center();
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  return mesh;
}

function extrude(
  width: number,
  height: number,
  radius: number,
  depth: number,
  material: THREE.Material,
  bevel = DEVICE_BEVEL
): THREE.Mesh {
  return extrudeShape(roundedRectShape(width, height, radius), depth, material, bevel);
}

function createDeviceFrame(): THREE.Mesh {
  const shell = roundedRectShape(DEVICE_W, DEVICE_H, CORNER_R);
  shell.holes.push(
    roundedRectHolePath(
      CAVITY_W,
      CAVITY_H,
      CAVITY_R,
      0,
      CAVITY_CENTER_Y
    )
  );
  return extrudeShape(shell, DEVICE_D, bodyMat.clone());
}

const deviceRoot = new THREE.Group();
scene.add(deviceRoot);

const pointMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.06, 24, 24),
  bodyMat.clone()
);
deviceRoot.add(pointMesh);

const LINE_DIAMETER = 0.07;
const lineMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(LINE_DIAMETER / 2, LINE_DIAMETER / 2, 1, 32),
  bodyMat.clone()
);
deviceRoot.add(lineMesh);

const bodySolid = extrude(DEVICE_W, DEVICE_H, CORNER_R, DEVICE_D, bodyMat);
bodySolid.receiveShadow = true;
deviceRoot.add(bodySolid);

const bodyFrame = createDeviceFrame();
bodyFrame.receiveShadow = true;
bodyFrame.visible = false;
deviceRoot.add(bodyFrame);

const pocketGroup = new THREE.Group();
deviceRoot.add(pocketGroup);

const pocketBack = extrude(
  CAVITY_W * 1.02,
  CAVITY_H * 1.02,
  CAVITY_R * 1.02,
  0.04,
  glossyWhite(),
  CTA_BEVEL
);
pocketGroup.add(pocketBack);

const membraneGroup = new THREE.Group();
deviceRoot.add(membraneGroup);

const MEMBRANE_W = CAVITY_W * 0.98;
const MEMBRANE_H = CAVITY_H * 0.98;
const membraneGeo = new THREE.PlaneGeometry(MEMBRANE_W, MEMBRANE_H, 96, 96);
const membranePositions = membraneGeo.attributes.position as THREE.BufferAttribute;
const membraneOrigins = Float32Array.from(membranePositions.array as Float32Array);
const membraneMat = glossyWhite();
const membraneMesh = new THREE.Mesh(membraneGeo, membraneMat);
membraneGroup.add(membraneMesh);

function membraneEnvelope(x: number, y: number): number {
  const hw = MEMBRANE_W * 0.5;
  const hh = MEMBRANE_H * 0.5;
  const cornerR = CORNER_R * (MEMBRANE_W / DEVICE_W);
  const qx = Math.abs(x) - hw + cornerR;
  const qy = Math.abs(y) - hh + cornerR;
  const dist =
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    cornerR;
  const fadeWidth = 0.06;
  return 1 - THREE.MathUtils.smoothstep(dist, -fadeWidth, 0);
}

function updateMembrane(): void {
  if (membraneVisibleAmount < 0.05 && membraneDriver.energy < 0.01) return;

  membraneTime += 0.016;
  const amp = membraneDriver.energy * membraneVisibleAmount * 0.09;
  const arr = membranePositions.array as Float32Array;
  const waveFront = membraneTime * 17.5;

  for (let i = 0; i < arr.length; i += 3) {
    const x = membraneOrigins[i];
    const y = membraneOrigins[i + 1];
    const r = Math.sqrt(x * x + y * y);
    const env = membraneEnvelope(x, y);

    const originReach = THREE.MathUtils.smoothstep(waveFront - r, -0.02, 0.38);
    const centerPin =
      Math.exp(-r * r * 220) * Math.max(0, 1 - membraneTime * 0.35) * 0.35;

    const ringA = Math.sin(r * 16 - membraneTime * 22);
    const ringB = Math.sin(r * 10 - membraneTime * 14.5) * 0.55;
    const ringC = Math.sin(r * 6.5 - membraneTime * 9) * 0.32;
    const radialWave = (ringA + ringB + ringC) * originReach + centerPin;

    arr[i + 2] = radialWave * amp * env;
  }

  membranePositions.needsUpdate = true;
  membraneGeo.computeVertexNormals();
}

const MEMBRANE_PULSE_DURATION = 3.2;

let audioContext: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
const activeSoundStops: Array<() => void> = [];

function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
  if (!noiseBuffer && audioContext) {
    const seconds = 4;
    const sampleRate = audioContext.sampleRate;
    const length = Math.floor(sampleRate * seconds);
    noiseBuffer = audioContext.createBuffer(1, length, sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.98 + white * 0.02;
      data[i] = last * 3.5;
    }
  }
  return audioContext;
}

function stopMembraneSound(): void {
  while (activeSoundStops.length > 0) {
    activeSoundStops.pop()?.();
  }
}

function playMembraneSound(duration = MEMBRANE_PULSE_DURATION): void {
  const ctx = ensureAudioContext();
  if (!ctx || !noiseBuffer) return;

  stopMembraneSound();

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.42, now + 0.05);
  master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  master.connect(ctx.destination);

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;

  const bodyFilter = ctx.createBiquadFilter();
  bodyFilter.type = 'bandpass';
  bodyFilter.frequency.setValueAtTime(220, now);
  bodyFilter.frequency.exponentialRampToValueAtTime(110, now + duration);
  bodyFilter.Q.value = 1.1;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.55;
  noise.connect(bodyFilter);
  bodyFilter.connect(noiseGain);
  noiseGain.connect(master);

  const thump = ctx.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(96, now);
  thump.frequency.exponentialRampToValueAtTime(52, now + duration * 0.75);

  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.0001, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  thump.connect(thumpGain);
  thumpGain.connect(master);

  const partial = ctx.createOscillator();
  partial.type = 'triangle';
  partial.frequency.setValueAtTime(180, now);
  partial.frequency.linearRampToValueAtTime(130, now + duration);

  const partialGain = ctx.createGain();
  partialGain.gain.setValueAtTime(0.0001, now);
  partialGain.gain.exponentialRampToValueAtTime(0.08, now + 0.08);
  partialGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  partial.connect(partialGain);
  partialGain.connect(master);

  const stopAt = now + duration + 0.05;
  noise.start(now);
  thump.start(now);
  partial.start(now);
  noise.stop(stopAt);
  thump.stop(stopAt);
  partial.stop(stopAt);

  activeSoundStops.push(() => {
    try {
      noise.stop();
      thump.stop();
      partial.stop();
    } catch {
      /* already stopped */
    }
    master.disconnect();
    noise.disconnect();
    bodyFilter.disconnect();
    noiseGain.disconnect();
    thump.disconnect();
    thumpGain.disconnect();
    partial.disconnect();
    partialGain.disconnect();
  });
}

function triggerMembranePulse(): void {
  gsap.killTweensOf(membraneDriver);
  membraneTime = 0;
  membraneDriver.energy = 1;
  playMembraneSound(MEMBRANE_PULSE_DURATION);
  gsap.to(membraneDriver, {
    energy: 0,
    duration: MEMBRANE_PULSE_DURATION,
    ease: 'power2.out',
    onComplete: () => {
      stopMembraneSound();
    },
  });
}

const ctaGroup = new THREE.Group();
ctaGroup.position.set(0, CTA_Y, DEVICE_D / 2);
deviceRoot.add(ctaGroup);

const ctaShadow = extrude(
  CTA_W * 1.06,
  CTA_H * 1.08,
  pillRadius(CTA_W * 1.06, CTA_H * 1.08),
  0.012,
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24 }),
  CTA_BEVEL
);
ctaShadow.position.z = -0.01;
ctaGroup.add(ctaShadow);

const ctaMesh = extrude(CTA_W, CTA_H, pillRadius(CTA_W, CTA_H), CTA_DEPTH, ctaMat, CTA_BEVEL);
ctaMesh.castShadow = true;
ctaMesh.userData.isCta = true;
ctaGroup.add(ctaMesh);

function segment(p: number, start: number, end: number): number {
  if (p <= start) return 0;
  if (p >= end) return 1;
  return (p - start) / (end - start);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function applyScrollState(p: number): void {
  const pointPhase = easeInOut(segment(p, 0, 0.1));
  const linePhase = easeInOut(segment(p, 0.08, 0.22));
  const facePhase = easeInOut(segment(p, 0.2, 0.38));
  const depthPhase = easeInOut(segment(p, 0.36, 0.58));
  const ctaPhase = easeInOut(segment(p, 0.6, 0.94));

  const lineHeight = THREE.MathUtils.lerp(0.05, DEVICE_H, linePhase);
  const faceW = THREE.MathUtils.lerp(LINE_DIAMETER, DEVICE_W, facePhase);
  const depth = THREE.MathUtils.lerp(0.012, DEVICE_D, depthPhase);
  const bodyScale = new THREE.Vector3(faceW / DEVICE_W, 1, depth / DEVICE_D);

  pointMesh.visible = pointPhase > 0.02 && linePhase < 0.2;
  pointMesh.scale.setScalar(pointPhase);

  const lineWidthMatch = faceW / LINE_DIAMETER;
  lineMesh.visible = linePhase > 0.02 && facePhase < 0.14;
  lineMesh.scale.set(lineWidthMatch, lineHeight, lineWidthMatch);

  const frontZ = (DEVICE_D / 2) * (depth / DEVICE_D);
  const ctaOut = ctaPhase ** 1.4;
  const cutThrough = ctaOut;

  const showCut = cutThrough > 0.001;
  bodySolid.visible = facePhase > 0 && !showCut;
  bodySolid.scale.copy(bodyScale);
  bodyFrame.visible = facePhase > 0 && showCut;
  bodyFrame.scale.copy(bodyScale);

  pocketGroup.visible = showCut;
  const recessDepth = CAVITY_DEPTH * cutThrough;
  pocketBack.position.set(0, CAVITY_CENTER_Y, frontZ - CAVITY_DEPTH - 0.06);

  membraneVisibleAmount = cutThrough;
  membraneGroup.visible = showCut;
  membraneGroup.position.set(0, CAVITY_CENTER_Y, frontZ - recessDepth);

  ctaGroup.position.z = frontZ;
  ctaGroup.visible = ctaPhase > 0.02;

  ctaMesh.scale.z = Math.max(0.001, ctaOut);
  ctaMesh.position.z = THREE.MathUtils.lerp(-CTA_DEPTH * 0.85, CTA_DEPTH * 0.35, ctaOut);

  const shadowMat = ctaShadow.material as THREE.MeshBasicMaterial;
  shadowMat.opacity = 0.24 * ctaOut;
  ctaShadow.scale.set(1, 1, Math.max(0.001, ctaOut));

  ctaInteractive = ctaOut > 0.92 && p > 0.82;

  const camBlend = easeInOut(segment(p, 0.32, 0.62));
  const holdAngle = 0.42;
  const angleX = THREE.MathUtils.lerp(0, holdAngle, camBlend);
  const angleY = THREE.MathUtils.lerp(0, 0.55, camBlend);
  const radius = 9.2;

  camera.position.set(
    radius * Math.sin(angleY) * Math.cos(angleX),
    radius * Math.sin(angleX) * 0.85,
    radius * Math.cos(angleY) * Math.cos(angleX)
  );
  camera.lookAt(0, 0, 0);
}

const deviceSection = document.querySelector('.device-section') as HTMLElement | null;
const devicePin = document.querySelector('.device-pin') as HTMLElement | null;

if (deviceSection && devicePin) {
  ScrollTrigger.create({
    trigger: deviceSection,
    start: 'top top',
    end: 'bottom bottom',
    pin: devicePin,
    pinSpacing: true,
    scrub: 2.2,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      targetScrollProgress = self.progress;
    },
  });
  ScrollTrigger.refresh();
}

const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

function onPointerDown(event: PointerEvent): void {
  if (!ctaInteractive) return;
  ensureAudioContext();

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(ctaMesh, false);
  if (hits.length > 0) {
    triggerMembranePulse();
    gsap.fromTo(
      ctaMesh.position,
      { z: ctaMesh.position.z },
      { z: ctaMesh.position.z + 0.05, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' }
    );
  }
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);

renderer.domElement.addEventListener('pointermove', (event: PointerEvent) => {
  if (!ctaInteractive) {
    renderer.domElement.style.cursor = 'default';
    return;
  }
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(ctaMesh, false);
  renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'default';
});

function animate(): void {
  requestAnimationFrame(animate);

  scrollProgress += (targetScrollProgress - scrollProgress) * 0.07;
  applyScrollState(scrollProgress);
  updateMembrane();

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  ScrollTrigger.refresh();
});
