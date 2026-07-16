import { getConnectionState } from './main.js';

let isIpDiagnosing = false;
let isUnlockDiagnosing = false;
let isLogsPaused = false;

// 1. IP 地理出口检测
export async function runIpDiagnostic() {
    if (isIpDiagnosing) return;
    isIpDiagnosing = true;
    
    const diagCountry = document.getElementById('diagCountry');
    const diagRegionCity = document.getElementById('diagRegionCity');
    const diagIp = document.getElementById('diagIp');
    const diagIsp = document.getElementById('diagIsp');
    const diagAsn = document.getElementById('diagAsn');
    const diagCoords = document.getElementById('diagCoords');
    const diagStatusDot = document.getElementById('diagStatusDot');
    const diagStatusText = document.getElementById('diagStatusText');
    const settingsCurrentIpText = document.getElementById('settingsCurrentIpText');
    const diagFlag = document.getElementById('diagFlag');
    
    if (diagCountry) diagCountry.textContent = '正在检测出口中...';
    if (diagRegionCity) diagRegionCity.textContent = '正在获取物理地理定位...';
    if (diagIp) diagIp.textContent = '---';
    if (diagIsp) diagIsp.textContent = '---';
    if (diagAsn) diagAsn.textContent = '---';
    if (diagCoords) diagCoords.textContent = '---';
    
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        
        if (data.ip) {
            if (diagIp) diagIp.textContent = data.ip;
            if (diagCountry) diagCountry.textContent = data.country_name || '未知国家';
            if (diagRegionCity) diagRegionCity.textContent = `${data.region || ''} ${data.city || ''}`;
            if (diagIsp) diagIsp.textContent = data.org || '未知运营商';
            if (diagAsn) diagAsn.textContent = data.asn || '---';
            if (diagCoords) diagCoords.textContent = `${data.latitude || '0'}, ${data.longitude || '0'}`;
            
            const emoji = getFlagEmoji(data.country_code);
            if (diagFlag) diagFlag.textContent = emoji;
            
            if (settingsCurrentIpText) {
                settingsCurrentIpText.textContent = `${emoji} ${data.ip}`;
            }
            
            // 更新核心连接状态状态
            if (diagStatusDot && diagStatusText) {
                if (getConnectionState() === 2) {
                    diagStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_currentColor]';
                    diagStatusText.textContent = '代理已生效';
                } else {
                    diagStatusDot.className = 'w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_currentColor]';
                    diagStatusText.textContent = '直连模式';
                }
            }
        } else {
            throw new Error('IP 获取解析失败');
        }
    } catch (err) {
        console.error('IP Diagnostic error:', err);
        if (diagCountry) diagCountry.textContent = '网络定位失败';
        if (diagRegionCity) diagRegionCity.textContent = '请检查网络连接或节点代理状态';
        if (settingsCurrentIpText) {
            settingsCurrentIpText.textContent = '检测失败';
        }
    } finally {
        isIpDiagnosing = false;
    }
}

export function getFlagEmoji(countryCode) {
    if (!countryCode) return '🌐';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    try {
        return String.fromCodePoint(...codePoints);
    } catch (e) {
        return '🌐';
    }
}

// 2. 流媒体与 AI 解锁测试
export async function testUnlockService(url) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 4000); // 4s 超时限制
    try {
        await fetch(url, {
            method: 'GET',
            mode: 'no-cors',
            signal: controller.signal
        });
        clearTimeout(id);
        return true;
    } catch (e) {
        clearTimeout(id);
        return false;
    }
}

export async function runUnlockDiagnostic() {
    if (isUnlockDiagnosing) return;
    isUnlockDiagnosing = true;

    const btn = document.getElementById('btnRunUnlockDiagnostic');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner animate-spin mr-1"></i> 正在并发检测中...';
    }

    const services = [
        { id: 'ChatGPT', url: 'https://chatgpt.com' },
        { id: 'Claude', url: 'https://claude.ai' },
        { id: 'Netflix', url: 'https://www.netflix.com/title/80018499' },
        { id: 'YouTube', url: 'https://www.youtube.com/premium' },
        { id: 'Disney', url: 'https://www.disneyplus.com' },
        { id: 'Spotify', url: 'https://www.spotify.com' }
    ];
    
    for (const service of services) {
        const dot = document.getElementById(`dot${service.id}`);
        const text = document.getElementById(`text${service.id}`);
        if (dot && text) {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse';
            text.className = 'text-[10px] text-amber-500 font-semibold';
            text.textContent = '正在检测...';
        }
    }
    
    // 并发测试
    await Promise.all(services.map(async (service) => {
        const dot = document.getElementById(`dot${service.id}`);
        const text = document.getElementById(`text${service.id}`);
        if (!dot || !text) return;
        
        const isUnlocked = await testUnlockService(service.url);
        
        if (isUnlocked) {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_currentColor]';
            text.className = 'text-[10px] text-emerald-500 font-semibold';
            text.textContent = '已解锁正常';
        } else {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_4px_currentColor]';
            text.className = 'text-[10px] text-rose-500 font-semibold';
            text.textContent = '未解锁 / 屏蔽';
        }
    }));

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-lightning mr-1"></i> 开始一键解锁检测';
    }
    isUnlockDiagnosing = false;
}

export function initDiagnostics() {
    const overlays = {
        ip: {
            overlay: document.getElementById('ipDiagnosticOverlay'),
            card: document.getElementById('ipDiagnosticCard'),
            openBtn: document.getElementById('btnOpenIpDiagnostic'),
            closeBtn: document.getElementById('closeIpDiagnosticBtn'),
            action: runIpDiagnostic
        },
        unlock: {
            overlay: document.getElementById('unlockDiagnosticOverlay'),
            card: document.getElementById('unlockDiagnosticCard'),
            openBtn: document.getElementById('btnOpenUnlockDiagnostic'),
            closeBtn: document.getElementById('closeUnlockDiagnosticBtn'),
            action: runUnlockDiagnostic
        },
        logs: {
            overlay: document.getElementById('logsDiagnosticOverlay'),
            card: document.getElementById('logsDiagnosticCard'),
            openBtn: document.getElementById('btnOpenLogsDiagnostic'),
            closeBtn: document.getElementById('closeLogsDiagnosticBtn'),
            action: null
        }
    };

    function showDrawer(drawer) {
        if (!drawer.overlay || !drawer.card) return;
        drawer.overlay.classList.remove('pointer-events-none', 'opacity-0');
        drawer.card.classList.remove('scale-95', 'opacity-0');
        if (drawer.action) {
            drawer.action();
        }
    }

    function hideDrawer(drawer) {
        if (!drawer.overlay || !drawer.card) return;
        drawer.overlay.classList.add('pointer-events-none', 'opacity-0');
        drawer.card.classList.add('scale-95', 'opacity-0');
    }

    Object.keys(overlays).forEach(key => {
        const item = overlays[key];
        if (item.openBtn && item.overlay && item.card) {
            item.openBtn.addEventListener('click', () => showDrawer(item));
            if (item.closeBtn) {
                item.closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideDrawer(item);
                });
            }
            item.overlay.addEventListener('click', () => hideDrawer(item));
        }
    });

    // 绑定刷新 IP 诊断
    const btnRefreshIp = document.getElementById('btnRefreshIpDiagnostic');
    if (btnRefreshIp) {
        btnRefreshIp.addEventListener('click', (e) => {
            e.stopPropagation();
            runIpDiagnostic();
        });
    }

    // 绑定一键解锁测试
    const btnRunUnlock = document.getElementById('btnRunUnlockDiagnostic');
    if (btnRunUnlock) {
        btnRunUnlock.addEventListener('click', (e) => {
            e.stopPropagation();
            runUnlockDiagnostic();
        });
    }

    // 独立控制日志暂停与清空
    const btnClearLogs = document.getElementById('btnClearLogsDiagnostic');
    const btnPauseLogs = document.getElementById('btnPauseLogsDiagnostic');
    const logConsole = document.getElementById('logDiagnosticConsole');
    const pauseLogsIcon = document.getElementById('pauseLogsIcon');
    const pauseLogsText = document.getElementById('pauseLogsText');

    if (btnClearLogs && logConsole) {
        btnClearLogs.addEventListener('click', (e) => {
            e.stopPropagation();
            logConsole.innerHTML = '<div class="py-1 text-app-muted">[SYSTEM] 监控终端已清空，继续监听中...</div>';
        });
    }

    if (btnPauseLogs && pauseLogsIcon && pauseLogsText) {
        btnPauseLogs.addEventListener('click', (e) => {
            e.stopPropagation();
            isLogsPaused = !isLogsPaused;
            if (isLogsPaused) {
                pauseLogsIcon.className = 'ph ph-play mr-1';
                pauseLogsText.textContent = '继续监控';
                btnPauseLogs.className = 'flex-1 bg-emerald-500 text-app-base font-semibold py-2 rounded-xl text-xs hover:opacity-90 transition-opacity btn-press';
            } else {
                pauseLogsIcon.className = 'ph ph-pause mr-1';
                pauseLogsText.textContent = '暂停监控';
                btnPauseLogs.className = 'flex-1 bg-app-text text-app-base font-semibold py-2 rounded-xl text-xs hover:opacity-90 transition-opacity btn-press';
            }
        });
    }

    // 3. 监听核心分流日志上报
    if (window.__TAURI__ && window.__TAURI__.event) {
        window.__TAURI__.event.listen('core-log', (event) => {
            if (isLogsPaused) return;
            const logConsole = document.getElementById('logDiagnosticConsole');
            if (logConsole) {
                const div = document.createElement('div');
                div.className = 'py-1 text-app-text transition-all duration-300';
                
                const text = event.payload || '';
                // 智能过滤着色
                if (text.includes('WARN')) {
                    div.className = 'py-1 text-amber-500 font-semibold';
                } else if (text.includes('ERROR') || text.includes('FATAL')) {
                    div.className = 'py-1 text-rose-500 font-bold';
                } else if (text.includes('reject') || text.includes('REJECT') || text.includes('block')) {
                    div.className = 'py-1 text-app-muted opacity-60';
                } else if (text.includes('match') || text.includes('DIRECT') || text.includes('rule')) {
                    div.className = 'py-1 text-sky-500';
                }
                
                div.textContent = text;
                logConsole.appendChild(div);
                
                if (logConsole.children.length > 200) {
                    logConsole.removeChild(logConsole.firstChild);
                }
                
                logConsole.scrollTop = logConsole.scrollHeight;
            }
        });
    }
}
