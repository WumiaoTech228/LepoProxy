// --- 订阅与设置存储管理 ---
export let subscriptionsData = [];
export let currentSubIndex = parseInt(localStorage.getItem('lepo_current_sub_index')) || 0;

export function setCurrentSubIndex(val) {
    currentSubIndex = val;
    localStorage.setItem('lepo_current_sub_index', val);
}

export function saveSubscriptions() {
    localStorage.setItem('lepo_subscriptions', JSON.stringify(subscriptionsData));
}

export function ensureSubNodeTypes(sub) {
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

export function loadSubscriptions() {
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

// 系统设置配置状态
export let systemProxyEnabled = localStorage.getItem('systemProxyEnabled') !== 'false';
export let ipv6Enabled = localStorage.getItem('ipv6Enabled') === 'true';
export let lanEnabled = localStorage.getItem('lanEnabled') === 'true';
export let autoUpdateInterval = parseInt(localStorage.getItem('autoUpdateInterval')) || 0;

export function setSystemProxyEnabled(val) {
    systemProxyEnabled = val;
    localStorage.setItem('systemProxyEnabled', val);
}

export function setIpv6Enabled(val) {
    ipv6Enabled = val;
    localStorage.setItem('ipv6Enabled', val);
}

export function setLanEnabled(val) {
    lanEnabled = val;
    localStorage.setItem('lanEnabled', val);
}

export function setAutoUpdateInterval(val) {
    autoUpdateInterval = val;
    localStorage.setItem('autoUpdateInterval', val);
}

// 自定义分流规则与 DNS 配置
export let customDirectDomains = localStorage.getItem('lepo_custom_direct_domains') || "";
export let customProxyDomains = localStorage.getItem('lepo_custom_proxy_domains') || "";
export let customBlockDomains = localStorage.getItem('lepo_custom_block_domains') || "";
export let dnsLocalServer = localStorage.getItem('lepo_dns_local_server') || "223.5.5.5";
export let dnsRemoteServer = localStorage.getItem('lepo_dns_remote_server') || "tcp://8.8.8.8";

export function setCustomDirectDomains(val) {
    customDirectDomains = val;
    localStorage.setItem('lepo_custom_direct_domains', val);
}

export function setCustomProxyDomains(val) {
    customProxyDomains = val;
    localStorage.setItem('lepo_custom_proxy_domains', val);
}

export function setCustomBlockDomains(val) {
    customBlockDomains = val;
    localStorage.setItem('lepo_custom_block_domains', val);
}

export function setDnsLocalServer(val) {
    dnsLocalServer = val;
    localStorage.setItem('lepo_dns_local_server', val);
}

export function setDnsRemoteServer(val) {
    dnsRemoteServer = val;
    localStorage.setItem('lepo_dns_remote_server', val);
}

export function parseDomainsList(text) {
    if (!text) return [];
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
}

// 自动加载订阅数据
loadSubscriptions();
