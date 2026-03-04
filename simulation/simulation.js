/**
 * simulation.js
 * Final Physics Engine: Lipid Bilayer, Osmotic Swelling, Strict Modes
 */

const CONFIG = {
    membraneThickness: 25,
    baseSpeed: 1,
    solutes: {
        'O2': { color: '#ef4444', radius: 4, type: 'small-nonpolar' },
        'CO2': { color: '#64748b', radius: 4, type: 'small-nonpolar' },
        'Na': { color: '#f97316', radius: 5, type: 'ion' },
        'Glucose': { color: '#10b981', radius: 7, type: 'large-polar' },
        'Water': { color: '#3b82f6', radius: 3, type: 'solvent' }
    }
};

class Simulation {
    constructor() {
        this.canvas = document.getElementById('simCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.channels = {};

        // State
        this.isPlaying = true;
        this.speedFactor = 1;
        this.visOptions = { highlight: false, sound: false };
        this.currentMode = 'diffusion'; // 'diffusion', 'facilitated', 'osmosis'

        // Geometry
        this.resize();
        this.membraneY = this.canvas.height / 2;
        this.targetMembraneY = this.membraneY;

        window.addEventListener('resize', () => this.resize());

        // Audio (Simple Oscillator)
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Loop
        this.lastTime = 0;
        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        if (!this.membraneY) this.membraneY = this.canvas.height / 2;
    }

    reset() {
        this.particles = [];
        this.membraneY = this.canvas.height / 2;
        this.targetMembraneY = this.membraneY;
    }

    spawnParticle(type, count = 1, region = 'out') {
        const conf = CONFIG.solutes[type];
        if (!conf) return;

        const mY = this.membraneY;
        const th = CONFIG.membraneThickness;

        const minY = region === 'out' ? 0 : mY + th / 2 + 5;
        const maxY = region === 'out' ? mY - th / 2 - 5 : this.canvas.height;

        for (let i = 0; i < count; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.max(0, Math.min(this.canvas.height, minY + Math.random() * (maxY - minY)));
            this.particles.push(new Particle(x, y, type));
        }
    }

    removeParticle(type, count = 1, region = 'out') {
        let removed = 0;
        const isOut = (region === 'out');

        for (let i = this.particles.length - 1; i >= 0; i--) {
            if (removed >= count) break;
            const p = this.particles[i];
            const pIsOut = p.y < this.membraneY;

            if (p.type === type && pIsOut === isOut) {
                this.particles.splice(i, 1);
                removed++;
            }
        }
    }

    setChannelState(type, isOpen) {
        this.channels[type] = isOpen;
    }

    loop(timestamp) {
        if (this.isPlaying) {
            this.update(this.speedFactor);
        }
        this.draw();
        if (window.UI && window.UI.updateStats) window.UI.updateStats(this.getStats());
        requestAnimationFrame((t) => this.loop(t));
    }

    update(speed) {
        // 1. Osmotic Swelling Logic & Tonicity Calculation
        const stats = this.getStats();
        // Calculate Concentration: (Solute / Water)
        let solIn = 0, solOut = 0;
        let watIn = Math.max(1, stats['Water'].in);
        let watOut = Math.max(1, stats['Water'].out);

        // Count all non-water particles as solutes
        this.particles.forEach(p => {
            if (p.type !== 'Water') {
                if (p.y < this.membraneY) solOut++; else solIn++;
            }
        });

        const concIn = solIn / watIn;
        const concOut = solOut / watOut;

        let tonicity = 'Isotonic';
        const threshold = 0.05;
        if (concOut > concIn + threshold) tonicity = 'Hypertonic';
        else if (concIn > concOut + threshold) tonicity = 'Hypotonic';

        this.currentTonicity = tonicity;

        if (this.currentMode === 'osmosis') {
            const totalWater = Math.max(1, (stats['Water'].in + stats['Water'].out));
            const ratioIn = stats['Water'].in / totalWater;

            // Target Y based on water ratio (volume)
            const safeRatio = Math.max(0.15, Math.min(0.85, ratioIn));
            this.targetMembraneY = this.canvas.height * (1 - safeRatio);

            this.membraneY += (this.targetMembraneY - this.membraneY) * 0.02;
        } else {
            this.targetMembraneY = this.canvas.height / 2;
            this.membraneY += (this.targetMembraneY - this.membraneY) * 0.05;
        }

        // 2. Particle Physics
        const thickness = CONFIG.membraneThickness;
        const topY = this.membraneY - thickness / 2;
        const bottomY = this.membraneY + thickness / 2;

        this.particles.forEach(p => {
            let nextX = p.x + p.vx * speed;
            let nextY = p.y + p.vy * speed;
            const r = p.radius;

            // Walls
            if (nextX < 0 || nextX > this.canvas.width) p.vx *= -1;
            if (nextY < 0 || nextY > this.canvas.height) p.vy *= -1;

            // Membrane Interaction
            const wasTop = p.y < topY;
            const wasBottom = p.y > bottomY;

            let crossed = false;
            let bounced = false;

            if (wasTop && nextY + r > topY) {
                if (this.canCross(p, nextX)) {
                    if (nextY > topY + thickness) crossed = true;
                } else {
                    p.vy *= -1;
                    nextY = topY - r;
                    bounced = true;
                }
            } else if (wasBottom && nextY - r < bottomY) {
                if (this.canCross(p, nextX)) {
                    if (nextY < bottomY - thickness) crossed = true;
                } else {
                    p.vy *= -1;
                    nextY = bottomY + r;
                    bounced = true;
                }
            }

            if (crossed) {
                if (this.visOptions.highlight) this.triggerHighlight(p);
                if (this.visOptions.sound) this.triggerSound();
                // Trigger Channel Animation if facilitated
                this.triggerChannelVisual(p);
            }

            p.x = nextX;
            p.y = nextY;

            if (p.highlight > 0) p.highlight -= 0.05;
        });

        // Decay Channel Animations
        ['aquaporin', 'na-channel', 'glu-transporter'].forEach(k => {
            if (this.channelAnims && this.channelAnims[k] > 0) this.channelAnims[k] -= 0.1;
        });
    }

    canCross(p, x) {
        // Strict Mode Rules

        // 1. Diffusion Mode: Only Small Non-Polar (O2, CO2)
        if (this.currentMode === 'diffusion') {
            return p.prop === 'small-nonpolar';
        }

        // 2. Osmosis Mode: Only Water (via Aquaporins usually, or leak)
        // AND Solutes BLOCKED completely.
        if (this.currentMode === 'osmosis') {
            if (p.type !== 'Water') return false;
            // Water needs aquaporin or leak
            // If aquaporin is OPEN, it flows better.
            // Check X for Aquaporin Channel? 
            if (this.channels['aquaporin']) {
                // Check if near channel? Or global?
                // PhET usually allows global flow if channel is open for simplicity, 
                // OR requires hitting the channel.
                // Let's require hitting the channel X range for visual accuracy.
                if (this.hitChannel(x, 'aquaporin')) return true;
                return Math.random() < 0.005; // Very slow leak if missed channel
            }
            return Math.random() < 0.005; // Leak
        }

        // 3. Facilitated / Combined
        // Small Non-Polar always pass
        if (p.prop === 'small-nonpolar') return true;

        // Specific Transporters
        // Na
        if (p.type === 'Na') {
            if (this.channels['na-channel'] && this.hitChannel(x, 'na-channel')) return true;
            return false;
        }
        // Glucose
        if (p.type === 'Glucose') {
            if (this.channels['glu-transporter'] && this.hitChannel(x, 'glu-transporter')) return true;
            return false;
        }
        // Water
        if (p.type === 'Water') {
            if (this.channels['aquaporin'] && this.hitChannel(x, 'aquaporin')) return true;
            return Math.random() < 0.005; // Leak
        }

        return false;
    }

    hitChannel(x, type) {
        // Defined zones (percent of width)
        const w = this.canvas.width;
        let centers = [];
        if (type === 'aquaporin') centers = [0.2, 0.8];
        if (type === 'na-channel') centers = [0.35, 0.65];
        if (type === 'glu-transporter') centers = [0.5];

        // Tolerance
        const tol = 30; // px
        for (let c of centers) {
            if (Math.abs(x - c * w) < tol) return true;
        }
        return false;
    }

    triggerChannelVisual(p) {
        if (!this.channelAnims) this.channelAnims = {};
        // Identify which channel type was used
        if (p.type === 'Water') this.channelAnims['aquaporin'] = 1.0;
        if (p.type === 'Na') this.channelAnims['na-channel'] = 1.0;
        if (p.type === 'Glucose') this.channelAnims['glu-transporter'] = 1.0;
    }

    triggerHighlight(p) {
        p.highlight = 1.0;
    }

    triggerSound() {
        const now = this.audioCtx.currentTime;
        if (this.lastSoundTime && now - this.lastSoundTime < 0.1) return; // Throttle 100ms
        this.lastSoundTime = now;

        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.frequency.setValueAtTime(400 + Math.random() * 200, now);

        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawMembrane();
        this.particles.forEach(p => p.draw(this.ctx));
        this.drawOverlay();
    }

    drawOverlay() {
        if (!this.currentTonicity) return;

        this.ctx.save();
        this.ctx.font = 'bold 20px Roboto, sans-serif';
        this.ctx.textAlign = 'right';

        const x = this.canvas.width - 20;
        const y = this.canvas.height - 20;

        let tColor = '#555';
        if (this.currentTonicity === 'Hypertonic') tColor = '#f59e0b';
        if (this.currentTonicity === 'Hypotonic') tColor = '#3b82f6';
        if (this.currentTonicity === 'Isotonic') tColor = '#10b981';

        this.ctx.fillStyle = tColor;
        this.ctx.fillText(this.currentTonicity, x, y);

        // Debug info
        // this.ctx.font = '12px monospace';
        // this.ctx.fillStyle = '#888';
        // this.ctx.fillText(`Crossings: ${this.crossings || 0}`, x, y - 25);

        this.ctx.restore();
    }

    drawMembrane() {
        const y = this.membraneY;
        const h = CONFIG.membraneThickness;
        const w = this.canvas.width;

        // Backgrounds
        this.ctx.fillStyle = '#e0f2fe'; // Light Blue Outside
        this.ctx.fillRect(0, 0, w, y - h / 2);
        this.ctx.fillStyle = '#fef3c7'; // Light Yellow Inside (Cytoplasm)
        this.ctx.fillRect(0, y + h / 2, w, this.canvas.height - (y + h / 2));

        // Draw Lipid Bilayer (Simplified for Perf)
        // Just draw lines and heads
        this.ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
        this.ctx.fillRect(0, y - h / 2, w, h);

        // Draw Channels
        // Layout: Aqua(0.2), Na(0.35), Glu(0.5), Na(0.65), Aqua(0.8)
        this.drawSpecificChannel(w * 0.2, y, h, 'aquaporin', '#3b82f6');
        this.drawSpecificChannel(w * 0.8, y, h, 'aquaporin', '#3b82f6');

        this.drawSpecificChannel(w * 0.35, y, h, 'na-channel', '#f97316');
        this.drawSpecificChannel(w * 0.65, y, h, 'na-channel', '#f97316');

        this.drawSpecificChannel(w * 0.5, y, h, 'glu-transporter', '#10b981');
    }

    drawSpecificChannel(x, y, h, type, color) {
        // Check visibility
        const isEnabled = this.channels[type];
        // If strict mode, maybe hide irrelevant channels?
        // But PhET usually shows them closed.
        // Let's just draw them if isEnabled or if they exist in this Mode.
        const mode = this.currentMode;
        if (mode === 'diffusion' && type !== 'aquaporin') return; // Hide complex channels in diffusion?
        // Actually prompt says "Channel presence" is a Factor.

        if (!isEnabled && mode !== 'diffusion') {
            // Draw "Closed" or Ghost
            this.ctx.globalAlpha = 0.3;
        } else {
            this.ctx.globalAlpha = 1.0;
        }

        if (this.currentMode === 'diffusion' && type !== 'aquaporin') this.ctx.globalAlpha = 0; // Hide

        if (this.ctx.globalAlpha === 0) {
            this.ctx.globalAlpha = 1; return;
        }

        this.ctx.save();
        this.ctx.translate(x, y);

        // Animation Pop
        let scale = 1;
        if (this.channelAnims && this.channelAnims[type] > 0) {
            scale = 1 + this.channelAnims[type] * 0.2;
            this.ctx.scale(scale, scale);
        }

        // Draw Channel Shape
        this.ctx.fillStyle = color;
        // Rect with hole
        const w = 40;
        this.ctx.fillRect(-w / 2, -h / 2 - 5, w / 2 - 5, h + 10); // Left wall
        this.ctx.fillRect(5, -h / 2 - 5, w / 2 - 5, h + 10); // Right wall

        // Gate (if closed and not enabled)
        if (!isEnabled) {
            this.ctx.fillStyle = '#ef4444';
            this.ctx.fillRect(-w / 2, -5, w, 10); // Closed Gate
        }

        // Label
        if (isEnabled) {
            this.ctx.fillStyle = '#333';
            this.ctx.font = '10px Arial';
            this.ctx.textAlign = 'center';
            // this.ctx.fillText(type, 0, -h); 
        }

        this.ctx.restore();
        this.ctx.globalAlpha = 1.0;
    }

    getStats() {
        const stats = {};
        Object.keys(CONFIG.solutes).forEach(k => stats[k] = { in: 0, out: 0 });
        this.particles.forEach(p => {
            const loc = p.y < this.membraneY ? 'out' : 'in';
            stats[p.type][loc]++;
        });
        return stats;
    }
}

class Particle {
    constructor(x, y, typeName) {
        this.x = x;
        this.y = y;
        this.type = typeName;
        const conf = CONFIG.solutes[typeName];
        this.radius = conf.radius;
        this.baseColor = conf.color;
        this.prop = conf.type;
        this.highlight = 0;

        const v = CONFIG.baseSpeed * (0.5 + Math.random());
        const a = Math.random() * Math.PI * 2;
        this.vx = Math.cos(a) * v;
        this.vy = Math.sin(a) * v;
    }

    draw(ctx) {
        ctx.fillStyle = this.baseColor;

        // Highlight effect
        if (this.highlight > 0) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#fbbf24'; // Yellow glow
            ctx.fillStyle = '#fff'; // Flash white
        }

        ctx.beginPath();
        if (this.type === 'Na') {
            // Triangle
            ctx.moveTo(this.x, this.y - this.radius);
            ctx.lineTo(this.x + this.radius, this.y + this.radius);
            ctx.lineTo(this.x - this.radius, this.y + this.radius);
        } else if (this.type === 'Glucose') {
            // Hexagon simplified
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#065f46'; ctx.lineWidth = 1; ctx.stroke();
        } else {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        }
        ctx.fill();

        // Reset shadow
        ctx.shadowBlur = 0;
    }
}

const sim = new Simulation();
window.simulation = sim;
