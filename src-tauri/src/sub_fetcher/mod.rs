//! SubFetcher 模块 - 负责从用户订阅 URL 或公开源（如 GitHub）安全抓取、搜刮订阅内容。

use std::time::Duration;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct SubUserInfo {
    pub upload: u64,
    pub download: u64,
    pub total: u64,
    pub expire: u64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FetchResult {
    pub user_info: Option<SubUserInfo>,
    pub nodes: serde_json::Value,
}

/// 提取并解析 subscription-userinfo 响应头
pub fn parse_user_info(header_val: &str) -> SubUserInfo {
    let mut info = SubUserInfo::default();
    let parts = header_val.split(';');
    for part in parts {
        let part = part.trim();
        if let Some((k, v)) = part.split_once('=') {
            let k = k.trim().to_lowercase();
            let v_num = v.trim().parse::<u64>().unwrap_or(0);
            match k.as_str() {
                "upload" => info.upload = v_num,
                "download" => info.download = v_num,
                "total" => info.total = v_num,
                "expire" => info.expire = v_num,
                _ => {}
            }
        }
    }
    info
}

use std::process::Command;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// 调用 Windows 系统自带的 curl.exe 绕过 Cloudflare WAF 的 JA3/JA4 TLS 指纹拦截
pub fn fetch_via_system_curl(url: &str, ua: &str) -> Result<(String, Option<SubUserInfo>), String> {
    // 动态获取 Windows 系统安装路径，防止非 C 盘系统盘导致执行失败，并自动 fallback 到系统 PATH 路径下的 curl
    let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
    let curl_path = std::path::Path::new(&system_root).join("System32").join("curl.exe");

    let cmd = if curl_path.exists() {
        curl_path.to_string_lossy().into_owned()
    } else {
        "curl".to_string()
    };

    let mut cmd_builder = Command::new(cmd);
    cmd_builder.args([
        "-isL", // 输出 Header + 追踪 301/302 重定向 + 静默模式
        "-m", "15", // 15秒传输超时限制
        "-A", ua,
        url
    ]);
    #[cfg(windows)]
    {
        cmd_builder.creation_flags(0x08000000);
    }

    let output = cmd_builder.output()
        .map_err(|e| format!("Failed to spawn curl: {}", e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("curl.exe exit error: {}", err_msg));
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout).to_string();

    // 智能解析 HTTP 响应头与响应体，防范响应体包含空行被错误截断
    let mut final_header_start = 0;
    let bytes = stdout_str.as_bytes();
    let len = bytes.len();
    
    // 寻找最后一个以 HTTP/ 起始的响应头块位置 (使用纯字节切片比较以防范 UTF-8 字符边界切片 Panic)
    let mut i = 0;
    while i < len {
        if (i == 0 || bytes[i - 1] == b'\n') && i + 5 <= len && &bytes[i..i+5] == b"HTTP/" {
            final_header_start = i;
        }
        i += 1;
    }

    // 寻找该响应头块之后的第一个空行分隔符
    let mut blank_line_idx = None;
    let mut sep_len = 0;
    let mut i = final_header_start;
    while i < len {
        if i + 4 <= len && &bytes[i..i+4] == b"\r\n\r\n" {
            blank_line_idx = Some(i);
            sep_len = 4;
            break;
        } else if i + 2 <= len && &bytes[i..i+2] == b"\n\n" {
            blank_line_idx = Some(i);
            sep_len = 2;
            break;
        }
        i += 1;
    }

    let (headers_part, body_part) = match blank_line_idx {
        Some(idx) => (
            &stdout_str[..idx],
            &stdout_str[idx + sep_len..]
        ),
        None => ("", stdout_str.as_str())
    };

    let body_part = body_part.to_string();
    let mut user_info = None;

    // 解析包含重定向等的所有响应头部分中的 user-info
    for line in headers_part.lines() {
        let line_lower = line.to_lowercase();
        if line_lower.starts_with("subscription-userinfo:") {
            if let Some((_, val)) = line.split_once(':') {
                user_info = Some(parse_user_info(val.trim()));
            }
        }
    }

    // [安全漏洞防御]：订阅大小校验，防止 OOM 崩溃（放宽至 100MB 以支持大型免费节点订阅列表）
    if body_part.len() > 100 * 1024 * 1024 {
        return Err(format!("Subscription payload via curl too large ({} bytes).", body_part.len()));
    }

    Ok((body_part, user_info))
}

/// 安全异步拉取订阅 URL 内容，包含多路 User-Agent 降级回退与重试机制
pub async fn fetch_subscription(url: &str) -> Result<(String, Option<SubUserInfo>), String> {
    // 1. 第一阶段：尝试纯正 Rust reqwest 异步发起请求
    let mut last_error = String::new();
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build();

    if let Ok(client) = client {
        let user_agents = vec![
            "clash",
            "v2rayn",
            "clash-verge/2.5.0",
            "clash.meta/1.18.5",
            "v2rayN/7.4.2",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        ];

        for ua in user_agents {
            match client.get(url).header("User-Agent", ua).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        if let Some(content_length) = response.content_length() {
                            if content_length > 100 * 1024 * 1024 {
                                return Err(format!("Subscription payload too large ({} bytes).", content_length));
                            }
                        }

                        let mut user_info = None;
                        if let Some(header_val) = response.headers().get("subscription-userinfo") {
                            if let Ok(header_str) = header_val.to_str() {
                                user_info = Some(parse_user_info(header_str));
                            }
                        }

                        match response.text().await {
                            Ok(body) => return Ok((body, user_info)),
                            Err(e) => {
                                last_error = format!("Failed to read body: {}", e);
                                continue;
                            }
                        }
                    } else {
                        last_error = format!("Status {} with UA {}", response.status(), ua);
                        continue;
                    }
                }
                Err(e) => {
                    last_error = format!("Request failed with UA {}: {}", ua, e);
                    continue;
                }
            }
        }
    } else {
        last_error = "Failed to build reqwest client".to_string();
    }

    // 2. 第二阶段：如果 reqwest 被 Cloudflare (如 403 Challenge) 拦截，触发系统级 curl.exe 终极避障回退
    println!("Standard reqwest fetch failed (CF WAF block). Initializing Windows native curl.exe bypass...");
    
    // 依然以最能触发 Clash / v2rayN 订阅格式的 UA 顺序执行
    for ua in &["clash", "v2rayn"] {
        match fetch_via_system_curl(url, ua) {
            Ok(res) => {
                println!("Successfully bypassed Cloudflare challenge using system curl.exe and UA '{}'!", ua);
                return Ok(res);
            }
            Err(e) => {
                println!("System curl fallback failed for UA '{}': {}", ua, e);
            }
        }
    }

    Err(format!("All fetch attempts failed. Last reqwest error: {}", last_error))
}

/// 智能 Base64 信封检测与自动解码器
pub fn decode_if_base64(raw_content: &str) -> String {
    // 过滤掉所有空白字符（包括换行符，防范多行 Base64 格式）
    let cleaned: String = raw_content.chars().filter(|c| !c.is_whitespace()).collect();
    
    // 如果不包含任何常见的节点协议头或 Clash 结构，且能被安全 Base64 解码，则执行解码
    if !cleaned.starts_with("vmess://") 
       && !cleaned.starts_with("vless://") 
       && !cleaned.starts_with("ss://") 
       && !cleaned.starts_with("trojan://") 
       && !cleaned.starts_with("hysteria2://")
       && !cleaned.starts_with("tuic://")
       && !cleaned.starts_with("socks://")
       && !cleaned.starts_with("http://")
       && !cleaned.contains("proxies:") 
       && !cleaned.contains("port:") {
        if let Ok(decoded_bytes) = crate::sub_translator::safe_base64_decode(&cleaned) {
            if let Ok(utf8_str) = String::from_utf8(decoded_bytes) {
                return utf8_str;
            }
        }
    }
    raw_content.to_string()
}

/// 在线订阅拉取与智能转译流水线接口
/// 拉取订阅 -> 自动解码 -> 判断 YAML 或 URI -> 转换为结构化的嵌套 JSON (FetchResult)
pub async fn fetch_and_translate(url: &str) -> Result<String, String> {
    let (raw_body, user_info) = fetch_subscription(url).await?;
    let decoded_body = decode_if_base64(&raw_body);
    
    let cleaned_decoded = decoded_body.trim();
    if cleaned_decoded.is_empty() {
        return Err("Decoded subscription content is empty".into());
    }
    
    // 根据内容特征分流至对应的转译处理器，优先使用 Try-Parse-Fallback 模式防范 Clash YAML 误报
    let nodes_json_str = if cleaned_decoded.contains("proxies:") {
        match crate::sub_translator::translate_clash_yaml(cleaned_decoded) {
            Ok(json) => json,
            Err(_) => crate::sub_translator::translate_nodes(cleaned_decoded)?,
        }
    } else {
        crate::sub_translator::translate_nodes(cleaned_decoded)?
    };

    // 将翻译出的节点数组字符串解析回 JSON Value 以进行嵌套组装
    let nodes: serde_json::Value = serde_json::from_str(&nodes_json_str)
        .map_err(|e| format!("Failed to parse nodes array: {}", e))?;

    let result = FetchResult {
        user_info,
        nodes,
    };

    serde_json::to_string_pretty(&result)
        .map_err(|e| format!("Failed to serialize final FetchResult: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_user_info() {
        let header = "upload=1024; download=2048; total=4096; expire=1690000000";
        let info = parse_user_info(header);
        assert_eq!(info.upload, 1024);
        assert_eq!(info.download, 2048);
        assert_eq!(info.total, 4096);
        assert_eq!(info.expire, 1690000000);
        
        // 测试容错性（缺少字段、含有不规则空格）
        let header_messy = "   total=100 ; upload = 20  ; unrecognized=33";
        let info_messy = parse_user_info(header_messy);
        assert_eq!(info_messy.total, 100);
        assert_eq!(info_messy.upload, 20);
        assert_eq!(info_messy.download, 0); // 默认 0
    }

    #[test]
    fn test_decode_if_base64() {
        // 1. 验证明文 VLESS/Clash 格式不被误解码
        let raw_vless = "vless://my-vless-node-info";
        assert_eq!(decode_if_base64(raw_vless), raw_vless);

        let raw_yaml = "proxies:\n  - name: node\n    type: ss";
        assert_eq!(decode_if_base64(raw_yaml), raw_yaml);

        // 2. 验证标准多行 Base64 能被正确自动还原
        // 明文为: ss://method:password@1.1.1.1:8388#MyNode
        let base64_payload = "c3M6Ly9tZXRob2Q6cGFzc3dvcmRAMS4xLjEuMTo4Mzg4I015Tm9kZQ==";
        let decoded = decode_if_base64(base64_payload);
        assert_eq!(decoded, "ss://method:password@1.1.1.1:8388#MyNode");
    }

    #[test]
    fn test_online_subscription_fetch() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            use std::fs;
            let url_file = fs::read_to_string("../test/subonline.txt")
                .or_else(|_| fs::read_to_string("test/subonline.txt"))
                .or_else(|_| fs::read_to_string("D:/Project/LepoProxy/test/subonline.txt"));
            
            if let Ok(url) = url_file {
                let url = url.trim();
                if !url.is_empty() {
                    match fetch_and_translate(url).await {
                        Ok(json) => {
                            fs::write("../test/online_translated.json", &json)
                                .or_else(|_| fs::write("test/online_translated.json", &json))
                                .or_else(|_| fs::write("D:/Project/LepoProxy/test/online_translated.json", &json))
                                .unwrap();
                            println!("Successfully pulled and translated online subscription into online_translated.json!");
                        }
                        Err(e) => {
                            println!("Offline or pull failed (expected in isolated/offline environments): {}", e);
                        }
                    }
                }
            }
        });
    }
}
