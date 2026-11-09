# 麻将记账 · 前端设计方向（frontend-design-direction）

> 应用技能：`frontend-design-direction`（ECC 抢救版，源 `affaan-m/ECC` PR #1659）。
> 本文是**编码前**的方向与证据契约，按技能要求先定方向、把约束写成可检查项，再改代码。
> 重构范围：仅 `public/` 前端三件套；`lib/*`、`server.mjs`、计分内核、账本、API 契约**零改动**。

## 1. Design Direction

| 维度 | 选择 | 依据 |
|---|---|---|
| **Purpose** | 牌桌上四个人快速记录每局输赢、随时扫一眼当前净分、局末一键结算转账 | 产品是**重复使用的记账工具**，不是落地页、不是游戏、不是作品集 |
| **Audience** | 牌桌旁的四个人：光线偏暗、常单手持机、注意力在牌上、每局只有几秒空档 | 首屏必须先给「四家当前分」，主操作必须是拇指可达的一个大按钮；信息密度要高但要能扫 |
| **Tone** | **记分牌 / 记分簿式的克制器物感**：utilitarian + calm + refined + dense | 技能明确要求 "Do not force a landing-page composition onto a tool that needs repeated daily use"；当前红色渐变 hero 属于典型的模板落地页构图，须去掉 |
| **Memorable detail** | **把「四家净分」做成一块真正的方位计分牌**：深色绒布底（牌桌材质）、每家一条固定座位色、大号等宽数字、`+ / −` 符号与颜色双重编码、庄家一枚印记。它是全页唯一的大面积深色块，第一屏即传达「这是麻将计分板」 | 当前四家分数是四张与「最近记录」同权重、同圆角、同边框的白色通用卡片，核心对象没有视觉重量 |
| **Constraints** | 原生 HTML/CSS/JS 零构建零新增依赖；**保留全部现有 DOM id / class 钩子与 778 行 app.js 事件绑定**；390px 手机优先且 ≥900px 桌面真适配；可访问性（focus-visible、label、对比度、reduced-motion、≥44px 触摸目标）；不改后端任何接口与计分内核 | 项目零依赖单端口，账本 append-only、四家净分零和；重构不得翻旧账 |

### 1.1 为什么这样改（当前 UI 对照技能反模式）

| 技能反模式 | 当前实现的问题 | 本次处理 |
|---|---|---|
| 单色主导 / one-note palette | `--red` 通吃 hero、topbar、主按钮、active、chip、正分 | 改多维色板：**墨绿作结构色**，座位四色各归其位，**朱红只作正分与危险动作的信号色** |
| 落地页构图 / 模糊 hero | 首页 30px padding 红色渐变 + 🀄 + 大标题 + 副标题，把两个表单挤到首屏之下 | 压成一条紧凑品牌条，首屏直接给「开新局 / 加入」两个动作 |
| 卡片套卡片 / 万物皆卡 | 面板、庄家、语音、结算卡片全是同款白卡 | 计分牌升为唯一视觉焦点；其余降为行列表与细分隔线 |
| 无意义装饰 / emoji 当图标 | 底部 5 个 tab 用 emoji，跨设备字形不一致 | 换内联 SVG 线性图标（`currentColor`，零依赖） |
| 隐藏主工作流 | 首页靠一段长文案解释「怎么用」 | 精简为一句必要 hint，控件自己说话 |
| 缺状态设计 | 只有 toast；无 loading / 空 / 错误 / 局部 / 成功 / 权限的成体系反馈 | 按 §3 补齐六种状态 |
| 缺可访问性与动效约束 | 无 focus-visible、无 reduced-motion、无 dialog 语义 | 按 §4 补齐 |

## 2. Evidence Contract（可检查约束）

| 项 | 契约内容 | 检查方式 |
|---|---|---|
| **Product surface** | 房间制麻将记账；主界面 5 面板：看板 / 记分 / 记录 / 结算 / 统计 | DOM 断言 5 个 `.panel` + 5 个 tab |
| **User's job** | 一局结束 3 秒内记完一局；随时确认四家当前分；局末拿转账方案 | 记分页首屏可见主操作；看板首屏可见四家净分 |
| **Primary action** | 「＋ 记一局」→ 报胡型 → 预览 → 确认落账 | 按钮存在、≥44px、落账后看板净分更新 |
| **Hierarchy** | 四家净分 > 庄家 > 最近记录 > 主操作 > 其余 | 视觉权重：计分牌是唯一深色大块；数字 30px；其余 12–14px |
| **Target viewports** | `390x844`（主，手机）、`375x812`（窄）、`1440x900`（桌面） | 三个视口各留一张实拍截图，逐一检查溢出 |
| **Reference observation** | 本地现有实现（`public/` 三件套，不外传）；四家净分恒零和；座位色已存在于 `COLORS = {E,S,W,N}`；庄家仅影响马牌座位映射 | 读源码 + 算例回归；不引入外部参考服务 |
| **Palette** | 墨绿 `#1f4a3f` 结构 / 暖纸 `#f5f2ea` 底 / 座位四色 / 朱红 `#b5392f` 正分 / 竹青 `#2f7d68` 负分 / 赭金 `#b8862f` 庄家 | 计算对比度；确认不存在单一色相主导 |
| **Typography** | 数字 `tabular-nums`；正负用 `+` / `−`（U+2212）；长昵称不溢出 | 桌面与手机长昵称演练；`scrollWidth <= innerWidth` |
| **Responsive** | 移动单列、计分牌 2×2；桌面 `#app` 放宽、计分牌 4 列、面板两栏、tabbar 转顶部 | 三视口量元素 boundingRect，无横向溢出 |
| **Motion** | 仅状态过渡（按钮按压、弹层进入、tab 切换）；`prefers-reduced-motion` 下全关 | 媒体查询 + 浏览器模拟 |
| **Zero-sum invariant** | 前端展示的净分必须来自服务端计分引擎，四家之和为 0；手改不平则禁止落账 | 预览/确认页合计校验并禁用确认按钮 |

## 3. Content States（触发 / 可见反馈 / 安全下一步）

| 状态 | 触发 | 可见反馈 | 安全下一步 |
|---|---|---|---|
| **Loading** | 创建/加入房间、解析口述、确认落账 | 按钮 `disabled` + 文案变「解析中… / 落账中…」+ `aria-busy="true"`；不闪烁已显示的看板 | 完成后恢复；失败落到 Error |
| **Empty** | 新房间 0 局 / 记录页 / 走势页 / 结算页 | 计分牌四家 `0`；「还没有记录」+ 明确的「去记第一局」；走势「记满一局后出现曲线」；结算「四家持平，无需转账」 | 一键进记分页 |
| **Error** | 房间码无效 / 网络失败 / 解析失败 / 四家不平 | 具体原因 toast 或内联错误文案；不平则合计标红且**确认落账按钮禁用**；房间打不开退回首页 | 重输、重说、手改分数、返回首页 |
| **Partial** | 有作废记录 / 走势只有 1 个点 / LLM 未配置走规则模式 / 走势缺某几局 | 作废记录降透明度 + 「已作废」标签；单点走势仍画出并标注；「规则模式」徽标 + 黄色警示条如实说明降级 | 手改、作废、去设置接 LLM 或继续用规则模式 |
| **Success** | 落账成功 / 庄家切换 / 手改 / 作废 / 复制成功 | `role="status"` 播报；自动切回看板且净分即时更新 | 记录页提供「手改 / 作废」作为撤销路径；账本 append-only 不覆盖原记录 |
| **Permission** | 访问链接带 `sharecode` / LLM 设置页 / 密钥不回显 | 首页说明「链接即凭据」；设置页说明「密钥只存服务端、不回显」；如实标注当前拿到链接者均可写（只读积分板为后续方向） | 设置页可停用 LLM 回退规则模式；不暴露密钥 |

> 说明：`loading` 的看板骨架不适用 —— 房间数据在 `init()` 里 `await` 完成后才 `show('main')`，因此看板不存在可见的中间态；Loading 状态由表单按钮态承担。这是**写明理由的不适用**，不是未测试。

## 4. Rendered Finish Gate 检查项

1. 目标三视口实拍，`scrollWidth <= innerWidth`，长昵称（12 字）不溢出。
2. 键盘 Tab 可达所有控件；`:focus-visible` 有可见描边；弹层 `role="dialog" aria-modal`；toast `role="status"`；tab 有 `aria-selected`。
3. 所有 `input` / `select` 有关联 `label` 或 `aria-label`；图标按钮有可访问名。
4. 正文与背景对比度 ≥ 4.5:1，大号数字 ≥ 3:1；正负不靠颜色单独编码。
5. 触摸目标 ≥ 44×44px；`prefers-reduced-motion: reduce` 下无动画。
6. 逐一演练 §3 六种状态（含 partial），截图留档。
7. 写 JSON evidence record 到 `docs/evidence/`，运行技能自带 `scripts/check-evidence.js`。

## 5. 实施边界（机械可验证）

- **不改**：`server.mjs`、`lib/rules.ts`、`lib/score.ts`、`lib/settle.ts`、`lib/store.mjs`、`lib/parse.mjs`、`lib/llm.mjs`、`scripts/verify.ts`、`package.json`。
- **不改**：`app.js` 中 `api()`、`withShare()`、`roomUrl()`、`homeUrl()`、`doPreview()`、`confirmScore()`、`saveEdit()`、`doParse()`、`confirmParsed()`、`collectGang()` 等任何与后端交互或计分相关的逻辑。
- **只改**：`index.html` 结构与语义、`style.css` 全量、`app.js` 的渲染模板函数与状态呈现（`scoreCells` / `recordHtml` / `renderBoard` / `renderRecords` / `renderSettle` / `renderStats` / `switchTab` / `toast` / 按钮 busy 态）。
- **保留**：全部 `#id` 与 `#tabbar button[data-tab]`、`.seat-btn[data-seat]`、`.chip[data-pattern]`、`#ghost-switch button[data-ghost]`、`#horse-row select[data-i]` 等选择器钩子。
- **验收**：现有 14 个算例、API 闭环、线上演示房间 3 局净分 `东-18/南+16/西+32/北-30` 必须全部不变。

## 6. Rendered Finish Gate 结果

技能自带 `scripts/check-evidence.js`（从 `affaan-m/ECC` 补齐，本地安装时只带了 SKILL.md）已运行：`evidence.json` **退出码 0**；删掉 `1440x900` 视口的负例被正确拒绝（退出码 1）。证据记录与原始测量分别在 `docs/evidence/evidence.json`、`docs/evidence/measurements.json`，16 张实拍截图同目录。

| 检查 | 结果 |
|---|---|
| 目标视口 | `390x844` / `375x812` / `1440x900` 各留实拍；四组测量 `innerWidth == scrollWidth`，**零横向溢出**；12 字长昵称在 375px 下两行截断带 `title` |
| 视觉层级 | 计分牌为全页唯一深色大块，座位四色条 + 庄家金印 + 30/36px 等宽数字；其余信息降为行列表，无卡片套卡片 |
| 对比度 | 正分 6.07:1、负分 7.38:1、玩家名 10.88:1、正文 14.5:1、房间名 12.22:1、主按钮 9.95:1，**最低 6.07:1**（含半透明卡片底 alpha 合成） |
| 可访问性 | Tab 首个焦点为 skip-link 且 `:focus-visible` 生效（3px 实线）；`tablist/tab/aria-selected/tabpanel/dialog/aria-modal` 齐全；toast `role=status aria-live=polite`；计分卡每格有 `aria-label`；**0 个未标注 input/select**；tabbar SVG 全部 `aria-hidden` |
| 触摸目标 | 四个测量场景均 **0 个 <44px** 控件 |
| 动效 | `prefers-reduced-motion=reduce` 下 `transitionDuration=1e-06s`（0.001ms），动画关闭 |
| 六状态 | loading（真实 400ms 延迟请求中的 `aria-busy`）、empty（四面板各自空态 + 下一步）、error（账不平禁用落账 / 房间码无效退回首页）、partial（作废记录、单点走势、规则模式降级）、success（落账播报 + 撤销路径）、permission（密钥不回显 + 链接即凭据）——均由真实交互触发 |
| 回退验证 | 14 个算例全过；63 个 DOM 钩子零丢失；29 个 CSS 变量零悬空；`server.mjs` 与 `lib/*` 一行未改 |

**截图索引**：`01` 手机看板 / `02` 375px 长昵称 / `03` 桌面看板 / `04` 记分页（有鬼 4 张）/ `05` 硬胡 6 张摸马 / `06` 结算 / `07` 桌面统计 / `08·08b` 空状态 / `09` 作废记录 / `10` 账不平 / `11` loading / `12` 权限弹层 / `13` 房间打不开 / `14` 单点走势 / `15` 落账成功。每张的观察结论写在 `evidence.json` 的 `renderedEvidence[].observation`。

### 6.1 如实标注的限制（未测，不冒充通过）

- **语音识别未做真实音频验证**：无头环境无麦克风，Web Speech 的录音→转文字链路未实测；本轮只验证了输入框、按钮与不支持时的隐藏逻辑。按技能口径，这属于「无测试条件」，不是「不适用」。
- **真实 LLM 端点未在本轮重跑**：线上仍为规则模式；配置弹层与密钥边界已验证，LLM 全链路在 v1.3 时用 mock OpenAI 兼容端点验证过。
- **辅助技术**：只做了 DOM 语义、焦点与对比度检查，未用 NVDA / VoiceOver 实测朗读。
- **断点覆盖**：只测 375 / 390 / 1440 三档，未覆盖 1024、1920 等；真机安全区与手势未实测，用浏览器设备模拟替代。
- **CSS 不是设计系统迁移**：沿用原生 CSS 变量，未引入组件库或 token 工具链；桌面两栏是媒体查询分层，不是独立布局系统。

> 技能原文提醒：`a passing record does not replace actual rendered review`。因此本轮除跑 checker 外，另用图像检查逐张查看了主画面、桌面、记分页、硬胡 6 张、统计与五类状态截图，均未发现重叠、截断或溢出。

