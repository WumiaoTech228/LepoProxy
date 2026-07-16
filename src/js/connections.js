// --- 实时连接监控 (Active Connections Panel) ---
let connectionsInterval = null;

export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function startConnectionsMonitor() {
    stopConnectionsMonitor();
    
    const connList = document.getElementById('connectionsList');
    const connCount = document.getElementById('connectionsCount');
    const connTotalDownload = document.getElementById('connectionsTotalDownload');
    const connTotalUpload = document.getElementById('connectionsTotalUpload');

    const updateConnections = async () => {
        try {
            const res = await fetch('http://127.0.0.1:9090/connections');
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            
            const data = await res.json();
            
            if (connCount) connCount.textContent = `${data.connections ? data.connections.length : 0}`;
            if (connTotalDownload) connTotalDownload.textContent = formatBytes(data.downloadTotal || 0);
            if (connTotalUpload) connTotalUpload.textContent = formatBytes(data.uploadTotal || 0);
            
            if (connList) {
                if (!data.connections || data.connections.length === 0) {
                    connList.innerHTML = `<div class="py-6 text-center text-app-muted text-[10px] font-semibold">暂无活跃的连接</div>`;
                    return;
                }
                
                let html = `
                    <table class="w-full text-left text-[9px] border-collapse">
                        <thead>
                            <tr class="border-b border-app-border text-app-muted uppercase font-bold tracking-wider">
                                <th class="pb-1.5 font-bold">目标主机</th>
                                <th class="pb-1.5 font-bold text-center w-14">链路</th>
                                <th class="pb-1.5 font-bold text-right w-16">流量 (↑/↓)</th>
                                <th class="pb-1.5 font-bold text-center w-8">断开</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-app-border/30">
                `;
                
                data.connections.forEach(conn => {
                    const host = conn.metadata.host || conn.metadata.destinationIP || '未知';
                    const port = conn.metadata.destinationPort || '';
                    const dest = `${host}:${port}`;
                    
                    const rule = conn.rule || 'Match';
                    const chain = conn.chains && conn.chains.length > 0 ? conn.chains[conn.chains.length - 1] : 'direct';
                    
                    const uploadStr = formatBytes(conn.upload || 0);
                    const downloadStr = formatBytes(conn.download || 0);
                    
                    html += `
                        <tr class="hover:bg-app-hover/50">
                            <td class="py-1 text-app-text truncate max-w-[130px] font-mono select-text" title="${dest}">${dest}</td>
                            <td class="py-1 text-center font-semibold text-app-primary">
                                <div class="truncate max-w-[56px] scale-[0.9] origin-center" title="${chain} [${rule}]">${chain}</div>
                            </td>
                            <td class="py-1 text-right text-app-muted font-mono text-[8px] whitespace-nowrap">
                                <div>${uploadStr}</div>
                                <div class="text-[7px] opacity-70">${downloadStr}</div>
                            </td>
                            <td class="py-1 text-center">
                                <button class="close-conn-btn text-app-muted hover:text-red-500 transition-colors p-0.5" data-id="${conn.id}">
                                    <i class="ph ph-plugs-x text-xs"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
                
                html += `
                        </tbody>
                    </table>
                `;
                connList.innerHTML = html;
                
                // Bind close connection buttons
                connList.querySelectorAll('.close-conn-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const connId = btn.getAttribute('data-id');
                        await closeConnection(connId);
                        updateConnections();
                    });
                });
            }
        } catch (e) {
            if (connList) {
                connList.innerHTML = `<div class="py-6 text-center text-rose-500 text-[10px] font-semibold">连接 Clash 外部控制器失败</div>`;
            }
        }
    };
    
    // Poll connections every 2 seconds
    updateConnections();
    connectionsInterval = setInterval(updateConnections, 2000);
}

export function stopConnectionsMonitor() {
    if (connectionsInterval) {
        clearInterval(connectionsInterval);
        connectionsInterval = null;
    }
}

export async function closeConnection(id) {
    try {
        const res = await fetch(`http://127.0.0.1:9090/connections/${id}`, {
            method: 'DELETE'
        });
        return res.ok;
    } catch (e) {
        console.error('Failed to close connection:', e);
        return false;
    }
}
