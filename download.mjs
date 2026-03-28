import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 百度 Paddle.js 官方提供的轻量级 OCR 模型地址
const models = {
  det: 'https://paddlejs.cdn.bcebos.com/models/fuse/ocr/ch_PP-OCRv2_det_fuse_activation',
  rec: 'https://paddlejs.cdn.bcebos.com/models/fuse/ocr/ch_PP-OCRv2_rec_fuse_activation'
};

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败 ${url}: ${res.statusText}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buffer));
  console.log(`  └─ 成功: ${path.basename(dest)}`);
}

async function start() {
  for (const [name, baseUrl] of Object.entries(models)) {
    const dir = path.join(__dirname, `public/models/${name}`);
    // 自动创建存放模型的 public/models 目录
    fs.mkdirSync(dir, { recursive: true });
    console.log(`\n📦 开始拉取 ${name} 模型...`);

    // 1. 下载核心的配置 json
    const jsonUrl = `${baseUrl}/model.json`;
    const jsonDest = path.join(dir, 'model.json');
    await downloadFile(jsonUrl, jsonDest);

    // 2. 解析 JSON，提取所有二进制分片文件的名字
    const text = fs.readFileSync(jsonDest, 'utf8');
    const chunks = [...new Set(Array.from(text.matchAll(/"([^"]+\.(?:dat|bin))"/g)).map(m => m[1]))];

    // 3. 批量下载所有分片
    for (const chunk of chunks) {
      await downloadFile(`${baseUrl}/${chunk}`, path.join(dir, chunk));
    }
  }
  console.log('\n🎉 所有模型离线文件已就绪！');
}

start();