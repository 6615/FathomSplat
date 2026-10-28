# FathomSplat 网页 PLY Viewer 指南

本文说明当前 Three.js 彩色点云 Viewer 的数据要求、替换方法，以及第二阶段完整 3D Gaussian Splat Viewer 的计划。

## 1. 当前实现：XYZRGB 点云

当前页面采用以下链路：

```text
XYZRGB PLY -> Three.js PLYLoader -> THREE.Points -> WebGL
```

`static/js/pointcloud-viewer.js` 负责加载 PLY、自动居中、设置相机、渲染和鼠标交互。Viewer 支持：

- 左键拖动：旋转。
- 滚轮或双指：缩放。
- 右键拖动：平移。
- Dark / Light：切换点云窗口底色。
- Reset：恢复该窗口的初始相机。

带有相同 `data-sync` 值的对比窗口共享相机视角。拖动其中一个窗口时，其余窗口会跟随，便于在相同角度比较输出。

黑白背景是网页 CSS 和透明 WebGL Canvas 的组合，不是 PLY 中的数据，也不需要单独下载背景图片。

Three.js 0.160.1 及所需 addons 已固定在 `static/vendor/three/`，因此部署后的 Viewer 不会在访客浏览器中执行 CDN 脚本。第三方许可证见 `static/vendor/three/LICENSE`。

## 2. 当前双模型画廊

顶部画廊明确分成两组：

| 网页标签 | 唯一原始来源 | 场景数 |
|---|---|---:|
| FathomSplat | `asset/Fathomsplat/ply` | 8 |
| AnySplat | `asset/anysplat/ply`，与 `3d_result/normal/ply` 一致 | 8 |

`3d_result/page` 不参与画廊。运行 `python3 scripts/prepare_method_galleries.py --target-points 250000` 可重新生成轻量 PLY、视频封面和 manifest。当前画廊统一使用 `[180, 0, 0]` 初始旋转。

## 3. 原有 6 个页面文件

目录：

```text
project-page/static/models/pointclouds/
```

文件：

```text
cave_aaai_web.ply
direct_fit_placeholder.ply
medium_free_placeholder.ply
budget_003_placeholder.ply
budget_016_placeholder.ply
budget_064_placeholder.ply
```

它们分别用于主展示、介质分解对比，以及 3/16/64 输入视角对比。所有页面文件均为 `binary_little_endian` XYZRGB PLY。主窗口的 `cave_aaai_web.ply` 由 `asset/cave_aaai.ply` 转换；其余 5 个文件头带有 synthetic placeholder 注释，是**示意占位资产，不是实验结果**，正式上线前必须替换。

## 4. 真实点云格式

当前 Viewer 需要每个顶点至少包含：

```text
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
```

ASCII 与 binary little-endian PLY 均可，正式部署推荐体积更小、加载更快的 binary PLY。不要导出 `face`；这里展示的是点而不是三角网格。

建议导出流程：

1. 从预测结果中取 3D 中心 `xyz`。
2. 将可视颜色转换为 `0–255` 的 `uchar RGB`。
3. 按 opacity 或 confidence 过滤漂浮点。
4. 使用 voxel downsampling 生成网页预览版。
5. 保持同一比较组的坐标系、裁剪范围和体素尺寸一致。

若模型颜色只存储在 `f_dc_*` 或球谐系数中，需先解码为 RGB；当前 Viewer 不会自动把 3DGS 球谐属性转换为颜色。

## 5. 替换 PLY

如果输入是带 `f_dc_* / scale_* / rot_* / opacity` 的完整 3DGS PLY，先生成轻量网页副本：

```bash
python3 scripts/prepare_web_ply.py \
  asset/cave_aaai.ply \
  static/models/pointclouds/cave_aaai_web.ply \
  --target-points 800000
```

脚本保留 XYZ，并将 `f_dc_0/1/2` 解码为 RGB。`--target-points` 可省略，此时保留全部 Gaussian 中心。原始 PLY 不会被修改。

最简单的方法是用真实点云覆盖占位文件，并保留原文件名：

```text
static/models/pointclouds/cave_aaai_web.ply
static/models/pointclouds/direct_fit_placeholder.ply
static/models/pointclouds/medium_free_placeholder.ply
static/models/pointclouds/budget_003_placeholder.ply
static/models/pointclouds/budget_016_placeholder.ply
static/models/pointclouds/budget_064_placeholder.ply
```

推荐在正式替换时同步改为能表达实验内容的英文文件名，例如：

```text
flsea_reef_hero.ply
synthetic_direct_fit.ply
synthetic_medium_free.ply
flsea_budget_003.ply
flsea_budget_016.ply
flsea_budget_064.ply
```

改名后，在 `index.html` 中找到对应 Viewer 的 `data-ply="static/models/pointclouds/..."` 并更新。不要使用空格、中文或只靠大小写区分的文件名。

建议对应关系：

| 窗口 | 推荐真实数据 |
|---|---|
| Hero | held-out FLSea 或最佳 BlueROV 完整重建 |
| Direct fit / Medium-free | 相同输入、相同场景的消融与完整模型输出 |
| 3 / 16 / 64 views | 相同场景、仅改变输入视角数量的输出 |

替换后检查初始朝向、包围范围和点大小；如需定制，可在 Viewer 对应的 HTML 数据属性或 `pointcloud-viewer.js` 中调整。

## 6. 必须通过 HTTP 预览

不要用 `file://` 直接打开 `index.html`，浏览器可能阻止模块和 PLY 请求。在原仓库根目录运行：

```bash
cd /Users/cyrus/Desktop/AquaVGGT_AAAI
python3 -m http.server 8000
```

访问：

```text
http://localhost:8000/project-page/
```

打开浏览器开发者工具的 Network 面板，可以确认 `.ply` 请求是否为 `200`。常见问题是路径大小写不一致、部署时漏传模型文件，或模型过大导致首次加载缓慢。

## 7. 性能建议

- 主窗口建议约 20–50 万点；三个并排窗口可控制在每个 10–25 万点。
- 为桌面和移动端分别准备高、低密度版本会更稳妥。
- 对不可见窗口暂停渲染，避免多个 WebGL Canvas 持续占用 GPU。
- 限制设备像素比，模型替换后使用新文件名或清理浏览器缓存。
- PLY 与网页跨域部署时，模型服务器必须允许 CORS。

具体上限取决于文件大小、窗口数量、设备内存与 GPU，应以目标手机和普通笔记本实测为准。

## 8. 普通点云不等于完整 3DGS

| 当前 XYZRGB Viewer | 完整 3D Gaussian Splat Viewer |
|---|---|
| 每个中心渲染为一个彩色点 | 每个 Gaussian 按尺度、旋转和透明度 splat |
| 使用 `x/y/z/red/green/blue` | 使用 `opacity`、`scale_*`、`rot_*` 和 SH 等属性 |
| Three.js `PLYLoader + PointsMaterial` | 专用 Gaussian renderer |
| 接入简单，适合论文项目页快速预览 | 外观更接近离线 3DGS 渲染，但资源和接入成本更高 |

把完整 3DGS PLY 直接放进当前目录，最多只能显示其中心点；尺度、旋转、透明度和高阶球谐不会被正确渲染。

## 9. 第二阶段：PlayCanvas / SPZ

完整 3DGS 展示保留为第二阶段，计划流程为：

```text
原始 3DGS PLY -> @playcanvas/splat-transform -> SPZ -> PlayCanvas/SuperSplat Viewer
```

届时可增加独立的 Gaussian Render 标签页，保留当前 XYZRGB 点云作为轻量预览或移动端回退。第二阶段再引入 `models.config.json`、转换脚本、manifest、懒加载与缓存哈希；这些步骤不是当前 PLY Viewer 的运行前提。

参考：

- [Three.js PLYLoader](https://threejs.org/docs/pages/PLYLoader.html)
- [PlayCanvas SplatTransform](https://github.com/playcanvas/splat-transform)
- [SuperSplat Viewer](https://developer.playcanvas.com/user-manual/supersplat/viewer/)
- [Niantic SPZ](https://github.com/nianticlabs/spz)
