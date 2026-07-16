/**
 * LepoProxy - Standalone Browser Tauri Simulation Layer
 * File: website/client/js/tauri_mock.js
 * 
 * This script injects a robust window.__TAURI__ object, allowing the actual client
 * frontend code to run perfectly in a standard web browser environment without Rust.
 * It simulates all IPC calls, subscription loading, speed tests, and diagnostic actions.
 */

(function () {
    console.log("[TAURI MOCK] Initializing high-fidelity Tauri v2 simulation layer...");

    const eventCallbacks = {};
    let logTimer = null;
    let logSeq = 0;
    
    // Mock Nodes list
    const MOCK_NODES = [
        { "tag": "🇭🇰 香港 IPLC 专线 01", "type": "vmess" },
        { "tag": "🇭🇰 香港 BGP 负载均衡", "type": "vmess" },
        { "tag": "🇯🇵 东京 CN2 GIA 01", "type": "vless" },
        { "tag": "🇯🇵 大阪 2.5G 共享", "type": "vless" },
        { "tag": "🇸🇬 新加坡 专线极速", "type": "trojan" },
        { "tag": "🇺🇸 洛杉矶 BGP 优化", "type": "hysteria2" },
        { "tag": "🇺🇸 圣何塞 10Gbps 宽带", "type": "hysteria2" }
    ];

    // Simulates realistic Sing-Box/Wintun logs
    const LOG_TEMPLATES = [
        () => `[INFO] dns: query www.google.com from remote DNS resolver -> match proxy rules`,
        () => `[INFO] outbound/vmess[香港 IPLC 专线 01]: proxy connection established for tcp:www.google.com:443 -> latency ${Math.floor(Math.random() * 15 + 10)}ms`,
        () => `[INFO] dns: query raw.githubusercontent.com -> match proxy rules`,
        () => `[INFO] outbound/vmess[香港 IPLC 专线 01]: proxy connection established for tcp:raw.githubusercontent.com:443 -> latency ${Math.floor(Math.random() * 20 + 20)}ms`,
        () => `[INFO] dns: query api.openai.com -> match proxy rules`,
        () => `[INFO] outbound/vless[东京 CN2 GIA 01]: proxy connection established for tcp:api.openai.com:443 -> latency ${Math.floor(Math.random() * 15 + 30)}ms`,
        () => `[INFO] dns: query wumiaotech228.github.io (geoip:cn -> direct)`,
        () => `[INFO] outbound/direct[direct]: connection established for tcp:wumiaotech228.github.io:443`,
        () => `[INFO] dns: query static.doubleclick.net (geosite:category-ads-all -> reject)`,
        () => `[WARN] router: packet blocked/rejected by ad-blocker rule for tcp:static.doubleclick.net:443`,
        () => `[INFO] dns: query discord.com -> match proxy rules`,
        () => `[INFO] outbound/trojan[新加坡 专线极速]: proxy connection established for tcp:discord.com:443 -> latency ${Math.floor(Math.random() * 20 + 35)}ms`
    ];

    const START_LOGS = [
        `[INFO] sing-box version 1.9.0-rc.3`,
        `[INFO] loading configuration...`,
        `[INFO] routing: rule[0] matched (geoip:private -> direct)`,
        `[INFO] inbound/mixed[mixed-in]: listen socks on 127.0.0.1:2080`,
        `[INFO] inbound/mixed[mixed-in]: listen http on 127.0.0.1:2080`,
        `[INFO] experimental/tun[tun-in]: initialized wintun driver v0.14`,
        `[INFO] experimental/tun[tun-in]: interface created: LepoTUN (MTU 1500)`,
        `[INFO] experimental/tun[tun-in]: IPv4 address assigned: 172.19.0.1/30`,
        `[INFO] experimental/tun[tun-in]: default route added via interface LepoTUN`,
        `[INFO] sing-box core started successfully`
    ];

    function triggerEvent(eventName, payload) {
        if (eventCallbacks[eventName]) {
            eventCallbacks[eventName].forEach(cb => {
                try {
                    cb({ payload });
                } catch (e) {
                    console.error(`[TAURI MOCK] Error in event listener for ${eventName}:`, e);
                }
            });
        }
    }

    function startMockLogStream() {
        if (logTimer) clearInterval(logTimer);
        logSeq = 0;
        
        // Push initial startup logs instantly
        let delay = 0;
        START_LOGS.forEach(log => {
            setTimeout(() => {
                triggerEvent('core-log', log);
            }, delay);
            delay += 120;
        });

        // Periodically push random network traffic logs
        setTimeout(() => {
            logTimer = setInterval(() => {
                const template = LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)];
                triggerEvent('core-log', template());
            }, 800);
        }, delay + 100);
    }

    function stopMockLogStream() {
        if (logTimer) {
            clearInterval(logTimer);
            logTimer = null;
        }
        triggerEvent('core-log', `[INFO] sing-box core stopped successfully`);
        triggerEvent('core-log', `[INFO] system proxy cleaned up. network interface released.`);
    }

    // Expose window.__TAURI__
    window.__TAURI__ = {
        core: {
            async invoke(command, args) {
                console.log(`[TAURI MOCK IPC] Command: "${command}"`, args);
                
                // Keep simulation realistic with small artificial network delays
                await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

                switch (command) {
                    case 'generate_singbox_config':
                        return JSON.stringify({
                            route: { rules: [] },
                            outbounds: [{ type: "direct", tag: "direct" }]
                        });

                    case 'start_proxy':
                        startMockLogStream();
                        return;

                    case 'stop_proxy':
                        stopMockLogStream();
                        return;

                    case 'run_latency_test':
                        // Simulate a speedtest with a longer realistic wait
                        await new Promise(resolve => setTimeout(resolve, 800));
                        const pingResults = {};
                        MOCK_NODES.forEach(n => {
                            pingResults[n.tag] = Math.floor(Math.random() * 30 + 12);
                        });
                        return JSON.stringify(pingResults);

                    case 'fetch_subscription':
                        return "mock_subscription_raw_content_base64_encoded";

                    case 'translate_raw_nodes':
                        return JSON.stringify({
                            user_info: "Upload: 24.3 GB | Download: 412.5 GB | Total: 1000.0 GB | Expire: 2026-12-31",
                            nodes: MOCK_NODES
                        });

                    case 'set_autostart_enabled':
                    case 'set_tray_checked':
                    case 'set_system_proxy_enabled':
                    case 'hide_window':
                    case 'update_tray_nodes':
                    case 'update_tray_subs':
                        return;

                    default:
                        console.warn(`[TAURI MOCK IPC] Command "${command}" not specifically handled. Returning empty resolution.`);
                        return;
                }
            }
        },
        event: {
            async listen(eventName, callback) {
                console.log(`[TAURI MOCK EVENT] Registered listener for "${eventName}"`);
                if (!eventCallbacks[eventName]) {
                    eventCallbacks[eventName] = [];
                }
                eventCallbacks[eventName].push(callback);

                // Return unlisten function
                return () => {
                    eventCallbacks[eventName] = eventCallbacks[eventName].filter(cb => cb !== callback);
                };
            }
        }
    };
})();
