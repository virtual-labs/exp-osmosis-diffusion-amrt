/**
 * graph.js
 * Real-time Line Graph for Solute Concentrations
 */

class Graph {
    constructor() {
        this.canvas = document.getElementById('graphCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.history = [];
        this.maxPoints = 200;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
    }

    update(timestamp, stats) {
        // Frame limiting config
        // Push stat snapshot
        // stats = { 'O2': { in: 5, out: 10 } ... }

        // Just track total solute IN vs OUT for simplicity in this view
        let totalIn = 0;
        let totalOut = 0;

        Object.values(stats).forEach(s => {
            totalIn += s.in;
            totalOut += s.out;
        });

        this.history.push({ totalIn, totalOut });
        if (this.history.length > this.maxPoints) this.history.shift();

        this.draw();
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        if (this.history.length < 2) return;

        const pad = 10;
        const gw = w - pad * 2;
        const gh = h - pad * 2;

        // Find max for scaling
        let maxVal = 10;
        this.history.forEach(p => {
            maxVal = Math.max(maxVal, p.totalIn, p.totalOut);
        });

        const stepX = gw / (this.maxPoints - 1);

        // Draw Out Line (Blue)
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#3b82f6';
        this.ctx.lineWidth = 2;
        this.history.forEach((p, i) => {
            const x = pad + i * stepX;
            const y = h - pad - (p.totalOut / maxVal) * gh;
            if (i === 0) this.ctx.moveTo(x, y); else this.ctx.lineTo(x, y);
        });
        this.ctx.stroke();

        // Draw In Line (Green)
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#22c55e';
        this.history.forEach((p, i) => {
            const x = pad + i * stepX;
            const y = h - pad - (p.totalIn / maxVal) * gh;
            if (i === 0) this.ctx.moveTo(x, y); else this.ctx.lineTo(x, y);
        });
        this.ctx.stroke();

        // Legend
        this.ctx.font = '10px Roboto';
        this.ctx.fillStyle = '#3b82f6';
        this.ctx.fillText('Outside', 10, 10);
        this.ctx.fillStyle = '#22c55e';
        this.ctx.fillText('Inside', 60, 10);
    }
}

window.Graph = new Graph();
