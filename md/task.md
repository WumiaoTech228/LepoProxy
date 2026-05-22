# LepoProxy 实施任务列表

## 阶段一：基础环境搭建与静态界面收尾
- [ ] 检查并确保系统已安装 Node.js, Rust (`cargo`), MSVC Build Tools。
- [ ] 在当前目录初始化 Tauri 项目架构（使用 `cargo tauri init` 或对应的 npm 脚本）。
- [ ] 安装前端 Tauri 交互依赖（`npm install @tauri-apps/api`）。
- [ ] 修改 `index.html`：
  - [ ] 引入本地化的 `@tauri-apps/api` 替换 mock 代码。
  - [x] 逐步分离原有的内联 CSS 与 JS 逻辑，并验证深浅色模式、面板切换、动效等渲染正常。

## 阶段二：后端核心进程管理与服务化机制
- [ ] **进程启停管理**：在 Rust 端编写子进程管理代码，实现启动、停止、监控 `core/sing-box.exe`。
- [ ] **基础模板生成**：在 Rust 中构建结构化的 `sing-box` JSON 配置模板。
- [ ] **系统代理控制**：通过 Rust 调用 Windows 注册表 API，实现一键开启/关闭系统代理。
- [ ] **TUN 服务化基础**：
  - [ ] 编写提权逻辑：首次开启 TUN 时申请 UAC 权限。
  - [ ] 实现后台 Windows 服务注册逻辑，后续 UI 仅通过 IPC/Socket 通知服务开启 TUN。

## 阶段三：订阅解析与高级网络特性 (核心攻坚)
- [ ] **纯本地离线解析器**：
  - [ ] 引入 `base64`, `regex`, `serde_json` 库。
  - [ ] 编写针对 `vmess://`, `vless://`, `ss://`, `trojan://` 等常见格式的本地解析函数。
  - [ ] 将解析结果映射组装到 `sing-box` 的 `outbounds` 数组中。
- [ ] **路由分流控制 (Node Splitting)**：
  - [ ] 挂载外部规则集 (`NodeSplitting/` 目录下的 `.srs` 文件)。
  - [ ] 前端点击 Rule/Global/Direct 时，后端实时修改路由出站策略并对 `sing-box` 发送热重载指令。
- [ ] **节点测速集成 (Ping)**：
  - [ ] 修改 `sing-box` 配置以开启兼容的 Clash REST API。
  - [ ] 前端调用本地 API 获取节点真连接 HTTP 延迟并渲染颜色（绿/蓝/黄/红）。
- [ ] **UWP 原生解除隔离**：引入 `windows-rs`，在开启系统代理/TUN 时，底层静默遍历 AppContainers 并调用系统 API 解除隔离。

## 阶段四：特性完善与发布打包
- [ ] **内置节点管理**：实现内置节点的拉取、30 分钟限时额度控制以及自动无缝切换逻辑。
- [ ] **系统托盘与自启**：配置 System Tray 右键菜单和开机自启选项。
- [ ] **状态持久化**：使用本地配置文件记录用户的设置项（端口、IPv6 偏好、深浅色、上次节点）。
- [ ] **前端资产本地化**：引入打包工具（如 Vite），将 TailwindCSS 等 CDN 依赖编译到本地，确保应用可完全离线加载。
- [ ] **最终打包发布**：配置 `tauri.conf.json` 的图标和权限声明，执行 `tauri build` 生成 Windows `.msi` / `.exe` 安装包。
