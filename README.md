# FathomSplat 项目页

这是一个可直接本地预览和部署的静态学术项目页。网页内容以当前提交稿为准，布局参考 VolSplat 一类项目页，但页面代码与展示资产均为本地重新实现。

页面已预留 6 个可交互的 Three.js 点云窗口。鼠标可以旋转、缩放和平移视角，并可切换浅色/深色背景；对比组内的相机视角会联动。Three.js 0.160.1、PLYLoader 与 OrbitControls 已放在 `static/vendor/three/`，页面运行时不依赖第三方 CDN。接入真实数据的方法见 [`PLY_VIEWER_GUIDE.md`](PLY_VIEWER_GUIDE.md)。

> **重要：** 顶部双模型画廊的数据源已经固定：FathomSplat 只读取 `asset/Fathomsplat/ply`，AnySplat 只读取 `asset/anysplat/ply`（与 `3d_result/normal/ply` 一致）。画廊不读取 `3d_result/page`。

## 双模型 PLY 画廊

网页首先显示 FathomSplat 的 8 个场景，并可切换到 AnySplat 的 8 个场景。两组数据共用一个 Viewer 和一行可横向拖动的封面，避免为每个 PLY 建立独立页面。轻量网页副本和清单由以下命令重新生成：

```bash
python3 scripts/prepare_method_galleries.py --target-points 250000
```

生成文件位于 `static/models/gallery/`、`static/images/gallery/` 和 `static/data/pointcloud-gallery.json`。原始 PLY 不会被修改。

## 本地预览

请通过 HTTP 打开页面，不能直接双击 `index.html`：

```bash
cd /Users/cyrus/Desktop/AquaVGGT_AAAI
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000/project-page/
```

若只复制了 `project-page/` 目录，也可以在该目录运行同一命令，然后访问 `http://localhost:8000/`。

## 当前 3D 资产

第一阶段 Viewer 使用 Three.js 加载标准 `XYZRGB` PLY，并将每个顶点显示为一个彩色点：

| 文件 | 页面用途 | 未来建议替换为 |
|---|---|---|
| `cave_aaai_web.ply` | 主页大型交互展示 | 已由 `asset/cave_aaai.ply` 转换，517,832 点 |
| `direct_fit_placeholder.ply` | Direct underwater fit | 无 Water-Head / 直接拟合输出 |
| `medium_free_placeholder.ply` | FathomSplat medium-free | 与上一窗口同输入、同坐标系的完整模型输出 |
| `budget_003_placeholder.ply` | 3 context views | 同一场景使用 3 个输入视角的输出 |
| `budget_016_placeholder.ply` | 16 context views | 同一场景使用 16 个输入视角的输出 |
| `budget_064_placeholder.ply` | 64 context views | 同一场景使用 64 个输入视角的输出 |

文件位置：

```text
project-page/static/models/pointclouds/
```

以后可导出真实 `XYZRGB` 点云并覆盖同名文件；如需保留自己的命名，则修改 `index.html` 中对应 Viewer 的 `data-ply` 路径。成组比较应保持相同坐标系、裁剪范围、尺度和颜色约定。

完整 3DGS PLY 可用仓库内脚本转换成网页预览。它会提取 Gaussian 中心并把 `f_dc_0/1/2` 解码为 RGB，同时丢弃网页点预览不使用的法线、尺度、旋转和 opacity 字段：

```bash
python3 scripts/prepare_web_ply.py \
  asset/cave_aaai.ply \
  static/models/pointclouds/cave_aaai_web.ply
```

若原始文件很大，可追加 `--target-points 800000` 做确定性的均匀抽样。

## 普通点云与完整 3DGS

当前 Viewer 展示的是彩色点云，只读取 `x/y/z/red/green/blue`。它适合快速、稳定地复现自由拖拽的 3D 展示，但不会渲染 Gaussian 的尺度、旋转、透明度或球谐外观。

完整 3D Gaussian Splat PLY 通常还包含 `scale_*`、`rot_*`、`opacity`、`f_dc_*` 和 `f_rest_*`。这类数据计划在第二阶段通过 PlayCanvas/SuperSplat 路线转换为 SPZ 后展示；不要直接把原始 3DGS PLY 交给当前 Viewer 并期待得到完整 splatting 效果。

## 最先需要替换的内容

1. `index.html` 中的作者、单位、Paper、Code、Models 和 Demo 链接。
2. `static/images/teaser.jpg` 与后续 pipeline、结果图片。
3. `static/videos/` 中的项目视频、对比视频和真实 BlueROV 演示。
4. 其余 5 个对比示意 PLY；替换后同时移除页面中的 placeholder 提示。
5. 最终实验完成后，替换 Results 中的占位卡片与指标说明。
6. 投稿信息确定后，更新标题区和 BibTeX。

## 推荐媒体规格

- Teaser：`1600 × 900` JPG/WebP。
- Pipeline：宽度至少 `1800 px`，优先 SVG/WebP。
- 对比视频：统一分辨率、时长和帧率，MP4/H.264；单个文件建议控制在 `8–15 MB`。
- 点云：网页预览版建议体素降采样并过滤低置信度点；多个并排窗口应使用同一采样规则。

## 部署

该目录不依赖构建工具，可直接部署到 GitHub Pages、学校服务器、Netlify 或 Vercel。部署前确认 PLY 路径的大小写完全一致，并将最终 PDF 放到 `static/docs/paper.pdf`。
