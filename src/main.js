import * as ocr from '@paddlejs-models/ocr';
import '@paddlejs/paddlejs-backend-webgl';


// ==========================================
// 🛡️ 网络拦截器 (保持不变)
// ==========================================
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    let url = args[0];
    if (typeof url === 'string' && url.includes('paddlejs.cdn.bcebos.com')) {
        if (url.includes('ch_PP-OCRv2_det_fuse_activation')) {
            url = url.replace('https://paddlejs.cdn.bcebos.com/models/fuse/ocr/ch_PP-OCRv2_det_fuse_activation', '/models/det');
        } else if (url.includes('ch_PP-OCRv2_rec_fuse_activation')) {
            url = url.replace('https://paddlejs.cdn.bcebos.com/models/fuse/ocr/ch_PP-OCRv2_rec_fuse_activation', '/models/rec');
        }
        args[0] = url;
    }
    return originalFetch.apply(this, args);
};

// ==========================================
// 🖼️ 图像预处理 (保持不变)
// ==========================================
function resizeForModel(imageEl, maxSide = 2048) {
    let width = imageEl.naturalWidth || imageEl.width;
    let height = imageEl.naturalHeight || imageEl.height;
    if (Math.max(width, height) <= maxSide) {
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height);
        ctx.drawImage(imageEl, 0, 0, width, height);
        return canvas;
    }
    let ratio = maxSide / Math.max(width, height);
    let targetW = Math.round(width * ratio);
    let targetH = Math.round(height * ratio);
    let offCanvas = document.createElement('canvas');
    let offCtx = offCanvas.getContext('2d');
    offCanvas.width = width; offCanvas.height = height;
    offCtx.fillStyle = "#ffffff"; offCtx.fillRect(0, 0, width, height);
    offCtx.drawImage(imageEl, 0, 0, width, height);
    let curW = width, curH = height;
    while (curW * 0.5 > targetW) {
        curW = Math.floor(curW * 0.5); curH = Math.floor(curH * 0.5);
        offCtx.drawImage(offCanvas, 0, 0, curW * 2, curH * 2, 0, 0, curW, curH);
    }
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = targetW; finalCanvas.height = targetH;
    const finalCtx = finalCanvas.getContext('2d');
    finalCtx.imageSmoothingEnabled = true; finalCtx.imageSmoothingQuality = 'high';
    finalCtx.drawImage(offCanvas, 0, 0, curW, curH, 0, 0, targetW, targetH);
    return finalCanvas; 
}

// ==========================================
// 🧠 Agent 大脑：正则解析引擎 (保持不变)
// ==========================================
function parseInvoice(textLines) {
    const fullText = textLines.join('\n').replace(/：/g, ':'); 
    const noSpaceText = fullText.replace(/\s+/g, ''); 
    const result = { 发票号码: '', 开票日期: '', 购买方: '', 销售方: '', 销售方税号: '', 价税合计: '', 税务局: '' };

    const validBureaus = "北京市|天津市|上海市|重庆市|河北省|山西省|辽宁省|吉林省|黑龙江省|江苏省|浙江省|安徽省|福建省|江西省|山东省|河南省|湖北省|湖南省|广东省|海南省|四川省|贵州省|云南省|陕西省|甘肃省|青海省|内蒙古自治区|广西壮族自治区|西藏自治区|宁夏回族自治区|新疆维吾尔自治区|大连市|青岛市|宁波市|厦门市|深圳市";
    const bureauRegex = new RegExp(`(国家税务总局)?.{0,4}?(${validBureaus})税务`);
    const bureauMatch = noSpaceText.match(bureauRegex);
    if (bureauMatch) result.税务局 = `国家税务总局${bureauMatch[2]}税务局`;

    const numMatch = noSpaceText.match(/(?:号码|NO).*?(\d{8,20})/i);
    if (numMatch) result.发票号码 = numMatch[1];
    else {
        const fallback = noSpaceText.match(/(?:01|04|08|26|23)\d{18}/); 
        if (fallback) result.发票号码 = fallback[0];
    }

    const dateMatch = fullText.match(/20\d{2}年\d{1,2}月\d{1,2}日/);
    if (dateMatch) result.开票日期 = dateMatch[0];

    const nameRegex = /称[:;]*\s*([\u4e00-\u9fa5]+(?:（个人）|\(个人\)|[a-zA-Z0-9]+)?(?:有限公司|旅行社|公司|厂|部|集团)?)/g;
    let names = []; let nameMatch;
    while ((nameMatch = nameRegex.exec(fullText)) !== null) {
        let cleanName = nameMatch[1].trim();
        if (cleanName.length > 1 && !/明细|系统|清单|发票/.test(cleanName)) names.push(cleanName);
    }
    names = [...new Set(names)];
    if (names.length > 0) {
        result.购买方 = names[0]; 
        if (names.length > 1) result.销售方 = names[names.length - 1]; 
    }

    const taxRegex = /(?:代码|识别号|税号|号)[:;]*\s*([A-Z0-9]{15,20})/g;
    let taxes = []; let taxMatch;
    while ((taxMatch = taxRegex.exec(fullText)) !== null) taxes.push(taxMatch[1]);
    if (taxes.length > 0) result.销售方税号 = taxes[taxes.length - 1];
    else {
        const fallbackTax = noSpaceText.match(/9[A-Z0-9]{17}/g);
        if (fallbackTax) result.销售方税号 = fallbackTax[fallbackTax.length - 1];
    }

    const moneyMatch = fullText.match(/[¥￥Y]?\s*(\d{1,8}\.\d{2})/g);
    if (moneyMatch) {
        const amounts = moneyMatch.map(v => parseFloat(v.replace(/[^\d.]/g, ''))).sort((a, b) => b - a);
        result.价税合计 = amounts[0].toFixed(2);
    }
    return result;
}

// ==========================================
// 🚀 核心控制台逻辑：批量处理与 UI 渲染
// ==========================================
const statusBadge = document.getElementById('status-badge');
const uploadInput = document.getElementById('upload');
const uploadLabel = document.getElementById('upload-label');
const previewEl = document.getElementById('preview');
const placeholderEl = document.getElementById('preview-placeholder');
const fieldsContainer = document.getElementById('fields-container');
const exportBtn = document.getElementById('export-btn');
const progressBox = document.getElementById('progress-box');
const progressText = document.getElementById('progress-text');
const progressFill = document.getElementById('progress-fill');
const fileListEl = document.getElementById('file-list');

// 全局状态库：存储所有处理完毕的发票数据
let globalProcessedData = []; 

async function initEngine() {
    try {
        await ocr.init();
        statusBadge.innerText = '✅ 引擎就绪 (纯本地)';
        statusBadge.style.backgroundColor = '#10b981';
        uploadInput.disabled = false;
        uploadLabel.style.opacity = '1';
        uploadLabel.style.cursor = 'pointer';
    } catch (error) {
        statusBadge.innerText = `❌ 初始化失败`;
        statusBadge.style.backgroundColor = '#ef4444';
        console.error(error);
    }
}

// 动态渲染右侧的独立输入框
function renderFields(dataObj, fileName) {
    fieldsContainer.innerHTML = ''; // 清空旧数据
    
    // 加一个当前文件名的提示
    const fileLabel = document.createElement('div');
    fileLabel.style.gridColumn = '1 / -1'; // 占满整行
    fileLabel.style.fontSize = '12px';
    fileLabel.style.color = '#3b82f6';
    fileLabel.innerText = `📄 当前显示: ${fileName}`;
    fieldsContainer.appendChild(fileLabel);

    for (const [key, value] of Object.entries(dataObj)) {
        const card = document.createElement('div');
        card.className = 'field-card';
        card.innerHTML = `
            <div class="field-label">${key}</div>
            <input type="text" class="field-value" data-key="${key}" value="${value || ''}" placeholder="未识别到...">
        `;
        fieldsContainer.appendChild(card);
    }
}

// 辅助函数：把图片转成模型可读的格式
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        img.onload = () => {
            previewEl.src = url;
            previewEl.style.display = 'block';
            placeholderEl.style.display = 'none';
            resolve(img);
        };
        img.onerror = reject;
    });
}

// 监听文件批量上传
uploadInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // 初始化 UI 状态
    globalProcessedData = [];
    exportBtn.disabled = true;
    exportBtn.style.opacity = '0.5';
    progressBox.style.display = 'block';
    fileListEl.innerText = `排队中：共 ${files.length} 个文件...`;

    // 开始队列处理
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        progressText.innerText = `正在处理 (${i+1}/${files.length}): ${file.name}`;
        progressFill.style.width = `${((i) / files.length) * 100}%`;
        
        try {
            // 1. 加载并显示图片
            const imgEl = await loadImage(file);
            
            // 2. 预处理压缩
            const processCanvas = resizeForModel(imgEl, 2048);
            const tempImg = new Image();
            tempImg.src = processCanvas.toDataURL('image/jpeg', 0.9);
            
            await new Promise(r => tempImg.onload = r); // 等待图片转换完成

            // 3. 喂给大模型
            const res = await ocr.recognize(tempImg);
            
            // 4. 清洗与组装数据
            let parsedData = {};
            if (res && res.text && res.text.length > 0) {
                parsedData = parseInvoice(res.text);
            }
            
            // 把文件名加进去，方便导出 Excel 时核对
            parsedData['原文件名'] = file.name; 
            
            // 存入全局库
            globalProcessedData.push(parsedData);

            // 实时渲染当前这一张的结果到右侧面板
            renderFields(parsedData, file.name);

        } catch (error) {
            console.error(`文件 ${file.name} 处理失败:`, error);
        }
    }

    // 全部处理完成！
    progressFill.style.width = `100%`;
    progressText.innerText = `✅ 全部处理完毕！共处理 ${files.length} 张发票。`;
    progressText.style.color = '#10b981';
    
    // 激活导出按钮
    exportBtn.disabled = false;
    exportBtn.style.opacity = '1';
});

// ==========================================
// 📥 零依赖原生 CSV 导出引擎
// ==========================================
exportBtn.addEventListener('click', () => {
    if (globalProcessedData.length === 0) return;

    // 1. 同步用户可能在页面上手动修改过的数据
    const currentInputs = fieldsContainer.querySelectorAll('.field-value');
    if(currentInputs.length > 0 && globalProcessedData.length > 0) {
        const lastData = globalProcessedData[globalProcessedData.length - 1];
        currentInputs.forEach(input => {
            const key = input.getAttribute('data-key');
            lastData[key] = input.value;
        });
    }

    // 2. 定义表头排布顺序
    const headers = ['原文件名', '发票号码', '税务局', '开票日期', '购买方', '销售方', '销售方税号', '价税合计'];
    
    // 3. 拼装 CSV 文本
    let csvContent = headers.join(',') + '\n'; // 写入表头

    globalProcessedData.forEach(data => {
        const row = headers.map(header => {
            let cell = data[header] || '';
            // CSV 规范：把内容里的双引号转义，并用双引号包裹每个单元格，防止内容里自带逗号导致错位
            cell = cell.toString().replace(/"/g, '""'); 
            return `"${cell}"`; 
        });
        csvContent += row.join(',') + '\n'; // 写入数据行
    });

    // 4. 浏览器原生文件生成与下载
    // 💡 核心黑科技：在文本最前面加上 \uFEFF (BOM头)，这样 Excel 打开中文绝对不会乱码！
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', '智能发票提取结果.csv'); // 存为 csv 格式
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click(); // 模拟点击下载
    document.body.removeChild(link);
});

// 启动引擎
initEngine();