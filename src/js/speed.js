// --- 实时速率监控 ---
let speedAbortController = null;

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
}
