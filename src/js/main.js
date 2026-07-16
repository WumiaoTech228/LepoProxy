// --- 主题切换逻辑 ---
const htmlEl = document.documentElement;
const themeBtns = document.querySelectorAll('.theme-btn');

// 初始主题：优先从 localStorage 读取，否则默认跟随系统的系统深色/浅色偏好
const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
let currentTheme = localStorage.getItem('lepo_theme') || (systemDarkQuery.matches ? 'dark' : 'light');

function setTheme(theme) {
    currentTheme = theme;
    if (theme === 'dark') {
        htmlEl.classList.add('dark');
    } else {
        htmlEl.classList.remove('dark');
    }
    localStorage.setItem('lepo_theme', theme);
    updateThemeUI();
}

// 初始化应用主题
setTheme(currentTheme);

// 绑定用户手动点击按钮切换
themeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const selectedTheme = e.currentTarget.getAttribute('data-theme');
        if (selectedTheme === currentTheme) return;
        setTheme(selectedTheme);
    });
});

// 监听系统侧更改：如果操作系统深浅色更改，则立刻跟随系统改变
systemDarkQuery.addEventListener('change', (e) => {
    const newTheme = e.matches ? 'dark' : 'light';
    setTheme(newTheme);
});

function updateThemeUI() {
    themeBtns.forEach(b => {
        if (b.getAttribute('data-theme') === currentTheme) {
            b.classList.add('bg-app-surface', 'text-app-text', 'shadow-sm', 'border-app-border');
            b.classList.remove('text-app-muted', 'border-transparent');
        } else {
            b.classList.remove('bg-app-surface', 'text-app-text', 'shadow-sm', 'border-app-border');
            b.classList.add('text-app-muted', 'border-transparent');
        }
    });
}

// 初始化执行，确保页面首屏与系统偏好完美契合
setTheme(currentTheme);


// --- 核心连接逻辑 ---
let connectionState = 0; // 0: 未连, 1: 连接中, 2: 已连
const mainBtn = document.getElementById('mainBtn');
const btnFill = document.getElementById('btnFill');
const loadingWrapper = document.getElementById('loadingWrapper');
const iconWrapper = document.getElementById('iconWrapper');
const btnIcon = document.getElementById('btnIcon');
const statusTitle = document.getElementById('statusTitle');
const pingDot = document.getElementById('pingDot');
const nodeSwiperContainer = document.getElementById('nodeSwiperContainer');

mainBtn.addEventListener('click', async () => {
    if (connectionState === 0) {
        if (!rawNodesJson || rawNodesJson === '[]') {
            showToast('请先导入合法的订阅节点！', 'warning');
            return;
        }

        connectionState = 1;
        updateUIState();
        try {
            const tunToggle = document.getElementById('tunToggle');
            const tunEnabled = tunToggle ? tunToggle.checked : false;

            // 1. 编译最新的配置文件，注入当前选中的活跃节点、路由分流模式以及自定义端口
            const activeNode = currentNodeIndex === 0 ? "Auto" : realNodes[currentNodeIndex].name;
            const portEl = document.getElementById('localPortInput');
            const localPort = portEl ? parseInt(portEl.value) || 2080 : 2080;
            const configJson = await window.__TAURI__.core.invoke('generate_singbox_config', {
                nodesJson: rawNodesJson,
                mode: currentRoutingMode,
                activeNode: activeNode,
                localPort: localPort,
                tunEnabled: tunEnabled,
                ipv6Enabled: ipv6Enabled,
                lanEnabled: lanEnabled
            });

            // 2. 调用后端拉起核心服务并加载系统设置
            await window.__TAURI__.core.invoke('start_proxy', {
                configJson: configJson,
                systemProxyEnabled: systemProxyEnabled,
                localPort: localPort,
                tunEnabled: tunEnabled
            });

            connectionState = 2;
            updateUIState();
        } catch (e) {
            showConfirm('连接失败', '连接失败: ' + e, true);
            connectionState = 0;
            updateUIState();
        }
    } else {
        try {
            // 3. 彻底释放网络与杀死核心服务
            await window.__TAURI__.core.invoke('stop_proxy');
        } catch (e) {
            console.error('停止代理服务失败:', e);
        }
        connectionState = 0;
        updateUIState();
    }
});

// --- 连接时长计时器管理 ---
let connectionTimer = null;
let connectionStartTime = 0;

function startConnectionTimer() {
    stopConnectionTimer();
    connectionStartTime = Date.now();
    const durationEl = document.getElementById('connectionDuration');
    const detailsEl = document.getElementById('connectionDetails');
    const nodeDetailEl = document.getElementById('activeNodeDetail');
    
    if (detailsEl) {
        detailsEl.classList.remove('hidden');
        detailsEl.classList.add('flex');
    }
    
    if (nodeDetailEl) {
        const activeNodeName = currentNodeIndex === 0 ? "Auto (自动选路)" : (realNodes[currentNodeIndex] ? realNodes[currentNodeIndex].name : "未知节点");
        nodeDetailEl.textContent = activeNodeName;
    }
    
    connectionTimer = setInterval(() => {
        const diff = Date.now() - connectionStartTime;
        const secs = Math.floor(diff / 1000) % 60;
        const mins = Math.floor(diff / 60000) % 60;
        const hours = Math.floor(diff / 3600000);
        
        const pad = (num) => String(num).padStart(2, '0');
        if (durationEl) {
            durationEl.textContent = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
        }
    }, 1000);
}

function stopConnectionTimer() {
    if (connectionTimer) {
        clearInterval(connectionTimer);
        connectionTimer = null;
    }
    const detailsEl = document.getElementById('connectionDetails');
    const durationEl = document.getElementById('connectionDuration');
    if (detailsEl) {
        detailsEl.classList.add('hidden');
        detailsEl.classList.remove('flex');
    }
    if (durationEl) {
        durationEl.textContent = '00:00:00';
    }
}

function updateUIState() {
    if (!btnFill || !loadingWrapper || !iconWrapper) return; // 防御代码，防止渲染报错

    if (connectionState === 0) {
        // 未连接：空心状态
        stopConnectionTimer();
        mainBtn.classList.remove('border-transparent', 'border-app-text');
        btnFill.style.transform = 'translateY(101%)';

        loadingWrapper.style.opacity = '0';
        loadingWrapper.style.transform = 'scale(0.5)';

        iconWrapper.style.opacity = '1';
        iconWrapper.style.transform = 'scale(1)';
        btnIcon.className = 'ph ph-power text-[42px] text-app-muted transition-colors duration-300 group-hover:text-app-text';

        statusTitle.textContent = '未连接';
        statusTitle.className = 'text-[28px] font-semibold text-app-text tracking-tight transition-colors duration-300';
        pingDot.className = 'w-1.5 h-1.5 rounded-full bg-app-muted transition-colors duration-300 flex-shrink-0';

    } else if (connectionState === 1) {
        // 连接中：展示克制的自旋动画
        stopConnectionTimer();
        mainBtn.classList.remove('border-transparent', 'border-app-text');
        btnFill.style.transform = 'translateY(101%)';

        iconWrapper.style.opacity = '0';
        iconWrapper.style.transform = 'scale(0.5)';

        loadingWrapper.style.opacity = '1';
        loadingWrapper.style.transform = 'scale(1)';

        statusTitle.textContent = '寻找最佳节点...';
        pingDot.className = 'w-1.5 h-1.5 rounded-full bg-app-text transition-colors duration-300 animate-pulse flex-shrink-0 opacity-50'; // 极简灰度闪烁

    } else if (connectionState === 2) {
        // 已连接：展示高亮对勾，并激活墨水填充
        startConnectionTimer();
        mainBtn.classList.remove('border-transparent');
        mainBtn.classList.add('border-app-text'); // 边框变为高亮黑/白
        btnFill.style.transform = 'translateY(0)'; // 墨水向上填满

        loadingWrapper.style.opacity = '0';
        loadingWrapper.style.transform = 'scale(0.5)';

        setTimeout(() => {
            iconWrapper.style.opacity = '1';
            iconWrapper.style.transform = 'scale(1)';
            // 使用 text-app-base 与填充背景形成高对比度
            btnIcon.className = 'ph ph-check text-[42px] text-app-base transition-colors duration-300';
        }, 150);

        statusTitle.textContent = '已连接';
        statusTitle.className = 'text-[28px] font-semibold text-app-text tracking-tight transition-colors duration-300';
        pingDot.className = 'w-1.5 h-1.5 rounded-full bg-app-text transition-colors duration-300 flex-shrink-0 shadow-[0_0_8px_currentColor] opacity-100';
    }
}

// --- 节点数据与切换逻辑 ---
let subscriptionsData = [];
let currentSubIndex = parseInt(localStorage.getItem('lepo_current_sub_index')) || 0;

function ensureSubNodeTypes(sub) {
    if (!sub || !sub.nodes) return;
    let outbounds = [];
    try {
        outbounds = JSON.parse(sub.rawJson || '[]');
    } catch (e) {
        console.error('ensureSubNodeTypes JSON.parse error:', e);
    }
    
    const tagToType = {};
    if (Array.isArray(outbounds)) {
        outbounds.forEach(out => {
            if (out.tag && out.type) {
                tagToType[out.tag] = out.type;
            }
        });
    }

    sub.nodes.forEach((node, idx) => {
        if (idx === 0) {
            node.type = 'auto';
            return;
        }
        if (!node.type) {
            node.type = tagToType[node.name] || 'unknown';
        }
    });
}

function loadSubscriptions() {
    let saved = localStorage.getItem('lepo_subscriptions');
    if (saved) {
        try {
            subscriptionsData = JSON.parse(saved);
            
            // 彻底滤除/清理旧 ID 'built-in' 项
            subscriptionsData = subscriptionsData.filter(s => s.id !== 'built-in');
            
            // 确保双路内置在线订阅源 'built-in-1' 与 'built-in-2' 始终存在
            let hasBuiltIn1 = subscriptionsData.some(s => s.id === 'built-in-1');
            let hasBuiltIn2 = subscriptionsData.some(s => s.id === 'built-in-2');
            
            if (!hasBuiltIn1) {
                subscriptionsData.unshift({
                    id: 'built-in-1',
                    name: '免费节点1',
                    url: 'https://github.com/Au1rxx/free-vpn-subscriptions/raw/main/output/clash.yaml',
                    nodes: [
                        { name: 'Default - Auto', ping: '---', color: 'bg-app-text', pinned: false, type: 'auto' }
                    ],
                    rawJson: '[]',
                    traffic: null,
                    interval: 0,
                    lastUpdate: Date.now()
                });
            }
            
            if (!hasBuiltIn2) {
                subscriptionsData.push({
                    id: 'built-in-2',
                    name: '免费节点2',
                    url: 'https://raw.githubusercontent.com/ebrasha/free-v2ray-public-list/refs/heads/main/all_extracted_configs.txt',
                    nodes: [
                        { name: 'Default - Auto', ping: '---', color: 'bg-app-text', pinned: false, type: 'auto' }
                    ],
                    rawJson: '[]',
                    traffic: null,
                    interval: 0,
                    lastUpdate: Date.now()
                });
            }
            
            // 强顺序排列（内置节点 1 与 2 置顶于索引 0 和 1，自定义订阅依次向后）
            const b1 = subscriptionsData.find(s => s.id === 'built-in-1');
            const b2 = subscriptionsData.find(s => s.id === 'built-in-2');
            const others = subscriptionsData.filter(s => s.id !== 'built-in-1' && s.id !== 'built-in-2');
            subscriptionsData = [b1, b2, ...others];
            
            subscriptionsData.forEach(ensureSubNodeTypes);
            saveSubscriptions();
            return;
        } catch (e) {
            console.error('Failed to parse lepo_subscriptions:', e);
        }
    }
    
    // 降级与全新初始化逻辑
    const legacyUrl = localStorage.getItem('subscriptionUrl');
    const legacyNodes = localStorage.getItem('subscriptionNodes');
    const legacyRaw = localStorage.getItem('subscriptionRawJson');
    const legacyTraffic = localStorage.getItem('subscriptionTraffic');
    const legacyInterval = localStorage.getItem('autoUpdateInterval');
    const legacyLastUpdate = localStorage.getItem('lastUpdateTimestamp');

    subscriptionsData = [
        {
            id: 'built-in-1',
            name: '免费节点1',
            url: 'https://github.com/Au1rxx/free-vpn-subscriptions/raw/main/output/clash.yaml',
            nodes: [
                { name: 'Default - Auto', ping: '---', color: 'bg-app-text', pinned: false, type: 'auto' }
            ],
            rawJson: '[]',
            traffic: null,
            interval: 0,
            lastUpdate: Date.now()
        },
        {
            id: 'built-in-2',
            name: '免费节点2',
            url: 'https://raw.githubusercontent.com/ebrasha/free-v2ray-public-list/refs/heads/main/all_extracted_configs.txt',
            nodes: [
                { name: 'Default - Auto', ping: '---', color: 'bg-app-text', pinned: false, type: 'auto' }
            ],
            rawJson: '[]',
            traffic: null,
            interval: 0,
            lastUpdate: Date.now()
        },
        {
            id: 'custom-sub',
            name: '自定义订阅',
            url: legacyUrl || '',
            nodes: legacyNodes ? JSON.parse(legacyNodes) : [
                { name: 'Default - Auto', ping: '---', color: 'bg-app-text', pinned: false, type: 'auto' }
            ],
            rawJson: legacyRaw || '[]',
            traffic: legacyTraffic ? JSON.parse(legacyTraffic) : null,
            interval: parseInt(legacyInterval) || 0,
            lastUpdate: parseInt(legacyLastUpdate) || Date.now()
        }
    ];
    subscriptionsData.forEach(ensureSubNodeTypes);
    saveSubscriptions();
}

function saveSubscriptions() {
    localStorage.setItem('lepo_subscriptions', JSON.stringify(subscriptionsData));
}

// Load subscriptions immediately
loadSubscriptions();
if (currentSubIndex >= subscriptionsData.length) {
    currentSubIndex = 0;
}

let realNodes = subscriptionsData[currentSubIndex] ? subscriptionsData[currentSubIndex].nodes : [];
let rawNodesJson = subscriptionsData[currentSubIndex] ? subscriptionsData[currentSubIndex].rawJson : '[]';
let currentNodeIndex = 0;
let isPingTesting = false;

// 订阅状态与系统代理状态
let systemProxyEnabled = localStorage.getItem('systemProxyEnabled') !== 'false'; // 默认开启
let ipv6Enabled = localStorage.getItem('ipv6Enabled') === 'true'; // 默认关闭
let lanEnabled = localStorage.getItem('lanEnabled') === 'true'; // 默认关闭
let autoUpdateInterval = parseInt(localStorage.getItem('autoUpdateInterval')) || 0; // 默认 0，代表不自动更新

let sortState = 'default'; // 'default', 'latency', 'alphabet'
let searchQuery = '';

async function renderNodeList() {
    const container = document.getElementById('nodeListItems');
    if (!container) return;
    container.innerHTML = '';

    if (!realNodes || realNodes.length === 0) return;

    // First node is always 'Default - Auto'
    const autoNode = realNodes[0];
    
    // The rest of the nodes are index 1 to length-1
    const nodeItems = realNodes.slice(1);

    // Apply filtering
    let filteredItems = nodeItems.filter(node => {
        if (!searchQuery) return true;
        return node.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Apply sorting
    if (sortState === 'latency') {
        filteredItems.sort((a, b) => {
            const aPinned = a.pinned || false;
            const bPinned = b.pinned || false;
            if (aPinned !== bPinned) {
                return aPinned ? -1 : 1;
            }
            
            const getLat = (n) => {
                if (n.ping === '---' || n.ping === '测速中...') return 999999;
                if (n.ping === '超时') return 888888;
                const ms = parseInt(n.ping);
                return isNaN(ms) ? 999999 : ms;
            };
            return getLat(a) - getLat(b);
        });
    } else if (sortState === 'alphabet') {
        filteredItems.sort((a, b) => {
            const aPinned = a.pinned || false;
            const bPinned = b.pinned || false;
            if (aPinned !== bPinned) {
                return aPinned ? -1 : 1;
            }
            return a.name.localeCompare(b.name, 'zh');
        });
    } else {
        // Default sorting
        filteredItems.sort((a, b) => {
            const aPinned = a.pinned || false;
            const bPinned = b.pinned || false;
            if (aPinned !== bPinned) {
                return aPinned ? -1 : 1;
            }
            return nodeItems.indexOf(a) - nodeItems.indexOf(b);
        });
    }

    const finalDisplayList = [];
    if (autoNode && (!searchQuery || autoNode.name.toLowerCase().includes(searchQuery.toLowerCase()))) {
        finalDisplayList.push({ node: autoNode, originalIndex: 0 });
    }
    
    filteredItems.forEach(node => {
        const originalIndex = realNodes.indexOf(node);
        finalDisplayList.push({ node, originalIndex });
    });

    finalDisplayList.forEach(({ node, originalIndex }) => {
        const isActive = originalIndex === currentNodeIndex;
        const isAuto = originalIndex === 0;
        const isPinned = node.pinned || false;
        
        const div = document.createElement('div');
        div.className = `flex justify-between items-center p-2 rounded-xl cursor-pointer transition-colors relative group border ${
            isActive ? 'bg-app-primary/10 border-app-primary/30 active-node-indicator' : 'hover:bg-app-base border-transparent'
        } ${isPinned && !isAuto ? 'pinned-node-card' : ''}`;

        let pingDisplay = node.ping || '---';
        let pillColorClasses = 'bg-app-muted/5 text-app-muted border-app-border/40';
        if (pingDisplay !== '---' && pingDisplay !== '测速中...') {
            if (pingDisplay === '超时') {
                pillColorClasses = 'bg-rose-500/10 text-rose-500 border-rose-500/20 font-semibold';
            } else {
                const ms = parseInt(pingDisplay);
                if (!isNaN(ms)) {
                    if (ms < 100) {
                        pillColorClasses = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-semibold';
                    } else if (ms < 300) {
                        pillColorClasses = 'bg-amber-500/10 text-amber-500 border-amber-500/20 font-semibold';
                    } else {
                        pillColorClasses = 'bg-rose-500/10 text-rose-500 border-rose-500/20';
                    }
                }
            }
        }

        const pinStarHtml = (isPinned && !isAuto) ? `
            <i class="ph ph-star-fill text-amber-500 text-[10px] flex-shrink-0 ml-1" title="已置顶"></i>
        ` : '';

        const actionsHtml = isAuto ? '' : `
            <div class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 hidden group-hover:flex z-10 rounded-full p-0.5 node-actions-capsule backdrop-blur-sm transition-all duration-300">
                <button class="pin-node-btn w-7 h-7 flex items-center justify-center rounded-full text-app-muted hover:text-amber-500 hover:bg-amber-500/10 transition-all btn-press" title="${isPinned ? '取消置顶' : '置顶节点'}" data-index="${originalIndex}">
                    <i class="ph ${isPinned ? 'ph-star-fill text-amber-500' : 'ph-star'}"></i>
                </button>
                <button class="share-node-btn w-7 h-7 flex items-center justify-center rounded-full text-app-muted hover:text-app-text hover:bg-app-hover transition-all btn-press" title="复制分享链接" data-index="${originalIndex}">
                    <i class="ph ph-copy"></i>
                </button>
                <button class="edit-node-btn w-7 h-7 flex items-center justify-center rounded-full text-app-muted hover:text-app-text hover:bg-app-hover transition-all btn-press" title="编辑节点" data-index="${originalIndex}">
                    <i class="ph ph-pencil-simple"></i>
                </button>
                <button class="delete-node-btn w-7 h-7 flex items-center justify-center rounded-full text-app-muted hover:text-red-500 hover:bg-red-500/10 transition-all btn-press" title="删除节点" data-index="${originalIndex}">
                    <i class="ph ph-trash"></i>
                </button>
            </div>
        `;

        let displayType = '';
        if (node.type && node.type !== 'auto') {
            displayType = node.type.toLowerCase() === 'shadowsocks' ? 'SS' : node.type.toUpperCase();
        }
        const protoBadgeHtml = displayType ? `
            <span class="text-[7px] bg-app-surface border border-app-border text-app-muted px-1 rounded font-bold select-none whitespace-nowrap scale-90">${displayType}</span>
        ` : '';

        div.innerHTML = `
            <div class="flex items-center gap-2 min-w-0 flex-1 pl-1.5 pr-2 transition-all duration-200 group-hover:pr-[124px]">
                <div class="w-2 h-2 rounded-full ${node.color || 'bg-app-text'} ${isActive ? 'shadow-[0_0_8px_currentColor]' : ''} flex-shrink-0"></div>
                <span class="${isActive ? 'text-app-primary font-semibold' : 'text-app-text'} text-[11px] truncate flex-1">${node.name}</span>
                ${protoBadgeHtml}
                ${pinStarHtml}
            </div>
            <div class="flex items-center flex-shrink-0 transition-all duration-200 group-hover:w-0 group-hover:opacity-0 overflow-hidden w-[62px] justify-end pr-1.5">
                <span class="px-2 py-0.5 rounded-full text-[9px] border ${pillColorClasses} font-mono select-none transition-all duration-300 w-[56px] text-center whitespace-nowrap overflow-hidden">${pingDisplay}</span>
            </div>
            ${actionsHtml}
        `;

        div.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            currentNodeIndex = originalIndex;
            updateNodeText('next');
            closeNodeList();
            renderNodeList();
        });

        if (!isAuto) {
            const pinBtn = div.querySelector('.pin-node-btn');
            if (pinBtn) {
                pinBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    togglePinNode(originalIndex);
                });
            }

            const shareBtn = div.querySelector('.share-node-btn');
            if (shareBtn) {
                shareBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    copyNodeShareLink(originalIndex);
                });
            }

            const editBtn = div.querySelector('.edit-node-btn');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openNodeEditForm(originalIndex);
                });
            }

            const deleteBtn = div.querySelector('.delete-node-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteNodeFromSub(originalIndex);
                });
            }
        }

        container.appendChild(div);
    });
}

function togglePinNode(originalIndex) {
    const sub = subscriptionsData[currentSubIndex];
    if (!sub || !sub.nodes || !sub.nodes[originalIndex]) return;
    
    sub.nodes[originalIndex].pinned = !sub.nodes[originalIndex].pinned;
    saveSubscriptions();
    renderNodeList();
}

function updateNodeText(direction) {
    if (currentNodeIndex >= realNodes.length) {
        currentNodeIndex = 0;
    }
    const nodeProtoBadge = document.getElementById('nodeProtoBadge');
    
    nodeText.style.transform = `translateX(${direction === 'next' ? '-10px' : '10px'})`;
    nodeText.style.opacity = '0';
    if (nodeProtoBadge) {
        nodeProtoBadge.style.transform = `translateX(${direction === 'next' ? '-10px' : '10px'}) scale(0.9)`;
        nodeProtoBadge.style.opacity = '0';
    }

    setTimeout(() => {
        const activeNode = realNodes[currentNodeIndex];
        nodeText.textContent = activeNode ? activeNode.name : 'Default - Auto';
        
        if (nodeProtoBadge) {
            if (activeNode && activeNode.type && activeNode.type !== 'auto') {
                let displayType = activeNode.type.toLowerCase() === 'shadowsocks' ? 'SS' : activeNode.type.toUpperCase();
                nodeProtoBadge.textContent = displayType;
                nodeProtoBadge.classList.remove('hidden');
            } else {
                nodeProtoBadge.classList.add('hidden');
            }
        }
        
        nodeText.style.transform = `translateX(${direction === 'next' ? '10px' : '-10px'})`;
        if (nodeProtoBadge) {
            nodeProtoBadge.style.transform = `translateX(${direction === 'next' ? '10px' : '-10px'}) scale(0.9)`;
        }

        setTimeout(() => {
            nodeText.style.transform = 'translateX(0)';
            nodeText.style.opacity = '1';
            if (nodeProtoBadge) {
                nodeProtoBadge.style.transform = 'translateX(0) scale(0.9)';
                nodeProtoBadge.style.opacity = '1';
            }
        }, 50);
    }, 150);
    
    syncTrayNodes();
    updateSingboxConfig().then(() => {
        hotReloadProxyIfConnected();
    });
}

// 左右按钮点击切换
document.getElementById('prevNodeBtn').addEventListener('click', (e) => {
    e.stopPropagation(); // 阻止双击误判
    currentNodeIndex = (currentNodeIndex - 1 + realNodes.length) % realNodes.length;
    updateNodeText('prev');
});
document.getElementById('nextNodeBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    currentNodeIndex = (currentNodeIndex + 1) % realNodes.length;
    updateNodeText('next');
});

// 鼠标拖拽模拟滑动
let startX = 0; let isDragging = false; let hasMoved = false;
nodeSwiperContainer.addEventListener('mousedown', (e) => {
    startX = e.clientX; isDragging = true; hasMoved = false;
});
document.addEventListener('mousemove', (e) => {
    if (isDragging && Math.abs(e.clientX - startX) > 5) hasMoved = true;
});
document.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    if (hasMoved) {
        let diffX = e.clientX - startX;
        if (diffX > 30) { document.getElementById('prevNodeBtn').click(); }
        else if (diffX < -30) { document.getElementById('nextNodeBtn').click(); }
    }
});

// --- 节点列表模态框呼出 ---
const nodeListOverlay = document.getElementById('nodeListOverlay');
const nodeListCard = document.getElementById('nodeListCard');

function openNodeList() {
    if (typeof closeSettings === 'function') closeSettings(); // 避免层叠 z-index 遮挡，先关掉设置模态框
    if (typeof closeSubs === 'function') closeSubs(); // 避免层叠，关掉订阅管理模态框
    renderNodeList(); // 每次打开时刷新状态
    nodeListOverlay.classList.remove('opacity-0', 'pointer-events-none');
    nodeListCard.classList.remove('scale-95', 'opacity-0');
    nodeListCard.classList.add('scale-100', 'opacity-100');
}
function closeNodeList() {
    nodeListCard.classList.remove('scale-100', 'opacity-100');
    nodeListCard.classList.add('scale-95', 'opacity-0');
    nodeListOverlay.classList.add('opacity-0', 'pointer-events-none');
}

// 双击监听
nodeSwiperContainer.addEventListener('dblclick', (e) => {
    // 防止点击左右按钮时触发
    if (e.target.closest('button')) return;
    openNodeList();
});
document.getElementById('closeNodeListBtn').addEventListener('click', closeNodeList);
nodeListOverlay.addEventListener('click', (e) => { if (e.target === nodeListOverlay) closeNodeList(); });


// --- 路由模式滑块 (Phase 3.2) ---
let currentRoutingMode = 'rule'; // rule, global, direct
const tabs = document.querySelectorAll('.tab-btn');
const tabIndicator = document.getElementById('tabIndicator');
tabs.forEach(tab => {
    tab.addEventListener('click', async (e) => {
        const index = e.target.getAttribute('data-index');
        tabIndicator.style.transform = `translateX(${index * 100}%)`;
        tabs.forEach(t => { t.classList.remove('text-app-text'); t.classList.add('text-app-muted'); });
        e.target.classList.remove('text-app-muted'); e.target.classList.add('text-app-text');

        if (index === '0') {
            currentRoutingMode = 'rule';
        } else if (index === '1') {
            currentRoutingMode = 'global';
        } else if (index === '2') {
            currentRoutingMode = 'direct';
        }

        console.log(`切换路由模式为: ${currentRoutingMode}`);
        await updateSingboxConfig();
        await hotReloadProxyIfConnected();
    });
});


// --- 设置页面浮层 ---
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsCard = document.getElementById('settingsCard');

function openSettings() {
    if (typeof closeSubs === 'function') closeSubs(); // 避免层叠，关掉订阅管理模态框
    if (typeof closeNodeList === 'function') closeNodeList(); // 避免层叠，关掉节点选择模态框
    settingsOverlay.classList.remove('opacity-0', 'pointer-events-none');
    settingsCard.classList.remove('scale-95', 'opacity-0');
    settingsCard.classList.add('scale-100', 'opacity-100');
}
function closeSettings() {
    settingsCard.classList.remove('scale-100', 'opacity-100');
    settingsCard.classList.add('scale-95', 'opacity-0');
    settingsOverlay.classList.add('opacity-0', 'pointer-events-none');
}

document.getElementById('settingsBtn').addEventListener('click', openSettings);
document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) closeSettings(); });


// --- 订阅源管理独立面板 ---
const subsOverlay = document.getElementById('subsOverlay');
const subsCard = document.getElementById('subsCard');

function openSubs() {
    if (typeof closeSettings === 'function') closeSettings(); // 避免层叠，先关掉设置模态框
    if (typeof closeNodeList === 'function') closeNodeList(); // 避免层叠，先关掉节点列表模态框
    renderSubscriptionsList();
    subsOverlay.classList.remove('opacity-0', 'pointer-events-none');
    subsCard.classList.remove('scale-95', 'opacity-0');
    subsCard.classList.add('scale-100', 'opacity-100');
}
function closeSubs() {
    subsCard.classList.remove('scale-100', 'opacity-100');
    subsCard.classList.add('scale-95', 'opacity-0');
    subsOverlay.classList.add('opacity-0', 'pointer-events-none');
    hideSubscriptionForm();
}

document.getElementById('subsBtn').addEventListener('click', openSubs);
document.getElementById('closeSubsBtn').addEventListener('click', closeSubs);
subsOverlay.addEventListener('click', (e) => { if (e.target === subsOverlay) closeSubs(); });



// --- 开机自启级联菜单联动 ---
const autoBootToggle = document.getElementById('autoBootToggle');
const bootSubOptions = document.getElementById('bootSubOptions');
const silentBootToggle = document.getElementById('silentBootToggle');
const autoConnectToggle = document.getElementById('autoConnectToggle');

// 从 localStorage 读取并恢复配置项状态
const isAutoBoot = localStorage.getItem('autoBootEnabled') === 'true';
const isSilentBoot = localStorage.getItem('silentBootEnabled') !== 'false'; // 默认勾选
const isAutoConnect = localStorage.getItem('autoConnectEnabled') === 'true';

if (autoBootToggle) {
    autoBootToggle.checked = isAutoBoot;
    if (isAutoBoot) {
        bootSubOptions.classList.remove('opacity-30', 'pointer-events-none');
    } else {
        bootSubOptions.classList.add('opacity-30', 'pointer-events-none');
    }
}
if (silentBootToggle) {
    silentBootToggle.checked = isSilentBoot;
}
if (autoConnectToggle) {
    autoConnectToggle.checked = isAutoConnect;
}

// 统一写注册表与本地存储更新函数
async function updateAutostartRegistry() {
    const isEnabled = autoBootToggle ? autoBootToggle.checked : false;
    const isMinimized = silentBootToggle ? silentBootToggle.checked : true;
    
    localStorage.setItem('autoBootEnabled', isEnabled);
    localStorage.setItem('silentBootEnabled', isMinimized);
    
    if (window.__TAURI__ && window.__TAURI__.core) {
        try {
            await window.__TAURI__.core.invoke('set_autostart_enabled', { 
                enabled: isEnabled, 
                isMinimized: isMinimized 
            });
            console.log('Autostart registry updated. Enabled:', isEnabled, ', Minimized:', isMinimized);
        } catch (err) {
            console.error('Failed to set autostart registry key:', err);
        }
    }
}

if (autoBootToggle) {
    autoBootToggle.addEventListener('change', async (e) => {
        const checked = e.target.checked;
        if (checked) {
            bootSubOptions.classList.remove('opacity-30', 'pointer-events-none');
        } else {
            bootSubOptions.classList.add('opacity-30', 'pointer-events-none');
        }
        await updateAutostartRegistry();
    });
}

if (silentBootToggle) {
    silentBootToggle.addEventListener('change', async () => {
        await updateAutostartRegistry();
    });
}

if (autoConnectToggle) {
    autoConnectToggle.addEventListener('change', (e) => {
        localStorage.setItem('autoConnectEnabled', e.target.checked);
    });
}

// --- 网络与协议高级开关联动 ---
const systemProxyToggle = document.getElementById('systemProxyToggle');
if (systemProxyToggle) {
    systemProxyToggle.checked = systemProxyEnabled;
    systemProxyToggle.addEventListener('change', async (e) => {
        systemProxyEnabled = e.target.checked;
        localStorage.setItem('systemProxyEnabled', systemProxyEnabled);
        
        // 同步通知托盘
        if (window.__TAURI__ && window.__TAURI__.core) {
            try {
                await window.__TAURI__.core.invoke('set_tray_checked', { id: 'system-proxy', checked: systemProxyEnabled });
            } catch (err) {
                console.error('Failed to sync tray checkbox:', err);
            }
        }
        
        // 如果当前已经连接，立即热更新系统代理状态
        if (connectionState === 2) {
            const portEl = document.getElementById('localPortInput');
            const localPort = portEl ? parseInt(portEl.value) || 2080 : 2080;
            if (window.__TAURI__ && window.__TAURI__.core) {
                try {
                    await window.__TAURI__.core.invoke('set_system_proxy_enabled', { enabled: systemProxyEnabled, localPort: localPort });
                    console.log('System proxy updated dynamically:', systemProxyEnabled);
                } catch (err) {
                    console.error('Failed to hot-toggle system proxy:', err);
                }
            }
        }
    });
}

const ipv6Toggle = document.getElementById('ipv6Toggle');
if (ipv6Toggle) {
    ipv6Toggle.checked = ipv6Enabled;
    ipv6Toggle.addEventListener('change', async (e) => {
        ipv6Enabled = e.target.checked;
        localStorage.setItem('ipv6Enabled', ipv6Enabled);
        await updateSingboxConfig();
        await hotReloadProxyIfConnected();
    });
}

const lanToggle = document.getElementById('lanToggle');
if (lanToggle) {
    lanToggle.checked = lanEnabled;
    lanToggle.addEventListener('change', async (e) => {
        lanEnabled = e.target.checked;
        localStorage.setItem('lanEnabled', lanEnabled);
        await updateSingboxConfig();
        await hotReloadProxyIfConnected();
    });
}

// 顶栏关闭按钮：直接将窗口隐藏至系统托盘，不触发任何代理关闭/开启动画，保留托盘运行
document.getElementById('exitBtn').addEventListener('click', async () => {
    if (window.__TAURI__ && window.__TAURI__.core) {
        try {
            await window.__TAURI__.core.invoke('hide_window');
        } catch (e) {
            console.error('Failed to hide window:', e);
        }
    }
});

// 彻底禁用系统右键菜单 (WebView 默认右键)
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
}, { capture: true });

// 彻底禁用开发者工具快捷键 (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+R 刷新)
document.addEventListener('keydown', (e) => {
    if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'R') ||
        e.key === 'F5'
    ) {
        e.preventDefault();
    }
}, { capture: true });

// --- 自定义端口号微调 (支持点击 & 鼠标滚轮滑动) ---
const portInput = document.getElementById('localPortInput');
const portIncBtn = document.getElementById('portIncBtn');
const portDecBtn = document.getElementById('portDecBtn');

if (portInput && portIncBtn && portDecBtn) {
    const minPort = 1;
    const maxPort = 65535;

    function adjustPort(delta) {
        let val = parseInt(portInput.value) || 2080;
        val = Math.max(minPort, Math.min(maxPort, val + delta));
        portInput.value = val;
        portInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    portIncBtn.addEventListener('click', (e) => {
        e.preventDefault();
        adjustPort(1);
    });
    portDecBtn.addEventListener('click', (e) => {
        e.preventDefault();
        adjustPort(-1);
    });

    // 鼠标滚轮滑动更改 (支持滚动)
    portInput.addEventListener('wheel', (e) => {
        e.preventDefault(); // 阻止页面滚动
        if (e.deltaY < 0) {
            adjustPort(1);
        } else if (e.deltaY > 0) {
            adjustPort(-1);
        }
    }, { passive: false });

    portInput.addEventListener('change', () => {
        let val = parseInt(portInput.value);
        if (isNaN(val)) val = 2080;
        val = Math.max(minPort, Math.min(maxPort, val));
        portInput.value = val;
    });
}

// --- 系统托盘双向数据同步方法 ---
async function syncTrayNodes() {
    if (window.__TAURI__ && window.__TAURI__.core) {
        if (!realNodes || realNodes.length === 0) return;
        const nodeNames = realNodes.slice(1).map(n => n.name);
        const activeIndex = currentNodeIndex === 0 ? 999 : (currentNodeIndex - 1);
        try {
            await window.__TAURI__.core.invoke('update_tray_nodes', { nodes: nodeNames, activeIndex });
        } catch (e) {
            console.error('Failed to sync nodes to tray:', e);
        }
    }
}

async function syncTraySubs() {
    if (window.__TAURI__ && window.__TAURI__.core) {
        const subs = subscriptionsData.map(sub => sub.name);
        try {
            await window.__TAURI__.core.invoke('update_tray_subs', { subs: subs, activeIndex: currentSubIndex });
        } catch (e) {
            console.error('Failed to sync subs to tray:', e);
        }
    }
}

async function syncTraySettings() {
    if (window.__TAURI__ && window.__TAURI__.core) {
        const tunToggle = document.getElementById('tunToggle');
        const tunChecked = tunToggle ? tunToggle.checked : false;
        try {
            await window.__TAURI__.core.invoke('set_tray_checked', { id: 'system-proxy', checked: systemProxyEnabled });
            await window.__TAURI__.core.invoke('set_tray_checked', { id: 'tun-proxy', checked: tunChecked });
        } catch (e) {
            console.error('Failed to sync settings to tray:', e);
        }
    }
}

// --- 订阅选择 UI 联动与面板切换 ---
function selectSubscription(index) {
    if (index === currentSubIndex) {
        const select = document.getElementById('nodeListSubSelect');
        if (select) select.selectedIndex = index;
        return;
    }
    
    currentSubIndex = index;
    localStorage.setItem('lepo_current_sub_index', currentSubIndex);
    
    const sub = subscriptionsData[currentSubIndex];
    realNodes = sub ? sub.nodes : [];
    rawNodesJson = sub ? sub.rawJson : '[]';
    currentNodeIndex = 0;

    updateNodeText('next');
    renderNodeList();
    renderSubscriptionsList();
    populateSubscriptionSelect();
    
    syncTrayNodes();
    syncTraySubs();
    
    renderTrafficCard(sub ? sub.traffic : null);
    hotReloadProxyIfConnected();
    
    triggerPingTest().catch(err => console.error('triggerPingTest failed:', err));
}

function renderTrafficCard(info) {
    const trafficCard = document.getElementById('trafficCard');
    const trafficProgress = document.getElementById('trafficProgress');
    const trafficPercentage = document.getElementById('trafficPercentage');
    const trafficUsed = document.getElementById('trafficUsed');
    const trafficTotal = document.getElementById('trafficTotal');
    const trafficExpire = document.getElementById('trafficExpire');
    
    if (!trafficCard) return;

    if (info && info.total > 0) {
        const usedBytes = (info.upload || 0) + (info.download || 0);
        const totalBytes = info.total;
        
        let percent = (usedBytes / totalBytes) * 100;
        if (percent > 100) percent = 100;

        trafficUsed.textContent = `已用: ${formatBytes(usedBytes)}`;
        trafficTotal.textContent = `总计: ${formatBytes(totalBytes)}`;
        trafficPercentage.textContent = `${percent.toFixed(1)}%`;
        
        trafficProgress.style.width = '0%';
        setTimeout(() => {
            trafficProgress.style.width = `${percent}%`;
        }, 50);

        if (info.expire) {
            trafficExpire.textContent = `到期: ${formatTimestamp(info.expire)}`;
        } else {
            trafficExpire.textContent = '';
        }

        trafficCard.classList.remove('hidden');
        trafficCard.classList.add('flex');
    } else {
        trafficCard.classList.add('hidden');
        trafficCard.classList.remove('flex');
    }
}

// --- 注册来自 Tauri Rust 托盘的事件广播监听器 ---
if (window.__TAURI__ && window.__TAURI__.event) {
    const listen = window.__TAURI__.event.listen;
    
    // 1. 系统代理复选框切换
    listen('tray-system-proxy-toggle', async (event) => {
        systemProxyEnabled = event.payload;
        console.log('Tray system proxy state toggled:', systemProxyEnabled);
        localStorage.setItem('systemProxyEnabled', systemProxyEnabled);
        const systemProxyToggle = document.getElementById('systemProxyToggle');
        if (systemProxyToggle) {
            systemProxyToggle.checked = systemProxyEnabled;
        }
        syncTraySettings();
        if (connectionState === 2) {
            try {
                const portEl = document.getElementById('localPortInput');
                const localPort = portEl ? parseInt(portEl.value) || 2080 : 2080;
                await window.__TAURI__.core.invoke('set_system_proxy_enabled', { enabled: systemProxyEnabled, localPort: localPort });
            } catch (e) {
                console.error("Failed to dynamically toggle system proxy:", e);
            }
        }
    });

    // 2. TUN 模式复选框切换
    listen('tray-tun-proxy-toggle', (event) => {
        const active = event.payload;
        console.log('Received tray-tun-proxy-toggle event, payload:', active);
        const tunToggle = document.getElementById('tunToggle');
        if (tunToggle) {
            console.log('Current UI tunToggle checked status:', tunToggle.checked);
            if (tunToggle.checked !== active) {
                tunToggle.checked = active;
                tunToggle.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('Successfully toggled tunToggle checked status to:', active);
            }
        }
    });

    // 3. 托盘子菜单：节点切换选择
    listen('tray-node-select', (event) => {
        const activeIndex = event.payload;
        const targetIndex = activeIndex + 1;
        if (targetIndex < realNodes.length) {
            currentNodeIndex = targetIndex;
            updateNodeText('next');
            renderNodeList();
        }
    });

    // 4. 托盘子菜单：订阅来源切换
    listen('tray-sub-select', (event) => {
        const activeIndex = event.payload;
        if (activeIndex < subscriptionsData.length) {
            selectSubscription(activeIndex);
        }
    });

    // 5. 内核与服务重启
    listen('tray-restart-core', async () => {
        console.log('Tray requested Sing-Box core restart');
        const mainBtn = document.getElementById('mainBtn');
        if (!mainBtn) return;

        if (connectionState === 2) {
            try {
                await window.__TAURI__.core.invoke('stop_proxy');
            } catch (e) {
                console.error('Failed to stop proxy during restart:', e);
            }
            connectionState = 0;
            updateUIState();
            // 延迟一小段时间确保资源释放，再发起连接
            await new Promise(r => setTimeout(r, 300));
            mainBtn.click();
        } else if (connectionState === 0) {
            mainBtn.click();
        }
    });

    // 6. 核心异常崩溃通知自愈联动
    listen('core-crashed', () => {
        console.warn("Sing-Box core process crashed unexpectedly!");
        connectionState = 0;
        updateUIState();
        showConfirm('核心异常关闭', '检测到 Sing-Box 代理核心意外关闭，系统代理已被自动禁用并恢复网络！请检查订阅节点或网络配置！', true);
    });
}

// --- 初始化系统托盘双向绑定 ---
window.addEventListener('DOMContentLoaded', () => {
    // 自动初始化/拉取内置免费节点
    initializeDefaultFreeNodes();

    // 初始化渲染流量卡片
    renderTrafficCard(subscriptionsData[currentSubIndex].traffic);
    // 延迟 300 毫秒确保 Rust 托盘环境初始化完毕后推送初始值
    setTimeout(() => {
        syncTrayNodes();
        syncTraySubs();
        syncTraySettings();
    }, 300);

    // 启动后自动连接联动
    const isAutoConnect = localStorage.getItem('autoConnectEnabled') === 'true';
    if (isAutoConnect) {
        setTimeout(() => {
            const mainBtn = document.getElementById('mainBtn');
            if (mainBtn && connectionState === 0) {
                console.log('Auto-connecting on startup...');
                mainBtn.click();
            }
        }, 800);
    }
});

// 绑定页面中 TUN Toggle 开关的点击联动
const tunToggle = document.getElementById('tunToggle');
if (tunToggle) {
    // 从 localStorage 恢复用户上次的 TUN 开关选择
    const savedTunEnabled = localStorage.getItem('tunEnabled');
    if (savedTunEnabled !== null) {
        tunToggle.checked = savedTunEnabled === 'true';
    }

    tunToggle.addEventListener('change', async () => {
        localStorage.setItem('tunEnabled', tunToggle.checked);
        syncTraySettings();
        await updateSingboxConfig();
        await hotReloadProxyIfConnected();
    });
}

// --- 在线订阅拉取与流量仪表盘对接逻辑 ---

async function updateSingboxConfig() {
    if (window.__TAURI__ && window.__TAURI__.core && rawNodesJson && rawNodesJson !== '[]') {
        try {
            const tunToggle = document.getElementById('tunToggle');
            const tunEnabled = tunToggle ? tunToggle.checked : false;
            const activeNode = currentNodeIndex === 0 ? "Auto" : realNodes[currentNodeIndex].name;
            const portEl = document.getElementById('localPortInput');
            const localPort = portEl ? parseInt(portEl.value) || 2080 : 2080;
            const configJson = await window.__TAURI__.core.invoke('generate_singbox_config', {
                nodesJson: rawNodesJson,
                mode: currentRoutingMode,
                activeNode: activeNode,
                localPort: localPort,
                tunEnabled: tunEnabled,
                ipv6Enabled: ipv6Enabled,
                lanEnabled: lanEnabled
            });
            console.log("Successfully generated Sing-Box config.json of length:", configJson.length);
        } catch (error) {
            console.error("Failed to generate Sing-Box config:", error);
        }
    }
}

async function hotReloadProxyIfConnected() {
    if (connectionState === 2) {
        try {
            const tunToggle = document.getElementById('tunToggle');
            const tunEnabled = tunToggle ? tunToggle.checked : false;
            const activeNode = currentNodeIndex === 0 ? "Auto" : realNodes[currentNodeIndex].name;
            const portEl = document.getElementById('localPortInput');
            const localPort = portEl ? parseInt(portEl.value) || 2080 : 2080;

            const configJson = await window.__TAURI__.core.invoke('generate_singbox_config', {
                nodesJson: rawNodesJson,
                mode: currentRoutingMode,
                activeNode: activeNode,
                localPort: localPort,
                tunEnabled: tunEnabled,
                ipv6Enabled: ipv6Enabled,
                lanEnabled: lanEnabled
            });

            await window.__TAURI__.core.invoke('start_proxy', {
                configJson: configJson,
                systemProxyEnabled: systemProxyEnabled,
                localPort: localPort,
                tunEnabled: tunEnabled
            });
            console.log("Successfully hot-reloaded proxy settings!");
        } catch (e) {
            console.error("Failed to hot-reload proxy:", e);
        }
    }
}

async function triggerPingTest() {
    if (isPingTesting) return;
    isPingTesting = true;

    const pingNodesBtn = document.getElementById('pingNodesBtn');
    const pingBtnIcon = document.getElementById('pingBtnIcon');
    const pingBtnText = document.getElementById('pingBtnText');

    if (!rawNodesJson || rawNodesJson === '[]') {
        isPingTesting = false;
        return;
    }

    if (pingNodesBtn) {
        pingNodesBtn.disabled = true;
        if (pingBtnIcon) pingBtnIcon.className = 'ph ph-spinner animate-spin text-app-primary';
        if (pingBtnText) pingBtnText.textContent = '测速中...';
    }

    realNodes.forEach((node, index) => {
        if (index > 0) {
            node.ping = '测速中...';
        }
    });
    renderNodeList();

    try {
        const pingResultsStr = await window.__TAURI__.core.invoke('run_latency_test', {
            nodesJson: rawNodesJson
        });
        const pingResults = JSON.parse(pingResultsStr);

        realNodes.forEach((node, index) => {
            if (index > 0) {
                const latency = pingResults[node.name];
                if (latency !== undefined && latency >= 0) {
                    node.ping = `${latency}ms`;
                } else {
                    node.ping = '超时';
                }
            }
        });
        renderNodeList();

        let bestNodeIndex = -1;
        let lowestLatency = Infinity;
        realNodes.forEach((node, index) => {
            if (index > 0 && node.ping && node.ping !== '超时' && node.ping !== '测速中...') {
                const latencyVal = parseInt(node.ping);
                if (!isNaN(latencyVal) && latencyVal < lowestLatency) {
                    lowestLatency = latencyVal;
                    bestNodeIndex = index;
                }
            }
        });

        if (bestNodeIndex !== -1 && realNodes[currentNodeIndex] && realNodes[currentNodeIndex].ping === '超时') {
            currentNodeIndex = bestNodeIndex;
            updateNodeText('next');
            renderNodeList();
            syncTrayNodes();
            hotReloadProxyIfConnected();
            console.log("Successfully auto-selected the best latency node:", realNodes[currentNodeIndex].name);
        }
    } catch (err) {
        console.error("Failed to run latency test:", err);
        realNodes.forEach((node, index) => {
            if (index > 0) {
                node.ping = '超时';
            }
        });
        renderNodeList();
    } finally {
        isPingTesting = false;
        if (pingNodesBtn) {
            pingNodesBtn.disabled = false;
            if (pingBtnIcon) pingBtnIcon.className = 'ph ph-lightning text-amber-500';
            if (pingBtnText) pingBtnText.textContent = '测试延迟';
        }
    }
}

const pingNodesBtn = document.getElementById('pingNodesBtn');
if (pingNodesBtn) {
    pingNodesBtn.addEventListener('click', triggerPingTest);
}

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0.00 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimestamp(unixSeconds) {
    if (!unixSeconds) return '';
    const date = new Date(unixSeconds * 1000);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// --- 内置免费节点管理 ---
let isAutoFetchingBuiltIn = false;

async function initializeDefaultFreeNodes() {
    if (isAutoFetchingBuiltIn) return;
    isAutoFetchingBuiltIn = true;
    
    console.log('Checking built-in subscriptions for auto-update...');
    try {
        const sub1 = subscriptionsData.find(s => s.id === 'built-in-1');
        const sub2 = subscriptionsData.find(s => s.id === 'built-in-2');
        
        // 智能开机自愈更新：如果内置节点没有被成功解析（只有 1 个 Default - Auto 默认占位节点），则自动拉取
        if (sub1 && (!sub1.nodes || sub1.nodes.length <= 1)) {
            const idx1 = subscriptionsData.indexOf(sub1);
            if (idx1 !== -1) {
                console.log('Auto-updating empty built-in subscription 1...');
                await updateOnlineSubscription(idx1);
            }
        }
        
        if (sub2 && (!sub2.nodes || sub2.nodes.length <= 1)) {
            const idx2 = subscriptionsData.indexOf(sub2);
            if (idx2 !== -1) {
                console.log('Auto-updating empty built-in subscription 2...');
                // 稍微延迟 1.5 秒以错开请求，避免可能并发造成的网络拥堵
                setTimeout(async () => {
                    await updateOnlineSubscription(idx2);
                }, 1500);
            }
        }
    } catch (err) {
        console.error('Failed to auto-update built-in free nodes:', err);
    } finally {
        isAutoFetchingBuiltIn = false;
    }
}

// --- 多订阅 CRUD 与节点编辑表单逻辑 ---

let editingSubIndex = -1; // -1 means add, >= 0 means edit
let editingNodeIndex = -1; // -1 means add, >= 1 means edit

function renderSubscriptionsList() {
    const listContainer = document.getElementById('subscriptionsList');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    subscriptionsData.forEach((sub, index) => {
        const isSelected = index === currentSubIndex;
        const card = document.createElement('div');
        card.className = `p-3 flex flex-col gap-1 transition-all duration-300 cursor-pointer ${
            isSelected ? 'bg-app-hover border-l-2 border-app-text' : 'hover:bg-app-hover/50'
        }`;
        
        let urlDisplay = '手动本地节点组';
        if (sub.url) {
            try {
                const urlObj = new URL(sub.url);
                urlDisplay = urlObj.hostname + (urlObj.pathname.length > 10 ? urlObj.pathname.substring(0, 10) + '...' : urlObj.pathname);
            } catch (e) {
                urlDisplay = sub.url.length > 20 ? sub.url.substring(0, 20) + '...' : sub.url;
            }
        }

        const nodeCount = sub.nodes ? sub.nodes.length : 0;
        
        let trafficHtml = '';
        if (sub.traffic && sub.traffic.total > 0) {
            const used = (sub.traffic.upload || 0) + (sub.traffic.download || 0);
            const total = sub.traffic.total;
            let percent = (used / total) * 100;
            if (percent > 100) percent = 100;
            
            trafficHtml = `
                <div class="w-full mt-1">
                    <div class="flex justify-between text-[9px] text-app-muted mb-0.5">
                        <span>已用: ${formatBytes(used)} / ${formatBytes(total)}</span>
                        <span>${percent.toFixed(1)}%</span>
                    </div>
                    <div class="w-full h-1 bg-app-border rounded-full overflow-hidden">
                        <div class="h-full bg-app-text transition-all duration-500" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        }

        let metaHtml = `<span class="text-[9px] text-app-muted">更新: ${formatTimestamp(sub.lastUpdate / 1000 || Date.now() / 1000)}</span>`;
        if (sub.traffic && sub.traffic.expire) {
            metaHtml += ` <span class="text-[9px] text-app-muted ml-2">到期: ${formatTimestamp(sub.traffic.expire)}</span>`;
        }

        const isBuiltIn = sub.id === 'built-in-1' || sub.id === 'built-in-2';
        
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex-1 min-w-0 pr-2">
                    <div class="flex items-center gap-1.5">
                        <span class="text-xs font-semibold text-app-text truncate">${sub.name}</span>
                        ${isBuiltIn ? '<span class="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded scale-90 origin-left font-bold">内置</span>' : (sub.url ? '' : '<span class="text-[8px] bg-app-border px-1.5 py-0.5 rounded text-app-muted scale-90 origin-left">本地</span>')}
                    </div>
                    <span class="text-[10px] text-app-muted truncate block max-w-[180px]">${urlDisplay}</span>
                </div>
                <div class="flex items-center gap-1">
                    ${sub.url ? `
                    <button class="update-sub-btn text-app-muted hover:text-app-text p-1 transition-colors btn-press" title="更新订阅" data-index="${index}">
                        <i class="ph ph-lightning text-xs"></i>
                    </button>` : ''}
                    ${isBuiltIn ? '' : `
                    <button class="edit-sub-btn text-app-muted hover:text-app-text p-1 transition-colors btn-press" title="编辑订阅" data-index="${index}">
                        <i class="ph ph-pencil-simple text-xs"></i>
                    </button>
                    <button class="delete-sub-btn text-app-muted hover:text-red-500 p-1 transition-colors btn-press" title="删除订阅" data-index="${index}">
                        <i class="ph ph-trash text-xs"></i>
                    </button>
                    `}
                </div>
            </div>
            <div class="flex justify-between items-center mt-0.5">
                <span class="text-[10px] text-app-text font-medium">${nodeCount} 个节点</span>
                ${metaHtml}
            </div>
            ${trafficHtml}
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            selectSubscription(index);
        });

        listContainer.appendChild(card);
    });

    listContainer.querySelectorAll('.update-sub-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.getAttribute('data-index'));
            await updateOnlineSubscription(idx);
        });
    });

    listContainer.querySelectorAll('.edit-sub-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.getAttribute('data-index'));
            showSubscriptionForm(idx);
        });
    });

    listContainer.querySelectorAll('.delete-sub-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.getAttribute('data-index'));
            deleteSubscription(idx);
        });
    });
}

function populateSubscriptionSelect() {
    const select = document.getElementById('nodeListSubSelect');
    if (!select) return;
    select.innerHTML = '';
    subscriptionsData.forEach((sub, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = sub.name;
        opt.selected = index === currentSubIndex;
        select.appendChild(opt);
    });
}

function showSubscriptionForm(index = -1) {
    if (index !== -1 && index < subscriptionsData.length) {
        const sub = subscriptionsData[index];
        if (sub && (sub.id === 'built-in-1' || sub.id === 'built-in-2')) {
            showToast('内置免费订阅不允许编辑！', 'warning');
            return;
        }
    }

    const formArea = document.getElementById('subFormArea');
    const formTitle = document.getElementById('subFormTitle');
    const formName = document.getElementById('subFormName');
    const formUrl = document.getElementById('subFormUrl');
    const formInterval = document.getElementById('subFormInterval');
    
    if (!formArea) return;
    
    editingSubIndex = index;
    formArea.classList.remove('hidden');
    
    if (index === -1) {
        formTitle.textContent = '新建/导入订阅源';
        formName.value = '';
        formUrl.value = '';
        formInterval.value = '0';
    } else {
        const sub = subscriptionsData[index];
        formTitle.textContent = `编辑订阅: ${sub.name}`;
        formName.value = sub.name;
        formUrl.value = sub.url || '';
        formInterval.value = (sub.interval || 0).toString();
    }
    
    const subsCard = document.getElementById('subsCard');
    if (subsCard) {
        setTimeout(() => {
            subsCard.scrollTop = subsCard.scrollHeight;
        }, 100);
    }
}

function hideSubscriptionForm() {
    const formArea = document.getElementById('subFormArea');
    if (formArea) {
        formArea.classList.add('hidden');
    }
    editingSubIndex = -1;
}

function getReliableSubUrl(url) {
    if (!url) return url;
    // 如果是 GitHub 原始链接，自动转换为极其稳定和高速的 jsDelivr CDN 链接以确保国内直连可用性
    if (url.includes('raw.githubusercontent.com') || (url.includes('github.com') && url.includes('/raw/'))) {
        try {
            // 归一化链接格式，将 raw.githubusercontent.com 统一转换为 github.com 格式进行解析
            let cleanUrl = url.replace('https://raw.githubusercontent.com/', 'https://github.com/');
            const urlObj = new URL(cleanUrl);
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            
            if (pathParts.length >= 4) {
                const user = pathParts[0];
                const repo = pathParts[1];
                let branch = '';
                let fileSubPath = '';
                
                if (pathParts[2] === 'raw') {
                    branch = pathParts[3];
                    fileSubPath = pathParts.slice(4).join('/');
                } else if (pathParts[2] === 'refs' && pathParts[3] === 'heads') {
                    branch = pathParts[4];
                    fileSubPath = pathParts.slice(5).join('/');
                } else {
                    if (pathParts[2] === 'refs' && pathParts[3] === 'heads') {
                        branch = pathParts[4];
                        fileSubPath = pathParts.slice(5).join('/');
                    } else {
                        branch = pathParts[2];
                        fileSubPath = pathParts.slice(3).join('/');
                    }
                }
                
                // 去除分支名称中的多余头前缀
                branch = branch.replace('refs/heads/', '');
                
                if (user && repo && branch && fileSubPath) {
                    const jsdelivrUrl = `https://fastly.jsdelivr.net/gh/${user}/${repo}@${branch}/${fileSubPath}`;
                    console.log(`[getReliableSubUrl] Mapped GitHub subscription URL: ${url} -> ${jsdelivrUrl}`);
                    return jsdelivrUrl;
                }
            }
        } catch (e) {
            console.error('Failed to parse GitHub subscription URL, falling back to ghproxy:', e);
        }
        // 终极备选回退：如果由于特殊格式解析失败，降级回退到备用代理镜像 ghproxy.cn
        return 'https://ghproxy.cn/' + url;
    }
    return url;
}

async function updateOnlineSubscription(index) {
    const sub = subscriptionsData[index];
    if (!sub || !sub.url) return;
    
    console.log(`Updating subscription: ${sub.name}`);
    
    try {
        let resultStr = "";
        if (sub.url.startsWith('http://') || sub.url.startsWith('https://')) {
            const reliableUrl = getReliableSubUrl(sub.url);
            console.log(`Fetching from reliable subscription URL: ${reliableUrl}`);
            const rawContent = await window.__TAURI__.core.invoke('fetch_subscription', { url: reliableUrl });
            resultStr = await window.__TAURI__.core.invoke('translate_raw_nodes', { content: rawContent });
        } else {
            resultStr = await window.__TAURI__.core.invoke('translate_raw_nodes', { content: sub.url });
        }
        
        const data = JSON.parse(resultStr);
        
        if (data.nodes && Array.isArray(data.nodes) && data.nodes.length > 0) {
            const newRawNodesJson = JSON.stringify(data.nodes);
            const newRealNodes = [{ name: 'Default - Auto', ping: '---', color: 'bg-app-text', pinned: false }];
            
            data.nodes.forEach(node => {
                newRealNodes.push({
                    name: node.tag || '未命名节点',
                    ping: '---',
                    color: 'bg-app-text',
                    pinned: false,
                    type: node.type || 'unknown'
                });
            });
            
            sub.nodes = newRealNodes;
            sub.rawJson = newRawNodesJson;
            sub.traffic = data.user_info;
            sub.lastUpdate = Date.now();
            
            saveSubscriptions();
            renderSubscriptionsList();
            populateSubscriptionSelect();
            
            if (index === currentSubIndex) {
                realNodes = newRealNodes;
                rawNodesJson = newRawNodesJson;
                currentNodeIndex = 0;
                updateNodeText('next');
                renderNodeList();
                syncTrayNodes();
                await updateSingboxConfig();
                triggerPingTest().catch(err => console.error('triggerPingTest failed:', err));
                renderTrafficCard(data.user_info);
            }
            console.log(`Successfully updated subscription: ${sub.name}`);
        } else {
            showConfirm('更新失败', '该内容未包含任何有效的代理节点！', true);
        }
    } catch (e) {
        console.error(`Failed to update subscription ${sub.name}:`, e);
        showConfirm('更新订阅失败', `更新订阅失败: ${e}`, true);
    }
}

async function deleteSubscription(index) {
    if (index >= 0 && index < subscriptionsData.length) {
        const sub = subscriptionsData[index];
        if (sub && (sub.id === 'built-in-1' || sub.id === 'built-in-2')) {
            showToast('内置免费订阅不允许删除！', 'warning');
            return;
        }
    }

    if (subscriptionsData.length <= 1) {
        showToast('必须保留至少一个订阅源！', 'warning');
        return;
    }
    
    const sub = subscriptionsData[index];
    const confirmed = await showConfirm('彻底删除订阅', `确定要彻底删除订阅 "${sub.name}" 吗？`);
    if (!confirmed) {
        return;
    }
    
    subscriptionsData.splice(index, 1);
    
    if (currentSubIndex >= subscriptionsData.length) {
        currentSubIndex = subscriptionsData.length - 1;
    }
    localStorage.setItem('lepo_current_sub_index', currentSubIndex);
    
    saveSubscriptions();
    renderSubscriptionsList();
    populateSubscriptionSelect();
    syncTraySubs();
    
    const currentSub = subscriptionsData[currentSubIndex];
    realNodes = currentSub ? currentSub.nodes : [];
    rawNodesJson = currentSub ? currentSub.rawJson : '[]';
    currentNodeIndex = 0;
    
    updateNodeText('next');
    renderNodeList();
    renderTrafficCard(currentSub ? currentSub.traffic : null);
    syncTrayNodes();
    
    hotReloadProxyIfConnected();
    triggerPingTest().catch(err => console.error('triggerPingTest failed:', err));
}

// --- 手动节点表单交互逻辑 ---

function openNodeEditOverlay(index = -1) {
    const overlay = document.getElementById('nodeEditOverlay');
    const card = document.getElementById('nodeEditCard');
    const title = document.getElementById('nodeEditTitle');
    
    if (!overlay || !card) return;
    
    editingNodeIndex = index;
    
    overlay.classList.remove('opacity-0', 'pointer-events-none');
    card.classList.remove('scale-95', 'opacity-0');
    card.classList.add('scale-100', 'opacity-100');
    
    if (index === -1) {
        title.textContent = '添加自定义节点';
        document.getElementById('nodeTagInput').value = '';
        document.getElementById('nodeServerInput').value = '';
        document.getElementById('nodePortInput').value = '443';
        document.getElementById('nodeProtoSelect').value = 'vless';
        document.getElementById('nodeSsMethod').value = 'aes-256-gcm';
        document.getElementById('nodeSsPassword').value = '';
        document.getElementById('nodeVmessUuid').value = '';
        document.getElementById('nodeVmessSecurity').value = 'auto';
        document.getElementById('nodeVmessAlterId').value = '0';
        document.getElementById('nodeVlessUuid').value = '';
        document.getElementById('nodeVlessFlow').value = '';
        document.getElementById('nodeTrojanPassword').value = '';
        document.getElementById('nodeHysteria2Auth').value = '';
        document.getElementById('nodeTlsToggle').checked = true;
        document.getElementById('nodeSniInput').value = '';
    } else {
        title.textContent = '编辑自定义节点';
        const sub = subscriptionsData[currentSubIndex];
        let outbounds = [];
        try {
            outbounds = JSON.parse(sub.rawJson || '[]');
        } catch (e) {}
        
        const outboundIdx = index - 1;
        const out = outbounds[outboundIdx];
        if (!out) return;
        
        document.getElementById('nodeTagInput').value = out.tag || '';
        document.getElementById('nodeServerInput').value = out.server || '';
        document.getElementById('nodePortInput').value = out.server_port || '443';
        
        const type = out.type || 'vless';
        document.getElementById('nodeProtoSelect').value = type;
        
        if (type === 'shadowsocks') {
            document.getElementById('nodeSsMethod').value = out.method || 'aes-256-gcm';
            document.getElementById('nodeSsPassword').value = out.password || '';
        } else if (type === 'vmess') {
            document.getElementById('nodeVmessUuid').value = out.uuid || '';
            document.getElementById('nodeVmessSecurity').value = out.security || 'auto';
            document.getElementById('nodeVmessAlterId').value = out.alter_id || '0';
        } else if (type === 'vless') {
            document.getElementById('nodeVlessUuid').value = out.uuid || '';
            document.getElementById('nodeVlessFlow').value = out.flow || '';
        } else if (type === 'trojan') {
            document.getElementById('nodeTrojanPassword').value = out.password || '';
        } else if (type === 'hysteria2') {
            document.getElementById('nodeHysteria2Auth').value = out.password || '';
        }
        
        if (type !== 'shadowsocks') {
            const tlsEnabled = out.tls && out.tls.enabled;
            document.getElementById('nodeTlsToggle').checked = !!tlsEnabled;
            document.getElementById('nodeSniInput').value = (out.tls && out.tls.server_name) || '';
        }
    }
    
    document.getElementById('nodeProtoSelect').dispatchEvent(new Event('change'));
    // Sync segmented tabs state on open
    updateProtoTabsUI(document.getElementById('nodeProtoSelect').value);
    document.getElementById('nodeTlsToggle').dispatchEvent(new Event('change'));
}

function openNodeEditForm(originalIndex) {
    openNodeEditOverlay(originalIndex);
}

function closeNodeEditOverlay() {
    const overlay = document.getElementById('nodeEditOverlay');
    const card = document.getElementById('nodeEditCard');
    if (overlay && card) {
        card.classList.remove('scale-100', 'opacity-100');
        card.classList.add('scale-95', 'opacity-0');
        overlay.classList.add('opacity-0', 'pointer-events-none');
    }
}

function updateProtoTabsUI(value) {
    const protoTabBtns = document.querySelectorAll('.proto-tab-btn');
    protoTabBtns.forEach(btn => {
        const btnVal = btn.getAttribute('data-value');
        if (btnVal === value) {
            btn.classList.add('bg-app-surface', 'text-app-primary', 'shadow-sm', 'border-app-border/40', 'font-bold');
            btn.classList.remove('text-app-muted', 'border-transparent');
        } else {
            btn.classList.remove('bg-app-surface', 'text-app-primary', 'shadow-sm', 'border-app-border/40', 'font-bold');
            btn.classList.add('text-app-muted', 'border-transparent');
        }
    });
}

async function deleteNodeFromSub(originalIndex) {
    const sub = subscriptionsData[currentSubIndex];
    if (!sub || !sub.nodes || !sub.nodes[originalIndex]) return;
    
    const confirmed = await showConfirm('删除节点', `确定要删除节点 "${sub.nodes[originalIndex].name}" 吗？`);
    if (!confirmed) {
        return;
    }
    
    sub.nodes.splice(originalIndex, 1);
    
    let outbounds = [];
    try {
        outbounds = JSON.parse(sub.rawJson || '[]');
    } catch (e) {}
    
    const outboundIdx = originalIndex - 1;
    if (outboundIdx >= 0 && outboundIdx < outbounds.length) {
        outbounds.splice(outboundIdx, 1);
    }
    
    sub.rawJson = JSON.stringify(outbounds);
    saveSubscriptions();
    
    if (currentNodeIndex === originalIndex) {
        currentNodeIndex = 0;
    } else if (currentNodeIndex > originalIndex) {
        currentNodeIndex--;
    }
    
    realNodes = sub.nodes;
    rawNodesJson = sub.rawJson;
    
    updateNodeText('next');
    renderNodeList();
    syncTrayNodes();
    
    updateSingboxConfig().then(() => {
        hotReloadProxyIfConnected();
    });
}

async function copyNodeShareLink(originalIndex) {
    const sub = subscriptionsData[currentSubIndex];
    if (!sub || !sub.nodes || !sub.nodes[originalIndex]) return;
    
    let outbounds = [];
    try {
        outbounds = JSON.parse(sub.rawJson || '[]');
    } catch (e) {}
    
    const outboundIdx = originalIndex - 1;
    const out = outbounds[outboundIdx];
    if (!out) return;
    
    let link = "";
    const tagEscaped = encodeURIComponent(out.tag || '');
    
    try {
        if (out.type === 'shadowsocks') {
            const credentials = btoa(`${out.method}:${out.password}`);
            link = `ss://${credentials}@${out.server}:${out.server_port}#${tagEscaped}`;
        } else if (out.type === 'vmess') {
            const tlsVal = (out.tls && out.tls.enabled) ? "tls" : "";
            const vmessObj = {
                v: "2",
                ps: out.tag || "",
                add: out.server,
                port: out.server_port.toString(),
                id: out.uuid || "",
                aid: (out.alter_id || 0).toString(),
                scy: out.security || "auto",
                net: "tcp",
                type: "none",
                host: "",
                path: "",
                tls: tlsVal
            };
            const b64 = btoa(JSON.stringify(vmessObj));
            link = `vmess://${b64}`;
        } else if (out.type === 'vless') {
            const flowVal = out.flow ? `&flow=${out.flow}` : "";
            const tlsVal = (out.tls && out.tls.enabled) ? `&security=tls&sni=${out.tls.server_name || out.server}` : "&security=none";
            link = `vless://${out.uuid}@${out.server}:${out.server_port}?type=tcp&encryption=none${flowVal}${tlsVal}#${tagEscaped}`;
        } else if (out.type === 'trojan') {
            const tlsVal = (out.tls && out.tls.enabled) ? `?security=tls&sni=${out.tls.server_name || out.server}` : "";
            link = `trojan://${out.password}@${out.server}:${out.server_port}${tlsVal}#${tagEscaped}`;
        } else if (out.type === 'hysteria2') {
            const tlsVal = (out.tls && out.tls.enabled) ? `&sni=${out.tls.server_name || out.server}` : "";
            link = `hysteria2://${out.password}@${out.server}:${out.server_port}?insecure=1${tlsVal}#${tagEscaped}`;
        }
        
        if (link) {
            await navigator.clipboard.writeText(link);
            showToast(`已成功复制节点 "${out.tag}" 的分享链接到剪贴板！`, 'success');
        }
    } catch (e) {
        console.error('Failed to generate sharing link:', e);
        showToast('生成分享链接失败：' + e, 'error');
    }
}

// --- 休眠唤醒与网卡切换智能自愈守护 (Wake-up & Network Change Self-Healing) ---
window.addEventListener('online', async () => {
    console.log('Network online detected. Triggering self-healing recovery...');
    if (connectionState === 2) {
        await updateSingboxConfig();
        await hotReloadProxyIfConnected();
        triggerPingTest().catch(err => console.error('triggerPingTest failed:', err));
    }
});

window.addEventListener('offline', () => {
    console.log('Network offline detected.');
});

let lastCheckTime = Date.now();
setInterval(async () => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastCheckTime;
    
    if (timeDiff > 8000) {
        console.log(`Laptop sleep wake-up detected (Time delta: ${timeDiff}ms). Self-healing connections...`);
        if (connectionState === 2) {
            try {
                await updateSingboxConfig();
                await hotReloadProxyIfConnected();
                triggerPingTest().catch(err => console.error('triggerPingTest failed:', err));
                console.log('Self-healing completed successfully after wake-up.');
            } catch (err) {
                console.error('Self-healing failed after wake-up:', err);
            }
        }
    }
    lastCheckTime = currentTime;
}, 3000);

// --- 静默自动更新订阅守护定时器 ---
async function checkAndExecuteSilentUpdate() {
    subscriptionsData.forEach(async (sub, index) => {
        if (!sub.url || sub.interval <= 0) return;
        
        const lastUpdate = sub.lastUpdate || 0;
        const intervalMs = sub.interval * 3600 * 1000;
        const timeElapsed = Date.now() - lastUpdate;
        
        if (timeElapsed >= intervalMs) {
            console.log(`Silent auto-update triggered for sub: ${sub.name}!`);
            try {
                let resultStr = "";
                if (sub.url.startsWith('http://') || sub.url.startsWith('https://')) {
                    const reliableUrl = getReliableSubUrl(sub.url);
                    console.log(`Silent fetching from reliable subscription URL: ${reliableUrl}`);
                    const rawContent = await window.__TAURI__.core.invoke('fetch_subscription', { url: reliableUrl });
                    resultStr = await window.__TAURI__.core.invoke('translate_raw_nodes', { content: rawContent });
                } else {
                    resultStr = await window.__TAURI__.core.invoke('translate_raw_nodes', { content: sub.url });
                }
                
                const data = JSON.parse(resultStr);
                
                if (data.nodes && Array.isArray(data.nodes) && data.nodes.length > 0) {
                    const silentRawJson = JSON.stringify(data.nodes);
                    const silentRealNodes = [{ name: 'Default - Auto', ping: '---', color: 'bg-app-text', pinned: false }];
                    data.nodes.forEach(node => {
                        silentRealNodes.push({
                            name: node.tag || '未命名节点',
                            ping: '---',
                            color: 'bg-app-text',
                            pinned: false,
                            type: node.type || 'unknown'
                        });
                    });
                    
                    sub.nodes = silentRealNodes;
                    sub.rawJson = silentRawJson;
                    sub.traffic = data.user_info;
                    sub.lastUpdate = Date.now();
                    
                    saveSubscriptions();
                    renderSubscriptionsList();
                    populateSubscriptionSelect();
                    
                    if (index === currentSubIndex) {
                        if (currentNodeIndex >= silentRealNodes.length) {
                            currentNodeIndex = 0;
                        }
                        realNodes = silentRealNodes;
                        rawNodesJson = silentRawJson;
                        renderNodeList();
                        renderTrafficCard(data.user_info);
                        syncTrayNodes();
                        await updateSingboxConfig();
                        await hotReloadProxyIfConnected();
                        triggerPingTest().catch(err => console.error('triggerPingTest failed:', err));
                    }
                    console.log(`Silent subscription auto-update completed successfully for ${sub.name}!`);
                }
            } catch (err) {
                console.error(`Silent auto-update failed for ${sub.name}:`, err);
            }
        }
    });
}

// 在 DOM 加载完毕时，初始化自动更新状态与输入框回显
document.addEventListener('DOMContentLoaded', () => {
    renderSubscriptionsList();
    populateSubscriptionSelect();
    renderNodeList();

    // Startup sync logic for the active node and its protocol badge
    const activeNode = realNodes[currentNodeIndex];
    const nodeText = document.getElementById('nodeText');
    const nodeProtoBadge = document.getElementById('nodeProtoBadge');
    if (activeNode) {
        if (nodeText) {
            nodeText.textContent = activeNode.name;
        }
        if (nodeProtoBadge) {
            if (activeNode.type && activeNode.type !== 'auto') {
                let displayType = activeNode.type.toLowerCase() === 'shadowsocks' ? 'SS' : activeNode.type.toUpperCase();
                nodeProtoBadge.textContent = displayType;
                nodeProtoBadge.classList.remove('hidden');
            } else {
                nodeProtoBadge.classList.add('hidden');
            }
        }
    }

    const btnShowAddSub = document.getElementById('btnShowAddSub');
    if (btnShowAddSub) {
        btnShowAddSub.addEventListener('click', () => {
            showSubscriptionForm(-1);
        });
    }

    const subFormSaveBtn = document.getElementById('subFormSaveBtn');
    if (subFormSaveBtn) {
        subFormSaveBtn.addEventListener('click', async () => {
            const nameInput = document.getElementById('subFormName');
            const urlInput = document.getElementById('subFormUrl');
            const intervalSelect = document.getElementById('subFormInterval');
            
            const name = nameInput.value.trim();
            const url = urlInput.value.trim();
            const interval = parseInt(intervalSelect.value) || 0;
            
            if (!name) {
                showToast('请输入订阅名称！', 'warning');
                return;
            }
            
            if (editingSubIndex === -1) {
                const newSub = {
                    id: 'sub-' + Date.now(),
                    name: name,
                    url: url,
                    nodes: [
                        { name: 'Default - Auto', ping: '---', color: 'bg-app-text', pinned: false }
                    ],
                    rawJson: '[]',
                    traffic: null,
                    interval: interval,
                    lastUpdate: Date.now()
                };
                
                subscriptionsData.push(newSub);
                saveSubscriptions();
                renderSubscriptionsList();
                populateSubscriptionSelect();
                syncTraySubs();
                
                const newIdx = subscriptionsData.length - 1;
                hideSubscriptionForm();
                
                if (url) {
                    await updateOnlineSubscription(newIdx);
                } else {
                    selectSubscription(newIdx);
                }
            } else {
                const sub = subscriptionsData[editingSubIndex];
                const oldUrl = sub.url;
                
                sub.name = name;
                sub.url = url;
                sub.interval = interval;
                
                saveSubscriptions();
                renderSubscriptionsList();
                populateSubscriptionSelect();
                syncTraySubs();
                
                hideSubscriptionForm();
                
                if (url && url !== oldUrl) {
                    await updateOnlineSubscription(editingSubIndex);
                } else {
                    if (editingSubIndex === currentSubIndex) {
                        realNodes = sub.nodes;
                        rawNodesJson = sub.rawJson;
                        updateNodeText('next');
                        renderNodeList();
                        renderTrafficCard(sub.traffic);
                    }
                }
            }
        });
    }

    const subFormCancelBtn = document.getElementById('subFormCancelBtn');
    if (subFormCancelBtn) {
        subFormCancelBtn.addEventListener('click', hideSubscriptionForm);
    }

    const subFormPasteBtn = document.getElementById('subFormPasteBtn');
    if (subFormPasteBtn) {
        subFormPasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                const formUrl = document.getElementById('subFormUrl');
                if (formUrl) formUrl.value = text.trim();
            } catch (err) {
                console.error('Failed to read clipboard:', err);
            }
        });
    }

    const nodeListSubSelect = document.getElementById('nodeListSubSelect');
    if (nodeListSubSelect) {
        nodeListSubSelect.addEventListener('change', (e) => {
            const idx = parseInt(e.target.value);
            selectSubscription(idx);
        });
    }

    const nodeSearchInput = document.getElementById('nodeSearchInput');
    if (nodeSearchInput) {
        nodeSearchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderNodeList();
        });
    }

    const sortNodesBtn = document.getElementById('sortNodesBtn');
    if (sortNodesBtn) {
        sortNodesBtn.addEventListener('click', () => {
            const icon = sortNodesBtn.querySelector('i');
            if (sortState === 'default') {
                sortState = 'latency';
                if (icon) icon.className = 'ph ph-lightning text-sm';
                sortNodesBtn.title = '当前排序: 延迟低优先 (点击切换为字母排序)';
            } else if (sortState === 'latency') {
                sortState = 'alphabet';
                if (icon) icon.className = 'ph ph-sort-ascending text-sm';
                sortNodesBtn.title = '当前排序: 字母 A-Z 排序 (点击切换为默认排序)';
            } else {
                sortState = 'default';
                if (icon) icon.className = 'ph ph-list-dashes text-sm';
                sortNodesBtn.title = '当前排序: 默认排序 (点击切换为延迟优先)';
            }
            renderNodeList();
        });
    }

    const nodeListClearDeadBtn = document.getElementById('nodeListClearDeadBtn');
    if (nodeListClearDeadBtn) {
        nodeListClearDeadBtn.addEventListener('click', () => {
            const sub = subscriptionsData[currentSubIndex];
            if (!sub || !sub.nodes) return;
            
            const originalLength = sub.nodes.length;
            let outbounds = [];
            try {
                outbounds = JSON.parse(sub.rawJson || '[]');
            } catch (e) {}
            
            const keepNodes = [sub.nodes[0]];
            const keepOutbounds = [];
            
            for (let i = 1; i < sub.nodes.length; i++) {
                const node = sub.nodes[i];
                if (node.ping !== '超时') {
                    keepNodes.push(node);
                    const outIdx = i - 1;
                    if (outIdx >= 0 && outIdx < outbounds.length) {
                        keepOutbounds.push(outbounds[outIdx]);
                    }
                }
            }
            
            if (keepNodes.length === originalLength) {
                showToast('没有检测到超时节点！', 'info');
                return;
            }
            
            sub.nodes = keepNodes;
            sub.rawJson = JSON.stringify(keepOutbounds);
            
            saveSubscriptions();
            
            currentNodeIndex = 0;
            realNodes = sub.nodes;
            rawNodesJson = sub.rawJson;
            
            updateNodeText('next');
            renderNodeList();
            syncTrayNodes();
            
            updateSingboxConfig().then(() => {
                hotReloadProxyIfConnected();
            });
        });
    }

    const nodeListAddNodeBtn = document.getElementById('nodeListAddNodeBtn');
    if (nodeListAddNodeBtn) {
        nodeListAddNodeBtn.addEventListener('click', () => {
            openNodeEditOverlay(-1);
        });
    }

    const nodeProtoSelect = document.getElementById('nodeProtoSelect');
    if (nodeProtoSelect) {
        nodeProtoSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            document.getElementById('fieldsShadowsocks').classList.toggle('hidden', val !== 'shadowsocks');
            document.getElementById('fieldsVmess').classList.toggle('hidden', val !== 'vmess');
            document.getElementById('fieldsVless').classList.toggle('hidden', val !== 'vless');
            document.getElementById('fieldsTrojan').classList.toggle('hidden', val !== 'trojan');
            document.getElementById('fieldsHysteria2').classList.toggle('hidden', val !== 'hysteria2');
            document.getElementById('fieldsTls').classList.toggle('hidden', val === 'shadowsocks');
        });
    }

    const protoTabBtns = document.querySelectorAll('.proto-tab-btn');
    protoTabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = e.currentTarget.getAttribute('data-value');
            if (nodeProtoSelect) {
                nodeProtoSelect.value = val;
                nodeProtoSelect.dispatchEvent(new Event('change'));
            }
            updateProtoTabsUI(val);
        });
    });


    const nodeTlsToggle = document.getElementById('nodeTlsToggle');
    if (nodeTlsToggle) {
        nodeTlsToggle.addEventListener('change', () => {
            document.getElementById('nodeTlsSniArea').classList.toggle('hidden', !nodeTlsToggle.checked);
        });
    }

    const nodeEditSaveBtn = document.getElementById('nodeEditSaveBtn');
    if (nodeEditSaveBtn) {
        nodeEditSaveBtn.addEventListener('click', async () => {
            const tag = document.getElementById('nodeTagInput').value.trim();
            const server = document.getElementById('nodeServerInput').value.trim();
            const port = parseInt(document.getElementById('nodePortInput').value) || 443;
            const type = document.getElementById('nodeProtoSelect').value;
            
            if (!tag) {
                showToast('请输入节点名称！', 'warning');
                return;
            }
            if (!server) {
                showToast('请输入服务器地址！', 'warning');
                return;
            }
            
            let outbound = {
                type: type,
                tag: tag,
                server: server,
                server_port: port
            };
            
            if (type === 'shadowsocks') {
                outbound.method = document.getElementById('nodeSsMethod').value;
                outbound.password = document.getElementById('nodeSsPassword').value.trim();
                if (!outbound.password) {
                    showToast('请输入密码！', 'warning');
                    return;
                }
            } else if (type === 'vmess') {
                outbound.uuid = document.getElementById('nodeVmessUuid').value.trim();
                outbound.security = document.getElementById('nodeVmessSecurity').value;
                outbound.alter_id = parseInt(document.getElementById('nodeVmessAlterId').value) || 0;
                if (!outbound.uuid) {
                    showToast('请输入 UUID！', 'warning');
                    return;
                }
            } else if (type === 'vless') {
                outbound.uuid = document.getElementById('nodeVlessUuid').value.trim();
                outbound.flow = document.getElementById('nodeVlessFlow').value;
                if (!outbound.uuid) {
                    showToast('请输入 UUID！', 'warning');
                    return;
                }
            } else if (type === 'trojan') {
                outbound.password = document.getElementById('nodeTrojanPassword').value.trim();
                if (!outbound.password) {
                    showToast('请输入密码！', 'warning');
                    return;
                }
            } else if (type === 'hysteria2') {
                outbound.password = document.getElementById('nodeHysteria2Auth').value.trim();
                if (!outbound.password) {
                    showToast('请输入认证密钥！', 'warning');
                    return;
                }
            }
            
            if (type !== 'shadowsocks') {
                const tlsEnabled = document.getElementById('nodeTlsToggle').checked;
                const sni = document.getElementById('nodeSniInput').value.trim();
                if (tlsEnabled) {
                    outbound.tls = {
                        enabled: true,
                        server_name: sni || server
                    };
                } else {
                    outbound.tls = {
                        enabled: false
                    };
                }
            }
            
            const sub = subscriptionsData[currentSubIndex];
            let outbounds = [];
            try {
                outbounds = JSON.parse(sub.rawJson || '[]');
            } catch (e) {}
            
            if (editingNodeIndex === -1) {
                outbounds.push(outbound);
                sub.nodes.push({
                    name: tag,
                    ping: '---',
                    color: 'bg-app-text',
                    pinned: false,
                    type: type
                });
            } else {
                const outboundIdx = editingNodeIndex - 1;
                outbounds[outboundIdx] = outbound;
                sub.nodes[editingNodeIndex] = {
                    name: tag,
                    ping: sub.nodes[editingNodeIndex].ping || '---',
                    color: 'bg-app-text',
                    pinned: sub.nodes[editingNodeIndex].pinned || false,
                    type: type
                };
            }
            
            sub.rawJson = JSON.stringify(outbounds);
            saveSubscriptions();
            
            realNodes = sub.nodes;
            rawNodesJson = sub.rawJson;
            
            renderNodeList();
            renderSubscriptionsList();
            syncTrayNodes();
            
            if (editingNodeIndex === currentNodeIndex) {
                updateNodeText('next');
            }
            
            closeNodeEditOverlay();
            
            await updateSingboxConfig();
            await hotReloadProxyIfConnected();
        });
    }

    const nodeEditCancelBtn = document.getElementById('nodeEditCancelBtn');
    if (nodeEditCancelBtn) {
        nodeEditCancelBtn.addEventListener('click', closeNodeEditOverlay);
    }
    
    const closeNodeEditBtn = document.getElementById('closeNodeEditBtn');
    if (closeNodeEditBtn) {
        closeNodeEditBtn.addEventListener('click', closeNodeEditOverlay);
    }
    
    const nodeEditOverlay = document.getElementById('nodeEditOverlay');
    if (nodeEditOverlay) {
        nodeEditOverlay.addEventListener('click', (e) => {
            if (e.target === nodeEditOverlay) closeNodeEditOverlay();
        });
    }

    initializeDefaultFreeNodes();

    renderTrafficCard(subscriptionsData[currentSubIndex] ? subscriptionsData[currentSubIndex].traffic : null);
    setTimeout(() => {
        syncTrayNodes();
        syncTraySubs();
        syncTraySettings();
    }, 300);

    const isAutoConnect = localStorage.getItem('autoConnectEnabled') === 'true';
    if (isAutoConnect) {
        setTimeout(() => {
            const mainBtn = document.getElementById('mainBtn');
            if (mainBtn && connectionState === 0) {
                console.log('Auto-connecting on startup...');
                mainBtn.click();
            }
        }, 800);
    }

    setTimeout(checkAndExecuteSilentUpdate, 3000);
    setInterval(checkAndExecuteSilentUpdate, 60000);

    initUtilityDrawers();
    setTimeout(runIpDiagnostic, 1500);
});

// --- 实用工具二级菜单诊断面板实现 (Utility Secondary Drawers Implementation) ---
let isIpDiagnosing = false;
let isUnlockDiagnosing = false;
let isLogsPaused = false;

// 1. IP 地理出口检测
async function runIpDiagnostic() {
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
                if (connectionState === 2) {
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

function getFlagEmoji(countryCode) {
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
async function testUnlockService(url) {
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

async function runUnlockDiagnostic() {
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

// 初始化二级诊断抽屉注册器
function initUtilityDrawers() {
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
}

// --- LepoProxy Premium Custom Dialog and Toast Helper Logic ---
let dialogResolve = null;

function showConfirm(title, message, isAlert = false) {
    return new Promise((resolve) => {
        dialogResolve = resolve;
        const overlay = document.getElementById('customDialogOverlay');
        const card = document.getElementById('customDialogCard');
        const titleEl = document.getElementById('customDialogTitle');
        const msgEl = document.getElementById('customDialogMessage');
        const cancelBtn = document.getElementById('customDialogCancelBtn');
        const confirmBtn = document.getElementById('customDialogConfirmBtn');
        const iconEl = document.getElementById('customDialogIcon');
        const iconContainer = document.getElementById('customDialogIconContainer');

        titleEl.textContent = title;
        msgEl.textContent = message;

        if (isAlert) {
            cancelBtn.classList.add('hidden');
            confirmBtn.textContent = '我知道了';
            confirmBtn.className = "px-4 py-1.5 bg-app-text text-app-base hover:opacity-90 text-[10px] font-semibold rounded-lg transition-colors btn-press";
            iconEl.className = "ph ph-info text-lg";
            iconContainer.className = "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-app-primary/10 text-app-primary";
        } else {
            cancelBtn.classList.remove('hidden');
            confirmBtn.textContent = '确认';
            confirmBtn.className = "px-3 py-1.5 bg-red-500 text-white hover:bg-red-600 text-[10px] font-semibold rounded-lg transition-colors btn-press";
            iconEl.className = "ph ph-warning text-lg";
            iconContainer.className = "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-rose-500/10 text-rose-500";
        }

        overlay.classList.remove('opacity-0', 'pointer-events-none');
        card.classList.remove('scale-95', 'opacity-0');
        card.classList.add('scale-100', 'opacity-100');
    });
}

function closeDialog(result) {
    const overlay = document.getElementById('customDialogOverlay');
    const card = document.getElementById('customDialogCard');
    
    card.classList.remove('scale-100', 'opacity-100');
    card.classList.add('scale-95', 'opacity-0');
    overlay.classList.add('opacity-0', 'pointer-events-none');
    
    if (dialogResolve) {
        dialogResolve(result);
        dialogResolve = null;
    }
}

// Bind dialog buttons
document.getElementById('customDialogCancelBtn').addEventListener('click', () => closeDialog(false));
document.getElementById('customDialogConfirmBtn').addEventListener('click', () => closeDialog(true));
document.getElementById('customDialogOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('customDialogOverlay')) {
        const cancelBtn = document.getElementById('customDialogCancelBtn');
        if (!cancelBtn.classList.contains('hidden')) {
            closeDialog(false);
        } else {
            closeDialog(true);
        }
    }
});

// Premium Toast System
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-2 px-3 py-2 bg-app-surface/95 backdrop-blur border border-app-border shadow-xl rounded-xl pointer-events-auto transform translate-y-[-10px] opacity-0 transition-all duration-300 theme-transition w-full`;
    
    let iconClass = 'ph-check-circle text-emerald-500';
    if (type === 'warning') iconClass = 'ph-warning text-amber-500';
    if (type === 'error') iconClass = 'ph-x-circle text-red-500';
    if (type === 'info') iconClass = 'ph-info text-app-primary';

    toast.innerHTML = `
        <i class="ph ${iconClass} text-sm flex-shrink-0"></i>
        <span class="text-[10px] font-semibold text-app-text whitespace-nowrap overflow-hidden text-ellipsis flex-1">${message}</span>
    `;

    container.appendChild(toast);

    // Fade in
    setTimeout(() => {
        toast.classList.remove('translate-y-[-10px]', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    }, 50);

    // Fade out and remove
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-[-10px]', 'opacity-0');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2500);
}
