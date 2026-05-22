//! SubTranslator 模块 - 负责将抓取到的 YAML/Base64/URI 原始数据转译为 Sing-Box 标准节点格式。

use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use yaml_rust2::{YamlLoader, Yaml};

/// Sing-Box 标准出站节点配置的 Rust 强类型枚举映射
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SingBoxOutbound {
    Shadowsocks {
        tag: String,
        server: String,
        server_port: u16,
        method: String,
        password: String,
    },
    Vless {
        tag: String,
        server: String,
        server_port: u16,
        uuid: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        flow: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tls: Option<TlsConfig>,
        #[serde(skip_serializing_if = "Option::is_none")]
        packet_encoding: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        transport: Option<TransportConfig>,
    },
    Vmess {
        tag: String,
        server: String,
        server_port: u16,
        uuid: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        security: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        alter_id: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tls: Option<TlsConfig>,
        #[serde(skip_serializing_if = "Option::is_none")]
        transport: Option<TransportConfig>,
    },
    Trojan {
        tag: String,
        server: String,
        server_port: u16,
        password: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        tls: Option<TlsConfig>,
        #[serde(skip_serializing_if = "Option::is_none")]
        transport: Option<TransportConfig>,
    },
    Hysteria2 {
        tag: String,
        server: String,
        server_port: u16,
        #[serde(skip_serializing_if = "Option::is_none")]
        password: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tls: Option<TlsConfig>,
        #[serde(skip_serializing_if = "Option::is_none")]
        up_mbps: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        down_mbps: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        obfs: Option<Hysteria2Obfs>,
    },
    Anytls {
        tag: String,
        server: String,
        server_port: u16,
        password: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        tls: Option<TlsConfig>,
        #[serde(skip_serializing_if = "Option::is_none")]
        idle_session_check_interval: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        idle_session_timeout: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        min_idle_session: Option<u32>,
    },
    Socks {
        tag: String,
        server: String,
        server_port: u16,
        #[serde(skip_serializing_if = "Option::is_none")]
        username: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        password: Option<String>,
    },
    Http {
        tag: String,
        server: String,
        server_port: u16,
        #[serde(skip_serializing_if = "Option::is_none")]
        username: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        password: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tls: Option<TlsConfig>,
    },
    Tuic {
        tag: String,
        server: String,
        server_port: u16,
        uuid: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        password: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        congestion_control: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        udp_relay_mode: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        heartbeat: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tls: Option<TlsConfig>,
    },
    Naive {
        tag: String,
        server: String,
        server_port: u16,
        username: String,
        password: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        tls: Option<TlsConfig>,
    },
    Hysteria {
        tag: String,
        server: String,
        server_port: u16,
        #[serde(skip_serializing_if = "Option::is_none")]
        auth_str: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tls: Option<TlsConfig>,
        #[serde(skip_serializing_if = "Option::is_none")]
        up_mbps: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        down_mbps: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        obfs: Option<Hysteria2Obfs>,
    },
    Wireguard {
        tag: String,
        local_address: Vec<String>,
        private_key: String,
        peers: Vec<WireguardPeer>,
        #[serde(skip_serializing_if = "Option::is_none")]
        mtu: Option<u32>,
    },
    Shadowtls {
        tag: String,
        server: String,
        server_port: u16,
        version: u32,
        password: String,
        tls: TlsConfig,
    },
    Direct {
        tag: String,
    },
    Block {
        tag: String,
    },
}

impl SingBoxOutbound {
    pub fn get_server_info(&self) -> Option<(String, u16)> {
        match self {
            SingBoxOutbound::Shadowsocks { server, server_port, .. } => Some((server.clone(), *server_port)),
            SingBoxOutbound::Vless { server, server_port, .. } => Some((server.clone(), *server_port)),
            SingBoxOutbound::Vmess { server, server_port, .. } => Some((server.clone(), *server_port)),
            SingBoxOutbound::Trojan { server, server_port, .. } => Some((server.clone(), *server_port)),
            SingBoxOutbound::Hysteria2 { server, server_port, .. } => Some((server.clone(), *server_port)),
            SingBoxOutbound::Anytls { server, server_port, .. } => Some((server.clone(), *server_port)),
            SingBoxOutbound::Socks { server, server_port, .. } => Some((server.clone(), *server_port)),
            SingBoxOutbound::Http { server, server_port, .. } => Some((server.clone(), *server_port)),
            SingBoxOutbound::Tuic { server, server_port, .. } => Some((server.clone(), *server_port)),
            SingBoxOutbound::Naive { server, server_port, .. } => Some((server.clone(), *server_port)),
            SingBoxOutbound::Hysteria { server, server_port, .. } => Some((server.clone(), *server_port)),
            SingBoxOutbound::Wireguard { peers, .. } => {
                peers.first().map(|p| (p.server.clone(), p.server_port))
            }
            SingBoxOutbound::Shadowtls { server, server_port, .. } => Some((server.clone(), *server_port)),
            SingBoxOutbound::Direct { .. } | SingBoxOutbound::Block { .. } => None,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct TlsConfig {
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub insecure: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alpn: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub utls: Option<UtlsConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reality: Option<RealityConfig>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct UtlsConfig {
    pub enabled: bool,
    pub fingerprint: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct RealityConfig {
    pub enabled: bool,
    pub public_key: String,
    pub short_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TransportConfig {
    Ws {
        path: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        headers: Option<HashMap<String, String>>,
    },
    Grpc {
        service_name: String,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Hysteria2Obfs {
    #[serde(rename = "type")]
    pub obfs_type: String, // e.g. "salamander"
    pub password: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct WireguardPeer {
    pub server: String,
    pub server_port: u16,
    pub public_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pre_shared_key: Option<String>,
    pub allowed_ips: Vec<String>,
}

/// 机场返回的 VMess 链接内部 Base64 解密后的 JSON 结构
/// 机场返回的 VMess 链接内部 Base64 解密后的 JSON 结构
#[derive(Deserialize, Debug)]
struct VmessJson {
    #[serde(default)]
    add: serde_json::Value,
    #[serde(default)]
    port: serde_json::Value, // 有时是 String，有时是 Number，有时是 null
    #[serde(default)]
    id: serde_json::Value,
    #[serde(default)]
    #[allow(dead_code)]
    aid: serde_json::Value,
    #[serde(default)]
    net: serde_json::Value,
    #[serde(default)]
    path: serde_json::Value,
    #[serde(default)]
    host: serde_json::Value,
    #[serde(default)]
    tls: serde_json::Value,
    #[serde(default)]
    ps: serde_json::Value, // 节点 Tag 标签
}

// --- 辅助方法 ---

/// 将任意 serde_json::Value 安全地转为 String，防范 null/number/bool 崩溃
fn value_to_string(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        _ => "".to_string(),
    }
}

/// 100% 健壮的 Base64 解码器，支持标准、URL-Safe 以及缺 Padding 的自动修正
pub fn safe_base64_decode(input: &str) -> Result<Vec<u8>, String> {
    use base64::Engine;
    let cleaned = input.trim()
        .replace('-', "+")
        .replace('_', "/");
    
    // 补齐 Base64 尾部等号 Padding
    let padded = match cleaned.len() % 4 {
        2 => format!("{}==", cleaned),
        3 => format!("{}=", cleaned),
        _ => cleaned,
    };
    
    base64::prelude::BASE64_STANDARD
        .decode(padded)
        .map_err(|e| format!("Base64 decode error: {}", e))
}

/// 纯原生 URL 编解码，100% 离线，避免外部 URL 库引入冲突
pub fn url_decode(input: &str) -> String {
    let mut decoded_bytes = Vec::new();
    let mut bytes = input.as_bytes().iter();
    while let Some(&b) = bytes.next() {
        if b == b'%' {
            if let (Some(&h), Some(&l)) = (bytes.next(), bytes.next()) {
                let hex = vec![h, l];
                if let Ok(hex_str) = String::from_utf8(hex) {
                    if let Ok(val) = u8::from_str_radix(&hex_str, 16) {
                        decoded_bytes.push(val);
                        continue;
                    }
                }
            }
        }
        decoded_bytes.push(b);
    }
    String::from_utf8_lossy(&decoded_bytes).into_owned()
}

// --- 核心 URI 解析器 ---

/// 解析单行分享 URI，生成 SingBoxOutbound 实例
pub fn parse_single_uri(uri: &str) -> Result<SingBoxOutbound, String> {
    let uri = uri.trim();
    if uri.is_empty() {
        return Err("Empty URI".into());
    }

    // 1. 优先解析节点标签 Tag
    let mut tag = "Unnamed Node".to_string();
    let mut remaining = uri;
    if let Some(hash_idx) = uri.find('#') {
        tag = url_decode(&uri[hash_idx + 1..]);
        remaining = &uri[..hash_idx];
    }

    // 2. 切割协议头
    let proto_idx = remaining.find("://")
        .ok_or_else(|| format!("Invalid URI format: missing protocol (://) in {}", uri))?;
    let protocol = &remaining[..proto_idx].to_ascii_lowercase();
    let payload = &remaining[proto_idx + 3..];

    match protocol.as_str() {
        // VMESS 特例：整段为 Base64 JSON
        "vmess" => {
            let decoded_bytes = safe_base64_decode(payload)?;
            let decoded_str = String::from_utf8(decoded_bytes)
                .map_err(|e| format!("VMess JSON is not UTF-8: {}", e))?;
            let vmess_meta: VmessJson = serde_json::from_str(&decoded_str)
                .map_err(|e| format!("VMess JSON parse error: {}", e))?;

            let add = value_to_string(&vmess_meta.add);
            let id = value_to_string(&vmess_meta.id);
            let net = value_to_string(&vmess_meta.net);
            let path = value_to_string(&vmess_meta.path);
            let host = value_to_string(&vmess_meta.host);
            let tls_str = value_to_string(&vmess_meta.tls);
            let ps = value_to_string(&vmess_meta.ps);

            if add.is_empty() || id.is_empty() {
                return Err("VMess is missing address or uuid".into());
            }

            // 端口兼容性解析
            let port = match &vmess_meta.port {
                serde_json::Value::Number(n) => n.as_u64().unwrap_or(443) as u16,
                serde_json::Value::String(s) => s.parse::<u16>().unwrap_or(443),
                _ => 443,
            };

            let node_tag = if !ps.is_empty() { ps } else { tag };

            let tls = if tls_str == "tls" || tls_str == "1" {
                Some(TlsConfig {
                    enabled: true,
                    server_name: Some(host.clone()),
                    insecure: Some(false),
                    alpn: None,
                    utls: Some(UtlsConfig { enabled: true, fingerprint: "chrome".to_string() }),
                    reality: None,
                })
            } else {
                None
            };

            let transport = if net == "ws" {
                let mut headers = HashMap::new();
                if !host.is_empty() {
                    headers.insert("Host".to_string(), host.clone());
                }
                Some(TransportConfig::Ws {
                    path: if path.is_empty() { "/".to_string() } else { path.clone() },
                    headers: if headers.is_empty() { None } else { Some(headers) },
                })
            } else {
                None
            };

            Ok(SingBoxOutbound::Vmess {
                tag: node_tag,
                server: add,
                server_port: port,
                uuid: id,
                security: Some("auto".to_string()),
                alter_id: Some(0),
                tls,
                transport,
            })
        }

        // VLESS, Trojan, Hysteria 2, Shadowsocks, AnyTLS, Socks, Http, Tuic, Naive, Hysteria, Wireguard, Shadowtls 常规协议
        "vless" | "trojan" | "hysteria2" | "ss" | "anytls" | "socks" | "http" | "tuic" | "naive" | "hysteria" | "wireguard" | "shadowtls" => {
            // 切割 Credentials（账号凭证/UUID）与 Server 地址
            let last_at = payload.rfind('@')
                .ok_or_else(|| format!("Invalid URI format: missing '@' in {}", uri))?;
            
            let credentials_raw = &payload[..last_at];
            let server_part = &payload[last_at + 1..];

            // 切割 Server 域名与端口，以及可能存在的 Query 选项
            let mut server_port_part = server_part;
            let mut query_part = "";
            if let Some(q_idx) = server_part.find('?') {
                server_port_part = &server_part[..q_idx];
                query_part = &server_part[q_idx + 1..];
            }

            let colon_idx = server_port_part.rfind(':')
                .ok_or_else(|| format!("Invalid URI format: missing port (:) in {}", uri))?;
            let server_addr = &server_port_part[..colon_idx];
            let server_port = server_port_part[colon_idx + 1..].parse::<u16>()
                .map_err(|e| format!("Invalid port value: {}", e))?;

            // 将 Query 切割成 HashMap 字典
            let mut queries = HashMap::new();
            if !query_part.is_empty() {
                for pair in query_part.split('&') {
                    let mut parts = pair.splitn(2, '=');
                    if let (Some(k), Some(v)) = (parts.next(), parts.next()) {
                        queries.insert(k.to_ascii_lowercase(), url_decode(v));
                    }
                }
            }

            match protocol.as_str() {
                "vless" => {
                    let uuid = credentials_raw.to_string();
                    let flow = queries.get("flow").cloned();
                    
                    let tls = if queries.get("security").map(|s| s.as_str()) == Some("tls") 
                              || queries.get("security").map(|s| s.as_str()) == Some("reality") {
                        let reality = if queries.get("security").map(|s| s.as_str()) == Some("reality") {
                            Some(RealityConfig {
                                enabled: true,
                                public_key: queries.get("pbk").cloned().unwrap_or_default(),
                                short_id: queries.get("sid").cloned().unwrap_or_default(),
                            })
                        } else {
                            None
                        };

                        Some(TlsConfig {
                            enabled: true,
                            server_name: queries.get("sni").cloned(),
                            insecure: Some(queries.get("insecure").map(|s| s == "1" || s == "true").unwrap_or(false)),
                            alpn: None,
                            utls: Some(UtlsConfig {
                                enabled: true,
                                fingerprint: queries.get("fp").cloned().unwrap_or_else(|| "chrome".to_string()),
                            }),
                            reality,
                        })
                    } else {
                        None
                    };

                    let transport = if queries.get("type").map(|s| s.as_str()) == Some("ws") {
                        let mut headers = HashMap::new();
                        if let Some(host) = queries.get("host") {
                            headers.insert("Host".to_string(), host.clone());
                        }
                        Some(TransportConfig::Ws {
                            path: queries.get("path").cloned().unwrap_or_else(|| "/".to_string()),
                            headers: if headers.is_empty() { None } else { Some(headers) },
                        })
                    } else {
                        None
                    };

                    Ok(SingBoxOutbound::Vless {
                        tag,
                        server: server_addr.to_string(),
                        server_port,
                        uuid,
                        flow,
                        tls,
                        packet_encoding: Some("xray".to_string()),
                        transport,
                    })
                }

                "trojan" => {
                    let password = url_decode(credentials_raw);
                    let tls = Some(TlsConfig {
                        enabled: true,
                        server_name: queries.get("sni").cloned(),
                        insecure: Some(queries.get("insecure").map(|s| s == "1" || s == "true").unwrap_or(false)),
                        alpn: None,
                        utls: Some(UtlsConfig { enabled: true, fingerprint: "chrome".to_string() }),
                        reality: None,
                    });

                    Ok(SingBoxOutbound::Trojan {
                        tag,
                        server: server_addr.to_string(),
                        server_port,
                        password,
                        tls,
                        transport: None,
                    })
                }

                "hysteria2" => {
                    let password = if credentials_raw.is_empty() { None } else { Some(url_decode(credentials_raw)) };
                    
                    let obfs = if let (Some(obfs_type), Some(obfs_password)) = (queries.get("obfs"), queries.get("obfs-password")) {
                        Some(Hysteria2Obfs {
                            obfs_type: obfs_type.clone(),
                            password: obfs_password.clone(),
                        })
                    } else {
                        None
                    };

                    let tls = Some(TlsConfig {
                        enabled: true,
                        server_name: queries.get("sni").cloned(),
                        insecure: Some(queries.get("insecure").map(|s| s == "1" || s == "true").unwrap_or(false)),
                        alpn: None,
                        utls: None,
                        reality: None,
                    });

                    Ok(SingBoxOutbound::Hysteria2 {
                        tag,
                        server: server_addr.to_string(),
                        server_port,
                        password,
                        tls,
                        up_mbps: None,
                        down_mbps: None,
                        obfs,
                    })
                }

                "ss" => {
                    // Shadowsocks 凭证处理：可能格式为 Base64(method:password)
                    let decoded_creds = if !credentials_raw.contains(':') {
                        let decoded_bytes = safe_base64_decode(credentials_raw)?;
                        String::from_utf8(decoded_bytes)
                            .map_err(|e| format!("SS credentials not UTF-8: {}", e))?
                    } else {
                        credentials_raw.to_string()
                    };

                    let mut parts = decoded_creds.splitn(2, ':');
                    let method = parts.next().unwrap_or("aes-256-gcm").to_string();
                    let password = parts.next().unwrap_or("").to_string();

                    Ok(SingBoxOutbound::Shadowsocks {
                        tag,
                        server: server_addr.to_string(),
                        server_port,
                        method,
                        password,
                    })
                }

                "anytls" => {
                    let password = url_decode(credentials_raw);
                    
                    let tls = Some(TlsConfig {
                        enabled: true,
                        server_name: queries.get("sni").or_else(|| queries.get("server_name")).cloned(),
                        insecure: Some(queries.get("insecure").map(|s| s == "1" || s == "true").unwrap_or(false)),
                        alpn: None,
                        utls: None,
                        reality: None,
                    });

                    let min_idle_session = queries.get("min_idle_session")
                        .and_then(|s| s.parse::<u32>().ok());

                    Ok(SingBoxOutbound::Anytls {
                        tag,
                        server: server_addr.to_string(),
                        server_port,
                        password,
                        tls,
                        idle_session_check_interval: queries.get("idle_session_check_interval").cloned(),
                        idle_session_timeout: queries.get("idle_session_timeout").cloned(),
                        min_idle_session,
                    })
                }

                "socks" => {
                    let mut parts = credentials_raw.splitn(2, ':');
                    let username = parts.next().filter(|s| !s.is_empty()).map(|s| url_decode(s));
                    let password = parts.next().filter(|s| !s.is_empty()).map(|s| url_decode(s));
                    
                    Ok(SingBoxOutbound::Socks {
                        tag,
                        server: server_addr.to_string(),
                        server_port,
                        username,
                        password,
                    })
                }

                "http" => {
                    let mut parts = credentials_raw.splitn(2, ':');
                    let username = parts.next().filter(|s| !s.is_empty()).map(|s| url_decode(s));
                    let password = parts.next().filter(|s| !s.is_empty()).map(|s| url_decode(s));
                    
                    let tls = if queries.get("security").map(|s| s.as_str()) == Some("tls") {
                        Some(TlsConfig {
                            enabled: true,
                            server_name: queries.get("sni").or_else(|| queries.get("server_name")).cloned(),
                            insecure: Some(queries.get("insecure").map(|s| s == "1" || s == "true").unwrap_or(false)),
                            alpn: None,
                            utls: None,
                            reality: None,
                        })
                    } else {
                        None
                    };

                    Ok(SingBoxOutbound::Http {
                        tag,
                        server: server_addr.to_string(),
                        server_port,
                        username,
                        password,
                        tls,
                    })
                }

                "tuic" => {
                    let mut parts = credentials_raw.splitn(2, ':');
                    let uuid = parts.next().unwrap_or("").to_string();
                    let password = parts.next().map(|s| url_decode(s));
                    
                    let tls = Some(TlsConfig {
                        enabled: true,
                        server_name: queries.get("sni").or_else(|| queries.get("server_name")).cloned(),
                        insecure: Some(queries.get("insecure").map(|s| s == "1" || s == "true").unwrap_or(false)),
                        alpn: None,
                        utls: None,
                        reality: None,
                    });

                    Ok(SingBoxOutbound::Tuic {
                        tag,
                        server: server_addr.to_string(),
                        server_port,
                        uuid,
                        password,
                        congestion_control: queries.get("congestion_control").cloned(),
                        udp_relay_mode: queries.get("udp_relay_mode").cloned(),
                        heartbeat: queries.get("heartbeat").cloned(),
                        tls,
                    })
                }

                "naive" => {
                    let mut parts = credentials_raw.splitn(2, ':');
                    let username = url_decode(parts.next().unwrap_or(""));
                    let password = url_decode(parts.next().unwrap_or(""));
                    
                    let tls = Some(TlsConfig {
                        enabled: true,
                        server_name: queries.get("sni").or_else(|| queries.get("server_name")).cloned(),
                        insecure: Some(queries.get("insecure").map(|s| s == "1" || s == "true").unwrap_or(false)),
                        alpn: None,
                        utls: None,
                        reality: None,
                    });

                    Ok(SingBoxOutbound::Naive {
                        tag,
                        server: server_addr.to_string(),
                        server_port,
                        username,
                        password,
                        tls,
                    })
                }

                "hysteria" => {
                    let auth_str = if credentials_raw.is_empty() { None } else { Some(url_decode(credentials_raw)) };
                    
                    let obfs = if let (Some(obfs_type), Some(obfs_password)) = (queries.get("obfs"), queries.get("obfs-password")) {
                        Some(Hysteria2Obfs {
                            obfs_type: obfs_type.clone(),
                            password: obfs_password.clone(),
                        })
                    } else {
                        None
                    };

                    let tls = Some(TlsConfig {
                        enabled: true,
                        server_name: queries.get("sni").or_else(|| queries.get("server_name")).cloned(),
                        insecure: Some(queries.get("insecure").map(|s| s == "1" || s == "true").unwrap_or(false)),
                        alpn: None,
                        utls: None,
                        reality: None,
                    });

                    let up_mbps = queries.get("up_mbps").or_else(|| queries.get("up")).and_then(|s| s.parse::<u32>().ok());
                    let down_mbps = queries.get("down_mbps").or_else(|| queries.get("down")).and_then(|s| s.parse::<u32>().ok());

                    Ok(SingBoxOutbound::Hysteria {
                        tag,
                        server: server_addr.to_string(),
                        server_port,
                        auth_str,
                        tls,
                        up_mbps,
                        down_mbps,
                        obfs,
                    })
                }

                "wireguard" => {
                    let private_key = url_decode(credentials_raw);
                    let public_key = queries.get("public_key")
                        .or_else(|| queries.get("public-key"))
                        .ok_or_else(|| format!("WireGuard URI is missing 'public_key'"))?.to_string();

                    let local_address_str = queries.get("local_address")
                        .or_else(|| queries.get("local-address"))
                        .cloned()
                        .unwrap_or_else(|| "10.0.0.2/32".to_string());
                    
                    let local_address = if local_address_str.contains('/') {
                        vec![local_address_str]
                    } else if local_address_str.contains(':') {
                        vec![format!("{}/128", local_address_str)]
                    } else {
                        vec![format!("{}/32", local_address_str)]
                    };

                    let pre_shared_key = queries.get("preshared_key")
                        .or_else(|| queries.get("preshared-key"))
                        .cloned();

                    let peer = WireguardPeer {
                        server: server_addr.to_string(),
                        server_port,
                        public_key,
                        pre_shared_key,
                        allowed_ips: vec!["0.0.0.0/0".to_string(), "::/0".to_string()],
                    };

                    Ok(SingBoxOutbound::Wireguard {
                        tag,
                        local_address,
                        private_key,
                        peers: vec![peer],
                        mtu: queries.get("mtu").and_then(|s| s.parse::<u32>().ok()),
                    })
                }

                "shadowtls" => {
                    let password = url_decode(credentials_raw);
                    let version = queries.get("version")
                        .and_then(|s| s.parse::<u32>().ok())
                        .unwrap_or(3);

                    let tls = TlsConfig {
                        enabled: true,
                        server_name: queries.get("sni").or_else(|| queries.get("server_name")).cloned().or_else(|| Some(server_addr.to_string())),
                        insecure: Some(queries.get("insecure").map(|s| s == "1" || s == "true").unwrap_or(false)),
                        alpn: None,
                        utls: None,
                        reality: None,
                    };

                    Ok(SingBoxOutbound::Shadowtls {
                        tag,
                        server: server_addr.to_string(),
                        server_port,
                        version,
                        password,
                        tls,
                    })
                }

                _ => unreachable!(),
            }
        }

        other => Err(format!("Unsupported protocol: {}", other)),
    }
}

/// 解析苹果生态软件专属（Surge / Quantumult X）非标节点格式为 SingBoxOutbound
pub fn parse_apple_node(line: &str) -> Option<SingBoxOutbound> {
    let line = line.trim();
    if line.is_empty() || line.starts_with('#') || line.starts_with(';') || line.starts_with("//") {
        return None;
    }

    // --- 识别 Quantumult X 格式 ---
    // 例如: shadowsocks=1.2.3.4:8388, method=aes-128-gcm, password=pwd, tag=极速SS
    if (line.starts_with("shadowsocks=") || line.starts_with("vmess=") || line.starts_with("trojan=") || line.starts_with("vless=")) && line.contains(',') {
        let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
        if parts.is_empty() { return None; }

        let first_part = parts[0];
        let mut first_split = first_part.splitn(2, '=');
        let protocol = first_split.next()?.trim();
        let server_addr_raw = first_split.next()?.trim();

        let mut addr_split = server_addr_raw.splitn(2, ':');
        let server = addr_split.next()?.to_string();
        let server_port = addr_split.next()?.parse::<u16>().ok()?;

        // 解析其余键值对
        let mut params = HashMap::new();
        for part in &parts[1..] {
            let mut kv = part.splitn(2, '=');
            if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
                params.insert(k.trim().to_string(), v.trim().trim_matches('"').to_string());
            }
        }

        let tag = params.remove("tag").unwrap_or_else(|| format!("{}-{}", protocol, server));

        match protocol {
            "shadowsocks" => {
                let method = params.get("method").cloned().unwrap_or_else(|| "aes-256-gcm".to_string());
                let password = params.get("password").cloned().unwrap_or_default();
                return Some(SingBoxOutbound::Shadowsocks {
                    tag,
                    server,
                    server_port,
                    method,
                    password,
                });
            }
            "vmess" => {
                let uuid = params.get("password").or_else(|| params.get("uuid")).cloned().unwrap_or_default();
                let tls = if params.get("over-tls").map(|s| s == "true").unwrap_or(false) {
                    Some(TlsConfig {
                        enabled: true,
                        server_name: params.get("tls-host").cloned(),
                        insecure: Some(false),
                        alpn: None,
                        utls: None,
                        reality: None,
                    })
                } else {
                    None
                };

                let transport = if params.get("obfs").map(|s| s == "ws").unwrap_or(false) {
                    let path = params.get("obfs-path").cloned().unwrap_or_else(|| "/".to_string());
                    let mut headers = HashMap::new();
                    if let Some(host) = params.get("obfs-header") {
                        if host.starts_with("Host:") {
                            headers.insert("Host".to_string(), host["Host:".len()..].trim().to_string());
                        }
                    }
                    Some(TransportConfig::Ws {
                        path,
                        headers: if headers.is_empty() { None } else { Some(headers) },
                    })
                } else {
                    None
                };

                return Some(SingBoxOutbound::Vmess {
                    tag,
                    server,
                    server_port,
                    uuid,
                    security: Some("auto".to_string()),
                    alter_id: Some(0),
                    tls,
                    transport,
                });
            }
            "trojan" => {
                let password = params.get("password").cloned().unwrap_or_default();
                let tls = Some(TlsConfig {
                    enabled: true,
                    server_name: params.get("tls-host").cloned(),
                    insecure: Some(false),
                    alpn: None,
                    utls: None,
                    reality: None,
                });
                return Some(SingBoxOutbound::Trojan {
                    tag,
                    server,
                    server_port,
                    password,
                    tls,
                    transport: None,
                });
            }
            _ => {}
        }
    }

    // --- 识别 Surge 格式 ---
    // 例如: HK-01 = custom, server, port, encrypt-method, password, http://path/to/cronet.so
    // 或者: HK-02 = trojan, server, port, password=pass, sni=example.com
    if line.contains('=') && line.contains(',') {
        let mut main_split = line.splitn(2, '=');
        let tag = main_split.next()?.trim().to_string();
        let payload = main_split.next()?.trim();

        let parts: Vec<&str> = payload.split(',').map(|s| s.trim()).collect();
        if parts.is_empty() { return None; }

        let protocol = parts[0];
        if protocol == "custom" || protocol == "ss" {
            // custom: tag = custom, server, port, method, password, ...
            if parts.len() >= 5 {
                let server = parts[1].to_string();
                let server_port = parts[2].parse::<u16>().ok()?;
                let method = parts[3].to_string();
                let password = parts[4].to_string();
                return Some(SingBoxOutbound::Shadowsocks {
                    tag,
                    server,
                    server_port,
                    method,
                    password,
                });
            }
        } else if protocol == "trojan" {
            // tag = trojan, server, port, password=..., sni=...
            if parts.len() >= 3 {
                let server = parts[1].to_string();
                let server_port = parts[2].parse::<u16>().ok()?;
                
                let mut params = HashMap::new();
                for part in &parts[3..] {
                    let mut kv = part.splitn(2, '=');
                    if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
                        params.insert(k.trim().to_string(), v.trim().to_string());
                    }
                }
                
                let password = params.get("password").cloned().unwrap_or_default();
                let tls = Some(TlsConfig {
                    enabled: true,
                    server_name: params.get("sni").or_else(|| params.get("servername")).cloned(),
                    insecure: Some(params.get("skip-cert-verify").map(|s| s == "true").unwrap_or(false)),
                    alpn: None,
                    utls: None,
                    reality: None,
                });
                
                return Some(SingBoxOutbound::Trojan {
                    tag,
                    server,
                    server_port,
                    password,
                    tls,
                    transport: None,
                });
            }
        }
    }

    None
}

/// 解析单节点分享 URI 链接列表（支持 \n 或 | 分隔，自动跳过空行，容错解析 Surge/QuanX 格式与广告行）
pub fn translate_nodes(raw_data: &str) -> Result<String, String> {
    let mut outbounds = Vec::new();
    let mut seen = std::collections::HashSet::new();
    
    // 支持按换行符或管道符 "|" 分隔链接（兼容部分机场订阅返回）
    let separators = &['\n', '|'][..];
    for line in raw_data.split(separators) {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        
        let parsed = match parse_single_uri(line) {
            Ok(outbound) => Some(outbound),
            Err(e) => {
                // 如果单节点解析失败，尝试作为苹果特有软件专属节点（Surge / QuanX）解析
                if let Some(outbound) = parse_apple_node(line) {
                    Some(outbound)
                } else {
                    println!("Ignoring unrecognized line or comment: '{}' (Error: {})", line, e);
                    None
                }
            }
        };

        if let Some(outbound) = parsed {
            if let Some(info) = outbound.get_server_info() {
                if !seen.insert(info) {
                    continue; // Duplicate node, skip
                }
            }
            outbounds.push(outbound);
        }
    }
    
    if outbounds.len() > 2000 {
        outbounds.truncate(2000);
    }
    
    serde_json::to_string_pretty(&outbounds)
        .map_err(|e| format!("Failed to serialize outbounds to JSON: {}", e))
}

// --- Clash YAML 配置文件转译解析器 ---

/// 提取 YAML 节点中的 String 类型数据
fn get_yaml_str<'a>(node: &'a Yaml, key: &str) -> Option<&'a str> {
    node[key].as_str()
}

/// 提取 YAML 节点中的 Integer/u16 类型端口
fn get_yaml_port(node: &Yaml) -> Option<u16> {
    let p_node = &node["port"];
    if let Some(val) = p_node.as_i64() {
        return Some(val as u16);
    }
    if let Some(s) = p_node.as_str() {
        return s.parse::<u16>().ok();
    }
    None
}

/// 解析 Clash 格式 YAML 配置文件，提取 proxies 列表并转译为标准的 Sing-Box JSON
pub fn translate_clash_yaml(yaml_content: &str) -> Result<String, String> {
    let docs = YamlLoader::load_from_str(yaml_content)
        .map_err(|e| format!("YAML load failed: {}", e))?;
    
    if docs.is_empty() {
        return Err("Empty YAML document".into());
    }
    
    let doc = &docs[0];
    let proxies_node = &doc["proxies"];
    
    if proxies_node.is_badvalue() {
        return Err("Missing 'proxies' section in Clash YAML".into());
    }
    
    let proxies_arr = proxies_node.as_vec()
        .ok_or_else(|| "The 'proxies' section in Clash YAML is not a sequence (array)")?;
        
    let mut outbounds = Vec::new();
    
    for (idx, p) in proxies_arr.iter().enumerate() {
        let name = get_yaml_str(p, "name")
            .ok_or_else(|| format!("Proxy index {} is missing 'name'", idx))?.to_string();
            
        let proto_type = get_yaml_str(p, "type")
            .ok_or_else(|| format!("Proxy '{}' (index {}) is missing 'type'", name, idx))?.to_ascii_lowercase();
            
        let server = get_yaml_str(p, "server")
            .ok_or_else(|| format!("Proxy '{}' is missing 'server'", name))?.to_string();
            
        let port = get_yaml_port(p)
            .ok_or_else(|| format!("Proxy '{}' has missing or invalid 'port'", name))?;
            
        match proto_type.as_str() {
            "ss" => {
                let cipher = get_yaml_str(p, "cipher")
                    .ok_or_else(|| format!("Shadowsocks proxy '{}' is missing 'cipher'", name))?.to_string();
                let password = get_yaml_str(p, "password")
                    .ok_or_else(|| format!("Shadowsocks proxy '{}' is missing 'password'", name))?.to_string();
                    
                outbounds.push(SingBoxOutbound::Shadowsocks {
                    tag: name,
                    server,
                    server_port: port,
                    method: cipher,
                    password,
                });
            }
            
            "vless" => {
                let uuid = get_yaml_str(p, "uuid")
                    .ok_or_else(|| format!("VLESS proxy '{}' is missing 'uuid'", name))?.to_string();
                
                let flow = get_yaml_str(p, "flow").map(|s| s.to_string());
                
                // TLS 提取
                let tls_enabled = p["tls"].as_bool().unwrap_or(false);
                let servername = get_yaml_str(p, "servername").map(|s| s.to_string());
                let reality_pbk = get_yaml_str(p, "public-key").map(|s| s.to_string());
                let reality_sid = get_yaml_str(p, "short-id").map(|s| s.to_string());
                
                let tls = if tls_enabled || reality_pbk.is_some() {
                    let reality = reality_pbk.map(|pbk| RealityConfig {
                        enabled: true,
                        public_key: pbk,
                        short_id: reality_sid.unwrap_or_default(),
                    });
                    
                    Some(TlsConfig {
                        enabled: true,
                        server_name: servername,
                        insecure: Some(p["skip-cert-verify"].as_bool().unwrap_or(false)),
                        alpn: None,
                        utls: Some(UtlsConfig {
                            enabled: true,
                            fingerprint: get_yaml_str(p, "client-fingerprint").unwrap_or("chrome").to_string(),
                        }),
                        reality,
                    })
                } else {
                    None
                };
                
                // 传输协议提取 (Clash network)
                let network = get_yaml_str(p, "network").unwrap_or("tcp");
                let transport = if network == "ws" {
                    let ws_opts = &p["ws-opts"];
                    let path = get_yaml_str(ws_opts, "path").unwrap_or("/").to_string();
                    let mut headers = HashMap::new();
                    if let Some(host) = get_yaml_str(&ws_opts["headers"], "Host") {
                        headers.insert("Host".to_string(), host.to_string());
                    }
                    
                    Some(TransportConfig::Ws {
                        path,
                        headers: if headers.is_empty() { None } else { Some(headers) },
                    })
                } else if network == "grpc" {
                    let grpc_opts = &p["grpc-opts"];
                    let service_name = get_yaml_str(grpc_opts, "grpc-service-name").unwrap_or("").to_string();
                    Some(TransportConfig::Grpc { service_name })
                } else {
                    None
                };
                
                outbounds.push(SingBoxOutbound::Vless {
                    tag: name,
                    server,
                    server_port: port,
                    uuid,
                    flow,
                    tls,
                    packet_encoding: Some("xray".to_string()),
                    transport,
                });
            }
            
            "vmess" => {
                let uuid = get_yaml_str(p, "uuid")
                    .ok_or_else(|| format!("VMess proxy '{}' is missing 'uuid'", name))?.to_string();
                let security = Some(get_yaml_str(p, "cipher").unwrap_or("auto").to_string());
                let alter_id = Some(p["alterId"].as_i64().unwrap_or(0) as u32);
                
                let tls_enabled = p["tls"].as_bool().unwrap_or(false);
                let servername = get_yaml_str(p, "servername").map(|s| s.to_string());
                let tls = if tls_enabled {
                    Some(TlsConfig {
                        enabled: true,
                        server_name: servername,
                        insecure: Some(p["skip-cert-verify"].as_bool().unwrap_or(false)),
                        alpn: None,
                        utls: Some(UtlsConfig { enabled: true, fingerprint: "chrome".to_string() }),
                        reality: None,
                    })
                } else {
                    None
                };
                
                let network = get_yaml_str(p, "network").unwrap_or("tcp");
                let transport = if network == "ws" {
                    let ws_opts = &p["ws-opts"];
                    let path = get_yaml_str(ws_opts, "path").unwrap_or("/").to_string();
                    let mut headers = HashMap::new();
                    if let Some(host) = get_yaml_str(&ws_opts["headers"], "Host") {
                        headers.insert("Host".to_string(), host.to_string());
                    }
                    Some(TransportConfig::Ws {
                        path,
                        headers: if headers.is_empty() { None } else { Some(headers) },
                    })
                } else {
                    None
                };
                
                outbounds.push(SingBoxOutbound::Vmess {
                    tag: name,
                    server,
                    server_port: port,
                    uuid,
                    security,
                    alter_id,
                    tls,
                    transport,
                });
            }
            
            "trojan" => {
                let password = get_yaml_str(p, "password")
                    .ok_or_else(|| format!("Trojan proxy '{}' is missing 'password'", name))?.to_string();
                
                let tls = Some(TlsConfig {
                    enabled: true,
                    server_name: get_yaml_str(p, "sni").or_else(|| get_yaml_str(p, "servername")).map(|s| s.to_string()),
                    insecure: Some(p["skip-cert-verify"].as_bool().unwrap_or(false)),
                    alpn: None,
                    utls: Some(UtlsConfig { enabled: true, fingerprint: "chrome".to_string() }),
                    reality: None,
                });
                
                outbounds.push(SingBoxOutbound::Trojan {
                    tag: name,
                    server,
                    server_port: port,
                    password,
                    tls,
                    transport: None,
                });
            }
            
            "hysteria2" => {
                let password = get_yaml_str(p, "password").or_else(|| get_yaml_str(p, "auth-str")).map(|s| s.to_string());
                
                let tls = Some(TlsConfig {
                    enabled: true,
                    server_name: get_yaml_str(p, "sni").map(|s| s.to_string()),
                    insecure: Some(p["skip-cert-verify"].as_bool().unwrap_or(false)),
                    alpn: None,
                    utls: None,
                    reality: None,
                });
                
                let obfs = if let (Some(obfs_type), Some(obfs_password)) = (get_yaml_str(p, "obfs"), get_yaml_str(p, "obfs-password")) {
                    Some(Hysteria2Obfs {
                        obfs_type: obfs_type.to_string(),
                        password: obfs_password.to_string(),
                    })
                } else {
                    None
                };
                
                outbounds.push(SingBoxOutbound::Hysteria2 {
                    tag: name,
                    server,
                    server_port: port,
                    password,
                    tls,
                    up_mbps: p["up"].as_i64().map(|n| n as u32),
                    down_mbps: p["down"].as_i64().map(|n| n as u32),
                    obfs,
                });
            }
            
            "anytls" => {
                let password = get_yaml_str(p, "password")
                    .ok_or_else(|| format!("AnyTLS proxy '{}' is missing 'password'", name))?.to_string();
                
                let tls = Some(TlsConfig {
                    enabled: true,
                    server_name: get_yaml_str(p, "sni")
                        .or_else(|| get_yaml_str(p, "servername"))
                        .map(|s| s.to_string())
                        .or_else(|| Some(server.clone())),
                    insecure: Some(p["skip-cert-verify"].as_bool().unwrap_or(false)),
                    alpn: None,
                    utls: None,
                    reality: None,
                });
                
                let idle_session_check_interval = get_yaml_str(p, "idle-session-check-interval").map(|s| s.to_string());
                let idle_session_timeout = get_yaml_str(p, "idle-session-timeout").map(|s| s.to_string());
                let min_idle_session = p["min-idle-sessions"].as_i64().map(|n| n as u32);

                outbounds.push(SingBoxOutbound::Anytls {
                    tag: name,
                    server,
                    server_port: port,
                    password,
                    tls,
                    idle_session_check_interval,
                    idle_session_timeout,
                    min_idle_session,
                });
            }
            
            "socks" => {
                let username = get_yaml_str(p, "username").map(|s| s.to_string());
                let password = get_yaml_str(p, "password").map(|s| s.to_string());
                
                outbounds.push(SingBoxOutbound::Socks {
                    tag: name,
                    server,
                    server_port: port,
                    username,
                    password,
                });
            }
            
            "http" => {
                let username = get_yaml_str(p, "username").map(|s| s.to_string());
                let password = get_yaml_str(p, "password").map(|s| s.to_string());
                
                let tls = if p["tls"].as_bool().unwrap_or(false) {
                    Some(TlsConfig {
                        enabled: true,
                        server_name: get_yaml_str(p, "sni").or_else(|| get_yaml_str(p, "servername")).map(|s| s.to_string()),
                        insecure: Some(p["skip-cert-verify"].as_bool().unwrap_or(false)),
                        alpn: None,
                        utls: None,
                        reality: None,
                    })
                } else {
                    None
                };

                outbounds.push(SingBoxOutbound::Http {
                    tag: name,
                    server,
                    server_port: port,
                    username,
                    password,
                    tls,
                });
            }
            
            "tuic" => {
                let uuid = get_yaml_str(p, "uuid")
                    .ok_or_else(|| format!("TUIC proxy '{}' is missing 'uuid'", name))?.to_string();
                let password = get_yaml_str(p, "password").map(|s| s.to_string());
                
                let tls = Some(TlsConfig {
                    enabled: true,
                    server_name: get_yaml_str(p, "sni").or_else(|| get_yaml_str(p, "servername")).map(|s| s.to_string()),
                    insecure: Some(p["skip-cert-verify"].as_bool().unwrap_or(false)),
                    alpn: None,
                    utls: None,
                    reality: None,
                });

                outbounds.push(SingBoxOutbound::Tuic {
                    tag: name,
                    server,
                    server_port: port,
                    uuid,
                    password,
                    congestion_control: get_yaml_str(p, "congestion-controller").or_else(|| get_yaml_str(p, "congestion_control")).map(|s| s.to_string()),
                    udp_relay_mode: get_yaml_str(p, "udp-relay-mode").or_else(|| get_yaml_str(p, "udp_relay_mode")).map(|s| s.to_string()),
                    heartbeat: get_yaml_str(p, "heartbeat-interval").or_else(|| get_yaml_str(p, "heartbeat")).map(|s| s.to_string()),
                    tls,
                });
            }
            
            "naive" => {
                let username = get_yaml_str(p, "username")
                    .ok_or_else(|| format!("Naive proxy '{}' is missing 'username'", name))?.to_string();
                let password = get_yaml_str(p, "password")
                    .ok_or_else(|| format!("Naive proxy '{}' is missing 'password'", name))?.to_string();
                
                let tls = Some(TlsConfig {
                    enabled: true,
                    server_name: get_yaml_str(p, "sni")
                        .or_else(|| get_yaml_str(p, "servername"))
                        .map(|s| s.to_string())
                        .or_else(|| Some(server.clone())),
                    insecure: Some(p["skip-cert-verify"].as_bool().unwrap_or(false)),
                    alpn: None,
                    utls: None,
                    reality: None,
                });

                outbounds.push(SingBoxOutbound::Naive {
                    tag: name,
                    server,
                    server_port: port,
                    username,
                    password,
                    tls,
                });
            }
            
            "hysteria" => {
                let auth_str = get_yaml_str(p, "auth-str")
                    .or_else(|| get_yaml_str(p, "auth_str"))
                    .or_else(|| get_yaml_str(p, "password"))
                    .map(|s| s.to_string());
                
                let obfs = if let (Some(obfs_type), Some(obfs_password)) = (get_yaml_str(p, "obfs"), get_yaml_str(p, "obfs-password")) {
                    Some(Hysteria2Obfs {
                        obfs_type: obfs_type.to_string(),
                        password: obfs_password.to_string(),
                    })
                } else {
                    None
                };

                let tls = Some(TlsConfig {
                    enabled: true,
                    server_name: get_yaml_str(p, "sni").or_else(|| get_yaml_str(p, "servername")).map(|s| s.to_string()),
                    insecure: Some(p["skip-cert-verify"].as_bool().unwrap_or(false)),
                    alpn: None,
                    utls: None,
                    reality: None,
                });

                let up_mbps = p["up"].as_i64().map(|n| n as u32);
                let down_mbps = p["down"].as_i64().map(|n| n as u32);

                outbounds.push(SingBoxOutbound::Hysteria {
                    tag: name,
                    server,
                    server_port: port,
                    auth_str,
                    tls,
                    up_mbps,
                    down_mbps,
                    obfs,
                });
            }
            
            "wireguard" => {
                let local_address_str = get_yaml_str(p, "ip")
                    .or_else(|| get_yaml_str(p, "local-address"))
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| "10.0.0.2/32".to_string());
                
                let local_address = if local_address_str.contains('/') {
                    vec![local_address_str]
                } else if local_address_str.contains(':') {
                    vec![format!("{}/128", local_address_str)]
                } else {
                    vec![format!("{}/32", local_address_str)]
                };

                let private_key = get_yaml_str(p, "private-key")
                    .or_else(|| get_yaml_str(p, "private_key"))
                    .ok_or_else(|| format!("WireGuard proxy '{}' is missing 'private-key'", name))?.to_string();

                let public_key = get_yaml_str(p, "public-key")
                    .or_else(|| get_yaml_str(p, "public_key"))
                    .ok_or_else(|| format!("WireGuard proxy '{}' is missing 'public-key'", name))?.to_string();

                let pre_shared_key = get_yaml_str(p, "preshared-key")
                    .or_else(|| get_yaml_str(p, "preshared_key"))
                    .map(|s| s.to_string());

                let peer = WireguardPeer {
                    server: server.clone(),
                    server_port: port,
                    public_key,
                    pre_shared_key,
                    allowed_ips: vec!["0.0.0.0/0".to_string(), "::/0".to_string()],
                };

                outbounds.push(SingBoxOutbound::Wireguard {
                    tag: name,
                    local_address,
                    private_key,
                    peers: vec![peer],
                    mtu: p["mtu"].as_i64().map(|n| n as u32),
                });
            }
            
            "shadowtls" => {
                let password = get_yaml_str(p, "password")
                    .ok_or_else(|| format!("ShadowTLS proxy '{}' is missing 'password'", name))?.to_string();
                
                let version = p["version"].as_i64().unwrap_or(3) as u32;

                let tls = TlsConfig {
                    enabled: true,
                    server_name: get_yaml_str(p, "sni")
                        .or_else(|| get_yaml_str(p, "servername"))
                        .map(|s| s.to_string())
                        .or_else(|| Some(server.clone())),
                    insecure: Some(p["skip-cert-verify"].as_bool().unwrap_or(false)),
                    alpn: None,
                    utls: None,
                    reality: None,
                };

                outbounds.push(SingBoxOutbound::Shadowtls {
                    tag: name,
                    server,
                    server_port: port,
                    version,
                    password,
                    tls,
                });
            }
            
            other => {
                println!("Skipping unsupported proxy protocol '{}' for node '{}'", other, name);
            }
        }
    }
    
    let mut unique_outbounds = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for outbound in outbounds {
        if let Some(info) = outbound.get_server_info() {
            if seen.insert(info) {
                unique_outbounds.push(outbound);
            }
        } else {
            unique_outbounds.push(outbound);
        }
    }
    if unique_outbounds.len() > 2000 {
        unique_outbounds.truncate(2000);
    }
    let outbounds = unique_outbounds;
    
    serde_json::to_string_pretty(&outbounds)
        .map_err(|e| format!("Failed to serialize Clash outbounds: {}", e))
}

// --- 100% 离线脱敏单元测试集 ---
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_single_uri_shadowsocks() {
        // 凭证使用 Base64 编码: aes-128-gcm:password -> YWVzLTEyOC1nY206cGFzc3dvcmQ=
        let link = "ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#SS%E8%8A%82%E7%82%B9-01";
        let parsed = parse_single_uri(link).unwrap();
        
        match parsed {
            SingBoxOutbound::Shadowsocks { tag, server, server_port, method, password } => {
                assert_eq!(tag, "SS节点-01");
                assert_eq!(server, "1.2.3.4");
                assert_eq!(server_port, 8388);
                assert_eq!(method, "aes-128-gcm");
                assert_eq!(password, "password");
            }
            _ => panic!("Expected Shadowsocks outbound"),
        }
    }

    #[test]
    fn test_parse_single_uri_vless_reality() {
        let link = "vless://96b27e8d-71b5-4089-8d77-ff4a7d79b940@5.6.7.8:443?security=reality&sni=example.com&pbk=key_public&sid=short_id_01&flow=xtls-rprx-vision#Vless-Reality";
        let parsed = parse_single_uri(link).unwrap();

        match parsed {
            SingBoxOutbound::Vless { tag, server, server_port, uuid, flow, tls, transport, .. } => {
                assert_eq!(tag, "Vless-Reality");
                assert_eq!(server, "5.6.7.8");
                assert_eq!(server_port, 443);
                assert_eq!(uuid, "96b27e8d-71b5-4089-8d77-ff4a7d79b940");
                assert_eq!(flow, Some("xtls-rprx-vision".to_string()));
                assert!(transport.is_none());
                
                let tls_cfg = tls.unwrap();
                assert!(tls_cfg.enabled);
                assert_eq!(tls_cfg.server_name, Some("example.com".to_string()));
                
                let reality_cfg = tls_cfg.reality.unwrap();
                assert!(reality_cfg.enabled);
                assert_eq!(reality_cfg.public_key, "key_public");
                assert_eq!(reality_cfg.short_id, "short_id_01");
            }
            _ => panic!("Expected VLESS outbound"),
        }
    }

    #[test]
    fn test_parse_single_uri_hysteria2() {
        let link = "hysteria2://mypassword@13.14.15.16:443?sni=fast.net&obfs=salamander&obfs-password=obfspass#Hy2%20Fast%20Node";
        let parsed = parse_single_uri(link).unwrap();

        match parsed {
            SingBoxOutbound::Hysteria2 { tag, server, server_port, password, tls, obfs, .. } => {
                assert_eq!(tag, "Hy2 Fast Node");
                assert_eq!(server, "13.14.15.16");
                assert_eq!(server_port, 443);
                assert_eq!(password, Some("mypassword".to_string()));
                
                let tls_cfg = tls.unwrap();
                assert_eq!(tls_cfg.server_name, Some("fast.net".to_string()));
                
                let obfs_cfg = obfs.unwrap();
                assert_eq!(obfs_cfg.obfs_type, "salamander");
                assert_eq!(obfs_cfg.password, "obfspass");
            }
            _ => panic!("Expected Hysteria 2 outbound"),
        }
    }

    #[test]
    fn test_parse_single_uri_anytls() {
        let link = "anytls://anytlspassword@any.server.xyz:8443?sni=any.server.xyz&insecure=true&min_idle_session=3#AnyTls-Node";
        let parsed = parse_single_uri(link).unwrap();

        match parsed {
            SingBoxOutbound::Anytls { tag, server, server_port, password, tls, min_idle_session, .. } => {
                assert_eq!(tag, "AnyTls-Node");
                assert_eq!(server, "any.server.xyz");
                assert_eq!(server_port, 8443);
                assert_eq!(password, "anytlspassword");
                
                let tls_cfg = tls.unwrap();
                assert!(tls_cfg.enabled);
                assert_eq!(tls_cfg.server_name, Some("any.server.xyz".to_string()));
                assert_eq!(tls_cfg.insecure, Some(true));
                
                assert_eq!(min_idle_session, Some(3));
            }
            _ => panic!("Expected AnyTLS outbound"),
        }
    }

    #[test]
    fn test_parse_single_uri_extended_protocols() {
        // Test Socks URI
        let link_socks = "socks://myuser:mypass@1.1.1.1:1080#Socks-Node";
        let parsed_socks = parse_single_uri(link_socks).unwrap();
        match parsed_socks {
            SingBoxOutbound::Socks { tag, server, server_port, username, password } => {
                assert_eq!(tag, "Socks-Node");
                assert_eq!(server, "1.1.1.1");
                assert_eq!(server_port, 1080);
                assert_eq!(username, Some("myuser".to_string()));
                assert_eq!(password, Some("mypass".to_string()));
            }
            _ => panic!("Expected Socks outbound"),
        }

        // Test HTTP URI with TLS
        let link_http = "http://myuser:mypass@2.2.2.2:8080?security=tls&sni=http.proxy.net&insecure=true#Http-Node";
        let parsed_http = parse_single_uri(link_http).unwrap();
        match parsed_http {
            SingBoxOutbound::Http { tag, server, server_port, username, password, tls } => {
                assert_eq!(tag, "Http-Node");
                assert_eq!(server, "2.2.2.2");
                assert_eq!(server_port, 8080);
                assert_eq!(username, Some("myuser".to_string()));
                assert_eq!(password, Some("mypass".to_string()));
                let tls_cfg = tls.unwrap();
                assert!(tls_cfg.enabled);
                assert_eq!(tls_cfg.server_name, Some("http.proxy.net".to_string()));
                assert_eq!(tls_cfg.insecure, Some(true));
            }
            _ => panic!("Expected HTTP outbound"),
        }

        // Test TUIC URI
        let link_tuic = "tuic://myuuid:mypassword@3.3.3.3:443?congestion_control=bbr&udp_relay_mode=native#Tuic-Node";
        let parsed_tuic = parse_single_uri(link_tuic).unwrap();
        match parsed_tuic {
            SingBoxOutbound::Tuic { tag, server, server_port, uuid, password, congestion_control, udp_relay_mode, .. } => {
                assert_eq!(tag, "Tuic-Node");
                assert_eq!(server, "3.3.3.3");
                assert_eq!(server_port, 443);
                assert_eq!(uuid, "myuuid");
                assert_eq!(password, Some("mypassword".to_string()));
                assert_eq!(congestion_control, Some("bbr".to_string()));
                assert_eq!(udp_relay_mode, Some("native".to_string()));
            }
            _ => panic!("Expected TUIC outbound"),
        }

        // Test Naive URI
        let link_naive = "naive://user:pass@4.4.4.4:443?sni=naive.server.com#Naive-Node";
        let parsed_naive = parse_single_uri(link_naive).unwrap();
        match parsed_naive {
            SingBoxOutbound::Naive { tag, server, server_port, username, password, tls } => {
                assert_eq!(tag, "Naive-Node");
                assert_eq!(server, "4.4.4.4");
                assert_eq!(server_port, 443);
                assert_eq!(username, "user");
                assert_eq!(password, "pass");
                let tls_cfg = tls.unwrap();
                assert!(tls_cfg.enabled);
                assert_eq!(tls_cfg.server_name, Some("naive.server.com".to_string()));
            }
            _ => panic!("Expected Naive outbound"),
        }

        // Test Hysteria 1 URI
        let link_hysteria = "hysteria://authstring@5.5.5.5:443?up=10&down=50&obfs=salamander&obfs-password=obfspass#Hysteria-Node";
        let parsed_hysteria = parse_single_uri(link_hysteria).unwrap();
        match parsed_hysteria {
            SingBoxOutbound::Hysteria { tag, server, server_port, auth_str, up_mbps, down_mbps, obfs, .. } => {
                assert_eq!(tag, "Hysteria-Node");
                assert_eq!(server, "5.5.5.5");
                assert_eq!(server_port, 443);
                assert_eq!(auth_str, Some("authstring".to_string()));
                assert_eq!(up_mbps, Some(10));
                assert_eq!(down_mbps, Some(50));
                let obfs_cfg = obfs.unwrap();
                assert_eq!(obfs_cfg.obfs_type, "salamander");
                assert_eq!(obfs_cfg.password, "obfspass");
            }
            _ => panic!("Expected Hysteria outbound"),
        }
        // Test WireGuard URI
        let link_wg = "wireguard://my_privatekey@6.6.6.6:51820?public_key=peer_pubkey&local_address=10.0.0.2&preshared_key=my_presharedkey&mtu=1420#WireGuard-Node";
        let parsed_wg = parse_single_uri(link_wg).unwrap();
        match parsed_wg {
            SingBoxOutbound::Wireguard { tag, local_address, private_key, peers, mtu } => {
                assert_eq!(tag, "WireGuard-Node");
                assert_eq!(local_address, vec!["10.0.0.2/32"]);
                assert_eq!(private_key, "my_privatekey");
                assert_eq!(peers.len(), 1);
                assert_eq!(peers[0].server, "6.6.6.6");
                assert_eq!(peers[0].server_port, 51820);
                assert_eq!(peers[0].public_key, "peer_pubkey");
                assert_eq!(peers[0].pre_shared_key, Some("my_presharedkey".to_string()));
                assert_eq!(mtu, Some(1420));
            }
            _ => panic!("Expected WireGuard outbound"),
        }

        // Test ShadowTLS URI
        let link_shadowtls = "shadowtls://shadow_pwd@7.7.7.7:443?version=3&sni=example.com#ShadowTLS-Node";
        let parsed_shadowtls = parse_single_uri(link_shadowtls).unwrap();
        match parsed_shadowtls {
            SingBoxOutbound::Shadowtls { tag, server, server_port, version, password, tls } => {
                assert_eq!(tag, "ShadowTLS-Node");
                assert_eq!(server, "7.7.7.7");
                assert_eq!(server_port, 443);
                assert_eq!(version, 3);
                assert_eq!(password, "shadow_pwd");
                assert_eq!(tls.server_name, Some("example.com".to_string()));
            }
            _ => panic!("Expected ShadowTLS outbound"),
        }
    }

    #[test]
    fn test_translate_clash_yaml() {
        let clash_yaml = r#"
port: 7890
socks-port: 7891
mixed-port: 7892
allow-lan: true
mode: rule
log-level: info
proxies:
  - name: "香港SS节点"
    type: ss
    server: 1.1.1.1
    port: 8388
    cipher: aes-256-gcm
    password: "sspassword"
  - name: "新加坡VLESS"
    type: vless
    server: 2.2.2.2
    port: 443
    uuid: "vless-uuid-1234"
    tls: true
    servername: sg.vless.net
    client-fingerprint: chrome
    network: ws
    ws-opts:
      path: "/vless-ws"
      headers:
        Host: sg.vless.net
  - name: "保密AnyTLS节点"
    type: anytls
    server: any.server.xyz
    port: 8443
    password: "anytlspassword"
    skip-cert-verify: true
    min-idle-sessions: 3
  - name: "Socks代理"
    type: socks
    server: 1.2.3.4
    port: 1080
    username: "user"
    password: "pwd"
  - name: "HTTP代理"
    type: http
    server: 5.6.7.8
    port: 8080
    tls: true
    servername: http.net
  - name: "TUIC代理"
    type: tuic
    server: 9.10.11.12
    port: 8443
    uuid: "tuic-uuid-456"
    congestion-controller: bbr
  - name: "Naive代理"
    type: naive
    server: naive.net
    port: 443
    username: "nuser"
    password: "npwd"
  - name: "Hysteria1代理"
    type: hysteria
    server: hy.net
    port: 443
    auth-str: "hyauth"
    up: 10
    down: 50
  - name: "WireGuard代理"
    type: wireguard
    server: wg.net
    port: 51820
    ip: 10.0.0.2
    private-key: my_privatekey
    public-key: peer_pubkey
    preshared-key: my_presharedkey
    mtu: 1420
  - name: "ShadowTLS代理"
    type: shadowtls
    server: shadow.net
    port: 443
    password: "shadow_pwd"
    version: 3
    sni: example.com
  - name: "不受支持的旧SSR节点"
    type: ssr
    server: 3.3.3.3
    port: 9000
    protocol: auth_aes128_md5
    obfs: tls1.2_ticket_auth
"#;

        let json_result = translate_clash_yaml(clash_yaml).unwrap();
        let parsed_outbounds: Vec<SingBoxOutbound> = serde_json::from_str(&json_result).unwrap();

        // 应该只有 10 个节点被转译成功，旧的 SSR 应该被安全且静默地忽略过滤掉！
        assert_eq!(parsed_outbounds.len(), 10);

        // 校验第一个 Shadowsocks 节点
        match &parsed_outbounds[0] {
            SingBoxOutbound::Shadowsocks { tag, server, server_port, method, password } => {
                assert_eq!(tag, "香港SS节点");
                assert_eq!(server, "1.1.1.1");
                assert_eq!(*server_port, 8388);
                assert_eq!(method, "aes-256-gcm");
                assert_eq!(password, "sspassword");
            }
            _ => panic!("First node should be Shadowsocks"),
        }

        // 校验第二个 VLESS 节点
        match &parsed_outbounds[1] {
            SingBoxOutbound::Vless { tag, server, server_port, uuid, tls, transport, .. } => {
                assert_eq!(tag, "新加坡VLESS");
                assert_eq!(server, "2.2.2.2");
                assert_eq!(*server_port, 443);
                assert_eq!(uuid, "vless-uuid-1234");
                
                let tls_cfg = tls.as_ref().unwrap();
                assert!(tls_cfg.enabled);
                assert_eq!(tls_cfg.server_name, Some("sg.vless.net".to_string()));
                
                match transport.as_ref().unwrap() {
                    TransportConfig::Ws { path, headers } => {
                        assert_eq!(path, "/vless-ws");
                        let host_header = headers.as_ref().unwrap().get("Host").unwrap();
                        assert_eq!(host_header, "sg.vless.net");
                    }
                    _ => panic!("Expected WebSocket transport"),
                }
            }
            _ => panic!("Second node should be VLESS"),
        }

        // 校验第三个 AnyTLS 节点
        match &parsed_outbounds[2] {
            SingBoxOutbound::Anytls { tag, server, server_port, password, tls, min_idle_session, .. } => {
                assert_eq!(tag, "保密AnyTLS节点");
                assert_eq!(server, "any.server.xyz");
                assert_eq!(*server_port, 8443);
                assert_eq!(password, "anytlspassword");
                
                let tls_cfg = tls.as_ref().unwrap();
                assert!(tls_cfg.enabled);
                assert_eq!(tls_cfg.insecure, Some(true));
                assert_eq!(tls_cfg.server_name, Some("any.server.xyz".to_string()));
                
                assert_eq!(*min_idle_session, Some(3));
            }
            _ => panic!("Third node should be AnyTLS"),
        }

        // 校验第四个 Socks 节点
        match &parsed_outbounds[3] {
            SingBoxOutbound::Socks { tag, server, server_port, username, password } => {
                assert_eq!(tag, "Socks代理");
                assert_eq!(server, "1.2.3.4");
                assert_eq!(*server_port, 1080);
                assert_eq!(username.as_ref().unwrap(), "user");
                assert_eq!(password.as_ref().unwrap(), "pwd");
            }
            _ => panic!("Expected Socks outbound"),
        }

        // 校验第五个 HTTP 节点
        match &parsed_outbounds[4] {
            SingBoxOutbound::Http { tag, server, server_port, username, password, tls } => {
                assert_eq!(tag, "HTTP代理");
                assert_eq!(server, "5.6.7.8");
                assert_eq!(*server_port, 8080);
                assert!(username.is_none());
                assert!(password.is_none());
                let tls_cfg = tls.as_ref().unwrap();
                assert!(tls_cfg.enabled);
                assert_eq!(tls_cfg.server_name, Some("http.net".to_string()));
            }
            _ => panic!("Expected HTTP outbound"),
        }

        // 校验第六个 TUIC 节点
        match &parsed_outbounds[5] {
            SingBoxOutbound::Tuic { tag, server, server_port, uuid, congestion_control, .. } => {
                assert_eq!(tag, "TUIC代理");
                assert_eq!(server, "9.10.11.12");
                assert_eq!(*server_port, 8443);
                assert_eq!(uuid, "tuic-uuid-456");
                assert_eq!(congestion_control.as_ref().unwrap(), "bbr");
            }
            _ => panic!("Expected TUIC outbound"),
        }

        // 校验第七个 Naive 节点
        match &parsed_outbounds[6] {
            SingBoxOutbound::Naive { tag, server, server_port, username, password, tls } => {
                assert_eq!(tag, "Naive代理");
                assert_eq!(server, "naive.net");
                assert_eq!(*server_port, 443);
                assert_eq!(username, "nuser");
                assert_eq!(password, "npwd");
                let tls_cfg = tls.as_ref().unwrap();
                assert!(tls_cfg.enabled);
                assert_eq!(tls_cfg.server_name, Some("naive.net".to_string()));
            }
            _ => panic!("Expected Naive outbound"),
        }

        // 校验第八个 Hysteria 节点
        match &parsed_outbounds[7] {
            SingBoxOutbound::Hysteria { tag, server, server_port, auth_str, up_mbps, down_mbps, .. } => {
                assert_eq!(tag, "Hysteria1代理");
                assert_eq!(server, "hy.net");
                assert_eq!(*server_port, 443);
                assert_eq!(auth_str.as_ref().unwrap(), "hyauth");
                assert_eq!(*up_mbps, Some(10));
                assert_eq!(*down_mbps, Some(50));
            }
            _ => panic!("Expected Hysteria outbound"),
        }

        // 校验第九个 WireGuard 节点
        match &parsed_outbounds[8] {
            SingBoxOutbound::Wireguard { tag, local_address, private_key, peers, mtu } => {
                assert_eq!(tag, "WireGuard代理");
                assert_eq!(local_address, &vec!["10.0.0.2/32".to_string()]);
                assert_eq!(private_key, "my_privatekey");
                assert_eq!(peers.len(), 1);
                assert_eq!(peers[0].server, "wg.net");
                assert_eq!(peers[0].server_port, 51820);
                assert_eq!(peers[0].public_key, "peer_pubkey");
                assert_eq!(peers[0].pre_shared_key.as_ref().unwrap(), "my_presharedkey");
                assert_eq!(*mtu, Some(1420));
            }
            _ => panic!("Expected WireGuard outbound"),
        }

        // 校验第十个 ShadowTLS 节点
        match &parsed_outbounds[9] {
            SingBoxOutbound::Shadowtls { tag, server, server_port, version, password, tls } => {
                assert_eq!(tag, "ShadowTLS代理");
                assert_eq!(server, "shadow.net");
                assert_eq!(*server_port, 443);
                assert_eq!(*version, 3);
                assert_eq!(password, "shadow_pwd");
                assert_eq!(tls.server_name, Some("example.com".to_string()));
            }
            _ => panic!("Expected ShadowTLS outbound"),
        }
    }

    #[test]
    fn test_parse_apple_node() {
        // 1. Surge custom SS
        let surge_ss = "Surge-SS = custom, 8.8.8.8, 8388, aes-256-gcm, sspassword, http://example.com/cronet.so";
        let parsed_ss = parse_apple_node(surge_ss).unwrap();
        match parsed_ss {
            SingBoxOutbound::Shadowsocks { tag, server, server_port, method, password } => {
                assert_eq!(tag, "Surge-SS");
                assert_eq!(server, "8.8.8.8");
                assert_eq!(server_port, 8388);
                assert_eq!(method, "aes-256-gcm");
                assert_eq!(password, "sspassword");
            }
            _ => panic!("Expected Shadowsocks"),
        }

        // 2. Surge Trojan
        let surge_trojan = "Surge-Trojan = trojan, 9.9.9.9, 443, password=trojanpwd, sni=example.com";
        let parsed_tr = parse_apple_node(surge_trojan).unwrap();
        match parsed_tr {
            SingBoxOutbound::Trojan { tag, server, server_port, password, tls, .. } => {
                assert_eq!(tag, "Surge-Trojan");
                assert_eq!(server, "9.9.9.9");
                assert_eq!(server_port, 443);
                assert_eq!(password, "trojanpwd");
                assert_eq!(tls.unwrap().server_name, Some("example.com".to_string()));
            }
            _ => panic!("Expected Trojan"),
        }

        // 3. QuanX SS
        let quanx_ss = "shadowsocks=10.10.10.10:8388, method=chacha20-ietf-poly1305, password=quanxpwd, tag=QuanX-SS";
        let parsed_qss = parse_apple_node(quanx_ss).unwrap();
        match parsed_qss {
            SingBoxOutbound::Shadowsocks { tag, server, server_port, method, password } => {
                assert_eq!(tag, "QuanX-SS");
                assert_eq!(server, "10.10.10.10");
                assert_eq!(server_port, 8388);
                assert_eq!(method, "chacha20-ietf-poly1305");
                assert_eq!(password, "quanxpwd");
            }
            _ => panic!("Expected Shadowsocks"),
        }

        // 4. Comment / Ad line should be ignored
        let ad_line = "🎯 官方频道: t.me/myairport";
        assert!(parse_apple_node(ad_line).is_none());
    }

    #[test]
    fn test_convert_base64_file() {
        use std::fs;
        let base64_content = fs::read_to_string("../test/base64.txt")
            .or_else(|_| fs::read_to_string("test/base64.txt"))
            .or_else(|_| fs::read_to_string("D:/Project/LepoProxy/test/base64.txt"))
            .unwrap();
        
        let trimmed = base64_content.trim();
        let decoded_bytes = safe_base64_decode(trimmed).unwrap();
        let decoded_str = String::from_utf8(decoded_bytes).unwrap();
        
        let json_result = translate_nodes(&decoded_str).unwrap();
        
        fs::write("../test/base64_translated.json", &json_result)
            .or_else(|_| fs::write("test/base64_translated.json", &json_result))
            .or_else(|_| fs::write("D:/Project/LepoProxy/test/base64_translated.json", &json_result))
            .unwrap();
            
        println!("Successfully translated base64.txt into base64_translated.json!");
    }
}
