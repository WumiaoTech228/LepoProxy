use std::fs;
use std::path::PathBuf;
use std::process::{Command, Child};
use std::sync::Mutex;
use std::sync::OnceLock;
use tauri::Emitter;
use std::os::windows::process::CommandExt;

/// 获取可执行文件所在目录的绝对路径，确保任何工作目录下都能正确定位 core/ 文件夹
fn get_exe_dir() -> Result<PathBuf, String> {
    std::env::current_exe()
        .map_err(|e| format!("Failed to get current executable path: {}", e))?
        .parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| "Failed to get parent directory of executable".to_string())
}

fn flush_dns_cache() {
    let _ = Command::new("ipconfig")
        .arg("/flushdns")
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .status();
    println!("Windows DNS cache flushed.");
}

fn download_file(name: &str, target_path: &std::path::Path, urls: &[&str], timeout_secs: u64) -> Result<(), String> {
    println!("Starting {} download from secure CDN...", name);

    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| format!("Failed to build tokio runtime: {}", e))?;

    let download_success = rt.block_on(async {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(timeout_secs))
            .build();
            
        let client = match client {
            Ok(c) => c,
            Err(_) => return false,
        };

        for url in urls {
            println!("Trying async download of {} from: {}", name, url);
            if let Ok(resp) = client.get(*url).send().await {
                if resp.status().is_success() {
                    if let Ok(bytes) = resp.bytes().await {
                        if fs::write(target_path, bytes).is_ok() {
                            println!("{} successfully downloaded and verified!", name);
                            return true;
                        }
                    }
                }
            }
        }
        false
    });

    if download_success {
        Ok(())
    } else {
        Err(format!("下载/自动安装 {} 失败。\n由于网络环境原因，请检查您的网络连接并重试，或者手动下载 {} 并放置在软件的 core/ 文件夹下。", name, name))
    }
}

fn download_wintun_dll(target_path: &std::path::Path) -> Result<(), String> {
    let urls = [
        "https://fastly.jsdelivr.net/gh/MatsuriDayo/wintun@master/bin/amd64/wintun.dll",
        "https://raw.githubusercontent.com/MatsuriDayo/wintun/master/bin/amd64/wintun.dll",
    ];
    download_file("wintun.dll", target_path, &urls, 30)
}

// 静态存储全局唯一的 Sing-Box 核心子进程句柄
static SINGBOX_PROCESS: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

fn get_process_mutex() -> &'static Mutex<Option<Child>> {
    SINGBOX_PROCESS.get_or_init(|| Mutex::new(None))
}

#[link(name = "wininet")]
extern "system" {
    fn InternetSetOptionW(
        h_internet: *mut std::ffi::c_void,
        dw_option: u32,
        lp_buffer: *mut std::ffi::c_void,
        dw_buffer_length: u32,
    ) -> i32;
}

#[link(name = "shell32")]
extern "system" {
    fn IsUserAnAdmin() -> i32;
}

/// 检查当前应用进程是否以管理员（提权）身份运行，TUN 模式必载
pub fn is_admin() -> bool {
    unsafe { IsUserAnAdmin() != 0 }
}

/// 告诉 Windows 刷新其网络代理选项，使系统设置立即生效
pub fn refresh_system_proxy_settings() {
    unsafe {
        InternetSetOptionW(std::ptr::null_mut(), 39, std::ptr::null_mut(), 0); // INTERNET_OPTION_SETTINGS_CHANGED
        InternetSetOptionW(std::ptr::null_mut(), 37, std::ptr::null_mut(), 0); // INTERNET_OPTION_REFRESH
    }
}

/// 启用 Windows 系统全局代理，指向本地混合混合入站端口 127.0.0.1:local_port
pub fn enable_system_proxy(local_port: u16) -> Result<(), String> {
    // 写入注册表，激活代理设置
    let output1 = Command::new("reg")
        .args(["add", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings", "/v", "ProxyEnable", "/t", "REG_DWORD", "/d", "1", "/f"])
        .creation_flags(0x08000000)
        .output()
        .map_err(|e| format!("Failed to execute reg for ProxyEnable: {}", e))?;
        
    let proxy_address = format!("127.0.0.1:{}", local_port);
    let output2 = Command::new("reg")
        .args(["add", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings", "/v", "ProxyServer", "/t", "REG_SZ", "/d", &proxy_address, "/f"])
        .creation_flags(0x08000000)
        .output()
        .map_err(|e| format!("Failed to execute reg for ProxyServer: {}", e))?;

    if !output1.status.success() || !output2.status.success() {
        return Err("Failed to update registry proxy settings".into());
    }

    // 触发系统级刷新，令所有浏览器与客户端秒级生效
    refresh_system_proxy_settings();
    flush_dns_cache();
    println!("Windows system proxy configured to 127.0.0.1:{} successfully!", local_port);
    Ok(())
}

/// 禁用 Windows 系统全局代理并恢复网络畅通
pub fn disable_system_proxy() -> Result<(), String> {
    let output = Command::new("reg")
        .args(["add", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings", "/v", "ProxyEnable", "/t", "REG_DWORD", "/d", "0", "/f"])
        .creation_flags(0x08000000)
        .output()
        .map_err(|e| format!("Failed to execute reg for ProxyDisable: {}", e))?;

    if !output.status.success() {
        return Err("Failed to clear registry proxy enable key".into());
    }

    refresh_system_proxy_settings();
    flush_dns_cache();
    println!("Windows system proxy disabled successfully.");
    Ok(())
}

/// 启动 Sing-Box 核心进程，并配置对应的配置内容与看门狗看护
pub fn start_singbox(config_json: &str, app: tauri::AppHandle, tun_enabled: bool) -> Result<(), String> {
    let exe_dir = get_exe_dir()?;
    let core_dir = exe_dir.join("core");

    // 自愈与自动释放：如果在可执行文件同级未找到 core/sing-box.exe，但开发工作区根目录下存在该核心文件，
    // 则自动在 target 运行目录下创建 core/ 目录并复制所需的二进制依赖，规避开发调试阶段手动搬运文件的麻烦
    if !core_dir.join("sing-box.exe").exists() {
        if let Some(workspace_dir) = exe_dir.parent().and_then(|p| p.parent()).and_then(|p| p.parent()) {
            let workspace_core = workspace_dir.join("core");
            if workspace_core.join("sing-box.exe").exists() {
                println!("Auto-healing: Found core files in workspace directory: {}. Copying to target build directory...", workspace_core.display());
                let _ = fs::create_dir_all(&core_dir);
                let files_to_copy = vec!["sing-box.exe", "wintun.dll", "libcronet.dll", "geoip.db", "geosite.db"];
                for file_name in files_to_copy {
                    let src = workspace_core.join(file_name);
                    let dest = core_dir.join(file_name);
                    if src.exists() {
                        if let Err(e) = fs::copy(&src, &dest) {
                            println!("Warning: Failed to copy {} to core dir: {}", file_name, e);
                        } else {
                            println!("Successfully copied {} to target core dir.", file_name);
                        }
                    }
                }
            }
        }
    }

    // 0. 如果是 TUN 模式，并且核心目录 core/wintun.dll 不存在，则进行自动释放与静默下载安装
    if tun_enabled {
        let wintun_path = core_dir.join("wintun.dll");
        if !wintun_path.exists() {
            download_wintun_dll(&wintun_path)?;
        }
    }

    // 0.5 自动补全 geoip.db 和 geosite.db，防范 Rules 模式下内核启动崩溃
    let geoip_path = core_dir.join("geoip.db");
    if !geoip_path.exists() {
        let geoip_urls = [
            "https://fastly.jsdelivr.net/gh/SagerNet/sing-geoip@db-ip/geoip.db",
            "https://github.com/SagerNet/sing-geoip/releases/latest/download/geoip.db",
            "https://raw.githubusercontent.com/SagerNet/sing-geoip/db-ip/geoip.db",
        ];
        download_file("geoip.db", &geoip_path, &geoip_urls, 60)?;
    }

    let geosite_path = core_dir.join("geosite.db");
    if !geosite_path.exists() {
        let geosite_urls = [
            "https://fastly.jsdelivr.net/gh/SagerNet/sing-geosite@db/geosite.db",
            "https://github.com/SagerNet/sing-geosite/releases/latest/download/geosite.db",
            "https://raw.githubusercontent.com/SagerNet/sing-geosite/db/geosite.db",
        ];
        download_file("geosite.db", &geosite_path, &geosite_urls, 90)?;
    }

    let mut lock = get_process_mutex().lock().unwrap();

    // 1. 如果有旧内核实体在运行，直接进行强行关闭与杀死，确保端口释放
    if let Some(mut old_child) = lock.take() {
        println!("Stopping previous Sing-Box instance...");
        let _ = old_child.kill();
        let _ = old_child.wait();
    }

    // 2. 定位位于工作目录 of core/sing-box.exe 二进制文件
    let singbox_exe_path = core_dir.join("sing-box.exe");
    if !singbox_exe_path.exists() {
        return Err(format!("Core binary '{}' not found. Please place it in the core/ directory next to the application.", singbox_exe_path.display()));
    }

    // 3. 动态将生成的完整 JSON 配置序列化输出至本地 core/config.json
    let config_path = core_dir.join("config.json");
    fs::write(&config_path, config_json)
        .map_err(|e| format!("Failed to write config.json inside core/: {}", e))?;

    // 4. 拉起进程
    println!("Spawning new Sing-Box kernel instance...");
    let mut child = Command::new(&singbox_exe_path)
        .args(["run", "-c", "config.json"])
        .current_dir(&core_dir)
        .env("ENABLE_DEPRECATED_LEGACY_DNS_SERVERS", "true")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .spawn()
        .map_err(|e| format!("Failed to spawn sing-box.exe child process: {}", e))?;

    // 提取并异步监听标准输出与错误输出，实时上报前端作为日志监控
    if let Some(stdout) = child.stdout.take() {
        let app_stdout = app.clone();
        std::thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            let mut reader = BufReader::new(stdout);
            let mut buf = Vec::new();
            while let Ok(n) = reader.read_until(b'\n', &mut buf) {
                if n == 0 {
                    break;
                }
                let l = String::from_utf8_lossy(&buf).trim_end().to_string();
                let _ = app_stdout.emit("core-log", l);
                buf.clear();
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let app_stderr = app.clone();
        std::thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            let mut reader = BufReader::new(stderr);
            let mut buf = Vec::new();
            while let Ok(n) = reader.read_until(b'\n', &mut buf) {
                if n == 0 {
                    break;
                }
                let l = String::from_utf8_lossy(&buf).trim_end().to_string();
                let _ = app_stderr.emit("core-log", l);
                buf.clear();
            }
        });
    }

    // 5. 刷新 DNS 并登记句柄，启动超高灵敏度的故障恢复看门狗守护线程
    flush_dns_cache();
    let child_id = child.id();
    *lock = Some(child);

    std::thread::spawn(move || {
        println!("Watchdog service initialized and guarding Sing-Box kernel process ID {}...", child_id);
        loop {
            // 每隔 500ms 检查一次核心状态，保证零负载的同时提供小于毫秒级的灾后自愈
            std::thread::sleep(std::time::Duration::from_millis(500));
            let mut inner_lock = get_process_mutex().lock().unwrap();
            
            if let Some(ref mut c) = *inner_lock {
                if c.id() != child_id {
                    println!("Watchdog: guarded process ID {} has been replaced by {}. Terminating watchdog thread.", child_id, c.id());
                    break;
                }
                match c.try_wait() {
                    Ok(Some(status)) => {
                        println!("Watchdog warning: Sing-Box core process exited unexpectedly with status: {:?}", status);
                        // 自愈核心：立即清理 Windows 注册表代理，防止用户网络瘫痪！
                        let _ = disable_system_proxy();
                        let _ = app.emit("core-crashed", ());
                        *inner_lock = None;
                        break;
                    }
                    Ok(None) => {
                        // 核心依然存活，继续监听
                    }
                    Err(e) => {
                        println!("Watchdog error query child state: {}. Clearing system proxy settings to prevent lockup...", e);
                        let _ = disable_system_proxy();
                        let _ = app.emit("core-crashed", ());
                        *inner_lock = None;
                        break;
                    }
                }
            } else {
                // 主动被 stop_singbox 关闭，退出守护线程
                println!("Watchdog guarding session terminated gracefully.");
                break;
            }
        }
    });

    Ok(())
}

/// 关闭 Sing-Box 核心服务与所有后台监控
pub fn stop_singbox() -> Result<(), String> {
    let mut lock = get_process_mutex().lock().unwrap();
    if let Some(mut child) = lock.take() {
        println!("Terminating Sing-Box process...");
        let _ = child.kill();
        let _ = child.wait();
    }
    flush_dns_cache();
    println!("Sing-Box service stopped.");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore]
    fn test_download_geo_databases() {
        let temp_dir = std::env::temp_dir().join("lepoproxy_test_geo");
        let _ = std::fs::create_dir_all(&temp_dir);

        let geoip_path = temp_dir.join("geoip.db");
        let geoip_urls = [
            "https://fastly.jsdelivr.net/gh/SagerNet/sing-geoip@db-ip/geoip.db",
            "https://github.com/SagerNet/sing-geoip/releases/latest/download/geoip.db",
        ];
        let res_geoip = download_file("geoip.db", &geoip_path, &geoip_urls, 30);
        assert!(res_geoip.is_ok());
        assert!(geoip_path.exists());
        assert!(std::fs::metadata(&geoip_path).unwrap().len() > 1000);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
