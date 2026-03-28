# 🛡️ Privacy Invoice Agent

**100% 本地运行的发票 OCR 智能 Agent** —— 图片不上传服务器，隐私零泄露。

![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite)
![PaddleJS](https://img.shields.io/badge/PaddleJS-OCR-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ 特性

- 🔒 **隐私优先** —— 发票图片完全本地处理，不上传任何服务器
- 🧠 **Edge AI** —— 基于 PaddleJS，在浏览器端运行深度学习模型
- 🚀 **WebGL 加速** —— 利用 GPU 进行推理，速度更快
- 📦 **模型本地化** —— OCR 模型打包在项目中，无需联网加载
- 🧹 **智能解析** —— 高容错正则引擎，自动提取发票关键字段

---

## 📸 支持提取的字段

| 字段 | 说明 |
|------|------|
| 发票号码 | 自动识别 8-20 位号码 |
| 开票日期 | 格式：YYYY年MM月DD日 |
| 购买方 | 购买方名称 |
| 销售方 | 销售方名称 |
| 销售方税号 | 15-20 位税号 |
| 价税合计 | 金额数字 |
| 税务局 | 全国 36 个税务局白名单匹配 |

---

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

打开浏览器访问 `http://localhost:5173`，上传发票图片即可识别。

### 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录下。

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  图片上传   │ -> │  图片压缩   │ -> │  PaddleJS   │  │
│  │  <input>    │    │  (阶梯式)   │    │  OCR 识别   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                │         │
│                                                v         │
│                                      ┌─────────────┐     │
│                                      │  正则解析   │     │
│                                      │  结构化提取 │     │
│                                      └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 项目结构

```
privacy-invoice-agent/
├── index.html              # 入口页面
├── src/
│   └── main.js             # 核心逻辑
├── public/
│   └── models/             # OCR 模型文件
│       ├── det/            # 文字检测模型
│       └── rec/            # 文字识别模型
├── download.mjs            # 模型下载脚本
├── package.json
└── README.md
```

---

## 🔧 核心模块

### 1. 网络拦截器

拦截 PaddleJS 默认的 CDN 请求，重定向到本地模型文件：

```javascript
window.fetch = async function(...args) {
    // 将 paddlejs.cdn.bcebos.com 重定向到 /models/
    // 确保模型完全本地加载
};
```

### 2. 阶梯式无损压缩

对大图片进行逐步 50% 缩放，避免直接缩放导致的质量损失：

```javascript
while (curW * 0.5 > targetW) {
    // 每次缩小 50%，保留更多细节
    offCtx.drawImage(offCanvas, 0, 0, curW * 2, curH * 2, 0, 0, curW, curH);
}
```

### 3. 高容错解析引擎

OCR 识别出的文本可能包含乱码，使用白名单字典匹配：

```javascript
// 全国 36 个税务局白名单
const validBureaus = "北京市|天津市|上海市|...|深圳市";

// 容忍 0-4 个乱码字符，匹配白名单地名
const bureauRegex = new RegExp(`(国家税务总局)?.{0,4}?(${validBureaus})税务`);
```

---

## 📦 依赖

| 包名 | 用途 |
|------|------|
| `vite` | 构建工具 |
| `@paddlejs-models/ocr` | OCR 模型 |
| `@paddlejs/paddlejs-backend-webgl` | WebGL 推理后端 |
| `@paddlejs/paddlejs-core` | PaddleJS 核心 |

---

## 📝 开发计划

- [ ] 批量图片处理
- [ ] 导出 Excel / CSV
- [ ] 支持更多发票类型（增值税专用发票、电子发票等）
- [ ] PWA 离线支持
- [ ] 拖拽上传

---

## 📄 License

[MIT](LICENSE)

---

## 🙏 致谢

- [PaddleJS](https://github.com/PaddlePaddle/PaddleJS) - 百度飞桨前端推理框架
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) - 中文 OCR 模型
