/**
 * Osmosis & Diffusion Simulator
 * Handles particle physics for simple diffusion and osmosis across a semi-permeable membrane.
 */

// Simulation Configuration
const CONFIG = {
    particleCount: 200,
    waterColor: '#3b82f6',
    soluteColor: '#ef4444',
    waterSize: 4,
    soluteSize: 8,
    baseSpeed: 2,
};

// Simulation State
const state = {
    mode: 'diffusion', // 'diffusion' | 'osmosis'
    isPlaying: true,
    temperature: 50, // 10 - 100
    particles: [],
    membrane: {
        x: 0, // Calculated at runtime
        width: 10,
        permeableToWater: true,
        permeableToSolute: true // Changes based on mode
    }
};

// DOM Elements
const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const btnPlayPause = document.getElementById('btn-play-pause');
const btnReset = document.getElementById('btn-reset');
const btnDiffusion = document.getElementById('btn-diffusion');
const btnOsmosis = document.getElementById('btn-osmosis');

// ---- Classes ----

class Particle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'water' | 'solute'
        this.radius = type === 'water' ? CONFIG.waterSize : CONFIG.soluteSize;
        this.color = type === 'water' ? CONFIG.waterColor : CONFIG.soluteColor;

        // Random velocity vector
        this.vx = (Math.random() - 0.5) * CONFIG.baseSpeed;
        this.vy = (Math.random() - 0.5) * CONFIG.baseSpeed;
    }

    update(speedMultiplier) {
        // Apply temperature factor
        let dx = this.vx * speedMultiplier;
        let dy = this.vy * speedMultiplier;

        // Predictive movement for collision detection
        let nextX = this.x + dx;
        let nextY = this.y + dy;

        // Wall Collisions
        if (nextX - this.radius < 0 || nextX + this.radius > canvas.width) {
            this.vx *= -1;
            nextX = Math.max(this.radius, Math.min(canvas.width - this.radius, nextX));
        }
        if (nextY - this.radius < 0 || nextY + this.radius > canvas.height) {
            this.vy *= -1;
            nextY = Math.max(this.radius, Math.min(canvas.height - this.radius, nextY));
        }

        // Membrane Collision Logic
        const memLeft = state.membrane.x - state.membrane.width / 2;
        const memRight = state.membrane.x + state.membrane.width / 2;

        // Track previous side for Flow counting
        const wasLeft = this.x < state.membrane.x;
        const wasRight = this.x > state.membrane.x;

        // Check if crossing membrane
        // From Left to Right
        if (this.x + this.radius <= memLeft && nextX + this.radius > memLeft) {
            if (!this.canPassMembrane()) {
                this.vx *= -1; // Bounce back
                nextX = this.x; // Cancel move
            }
        }
        // From Right to Left
        else if (this.x - this.radius >= memRight && nextX - this.radius < memRight) {
            if (!this.canPassMembrane()) {
                this.vx *= -1; // Bounce back
                nextX = this.x; // Cancel move
            }
        }

        // Safety for being trapped inside
        if (nextX > memLeft && nextX < memRight) {
            // Push to closest side
            if (Math.abs(nextX - memLeft) < Math.abs(nextX - memRight)) {
                nextX = memLeft - this.radius;
            } else {
                nextX = memRight + this.radius;
            }
        }

        this.x = nextX;
        this.y = nextY;

        // Track Flow (only for water)
        if (this.type === 'water') {
            const isNowLeft = this.x < state.membrane.x;
            const isNowRight = this.x > state.membrane.x;

            if (wasLeft && isNowRight) netFlowCounter++;
            if (wasRight && isNowLeft) netFlowCounter--;
        }
    }

    canPassMembrane() {
        if (this.type === 'water') return state.membrane.permeableToWater;
        if (this.type === 'solute') return state.membrane.permeableToSolute;
        return false;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// ---- Core Functions ----

function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    setupEventListeners();
    resetSimulation();
    requestAnimationFrame(loop);
}

function resizeCanvas() {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    state.membrane.x = canvas.width / 2;
}

function resetSimulation() {
    state.particles = [];
    netFlowCounter = 0; // Reset Flow
    const soluteLeftCount = parseInt(document.getElementById('solute-left-slider').value) * 2;
    const soluteRightCount = parseInt(document.getElementById('solute-slider').value) * 2;

    // Create Water (Universal solvent) - Distribute evenly
    const waterCount = 300;
    for (let i = 0; i < waterCount; i++) {
        state.particles.push(new Particle(
            Math.random() * canvas.width,
            Math.random() * canvas.height,
            'water'
        ));
    }

    // Create Solutes Left
    for (let i = 0; i < soluteLeftCount; i++) {
        state.particles.push(new Particle(
            Math.random() * (canvas.width / 2 - 20),
            Math.random() * canvas.height,
            'solute'
        ));
    }

    // Create Solutes Right
    for (let i = 0; i < soluteRightCount; i++) {
        state.particles.push(new Particle(
            (canvas.width / 2 + 20) + Math.random() * (canvas.width / 2 - 40),
            Math.random() * canvas.height,
            'solute'
        ));
    }
}

function updatePhysics() {
    const speedMultiplier = (state.temperature / 50); // Normalized speed

    // 1. Move Particles & Wall/Membrane Collisions
    state.particles.forEach(p => {
        p.update(speedMultiplier);
    });

    // 2. Particle-Particle Collisions (Simple O(N^2) optimization is acceptable for < 500 particles)
    // For educational sims, we can skip this if performance lags, but it adds realism.
    // We'll use a simplified check to avoid sticking.

    for (let i = 0; i < state.particles.length; i++) {
        for (let j = i + 1; j < state.particles.length; j++) {
            const p1 = state.particles[i];
            const p2 = state.particles[j];

            // Distance check
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = p1.radius + p2.radius;

            if (distance < minDistance) {
                resolveCollision(p1, p2, dx, dy, distance);
            }
        }
    }
}

function resolveCollision(p1, p2, dx, dy, distance) {
    // 1. Normal vector
    const nx = dx / distance;
    const ny = dy / distance;

    // 2. Tangential vector
    const tx = -ny;
    const ty = nx;

    // 3. Dot Product Tangent
    const dpTan1 = p1.vx * tx + p1.vy * ty;
    const dpTan2 = p2.vx * tx + p2.vy * ty;

    // 4. Dot Product Normal
    const dpNorm1 = p1.vx * nx + p1.vy * ny;
    const dpNorm2 = p2.vx * nx + p2.vy * ny;

    // 5. Conservation of momentum in 1D
    // Assume equal mass for simplicity or scale by radius
    const m1 = p1.radius; // Mass proportional to size
    const m2 = p2.radius;

    const mSum = m1 + m2;

    // New Normal Velocities
    const v1n = (dpNorm1 * (m1 - m2) + 2 * m2 * dpNorm2) / mSum;
    const v2n = (dpNorm2 * (m2 - m1) + 2 * m1 * dpNorm1) / mSum;

    // 6. Update Velocities
    p1.vx = tx * dpTan1 + nx * v1n;
    p1.vy = ty * dpTan1 + ny * v1n;
    p2.vx = tx * dpTan2 + nx * v2n;
    p2.vy = ty * dpTan2 + ny * v2n;

    // 7. Prevent Overlap (Sticking)
    const overlap = (p1.radius + p2.radius - distance) / 2;
    p1.x -= overlap * nx;
    p1.y -= overlap * ny;
    p2.x += overlap * nx;
    p2.y += overlap * ny;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Membrane
    ctx.fillStyle = '#cbd5e1';
    const mx = state.membrane.x - state.membrane.width / 2;
    ctx.fillRect(mx, 0, state.membrane.width, canvas.height);

    // Draw Membrane Pores
    ctx.strokeStyle = '#94a3b8';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(state.membrane.x, 0);
    ctx.lineTo(state.membrane.x, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Particles
    state.particles.forEach(p => p.draw());
}

function loop() {
    if (state.isPlaying) {
        updatePhysics();
    }
    draw();
    updateStats();
    requestAnimationFrame(loop);
}

function updateStats() {
    // Simple count approximation
    const mid = canvas.width / 2;
    let leftSolute = 0, rightSolute = 0;

    state.particles.forEach(p => {
        if (p.type === 'solute') {
            if (p.x < mid) leftSolute++;
            else rightSolute++;
        }
    });

    // Update Stats Pane
    // Need to calculate Concentration % (Solute / (Solute+Water))
    // Or just Solute count for simplicity?
    // Let's do Solute Count for clarity as per prompt "Interior concentration"

    document.getElementById('stat-left').innerText = leftSolute;
    document.getElementById('stat-right').innerText = rightSolute;
    document.getElementById('stat-flow').innerText = netFlowCounter;
}

// ---- Event Listeners ----
function setupEventListeners() {
    btnPlayPause.addEventListener('click', () => {
        state.isPlaying = !state.isPlaying;
        btnPlayPause.innerHTML = state.isPlaying ? '<span class="icon">⏸</span> Pause' : '<span class="icon">▶</span> Play';
    });

    btnReset.addEventListener('click', resetSimulation);

    document.getElementById('temp-slider').addEventListener('input', (e) => {
        state.temperature = parseInt(e.target.value);
    });

    // React to slider changes immediately if logic allows, or require reset? 
    // Usually immediate update or reset on specific triggers. For now, simple update on next reset or dynamic add/remove could be complex. 
    // Let's make sliders trigger reset for accurate concentration for now.
    document.getElementById('solute-slider').addEventListener('change', resetSimulation);
    document.getElementById('solute-left-slider').addEventListener('change', resetSimulation);

    // Mode Switching
    btnDiffusion.addEventListener('click', () => setMode('diffusion'));
    btnOsmosis.addEventListener('click', () => setMode('osmosis'));
}

function setMode(mode) {
    state.mode = mode;
    state.membrane.permeableToSolute = (mode === 'diffusion'); // Solute can pass in diffusion

    // Update UI
    if (mode === 'diffusion') {
        btnDiffusion.classList.add('active');
        btnOsmosis.classList.remove('active');
    } else {
        btnOsmosis.classList.add('active');
        btnDiffusion.classList.remove('active');
    }
    resetSimulation();
}

// Start
init();
