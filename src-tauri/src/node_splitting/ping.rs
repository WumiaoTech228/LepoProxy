use std::time::{Instant, Duration};
use tokio::net::TcpSocket;
use tokio::time::timeout;
use serde_json::Value;
use std::net::ToSocketAddrs;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// 判断 IP 是否为私有、环回或本地/未指定地址（手动范围校验以保证在任何 Rust 编译器版本下编译稳定）
fn is_private_or_loopback(ip: std::net::IpAddr) -> bool {
    match ip {
        std::net::IpAddr::V4(ipv4) => {
            let octets = ipv4.octets();
            ipv4.is_loopback() 
            || ipv4.is_unspecified()
            || octets[0] == 10 // 10.0.0.0/8
            || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31) // 172.16.0.0/12
            || (octets[0] == 192 && octets[1] == 168) // 192.168.0.0/16
            || (octets[0] == 169 && octets[1] == 254) // 169.254.0.0/16 (Link-Local)
        }
        std::net::IpAddr::V6(ipv6) => {
            ipv6.is_loopback() 
            || ipv6.is_unspecified()
            || (ipv6.segments()[0] & 0xfe00) == 0xfc00 // fc00::/7 (Unique Local)
            || (ipv6.segments()[0] & 0xffc0) == 0xfe80 // fe80::/10 (Link-Local)
        }
    }
}

/// 智能解析本机真实的物理网卡 IP（排除 Wintun/Meta 虚拟网卡、回环地址和无网关的虚拟网卡）
fn get_local_physical_ip_ipconfig() -> Option<std::net::IpAddr> {
    // 运行 cmd /c chcp 65001 && ipconfig 强制以 UTF-8 编码输出，并通常转换为英文标签以获得高兼容性
    let mut cmd1 = std::process::Command::new("cmd");
    cmd1.args(["/c", "chcp 65001 && ipconfig"]);
    #[cfg(windows)]
    {
        cmd1.creation_flags(0x08000000);
    }
    
    let output = match cmd1.output() {
        Ok(out) => out,
        Err(_) => {
            // 降级兜底：如果 cmd.exe 无法启动，尝试直接调用 ipconfig
            let mut cmd2 = std::process::Command::new("ipconfig");
            #[cfg(windows)]
            {
                cmd2.creation_flags(0x08000000);
            }
            cmd2.output().ok()?
        }
    };

    let text = String::from_utf8_lossy(&output.stdout);
    
    // 基于首行无缩进且以冒号结尾的特征，进行高鲁棒性、语言无关的网卡 Block 块状分割
    let mut blocks = Vec::new();
    let mut current_block = String::new();
    
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        
        // Windows ipconfig 网卡区块头行特征：不以空格或制表符开头，且以冒号 ":" 结尾
        if !line.starts_with(' ') && !line.starts_with('\t') && line.ends_with(':') {
            if !current_block.is_empty() {
                blocks.push(current_block);
            }
            current_block = line.to_string();
        } else if !current_block.is_empty() {
            current_block.push('\n');
            current_block.push_str(line);
        }
    }
    if !current_block.is_empty() {
        blocks.push(current_block);
    }
    
    for block in blocks {
        let block_lower = block.to_lowercase();
        
        // 彻底过滤虚拟/VPN/VMware/VirtualBox 等常见网卡
        let is_virtual = block_lower.contains("lepoproxy")
            || block_lower.contains("wintun")
            || block_lower.contains("loopback")
            || block_lower.contains("meta")
            || block_lower.contains("tun")
            || block_lower.contains("tap")
            || block_lower.contains("vpn")
            || block_lower.contains("virtual")
            || block_lower.contains("vbox")
            || block_lower.contains("vmware")
            || block_lower.contains("host-only")
            || block_lower.contains("pseudo")
            || block_lower.contains("software")
            || block_lower.contains("teredo")
            || block_lower.contains("isatap");
            
        if is_virtual {
            continue;
        }
        
        let mut ip_opt = None;
        let mut has_gateway = false;
        
        for line in block.lines() {
            let line_lower = line.to_lowercase();
            
            // 匹配 IPv4 地址行
            if line.contains("IPv4") {
                if let Some(colon_idx) = line.rfind(':') {
                    let mut ip_str = line[colon_idx + 1..].trim();
                    // 剥离可能存在的 Windows 特有 Preferred/首选 后缀，如 "192.168.1.8(首选)"
                    if let Some(paren_idx) = ip_str.find('(') {
                        ip_str = ip_str[..paren_idx].trim();
                    }
                    if let Ok(ip) = ip_str.parse::<std::net::IpAddr>() {
                        // 校验 IP 是否属于被 TUN 劫持或容器专用的虚拟网段（如 Clash 默认的 198.18.0.0/15 与 Wintun 常见的 172.19.0.0/16 等）
                        let is_virtual_subnet = match ip {
                            std::net::IpAddr::V4(ipv4) => {
                                let octets = ipv4.octets();
                                (octets[0] == 198 && (octets[1] == 18 || octets[1] == 19)) // 198.18.0.0/15 (Clash TUN 默认网段)
                                || (octets[0] == 172 && octets[1] == 19)                  // 172.19.0.0/16 (Wintun)
                                || (octets[0] == 172 && octets[1] == 18)                  // 172.18.0.0/16
                            }
                            _ => false,
                        };
                        if !is_virtual_subnet {
                            ip_opt = Some(ip);
                        }
                    }
                }
            }
            
            // 匹配网关（支持多国语言网关关键字：Gateway、网关、Passerelle、Puerta）
            if line_lower.contains("gateway") || line_lower.contains("网关") || line_lower.contains("passerelle") || line_lower.contains("puerta") {
                if let Some(colon_idx) = line.rfind(':') {
                    let val = line[colon_idx + 1..].trim();
                    // 必须存在非空且非 0.0.0.0 的网关，证明该网卡能路由公网流量
                    if !val.is_empty() && val != "0.0.0.0" {
                        has_gateway = true;
                    }
                }
            }
        }
        
        if let Some(ip) = ip_opt {
            if has_gateway {
                return Some(ip);
            }
        }
    }
    
    // 终极降级兜底：如果在各网卡中没有提取到匹配网关的 IP，则直接从全文提取第一个非环回、非未指定且非虚拟网段的合法 IPv4 地址
    for line in text.lines() {
        if line.contains("IPv4") {
            if let Some(colon_idx) = line.rfind(':') {
                let mut ip_str = line[colon_idx + 1..].trim();
                if let Some(paren_idx) = ip_str.find('(') {
                    ip_str = ip_str[..paren_idx].trim();
                }
                if let Ok(ip) = ip_str.parse::<std::net::IpAddr>() {
                    if !ip.is_loopback() && !ip.is_unspecified() {
                        let is_virtual_subnet = match ip {
                            std::net::IpAddr::V4(ipv4) => {
                                let octets = ipv4.octets();
                                (octets[0] == 198 && (octets[1] == 18 || octets[1] == 19))
                                || (octets[0] == 172 && octets[1] == 19)
                                || (octets[0] == 172 && octets[1] == 18)
                            }
                            _ => false,
                        };
                        if !is_virtual_subnet {
                            return Some(ip);
                        }
                    }
                }
            }
        }
    }
    
    None
}

/// 并发测试所有节点的 TCP 连接延迟，并融合 CDN、协议握手与地理物理特性的智能延迟估算
pub async fn ping_all_nodes(nodes_json: &str) -> Result<String, String> {
    let parsed_nodes: Vec<Value> = serde_json::from_str(nodes_json)
        .map_err(|e| format!("Failed to parse nodes JSON for ping: {}", e))?;

    // 在全局调用一次 ipconfig 获取物理 IP（规避在并发循环中频繁创建进程带来的严重 CPU 抖动）
    let physical_ip = get_local_physical_ip_ipconfig();

    // 构建一个可复用的 reqwest 客户端，跳过 TLS 证书合法性检查，并设置 2.5 秒超时
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(Duration::from_millis(2500))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let mut tasks = Vec::new();

    for node in parsed_nodes {
        let tag = node.get("tag").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let server = node.get("server").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let port = node.get("server_port").and_then(|v| v.as_u64()).unwrap_or(0) as u16;
        let _proto_type = node.get("type").and_then(|v| v.as_str()).unwrap_or("").to_string();
        
        // 提取 TLS 配置
        let has_tls = node.get("tls")
            .and_then(|t| t.get("enabled"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        // 提取是否含有 WS/gRPC 传输协议以判断是否需要进行 CDN 穿透测速
        let has_transport = node.get("transport").is_some();

        if tag.is_empty() || server.is_empty() || port == 0 {
            continue;
        }

        let tag_clone = tag.clone();
        let server_clone = server.clone();
        let server_clone2 = server.clone();
        let client_clone = client.clone();
        let physical_ip_clone = physical_ip;

        let task = tokio::spawn(async move {
            // 1. DNS 预解析与环回地址/局域网私有 IP 拦截
            let resolve_addr = match tokio::task::spawn_blocking(move || {
                (server_clone.as_str(), port).to_socket_addrs().ok()
            }).await {
                Ok(Some(mut addrs)) => {
                    if let Some(first_addr) = addrs.next() {
                        if is_private_or_loopback(first_addr.ip()) {
                            return (tag_clone, -1); // 局域网/环回地址直接过滤（判定为超时）
                        }
                        Some(first_addr)
                    } else {
                        None
                    }
                }
                _ => None,
            };

            let Some(target_addr) = resolve_addr else {
                return (tag_clone, -1);
            };
            let start = Instant::now();
            
            // 2. TCP 握手连接预测试（绑定物理本地 IP 以绕过本地 TUN 虚拟网卡劫持，避免测出 2ms 的假延迟）
            let is_ipv4 = target_addr.is_ipv4();
            let socket = if is_ipv4 {
                TcpSocket::new_v4()
            } else {
                TcpSocket::new_v6()
            };

            let tcp_rtt = match socket {
                Ok(sock) => {
                    if let Some(local_ip) = physical_ip_clone {
                        if local_ip.is_ipv4() == is_ipv4 {
                            let _ = sock.bind(std::net::SocketAddr::new(local_ip, 0));
                        }
                    }
                    match timeout(
                        Duration::from_millis(2500), 
                        sock.connect(target_addr)
                    ).await {
                        Ok(Ok(_)) => start.elapsed().as_millis() as i64,
                        _ => -1,
                    }
                }
                Err(_) => -1,
            };

            if tcp_rtt < 0 {
                return (tag_clone, -1);
            }

            // 3. TLS 节点实施真实端到端 HTTPS 穿透检测以识破 CDN 假死节点
            // 仅对 WS/gRPC 传输协议的节点（常经 CDN）进行 HTTPS 探测，直连 TLS 节点直接返回已完成的 TCP RTT
            if has_tls && has_transport {
                let url = format!("https://{}:{}", server_clone2, port);
                let req_start = Instant::now();
                
                // 绑定到相同的物理本地 IP 绕过本地代理，且关闭 reqwest 的系统代理配置
                let mut builder = reqwest::Client::builder()
                    .danger_accept_invalid_certs(true)
                    .timeout(Duration::from_millis(2500))
                    .redirect(reqwest::redirect::Policy::none())
                    .no_proxy();

                if let Some(local_ip) = physical_ip_clone {
                    if local_ip.is_ipv4() == is_ipv4 {
                        builder = builder.local_address(local_ip);
                    }
                }

                let custom_client = builder.build().unwrap_or(client_clone);

                match custom_client.get(&url).send().await {
                    Ok(resp) => {
                        let status = resp.status().as_u16();
                        // CDN（如 Cloudflare 等）特定错误状态码，证明源站宕机，判定为超时/不可用
                        if status == 502 || status == 504 || status == 520 || status == 521 || status == 523 || status == 525 || status == 526 {
                            (tag_clone, -1)
                        } else {
                            // 返回真实的 HTTPS 往返 RTT 时延
                            (tag_clone, req_start.elapsed().as_millis() as i64)
                        }
                    }
                    Err(e) => {
                        // 若为明确的超时，判定为不可用；如果是 TLS 握手失败/连接重置等协议不匹配问题，直接采用已成功的 TCP RTT 作为延迟
                        if e.is_timeout() {
                            (tag_clone, -1)
                        } else {
                            (tag_clone, tcp_rtt)
                        }
                    }
                }
            } else {
                // 非 TLS 或非 CDN 节点返回物理 TCP RTT
                (tag_clone, tcp_rtt)
            }
        });
        tasks.push(task);
    }

    let mut results = serde_json::Map::new();
    for task in tasks {
        if let Ok((tag, latency)) = task.await {
            results.insert(tag, serde_json::json!(latency));
        }
    }

    serde_json::to_string(&results)
        .map_err(|e| format!("Failed to serialize ping results: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ping_all_nodes_with_dummy() {
        let dummy_nodes = r#"
        [
            {
                "tag": "GoogleDNS-TCP",
                "server": "8.8.8.8",
                "server_port": 53
            },
            {
                "tag": "InvalidHost",
                "server": "999.999.999.999",
                "server_port": 1234
            }
        ]
        "#;

        let result = ping_all_nodes(dummy_nodes).await.unwrap();
        let parsed: serde_json::Map<String, Value> = serde_json::from_str(&result).unwrap();

        // 应当包含两个节点测试结果
        assert!(parsed.contains_key("GoogleDNS-TCP"));
        assert!(parsed.contains_key("InvalidHost"));

        // 无效主机应当必定为超时 (-1)
        assert_eq!(parsed.get("InvalidHost").unwrap().as_i64().unwrap(), -1);
    }
}
