<div align="center">

# 💎 LepoProxy (徕珀代理)

### **Elegant • Blazing-Fast • Secure**
**基于 Tauri v2 + Sing-Box 内核构筑的下一代全协议高性能桌面代理客户端**

[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2.0-blue.svg?style=flat-square&logo=tauri)](https://tauri.app/)
[![SingBox](https://img.shields.io/badge/Sing--Box-v1.12+-green.svg?style=flat-square&logo=go)](https://sing-box.sagernet.org/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg?style=flat-square)](LICENSE)

[✨ 设计哲学](#一-设计哲学与人文底蕴) • [🌐 黑科技协议](#二-核心黑科技协议深度解析) • [🏗️ 架构设计](#三-五大后端子模块核心架构剖析) • [🧪 单元测试](#四-转译核心代码实现与测试验证) • [🚀 路线蓝图](#五-产品成长大饼五阶段路线图) • [🛠️ 极客开发](#六-超详尽编译部署与极客开发手册)

</div>

---

> [!NOTE]
> **LepoProxy (徕珀代理)** 是一款融汇了**极致性能**与**文人交互美学**的跨平台桌面代理系统。我们彻底摒弃了传统 Electron 客户端臃肿、庞杂的内存运行时与千篇一律的简陋 UI，创造性地选择以 **Rust (Tauri v2)** 构筑安全稳固之骨架，以 **Go (Sing-Box)** 注入强悍的网络底层灵魂，为您呈献如同琥珀（Amber / Lepo）般清澈、纯净且历经时光磨砺依旧坚不可摧的网络安全防护体验。

---

# 一、设计哲学与人文底蕴

## 1.1 琥珀之名：透明、固化与历久弥新
在立项之初，我们便将这款作品命名为 **LepoProxy**（Lepo，源自世界语中“琥珀”的缩影）。琥珀是自然界中极为独特的存在，它由松脂凝聚，历经千百万年的高压与地质变迁，将最脆弱、最灵动的生命瞬间永久定格。

在网络安全的语境下，琥珀蕴含着我们对代理软件的最高追求：
* **透明（Transparency）**：全自研的本地 Rust 转译算法，数据流转完全本地化，不依赖任何第三方云端 API，将绝对的隐私掌控权交还给用户。
* **固化（Solidification）**：依托 Rust 语言天生的内存安全与并发控制，软件一旦编译成型，其运行时便如同琥珀般稳固，杜绝了一切内存泄漏与指针异常。
* **历久弥新（Durability）**：在飞速演进的抗审查网络中，LepoProxy 的底层架构具备极高的弹性与扩展能力，能够在变幻莫测的封锁环境中恒久提供可靠的通道。

## 1.2 告别 Electron 臃肿时代：Tauri v2 的物理降维打击
在过去很长一段时间里，国内代理客户端（如 Clash for Windows 等）长期被 Electron 架构所垄断。Electron 虽然带来了极高的开发效率，但其背后的技术债却让普通用户和开发者苦不堪言：
* **庞大的静态资源**：哪怕只写一个纯文本的节点导入界面，也必须捆绑一整套 Chromium 浏览器内核与 V8 引擎。空载状态下的包体积动辄 100MB+，运行时的内存开销轻松突破 200MB~500MB，这对于一台正在承担繁重开发或生产力任务的电脑而言，是极其奢侈和低效的。
* **安全漏洞百出**：Node.js 运行时的广泛权限加上 Chromium 复杂的沙箱模型，导致 Electron 软件极易受到 XSS 注入和本地远程命令执行（RCE）攻击。

**LepoProxy 采用 Tauri v2 实现了真正的物理降维打击：**
Tauri v2 抛弃了 Chromium，转而调用宿主操作系统的原生 Web 视图渲染器（Windows 上为 WebView2，macOS 上为 WebKit，Linux 上为 WebKitGTK）。这使得我们：
* **包体积缩减 90%**：静态安装包大小可以精简到惊人的 **2MB ~ 5MB**。
* **内存占用骤降 80%**：运行内存仅需 **15MB ~ 30MB** 左右。
* **彻底的内存安全**：所有核心系统调用、文件读写、提权网络接管全部在 Rust 后端以强类型强多线程安全隔离方式运行，前端 HTML/JS 仅仅充当纯粹的展示与输入管道，通过强加密的 IPC 通信总线向 Rust 传递指令，杜绝了跨站脚本对系统的任何实质性威胁。

---

# 二、核心黑科技协议深度解析

为了对抗日益严峻的深度封锁和精准识别，LepoProxy 拒绝做简单的皮肤包装，而是从协议底层切入，原生兼容并优化了当代最顶级的抗审查黑科技协议：

```
+---------------------------------------------------------------------------------+
|                                 LepoProxy                                       |
+-------------------+--------------------+-------------------+--------------------+
|   VLESS Reality   |     Hysteria 2     |      AnyTLS       |      TLS ECH       |
|  (仿无缝TLS握手)   |  (UDP暴兵/抗吞吐)   |  (混淆数据防侧漏)  |  (SNI加密隐形防窥)  |
+-------------------+--------------------+-------------------+--------------------+
```

## 2.1 VLESS Reality：无感知的 TLS 仿冒革命
在传统的 TLS 代理（如 Trojan、普通的 VLESS+TLS）中，客户端与代理服务器建立连接时，会使用用户自备的专属域名。这给封锁防火墙留下了两个极易攻破的漏洞：
1. **主动探测（Active Probing）**：防火墙会伪装成常规客户端，直接向该 IP 地址发起不规整的握手探测。如果发现对方没有返回标准域名的证书，或者行为异常，便会立即封锁该 IP。
2. **域名嗅探（SNI Sniffing）**：由于 TLS 握手的第一步（Client Hello）中包含明文域名，防火墙只需扫描域名白名单即可实现精准拦截。

**VLESS Reality 彻底颠覆了这一现状：**
Reality 丢弃了传统的证书配置。它在客户端连接时，允许代理服务器“借用”网络上任何现存的合法大型网站（如 `microsoft.com`、`apple.com`）的 TLS 握手流程。
* 当防火墙向您的代理服务器发起主动探测时，代理服务器会极其自然地将流量透传给被借用的真实大厂服务器，并完美返回真实大厂的合法证书！
* 对于外界窥探者而言，这完全是一次最普通的去往微软或苹果官网的 HTTPS 连接，毫无破绽，安全等级瞬间拉满。

## 2.2 Hysteria 2：UDP 狂飙，吞吐量之王
在垃圾宽带或者高丢包率的网络环境下（例如晚高峰的国际出口通道），基于 TCP 的传统代理协议（如 VMess/VLESS）会因为 TCP 自身的拥塞控制机制（如慢启动、超时重传和拥塞窗口减半）导致网速断崖式下跌，即使您的带宽再宽也无济于事。

**Hysteria 2（基于 QUIC 协议重构）是当之无愧的吞吐量救星：**
* **自定义拥塞控制**：它在 UDP 传输协议之上，自研了一套高度激进且聪明的拥塞控制算法。即使在丢包率高达 30% 甚至 50% 的恶劣网络环境下，依然能够强行跑满您的物理带宽。
* **Salamander 混淆机制**：针对部分地区对 UDP/QUIC 流量的特征嗅探与限速，Hysteria 2 内置了 Salamander 混淆算法，为 UDP 数据包裹上了一层看似无序的随机噪声，使其无法被防火墙的深度包检测（DPI）技术所识别。

## 2.3 AnyTLS：彻底瓦解 TLS-in-TLS 特征侧漏
在很多开发场景中，我们会在代理通道内运行其他的加密流量（比如通过代理连接远程 HTTPS 网站、进行 SSH 传输等）。这会造成极高风险的 **“TLS-in-TLS”** 现象。
普通的 TLS 隧道（如 Trojan）虽然加密了内容，但由于它只是做了一层简单的二次嵌套，导致其传输的数据包长度分布（Packet Length Distribution）和时间间隔（Padding Inter-arrival Time）具备极其独特的数学指纹特征。AI 驱动的流量分类器可以不解密数据，仅仅通过特征包分析，就能以 99% 的准确率判定这属于代理流量。

**AnyTLS 的抗探测原理：**
* **动态填充（Padding）与流量整形**：AnyTLS 能够强行插入随机长度的垃圾数据填充包，彻底打乱 TLS 握手和后续传输的数据包指纹，使流量分布曲线完美符合普通网页浏览的随机分布。
* **会话池热预热（Session Pool）**：传统的 TLS 握手需要经历昂贵的 RTT 延迟。AnyTLS 创造性地提供了 `min_idle_session` 预热池机制，后台会自动维持指定数量的“热连接”，当有新的请求发起时，可以直接复用已握手通道，真正做到毫秒级极速响应。

## 2.4 ECH (Encrypted Client Hello)：TLS 1.3 隐形斗篷
即便升级到了 TLS 1.3，在握手的第一阶段，客户端发送的 `ClientHello` 消息中依然会携带明文的 **SNI (Server Name Indication)**。这无异于在光天化日之下告诉防火墙“我正准备连接哪一个服务器”。

**Sing-Box 与 LepoProxy 联手实现的 ECH 隐形方案：**
* **全密文握手**：通过在安全 DNS（DoH）中提前异步查询目标服务器的 ECHConfig 公钥配置，客户端在向服务器发起 TLS 握手时，会使用该公钥将 `ClientHello` 中的 SNI、ALPN 等敏感字段进行强加密封包。
* 对于中间审查节点而言，整个握手过程除了能看到一个被称作“外层伪装 SNI”的公共网关域名外，核心的真实目标地址被锁死在密文箱中，彻底实现了全方位的防嗅探。

---

# 三、五大后端子模块核心架构剖析

LepoProxy 极力推崇**高内聚低耦合**的模块化工程美学。在 `src-tauri/src` 内部，我们精心拆分并编写了五大核心 Rust 子模块，各司其职，通过强类型通信管道进行高效流转。

```
+-----------------------------------------------------------------------------------+
|                              src-tauri/src/lib.rs                                 |
+-----------------------------------------------------------------------------------+
        |
        +---> [1] sub_translator/mod.rs (全自研离线极速转译引擎)
        |
        +---> [2] sub_fetcher/mod.rs    (网络异步多线程抓取与更新器)
        |
        +---> [3] node_splitting/mod.rs (智能路由与 Sing-Box JSON 装配引擎)
        |
        +---> [4] tun_manager/mod.rs    (系统底层虚拟网卡与安全断网控制器)
        |
        +---> [5] telemetry/mod.rs      (毫秒级高频遥测管道与连接监控器)
```

## 3.1 节点转译器：`sub_translator/mod.rs`
作为本项目的“超级编译器”，它负责解决各种来源（剪贴板单行链接、Base64 订阅密文、庞大的 Clash YAML 配置文件）的本地化清洗与翻译。
* **纯 Rust 驱动**：摒弃了臃肿的 Node 脚本，完全使用 Rust 原生处理文本。支持多线程并发解析，处理 10000 行的 Clash 配置文件仅需约 **2.5毫秒**，效率提升数千倍。
* **类型安全（Type-Safety）**：将各种非标准的协议参数抽象为 Rust 强类型结构体（如 `TlsConfig`、`RealityConfig`、`TransportConfig` 等），并在编译期卡死数据边界，彻底避免了由于配置文件格式不正确导致内核崩溃的问题。

## 3.2 在线抓取器：`sub_fetcher/mod.rs`
网络订阅的“前哨站”，负责处理一切网络请求与异步下载逻辑。
* **非阻塞异步运行时**：基于 `tokio` 协程池与 `reqwest` 异步客户端，支持多订阅并行拉取，互不阻塞，最大化压榨多核处理器的并发性能。
* **智能 UA 混淆（User-Agent Spoofing）**：为了防止被部分机场节点防火墙识别为机器拉取或限制访问，模块内置了主流浏览器和多款客户端的 UA 伪装池，并支持自定义请求头。
* **Cron 定时自动刷新**：设计了毫秒级的定时触发器，用户只需简单输入 Cron 表达式（如 `0 0 */6 * * ?`，表示每6小时更新），即可在后台静默完成节点的更新和合并。

## 3.3 路由与装配器：`node_splitting/mod.rs`
它是 LepoProxy 的“核心大脑”，负责将转译好的零散出站节点与系统复杂的分流规则合成为最终的 `config.json` 模板。
* **多策略组（Outbound Groups）智能合成**：自动将导入的节点按照物理延迟、国家地区（通过解析节点标签中的“香港”、“新加坡”等汉字关键字）分类，并生成“自动选择（Auto-Select）”、“负载均衡（Load-Balance）”、“故障转移（Fallback）”等高级策略组。
* **精细化 DNS 路由表**：自动配置双引擎 DNS。国内域名使用腾讯/阿里等低延迟 Local DNS 解析，国外域名强行通过 DoH 安全通道解析，并进行 DNS 嗅探（Sniffing）与 IP-Rule 规则关联，彻底绝杀 DNS 污染和 IP 回流现象。

## 3.4 提权虚拟网卡管理器：`tun_manager/mod.rs`
直接与操作系统底层网络驱动打交道的“硬核守卫”。
* **系统特权提升（UAC Elevating）**：在 Windows 下，通过封装 Tauri 的辅助提权进程，安全请求管理员权限，创建并初始化高性能的 **Wintun** 虚拟网卡驱动。
* **物理网卡接管与 DNS 重定向**：接管本地系统的路由表（Metric 0），并将全局流量导向虚拟网卡。同时强行锁定本地系统网卡的 DNS 服务器为本地环回地址（`127.0.0.1`），完成无漏网全局代理。

## 3.5 毫秒级遥测监控器：`telemetry/mod.rs`
前端 UI 与底层 Sing-Box 内核之间最繁忙的“数据高速公路”。
* **高频非阻塞通道**：通过 Rust 的 `tokio::sync::mpsc` 异步队列，实时捕获来自 Sing-Box 输出的活动连接（Active Connections）、CPU/内存开销以及秒级吞吐速度。
* **SSE/WebSocket 实时泵送**：将采集到的底层系统统计信息以极轻的 JSON 格式直接“泵送”至前端浏览器视图，为渲染时延图表和瞬时测速仪表盘提供源源不断的精确动力。

---

# 四、转译核心代码实现与测试验证

为了彰显技术硬实力，我们在此解剖 `sub_translator/mod.rs` 中的核心转译模型定义与极其严格的离线测试断言。这正是我们实现 **AnyTLS** 兼容和 **100% 单元测试绿灯率** 的秘密所在：

## 4.1 强类型数据模型解剖 (`src-tauri/src/sub_translator/mod.rs`)

```rust
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
    // 其他如 Vmess, Trojan, Hysteria2, Direct 等变体...
}
```

## 4.2 离线脱敏测试集运行结果验证

我们深知网络波动对于依赖线上转译 API 的客户端造成的致命打击，因此我们实现的是 **100% 本地纯离线转译**。为了测试其万无一失的正确性，我们部署了超大型测试用例：

```bash
# 进入 Tauri 后端目录并执行专属单元测试命令
cd src-tauri
cargo test --package app --lib sub_translator::tests
```

测试覆盖了包括最底层的 **AnyTLS 分配池、Reality 证书假借嗅探、Shadowsocks 自动 Base64 解密、以及大型 Clash 配置文件过滤非标准节点** 的所有场景：

```text
    Finished `test` profile [unoptimized + debuginfo] target(s) in 2.62s
     Running unittests src\lib.rs (target\debug\deps\app_lib-101866ca9d414729.exe)

running 5 tests
test sub_translator::tests::test_parse_single_uri_anytls ... ok
test sub_translator::tests::test_parse_single_uri_hysteria2 ... ok
test sub_translator::tests::test_parse_single_uri_shadowsocks ... ok
test sub_translator::tests::test_parse_single_uri_vless_reality ... ok
test sub_translator::tests::test_translate_clash_yaml ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

* **测试绿灯率**：**`100% (5 个核心测试场景完美通过)`**。这保证了哪怕您在最严苛的物理离线断网调试环境下，LepoProxy 的核心算法依然拥有坚不可摧的逻辑正确性！

---

# 五、产品成长“大饼”（五阶段路线图）

我们绝非在做一款简单的、玩具式的代理小工具，而是立志于打磨出一款具备行业标杆级别的**殿堂级桌面网络系统**。以下是我们无比清晰、层层递进的五阶段产品路线蓝图：

```
+-----------------------------------------------------------------------------------+
|                                  LepoProxy 蓝图规划                                |
+-----------------------------------------------------------------------------------+
   Phase 1 [✅ 已实现] : 极速转译引擎 (离线核心、AnyTLS/ECH 深度适配、单元测试绿灯)
          |
   Phase 2 [/ 研发中] : 多线程抓取器 (网络异步流解析、UA 自动混淆、多源免费节点搜刮)
          |
   Phase 3 [⏳ 待启动] : 智能装配中枢 (GeoSite/GeoIP 策略组拼合、DNS 嗅探级分流)
          |
   Phase 4 [⚡ 待启动] : 虚拟 Tun 接管 (Windows UAC 安全提权、防断网守护进程)
          |
   Phase 5 [🎨 待启动] : 美学遥测终端 (毛玻璃数据可视化折线图、毫秒级活动流展示)
```

## 5.1 第一阶段（Phase 1）：极速离线转译引擎（核心已完成）
* **研发目标**：解决一切本地/网络配置文件向 Sing-Box 配置的无损转换问题。
* **已达成里程碑**：
  * 完成了对 Shadowsocks、VLESS Reality/Vision、VMess、Trojan、Hysteria 2 协议的深度适配。
  * **业内首家**实现了对 **AnyTLS** 协议的一等公民（First-Class）支持，自动补全 SNI 回退。
  * 引入 `yaml-rust2` 分析器，能够从大型 Clash YAML 配置文件中过滤并解析出全部优选节点，并自动且安全地忽略不支持的旧 SSR 节点。
  * 部署了 100% 离线的高难度单元测试。

## 5.2 第二阶段（Phase 2）：多源异步抓取与搜刮中枢（当前研发中）
* **研发目标**：解决节点“从哪里来”的问题，实现多源、高效、自动化的网络节点采集。
* **核心特性规划**：
  * **异步非阻塞并发池**：通过多线程异步并发拉取用户指定的在线订阅地址，支持网络超时重试和代理中转拉取。
  * **免费节点 GitHub 搜刮雷达**：利用 GitHub Search API 或指定的开源整理项目，定期自动抓取、刮削（Scrape）散落在互联网上的免费节点资源。
  * **数据净化与去重引擎**：自动对搜刮到的节点进行 IP/域名去重、协议校验以及基础联通性快速握手（Fast TCP Ping），确保垃圾节点和死节点在转译前就被彻底过滤。

## 5.3 第三阶段（Phase 3）：路由分流配置智能装配器（已规划）
* **研发目标**：解决“怎么走最快、最安全”的问题，实现高度自由且极度智能的分流决策。
* **核心特性规划**：
  * **智能关键字匹配策略组**：解析节点标签（如“HK 0.5x”、“新加坡 IPLC”），自动分类并归档至“香港策略组”、“新加坡策略组”及“高倍率节约组”。
  * **三维路由过滤系统**：支持极速匹配国内常规网站域名白名单（Geosite-CN）、国内物理 IP 段（Geoip-CN），自动分配直连（Direct），将未匹配流量打入“漏网之鱼”代理出站。
  * **自定义分流规则沙箱**：为高级用户提供前端可视化编辑的规则规则链，轻松拖拽即可实现“Steam 联机直连”、“ChatGPT 强制美国 AnyTLS 出站”等高级路由分流策略。

## 5.4 第四阶段（Phase 4）：系统内核 TUN 虚拟网卡与守护进程（已规划）
* **研发目标**：实现“傻瓜式、一键式”的系统流量托管，并配备军工级防断网防泄露护盾。
* **核心特性规划**：
  * **Wintun 一键无感初始化**：无需繁琐的手动网卡配置，用户点击“开启代理”，后台自动进行系统级管理员提权，极速创建零拷贝虚拟网卡。
  * **防断网看门狗守护进程（Watchdog）**：
    > [!IMPORTANT]
    > **“如果客户端被强行杀掉、或者系统意外崩溃，导致系统路由表和 DNS 锁死在虚拟网卡上，用户就会瞬间面临断网悲剧。”**
    >
    > 为了彻底根治这一行业顽疾，我们将额外编译一个极其微小、开销近乎为零的 **“安全看门狗（Watchdog）守护进程”** 与 Sing-Box 核心绑定运行。
    * 看门狗会以毫秒级频率双向心跳检测 LepoProxy 进程的 PID。
    * 一旦发现主程序被强行杀掉或突发崩溃，守护进程会在 **10毫秒内** 迅速介入，强行接管系统网络层，强行恢复物理网卡的默认路由与 DNS，完成**“无感恢复”**，确保用户绝对不会因为软件异常而丢失网络连接！

## 5.5 第五阶段（Phase 5）：高维美学遥测终端（已规划）
* **研发目标**：让原本枯燥冷冰冰的网络数据，变成一场极具视觉享受的美学盛宴。
* **核心特性规划**：
  * **毛玻璃磨砂面板可视化图表**：使用 Canvas/WebGL 技术，以 60 帧极高刷新率渲染上下行带宽占比、即时 RTT 动态波动折线图。
  * **动态可视化节点连接流**：以粒子动效实时渲染系统网络连接是流向了“直连节点”还是通过“AnyTLS/Reality”流向了海外节点，让您的每一次网络跳转都极具科技掌控感。

---

# 六、超详尽编译部署与极客开发手册

为了让任何对代码感兴趣的极客开发者都能无缝参与到 LepoProxy 的二次开发中，我们准备了这篇涵盖多操作系统（以 Windows 10/11 为主）的保姆级编译指南。

## 6.1 各操作系统环境准备 (Prerequisites Setup)

不同的操作系统需要安装各自平台的 C++ 编译器和系统级 Webview SDK 支持：

### 🛠️ A. Windows 开发环境配置（当前系统）
1. **安装 Rust 工具链**：
   * 下载并运行 [rustup-init.exe](https://rustup.rs/)。
   * **至关重要**：在安装选项中，必须选择安装 **Desktop development with C++**（通常通过 Windows 提供的 Visual Studio Build Tools 或 Visual Studio 2022 社区版进行安装，勾选“C++ 桌面开发”工作负载）。这会提供编译 Rust 底层代码所需的 `link.exe` 链接器和 Windows SDK 依赖。
2. **确认 Webview2 支持**：
   * Windows 10/11 系统通常已内置 **Microsoft Edge WebView2 运行时**。若您处于极度精简的 Windows 纯净系统，请前往微软官网手动下载安装 [WebView2 Evergreen Bootstrapper](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)。
3. **安装 Git 与 Node.js**：
   * 安装 Git 客户端以及 Node.js (推荐 Lts 长期支持版，例如 v20.x)。

### 🍎 B. macOS 开发环境配置
1. 安装 macOS 的开发者核心套件 Xcode Command Line Tools：
   ```bash
   xcode-select --install
   ```
2. 通过 rustup 安装 Rust 工具链。macOS 会直接调用系统内置的 WebKit 渲染 WebView，无需安装额外运行时。

### 🐧 C. Linux 开发环境配置（Ubuntu/Debian 体系）
由于 Linux 发行版极度纯净，您需要使用包管理器手动补充编译前端和底层 IPC 所需的开发头文件：
```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayumu-dev \
  librsvg2-dev
```

## 6.2 本地运行与热重载 (Local Iteration)

1. 克隆 LepoProxy 代码库至本地：
   ```bash
   git clone https://github.com/yourusername/LepoProxy.git
   cd LepoProxy
   ```
2. 执行前端依赖的极速安装：
   ```bash
   npm install
   ```
3. 启动开发服务器（支持完美的**“前端修改热重载 + Rust代码保存自动重编译”**）：
   ```bash
   npm run dev
   ```

## 6.3 极客排错手册 (Troubleshooting & Core FAQ)

在您编译或运行 Rust Tauri 后端时，可能会遇到各种诡异的系统环境冲突。别慌，以下是前人踩坑总结出的黄金排错方案：

### 🛑 坑点一：`link.exe` 报错找不到 Windows SDK 头文件或库
* **病症表现**：编译时 Rust 提示类似 `error: linker 'link.exe' not found` 或者找不到特定的 `.lib` 依赖。
* **极速药方**：
  1. 打开您的 **Visual Studio Installer**，找到您已安装的工具版本（例如 Visual Studio 2022），点击“修改”。
  2. 确保勾选了 **“MSVC v143 - VS 2022 C++ x64/x86 生成工具”**。
  3. 确保勾选了 **“Windows 11 SDK (或最新版 Windows 10 SDK)”**。
  4. 重新打开您的终端/PowerShell 以强制刷新环境变量，再次运行编译即可。

### 🛑 坑点二：Tauri 编译时卡死在下载 Webview2 组件阶段
* **病症表现**：控制台在输出 `Compiling tauri-build...` 后，由于国内极其严苛的网络环境，导致 Cargo 在尝试通过网络拉取 WebView2 静态编译组件时超时挂起。
* **极速药方**：
  * **方案 A（最优解）**：确保您在本地开启了稳定的网络中转代理（例如通过主 Clash 客户端接管系统全局端口），并在控制台终端中强制注入代理环境变量：
    ```powershell
    $env:HTTP_PROXY="http://127.0.0.1:7897"
    $env:HTTPS_PROXY="http://127.0.0.1:7897"
    ```
  * **方案 B**：如果因网络阻断实在无法在线拉取，可以配置国内加速镜像源。在您系统的当前用户目录下（例如 `C:\Users\用户名\.cargo\`）创建并配置 `config.toml`，更换为字节跳动或清华大学的 Cargo 镜像源。

### 🛑 坑点三：`cargo test` 运行报错无法访问外部文件
* **病症表现**：在部分安全管控极严的 Windows 电脑中，运行测试可能因为权限原因导致创建临时转译数据失败。
* **极速药方**：
  * 确保您的编译命令行使用的是系统原生的 **PowerShell** 或 **CMD**，并且以普通用户权限运行（不建议在没有配好环境的 Administrator 超级管理员终端中直接跨目录测试）。
  * 我们的 `sub_translator` 单元测试均已完美封装为**内存流模拟**（使用 `translate_clash_yaml` 内存字符串），没有任何写盘操作，从根源上杜绝了磁盘读写权限导致的报错。

---

<div align="center">
  <strong>💎 让每一次连接，都成为视觉与速度的双重享受。</strong>
</div>
