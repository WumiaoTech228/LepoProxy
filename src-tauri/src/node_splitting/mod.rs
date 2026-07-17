pub mod ping;

use serde::{Serialize, Deserialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
pub struct SingBoxConfig {
    pub log: LogConfig,
    pub dns: DnsConfig,
    pub inbounds: Vec<InboundConfig>,
    pub outbounds: Vec<Value>,
    pub route: RouteConfig,
    pub experimental: ExperimentalConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExperimentalConfig {
    pub clash_api: ClashApiConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClashApiConfig {
    pub external_controller: String,
    pub secret: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LogConfig {
    pub disabled: bool,
    pub level: String,
    pub timestamp: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DnsConfig {
    pub servers: Vec<DnsServer>,
    pub rules: Vec<DnsRule>,
    #[serde(rename = "final")]
    pub final_server: String,
    pub strategy: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DnsServer {
    pub tag: String,
    pub address: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address_resolver: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address_strategy: Option<String>,
    pub detour: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DnsRule {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub geosite: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub outbound: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domain_suffix: Option<Vec<String>>,
    pub server: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InboundConfig {
    #[serde(rename = "type")]
    pub inbound_type: String,
    pub tag: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub listen: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub listen_port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sniff: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sniff_override_destination: Option<bool>,
    // For TUN
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interface_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inet4_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inet6_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_route: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strict_route: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RouteConfig {
    pub rules: Vec<RouteRule>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub final_outbound: Option<String>,
    pub auto_detect_interface: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RouteRule {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub geosite: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub geoip: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domain_suffix: Option<Vec<String>>,
    pub outbound: String,
}

/// 组装完整的 Sing-Box 配置文件，支持三种模式：rule (规则), global (全局), direct (直连)
pub fn assemble_config(
    nodes_json: &str,
    mode: &str,
    active_node: &str,
    local_port: u16,
    tun_enabled: bool,
    ipv6_enabled: bool,
    lan_enabled: bool,
    custom_direct_domains: Option<Vec<String>>,
    custom_proxy_domains: Option<Vec<String>>,
    custom_block_domains: Option<Vec<String>>,
    dns_local_server: Option<String>,
    dns_remote_server: Option<String>,
) -> Result<String, String> {
    // 1. 将翻译好的节点反序列化为动态 JSON Value 数组
    let mut parsed_nodes: Vec<Value> = serde_json::from_str(nodes_json)
        .map_err(|e| format!("Failed to parse nodes JSON: {}", e))?;
    
    // 提取并清理节点 tags，防止与系统内置的 tag 发生冲突导致 sing-box 启动崩溃
    let reserved_tags = ["Proxy", "Auto", "direct", "block", "dns-out", "mixed-in", "tun-in"];
    let mut node_tags = Vec::new();
    for node in &mut parsed_nodes {
        if let Some(tag_val) = node.get_mut("tag") {
            if let Some(tag_str) = tag_val.as_str() {
                let mut clean_tag = tag_str.to_string();
                if reserved_tags.iter().any(|&r| r.eq_ignore_ascii_case(&clean_tag)) {
                    clean_tag = format!("{}_node", clean_tag);
                    *tag_val = serde_json::Value::String(clean_tag.clone());
                }
                node_tags.push(clean_tag);
            }
        }
    }

    if node_tags.is_empty() {
        return Err("No valid nodes found for configuration assembly".into());
    }

    // 2. 构造默认 Outbounds
    let direct_out = serde_json::json!({
        "type": "direct",
        "tag": "direct"
    });
    
    let block_out = serde_json::json!({
        "type": "block",
        "tag": "block"
    });
    
    let dns_out = serde_json::json!({
        "type": "dns",
        "tag": "dns-out"
    });

    // 3. 构造策略组 (Strategy Groups)
    // 手动切换组：包含所有的节点，以及 Auto, Direct
    let mut proxy_out_options = vec!["Auto".to_string()];
    proxy_out_options.extend(node_tags.clone());
    proxy_out_options.push("direct".to_string());

    let mut default_outbound = if active_node.is_empty() {
        "Auto".to_string()
    } else {
        active_node.to_string()
    };

    // 防止 active_node 与系统内置的保留 tag 冲突，进行对应的重命名修正
    let rename_reserved = ["Proxy", "block", "dns-out", "mixed-in", "tun-in"];
    if rename_reserved.iter().any(|&r| r.eq_ignore_ascii_case(&default_outbound)) {
        default_outbound = format!("{}_node", default_outbound);
    }

    let proxy_out = serde_json::json!({
        "type": "selector",
        "tag": "Proxy",
        "outbounds": proxy_out_options,
        "default": default_outbound
    });

    // 自动测速组：包含所有真实节点
    let auto_out = serde_json::json!({
        "type": "urltest",
        "tag": "Auto",
        "outbounds": node_tags,
        "url": "http://cp.cloudflare.com/generate_204",
        "interval": "3m",
        "tolerance": 50
    });

    // 4. 合并所有 Outbounds
    let mut all_outbounds = vec![proxy_out, auto_out, direct_out, block_out, dns_out];
    all_outbounds.append(&mut parsed_nodes);

    // 5. 根据分流模式生成路由配置
    let route_rules = match mode {
        "global" => {
            // 全局模式下，仅保留 DNS 拦截规则，不分流，最终全部路由到最终出口
            vec![
                RouteRule {
                    protocol: Some(vec!["dns".to_string()]),
                    outbound: "dns-out".to_string(),
                    geosite: None,
                    geoip: None,
                    domain_suffix: None,
                }
            ]
        }
        "direct" => {
            // 直连模式下，无需特殊分流，最终全部流量直连
            vec![]
        }
        _ => {
            // 规则分流模式 (Rule Mode)，绕过大陆
            let mut rules = vec![
                RouteRule {
                    protocol: Some(vec!["dns".to_string()]),
                    outbound: "dns-out".to_string(),
                    geosite: None,
                    geoip: None,
                    domain_suffix: None,
                }
            ];

            // 注入自定义拦截规则
            if let Some(ref block_list) = custom_block_domains {
                if !block_list.is_empty() {
                    rules.push(RouteRule {
                        domain_suffix: Some(block_list.clone()),
                        outbound: "block".to_string(),
                        protocol: None,
                        geosite: None,
                        geoip: None,
                    });
                }
            }

            // 注入自定义代理规则
            if let Some(ref proxy_list) = custom_proxy_domains {
                if !proxy_list.is_empty() {
                    rules.push(RouteRule {
                        domain_suffix: Some(proxy_list.clone()),
                        outbound: "Proxy".to_string(),
                        protocol: None,
                        geosite: None,
                        geoip: None,
                    });
                }
            }

            // 注入自定义直连规则
            if let Some(ref direct_list) = custom_direct_domains {
                if !direct_list.is_empty() {
                    rules.push(RouteRule {
                        domain_suffix: Some(direct_list.clone()),
                        outbound: "direct".to_string(),
                        protocol: None,
                        geosite: None,
                        geoip: None,
                    });
                }
            }

            // 默认的大陆直连规则
            rules.push(RouteRule {
                geosite: Some(vec!["cn".to_string()]),
                geoip: Some(vec!["cn".to_string(), "private".to_string()]),
                outbound: "direct".to_string(),
                protocol: None,
                domain_suffix: None,
            });

            rules
        }
    };

    let final_outbound = match mode {
        "direct" => "direct".to_string(),
        _ => "Proxy".to_string(),
    };

    // 动态策略配置
    let dns_strategy = if ipv6_enabled {
        "prefer_ipv6".to_string()
    } else {
        "ipv4_only".to_string()
    };
    let dns_address_strategy = if ipv6_enabled {
        None
    } else {
        Some("ipv4_only".to_string())
    };

    let listen_address = if lan_enabled {
        "0.0.0.0".to_string()
    } else {
        "127.0.0.1".to_string()
    };

    let final_dns_server = if mode == "direct" {
        "dns-local".to_string()
    } else {
        "dns-remote".to_string()
    };

    let dns_remote = match dns_remote_server {
        Some(ref s) if !s.trim().is_empty() => s.clone(),
        _ => "tcp://8.8.8.8".to_string(),
    };
    let dns_local = match dns_local_server {
        Some(ref s) if !s.trim().is_empty() => s.clone(),
        _ => "223.5.5.5".to_string(),
    };

    let config = SingBoxConfig {
        log: LogConfig {
            disabled: false,
            level: "info".to_string(),
            timestamp: true,
        },
        dns: DnsConfig {
            servers: vec![
                DnsServer {
                    tag: "dns-remote".to_string(),
                    address: dns_remote,
                    address_resolver: Some("dns-local".to_string()),
                    address_strategy: dns_address_strategy.clone(),
                    detour: "Proxy".to_string(),
                },
                DnsServer {
                    tag: "dns-local".to_string(),
                    address: dns_local,
                    address_resolver: None,
                    address_strategy: dns_address_strategy.clone(),
                    detour: "direct".to_string(),
                },
            ],
            rules: {
                let mut dns_rules = vec![
                    DnsRule {
                        geosite: Some(vec!["cn".to_string()]),
                        server: "dns-local".to_string(),
                        outbound: None,
                        domain_suffix: None,
                    }
                ];
                if let Some(ref direct_list) = custom_direct_domains {
                    if !direct_list.is_empty() {
                        dns_rules.push(DnsRule {
                            domain_suffix: Some(direct_list.clone()),
                            server: "dns-local".to_string(),
                            geosite: None,
                            outbound: None,
                        });
                    }
                }
                dns_rules.push(DnsRule {
                    outbound: Some(vec!["direct".to_string()]),
                    server: "dns-local".to_string(),
                    geosite: None,
                    domain_suffix: None,
                });
                dns_rules
            },
            final_server: final_dns_server,
            strategy: dns_strategy,
        },
        inbounds: {
            let mut inbounds = vec![
                InboundConfig {
                    inbound_type: "mixed".to_string(),
                    tag: "mixed-in".to_string(),
                    listen: Some(listen_address),
                    listen_port: Some(local_port),
                    sniff: Some(true),
                    sniff_override_destination: Some(true),
                    interface_name: None,
                    inet4_address: None,
                    inet6_address: None,
                    auto_route: None,
                    strict_route: None,
                    stack: None,
                }
            ];
            if tun_enabled {
                inbounds.push(InboundConfig {
                    inbound_type: "tun".to_string(),
                    tag: "tun-in".to_string(),
                    interface_name: Some("lepo_tun".to_string()),
                    inet4_address: Some("172.19.0.1/30".to_string()),
                    inet6_address: Some("fdfe:dcba:9876::1/126".to_string()),
                    auto_route: Some(true),
                    strict_route: Some(false),
                    stack: Some("system".to_string()),
                    sniff: Some(true),
                    sniff_override_destination: Some(true),
                    listen: None,
                    listen_port: None,
                });
            }
            inbounds
        },
        outbounds: all_outbounds,
        route: RouteConfig {
            rules: route_rules,
            final_outbound: Some(final_outbound),
            auto_detect_interface: true,
        },
        experimental: ExperimentalConfig {
            clash_api: ClashApiConfig {
                external_controller: "127.0.0.1:9090".to_string(),
                secret: String::new(),
            },
        },
    };

    serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize final SingBox config: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_assemble_config() {
        let dummy_nodes = r#"
        [
            {
                "type": "vless",
                "tag": "US-Node-1",
                "server": "us.example.com",
                "server_port": 443,
                "uuid": "xxx",
                "tls": { "enabled": true }
            },
            {
                "type": "vmess",
                "tag": "HK-Node-2",
                "server": "hk.example.com",
                "server_port": 8443,
                "uuid": "yyy"
            }
        ]
        "#;

        let result = assemble_config(dummy_nodes, "rule", "Auto", 7890, true, false, false, None, None, None, None, None).unwrap();
        
        let parsed: Value = serde_json::from_str(&result).unwrap();
        
        // 验证基本结构
        assert!(parsed.get("log").is_some());
        assert!(parsed.get("dns").is_some());
        assert!(parsed.get("inbounds").is_some());
        assert!(parsed.get("outbounds").is_some());
        assert!(parsed.get("route").is_some());

        // 验证策略组是否被正确注入
        let outbounds = parsed.get("outbounds").unwrap().as_array().unwrap();
        let proxy_group = outbounds.iter().find(|o| o.get("tag").and_then(|v| v.as_str()) == Some("Proxy")).unwrap();
        
        let proxy_options = proxy_group.get("outbounds").unwrap().as_array().unwrap();
        assert_eq!(proxy_options.len(), 4); // Auto, US-Node-1, HK-Node-2, direct
        assert_eq!(proxy_options[0].as_str().unwrap(), "Auto");
        assert_eq!(proxy_options[1].as_str().unwrap(), "US-Node-1");
        assert_eq!(proxy_options[2].as_str().unwrap(), "HK-Node-2");
        assert_eq!(proxy_options[3].as_str().unwrap(), "direct");

        // 验证真实节点是否在尾部被追加
        assert!(outbounds.iter().any(|o| o.get("tag").and_then(|v| v.as_str()) == Some("US-Node-1")));
        assert!(outbounds.iter().any(|o| o.get("tag").and_then(|v| v.as_str()) == Some("HK-Node-2")));
    }

    #[test]
    fn test_assemble_config_reserved_tags_and_empty_dns() {
        let dummy_nodes = r#"
        [
            {
                "type": "vless",
                "tag": "Proxy",
                "server": "us.example.com",
                "server_port": 443,
                "uuid": "xxx"
            }
        ]
        "#;

        let result = assemble_config(
            dummy_nodes,
            "rule",
            "Proxy",
            7890,
            true,
            false,
            false,
            None,
            None,
            None,
            Some("  ".to_string()),
            Some("".to_string()),
        ).unwrap();

        let parsed: Value = serde_json::from_str(&result).unwrap();

        let outbounds = parsed.get("outbounds").unwrap().as_array().unwrap();
        let proxy_group = outbounds.iter().find(|o| o.get("tag").and_then(|v| v.as_str()) == Some("Proxy")).unwrap();
        assert_eq!(proxy_group.get("default").unwrap().as_str().unwrap(), "Proxy_node");

        let dns = parsed.get("dns").unwrap();
        let servers = dns.get("servers").unwrap().as_array().unwrap();
        let remote_dns = servers.iter().find(|s| s.get("tag").and_then(|v| v.as_str()) == Some("dns-remote")).unwrap();
        let local_dns = servers.iter().find(|s| s.get("tag").and_then(|v| v.as_str()) == Some("dns-local")).unwrap();
        assert_eq!(remote_dns.get("address").unwrap().as_str().unwrap(), "tcp://8.8.8.8");
        assert_eq!(local_dns.get("address").unwrap().as_str().unwrap(), "223.5.5.5");
    }
}
