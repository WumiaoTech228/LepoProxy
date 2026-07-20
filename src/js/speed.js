// --- 实时速率监控 ---
let speedAbortController = null;
let uploadHistory = Array(40).fill(0);
let downloadHistory = Array(40).fill(0);

export function formatSpeed(bps) {
    if (bps < 1024) return `${bps} B/s`;
    if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
    return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
}

export function startSpeedMonitor(localPort) {
    stopSpeedMonitor();
    
    speedAbortController = new AbortController();
    const signal = speedAbortController.signal;
    const upEl = document.getElementById('speedUp');
    const downEl = document.getElementById('speedDown');
    const canvas = document.getElementById('speedCanvas');

    // Reset histories
    uploadHistory.fill(0);
    downloadHistory.fill(0);

    (async () => {
        while (!signal.aborted) {
            try {
                const response = await fetch('http://127.0.0.1:9090/traffic', { signal });
                if (!response.ok) {
                    throw new Error(`HTTP error: ${response.status}`);
                }
                
                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf-8");
                let buffer = "";
                
                while (!signal.aborted) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop();
                    
                    for (const line of lines) {
                        if (line.trim()) {
                            try {
                                const data = JSON.parse(line);
                                const up = data.up || 0;
                                const down = data.down || 0;
                                if (upEl) {
                                    upEl.textContent = formatSpeed(up);
                                    upEl.style.color = up > 0 ? 'rgb(52 211 153)' : '';
                                }
                                if (downEl) {
                                    downEl.textContent = formatSpeed(down);
                                    downEl.style.color = down > 0 ? 'rgb(56 189 248)' : '';
                                }

                                // Update history buffers
                                uploadHistory.push(up);
                                uploadHistory.shift();
                                downloadHistory.push(down);
                                downloadHistory.shift();

                                // Draw live chart
                                if (canvas) {
                                    drawSpeedChart(canvas, uploadHistory, downloadHistory);
                                }
                            } catch (e) {
                                // Ignore parsing error of partial chunks
                            }
                        }
                    }
                }
            } catch (e) {
                if (signal.aborted) break;
                console.warn("Speed monitor connection failed/disconnected, retrying in 1s:", e);
                if (upEl) { upEl.textContent = '-- KB/s'; upEl.style.color = ''; }
                if (downEl) { downEl.textContent = '-- KB/s'; downEl.style.color = ''; }
                // Clear chart on disconnect
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    })();
}

export function stopSpeedMonitor() {
    if (speedAbortController) {
        speedAbortController.abort();
        speedAbortController = null;
    }
    const upEl = document.getElementById('speedUp');
    const downEl = document.getElementById('speedDown');
    if (upEl) { upEl.textContent = '-- KB/s'; upEl.style.color = ''; }
    if (downEl) { downEl.textContent = '-- KB/s'; downEl.style.color = ''; }
    
    const canvas = document.getElementById('speedCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// Live canvas chart drawing logic
function drawSpeedChart(canvas, upHistory, downHistory) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // Adapt to High-DPI screens
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const len = upHistory.length;
    if (len < 2) {
        ctx.restore();
        return;
    }

    // Determine max speed to auto-scale Y axis (minimum scale 50KB/s)
    let maxSpeed = 1024 * 50; 
    for (let i = 0; i < len; i++) {
        if (upHistory[i] > maxSpeed) maxSpeed = upHistory[i];
        if (downHistory[i] > maxSpeed) maxSpeed = downHistory[i];
    }

    // 1. Draw thin background grids
    ctx.strokeStyle = document.documentElement.classList.contains('dark') 
        ? 'rgba(255, 255, 255, 0.04)' 
        : 'rgba(0, 0, 0, 0.03)';
    ctx.lineWidth = 1;
    
    // Draw 2 horizontal grid lines
    for (let i = 1; i <= 2; i++) {
        const y = (height / 3) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    const getX = (index) => (width / (len - 1)) * index;
    const getY = (speed) => height - (speed / maxSpeed) * (height - 4) - 2;

    // Helper to draw a smooth curve
    const drawPath = (history, colorLine, colorFill) => {
        ctx.beginPath();
        ctx.moveTo(0, getY(history[0]));

        for (let i = 0; i < len - 1; i++) {
            const x1 = getX(i);
            const y1 = getY(history[i]);
            const x2 = getX(i + 1);
            const y2 = getY(history[i + 1]);
            const xc = (x1 + x2) / 2;
            const yc = (y1 + y2) / 2;
            ctx.quadraticCurveTo(x1, y1, xc, yc);
        }
        
        ctx.lineTo(width, getY(history[len - 1]));
        ctx.strokeStyle = colorLine;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Fill area
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = colorFill;
        ctx.fill();
    };

    // 2. Draw Download curve (Blue)
    const isDark = document.documentElement.classList.contains('dark');
    const dlColorLine = 'rgb(56, 189, 248)'; // sky-400
    const dlColorFill = isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(56, 189, 248, 0.06)';
    drawPath(downHistory, dlColorLine, dlColorFill);

    // 3. Draw Upload curve (Green)
    const ulColorLine = 'rgb(52, 211, 153)'; // emerald-400
    const ulColorFill = isDark ? 'rgba(52, 211, 153, 0.06)' : 'rgba(52, 211, 153, 0.04)';
    drawPath(upHistory, ulColorLine, ulColorFill);

    ctx.restore();
}
