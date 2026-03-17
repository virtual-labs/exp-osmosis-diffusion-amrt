/**
 * ui.js
 * Final UI Controller
 */

const MOLECULES = [
    { id: 'O2', name: 'Oxygen', icon: 'shape-o2' },
    { id: 'CO2', name: 'CO₂', icon: 'shape-co2' },
    { id: 'Na', name: 'Sodium', icon: 'shape-na' },
    { id: 'Glucose', name: 'Glucose', icon: 'shape-glu' },
    { id: 'Water', name: 'Water', icon: 'shape-water' }
];

const MODES = {
    'diffusion': { allowed: ['O2', 'CO2'], channels: false },
    'facilitated': { allowed: ['Na', 'Glucose'], channels: true },
    'osmosis': { allowed: ['Water', 'Na'], channels: true },
    'combined': { allowed: ['O2', 'CO2', 'Na', 'Glucose', 'Water'], channels: true }
};

class UI {
    constructor() {
        this.renderControls();
        this.renderBottomPanel();
        this.bindEvents();
        // Init Defaults
        this.setMode('diffusion');
    }

    renderControls() {
        const container = document.getElementById('solute-controls');
        container.innerHTML = '';
        MOLECULES.forEach(mol => {
            const div = document.createElement('div');
            div.className = 'solute-row';
            div.dataset.id = mol.id;
            div.innerHTML = `
                <div class="solute-header">
                    <div class="solute-icon ${mol.icon}"></div> <span>${mol.name}</span>
                </div>
                <div class="control-group">
                    <span class="control-label">Outside</span>
                    ${this.makeStepper(mol.id, 'out')}
                </div>
                <div class="control-group">
                    <span class="control-label">Inside</span>
                    ${this.makeStepper(mol.id, 'in')}
                </div>
            `;
            container.appendChild(div);
        });
    }

    makeStepper(id, region) {
        return `
            <div class="stepper">
                <button class="step-btn" onclick="UI.mod('${id}', -5, '${region}')">⏪</button>
                <button class="step-btn" onclick="UI.mod('${id}', -1, '${region}')">◀</button>
                <button class="step-btn" onclick="UI.mod('${id}', 1, '${region}')">▶</button>
                <button class="step-btn" onclick="UI.mod('${id}', 5, '${region}')">⏩</button>
            </div>
        `;
    }

    renderBottomPanel() {
        const container = document.getElementById('concentration-cards');
        container.innerHTML = '';
        MOLECULES.forEach(mol => {
            const card = document.createElement('div');
            card.className = 'conc-card';
            card.dataset.id = mol.id;
            const colorVar = `var(--color-${mol.id.toLowerCase()})`;
            card.innerHTML = `
                <div class="conc-title"><div class="solute-icon ${mol.icon}"></div> ${mol.name}</div>
                <div class="conc-bars">
                    <div class="bar-wrapper">
                         <div id="bar-out-${mol.id}" class="bar" style="background: ${colorVar}; height: 0%;"></div>
                         <span class="bar-label">Out</span>
                    </div>
                    <div class="bar-wrapper">
                         <div id="bar-in-${mol.id}" class="bar" style="background: ${colorVar}; height: 0%;"></div>
                         <span class="bar-label">In</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    bindEvents() {
        // Global Buttons
        const btnPlay = document.getElementById('btn-play-pause');
        btnPlay.addEventListener('click', () => {
            window.simulation.isPlaying = !window.simulation.isPlaying;
            btnPlay.innerHTML = window.simulation.isPlaying ? '<span class="icon">⏸</span>' : '<span class="icon">▶</span>';
        });
        document.getElementById('btn-reset').addEventListener('click', () => window.simulation.reset());

        // Speed
        document.querySelectorAll('input[name="speed"]').forEach(r => {
            r.addEventListener('change', e => window.simulation.speedFactor = parseFloat(e.target.value));
        });



        // Mode Select
        const modeSelect = document.getElementById('mode-select');
        if (modeSelect) {
            modeSelect.addEventListener('change', e => window.UI.setMode(e.target.value));
        }

        // Channel Toggles
        document.getElementById('chk-aquaporin').addEventListener('change', e => window.simulation.setChannelState('aquaporin', e.target.checked));
        document.getElementById('chk-na-channel').addEventListener('change', e => window.simulation.setChannelState('na-channel', e.target.checked));
        document.getElementById('chk-glu-transporter').addEventListener('change', e => window.simulation.setChannelState('glu-transporter', e.target.checked));
    }

    setMode(mode) {
        window.simulation.currentMode = mode;
        const conf = MODES[mode];

        // Update Dropdown if set programmatically
        const sel = document.getElementById('mode-select');
        if (sel) sel.value = mode;

        // Hide/Show Controls
        document.querySelectorAll('.solute-row').forEach(row => {
            row.style.display = conf.allowed.includes(row.dataset.id) ? 'block' : 'none';
        });
        document.querySelectorAll('.conc-card').forEach(card => {
            card.style.display = conf.allowed.includes(card.dataset.id) ? 'flex' : 'none';
        });

        // Hide/Show Channels
        // Channel toggles should be visible if channels are relevant (Osmosis/Facilitated)
        // We will toggle the whole container visibility
        const channelContainer = document.querySelector('.channel-toggles');
        if (channelContainer) {
            channelContainer.style.display = conf.channels ? 'block' : 'none';
        }

        // Reset Sim for cleanliness
        window.simulation.reset();
    }

    // Static for onclick
    static mod(type, count, region) {
        if (count > 0) window.simulation.spawnParticle(type, count, region);
        else window.simulation.removeParticle(type, Math.abs(count), region);
    }

    updateStats(stats) {
        const MAX = 50;
        MOLECULES.forEach(mol => {
            const data = stats[mol.id];
            if (!data) return;
            const hOut = Math.min(100, (data.out / MAX) * 100);
            const hIn = Math.min(100, (data.in / MAX) * 100);
            const bo = document.getElementById(`bar-out-${mol.id}`);
            const bi = document.getElementById(`bar-in-${mol.id}`);
            if (bo) bo.style.height = `${hOut}%`;
            if (bi) bi.style.height = `${hIn}%`;
        });
    }
}

// Init
window.addEventListener('DOMContentLoaded', () => {
    window.UI = new UI();
});
