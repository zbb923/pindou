
        // 色号数据将通过 fetch 动态加载
        let colorBeans = [];

        // 动态加载色号数据
        async function loadColorBeans() {
            try {
                const response = await fetch('color-beans.json');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                colorBeans = await response.json();
                console.log(`✅ 成功加载 ${colorBeans.length} 个色号`);
                
                // 数据加载完成后，初始化页面
                initializePage();
            } catch (error) {
                console.error('❌ 加载色号数据失败:', error);
                // 如果加载失败，使用空数组
                colorBeans = [];
                initializePage();
            }
        }

        // 页面初始化函数（在色号数据加载完成后执行）
        function initializePage() {
            // 在这里可以执行需要色号数据的初始化操作
            console.log('页面初始化完成，色号数量:', colorBeans.length);
            
            // 更新标题中的色号数量
            const cardTitle = document.querySelector('.card-title');
            if (cardTitle) {
                cardTitle.innerHTML = `🎨 ${colorBeans.length}个拼豆色号预览`;
            }
            
            // 如果页面有其他需要初始化的功能，在这里调用
            renderColorPalette();
        }

        // 渲染色卡面板
        function renderColorPalette() {
            const colorPaletteGrid = document.getElementById('colorPaletteGrid');
            if (colorPaletteGrid && colorBeans.length > 0) {
                colorPaletteGrid.innerHTML = colorBeans.map(bean => `
                    <div class="color-swatch" style="background-color: ${bean.hex}" title="${bean.id} - ${bean.name}">
                        <span class="color-id">${bean.id}</span>
                    </div>
                `).join('');
            }
        }

        // 页面加载完成后开始加载色号数据
        window.addEventListener('DOMContentLoaded', loadColorBeans);

        // 调用通义万相API进行卡通化
        async function transformToChibi(imageBase64, prompt) {
            try {
                console.log('=== 开始卡通化处理 ===');
                console.log('使用通义万相API...');
                console.log('使用提示词:', prompt);
                
                // 提取base64数据（去掉 data:image/xxx;base64, 前缀）
                let cleanBase64 = imageBase64;
                if (imageBase64.includes(',')) {
                    cleanBase64 = imageBase64.split(',')[1];
                }
                
                const payload = JSON.stringify({
                    Image: cleanBase64,
                    Prompt: prompt
                });
                
                const response = await fetch('http://localhost:8080/cartoonize', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: payload
                });

                console.log('响应状态:', response.status, response.statusText);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('HTTP错误响应:', errorText);
                    try {
                        const errorJson = JSON.parse(errorText);
                        if (errorJson.error) {
                            throw new Error(errorJson.error);
                        }
                    } catch(e) {}
                    throw new Error(`服务器错误: ${response.status} - 请确保Python服务器正在运行且已配置API Key`);
                }

                const data = await response.json();
                console.log('服务器响应:', data.success ? '成功' : '失败');
                
                if (!data.success) {
                    throw new Error(data.error || '转换失败');
                }

                if (data.ResultImage) {
                    console.log('成功获取处理结果！');
                    return data.ResultImage;
                }

                throw new Error('响应格式错误');
            } catch (error) {
                console.error('卡通化处理失败:', error);
                console.log('使用纯前端卡通化作为备用方案...');
                
                // 备用方案：纯前端卡通化
                return await applyCartoonFilter(imageBase64);
            }
        }
        
        // 纯前端卡通化滤镜（备用方案）
        async function applyCartoonFilter(imageDataUrl) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // 调整画布大小
                    const maxSize = 800;
                    let w = img.width;
                    let h = img.height;
                    if (w > maxSize || h > maxSize) {
                        const ratio = Math.min(maxSize / w, maxSize / h);
                        w = Math.floor(w * ratio);
                        h = Math.floor(h * ratio);
                    }
                    canvas.width = w;
                    canvas.height = h;
                    
                    // 绘制图片
                    ctx.drawImage(img, 0, 0, w, h);
                    
                    // 获取图像数据
                    const imageData = ctx.getImageData(0, 0, w, h);
                    const data = imageData.data;
                    
                    // 1. 颜色量化（减少颜色数量）
                    const colorLevels = 8;
                    const quantize = (v) => Math.round(v / (256 / colorLevels)) * (256 / colorLevels);
                    
                    for (let i = 0; i < data.length; i += 4) {
                        data[i] = quantize(data[i]);
                        data[i + 1] = quantize(data[i + 1]);
                        data[i + 2] = quantize(data[i + 2]);
                    }
                    
                    // 2. 边缘检测与增强
                    const edgeCanvas = document.createElement('canvas');
                    edgeCanvas.width = w;
                    edgeCanvas.height = h;
                    const edgeCtx = edgeCanvas.getContext('2d');
                    edgeCtx.putImageData(imageData, 0, 0);
                    
                    // 创建边缘图层
                    const edgeData = edgeCtx.getImageData(0, 0, w, h);
                    const edgePixels = edgeData.data;
                    
                    // Sobel算子进行边缘检测
                    const sobel = (x, y, channel) => {
                        const idx = (y * w + x) * 4 + channel;
                        if (x <= 0 || x >= w - 1 || y <= 0 || y >= h - 1) {
                            return data[idx];
                        }
                        
                        const kernelX = [
                            [-1, 0, 1],
                            [-2, 0, 2],
                            [-1, 0, 1]
                        ];
                        const kernelY = [
                            [-1, -2, -1],
                            [0, 0, 0],
                            [1, 2, 1]
                        ];
                        
                        let gx = 0, gy = 0;
                        for (let ky = -1; ky <= 1; ky++) {
                            for (let kx = -1; kx <= 1; kx++) {
                                const pos = ((y + ky) * w + (x + kx)) * 4 + channel;
                                const val = data[pos];
                                gx += val * kernelX[ky + 1][kx + 1];
                                gy += val * kernelY[ky + 1][kx + 1];
                            }
                        }
                        
                        return Math.sqrt(gx * gx + gy * gy);
                    };
                    
                    // 3. 增加饱和度
                    const saturate = (r, g, b, amount = 1.3) => {
                        const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
                        return [
                            Math.min(255, Math.max(0, gray + amount * (r - gray))),
                            Math.min(255, Math.max(0, gray + amount * (g - gray))),
                            Math.min(255, Math.max(0, gray + amount * (b - gray)))
                        ];
                    };
                    
                    // 4. 应用效果
                    for (let y = 0; y < h; y++) {
                        for (let x = 0; x < w; x++) {
                            const idx = (y * w + x) * 4;
                            
                            let r = data[idx];
                            let g = data[idx + 1];
                            let b = data[idx + 2];
                            
                            // 边缘检测
                            const edgeR = sobel(x, y, 0);
                            const edgeG = sobel(x, y, 1);
                            const edgeB = sobel(x, y, 2);
                            const edgeStrength = (edgeR + edgeG + edgeB) / 3;
                            
                            // 如果是边缘，用深色描边
                            if (edgeStrength > 30) {
                                const darken = 0.4;
                                r = r * darken;
                                g = g * darken;
                                b = b * darken;
                            } else {
                                // 非边缘区域，增加饱和度
                                [r, g, b] = saturate(r, g, b);
                            }
                            
                            data[idx] = r;
                            data[idx + 1] = g;
                            data[idx + 2] = b;
                        }
                    }
                    
                    ctx.putImageData(imageData, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg', 0.95));
                };
                img.onerror = reject;
                img.src = imageDataUrl;
            });
        }

        // ==================== 腾讯云API结束 ====================

        // 颜色转换和匹配算法
        function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 0, g: 0, b: 0 };
        }

        function rgbToXyz(rgb) {
            let r = rgb.r / 255;
            let g = rgb.g / 255;
            let b = rgb.b / 255;

            r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
            g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
            b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

            r *= 100;
            g *= 100;
            b *= 100;

            const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
            const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
            const z = r * 0.0193 + g * 0.1192 + b * 0.9505;

            return { x, y, z };
        }

        function xyzToLab(xyz) {
            let x = xyz.x / 95.047;
            let y = xyz.y / 100.000;
            let z = xyz.z / 108.883;

            x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (16 / 116);
            y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (16 / 116);
            z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (16 / 116);

            return { l: (116 * y) - 16, a: 500 * (x - y), b: 200 * (y - z) };
        }

        function rgbToLab(rgb) {
            const xyz = rgbToXyz(rgb);
            return xyzToLab(xyz);
        }

        // CIE94 颜色距离计算 - 标准参数
        function cie94Distance(lab1, lab2) {
            const kL = 1, kC = 1, kH = 1, K1 = 0.045, K2 = 0.015;

            const deltaL = lab1.l - lab2.l;
            const C1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
            const C2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b);
            const deltaC = C1 - C2;
            const deltaA = lab1.a - lab2.a;
            const deltaB = lab1.b - lab2.b;
            const deltaH = Math.sqrt(Math.max(0, deltaA * deltaA + deltaB * deltaB - deltaC * deltaC));
            const sL = 1, sC = 1 + K1 * C1, sH = 1 + K2 * C1;
            const L = deltaL / (kL * sL), C = deltaC / (kC * sC), H = deltaH / (kH * sH);
            
            return Math.sqrt(L * L + C * C + H * H);
        }

        // 判断是否是肤色/粉色系 (高亮度，偏红/黄)
        function isSkinOrPinkTone(rgb) {
            const { r, g, b } = rgb;
            const avg = (r + g + b) / 255;
            const rRatio = r / (g + b + 1);
            
            return avg > 0.5 && avg < 0.95 && rRatio > 0.6;
        }
        
        // 简单RGB距离作为辅助
        function rgbDistance(rgb1, rgb2) {
            return Math.sqrt(
                Math.pow(rgb1.r - rgb2.r, 2) +
                Math.pow(rgb1.g - rgb2.g, 2) +
                Math.pow(rgb1.b - rgb2.b, 2)
            );
        }
        
        // 改进的CIE94 - 对肤色调整权重
        function improvedCie94Distance(lab1, lab2, isSkinTone) {
            let kL = 1, kC = 1, kH = 1, K1 = 0.045, K2 = 0.015;
            
            if (isSkinTone) {
                kC = 0.5; // 对肤色，色度更重要
                kH = 0.3; // 色调更重要
            }

            const deltaL = lab1.l - lab2.l;
            const C1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
            const C2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b);
            const deltaC = C1 - C2;
            const deltaA = lab1.a - lab2.a;
            const deltaB = lab1.b - lab2.b;
            const deltaH = Math.sqrt(Math.max(0, deltaA * deltaA + deltaB * deltaB - deltaC * deltaC));
            const sL = 1, sC = 1 + K1 * C1, sH = 1 + K2 * C1;
            const L = deltaL / (kL * sL), C = deltaC / (kC * sC), H = deltaH / (kH * sH);
            
            return Math.sqrt(L * L + C * C + H * H);
        }
        
        function findClosestColorBean(targetRgb, useCie94) {
            // 统一走通用匹配（含肤色保护）
            return findClosestColorBeanUniversal(targetRgb, useCie94, true);
        }

        // Lab → XYZ → sRGB（逆函数）
        function labToRgb(L, a, b) {
            const fy = (L + 16) / 116;
            const fx = a / 500 + fy;
            const fz = fy - b / 200;

            const epsilon = 0.008856;
            const kappa = 903.3;

            let xr, yr, zr;
            if (L > kappa * epsilon) {
                yr = Math.pow((L + 16) / 116, 3);
            } else {
                yr = L / kappa;
            }
            const fx3 = Math.pow(fx, 3);
            xr = fx3 > epsilon ? fx3 : (116 * fx - 16) / kappa;
            const fz3 = Math.pow(fz, 3);
            zr = fz3 > epsilon ? fz3 : (116 * fz - 16) / kappa;

            // D65 白点
            const X = xr * 0.95047;
            const Y = yr * 1.00000;
            const Z = zr * 1.08883;

            // XYZ → RGB
            let R = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314;
            let G = X * -0.9692660 + Y * 1.8760108 + Z * 0.0415560;
            let B = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252;

            // sRGB 伽马
            const c = (v) => {
                const abs = Math.abs(v);
                if (abs <= 0.0031308) {
                    return 12.92 * v;
                } else {
                    return 1.055 * Math.sign(v) * Math.pow(abs, 1 / 2.4) - 0.055;
                }
            };
            R = c(R);
            G = c(G);
            B = c(B);

            return {
                r: Math.round(Math.max(0, Math.min(1, R)) * 255),
                g: Math.round(Math.max(0, Math.min(1, G)) * 255),
                b: Math.round(Math.max(0, Math.min(1, B)) * 255)
            };
        }

        // 增强版色号匹配（兼容旧调用签名，逻辑统一走通用匹配）
        function findClosestColorBeanEnhanced(targetRgb, useCie94, usePartition) {
            // 通用匹配：主流程（不做肤色特殊处理，保持原行为一致）
            return findClosestColorBeanUniversal(targetRgb, useCie94, false);
        }

        // ===== 通用色号匹配：色相保真 + 中性优先 + 亮度兜底 =====
        // 解决"色卡覆盖不均导致颜色漂移"的通病（灰→绿灰、浅灰→蓝灰、红→紫、蓝→青等）：
        //   规则1 低饱和目标（真灰/近灰）→ 亮度为主 + 色度惩罚，避免灰→偏色灰（如偏绿M15）
        //   规则2 高饱和目标 → 色相角约束（先45°再放宽90°），禁止跨色相匹配（红绝不配绿/紫）
        //   规则3 兜底 → 全色卡 CIE94 + 色相角惩罚，宁可不饱和也不跨色相跑偏
        function findClosestColorBeanUniversal(targetRgb, useCie94, checkSkinTone) {
            // 肤色保护（白名单等场景）：肤色用简单RGB距离更准（保留原行为）
            if (checkSkinTone && isSkinOrPinkTone(targetRgb)) {
                let bestMatch = colorBeans[0];
                let minDistance = Infinity;
                for (const bean of colorBeans) {
                    const beanRgb = hexToRgb(bean.hex);
                    const d = rgbDistance(targetRgb, beanRgb);
                    if (d < minDistance) { minDistance = d; bestMatch = bean; }
                }
                return bestMatch;
            }

            const targetLab = rgbToLab(targetRgb);
            const C_t = Math.sqrt(targetLab.a * targetLab.a + targetLab.b * targetLab.b);

            // ---- 规则1：低饱和目标（真灰/近灰）→ 亮度为主 + 中性惩罚 ----
            if (C_t < 8) {
                const NEUTRAL_MAX_C = 14;  // 只允许低饱和色号竞争灰色（排除M1/M2/B25等淡绿灰）
                const L_WEIGHT = 2.0;      // 亮度权重（防止纯黑/纯白靠0色度通吃灰色区间）
                const C_PENALTY = 5.0;     // 色度惩罚（偏色灰号失分，避免灰→绿灰）
                let bestMatch = colorBeans[0];
                let bestScore = Infinity;
                for (const bean of colorBeans) {
                    const beanLab = rgbToLab(hexToRgb(bean.hex));
                    const C_b = Math.sqrt(beanLab.a * beanLab.a + beanLab.b * beanLab.b);
                    if (C_b > NEUTRAL_MAX_C) continue;
                    const score = L_WEIGHT * Math.abs(targetLab.l - beanLab.l) + C_PENALTY * C_b;
                    if (score < bestScore) { bestScore = score; bestMatch = bean; }
                }
                return bestMatch;
            }

            // ---- 规则2：高饱和目标 → 色相角约束 ----
            const hue_t = Math.atan2(targetLab.b, targetLab.a);
            let bestMatch = null;
            let bestScore = Infinity;
            const hueLimits = [45, 90];  // 先严格45°，无候选则放宽到90°
            for (const limit of hueLimits) {
                for (const bean of colorBeans) {
                    const beanLab = rgbToLab(hexToRgb(bean.hex));
                    const C_b = Math.sqrt(beanLab.a * beanLab.a + beanLab.b * beanLab.b);
                    if (C_b < 6) continue;  // 排除无彩色相意义的低饱和灰号
                    const hueDiffDeg = hueAngleDiffDeg(hue_t, Math.atan2(beanLab.b, beanLab.a));
                    if (hueDiffDeg > limit) continue;
                    const d = useCie94 ? cie94Distance(targetLab, beanLab) : labEuclideanDistance(targetLab, beanLab);
                    if (d < bestScore) { bestScore = d; bestMatch = bean; }
                }
                if (bestMatch) return bestMatch;
            }

            // ---- 规则3：兜底（色相惩罚，禁止跨色相大幅跑偏） ----
            let fallback = colorBeans[0];
            let fallbackScore = Infinity;
            for (const bean of colorBeans) {
                const beanLab = rgbToLab(hexToRgb(bean.hex));
                const C_b = Math.sqrt(beanLab.a * beanLab.a + beanLab.b * beanLab.b);
                const hueDiffDeg = hueAngleDiffDeg(hue_t, Math.atan2(beanLab.b, beanLab.a));
                const hueCost = (C_b < 6 ? 180 : hueDiffDeg) * 0.35;  // 灰号对彩色目标给大色相惩罚
                const d = useCie94 ? cie94Distance(targetLab, beanLab) : labEuclideanDistance(targetLab, beanLab);
                const score = d + hueCost;
                if (score < fallbackScore) { fallbackScore = score; fallback = bean; }
            }
            return fallback;
        }

        // 色相角差（度，0-180）
        function hueAngleDiffDeg(h1, h2) {
            let d = Math.abs(h1 - h2);
            if (d > Math.PI) d = 2 * Math.PI - d;
            return d * 180 / Math.PI;
        }

        // 绘制函数
        // 绘制辅助线（每 interval 格的粗线，覆盖在细格线上）
        function drawGuideLines(ctx, width, height, pixelSize, axisMargin, interval) {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.lineWidth = 2;
            for (let x = 0; x <= width; x++) {
                if (x % interval !== 0) continue;
                ctx.beginPath();
                ctx.moveTo(axisMargin + x * pixelSize, axisMargin);
                ctx.lineTo(axisMargin + x * pixelSize, axisMargin + height * pixelSize);
                ctx.stroke();
            }
            for (let y = 0; y <= height; y++) {
                if (y % interval !== 0) continue;
                ctx.beginPath();
                ctx.moveTo(axisMargin, axisMargin + y * pixelSize);
                ctx.lineTo(axisMargin + width * pixelSize, axisMargin + y * pixelSize);
                ctx.stroke();
            }
        }

        function drawPattern(canvas, pixels, width, height, pixelSize, showGrid, showLabels, showAxis, showGuideLines, guideInterval) {
            const ctx = canvas.getContext('2d');
            const axisMargin = showAxis ? Math.max(30, Math.min(60, pixelSize * 1.5)) : 0;
            canvas.width = width * pixelSize + axisMargin;
            canvas.height = height * pixelSize + axisMargin;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 绘制坐标标注（横轴和竖轴）
            if (showAxis) {
                ctx.fillStyle = '#333333';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const fontSize = Math.max(10, Math.min(16, pixelSize * 0.5));
                ctx.font = fontSize + 'px Arial';

                // 顶部：横轴（列号）
                for (let x = 0; x < width; x++) {
                    ctx.fillText(
                        String(x + 1),
                        axisMargin + x * pixelSize + pixelSize / 2,
                        axisMargin / 2
                    );
                }

                // 左侧：竖轴（行号）
                for (let y = 0; y < height; y++) {
                    ctx.fillText(
                        String(y + 1),
                        axisMargin / 2,
                        axisMargin + y * pixelSize + pixelSize / 2
                    );
                }

                // 绘制分隔线（区分坐标轴和像素区）
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(axisMargin, 0);
                ctx.lineTo(axisMargin, canvas.height);
                ctx.moveTo(0, axisMargin);
                ctx.lineTo(canvas.width, axisMargin);
                ctx.stroke();
            }

            // 绘制像素格子（整体偏移 axisMargin）
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixel = pixels[y][x];
                    ctx.fillStyle = pixel.matchedBean.hex;
                    ctx.fillRect(
                        axisMargin + x * pixelSize,
                        axisMargin + y * pixelSize,
                        pixelSize,
                        pixelSize
                    );
                }
            }
            if (showGrid) {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
                ctx.lineWidth = 1;
                for (let x = 0; x <= width; x++) {
                    ctx.beginPath();
                    ctx.moveTo(axisMargin + x * pixelSize, axisMargin);
                    ctx.lineTo(axisMargin + x * pixelSize, axisMargin + height * pixelSize);
                    ctx.stroke();
                }
                for (let y = 0; y <= height; y++) {
                    ctx.beginPath();
                    ctx.moveTo(axisMargin, axisMargin + y * pixelSize);
                    ctx.lineTo(axisMargin + width * pixelSize, axisMargin + y * pixelSize);
                    ctx.stroke();
                }
            }
            if (showGuideLines) {
                drawGuideLines(ctx, width, height, pixelSize, axisMargin, guideInterval);
            }
            if (showLabels && pixelSize >= 12) {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const pixel = pixels[y][x];
                        const hex = pixel.matchedBean.hex;
                        const rgb = hexToRgb(hex);
                        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                        ctx.fillStyle = brightness > 128 ? '#000000' : '#ffffff';
                        const fontSize = Math.max(8, Math.min(12, pixelSize * 0.45));
                        ctx.font = fontSize + 'px Arial';
                        ctx.fillText(
                            pixel.matchedBean.id,
                            axisMargin + x * pixelSize + pixelSize / 2,
                            axisMargin + y * pixelSize + pixelSize / 2
                        );
                    }
                }
            }
        }

        function drawColorPalette(canvas, colorStats) {
            const ctx = canvas.getContext('2d');
            const usedColors = [];
            for (const [id, count] of colorStats) {
                const bean = colorBeans.find(cb => cb.id === id);
                if (bean) usedColors.push({ bean, count });
            }
            usedColors.sort((a, b) => b.count - a.count);
            const cols = 10;
            const rows = Math.ceil(usedColors.length / cols);
            const cellSize = 60;
            const padding = 10;
            canvas.width = cols * cellSize + padding * 2;
            canvas.height = rows * cellSize + padding * 2;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            usedColors.forEach(({ bean, count }, index) => {
                const col = index % cols;
                const row = Math.floor(index / cols);
                const x = padding + col * cellSize;
                const y = padding + row * cellSize;
                ctx.fillStyle = bean.hex;
                ctx.fillRect(x + 5, y + 5, cellSize - 10, cellSize - 30);
                ctx.fillStyle = '#000000';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(bean.id, x + cellSize / 2, y + cellSize - 25);
                ctx.font = '10px Arial';
                ctx.fillText(count.toString(), x + cellSize / 2, y + cellSize - 12);
            });
        }

        // 普通版本 - 显示用
        function drawCombined(canvas, pixels, width, height, pixelSize, showGrid, showLabels, colorStats, showAxis, showGuideLines, guideInterval) {
            const ctx = canvas.getContext('2d');
            const tempCanvas1 = document.createElement('canvas');
            drawPattern(tempCanvas1, pixels, width, height, pixelSize, showGrid, showLabels, showAxis, showGuideLines, guideInterval);
            const tempCanvas2 = document.createElement('canvas');
            drawColorPalette(tempCanvas2, colorStats);
            const finalWidth = Math.max(tempCanvas1.width, tempCanvas2.width);
            const finalHeight = tempCanvas1.height + tempCanvas2.height + 20;
            canvas.width = finalWidth;
            canvas.height = finalHeight;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, finalWidth, finalHeight);
            ctx.drawImage(tempCanvas1, (finalWidth - tempCanvas1.width) / 2, 10);
            ctx.drawImage(tempCanvas2, (finalWidth - tempCanvas2.width) / 2, tempCanvas1.height + 20);
        }

        // 专门用于下载的版本 - 字号更小，添加信息
        function drawCombinedForDownload(canvas, pixels, width, height, pixelSize, showGrid, colorStats, showAxis, showGuideLines, guideInterval) {
            const ctx = canvas.getContext('2d');
            const tempCanvas1 = document.createElement('canvas');
            drawPatternForDownload(tempCanvas1, pixels, width, height, pixelSize, showGrid, showAxis, showGuideLines, guideInterval);
            const tempCanvas2 = document.createElement('canvas');
            drawColorPalette(tempCanvas2, colorStats);
            const finalWidth = Math.max(tempCanvas1.width, tempCanvas2.width);
            // 顶部留出空间写信息
            const infoHeight = 40;
            const finalHeight = tempCanvas1.height + tempCanvas2.height + infoHeight + 20;
            canvas.width = finalWidth;
            canvas.height = finalHeight;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, finalWidth, finalHeight);
            
            // 绘制顶部信息
            ctx.fillStyle = '#000000';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`格子总数: ${width} × ${height} = ${width * height} 个`, finalWidth / 2, 10);
            
            ctx.drawImage(tempCanvas1, (finalWidth - tempCanvas1.width) / 2, infoHeight);
            ctx.drawImage(tempCanvas2, (finalWidth - tempCanvas2.width) / 2, tempCanvas1.height + infoHeight + 10);
        }

        // 专门用于下载的图纸函数 - 字号小而清晰
        function drawPatternForDownload(canvas, pixels, width, height, pixelSize, showGrid, showAxis, showGuideLines, guideInterval) {
            const ctx = canvas.getContext('2d');
            const axisMargin = showAxis ? Math.max(30, Math.min(60, pixelSize * 1.5)) : 0;
            canvas.width = width * pixelSize + axisMargin;
            canvas.height = height * pixelSize + axisMargin;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (showAxis) {
                ctx.fillStyle = '#333333';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const fontSize = Math.max(10, Math.min(16, pixelSize * 0.5));
                ctx.font = fontSize + 'px Arial';
                for (let x = 0; x < width; x++) {
                    ctx.fillText(
                        String(x + 1),
                        axisMargin + x * pixelSize + pixelSize / 2,
                        axisMargin / 2
                    );
                }
                for (let y = 0; y < height; y++) {
                    ctx.fillText(
                        String(y + 1),
                        axisMargin / 2,
                        axisMargin + y * pixelSize + pixelSize / 2
                    );
                }
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(axisMargin, 0);
                ctx.lineTo(axisMargin, canvas.height);
                ctx.moveTo(0, axisMargin);
                ctx.lineTo(canvas.width, axisMargin);
                ctx.stroke();
            }

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixel = pixels[y][x];
                    ctx.fillStyle = pixel.matchedBean.hex;
                    ctx.fillRect(
                        axisMargin + x * pixelSize,
                        axisMargin + y * pixelSize,
                        pixelSize,
                        pixelSize
                    );
                }
            }
            if (showGrid) {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
                ctx.lineWidth = 1;
                for (let x = 0; x <= width; x++) {
                    ctx.beginPath();
                    ctx.moveTo(axisMargin + x * pixelSize, axisMargin);
                    ctx.lineTo(axisMargin + x * pixelSize, axisMargin + height * pixelSize);
                    ctx.stroke();
                }
                for (let y = 0; y <= height; y++) {
                    ctx.beginPath();
                    ctx.moveTo(axisMargin, axisMargin + y * pixelSize);
                    ctx.lineTo(axisMargin + width * pixelSize, axisMargin + y * pixelSize);
                    ctx.stroke();
                }
            }
            if (showGuideLines) {
                drawGuideLines(ctx, width, height, pixelSize, axisMargin, guideInterval);
            }
            // 下载版本 - 字号更小，避免拥挤
            if (pixelSize >= 12) {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const pixel = pixels[y][x];
                        const hex = pixel.matchedBean.hex;
                        const rgb = hexToRgb(hex);
                        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                        ctx.fillStyle = brightness > 128 ? '#000000' : '#ffffff';
                        const fontSize = Math.max(6, Math.min(pixelSize * 0.25, 10));
                        ctx.font = fontSize + 'px Arial';
                        ctx.fillText(
                            pixel.matchedBean.id,
                            axisMargin + x * pixelSize + pixelSize / 2,
                            axisMargin + y * pixelSize + pixelSize / 2
                        );
                    }
                }
            }
        }

        function downloadCanvas(canvas, filename) {
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }

        // 应用状态
        let state = {
            imageFile: null,
            imageDataUrl: null,
            targetWidth: 52,
            targetHeight: 52,
            useCie94: true,
            showGrid: true,
            showLabels: true,
            showAxis: true,
            showGuideLines: true,
            guideInterval: 5,
            pixelSize: 30,
            processResult: null,
            useChibi: false,
            chibiImageDataUrl: null,
            ditherStrength: 0.4,
            ditherMethod: 'none',
            useLabDither: true,
            usePartitionMatch: true,
            useEdgeAwareDither: true,
            samplingMethod: 'grid',
            samplingDensity: 3,
            isEditMode: false,
            currentTool: 'drag',
            currentColorBean: null,
            editPixels: null,
            // 新增：颜色提取白名单
            useColorExtraction: true,
            // 新增：采样决策方式 'average' = 路径A, 'vote' = 路径B, 'microcluster' = 路径C
            samplingDecisionMethod: 'microcluster',
            // 新增：聚类阈值（Lab空间ΔE），越小颜色区分越细
            colorClusterThreshold: 10,
            // 暗部合并阈值：L < 此值的聚类全部合并到最暗的那个
            darkMergeThreshold: 35,
            // 亮部保护阈值：L > 此值的聚类不参与暗部合并
            lightProtectThreshold: 85
        };

        // DOM 元素
        const uploadArea = document.getElementById('uploadArea');
        const imageInput = document.getElementById('imageInput');
        const previewContainer = document.getElementById('previewContainer');
        const previewCanvas = document.getElementById('previewCanvas');
        const fileName = document.getElementById('fileName');
        const changeBtn = document.getElementById('changeBtn');
        const errorMsg = document.getElementById('errorMsg');
        const widthSlider = document.getElementById('widthSlider');
        const heightSlider = document.getElementById('heightSlider');
        const widthValue = document.getElementById('widthValue');
        const heightValue = document.getElementById('heightValue');
        const widthDisplay = document.getElementById('widthDisplay');
        const heightDisplay = document.getElementById('heightDisplay');
        const cie94Toggle = document.getElementById('cie94Toggle');
        const gridToggle = document.getElementById('gridToggle');
        const guideToggle = document.getElementById('guideToggle');
        const labelsToggle = document.getElementById('labelsToggle');
        const axisToggle = document.getElementById('axisToggle');
        const pixelSizeSlider = document.getElementById('pixelSizeSlider');
        const pixelSizeValue = document.getElementById('pixelSizeValue');
        const pixelSizeDisplay = document.getElementById('pixelSizeDisplay');
        const generateBtn = document.getElementById('generateBtn');
        const loading = document.getElementById('loading');
        const uploadSection = document.getElementById('uploadSection');
        const resultSection = document.getElementById('resultSection');
        const colorPaletteGrid = document.getElementById('colorPaletteGrid');
        const backBtn = document.getElementById('backBtn');
        const stats = document.getElementById('stats');
        const patternCanvas = document.getElementById('patternCanvas');
        const paletteCanvas = document.getElementById('paletteCanvas');
        const combinedCanvas = document.getElementById('combinedCanvas');
        const widthInput = document.getElementById('widthInput');
        const heightInput = document.getElementById('heightInput');
        const pixelSizeInput = document.getElementById('pixelSizeInput');
        const ditherStrengthSlider = document.getElementById('ditherStrengthSlider');
        const ditherStrengthInput = document.getElementById('ditherStrengthInput');
        const ditherStrengthValue = document.getElementById('ditherStrengthValue');
        const edgeAwareToggle = document.getElementById('edgeAwareToggle');
        const labDitherToggle = document.getElementById('labDitherToggle');
        const partitionToggle = document.getElementById('partitionToggle');
        
        // 编辑模式DOM元素
        const editModeBtn = document.getElementById('editModeBtn');
        const editToolbar = document.getElementById('editToolbar');
        const dragTool = document.getElementById('dragTool');
        const brushTool = document.getElementById('brushTool');
        const eyedropperTool = document.getElementById('eyedropperTool');
        const currentColorBox = document.getElementById('currentColorBox');
        const currentColorId = document.getElementById('currentColorId');
        const colorPaletteEdit = document.getElementById('colorPaletteEdit');
        const applyEditBtn = document.getElementById('applyEditBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        const editCanvas = document.getElementById('editCanvas');
        const editCanvasWrap = document.getElementById('editCanvasWrap');
        const normalCanvasWrap = document.getElementById('normalCanvasWrap');
        const chibiToggle = document.getElementById('chibiToggle');
        const chibiPreviewContainer = document.getElementById('chibiPreviewContainer');
        const chibiPreviewCanvas = document.getElementById('chibiPreviewCanvas');
        const saveChibiBtn = document.getElementById('saveChibiBtn');

        // 初始化色卡预览
        function initColorPalette() {
            colorPaletteGrid.innerHTML = colorBeans.map(bean => 
                `<div class="color-swatch" style="background-color: ${bean.hex};" title="${bean.id}">
                    <span class="color-id">${bean.id}</span>
                </div>`
            ).join('');
        }

        // 文件处理
        uploadArea.addEventListener('click', () => imageInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        });

        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleFile(file);
        });

        // 粘贴图片功能
        document.addEventListener('paste', (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let item of items) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        // 创建一个虚拟的文件名
                        const fakeFile = new File([file], 'pasted-image.' + file.type.split('/')[1], { type: file.type });
                        handleFile(fakeFile);
                        return;
                    }
                }
            }
        });

        function handleFile(file) {
            if (!file.type.startsWith('image/')) {
                showError('请选择图片文件');
                return;
            }
            hideError();
            state.imageFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                state.imageDataUrl = e.target.result;
                showPreview();
            };
            reader.readAsDataURL(file);
        }

        function showPreview() {
            uploadArea.style.display = 'none';
            previewContainer.classList.remove('hidden');
            fileName.textContent = state.imageFile.name || '粘贴的图片';
            const img = new Image();
            img.onload = () => {
                const ctx = previewCanvas.getContext('2d');
                const maxSize = 250;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxSize) {
                        height = (height / width) * maxSize;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = (width / height) * maxSize;
                        height = maxSize;
                    }
                }
                previewCanvas.width = width;
                previewCanvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
            };
            img.src = state.imageDataUrl;
            generateBtn.disabled = false;
        }

        changeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.imageFile = null;
            state.imageDataUrl = null;
            state.chibiImageDataUrl = null;
            state.useChibi = false;
            uploadArea.style.display = 'block';
            previewContainer.classList.add('hidden');
            chibiPreviewContainer.classList.add('hidden');
            chibiToggle.classList.remove('active');
            generateBtn.disabled = true;
            imageInput.value = '';
        });

        function showError(msg) {
            errorMsg.textContent = msg;
            errorMsg.classList.remove('hidden');
        }

        function hideError() {
            errorMsg.classList.add('hidden');
        }

        // 采样方式切换
        document.querySelectorAll('.sampling-method-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sampling-method-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.samplingMethod = btn.getAttribute('data-method');
                const densityGroup = document.getElementById('samplingDensityGroup');
                if (state.samplingMethod === 'single') {
                    densityGroup.style.opacity = '0.4';
                    densityGroup.style.pointerEvents = 'none';
                } else {
                    densityGroup.style.opacity = '1';
                    densityGroup.style.pointerEvents = 'auto';
                }
            });
        });

        // 采样密度滑块
        const samplingDensitySlider = document.getElementById('samplingDensitySlider');
        const samplingDensityInput = document.getElementById('samplingDensityInput');
        const samplingDensityValue = document.getElementById('samplingDensityValue');
        const samplingDensityValue2 = document.getElementById('samplingDensityValue2');
        const samplingPointsValue = document.getElementById('samplingPointsValue');

        function updateSamplingDensity(val) {
            val = parseInt(val);
            if (isNaN(val) || val < 1) val = 1;
            if (val > 9) val = 9;
            if (val % 2 === 0) val = val - 1;
            state.samplingDensity = val;
            samplingDensitySlider.value = val;
            samplingDensityInput.value = val;
            samplingDensityValue.textContent = val;
            samplingDensityValue2.textContent = val;
            samplingPointsValue.textContent = val * val;
        }

        samplingDensitySlider.addEventListener('input', (e) => {
            updateSamplingDensity(e.target.value);
        });

        samplingDensityInput.addEventListener('change', (e) => {
            updateSamplingDensity(e.target.value);
        });

        // 尺寸预设事件
        document.querySelectorAll('.size-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                // 移除所有按钮的激活状态
                document.querySelectorAll('.size-preset').forEach(b => b.classList.remove('active'));
                // 激活当前按钮
                btn.classList.add('active');
                // 设置尺寸
                const size = parseInt(btn.getAttribute('data-size'));
                state.targetWidth = size;
                state.targetHeight = size;
                // 更新滑块和输入框
                widthSlider.value = size;
                heightSlider.value = size;
                widthInput.value = size;
                heightInput.value = size;
                widthValue.textContent = size;
                heightValue.textContent = size;
            });
        });

        // 滑块事件
        widthSlider.addEventListener('input', (e) => {
            state.targetWidth = parseInt(e.target.value);
            widthValue.textContent = state.targetWidth;
            widthInput.value = state.targetWidth;
            // 取消预设按钮激活状态
            document.querySelectorAll('.size-preset').forEach(b => b.classList.remove('active'));
        });

        heightSlider.addEventListener('input', (e) => {
            state.targetHeight = parseInt(e.target.value);
            heightValue.textContent = state.targetHeight;
            heightInput.value = state.targetHeight;
            // 取消预设按钮激活状态
            document.querySelectorAll('.size-preset').forEach(b => b.classList.remove('active'));
        });

        pixelSizeSlider.addEventListener('input', (e) => {
            state.pixelSize = parseInt(e.target.value);
            pixelSizeValue.textContent = state.pixelSize;
            pixelSizeInput.value = state.pixelSize;
            if (state.processResult) {
                updateResultDisplay();
            }
        });

        // 输入框事件
        widthInput.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            val = Math.max(20, Math.min(200, val));
            state.targetWidth = val;
            widthSlider.value = val;
            widthValue.textContent = val;
            e.target.value = val;
            // 取消预设按钮激活状态
            document.querySelectorAll('.size-preset').forEach(b => b.classList.remove('active'));
        });

        heightInput.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            val = Math.max(20, Math.min(200, val));
            state.targetHeight = val;
            heightSlider.value = val;
            heightValue.textContent = val;
            e.target.value = val;
            // 取消预设按钮激活状态
            document.querySelectorAll('.size-preset').forEach(b => b.classList.remove('active'));
        });

        // 像素大小输入框事件
        pixelSizeInput.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            val = Math.max(5, Math.min(40, val));
            state.pixelSize = val;
            pixelSizeSlider.value = val;
            pixelSizeValue.textContent = val;
            e.target.value = val;
            if (state.processResult) {
                updateResultDisplay();
            }
        });

        // Toggle 事件
        cie94Toggle.addEventListener('click', () => {
            state.useCie94 = !state.useCie94;
            cie94Toggle.classList.toggle('active', state.useCie94);
        });

        // 抖色方式切换
        document.querySelectorAll('.dither-method').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.dither-method').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.ditherMethod = btn.getAttribute('data-method');
            });
        });

        // 抖色强度滑块
        ditherStrengthSlider.addEventListener('input', (e) => {
            state.ditherStrength = parseInt(e.target.value) / 100;
            ditherStrengthValue.textContent = e.target.value;
            ditherStrengthInput.value = e.target.value;
        });
        ditherStrengthInput.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            val = Math.max(0, Math.min(100, val));
            state.ditherStrength = val / 100;
            ditherStrengthSlider.value = val;
            ditherStrengthValue.textContent = val;
            e.target.value = val;
        });

        // 边缘保留抖色开关
        edgeAwareToggle.addEventListener('click', () => {
            state.useEdgeAwareDither = !state.useEdgeAwareDither;
            edgeAwareToggle.classList.toggle('active', state.useEdgeAwareDither);
        });

        // Lab 空间抖色开关
        labDitherToggle.addEventListener('click', () => {
            state.useLabDither = !state.useLabDither;
            labDitherToggle.classList.toggle('active', state.useLabDither);
        });

        // 色卡分区匹配开关
        partitionToggle.addEventListener('click', () => {
            state.usePartitionMatch = !state.usePartitionMatch;
            partitionToggle.classList.toggle('active', state.usePartitionMatch);
        });

        // 颜色提取白名单开关
        const colorExtractionToggle = document.getElementById('colorExtractionToggle');
        colorExtractionToggle.addEventListener('click', () => {
            state.useColorExtraction = !state.useColorExtraction;
            colorExtractionToggle.classList.toggle('active', state.useColorExtraction);
            // 显示/隐藏采样决策方式
            const decisionGroup = document.getElementById('samplingDecisionGroup');
            decisionGroup.style.opacity = state.useColorExtraction ? '1' : '0.4';
            decisionGroup.style.pointerEvents = state.useColorExtraction ? 'auto' : 'none';
        });

        // 采样决策方式切换（路径A / 路径B）
        document.querySelectorAll('.sampling-decision-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sampling-decision-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.samplingDecisionMethod = btn.getAttribute('data-method');
                const descEl = document.getElementById('decisionDesc');
                if (state.samplingDecisionMethod === 'vote') {
                    descEl.textContent = '投票法：N×N采样点各自归类投票，杜绝混合色';
                } else if (state.samplingDecisionMethod === 'microcluster') {
                    descEl.textContent = '微聚类：逐格微聚类，少数派深色优先保留细节，防止杂色';
                } else {
                    descEl.textContent = '平均匹配：Lab平均后在白名单内找最近色号';
                }
            });
        });

        gridToggle.addEventListener('click', () => {
            state.showGrid = !state.showGrid;
            gridToggle.classList.toggle('active', state.showGrid);
            if (state.processResult) {
                if (state.isEditMode) {
                    drawEditCanvas();
                } else {
                    updateResultDisplay();
                }
            }
        });

        guideToggle.addEventListener('click', () => {
            state.showGuideLines = !state.showGuideLines;
            guideToggle.classList.toggle('active', state.showGuideLines);
            if (state.processResult) {
                if (state.isEditMode) {
                    drawEditCanvas();
                } else {
                    updateResultDisplay();
                }
            }
        });

        labelsToggle.addEventListener('click', () => {
            state.showLabels = !state.showLabels;
            labelsToggle.classList.toggle('active', state.showLabels);
            if (state.processResult) {
                updateResultDisplay();
            }
        });

        axisToggle.addEventListener('click', () => {
            state.showAxis = !state.showAxis;
            axisToggle.classList.toggle('active', state.showAxis);
            if (state.processResult) {
                updateResultDisplay();
            }
        });

        chibiToggle.addEventListener('click', () => {
            state.useChibi = !state.useChibi;
            chibiToggle.classList.toggle('active', state.useChibi);
            
            // 显示或隐藏风格设置
            const chibiSettings = document.getElementById('chibiSettings');
            if (state.useChibi) {
                chibiSettings.classList.remove('hidden');
            } else {
                chibiSettings.classList.add('hidden');
                state.chibiImageDataUrl = null;
                chibiPreviewContainer.classList.add('hidden');
            }
        });

        // 风格预设按钮事件
        document.querySelectorAll('.style-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.getAttribute('data-prompt');
                document.getElementById('chibiPrompt').value = prompt;
            });
        });

        // 生成图纸
        generateBtn.addEventListener('click', async () => {
            if (!state.imageDataUrl) return;
            loading.classList.add('active');
            generateBtn.disabled = true;
            await processImage();
        });

        // 显示CHIBI预览
        function showChibiPreview(chibiDataUrl) {
            state.chibiImageDataUrl = chibiDataUrl;
            chibiPreviewContainer.classList.remove('hidden');
            
            const img = new Image();
            img.onload = () => {
                const ctx = chibiPreviewCanvas.getContext('2d');
                const maxSize = 250;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxSize) {
                        height = (height / width) * maxSize;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = (width / height) * maxSize;
                        height = maxSize;
                    }
                }
                
                chibiPreviewCanvas.width = width;
                chibiPreviewCanvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
            };
            img.src = chibiDataUrl;
        }

        // ==================== 主色提取 & 白名单 ====================

        // ====== 高对比度孤立特征点检测 ======
        // 在聚类之前，扫描原图找出"和周围色差大 + 像素极少"的孤立特征
        // （如1像素鼻子、眼睛高光、嘴巴小点），避免这些特征在聚类/投票阶段被淹没
        function detectHighContrastFeatures(imageData, contrastThreshold, maxFeatureSize) {
            const W = imageData.width;
            const H = imageData.height;
            const data = imageData.data;
            // contrastThreshold: 与8邻域的平均ΔE阈值，默认25
            // maxFeatureSize: 特征连通区域最大像素数，默认9

            // 第1步：标记每个像素是否是"高对比度像素"
            const featureMask = new Uint8Array(W * H); // 0=普通, 1=高对比度特征
            for (let y = 1; y < H - 1; y++) {
                for (let x = 1; x < W - 1; x++) {
                    const idx = (y * W + x) * 4;
                    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                    const centerLab = rgbToLab({ r, g, b });
                    // 与8邻域比较
                    let neighborDistSum = 0;
                    let neighborCount = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nIdx = ((y + dy) * W + (x + dx)) * 4;
                            const nLab = rgbToLab({
                                r: data[nIdx], g: data[nIdx + 1], b: data[nIdx + 2]
                            });
                            neighborDistSum += labEuclideanDistance(centerLab, nLab);
                            neighborCount++;
                        }
                    }
                    const avgNeighborDist = neighborDistSum / neighborCount;
                    if (avgNeighborDist > contrastThreshold) {
                        featureMask[y * W + x] = 1;
                    }
                }
            }

            // 第2步：连通区域分析（BFS），将相邻的特征像素聚合成特征块
            const visited = new Uint8Array(W * H);
            const featureClusters = []; // [{lab均值, count, pixels: [{x,y,r,g,b}], centerX, centerY}]

            const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const p = y * W + x;
                    if (featureMask[p] !== 1 || visited[p]) continue;
                    // BFS
                    const queue = [{ x, y }];
                    visited[p] = 1;
                    const pixels = [];
                    while (queue.length > 0) {
                        const { x: cx, y: cy } = queue.shift();
                        const idx = (cy * W + cx) * 4;
                        pixels.push({
                            x: cx, y: cy,
                            r: data[idx], g: data[idx + 1], b: data[idx + 2]
                        });
                        for (const [dx, dy] of dirs) {
                            const nx = cx + dx, ny = cy + dy;
                            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                            const np = ny * W + nx;
                            if (featureMask[np] === 1 && !visited[np]) {
                                visited[np] = 1;
                                queue.push({ x: nx, y: ny });
                            }
                        }
                    }
                    // 只保留小特征（孤立细节），大块忽略
                    if (pixels.length <= maxFeatureSize) {
                        // 计算Lab均值
                        let sumL = 0, sumA = 0, sumB = 0;
                        let sumX = 0, sumY = 0;
                        for (const p of pixels) {
                            const lab = rgbToLab({ r: p.r, g: p.g, b: p.b });
                            sumL += lab.l; sumA += lab.a; sumB += lab.b;
                            sumX += p.x; sumY += p.y;
                        }
                        featureClusters.push({
                            lab: { l: sumL / pixels.length, a: sumA / pixels.length, b: sumB / pixels.length },
                            count: pixels.length,
                            centerX: sumX / pixels.length,
                            centerY: sumY / pixels.length
                        });
                    }
                }
            }

            console.log(`[特征检测] 发现 ${featureClusters.length} 个孤立高对比度特征(ΔE>${contrastThreshold}, size≤${maxFeatureSize})`);
            return featureClusters;
        }

        // Lab 空间欧氏距离（用于聚类，比CIE94更快）
        function labEuclideanDistance(lab1, lab2) {
            const dl = lab1.l - lab2.l;
            const da = lab1.a - lab2.a;
            const db = lab1.b - lab2.b;
            return Math.sqrt(dl * dl + da * da + db * db);
        }

        // 从原图提取主要颜色 → 聚类 → 暗部合并 → 映射色卡 → 生成白名单
        function extractDominantColors(imageData, threshold, darkMergeThreshold, lightProtectThreshold, featurePoints) {
            const W = imageData.width;
            const H = imageData.height;
            const data = imageData.data;
            // 采样步长：跳过部分像素加速（卡通图的主色不会因为跳采样丢失）
            const step = Math.max(1, Math.floor(Math.min(W, H) / 150));

            // clusters: [{lab: {l,a,b}, count: number, bean: null|colorBean}]
            const clusters = [];

            for (let y = 0; y < H; y += step) {
                for (let x = 0; x < W; x += step) {
                    const idx = (y * W + x) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];
                    const lab = rgbToLab({ r, g, b });

                    // 找最近的聚类
                    let minDist = Infinity;
                    let nearestIdx = -1;
                    for (let i = 0; i < clusters.length; i++) {
                        const d = labEuclideanDistance(lab, clusters[i].lab);
                        if (d < minDist) {
                            minDist = d;
                            nearestIdx = i;
                        }
                    }

                    if (nearestIdx >= 0 && minDist < threshold) {
                        // 合并到已有聚类（更新中心为加权平均）
                        const c = clusters[nearestIdx];
                        c.lab.l = (c.lab.l * c.count + lab.l) / (c.count + 1);
                        c.lab.a = (c.lab.a * c.count + lab.a) / (c.count + 1);
                        c.lab.b = (c.lab.b * c.count + lab.b) / (c.count + 1);
                        c.count++;
                    } else {
                        // 新建聚类
                        clusters.push({ lab: { l: lab.l, a: lab.a, b: lab.b }, count: 1, bean: null });
                    }
                }
            }

            // 聚类按像素数排序（大的在前）
            clusters.sort((a, b) => b.count - a.count);

            // ====== 后处理：暗部合并 + 亮部保护 ======
            // 将所有 L < darkMergeThreshold 的聚类合并到最暗的那个
            // L > lightProtectThreshold 的聚类不参与合并（保护浅粉/白色独立）
            const darkClusters = [];
            const keptClusters = [];
            for (const c of clusters) {
                if (c.lab.l < darkMergeThreshold) {
                    darkClusters.push(c);
                } else {
                    keptClusters.push(c);
                }
            }

            if (darkClusters.length > 1) {
                // 按亮度从暗到亮排序
                darkClusters.sort((a, b) => a.lab.l - b.lab.l);
                // 最暗的作为"主暗聚类"
                const primaryDark = darkClusters[0];
                // 先保存合并前的原始 Lab（最暗的代表色），避免合并后被多数中棕色像素"染亮"
                const preMergeDarkLab = { l: primaryDark.lab.l, a: primaryDark.lab.a, b: primaryDark.lab.b };
                console.log(`[暗部合并] ${darkClusters.length} 个暗聚类(L<${darkMergeThreshold}) → 合并为1个，代表色(合并前) L=${preMergeDarkLab.l.toFixed(1)}`);
                // 合并其余暗聚类（lab被加权平均，给 findNearestCluster 用；但匹配色卡用 preMergeDarkLab）
                for (let i = 1; i < darkClusters.length; i++) {
                    const c = darkClusters[i];
                    const totalCount = primaryDark.count + c.count;
                    primaryDark.lab.l = (primaryDark.lab.l * primaryDark.count + c.lab.l * c.count) / totalCount;
                    primaryDark.lab.a = (primaryDark.lab.a * primaryDark.count + c.lab.a * c.count) / totalCount;
                    primaryDark.lab.b = (primaryDark.lab.b * primaryDark.count + c.lab.b * c.count) / totalCount;
                    primaryDark.count = totalCount;
                }
                // 为色卡匹配阶段保存"最暗代表色"（不被染亮）
                primaryDark.matchLab = preMergeDarkLab;
                keptClusters.unshift(primaryDark);
            } else if (darkClusters.length === 1) {
                darkClusters[0].matchLab = darkClusters[0].lab; // 单个暗聚类，代表色就是自己
                keptClusters.unshift(darkClusters[0]);
            }

            // 重组后的聚类列表，按像素数重新排序
            keptClusters.sort((a, b) => b.count - a.count);

            // ====== 注入高对比度特征点作为迷你聚类 ======
            // 特征点（鼻子1像素、眼睛高光等）与已有聚类中心ΔE > threshold 时，
            // 作为独立聚类加入，count=500 虚拟值避免被过滤
            let injectedCount = 0;
            if (featurePoints && featurePoints.length > 0) {
                for (const fp of featurePoints) {
                    let tooClose = false;
                    for (const c of keptClusters) {
                        if (labEuclideanDistance(fp.lab, c.lab) < threshold) {
                            tooClose = true;
                            break;
                        }
                    }
                    if (!tooClose) {
                        keptClusters.push({
                            lab: { l: fp.lab.l, a: fp.lab.a, b: fp.lab.b },
                            count: 500,
                            bean: null,
                            isFeature: true,
                            centerX: fp.centerX,
                            centerY: fp.centerY
                        });
                        injectedCount++;
                    }
                }
                if (injectedCount > 0) {
                    keptClusters.sort((a, b) => b.count - a.count);
                }
            }

            console.log(`[聚类结果] 合并后共 ${keptClusters.length} 个聚类${injectedCount > 0 ? ' (含' + injectedCount + '个特征点)' : ''}:` +
                keptClusters.map(c => `L=${c.lab.l.toFixed(1)} n=${c.count}${c.isFeature ? '★' : ''}`).join(' | '));

            // 每个聚类 → 匹配色卡色号
            // 关键：如果有 matchLab（暗聚类的"最暗代表色"），就用它匹配，
            // 避免暗聚类被多数中等棕色像素"染亮"后匹配到错误的红棕色号
            const whitelist = [];
            for (const cluster of keptClusters) {
                const matchLab = cluster.matchLab || cluster.lab;
                const rgb = labToRgb(matchLab.l, matchLab.a, matchLab.b);
                const bean = findClosestColorBean(rgb, true); // 用CIE94匹配色卡
                if (!whitelist.find(b => b.id === bean.id)) {
                    whitelist.push(bean);
                }
                cluster.bean = bean;
            }

            return { clusters: keptClusters, whitelist };
        }

        // 根据像素RGB找到最近的主色聚类（用于路径B投票）
        function findNearestCluster(lab, clusters) {
            let minDist = Infinity;
            let nearest = clusters[0];
            for (const cluster of clusters) {
                const d = cie94Distance(lab, cluster.lab);
                if (d < minDist) {
                    minDist = d;
                    nearest = cluster;
                }
            }
            return nearest;
        }

        // 单点采样
        async function processImage() {
            try {
                let finalImageDataUrl = state.imageDataUrl;

                // 如果开启了CHIBI，先调用API转换
                if (state.useChibi) {
                    try {
                        // 去掉data:image/xxx;base64,前缀
                        const base64Data = state.imageDataUrl.split(',')[1];
                        // 获取自定义提示词
                        const customPrompt = document.getElementById('chibiPrompt').value;
                        const chibiBase64 = await transformToChibi(base64Data, customPrompt);
                        finalImageDataUrl = 'data:image/png;base64,' + chibiBase64;
                        showChibiPreview(finalImageDataUrl);
                    } catch (err) {
                        console.error('CHIBI转换失败，使用原图:', err);
                        const errorMsg = err.message ? err.message : '未知错误';
                        showError('CHIBI转换失败: ' + errorMsg + '，使用原图继续');
                    }
                }

                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = finalImageDataUrl;
                });

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(img, 0, 0);
                const imageData = tempCtx.getImageData(0, 0, img.width, img.height);

                const W = img.width;
                const H = img.height;
                const edgeMap = new Float32Array(W * H);
                const gray = new Uint8ClampedArray(W * H);
                for (let i = 0; i < W * H; i++) {
                    const r = imageData.data[i * 4];
                    const g = imageData.data[i * 4 + 1];
                    const b = imageData.data[i * 4 + 2];
                    gray[i] = (r * 299 + g * 587 + b * 114) / 1000;
                }
                for (let y = 1; y < H - 1; y++) {
                    for (let x = 1; x < W - 1; x++) {
                        const gx =
                            -gray[(y - 1) * W + (x - 1)] - 2 * gray[y * W + (x - 1)] - gray[(y + 1) * W + (x - 1)]
                            + gray[(y - 1) * W + (x + 1)] + 2 * gray[y * W + (x + 1)] + gray[(y + 1) * W + (x + 1)];
                        const gy =
                            -gray[(y - 1) * W + (x - 1)] - 2 * gray[(y - 1) * W + x] - gray[(y - 1) * W + (x + 1)]
                            + gray[(y + 1) * W + (x - 1)] + 2 * gray[(y + 1) * W + x] + gray[(y + 1) * W + (x + 1)];
                        edgeMap[y * W + x] = Math.sqrt(gx * gx + gy * gy);
                    }
                }
                let edgeSum = 0, edgeN = 0;
                for (let i = 0; i < edgeMap.length; i++) {
                    const v = edgeMap[i];
                    if (v > 0) {
                        edgeSum += v;
                        edgeN++;
                    }
                }
                const edgeMean = edgeN > 0 ? edgeSum / edgeN : 20;

                const pixels = [];
                const colorStats = new Map();
                const scaleX = img.width / state.targetWidth;
                const scaleY = img.height / state.targetHeight;
                const tw = state.targetWidth;
                const th = state.targetHeight;
                const cellEdgeMeanGrid = new Float32Array(tw * th);

                const samplingN = state.samplingDensity;

                for (let y = 0; y < th; y++) {
                    const row = [];
                    for (let x = 0; x < tw; x++) {
                        const srcXStart = x * scaleX;
                        const srcYStart = y * scaleY;
                        const srcXEnd = (x + 1) * scaleX;
                        const srcYEnd = (y + 1) * scaleY;
                        const cellW = srcXEnd - srcXStart;
                        const cellH = srcYEnd - srcYStart;

                        let r, g, b;

                        if (state.samplingMethod === 'single') {
                            const sx = Math.floor(srcXStart + cellW / 2);
                            const sy = Math.floor(srcYStart + cellH / 2);
                            const idx = (sy * W + sx) * 4;
                            r = imageData.data[idx];
                            g = imageData.data[idx + 1];
                            b = imageData.data[idx + 2];
                        } else {
                            let sumL = 0, sumA = 0, sumB = 0, count = 0;
                            const stepX = cellW / samplingN;
                            const stepY = cellH / samplingN;
                            for (let iy = 0; iy < samplingN; iy++) {
                                for (let ix = 0; ix < samplingN; ix++) {
                                    const sx = Math.min(W - 1, Math.max(0, Math.floor(srcXStart + stepX * (ix + 0.5))));
                                    const sy = Math.min(H - 1, Math.max(0, Math.floor(srcYStart + stepY * (iy + 0.5))));
                                    const idx = (sy * W + sx) * 4;
                                    const pr = imageData.data[idx];
                                    const pg = imageData.data[idx + 1];
                                    const pb = imageData.data[idx + 2];
                                    const lab = rgbToLab({ r: pr, g: pg, b: pb });
                                    sumL += lab.l;
                                    sumA += lab.a;
                                    sumB += lab.b;
                                    count++;
                                }
                            }
                            const avgLab = { l: sumL / count, a: sumA / count, b: sumB / count };
                            const avgRgb = labToRgb(avgLab.l, avgLab.a, avgLab.b);
                            r = avgRgb.r;
                            g = avgRgb.g;
                            b = avgRgb.b;
                        }

                        const x0 = Math.max(1, Math.floor(srcXStart));
                        const y0 = Math.max(1, Math.floor(srcYStart));
                        const x1 = Math.min(W - 1, Math.ceil(srcXEnd));
                        const y1 = Math.min(H - 1, Math.ceil(srcYEnd));
                        let cellEdgeSum = 0, cellEdgeCount = 0;
                        for (let sy = y0; sy < y1; sy++) {
                            for (let sx = x0; sx < x1; sx++) {
                                cellEdgeSum += edgeMap[sy * W + sx];
                                cellEdgeCount++;
                            }
                        }
                        const cellEdgeMean = cellEdgeCount > 0 ? cellEdgeSum / cellEdgeCount : 0;
                        cellEdgeMeanGrid[y * tw + x] = cellEdgeMean;

                        const originalRgb = { r, g, b };
                        row.push({ originalRgb, matchedBean: null, x, y });
                    }
                    pixels.push(row);
                }

                const ditherStrength = state.ditherStrength;

                if (state.samplingDecisionMethod === 'microcluster') {
                    // ====== 路径C：逐格微聚类 + 少数派深色优先 ======
                    // 对每个格子采 N×N 个点做微聚类（阈值8），
                    // 若有多数派和少数派，少数派明显更暗 → 选少数派保留细节
                    // 无须颜色提取/白名单/特征检测，独立工作
                    console.log('[微聚类] 逐格微聚类，少数派深色优先(需要≥15%占比)');
                    const microClusterThreshold = 10; // 微聚类 ΔE 阈值（黑+抗锯齿深灰合并成同一模式）
                    const minorityDarkDiff = 15;       // 少数派L至少比多数派低多少才触发
                    const minorityMinRatio = 0.15;      // 少数派占比≥15%才认为是"真的有暗色特征"，否则当噪点

                    for (let y = 0; y < th; y++) {
                        for (let x = 0; x < tw; x++) {
                            const srcXStart = x * scaleX;
                            const srcYStart = y * scaleY;
                            const srcXEnd = (x + 1) * scaleX;
                            const srcYEnd = (y + 1) * scaleY;
                            const cellW = srcXEnd - srcXStart;
                            const cellH = srcYEnd - srcYStart;

                            // 采样 N×N 个点
                            const samplingN = state.samplingMethod === 'single' ? 1 : state.samplingDensity;
                            const sampleLabs = [];
                            if (state.samplingMethod === 'single') {
                                const sx = Math.floor(srcXStart + cellW / 2);
                                const sy = Math.floor(srcYStart + cellH / 2);
                                const idx = (sy * W + sx) * 4;
                                sampleLabs.push(rgbToLab({ r: imageData.data[idx], g: imageData.data[idx + 1], b: imageData.data[idx + 2] }));
                            } else {
                                const stepX = cellW / samplingN;
                                const stepY = cellH / samplingN;
                                for (let iy = 0; iy < samplingN; iy++) {
                                    for (let ix = 0; ix < samplingN; ix++) {
                                        const sx = Math.min(W - 1, Math.max(0, Math.floor(srcXStart + stepX * (ix + 0.5))));
                                        const sy = Math.min(H - 1, Math.max(0, Math.floor(srcYStart + stepY * (iy + 0.5))));
                                        const idx = (sy * W + sx) * 4;
                                        sampleLabs.push(rgbToLab({ r: imageData.data[idx], g: imageData.data[idx + 1], b: imageData.data[idx + 2] }));
                                    }
                                }
                            }

                            // ==== 微聚类：把采样点聚成 1-3 个模式 ====
                            const groupCenters = [];   // [{lab, count}]
                            const groupLabels = new Array(sampleLabs.length).fill(-1);

                            for (let i = 0; i < sampleLabs.length; i++) {
                                let minDist = Infinity;
                                let nearestGroup = -1;
                                for (let g = 0; g < groupCenters.length; g++) {
                                    const d = labEuclideanDistance(sampleLabs[i], groupCenters[g].lab);
                                    if (d < minDist) { minDist = d; nearestGroup = g; }
                                }
                                if (nearestGroup >= 0 && minDist < microClusterThreshold) {
                                    const gc = groupCenters[nearestGroup];
                                    gc.lab.l = (gc.lab.l * gc.count + sampleLabs[i].l) / (gc.count + 1);
                                    gc.lab.a = (gc.lab.a * gc.count + sampleLabs[i].a) / (gc.count + 1);
                                    gc.lab.b = (gc.lab.b * gc.count + sampleLabs[i].b) / (gc.count + 1);
                                    gc.count++;
                                    groupLabels[i] = nearestGroup;
                                } else {
                                    groupLabels[i] = groupCenters.length;
                                    groupCenters.push({ lab: { l: sampleLabs[i].l, a: sampleLabs[i].a, b: sampleLabs[i].b }, count: 1 });
                                }
                            }

                            let chosenLab;
                            if (groupCenters.length <= 1) {
                                // 只有1个模式 → 该格均匀纯色
                                chosenLab = groupCenters[0].lab;
                            } else {
                                // 2+个模式 → 找多数派和少数派
                                groupCenters.sort((a, b) => b.count - a.count);
                                const majority = groupCenters[0];
                                const minority = groupCenters[groupCenters.length - 1];
                                const lDiff = majority.lab.l - minority.lab.l;
                                const totalCount = sampleLabs.length;
                                const minorityRatio = minority.count / totalCount;
                                // 条件：少数派明显更暗 + 少数派占比≥15%（避免1个飘过的单像素噪点也被放大成全格黑）
                                if (lDiff > minorityDarkDiff && minorityRatio >= minorityMinRatio) {
                                    chosenLab = minority.lab;
                                } else {
                                    chosenLab = majority.lab;
                                }
                            }

                            const chosenRgb = labToRgb(chosenLab.l, chosenLab.a, chosenLab.b);
                            const bean = findClosestColorBeanEnhanced(
                                { r: Math.round(chosenRgb.r), g: Math.round(chosenRgb.g), b: Math.round(chosenRgb.b) },
                                state.useCie94, state.usePartitionMatch
                            );
                            pixels[y][x].matchedBean = bean;
                            colorStats.set(bean.id, (colorStats.get(bean.id) || 0) + 1);
                        }
                    }
                } else if (state.useColorExtraction) {
                    // ====== 颜色提取白名单模式 ======
                    // 先检测原图孤立高对比度特征（鼻子、眼睛高光等1像素细节）
                    // 阈值12调低，maxFeatureSize提高到25，确保鼻子这种小色差特征也能进来
                    const featurePoints = detectHighContrastFeatures(imageData, 12, 25);
                    const { clusters, whitelist } = extractDominantColors(imageData, state.colorClusterThreshold, state.darkMergeThreshold, state.lightProtectThreshold, featurePoints);
                    console.log(`[白名单] 提取到 ${clusters.length} 个主色聚类，白名单 ${whitelist.length} 个色号:`, whitelist.map(b => b.id).join(', '));

                    if (state.samplingDecisionMethod === 'vote') {
                        // 路径B：投票法 —— 每个采样点独立归类，多数票色号胜出
                        console.log('[投票法] 各采样点投票决定色号');
                        for (let y = 0; y < th; y++) {
                            for (let x = 0; x < tw; x++) {
                                const srcXStart = x * scaleX;
                                const srcYStart = y * scaleY;
                                const srcXEnd = (x + 1) * scaleX;
                                const srcYEnd = (y + 1) * scaleY;
                                const cellW = srcXEnd - srcXStart;
                                const cellH = srcYEnd - srcYStart;

                                const votes = {};
                                const samplingN = state.samplingMethod === 'single' ? 1 : state.samplingDensity;

                                if (state.samplingMethod === 'single') {
                                    const sx = Math.floor(srcXStart + cellW / 2);
                                    const sy = Math.floor(srcYStart + cellH / 2);
                                    const idx = (sy * W + sx) * 4;
                                    const lab = rgbToLab({ r: imageData.data[idx], g: imageData.data[idx + 1], b: imageData.data[idx + 2] });
                                    const nearest = findNearestCluster(lab, clusters);
                                    if (nearest && nearest.bean) {
                                        let weight = 1;
                                        if (featurePoints && featurePoints.length > 0) {
                                            for (const fp of featurePoints) {
                                                if (labEuclideanDistance(lab, fp.lab) < 15) { weight = 3; break; }
                                            }
                                        }
                                        votes[nearest.bean.id] = weight;
                                    }
                                } else {
                                    const stepX = cellW / samplingN;
                                    const stepY = cellH / samplingN;
                                    for (let iy = 0; iy < samplingN; iy++) {
                                        for (let ix = 0; ix < samplingN; ix++) {
                                            const sx = Math.min(W - 1, Math.max(0, Math.floor(srcXStart + stepX * (ix + 0.5))));
                                            const sy = Math.min(H - 1, Math.max(0, Math.floor(srcYStart + stepY * (iy + 0.5))));
                                            const idx = (sy * W + sx) * 4;
                                            const lab = rgbToLab({ r: imageData.data[idx], g: imageData.data[idx + 1], b: imageData.data[idx + 2] });
                                            const nearest = findNearestCluster(lab, clusters);
                                            if (nearest && nearest.bean) {
                                                let weight = 1;
                                                if (featurePoints && featurePoints.length > 0) {
                                                    for (const fp of featurePoints) {
                                                        if (labEuclideanDistance(lab, fp.lab) < 15) { weight = 3; break; }
                                                    }
                                                }
                                                votes[nearest.bean.id] = (votes[nearest.bean.id] || 0) + weight;
                                            }
                                        }
                                    }
                                }

                                // 找出得票最多的色号（平票时暗色优先）
                                let maxVotes = 0;
                                let winnerId = null;
                                let winnerL = null; // 用于平票比较亮度
                                for (const [id, count] of Object.entries(votes)) {
                                    const bean = colorBeans.find(b => b.id === id);
                                    const beanLab = bean ? rgbToLab(hexToRgb(bean.hex)) : null;
                                    const beanL = beanLab ? beanLab.l : 100;
                                    if (count > maxVotes) {
                                        maxVotes = count;
                                        winnerId = id;
                                        winnerL = beanL;
                                    } else if (count === maxVotes && beanL < winnerL) {
                                        // 平票时选更暗的色号（L更小）
                                        winnerId = id;
                                        winnerL = beanL;
                                    }
                                }

                                // ====== 边缘格子暗色保护：薄特征（嘴线/细发丝）反淹没 ======
                                // 若此格是强边缘格：
                                //   1) 找所有得票色号中最暗的那个
                                //   2) 只要 L < 65（覆盖深棕红/中深棕）且得了 ≥1 票
                                //   3) 且这个暗色与最高票得票差距 ≤ 4 票（不会在毫无暗色信号的格子上误触发）
                                // 就强制暗色胜出 —— 保护1像素细线不被皮肤/底色淹没
                                const cellEdgeIdx = y * tw + x;
                                const cellEdgeM = cellEdgeMeanGrid[cellEdgeIdx];
                                if (cellEdgeM > edgeMean * 1.5) {
                                    let darkestId = null;
                                    let darkestL = Infinity;
                                    let darkestVotes = 0;
                                    for (const [id, count] of Object.entries(votes)) {
                                        const bean = colorBeans.find(b => b.id === id);
                                        if (!bean) continue;
                                        const beanLab = rgbToLab(hexToRgb(bean.hex));
                                        if (beanLab.l < darkestL) {
                                            darkestL = beanLab.l;
                                            darkestId = id;
                                            darkestVotes = count;
                                        }
                                    }
                                    let maxV = 0;
                                    for (const v of Object.values(votes)) if (v > maxV) maxV = v;
                                    if (darkestId && darkestL < 65 && darkestVotes >= 1 && (maxV - darkestVotes) <= 4) {
                                        winnerId = darkestId;
                                    }
                                }

                                // ====== 特征点强制权：若当前格子覆盖任何一个特征点区域 → 直接用特征色号 ======
                                // 小特征（1像素鼻子/眼睛高光）不参与投票多数决，只要命中就强制输出。
                                // 命中判断：该格映射的原图矩形内是否有特征点中心
                                if (featurePoints && featurePoints.length > 0) {
                                    const cellSX0 = x * scaleX;
                                    const cellSY0 = y * scaleY;
                                    const cellSX1 = (x + 1) * scaleX;
                                    const cellSY1 = (y + 1) * scaleY;
                                    for (const fp of featurePoints) {
                                        const inCell = fp.centerX >= cellSX0 && fp.centerX < cellSX1
                                            && fp.centerY >= cellSY0 && fp.centerY < cellSY1;
                                        if (!inCell) continue;
                                        // 找到对应feature聚类的色号bean
                                        let featureBean = null;
                                        for (const c of clusters) {
                                            if (c.isFeature && labEuclideanDistance(fp.lab, c.lab) < 15) {
                                                featureBean = c.bean;
                                                break;
                                            }
                                        }
                                        if (featureBean) {
                                            winnerId = featureBean.id;
                                            break;
                                        }
                                    }
                                }

                                const winnerBean = winnerId ? colorBeans.find(b => b.id === winnerId) : whitelist[0];
                                pixels[y][x].matchedBean = winnerBean;
                                colorStats.set(winnerBean.id, (colorStats.get(winnerBean.id) || 0) + 1);
                            }
                        }
                    } else {
                        // 路径A：平均+白名单匹配 —— Lab平均后在白名单内找最近色号
                        console.log('[平均匹配] Lab平均后在白名单内匹配，白名单:', whitelist.map(b => b.id).join(', '));
                        for (let y = 0; y < th; y++) {
                            for (let x = 0; x < tw; x++) {
                                const srcXStart = x * scaleX;
                                const srcYStart = y * scaleY;
                                const srcXEnd = (x + 1) * scaleX;
                                const srcYEnd = (y + 1) * scaleY;
                                const cellW = srcXEnd - srcXStart;
                                const cellH = srcYEnd - srcYStart;

                                let r, g, b;
                                if (state.samplingMethod === 'single') {
                                    const sx = Math.floor(srcXStart + cellW / 2);
                                    const sy = Math.floor(srcYStart + cellH / 2);
                                    const idx = (sy * W + sx) * 4;
                                    r = imageData.data[idx];
                                    g = imageData.data[idx + 1];
                                    b = imageData.data[idx + 2];
                                } else {
                                    let sumL = 0, sumA = 0, sumB = 0, count = 0;
                                    const samplingN = state.samplingDensity;
                                    const stepX = cellW / samplingN;
                                    const stepY = cellH / samplingN;
                                    for (let iy = 0; iy < samplingN; iy++) {
                                        for (let ix = 0; ix < samplingN; ix++) {
                                            const sx = Math.min(W - 1, Math.max(0, Math.floor(srcXStart + stepX * (ix + 0.5))));
                                            const sy = Math.min(H - 1, Math.max(0, Math.floor(srcYStart + stepY * (iy + 0.5))));
                                            const idx = (sy * W + sx) * 4;
                                            const lab = rgbToLab({ r: imageData.data[idx], g: imageData.data[idx + 1], b: imageData.data[idx + 2] });
                                            sumL += lab.l;
                                            sumA += lab.a;
                                            sumB += lab.b;
                                            count++;
                                        }
                                    }
                                    const avgLab = { l: sumL / count, a: sumA / count, b: sumB / count };
                                    const avgRgb = labToRgb(avgLab.l, avgLab.a, avgLab.b);
                                    r = avgRgb.r;
                                    g = avgRgb.g;
                                    b = avgRgb.b;
                                }

                                // 只在白名单中匹配，不在全色卡 291 个中搜索
                                const targetRgb = { r, g, b };
                                const targetLab = rgbToLab(targetRgb);
                                let bestBean = whitelist[0];
                                let minDist = Infinity;
                                for (const bean of whitelist) {
                                    const beanLab = rgbToLab(hexToRgb(bean.hex));
                                    const dist = state.useCie94 ? cie94Distance(targetLab, beanLab) : labEuclideanDistance(targetLab, beanLab);
                                    if (dist < minDist) {
                                        minDist = dist;
                                        bestBean = bean;
                                    }
                                }
                                pixels[y][x].matchedBean = bestBean;
                                colorStats.set(bestBean.id, (colorStats.get(bestBean.id) || 0) + 1);
                            }
                        }
                    }
                } else {
                    // ====== 原有逻辑：不使用白名单时，走原来的抖色流程 ======
                    if (state.ditherMethod === 'none') {
                        for (let y = 0; y < th; y++) {
                            for (let x = 0; x < tw; x++) {
                                const clamped = pixels[y][x].originalRgb;
                                const bean = findClosestColorBeanEnhanced(clamped, state.useCie94, state.usePartitionMatch);
                                pixels[y][x].matchedBean = bean;
                                colorStats.set(bean.id, (colorStats.get(bean.id) || 0) + 1);
                            }
                        }
                    } else if (state.ditherMethod === 'bayer') {
                        const bayer4 = [
                            [0, 8, 2, 10],
                            [12, 4, 14, 6],
                            [3, 11, 1, 9],
                            [15, 7, 13, 5]
                        ];
                        const amp = 30 * ditherStrength;
                        for (let y = 0; y < th; y++) {
                            for (let x = 0; x < tw; x++) {
                                const orig = pixels[y][x].originalRgb;
                                const threshold = (bayer4[y % 4][x % 4] / 16 - 0.5) * 2 * amp;
                                const adjustedRgb = {
                                    r: Math.max(0, Math.min(255, orig.r + threshold)),
                                    g: Math.max(0, Math.min(255, orig.g + threshold)),
                                    b: Math.max(0, Math.min(255, orig.b + threshold))
                                };
                                const bean = findClosestColorBeanEnhanced(adjustedRgb, state.useCie94, state.usePartitionMatch);
                                pixels[y][x].matchedBean = bean;
                                colorStats.set(bean.id, (colorStats.get(bean.id) || 0) + 1);
                            }
                        }
                    } else {
                        if (state.useLabDither) {
                            const bufL = new Float32Array(tw * th);
                            const bufa = new Float32Array(tw * th);
                            const bufb = new Float32Array(tw * th);
                            for (let y = 0; y < th; y++) {
                                for (let x = 0; x < tw; x++) {
                                    const idx = y * tw + x;
                                    const lab = rgbToLab(pixels[y][x].originalRgb);
                                    bufL[idx] = lab.l;
                                    bufa[idx] = lab.a;
                                    bufb[idx] = lab.b;
                                }
                            }
                            for (let y = 0; y < th; y++) {
                                for (let x = 0; x < tw; x++) {
                                    const i = y * tw + x;
                                    const clamped = {
                                        r: Math.max(0, Math.min(255, labToRgb(bufL[i], bufa[i], bufb[i]).r)),
                                        g: Math.max(0, Math.min(255, labToRgb(bufL[i], bufa[i], bufb[i]).g)),
                                        b: Math.max(0, Math.min(255, labToRgb(bufL[i], bufa[i], bufb[i]).b))
                                    };
                                    const bean = findClosestColorBeanEnhanced(clamped, state.useCie94, state.usePartitionMatch);
                                    pixels[y][x].matchedBean = bean;
                                    pixels[y][x].originalRgb = clamped;

                                    const beanLab = rgbToLab(hexToRgb(bean.hex));
                                    let errL = bufL[i] - beanLab.l;
                                    let erra = bufa[i] - beanLab.a;
                                    let errb = bufb[i] - beanLab.b;
                                    errL *= ditherStrength;
                                    erra *= ditherStrength;
                                    errb *= ditherStrength;

                                    if (state.useEdgeAwareDither) {
                                        const cellEdgeM = cellEdgeMeanGrid[i];
                                        const factor = Math.min(1, 0.1 + cellEdgeM / (edgeMean + 1) * 0.9);
                                        errL *= factor;
                                        erra *= factor;
                                        errb *= factor;
                                    }

                                    if (x + 1 < tw) {
                                        bufL[i + 1] += errL * 7 / 16;
                                        bufa[i + 1] += erra * 7 / 16;
                                        bufb[i + 1] += errb * 7 / 16;
                                    }
                                    if (y + 1 < th) {
                                        if (x - 1 >= 0) {
                                            bufL[i + tw - 1] += errL * 3 / 16;
                                            bufa[i + tw - 1] += erra * 3 / 16;
                                            bufb[i + tw - 1] += errb * 3 / 16;
                                        }
                                        bufL[i + tw] += errL * 5 / 16;
                                        bufa[i + tw] += erra * 5 / 16;
                                        bufb[i + tw] += errb * 5 / 16;
                                        if (x + 1 < tw) {
                                            bufL[i + tw + 1] += errL * 1 / 16;
                                            bufa[i + tw + 1] += erra * 1 / 16;
                                            bufb[i + tw + 1] += errb * 1 / 16;
                                        }
                                    }

                                    colorStats.set(bean.id, (colorStats.get(bean.id) || 0) + 1);
                                }
                            }
                        } else {
                            const bufR = new Float32Array(tw * th);
                            const bufG = new Float32Array(tw * th);
                            const bufB = new Float32Array(tw * th);
                            for (let y = 0; y < th; y++) {
                                for (let x = 0; x < tw; x++) {
                                    const idx = y * tw + x;
                                    bufR[idx] = pixels[y][x].originalRgb.r;
                                    bufG[idx] = pixels[y][x].originalRgb.g;
                                    bufB[idx] = pixels[y][x].originalRgb.b;
                                }
                            }
                            for (let y = 0; y < th; y++) {
                                for (let x = 0; x < tw; x++) {
                                    const i = y * tw + x;
                                    const clamped = {
                                        r: Math.max(0, Math.min(255, bufR[i])),
                                        g: Math.max(0, Math.min(255, bufG[i])),
                                        b: Math.max(0, Math.min(255, bufB[i]))
                                    };
                                    const bean = findClosestColorBeanEnhanced(clamped, state.useCie94, state.usePartitionMatch);
                                    pixels[y][x].matchedBean = bean;
                                    pixels[y][x].originalRgb = clamped;

                                    const beanRgb = hexToRgb(bean.hex);
                                    let errR = bufR[i] - beanRgb.r;
                                    let errG = bufG[i] - beanRgb.g;
                                    let errB = bufB[i] - beanRgb.b;
                                    errR *= ditherStrength;
                                    errG *= ditherStrength;
                                    errB *= ditherStrength;

                                    if (state.useEdgeAwareDither) {
                                        const cellEdgeM = cellEdgeMeanGrid[i];
                                        const factor = Math.min(1, 0.1 + cellEdgeM / (edgeMean + 1) * 0.9);
                                        errR *= factor;
                                        errG *= factor;
                                        errB *= factor;
                                    }

                                    if (x + 1 < tw) {
                                        bufR[i + 1] += errR * 7 / 16;
                                        bufG[i + 1] += errG * 7 / 16;
                                        bufB[i + 1] += errB * 7 / 16;
                                    }
                                    if (y + 1 < th) {
                                        if (x - 1 >= 0) {
                                            bufR[i + tw - 1] += errR * 3 / 16;
                                            bufG[i + tw - 1] += errG * 3 / 16;
                                            bufB[i + tw - 1] += errB * 3 / 16;
                                        }
                                        bufR[i + tw] += errR * 5 / 16;
                                        bufG[i + tw] += errG * 5 / 16;
                                        bufB[i + tw] += errB * 5 / 16;
                                        if (x + 1 < tw) {
                                            bufR[i + tw + 1] += errR * 1 / 16;
                                            bufG[i + tw + 1] += errG * 1 / 16;
                                            bufB[i + tw + 1] += errB * 1 / 16;
                                        }
                                    }

                                    colorStats.set(bean.id, (colorStats.get(bean.id) || 0) + 1);
                                }
                            }
                        }
                    }
                }

                // ====== 后处理：仅清理轮廓处的孤立M15杂灰点，绝不触碰其他颜色 ======
                // 思路：若某像素匹配到M15，且4邻居中≥2个是H7纯黑→纠正为H7；≥2个是H2纯白→纠正为H2；
                //       其余情况（邻居是彩色/浅灰等）一律保持原样，不影响毛发/衣服/蝴蝶结的颜色层次
                const blackBeanP = colorBeans.find(b => b.id === 'H7');
                const whiteBeanP = colorBeans.find(b => b.id === 'H2');
                if (blackBeanP || whiteBeanP) {
                    for (let y = 0; y < th; y++) {
                        for (let x = 0; x < tw; x++) {
                            const p = pixels[y][x];
                            if (p.matchedBean.id !== 'M15') continue;
                            let blackN = 0, whiteN = 0;
                            const neigh = [
                                [y-1,x],[y+1,x],[y,x-1],[y,x+1]
                            ];
                            for (const [ny, nx] of neigh) {
                                if (ny<0||ny>=th||nx<0||nx>=tw) continue;
                                const nid = pixels[ny][nx].matchedBean.id;
                                if (nid === 'H7') blackN++;
                                else if (nid === 'H2' || nid === 'H21') whiteN++;
                            }
                            if (blackN >= 2 && blackBeanP) {
                                colorStats.set(p.matchedBean.id, colorStats.get(p.matchedBean.id) - 1);
                                if ((colorStats.get(p.matchedBean.id)||0) <= 0) colorStats.delete(p.matchedBean.id);
                                p.matchedBean = blackBeanP;
                                colorStats.set(blackBeanP.id, (colorStats.get(blackBeanP.id) || 0) + 1);
                            } else if (whiteN >= 2 && whiteBeanP) {
                                colorStats.set(p.matchedBean.id, colorStats.get(p.matchedBean.id) - 1);
                                if ((colorStats.get(p.matchedBean.id)||0) <= 0) colorStats.delete(p.matchedBean.id);
                                p.matchedBean = whiteBeanP;
                                colorStats.set(whiteBeanP.id, (colorStats.get(whiteBeanP.id) || 0) + 1);
                            }
                        }
                    }
                }

                state.processResult = {
                    pixels,
                    width: state.targetWidth,
                    height: state.targetHeight,
                    colorStats
                };

                showResult();
            } catch (err) {
                console.error('处理图片失败:', err);
                showError('处理图片失败，请重试');
                loading.classList.remove('active');
                generateBtn.disabled = false;
            }
        }
        
        function showResult() {
            loading.classList.remove('active');
            generateBtn.disabled = false;
            document.getElementById('paletteCard').style.display = 'none';
            resultSection.classList.remove('hidden');
            updateResultDisplay();
            updateStats();
        }

        function updateResultDisplay() {
            const { pixels, width, height, colorStats } = state.processResult;
            // 暂时显示所有画布，确保能正确绘制
            patternCanvas.classList.remove('hidden');
            paletteCanvas.classList.remove('hidden');
            combinedCanvas.classList.remove('hidden');
            
            drawPattern(patternCanvas, pixels, width, height, state.pixelSize, state.showGrid, state.showLabels, state.showAxis, state.showGuideLines, state.guideInterval);
            drawColorPalette(paletteCanvas, colorStats);
            drawCombined(combinedCanvas, pixels, width, height, state.pixelSize, state.showGrid, state.showLabels, colorStats, state.showAxis, state.showGuideLines, state.guideInterval);
            
            // 恢复原来的显示状态
            const activeTab = document.querySelector('.tab.active');
            if (activeTab) {
                const tabName = activeTab.dataset.tab;
                patternCanvas.classList.toggle('hidden', tabName !== 'pattern');
                paletteCanvas.classList.toggle('hidden', tabName !== 'palette');
                combinedCanvas.classList.toggle('hidden', tabName !== 'combined');
            }

            // 根据编辑模式切换容器显示
            if (state.isEditMode) {
                editCanvasWrap.style.display = 'block';
                normalCanvasWrap.style.display = 'none';
            } else {
                editCanvasWrap.style.display = 'none';
                normalCanvasWrap.style.display = '';
            }
        }

        function updateStats() {
            const { width, height, colorStats } = state.processResult;
            stats.innerHTML = `
                <div class="stat-item">
                    <div class="stat-value">${width} × ${height}</div>
                    <div class="stat-label">尺寸</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${colorStats.size}</div>
                    <div class="stat-label">使用颜色</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${width * height}</div>
                    <div class="stat-label">总像素</div>
                </div>
            `;
        }



        // 返回按钮
        backBtn.addEventListener('click', () => {
            state.processResult = null;
            resultSection.classList.add('hidden');
            document.getElementById('paletteCard').style.display = 'block';
        });

        // 下载按钮
        document.getElementById('downloadPattern').addEventListener('click', () => {
            const { width, height, colorStats } = state.processResult;
            const pixels = state.isEditMode ? state.editPixels : state.processResult.pixels;
            // 使用专门的下载绘制函数
            const tempCanvas = document.createElement('canvas');
            drawPatternForDownload(tempCanvas, pixels, width, height, state.pixelSize, state.showGrid, state.showAxis, state.showGuideLines, state.guideInterval);
            downloadCanvas(tempCanvas, 'pattern.png');
        });

        document.getElementById('downloadPalette').addEventListener('click', () => {
            downloadCanvas(paletteCanvas, 'palette.png');
        });

        document.getElementById('downloadCombined').addEventListener('click', () => {
            const { width, height, colorStats } = state.processResult;
            const pixels = state.isEditMode ? state.editPixels : state.processResult.pixels;
            // 使用专门的下载绘制函数
            const tempCanvas = document.createElement('canvas');
            drawCombinedForDownload(tempCanvas, pixels, width, height, state.pixelSize, state.showGrid, colorStats, state.showAxis, state.showGuideLines, state.guideInterval);
            downloadCanvas(tempCanvas, 'combined.png');
        });

        // ==================== 编辑功能 ====================

        // 初始化编辑色板
        function initEditColorPalette() {
            colorPaletteEdit.innerHTML = colorBeans.map(bean => 
                `<div class="color-swatch-edit" data-id="${bean.id}" style="background-color: ${bean.hex};" title="${bean.id}">
                    <span class="color-id-small">${bean.id}</span>
                </div>`
            ).join('');
            
            // 添加点击事件
            document.querySelectorAll('.color-swatch-edit').forEach(swatch => {
                swatch.addEventListener('click', () => {
                    const id = swatch.dataset.id;
                    const bean = colorBeans.find(b => b.id === id);
                    if (bean) {
                        selectColor(bean);
                    }
                });
            });
        }

        // 选择颜色
        function selectColor(bean) {
            state.currentColorBean = bean;
            currentColorBox.style.backgroundColor = bean.hex;
            currentColorId.textContent = bean.id;
            
            // 更新选中状态
            document.querySelectorAll('.color-swatch-edit').forEach(swatch => {
                swatch.classList.toggle('selected', swatch.dataset.id === bean.id);
            });
        }

        // 进入编辑模式
        function enterEditMode() {
            state.isEditMode = true;
            editToolbar.classList.remove('hidden');
            editCanvasWrap.style.display = 'block';
            normalCanvasWrap.style.display = 'none';
            editCanvas.classList.remove('hidden');

            // 默认选中「拖动」工具
            state.currentTool = 'drag';
            dragTool.classList.add('active');
            brushTool.classList.remove('active');
            eyedropperTool.classList.remove('active');
            editCanvas.style.cursor = 'grab';
            
            // 复制当前像素数据用于编辑
            const { pixels, width, height } = state.processResult;
            state.editPixels = JSON.parse(JSON.stringify(pixels)); // 深拷贝
            
            // 设置默认颜色
            if (colorBeans.length > 0) {
                selectColor(colorBeans[0]);
            }
            
            // 初始化编辑色板
            initEditColorPalette();
            
            // 绘制编辑画布
            drawEditCanvas();

            // 保存编辑画布原始尺寸并应用当前缩放
            originalCanvasSizes[editCanvas.id] = {
                width: editCanvas.width,
                height: editCanvas.height
            };
            editCanvas.style.width = (editCanvas.width * currentZoom) + 'px';
            editCanvas.style.height = (editCanvas.height * currentZoom) + 'px';
        }

        // 退出编辑模式
        function exitEditMode() {
            state.isEditMode = false;
            editToolbar.classList.add('hidden');
            editCanvasWrap.style.display = 'none';
            normalCanvasWrap.style.display = '';
            editCanvas.classList.add('hidden');
            state.editPixels = null;
        }

        // 绘制编辑画布
        function drawEditCanvas() {
            const { width, height } = state.processResult;
            drawPatternForEdit(editCanvas, state.editPixels, width, height, state.pixelSize, state.showGrid, state.showAxis, state.showGuideLines, state.guideInterval);

            // 保存原始尺寸并应用当前缩放
            originalCanvasSizes[editCanvas.id] = {
                width: editCanvas.width,
                height: editCanvas.height
            };
            editCanvas.style.width = (editCanvas.width * currentZoom) + 'px';
            editCanvas.style.height = (editCanvas.height * currentZoom) + 'px';
        }

        // 专门用于编辑的绘制函数（大像素，清晰可见）
        function drawPatternForEdit(canvas, pixels, width, height, pixelSize, showGrid, showAxis, showGuideLines, guideInterval) {
            const ctx = canvas.getContext('2d');
            const axisMargin = showAxis ? Math.max(30, Math.min(60, pixelSize * 1.5)) : 0;
            canvas.width = width * pixelSize + axisMargin;
            canvas.height = height * pixelSize + axisMargin;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (showAxis) {
                ctx.fillStyle = '#333333';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const fontSize = Math.max(10, Math.min(16, pixelSize * 0.5));
                ctx.font = fontSize + 'px Arial';
                for (let x = 0; x < width; x++) {
                    ctx.fillText(
                        String(x + 1),
                        axisMargin + x * pixelSize + pixelSize / 2,
                        axisMargin / 2
                    );
                }
                for (let y = 0; y < height; y++) {
                    ctx.fillText(
                        String(y + 1),
                        axisMargin / 2,
                        axisMargin + y * pixelSize + pixelSize / 2
                    );
                }
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(axisMargin, 0);
                ctx.lineTo(axisMargin, canvas.height);
                ctx.moveTo(0, axisMargin);
                ctx.lineTo(canvas.width, axisMargin);
                ctx.stroke();
            }

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixel = pixels[y][x];
                    ctx.fillStyle = pixel.matchedBean.hex;
                    ctx.fillRect(
                        axisMargin + x * pixelSize,
                        axisMargin + y * pixelSize,
                        pixelSize,
                        pixelSize
                    );
                }
            }

            if (showGrid) {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.lineWidth = 1;
                for (let x = 0; x <= width; x++) {
                    ctx.beginPath();
                    ctx.moveTo(axisMargin + x * pixelSize, axisMargin);
                    ctx.lineTo(axisMargin + x * pixelSize, axisMargin + height * pixelSize);
                    ctx.stroke();
                }
                for (let y = 0; y <= height; y++) {
                    ctx.beginPath();
                    ctx.moveTo(axisMargin, axisMargin + y * pixelSize);
                    ctx.lineTo(axisMargin + width * pixelSize, axisMargin + y * pixelSize);
                    ctx.stroke();
                }
            }
            if (showGuideLines) {
                drawGuideLines(ctx, width, height, pixelSize, axisMargin, guideInterval);
            }

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixel = pixels[y][x];
                    const hex = pixel.matchedBean.hex;
                    const rgb = hexToRgb(hex);
                    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                    ctx.fillStyle = brightness > 128 ? '#000000' : '#ffffff';
                    const fontSize = Math.max(8, Math.min(12, pixelSize * 0.4));
                    ctx.font = fontSize + 'px Arial';
                    ctx.fillText(
                        pixel.matchedBean.id,
                        axisMargin + x * pixelSize + pixelSize / 2,
                        axisMargin + y * pixelSize + pixelSize / 2
                    );
                }
            }
        }

        // 处理编辑画布点击（fromLastCell=true 时对上一格→当前格做插值补格，快速拖动不漏格）
        let isDrawing = false;
        let lastBrushCell = null;

        function paintEditCell(x, y) {
            const { width, height } = state.processResult;
            if (x < 0 || x >= width || y < 0 || y >= height) return;
            if (state.currentTool === 'brush' && state.currentColorBean) {
                state.editPixels[y][x].matchedBean = state.currentColorBean;
            } else if (state.currentTool === 'eyedropper') {
                const bean = state.editPixels[y][x].matchedBean;
                selectColor(bean);
            }
        }

        // DDA 线性插值：把 (x0,y0)→(x1,y1) 经过的所有格子补齐
        function paintEditLine(x0, y0, x1, y1) {
            const dx = Math.abs(x1 - x0);
            const dy = Math.abs(y1 - y0);
            const steps = Math.max(dx, dy);
            if (steps === 0) {
                paintEditCell(x1, y1);
                return;
            }
            const xInc = (x1 - x0) / steps;
            const yInc = (y1 - y0) / steps;
            let cx = x0, cy = y0;
            for (let i = 0; i <= steps; i++) {
                paintEditCell(Math.round(cx), Math.round(cy));
                cx += xInc;
                cy += yInc;
            }
        }

        function handleEditCanvasClick(e, fromLastCell) {
            const rect = editCanvas.getBoundingClientRect();
            const axisMargin = state.showAxis ? Math.max(30, Math.min(60, state.pixelSize * 1.5)) : 0;
            const scaleX = editCanvas.width / rect.width;
            const scaleY = editCanvas.height / rect.height;
            const canvasX = (e.clientX - rect.left) * scaleX - axisMargin;
            const canvasY = (e.clientY - rect.top) * scaleY - axisMargin;
            const x = Math.floor(canvasX / state.pixelSize);
            const y = Math.floor(canvasY / state.pixelSize);

            if (fromLastCell && lastBrushCell) {
                paintEditLine(lastBrushCell.x, lastBrushCell.y, x, y);
            } else {
                paintEditCell(x, y);
            }
            lastBrushCell = { x, y };

            // 画笔修改后重绘；吸管取色无需重绘
            if (state.currentTool === 'brush') {
                drawEditCanvas();
            }
        }

        // 应用编辑
        function applyEdit() {
            // 更新 processResult 中的像素
            state.processResult.pixels = state.editPixels;
            
            // 重新计算颜色统计
            const colorStats = new Map();
            const { pixels, width, height } = state.processResult;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const id = pixels[y][x].matchedBean.id;
                    colorStats.set(id, (colorStats.get(id) || 0) + 1);
                }
            }
            state.processResult.colorStats = colorStats;
            
            // 退出编辑模式并更新显示
            exitEditMode();
            updateResultDisplay();
            updateStats();
        }

        // 编辑模式按钮事件
        editModeBtn.addEventListener('click', () => {
            if (state.isEditMode) {
                exitEditMode();
            } else {
                enterEditMode();
            }
        });

        // 工具切换（拖动 / 画笔 / 吸管）
        dragTool.addEventListener('click', () => {
            state.currentTool = 'drag';
            dragTool.classList.add('active');
            brushTool.classList.remove('active');
            eyedropperTool.classList.remove('active');
            editCanvas.style.cursor = 'grab';
        });

        brushTool.addEventListener('click', () => {
            state.currentTool = 'brush';
            brushTool.classList.add('active');
            dragTool.classList.remove('active');
            eyedropperTool.classList.remove('active');
            editCanvas.style.cursor = 'crosshair';
        });

        eyedropperTool.addEventListener('click', () => {
            state.currentTool = 'eyedropper';
            eyedropperTool.classList.add('active');
            dragTool.classList.remove('active');
            brushTool.classList.remove('active');
            editCanvas.style.cursor = 'pointer';
        });

        // 编辑画布事件
        // 画笔/吸管：按住连续操作（自动插值补格，快速拖动不漏格）；拖动工具：交给容器拖动
        editCanvas.addEventListener('mousedown', (e) => {
            if (state.currentTool === 'brush' || state.currentTool === 'eyedropper') {
                e.stopPropagation(); // 阻止冒泡触发容器拖动
                isDrawing = true;
                lastBrushCell = null;
                handleEditCanvasClick(e, false);
            }
        });

        editCanvas.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;
            if (state.currentTool === 'brush' || state.currentTool === 'eyedropper') {
                handleEditCanvasClick(e, true);
            }
        });

        editCanvas.addEventListener('mouseup', () => {
            isDrawing = false;
            lastBrushCell = null;
        });

        editCanvas.addEventListener('mouseleave', () => {
            isDrawing = false;
            lastBrushCell = null;
        });

        // 应用更改和取消
        applyEditBtn.addEventListener('click', applyEdit);
        cancelEditBtn.addEventListener('click', exitEditMode);

        // ==================== 缩放控制 ====================
        let currentZoom = 1; // 当前缩放比例 (1 = 100%)
        let originalCanvasSizes = {}; // 保存原始尺寸

        // 缩放函数
        function updateZoom(newZoom) {
            // 限制缩放范围 25% - 300%
            currentZoom = Math.max(0.25, Math.min(3, newZoom));
            zoomDisplay.textContent = Math.round(currentZoom * 100) + '%';
            
            // 应用缩放到所有canvas
            const canvases = [patternCanvas, editCanvas, paletteCanvas, combinedCanvas];
            canvases.forEach(canvas => {
                if (originalCanvasSizes[canvas.id]) {
                    const origWidth = originalCanvasSizes[canvas.id].width;
                    const origHeight = originalCanvasSizes[canvas.id].height;
                    canvas.style.width = (origWidth * currentZoom) + 'px';
                    canvas.style.height = (origHeight * currentZoom) + 'px';
                }
            });
        }

        function zoomIn() {
            updateZoom(currentZoom + 0.25);
        }

        function zoomOut() {
            updateZoom(currentZoom - 0.25);
        }

        function zoomReset() {
            updateZoom(1);
        }

        function zoomFit() {
            // 获取容器和canvas的尺寸
            const container = document.querySelector('.result-canvas-container');
            const activeCanvas = getActiveCanvas();
            
            if (!activeCanvas || activeCanvas.width === 0) {
                return;
            }
            
            // 获取容器可用尺寸（减去padding）
            const containerWidth = container.clientWidth - 60; 
            const containerHeight = Math.max(400, window.innerHeight * 0.5) - 40; 
            
            const canvasWidth = activeCanvas.width;
            const canvasHeight = activeCanvas.height;
            
            // 计算适应缩放比例
            const scaleX = containerWidth / canvasWidth;
            const scaleY = containerHeight / canvasHeight;
            const fitScale = Math.min(scaleX, scaleY, 2); // 最大2倍
            
            updateZoom(fitScale);
        }

        function getActiveCanvas() {
            // 获取当前可见的canvas
            const canvases = [patternCanvas, editCanvas, paletteCanvas, combinedCanvas];
            for (const canvas of canvases) {
                if (!canvas.classList.contains('hidden')) {
                    return canvas;
                }
            }
            return patternCanvas;
        }

        // 保存原始canvas尺寸
        function saveOriginalCanvasSizes() {
            const canvases = [patternCanvas, editCanvas, paletteCanvas, combinedCanvas];
            canvases.forEach(canvas => {
                if (canvas.width > 0 && canvas.height > 0) {
                    originalCanvasSizes[canvas.id] = {
                        width: canvas.width,
                        height: canvas.height
                    };
                }
            });
        }

        // 绑定缩放按钮事件
        document.getElementById('zoomInBtn').addEventListener('click', zoomIn);
        document.getElementById('zoomOutBtn').addEventListener('click', zoomOut);
        document.getElementById('zoomResetBtn').addEventListener('click', zoomReset);
        document.getElementById('zoomFitBtn').addEventListener('click', zoomFit);

        // 鼠标滚轮缩放 + 拖动（普通容器 和 编辑容器 都绑定；隐藏容器不会收到事件，安全）
        let isDragging = false;
        let startX, startY, scrollLeft, scrollTop;
        const canvasContainers = document.querySelectorAll('.result-canvas-container');
        canvasContainers.forEach(canvasContainer => {
            canvasContainer.addEventListener('wheel', (e) => {
                // 只有当有图纸时才允许缩放
                if (!state.processResult) return;

                e.preventDefault(); // 防止页面滚动

                // 根据滚轮方向缩放
                if (e.deltaY < 0) {
                    // 向上滚动 → 放大
                    updateZoom(currentZoom + 0.1);
                } else {
                    // 向下滚动 → 缩小
                    updateZoom(currentZoom - 0.1);
                }
            }, { passive: false });

            canvasContainer.addEventListener('mousedown', (e) => {
                if (!state.processResult) return;
                // 编辑模式下仅「拖动」工具允许拖动图纸，画笔/吸管禁用（改用滚动条）
                if (state.isEditMode && state.currentTool !== 'drag') return;
                isDragging = true;
                startX = e.pageX - canvasContainer.offsetLeft;
                startY = e.pageY - canvasContainer.offsetTop;
                scrollLeft = canvasContainer.scrollLeft;
                scrollTop = canvasContainer.scrollTop;
            });

            canvasContainer.addEventListener('mouseleave', () => {
                isDragging = false;
            });

            canvasContainer.addEventListener('mouseup', () => {
                isDragging = false;
            });

            canvasContainer.addEventListener('mousemove', (e) => {
                if (!isDragging || !state.processResult) return;
                e.preventDefault();
                const x = e.pageX - canvasContainer.offsetLeft;
                const y = e.pageY - canvasContainer.offsetTop;
                const walkX = (x - startX) * 2; // 滚动速度
                const walkY = (y - startY) * 2;
                canvasContainer.scrollLeft = scrollLeft - walkX;
                canvasContainer.scrollTop = scrollTop - walkY;
            });
        });

        // 保存CHIBI头像
        saveChibiBtn.addEventListener('click', () => {
            if (state.chibiImageDataUrl) {
                // 创建临时canvas绘制完整图片
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                const img = new Image();
                img.onload = () => {
                    tempCanvas.width = img.width;
                    tempCanvas.height = img.height;
                    tempCtx.drawImage(img, 0, 0);
                    downloadCanvas(tempCanvas, 'chibi-avatar.png');
                };
                img.src = state.chibiImageDataUrl;
            } else {
                showError('没有可保存的CHIBI头像');
            }
        });

        // 修改tab切换，切换时自动适应
        const tabButtons = document.querySelectorAll('.tab');
        tabButtons.forEach(tab => {
            tab.addEventListener('click', () => {
                tabButtons.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tabName = tab.dataset.tab;
                patternCanvas.classList.toggle('hidden', tabName !== 'pattern');
                paletteCanvas.classList.toggle('hidden', tabName !== 'palette');
                combinedCanvas.classList.toggle('hidden', tabName !== 'combined');
                // 非图纸tab下自动退出编辑模式
                if (tabName !== 'pattern' && state.isEditMode) {
                    exitEditMode();
                }
                updateResultDisplay();
            });
        });

        // 修改updateResultDisplay，保存尺寸并应用缩放
        const originalUpdateResultDisplay = updateResultDisplay;
        updateResultDisplay = function() {
            originalUpdateResultDisplay();
            saveOriginalCanvasSizes();
            // 如果是初始状态，尝试自适应
            if (currentZoom === 1 && state.processResult) {
                setTimeout(() => {
                    zoomFit();
                }, 50);
            } else {
                // 保持当前缩放比例
                updateZoom(currentZoom);
            }
        };

        // 修改showResult
        const originalShowResult = showResult;
        showResult = function() {
            originalShowResult();
            // 重置缩放为1，等canvas绘制完成后再自适应
            currentZoom = 1;
        };

        // 初始化
        initColorPalette();
    
