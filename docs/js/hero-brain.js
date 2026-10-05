/**
 * NeuroDataHub hero brain
 *
 * The slowly rotating glass brain from the NeuroAI paper template (Brainnetome
 * atlas, 246 regions), redrawn with plain WebGL so it costs about as much
 * bandwidth as an image. One region at a time lights up and a line runs from it
 * to a card describing a finding made with NeuroDataHub datasets.
 *
 * Assets (docs/assets/hero/):
 *   brain.bin.gz       ~145 KB mesh, built by scripts/build_hero_brain.py
 *   findings.json      the findings shown on the cards - edit this to add one
 *   brain-poster.webp  still image used when WebGL is unavailable
 *
 * Mounted from app.js: HeroBrain.mount(element, { onDatasetClick(name) {} }).
 * Nothing is downloaded on phones (the hero image is hidden there) and the
 * mesh is fetched only after the rest of the page has loaded.
 */
(function () {
    'use strict';

    const ASSETS = 'docs/assets/hero/';
    const MOBILE_QUERY = '(max-width: 768px)';
    const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

    // Timeline of one finding, in ms: the region lights up, the callout line
    // draws out to the card, the card holds, then everything fades out.
    const STEP = 7500;
    const STEP_REDUCED = 10000;
    const FADE = 700;
    const LINE_START = 350;
    const LINE_DRAW = 650;
    const CARD_IN = 650;
    const CARD_OUT = 650;

    const SPIN = (2 * Math.PI) / 48;   // one turn every 48 s
    const SPIN_HOLD = SPIN * 0.25;     // slower while a finding is on screen
    const ELEVATION = 0.22;            // camera looks slightly down (radians)
    const FOV = (28 * Math.PI) / 180;
    const POSTER_YAW = 0.55;
    const FOCUS_ZOOM = 0.06;           // camera moves 6% closer while a finding holds...
    const FOCUS_SHIFT = 0.2;           // ...and aims 20% of the way toward the region
    const PULSE_PERIOD = 1600;         // ms for a light pulse to run down the callout line

    // Glass: slate at the bottom shading to a soft indigo at the top.
    const GLASS_LOW = [0.42, 0.5, 0.62];
    const GLASS_HIGH = [0.46, 0.53, 0.74];
    const GLASS_ALPHA = 0.016;
    const GLASS_RIM = 0.2;
    // Bloom around the lit region: [inflation in mm, strength], innermost first.
    const HALO_SHELLS = [[1.2, 0.3], [2.8, 0.14], [5, 0.06]];

    // ── Mesh decoding (format documented in scripts/build_hero_brain.py) ──────

    async function fetchMesh(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
        let bytes = new Uint8Array(await response.arrayBuffer());
        // The file is gzipped; a server may already have decompressed it.
        if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
            bytes = new Uint8Array(await new Response(stream).arrayBuffer());
        }
        return decodeMesh(bytes);
    }

    function decodeMesh(bytes) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
        if (magic !== 'NDHB' || view.getUint16(4, true) !== 1) throw new Error('Unsupported brain mesh');
        const regionCount = view.getUint16(6, true);
        const vertexCount = view.getUint32(8, true);
        const triangleCount = view.getUint32(12, true);
        const origin = [view.getFloat32(16, true), view.getFloat32(20, true), view.getFloat32(24, true)];
        const step = view.getFloat32(28, true);

        const regions = [];
        for (let i = 0; i < regionCount; i++) {
            const at = 32 + i * 16;
            regions.push({
                vertexStart: view.getUint32(at, true),
                vertexCount: view.getUint32(at + 4, true),
                triangleStart: view.getUint32(at + 8, true),
                triangleCount: view.getUint32(at + 12, true)
            });
        }

        let offset = 32 + regionCount * 16;
        const positions = new Float32Array(vertexCount * 3);
        for (let axis = 0; axis < 3; axis++) {
            const lo = offset + 2 * axis * vertexCount;
            const hi = lo + vertexCount;
            let q = 0;
            for (let i = 0; i < vertexCount; i++) {
                const z = bytes[lo + i] | (bytes[hi + i] << 8);
                q += (z >>> 1) ^ -(z & 1);
                positions[i * 3 + axis] = origin[axis] + q * step;
            }
        }
        offset += 6 * vertexCount;

        const indexCount = triangleCount * 3;
        const indices = new Uint16Array(indexCount);
        let newest = 0;
        for (let i = 0; i < indexCount; i++) {
            const code = bytes[offset + i] | (bytes[offset + indexCount + i] << 8);
            indices[i] = code === 0 ? newest++ : newest - code;
        }

        // Centre the brain on the origin; remember its extent for framing.
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < positions.length; i++) {
            const axis = i % 3;
            if (positions[i] < min[axis]) min[axis] = positions[i];
            if (positions[i] > max[axis]) max[axis] = positions[i];
        }
        const centre = [0, 1, 2].map((axis) => (min[axis] + max[axis]) / 2);
        let radiusXY = 0;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] -= centre[0];
            positions[i + 1] -= centre[1];
            positions[i + 2] -= centre[2];
            radiusXY = Math.max(radiusXY, Math.hypot(positions[i], positions[i + 1]));
        }
        const halfHeight = (max[2] - min[2]) / 2;

        return { positions, indices, regions, normals: computeNormals(positions, indices), radiusXY, halfHeight };
    }

    function computeNormals(positions, indices) {
        const normals = new Float32Array(positions.length);
        for (let i = 0; i < indices.length; i += 3) {
            const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
            const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
            const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
            const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            for (const v of [a, b, c]) {
                normals[v] += nx;
                normals[v + 1] += ny;
                normals[v + 2] += nz;
            }
        }
        for (let i = 0; i < normals.length; i += 3) {
            const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
            normals[i] /= length;
            normals[i + 1] /= length;
            normals[i + 2] /= length;
        }
        return normals;
    }

    // ── Small 4x4 matrix helpers (column-major, as WebGL expects) ─────────────

    function perspective(fovY, aspect, near, far) {
        const f = 1 / Math.tan(fovY / 2);
        const nf = 1 / (near - far);
        return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
    }

    function lookAt(eye, target, up) {
        const normalize = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
        const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const z = normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
        const x = normalize(cross(up, z));
        const y = cross(z, x);
        return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
    }

    function multiply(a, b) {
        const out = new Float32Array(16);
        for (let col = 0; col < 4; col++) {
            for (let row = 0; row < 4; row++) {
                out[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] +
                    a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
            }
        }
        return out;
    }

    function rotationZ(angle) {
        const c = Math.cos(angle), s = Math.sin(angle);
        return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    }

    function project(m, p) {
        const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
        const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
        const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
        return [x / w, y / w];
    }

    // ── WebGL renderer ─────────────────────────────────────────────────────────

    // Shared by both programs. For the glass it also works out, per vertex, the
    // slate-to-indigo tint and the depth/dim factor (both vary smoothly, so the
    // fragment shader stays as cheap as possible on the heavily layered glass).
    const VERTEX_SHADER = `
        attribute vec3 aPosition;
        attribute vec3 aNormal;
        attribute float aActive;
        uniform mat4 uModel;
        uniform mat4 uViewProj;
        uniform float uInflate;
        uniform vec3 uEyePos;
        uniform vec2 uDepth;
        uniform float uHalfHeight;
        uniform float uDim;
        uniform vec3 uGlassLow;
        uniform vec3 uGlassHigh;
        varying vec3 vNormal;
        varying vec3 vWorld;
        varying float vActive;
        varying vec4 vTint;
        void main() {
            vec4 world = uModel * vec4(aPosition + aNormal * uInflate, 1.0);
            vNormal = (uModel * vec4(aNormal, 0.0)).xyz;
            vWorld = world.xyz;
            vActive = aActive;
            float near = clamp((uDepth.y - length(uEyePos - world.xyz)) / (uDepth.y - uDepth.x), 0.0, 1.0);
            vTint = vec4(mix(uGlassLow, uGlassHigh, smoothstep(-uHalfHeight, uHalfHeight, world.z)),
                         mix(0.45, 1.0, near) * (1.0 - 0.3 * uDim));
            gl_Position = uViewProj * world;
        }`;

    // Translucent shell: faint everywhere, stronger where surfaces turn away
    // (fresnel rim), fainter on the far side of the brain, tinted slate to indigo
    // from bottom to top, and dimmed while a region is lit so the region pops.
    const GLASS_SHADER = `
        precision mediump float;
        uniform vec3 uEye;
        uniform float uAlpha;
        uniform float uRim;
        varying vec3 vNormal;
        varying vec3 vWorld;
        varying float vActive;
        varying vec4 vTint;
        void main() {
            float facing = abs(dot(normalize(vNormal), normalize(uEye - vWorld)));
            float a = (uAlpha + uRim * pow(1.0 - facing, 3.0)) * vTint.a * (1.0 - vActive);
            gl_FragColor = vec4(vTint.rgb * a, a);
        }`;

    // Highlighted region: mostly emissive with soft wrap lighting (so the
    // simplified mesh shows no facets), warm-white fresnel edges, slightly
    // translucent so it sits inside the glass. With uHalo > 0 it draws one of
    // the bloom shells instead.
    const REGION_SHADER = `
        precision mediump float;
        uniform vec3 uEye;
        uniform vec3 uColor;
        uniform vec3 uLight;
        uniform float uGlow;
        uniform float uHalo;
        varying vec3 vNormal;
        varying vec3 vWorld;
        varying float vActive;
        void main() {
            vec3 n = normalize(vNormal);
            float rim = 1.0 - abs(dot(n, normalize(uEye - vWorld)));
            if (uHalo > 0.0) {
                float h = pow(rim, 1.6) * uHalo * vActive * (0.7 + 0.3 * uGlow);
                gl_FragColor = vec4(uColor * h, h);
                return;
            }
            float wrap = clamp((dot(n, uLight) + 0.6) / 1.6, 0.0, 1.0);
            vec3 color = uColor * (0.8 + 0.24 * wrap);
            color = mix(color, vec3(1.0, 0.97, 0.92), pow(rim, 2.2) * 0.55);
            float a = 0.92 * vActive;
            gl_FragColor = vec4(color * a, a);
        }`;

    function createRenderer(canvas, mesh) {
        const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power' });
        if (!gl) return null;

        const compile = (type, source) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
            return shader;
        };
        const link = (fragmentSource) => {
            const program = gl.createProgram();
            gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
            gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
            ['aPosition', 'aNormal', 'aActive'].forEach((name, i) => gl.bindAttribLocation(program, i, name));
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
            const uniforms = {};
            for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
                const name = gl.getActiveUniform(program, i).name;
                uniforms[name] = gl.getUniformLocation(program, name);
            }
            return { program, uniforms };
        };
        const glass = link(GLASS_SHADER);
        const region = link(REGION_SHADER);

        const attribute = (index, data, size, type, normalized, usage) => {
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
            gl.enableVertexAttribArray(index);
            gl.vertexAttribPointer(index, size, type, normalized, 0, 0);
            return buffer;
        };
        attribute(0, mesh.positions, 3, gl.FLOAT, false);
        attribute(1, mesh.normals, 3, gl.FLOAT, false);
        const activeData = new Uint8Array(mesh.positions.length / 3);
        const activeBuffer = attribute(2, activeData, 1, gl.UNSIGNED_BYTE, true, gl.DYNAMIC_DRAW);
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

        let litRegions = [];
        let litDraws = [];
        let litKey = '';

        // Fade value (0-1) for the given Brainnetome region ids; all others off.
        function setActive(ids, amount) {
            const value = Math.round(Math.max(0, Math.min(1, amount)) * 255);
            const key = `${ids.join(',')}:${value}`;
            if (key === litKey) return;
            litKey = key;
            const ranges = ids.map((id) => mesh.regions[id - 1]).filter(Boolean);
            const touched = litRegions.concat(ranges);
            if (!touched.length) return;
            litRegions.forEach((r) => activeData.fill(0, r.vertexStart, r.vertexStart + r.vertexCount));
            ranges.forEach((r) => activeData.fill(value, r.vertexStart, r.vertexStart + r.vertexCount));
            const start = Math.min(...touched.map((r) => r.vertexStart));
            const end = Math.max(...touched.map((r) => r.vertexStart + r.vertexCount));
            gl.bindBuffer(gl.ARRAY_BUFFER, activeBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, start, activeData.subarray(start, end));
            litRegions = value > 0 ? ranges : [];
            // Regions are stored in id order, so neighbouring ids (e.g. the 16
            // thalamus parts) merge into one triangle range and one draw call.
            litDraws = [];
            [...litRegions].sort((p, q) => p.triangleStart - q.triangleStart).forEach((r) => {
                const last = litDraws[litDraws.length - 1];
                if (last && last.start + last.count === r.triangleStart) last.count += r.triangleCount;
                else litDraws.push({ start: r.triangleStart, count: r.triangleCount });
            });
        }

        function drawRegions() {
            litDraws.forEach((d) => gl.drawElements(gl.TRIANGLES, d.count * 3, gl.UNSIGNED_SHORT, d.start * 6));
        }

        function render(frame) {
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

            // 1. Glass shell: every surface, both sides, no depth - order-independent.
            gl.useProgram(glass.program);
            gl.uniformMatrix4fv(glass.uniforms.uModel, false, frame.model);
            gl.uniformMatrix4fv(glass.uniforms.uViewProj, false, frame.viewProj);
            gl.uniform1f(glass.uniforms.uInflate, 0);
            gl.uniform3fv(glass.uniforms.uEye, frame.eye);
            gl.uniform3fv(glass.uniforms.uEyePos, frame.eye);
            gl.uniform3fv(glass.uniforms.uGlassLow, GLASS_LOW);
            gl.uniform3fv(glass.uniforms.uGlassHigh, GLASS_HIGH);
            gl.uniform1f(glass.uniforms.uAlpha, GLASS_ALPHA);
            gl.uniform1f(glass.uniforms.uRim, GLASS_RIM);
            gl.uniform1f(glass.uniforms.uDim, frame.dim);
            gl.uniform1f(glass.uniforms.uHalfHeight, mesh.halfHeight);
            gl.uniform2fv(glass.uniforms.uDepth, frame.depth);
            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.CULL_FACE);
            gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
            if (!litRegions.length) return;

            // 2. Highlighted region, glowing inside the glass.
            gl.useProgram(region.program);
            gl.uniformMatrix4fv(region.uniforms.uModel, false, frame.model);
            gl.uniformMatrix4fv(region.uniforms.uViewProj, false, frame.viewProj);
            gl.uniform3fv(region.uniforms.uEye, frame.eye);
            gl.uniform3fv(region.uniforms.uColor, frame.color);
            gl.uniform3fv(region.uniforms.uLight, frame.light);
            gl.uniform1f(region.uniforms.uGlow, frame.glow);
            gl.uniform1f(region.uniforms.uInflate, 0);
            gl.uniform1f(region.uniforms.uHalo, 0);
            gl.enable(gl.DEPTH_TEST);
            gl.depthMask(true);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);
            drawRegions();

            // 3. Bloom: back faces of inflated copies. They grow with the
            // activation, so the region seems to ignite outward as it lights up.
            gl.depthMask(false);
            gl.cullFace(gl.FRONT);
            HALO_SHELLS.forEach(([mm, strength]) => {
                gl.uniform1f(region.uniforms.uInflate, mm * frame.ignite);
                gl.uniform1f(region.uniforms.uHalo, strength);
                drawRegions();
            });
            gl.depthMask(true);
        }

        return { setActive, render };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

    function hexToRgb(hex) {
        const value = parseInt(String(hex || '#E4572E').replace('#', ''), 16);
        return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    function listen(query, handler) {
        const mq = window.matchMedia(query);
        if (mq.addEventListener) mq.addEventListener('change', handler);
        else mq.addListener(handler); // Safari < 14
        return mq;
    }

    function whenPageIdle(callback) {
        const idle = () => (window.requestIdleCallback
            ? window.requestIdleCallback(callback, { timeout: 1500 })
            : setTimeout(callback, 200));
        if (document.readyState === 'complete') idle();
        else window.addEventListener('load', idle, { once: true });
    }

    function webglAvailable() {
        try {
            const gl = window.WebGLRenderingContext && document.createElement('canvas').getContext('webgl');
            if (!gl) return false;
            const lose = gl.getExtension('WEBGL_lose_context');
            if (lose) lose.loseContext(); // free the probe context straight away
            return true;
        } catch (err) {
            return false;
        }
    }

    // ── The component ─────────────────────────────────────────────────────────

    function start(root, options) {
        const posterMode = new URLSearchParams(window.location.search).has('heroPoster');
        const saveData = !!(navigator.connection && navigator.connection.saveData);
        const canAnimate = !saveData && 'DecompressionStream' in window && webglAvailable();
        const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);

        root.setAttribute('role', 'region');
        root.setAttribute('aria-roledescription', 'carousel');
        root.setAttribute('aria-label', 'Discoveries from NeuroDataHub datasets');
        root.dataset.state = 'loading';
        root.innerHTML = `
            <p class="hero-brain__kicker"><span class="hero-brain__kicker-dot"></span>Discoveries from NeuroDataHub datasets</p>
            <div class="hero-brain__stage">
                <div class="hero-brain__aura" aria-hidden="true"></div>
                <div class="hero-brain__floor" aria-hidden="true"></div>
                <canvas class="hero-brain__canvas" aria-hidden="true"></canvas>
            </div>
            <svg class="hero-brain__overlay" aria-hidden="true" focusable="false">
                <defs>
                    <linearGradient id="hero-brain-line" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stop-opacity="1"></stop>
                        <stop offset="1" stop-opacity="0.35"></stop>
                    </linearGradient>
                </defs>
                <path class="hero-brain__leader" pathLength="1" stroke="url(#hero-brain-line)"></path>
                <path class="hero-brain__pulse-glow" pathLength="1"></path>
                <path class="hero-brain__pulse" pathLength="1"></path>
                <circle class="hero-brain__cap" r="3"></circle>
                <g class="hero-brain__anchor">
                    <circle class="hero-brain__ping" r="5"></circle>
                    <circle class="hero-brain__ring" r="8.5"></circle>
                    <circle class="hero-brain__dot" r="3.5"></circle>
                </g>
            </svg>
            <div class="hero-brain__cards" aria-live="off"></div>
            <div class="hero-brain__footer">
                <button type="button" class="hero-brain__toggle" aria-label="Pause animation"><i class="fas fa-pause" aria-hidden="true"></i></button>
                <div class="hero-brain__steps"></div>
                <span class="hero-brain__credit"></span>
            </div>`;
        if (posterMode) root.classList.add('hero-brain--poster');

        const stage = root.querySelector('.hero-brain__stage');
        const canvas = root.querySelector('.hero-brain__canvas');
        const leader = root.querySelector('.hero-brain__leader');
        const pulses = root.querySelectorAll('.hero-brain__pulse, .hero-brain__pulse-glow');
        const cap = root.querySelector('.hero-brain__cap');
        const gradient = root.querySelector('#hero-brain-line');
        const anchor = root.querySelector('.hero-brain__anchor');
        const cardsBox = root.querySelector('.hero-brain__cards');
        const stepsBox = root.querySelector('.hero-brain__steps');
        const toggle = root.querySelector('.hero-brain__toggle');

        let findings = [];
        let cards = [];
        let steps = [];
        let mesh = null;
        let renderer = null;
        let layout = null;
        let camera = null;

        const story = { index: 0, time: 0, shownCard: -1 };
        let yaw = POSTER_YAW;
        let spin = 0;
        let userPaused = false;
        let hoverPaused = false;
        let focusPaused = false;
        let visible = true;
        let running = false;
        let rafId = 0;
        let lastFrame = 0;
        let renderScale = Math.min(window.devicePixelRatio || 1, 2);
        let slowFrames = 0;
        let pulseClock = 0;
        const debug = { frames: 0, state: 'loading', index: 0, running: false };
        window.HeroBrain.debug = debug;

        function buildCards() {
            const total = String(findings.length).padStart(2, '0');
            findings.forEach((finding, i) => {
                const card = element('article', 'hero-brain__card');
                card.setAttribute('role', 'group');
                card.setAttribute('aria-roledescription', 'slide');
                card.setAttribute('aria-label', `${i + 1} of ${findings.length}: ${finding.region}`);
                card.style.setProperty('--hb-accent', finding.color || '#E4572E');

                const eyebrow = element('p', 'hero-brain__eyebrow');
                eyebrow.append(element('span', 'hero-brain__condition', finding.condition),
                    element('span', 'hero-brain__count', `${String(i + 1).padStart(2, '0')} / ${total}`));
                const cite = element('a', 'hero-brain__cite', finding.citation);
                if (/^https?:\/\//.test(finding.link || '')) cite.href = finding.link;
                cite.target = '_blank';
                cite.rel = 'noopener';
                cite.append(element('i', 'fas fa-arrow-up-right-from-square'));
                const data = element('p', 'hero-brain__data');
                data.append(element('span', 'hero-brain__data-label', 'Data'));
                (finding.datasets || []).forEach((name) => {
                    const chip = element('button', 'hero-brain__chip');
                    chip.type = 'button';
                    chip.title = `Open the ${name} dataset`;
                    // Same URL as the dataset grid uses, so the logo comes from the cache.
                    const logo = element('img', 'hero-brain__chip-logo');
                    logo.alt = '';
                    logo.decoding = 'async';
                    logo.addEventListener('error', () => logo.remove());
                    logo.src = `./docs/assets/images/${name}.png`;
                    chip.append(logo, document.createTextNode(name), element('i', 'fas fa-arrow-right'));
                    chip.addEventListener('click', () => options.onDatasetClick && options.onDatasetClick(name));
                    data.append(chip);
                });
                card.append(eyebrow, element('p', 'hero-brain__region', finding.region),
                    element('p', 'hero-brain__finding', finding.finding), cite, data);
                cardsBox.append(card);
                cards.push(card);

                const step = element('button', 'hero-brain__step');
                step.type = 'button';
                step.setAttribute('aria-label', `Show finding ${i + 1} of ${findings.length}: ${finding.region}`);
                step.append(element('span'));
                step.addEventListener('click', () => goTo(i));
                stepsBox.append(step);
                steps.push(step);
            });
        }

        function goTo(index) {
            story.index = (index + findings.length) % findings.length;
            story.time = 0;
            if (renderer) renderer.setActive([], 0);
            showCard(-1);
            const color = findings[story.index].color || '#E4572E';
            root.style.setProperty('--hb-accent', color);
            gradient.querySelectorAll('stop').forEach((stop) => stop.setAttribute('stop-color', color));
            steps.forEach((s, i) => {
                s.classList.toggle('is-active', i === story.index);
                if (i === story.index) s.setAttribute('aria-current', 'true');
                else s.removeAttribute('aria-current');
            });
            debug.index = story.index;
        }

        function showCard(index) {
            if (index === story.shownCard) return;
            cards.forEach((card, i) => card.classList.toggle('is-active', i === index));
            story.shownCard = index;
        }

        function measure() {
            const box = root.getBoundingClientRect();
            const stageBox = stage.getBoundingClientRect();
            if (!box.width || !stageBox.width || !stageBox.height) return false;
            const cardBox = cardsBox.getBoundingClientRect();
            layout = {
                stageX: stageBox.left - box.left,
                stageY: stageBox.top - box.top,
                stageW: stageBox.width,
                stageH: stageBox.height,
                cardX: cardBox.left - box.left,
                cardY: cardBox.top - box.top,
                cardW: cardBox.width
            };
            if (mesh) {
                canvas.width = Math.round(stageBox.width * renderScale);
                canvas.height = Math.round(stageBox.height * renderScale);
                // Fit the brain: whole turn horizontally, full height vertically.
                const aspect = stageBox.width / stageBox.height;
                const t = Math.tan(FOV / 2);
                const distance = Math.max(mesh.halfHeight / (0.86 * t), mesh.radiusXY / (0.92 * t * aspect)) + mesh.radiusXY * 0.3;
                camera = {
                    distance,
                    radius: Math.max(mesh.radiusXY, mesh.halfHeight),
                    proj: perspective(FOV, aspect, Math.max(1, distance - mesh.radiusXY * 2), distance + mesh.radiusXY * 2),
                    light: new Float32Array([0.62, -0.38, 0.69])
                };
            }
            return true;
        }

        function centroid(id) {
            const r = mesh && mesh.regions[id - 1];
            if (!r) return null;
            const sum = [0, 0, 0];
            for (let v = r.vertexStart; v < r.vertexStart + r.vertexCount; v++) {
                sum[0] += mesh.positions[v * 3];
                sum[1] += mesh.positions[v * 3 + 1];
                sum[2] += mesh.positions[v * 3 + 2];
            }
            return sum.map((s) => s / r.vertexCount);
        }

        // Advance the story clock and draw one frame.
        function update(dt, now) {
            const finding = findings[story.index];
            const reduced = reducedMotion.matches;
            const stepLength = reduced ? STEP_REDUCED : STEP;
            const holdEnd = stepLength - CARD_OUT;
            const paused = userPaused || hoverPaused || focusPaused;

            if (finding && !posterMode) {
                let next = story.time + dt * 1000;
                // While paused, keep the current card on screen instead of advancing.
                if (paused && story.time < holdEnd) next = Math.min(next, holdEnd - 1);
                story.time = next;
                if (story.time >= stepLength) goTo(story.index + 1);
            }

            const time = story.time;
            const activation = finding && !posterMode
                ? easeInOut(clamp01(time / FADE)) * easeInOut(clamp01((stepLength - time) / FADE))
                : 0;
            const cardOn = finding && !posterMode && time >= CARD_IN && time < holdEnd;
            showCard(cardOn ? story.index : -1);
            if (steps[story.index]) steps[story.index].style.setProperty('--hb-progress', clamp01(time / stepLength).toFixed(3));

            if (!posterMode) {
                const holding = time > FADE && time < holdEnd;
                const target = userPaused || reduced ? 0 : (holding ? SPIN_HOLD : SPIN);
                spin += (target - spin) * Math.min(1, dt * 2.5);
                yaw += spin * dt;
            }

            if (!renderer || !layout || !camera) return;

            // Camera focus: while a finding holds, ease a little closer and aim
            // part of the way toward the region, then ease back out.
            const focus = finding && !reduced && !posterMode
                ? easeInOut(clamp01((time - 300) / 1400)) * easeInOut(clamp01((stepLength - time) / 1100))
                : 0;
            const model = rotationZ(yaw);
            const c = finding && finding._centroid;
            const cos = Math.cos(yaw), sin = Math.sin(yaw);
            const anchorWorld = c ? [c[0] * cos - c[1] * sin, c[0] * sin + c[1] * cos, c[2]] : [0, 0, 0];
            // (half as much vertically, so the brain does not bob up and down)
            const target = anchorWorld.map((v, axis) => v * FOCUS_SHIFT * focus * (axis === 2 ? 0.5 : 1));
            const distance = camera.distance * (1 - FOCUS_ZOOM * focus);
            const eye = [target[0] + distance * Math.cos(ELEVATION), target[1], target[2] + distance * Math.sin(ELEVATION)];
            const viewProj = multiply(camera.proj, lookAt(eye, target, [0, 0, 1]));
            const eyeDistance = Math.hypot(eye[0], eye[1], eye[2]);

            renderer.setActive(finding && activation > 0 ? finding.regions : [], activation);
            renderer.render({
                model,
                viewProj,
                eye: new Float32Array(eye),
                light: camera.light,
                color: new Float32Array(hexToRgb(finding && finding.color)),
                glow: reduced || userPaused ? 0.5 : 0.5 + 0.5 * Math.sin(now / 280),
                dim: activation,
                ignite: activation,
                depth: new Float32Array([eyeDistance - camera.radius, eyeDistance + camera.radius])
            });
            debug.focus = focus;

            // Callout line from the region's centre to the top edge of the card.
            const lineIn = reduced ? (cardOn ? 1 : 0) : clamp01((time - LINE_START) / LINE_DRAW);
            const lineOut = reduced ? 1 : clamp01((holdEnd + 300 - time) / 300);
            const line = Math.min(lineIn, lineOut);
            if (c && activation > 0.01) {
                const ndc = project(multiply(viewProj, model), c);
                const ax = layout.stageX + (ndc[0] * 0.5 + 0.5) * layout.stageW;
                const ay = layout.stageY + (0.5 - ndc[1] * 0.5) * layout.stageH;
                const tx = Math.min(Math.max(ax + 36, layout.cardX + 28), layout.cardX + layout.cardW - 28);
                const ty = layout.cardY;
                const dy = Math.max(24, ty - ay);
                const path = `M${ax.toFixed(1)} ${ay.toFixed(1)} C${ax.toFixed(1)} ${(ay + dy * 0.55).toFixed(1)} ${tx.toFixed(1)} ${(ty - dy * 0.45).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`;
                leader.setAttribute('d', path);
                leader.style.strokeDashoffset = (1 - line).toFixed(3);
                gradient.setAttribute('x1', ax.toFixed(1));
                gradient.setAttribute('y1', ay.toFixed(1));
                gradient.setAttribute('x2', tx.toFixed(1));
                gradient.setAttribute('y2', ty.toFixed(1));
                cap.setAttribute('cx', tx.toFixed(1));
                cap.setAttribute('cy', ty.toFixed(1));
                cap.style.opacity = line > 0.98 ? '1' : '0';
                anchor.setAttribute('transform', `translate(${ax.toFixed(1)} ${ay.toFixed(1)})`);
                anchor.style.opacity = activation.toFixed(3);

                // Once the line is drawn, a bead of light runs down it, region to card.
                const pulseOn = !reduced && !userPaused && cardOn && line >= 1;
                pulseClock = pulseOn ? pulseClock + dt * 1000 : 0;
                const head = -0.07 + ((pulseClock % PULSE_PERIOD) / PULSE_PERIOD) * 1.07;
                pulses.forEach((p) => {
                    p.setAttribute('d', path);
                    p.style.strokeDashoffset = (-head).toFixed(4);
                    p.style.opacity = pulseOn ? '1' : '0';
                });
                debug.pulse = pulseOn ? head : null;
            } else {
                anchor.style.opacity = '0';
                cap.style.opacity = '0';
                leader.style.strokeDashoffset = '1';
                pulses.forEach((p) => { p.style.opacity = '0'; });
                pulseClock = 0;
                debug.pulse = null;
            }
        }

        function frame(now) {
            if (!running) return;
            const dt = lastFrame ? Math.min(0.25, (now - lastFrame) / 1000) : 0;
            lastFrame = now;
            update(dt, now);
            // Weak GPU: if most frames take longer than ~34 ms, draw fewer pixels.
            if (renderer && renderScale > 1 && dt > 0.034) {
                if (++slowFrames > 45) {
                    renderScale = Math.max(1, renderScale - 0.5);
                    slowFrames = 0;
                    measure();
                }
            } else {
                slowFrames = Math.max(0, slowFrames - 1);
            }
            debug.frames++;
            debug.time = Math.round(story.time);
            debug.yaw = yaw;
            if (posterMode) {
                root.dataset.state = 'poster';
                running = false;
                return;
            }
            // Once a user pause has settled (spin stopped, card shown) the frame
            // no longer changes, so stop drawing until they press play.
            if (userPaused && spin < 1e-3 && story.time >= LINE_START + LINE_DRAW) {
                running = false;
                debug.running = false;
                return;
            }
            rafId = requestAnimationFrame(frame);
        }

        function syncLoop() {
            const shouldRun = visible && !document.hidden && root.dataset.state !== 'loading';
            if (shouldRun && !running) {
                running = true;
                lastFrame = 0;
                rafId = requestAnimationFrame(frame);
            } else if (!shouldRun && running) {
                running = false;
                cancelAnimationFrame(rafId);
            }
            debug.running = running;
        }

        function useFallback() {
            renderer = null;
            if (!stage.querySelector('img')) {
                const poster = element('img', 'hero-brain__poster');
                poster.alt = '';
                poster.decoding = 'async';
                poster.src = `${ASSETS}brain-poster.webp`;
                stage.append(poster);
            }
            canvas.remove();
            root.querySelector('.hero-brain__overlay').style.display = 'none';
            root.dataset.state = 'fallback';
            debug.state = 'fallback';
        }

        toggle.addEventListener('click', () => {
            userPaused = !userPaused;
            toggle.setAttribute('aria-label', userPaused ? 'Play animation' : 'Pause animation');
            toggle.innerHTML = `<i class="fas fa-${userPaused ? 'play' : 'pause'}" aria-hidden="true"></i>`;
            root.classList.toggle('is-paused', userPaused);
            cardsBox.setAttribute('aria-live', userPaused ? 'polite' : 'off');
            syncLoop();
        });
        // Pause while a mouse rests on the brain (not on touch, where "leave" may never come).
        root.addEventListener('pointerenter', (e) => { hoverPaused = e.pointerType === 'mouse'; });
        root.addEventListener('pointerleave', () => { hoverPaused = false; });
        root.addEventListener('focusin', () => { focusPaused = true; });
        root.addEventListener('focusout', (e) => { focusPaused = root.contains(e.relatedTarget); });
        document.addEventListener('visibilitychange', syncLoop);
        if ('IntersectionObserver' in window) {
            new IntersectionObserver((entries) => {
                visible = entries[entries.length - 1].isIntersecting;
                syncLoop();
            }).observe(root);
        }
        if ('ResizeObserver' in window) {
            const observer = new ResizeObserver(() => measure());
            observer.observe(root);
            observer.observe(stage);
        } else {
            window.addEventListener('resize', measure);
        }
        canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            useFallback();
        });

        async function init() {
            const [findingsResult, meshResult] = await Promise.allSettled([
                fetch(`${ASSETS}findings.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
                canAnimate || posterMode ? fetchMesh(`${ASSETS}brain.bin.gz`) : Promise.reject(new Error('animation disabled'))
            ]);

            if (findingsResult.status === 'fulfilled' && !posterMode) {
                findings = (findingsResult.value.findings || []).filter((f) => Array.isArray(f.regions) && f.regions.length);
                root.querySelector('.hero-brain__credit').textContent = findingsResult.value.atlas || '';
                buildCards();
            } else if (findingsResult.status === 'rejected') {
                console.warn('[HeroBrain] findings unavailable:', findingsResult.reason);
            }

            if (meshResult.status === 'fulfilled') {
                try {
                    mesh = meshResult.value;
                    renderer = createRenderer(canvas, mesh);
                    if (!renderer) throw new Error('WebGL unavailable');
                    findings.forEach((f) => { f._centroid = centroid(f.anchor || f.regions[0]); });
                    root.dataset.state = 'live';
                    debug.state = 'live';
                } catch (err) {
                    console.warn('[HeroBrain] falling back to poster:', err);
                    mesh = null;
                    useFallback();
                }
            } else {
                if (canAnimate) console.warn('[HeroBrain] falling back to poster:', meshResult.reason);
                useFallback();
            }

            if (findings.length) goTo(0);
            measure();
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
            syncLoop();
        }

        whenPageIdle(() => init().catch((err) => {
            console.warn('[HeroBrain] could not start:', err);
            useFallback();
            syncLoop();
        }));
    }

    window.HeroBrain = {
        debug: null,
        /**
         * Start the hero brain inside `root` (an empty element). Does nothing on
         * phone-sized screens until the window is widened past 768px.
         */
        mount(root, options = {}) {
            if (!root || root.dataset.heroBrain) return;
            root.dataset.heroBrain = 'mounted';
            const mobile = window.matchMedia(MOBILE_QUERY);
            if (!mobile.matches) {
                start(root, options);
                return;
            }
            const onChange = () => {
                if (mobile.matches || root.dataset.heroBrain === 'started') return;
                root.dataset.heroBrain = 'started';
                start(root, options);
            };
            listen(MOBILE_QUERY, onChange);
        }
    };
})();
