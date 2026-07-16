use tauri::{Manager, Emitter};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub mod sub_fetcher;
pub mod sub_translator;
pub mod tun_manager;
pub mod node_splitting;
pub mod telemetry;

static LAST_MENU_CLICK_TIME: AtomicU64 = AtomicU64::new(0);

fn record_menu_click() {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    LAST_MENU_CLICK_TIME.store(now, Ordering::Relaxed);
}

fn was_menu_clicked_recently() -> bool {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let last = LAST_MENU_CLICK_TIME.load(Ordering::Relaxed);
    now - last < 400 // 400 毫秒的时间窗，能 100% 滤除 Windows 托盘关联关闭的左键穿透消息
}

struct TrayMenuItems {
    system_proxy: tauri::menu::CheckMenuItem<tauri::Wry>,
    tun_proxy: tauri::menu::CheckMenuItem<tauri::Wry>,
    node_menu: tauri::menu::Submenu<tauri::Wry>,
    sub_menu: tauri::menu::Submenu<tauri::Wry>,
}

#[tauri::command]
async fn fetch_and_translate_node(url: String) -> Result<String, String> {
    sub_fetcher::fetch_and_translate(&url).await
}

#[tauri::command]
fn translate_raw_nodes(content: String) -> Result<String, String> {
    let decoded_body = sub_fetcher::decode_if_base64(&content);
    let cleaned = decoded_body.trim();
    if cleaned.is_empty() {
        return Err("Decoded node content is empty".into());
    }
    
    let nodes_json_str = if cleaned.contains("proxies:") {
        match sub_translator::translate_clash_yaml(cleaned) {
            Ok(json) => json,
            Err(_) => sub_translator::translate_nodes(cleaned)?,
        }
    } else {
        sub_translator::translate_nodes(cleaned)?
    };
    
    let nodes: serde_json::Value = serde_json::from_str(&nodes_json_str)
        .map_err(|e| format!("Failed to parse nodes array: {}", e))?;
        
    let result = sub_fetcher::FetchResult {
        user_info: None,
        nodes,
    };
    
    serde_json::to_string_pretty(&result)
        .map_err(|e| format!("Failed to serialize FetchResult: {}", e))
}
#[tauri::command]
async fn fetch_subscription(url: String) -> Result<String, String> {
    match sub_fetcher::fetch_subscription(&url).await {
        Ok((body, _user_info)) => Ok(body),
        Err(e) => Err(e),
    }
}

#[tauri::command]
fn generate_singbox_config(
    nodes_json: String,
    mode: String,
    active_node: String,
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
    node_splitting::assemble_config(
        &nodes_json,
        &mode,
        &active_node,
        local_port,
        tun_enabled,
        ipv6_enabled,
        lan_enabled,
        custom_direct_domains,
        custom_proxy_domains,
        custom_block_domains,
        dns_local_server,
        dns_remote_server,
    )
}

#[tauri::command]
fn start_proxy(app: tauri::AppHandle, config_json: String, system_proxy_enabled: bool, local_port: u16, tun_enabled: bool) -> Result<(), String> {
    if tun_enabled && !tun_manager::is_admin() {
        return Err("启动TUN模式代理失败：检测到当前应用没有管理员权限，请右键选择『以管理员身份运行』重新启动 LepoProxy！".into());
    }

    tun_manager::start_singbox(&config_json, app, tun_enabled)?;
    if system_proxy_enabled {
        tun_manager::enable_system_proxy(local_port)?;
    } else {
        let _ = tun_manager::disable_system_proxy();
    }
    Ok(())
}

#[tauri::command]
fn stop_proxy() -> Result<(), String> {
    let _ = tun_manager::disable_system_proxy();
    tun_manager::stop_singbox()?;
    Ok(())
}

#[tauri::command]
fn set_system_proxy_enabled(enabled: bool, local_port: u16) -> Result<(), String> {
    if enabled {
        tun_manager::enable_system_proxy(local_port)
    } else {
        tun_manager::disable_system_proxy()
    }
}

#[tauri::command]
fn set_autostart_enabled(enabled: bool, is_minimized: bool) -> Result<(), String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get current executable path: {}", e))?;
    let exe_str = exe_path.to_string_lossy();
    
    if enabled {
        let launch_arg = if is_minimized {
            format!("\"{}\" --minimized", exe_str)
        } else {
            format!("\"{}\"", exe_str)
        };

        let mut cmd = std::process::Command::new("reg");
        cmd.args(&[
            "add",
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
            "/v",
            "LepoProxy",
            "/t",
            "REG_SZ",
            "/d",
            &launch_arg,
            "/f"
        ]);
        #[cfg(windows)]
        {
            cmd.creation_flags(0x08000000);
        }

        let status = cmd.status()
            .map_err(|e| format!("Failed to execute reg.exe: {}", e))?;
        if !status.success() {
            return Err("Failed to add Run registry key".into());
        }
    } else {
        let mut cmd = std::process::Command::new("reg");
        cmd.args(&[
            "delete",
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
            "/v",
            "LepoProxy",
            "/f"
        ]);
        #[cfg(windows)]
        {
            cmd.creation_flags(0x08000000);
        }
        let _ = cmd.status();
    }
    Ok(())
}

#[tauri::command]
async fn run_latency_test(nodes_json: String) -> Result<String, String> {
    node_splitting::ping::ping_all_nodes(&nodes_json).await
}

#[tauri::command]
fn close_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn hide_window(window: tauri::WebviewWindow) {
    println!("Backend hide_window command received. Hiding main webview window to system tray...");
    let _ = window.hide();
}

#[tauri::command]
fn set_tray_checked(
    id: String,
    checked: bool,
    state: tauri::State<'_, TrayMenuItems>,
) -> Result<(), String> {
    match id.as_str() {
        "system-proxy" => {
            state.system_proxy.set_checked(checked).map_err(|e| e.to_string())?;
        }
        "tun-proxy" => {
            state.tun_proxy.set_checked(checked).map_err(|e| e.to_string())?;
        }
        _ => return Err("Invalid menu item ID".to_string()),
    }
    Ok(())
}

#[tauri::command]
fn update_tray_nodes(
    app: tauri::AppHandle,
    nodes: Vec<String>,
    active_index: usize,
    state: tauri::State<'_, TrayMenuItems>,
) -> Result<(), String> {
    let len = state.node_menu.items().map(|items| items.len()).unwrap_or(0);
    for _ in 0..len {
        state.node_menu.remove_at(0).map_err(|e| e.to_string())?;
    }
    
    let default_item = tauri::menu::MenuItem::with_id(
        &app,
        "node_default",
        "默认 - 自动模式",
        false,
        None::<&str>,
    ).map_err(|e| e.to_string())?;
    state.node_menu.append(&default_item).map_err(|e| e.to_string())?;
    
    if !nodes.is_empty() {
        let separator = tauri::menu::PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
        state.node_menu.append(&separator).map_err(|e| e.to_string())?;
    }

    for (i, node_name) in nodes.into_iter().enumerate() {
        let is_active = i == active_index;
        let item_id = format!("node_select_{}", i);
        let node_item = tauri::menu::CheckMenuItem::with_id(
            &app,
            item_id,
            node_name,
            true,
            is_active,
            None::<&str>,
        ).map_err(|e| e.to_string())?;
        state.node_menu.append(&node_item).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn update_tray_subs(
    app: tauri::AppHandle,
    subs: Vec<String>,
    active_index: usize,
    state: tauri::State<'_, TrayMenuItems>,
) -> Result<(), String> {
    let len = state.sub_menu.items().map(|items| items.len()).unwrap_or(0);
    for _ in 0..len {
        state.sub_menu.remove_at(0).map_err(|e| e.to_string())?;
    }

    let default_sub = tauri::menu::MenuItem::with_id(
        &app,
        "sub_default",
        "默认内置订阅",
        true,
        None::<&str>,
    ).map_err(|e| e.to_string())?;
    state.sub_menu.append(&default_sub).map_err(|e| e.to_string())?;

    if !subs.is_empty() {
        let separator = tauri::menu::PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
        state.sub_menu.append(&separator).map_err(|e| e.to_string())?;
    }

    for (i, sub_name) in subs.into_iter().enumerate() {
        let is_active = i == active_index;
        let item_id = format!("sub_select_{}", i);
        let sub_item = tauri::menu::CheckMenuItem::with_id(
            &app,
            item_id,
            sub_name,
            true,
            is_active,
            None::<&str>,
        ).map_err(|e| e.to_string())?;
        state.sub_menu.append(&sub_item).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        fetch_and_translate_node,
        translate_raw_nodes,
        fetch_subscription,
        generate_singbox_config,
        run_latency_test,
        close_app,
        hide_window,
        set_tray_checked,
        update_tray_nodes,
        update_tray_subs,
        start_proxy,
        stop_proxy,
        set_system_proxy_enabled,
        set_autostart_enabled
    ])
    .setup(|app| {
        // 1. Create checkable items
        let system_proxy = tauri::menu::CheckMenuItem::with_id(
            app,
            "system-proxy",
            "系统代理",
            true, // enabled
            false, // checked
            None::<&str>,
        )?;

        let tun_proxy = tauri::menu::CheckMenuItem::with_id(
            app,
            "tun-proxy",
            "Tun模式代理",
            true,
            false,
            None::<&str>,
        )?;

        // 2. Create submenus
        let node_menu = tauri::menu::Submenu::with_id(app, "node-select", "节点选择", true)?;
        let default_item = tauri::menu::MenuItem::with_id(
            app,
            "node_default",
            "默认 - 自动模式",
            false,
            None::<&str>,
        )?;
        node_menu.append(&default_item)?;

        let sub_menu = tauri::menu::Submenu::with_id(app, "sub-select", "订阅选择", true)?;
        let default_sub = tauri::menu::MenuItem::with_id(
            app,
            "sub_default",
            "默认内置订阅",
            true,
            None::<&str>,
        )?;
        sub_menu.append(&default_sub)?;

        // 3. Normal items
        let restart_core_item = tauri::menu::MenuItem::with_id(
            app,
            "restart-core",
            "重启内核和服务",
            true,
            None::<&str>,
        )?;

        let exit_item = tauri::menu::MenuItem::with_id(
            app,
            "exit-app",
            "退出",
            true,
            None::<&str>,
        )?;

        // 4. Assemble main tray menu
        let tray_menu = tauri::menu::Menu::with_id(app, "tray-main-menu")?;
        tray_menu.append(&system_proxy)?;
        tray_menu.append(&tun_proxy)?;
        tray_menu.append(&tauri::menu::PredefinedMenuItem::separator(app)?)?;
        tray_menu.append(&node_menu)?;
        tray_menu.append(&sub_menu)?;
        tray_menu.append(&tauri::menu::PredefinedMenuItem::separator(app)?)?;
        tray_menu.append(&restart_core_item)?;
        tray_menu.append(&tauri::menu::PredefinedMenuItem::separator(app)?)?;
        tray_menu.append(&exit_item)?;

        // 5. Manage state so commands can access handles
        app.manage(TrayMenuItems {
            system_proxy: system_proxy.clone(),
            tun_proxy: tun_proxy.clone(),
            node_menu: node_menu.clone(),
            sub_menu: sub_menu.clone(),
        });

        // 6. Build tray icon
        let mut tray_builder = tauri::tray::TrayIconBuilder::new()
            .menu(&tray_menu);
        if let Some(icon) = app.default_window_icon() {
            tray_builder = tray_builder.icon(icon.clone());
        }

        let _tray = tray_builder
            .on_menu_event(|app, event| {
                record_menu_click();
                match event.id.as_ref() {
                    "system-proxy" => {
                        if let Some(state) = app.try_state::<TrayMenuItems>() {
                            let is_checked = state.system_proxy.is_checked().unwrap_or(false);
                            let _ = app.emit("tray-system-proxy-toggle", is_checked);
                        }
                    }
                    "tun-proxy" => {
                        if let Some(state) = app.try_state::<TrayMenuItems>() {
                            let is_checked = state.tun_proxy.is_checked().unwrap_or(false);
                            let _ = app.emit("tray-tun-proxy-toggle", is_checked);
                        }
                    }
                    "restart-core" => {
                        let _ = app.emit("tray-restart-core", ());
                    }
                    "exit-app" => {
                        let _ = tun_manager::disable_system_proxy();
                        let _ = tun_manager::stop_singbox();
                        app.exit(0);
                    }
                    other => {
                        if other.starts_with("node_select_") {
                            let idx_str = &other["node_select_".len()..];
                            if let Ok(idx) = idx_str.parse::<usize>() {
                                let _ = app.emit("tray-node-select", idx);
                            }
                        } else if other.starts_with("sub_select_") {
                            let idx_str = &other["sub_select_".len()..];
                            if let Ok(idx) = idx_str.parse::<usize>() {
                                let _ = app.emit("tray-sub-select", idx);
                            }
                        }
                    }
                }
            })
            .on_tray_icon_event(|tray, event| {
                if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                    let app = tray.app_handle().clone();
                    tauri::async_runtime::spawn(async move {
                        // 延迟 150 毫秒等待 Windows 系统事件队列消化完菜单关闭事件并触发 on_menu_event
                        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
                        if !was_menu_clicked_recently() {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    });
                }
            })
            .build(app)?;

        // 7. Hide window on close request and set custom window/taskbar icon
        if let Some(main_window) = app.get_webview_window("main") {
            let args: Vec<String> = std::env::args().collect();
            if args.contains(&"--minimized".to_string()) {
                let _ = main_window.hide();
            }

            if let Some(icon) = app.default_window_icon() {
                let _ = main_window.set_icon(icon.clone());
            }
            let main_window_clone = main_window.clone();
            main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let _ = main_window_clone.hide();
                    api.prevent_close();
                }
            });
        }

        // 启动即自愈：强制清理意外断电等导致的系统代理残留，防止网络锁死
        let _ = tun_manager::disable_system_proxy();

        if cfg!(debug_assertions) {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;
        }
        Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
