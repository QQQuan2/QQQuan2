# Tiny Island

> Build a little world of your own.
> A place to grow, explore, and leave a little piece of yourself.

一个漂浮在海洋上的微型 3D 岛屿。旋转探索、切换昼夜氛围、放置装饰。
**两个分开的记录系统**：点击岛上的室外邮箱写记忆便签（生活碎片），走进小屋
点击桌上的笔记本打开 **Life Journal**（计划 / 目标与愿望 / 自由页 / 回顾）。
数据都真实保存在浏览器里，记忆还会让岛屿慢慢长大。
同一台设备可建立多个本地档案，每个档案拥有完全独立的小岛、记忆与手账。

---

## 运行方式

**必须通过本地 HTTP 服务打开**（ES modules 不能用 `file://` 直接打开）。

### 方式 A：双击（Windows）
运行 `start.bat`，浏览器会自动打开 `http://localhost:8000`。

### 方式 B：命令行
在本目录执行任意一条：

```bash
python -m http.server 8000
# 或
py -m http.server 8000
# 或
npx serve .
```

然后访问 **http://localhost:8000**。

**入口文件：`index.html`**

无需联网、无需安装依赖、无需账号或后端。Three.js 已放在 `vendor/` 中，
核心场景完全离线可运行。

推荐 Chrome / Edge，分辨率 1366×768 及以上（课堂投屏已适配）。

---

## 文件结构

```
tiny-island/
├── index.html              入口页面：UI 结构 + importmap
├── start.bat               Windows 一键启动
├── README.md
├── DELIVERY.md             交付报告（含实机测试结果与演示顺序）
├── preview/                实机截图：白天 / 日落 / 夜晚 / 日记
├── css/
│   └── style.css           玻璃控制面板、纸张日记、提示、响应式
├── vendor/
│   ├── three.module.js     Three.js r160（本地，离线可用）
│   └── OrbitControls.js    相机控制器（本地）
└── js/
    ├── main.js             应用入口：组装场景、射线交互、相机过渡、主循环
    ├── world.js            renderer / 相机 / 光照阴影 / 渐变天空 / 动态海面 / 云 / 星空
    ├── island.js           不规则岛屿地形 + 12 层分层岩石岛底
    ├── house.js            小屋：曲面瓦顶、半木结构、拱窗、老虎窗、烟囱烟雾
    ├── structures.js       步道、池塘、码头、小船、邮箱、路灯、栅栏、成长内容
    ├── nature.js           树 / 花 / 岩石 / 灯 / 草丛（同时供装饰模式复用）
    ├── atmosphere.js       Day / Sunset / Night 平滑过渡
    ├── decorations.js      装饰模式：预览、有效性判定、放置、删除、重置、持久化
    ├── diary.js            邮箱记忆：心情、保存、历史、删除、修订、记忆星点
    ├── journal.js          Life Journal：室内手账四区、独立存储、书本式 UI、两步删除
    ├── growth.js           岛屿成长：累计计数、5 级地形扩张、里程碑、景观解锁
    ├── profile.js          本地档案：索引/快照存储、旧数据安全迁移、创建/切换/删除
    └── utils.js            共享几何/材质缓存、随机、三角网格构建、localStorage
```

---

## 已实现功能

**视觉**
- 不规则轮廓的悬浮岛，12 层渐收的岩石岛底，低多边形草地表面
- 曲面瓦片屋顶小屋（半木框架、拱形发光窗、花箱、门廊、老虎窗、烟囱飘烟）
- 弯曲石板步道、池塘与睡莲芦苇、木码头与小帆船、花园、栅栏、路灯
- 三种树形（圆冠 / 松树 / 秋色）、发光记忆树
- 顶点位移动态海面（浪峰、光带、同心波纹、环绕浪花圈、远景雾）
- 渐变天空、缓慢漂移的云、夜晚星空
- 半球光 + 环境光 + 带阴影的方向光，ACES 色调映射

**交互**
- 拖动旋转 / 滚轮缩放 / 阻尼平滑 / 角度与距离限制 / Reset View
- Day / Sunset / Night：天空、雾、光照、海色、窗光、路灯、星空联动平滑过渡
- 装饰模式：Tree / Flowers / Rock / Lantern，实时半透明预览与合法性校验、
  Remove 删除、Reset Decorations，数据持久化
- **室外邮箱 · 记忆便签（Mailbox）**：点击邮箱写生活碎片，自动日期、5 种心情、正文、保存、历史查看、单篇删除、修订历史、心情筛选；保存后邮箱暖光脉冲、岛上新增记忆星点、计数更新
- **室内 Life Journal（个人生活手账）**：走进小屋点击桌上笔记本，打开书本式手账 —— Planner（计划+日期+待办+完成）、Goals & Dreams（目标/愿望+描述+可选日期+状态）、My Pages（自由标题+正文+调序）、Reflection（周/月回顾）。编辑即时自动保存，删除两步确认，四个彩色书签切换分区，Esc 或右上角随时关闭
- 两个系统数据完全独立：邮箱用 `tiny-island.memories.v1`，手账用 `tiny-island.journal.v1`，互不显示、互不同步、互不覆盖
- 岛屿成长：累计记忆数驱动 5 级地形扩张（初生/萌芽/生长/繁盛/永恒，
  100%→160% 平滑过渡），10/25/50/100 里程碑播放扩张动画并解锁景观；
  删除不会让岛屿缩小，解锁后可在装饰模式自行建设
- 邮箱记忆、手账、装饰、氛围均写入 localStorage，刷新后完整恢复
- 本地个人档案：控制面板的 **Profiles** 可创建全新档案、切换、二次确认删除；
  每个档案的记忆、手账、修订历史、心情、成长、装饰、天色、设置、引导进度完全独立，
  切换会重载页面重建场景，删除不会让岛屿倒退；旧数据已无损迁入默认档案
  （迁移备份永久保留，幂等不重复导入）

活动档案数据键：`tiny-island.memories.v1`（邮箱记忆）、`tiny-island.journal.v1`（手账四区）、
`tiny-island.moods.v1`（自定义心情）、
`tiny-island.diarySettings.v1`（编辑时限）、`tiny-island.growth.v1`（成长进度）、
`tiny-island.decorations.v1`、`tiny-island.welcomed.v1`、
`tiny-island.atmosphere`（氛围键无版本后缀）。
档案系统键：`tiny-island.profiles.v1`（索引）、`tiny-island.p.<id>.v1`（各档案快照）、
`tiny-island.profile.switch.v1`（切换安全标记）、`tiny-island.migration.backup.v1`（迁移备份）。

---

## 关于 Blender

**未使用 Blender** —— 当前环境未安装（`Get-Command blender` 无结果，
常见安装路径也不存在）。按需求采用 Three.js **程序化建模**：
岛体、岩层、屋顶、船壳都是自定义 `BufferGeometry`（非基础几何体堆砌），
树冠/岩石/云为扰动过的多面体，并共享几何与材质缓存控制 draw call。
项目不依赖任何外部模型或在线资源。

---

## 课堂演示推荐顺序（约 1 分钟）

1. **0–10s**　打开页面，让岛屿缓慢自转，展示整体构图与小屋细节；
   拖动旋转一圈、滚轮拉近看屋顶与池塘。
2. **10–25s**　依次点 **Day → Sunset → Night**，展示天空、海面、
   窗户灯光与星空的平滑变化（Night 停留几秒）。
3. **25–40s**　点 **Tree / Lantern**，在草地上放两三件，
   再用 **Remove** 删掉一件，最后 **Reset decorations**。
4. **40–60s**　点岛上的**红色邮箱** → 选心情 → 写一句 → **Save Memory**。
   看邮箱亮起、岛上多出星光；再刷新页面，证明记忆与成长状态仍在。
5. **60–80s**　点小屋进入室内 → 点桌上**笔记本**，打开书本式 Life Journal；
   在 Planner 写一条计划加两个待办，切到 Goals / My Pages / Reflection 各看一眼，
   关闭后刷新再打开，证明手账独立保存且邮箱记忆没有混进来。

---

## 已知限制

- Life Journal 的 My Pages 第一版为纯文字自由页：项目无图片上传/存储能力，未实现图片块；也不自动生成任何计划/目标/回顾。
- 装饰放置采用"选工具 → 点击地面"而非物理拖拽（按需求刻意简化）。
- 小船为漂浮在云海上的 stylized 处理，与低处海面之间做了写意而非物理衔接。
- 海洋为自定义 shader 波浪，未做反射/折射等真实水体光学。
- 记忆星点最多显示 14 个（日记更多时仅影响计数与成长阶段）。
- 档案为纯本地实现：无云同步、无跨设备、无重命名入口；多标签同时打开同一档案时按最后写入者生效。
- 删除档案为即时删除（有二次确认，且至少保留一个档案），无回收站。
