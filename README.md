# Scroll Motion Studio

A suite of interactive, high-precision 3D WebGL and scroll-driven kinematics experiments built with **Three.js**, **GSAP ScrollTrigger**, custom **GLSL Shaders**, and **TypeScript**.

Live Demo: [scroll-motion.vercel.app](https://scroll-motion.vercel.app) *(or your deployed Vercel URL)*

---

## Interactive Experiments

### 1. Topology Morph (`/` / `index.html`)
- **Abstract Computational Topology**: High-subdivision planar ceramic sheet with real-time orthogonal sine/cosine harmonic wave deformations.
- **Dynamic Physics & Lighting**: Obsidian peak reflections, interactive click-to-pulse wave origin, audio-reactive telemetry, and natural 3D cursor parallax.

### 2. Device Relief Lab (`/lab.html`)
- **Hardware Industrial Relief**: Precision unibody aluminum/ceramic casing that seamlessly sinks into a deep acoustic recess (-2.8mm) upon scroll scrub.
- **Membrane & Acoustic Dish**: Dark grey silky sheen membrane with dynamic center-point radial ripple activation and real-time synthesized audio drone.

### 3. Cylindrical Telescope & Fractal Horizon (`/telescope.html`)
- **Phase 1 (Sheet Roll)**: Planar Euclidean sheet rolling smoothly from flat rectangle into an astronomical cylinder ($R = 0.955\text{m}$, $L = 6.0\text{m}$).
- **Phase 2 (Central Gimbal)**: 90° pitch alignment orienting the tube bore directly down the camera's Z axis.
- **Phase 3 (Bore Traversal)**: Interior traversal with slender metallic baffle rings and staggered opacity fades down to the far optical aperture.
- **Phase 4 (Deep Mandelbrot Singularity)**: Pure radial zoom into Seahorse Valley (`-0.74364389`, `0.13182590`) scaling smoothly up to $4,500\times$ magnification via emulated 48-bit double-single GLSL arithmetic with zero pixelation at 60 FPS.

---

## Tech Stack

- **3D & Math Engine**: [Three.js](https://threejs.org/) (r186)
- **Kinematic Scrollytelling**: [GSAP](https://greensock.com/gsap/) with [ScrollTrigger](https://greensock.com/scrolltrigger/)
- **Shaders**: Custom GLSL fragment and vertex shaders with double-single precision routines
- **Audio Engine**: Native Web Audio API real-time subtractive/harmonic drone synthesizer
- **Language & Bundler**: TypeScript 5.8 & Vite 8

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm / pnpm

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build
```bash
npm run build
```
Build output is generated into the `dist/` directory.

---

## Deployment

Configured for seamless deployment on [Vercel](https://vercel.com):
- Framework Preset: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`
- Clean URLs enabled via `vercel.json`
