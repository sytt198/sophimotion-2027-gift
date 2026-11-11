# 2027 礼盒动画

14 秒、1920 × 1080、30 fps、静音。展示闭盒、左盖先开、右盖后开、四件产品依次展示、归位。无任何拉带。

共享模型来自上一级网站的 `dist/gift-scene.js`。更新网页模型后，在项目根运行 `node scripts/sync-video-assets.mjs`，再在本文件夹运行：

```powershell
# 可选：将 HYPERFRAMES_BROWSER_PATH 设置为本机 Chrome 可执行文件路径
npx --yes hyperframes@0.9.33 check --json
npx --yes hyperframes@0.9.33 preview --background --port 5198
npx --yes hyperframes@0.9.33 render --fps 30 --quality high --crf 22 --workers 2 --output ../dist/assets/2027-gift-box.mp4
```

预览地址为 `http://localhost:5198/#project/animation`，提供可编辑时间轴。`compositions/gift.html` 控制字幕与场景时间；3D 模型及开合过程由共享场景控制。所有图形均根据时间直接求值，可任意前后跳转。

依赖 Chromium 和 FFmpeg。HyperFrames CLI 版本固定为 0.9.33；网页不依赖这些开发工具。
