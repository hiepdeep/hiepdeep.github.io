console.clear();
console.log("Gerber Viewer Engine - Dựng vào ngày 17/09/2026 bởi HiepDz");
// ==========================================
// 1. BỘ CẤU HÌNH ĐƠN VỊ VÀ BIẾN TOÀN CỤC
// ==========================================
const UNITS = {
    mm: {
        scale: 1.0,
        decimals: 4,
        label: 'mm'
    },
    cm: {
        scale: 0.1,
        decimals: 4,
        label: 'cm'
    },
    inch: {
        scale: 1 / 25.4,
        decimals: 5,
        label: 'in'
    },
    mils: {
        scale: 1000 / 25.4,
        decimals: 2,
        label: 'mil'
    },
    micron: {
        scale: 1000.0,
        decimals: 2,
        label: 'µm'
    }
};
let currentUnit = 'mm';
const SCREEN_PHYSICAL_PX_PER_MM = 96 / 25.4;
const PRESET_COLORS = ['#00FF66', '#FF3366', '#33CCFF', '#FFCC00', '#CC66FF', '#FF9933'];
// Biến quản lý Gerber & View
let layers = [];
let activeTool = 'MOVE'; // 'MOVE', 'SELECT_POINT', 'SELECT_AREA', 'MEASURE'
let zoom = SCREEN_PHYSICAL_PX_PER_MM;
let panX = 0,
    panY = 0;
// Trạng thái các tương tác đồ họa
let pinnedPoint = null;
let measureStart = null,
    measureEnd = null;
let isBoxSelecting = false;
let boxStartWorld = null,
    boxEndWorld = null;
let selectedGeometries = [];
let calculatedCentroid = null;
let currentSelectedBounds = null;
let isDragging = false;
let dragStartX = 0,
    dragStartY = 0;
let mouseWorld = {
    x: 0,
    y: 0
};
// ==========================================
// 2. PARSER GERBER (RS-274X PARSER ENGINE)
// ==========================================
class GerberParser {
    static parse(text, fileName) {
        let unitScale = 1.0;
        let decX = 4,
            decY = 4;
        if (/%MOIN\*%/i.test(text)) unitScale = 25.4;
        else if (/%MOMM\*%/i.test(text)) unitScale = 1.0;
        const fsMatch = text.match(/%FS[LA]*X(\d)(\d)Y(\d)(\d)\*%/i);
        if (fsMatch) {
            decX = parseInt(fsMatch[2], 10);
            decY = parseInt(fsMatch[4], 10);
        }
        const macros = {};
        const amRegex = /%AM([A-Za-z0-9_]+)\*([\s\S]*?)%/g;
        let amMatch;
        while ((amMatch = amRegex.exec(text)) !== null) {
            const macroName = amMatch[1];
            const body = amMatch[2];
            const primitives = GerberParser.parseMacroBody(body, unitScale);
            macros[macroName] = primitives;
            if (macroName.startsWith('D')) macros[macroName.substring(1)] = primitives;
            else macros['D' + macroName] = primitives;
        }
        const apertures = {};
        const addRegex = /%ADD(\d+)([A-Za-z0-9_]+)(?:,([^%*]+))?\*%/g;
        let addMatch;
        while ((addMatch = addRegex.exec(text)) !== null) {
            const id = 'D' + addMatch[1];
            const typeOrMacro = addMatch[2].toUpperCase();
            const paramStr = addMatch[3];
            if (['C', 'R', 'O', 'P'].includes(typeOrMacro)) {
                const dimsRaw = paramStr ? paramStr.split('X').map(v => parseFloat(v)) : [0.1];
                let dims = [];
                if (typeOrMacro === 'C') {
                    dims = [dimsRaw[0] * unitScale];
                } else if (typeOrMacro === 'R' || typeOrMacro === 'O') {
                    dims = [dimsRaw[0] * unitScale, (dimsRaw[1] || dimsRaw[0]) * unitScale];
                } else if (typeOrMacro === 'P') {
                    dims = [dimsRaw[0] * unitScale, dimsRaw[1] || 4, dimsRaw[2] || 0, dimsRaw[3] ? dimsRaw[3] * unitScale : 0];
                }
                apertures[id] = {
                    type: typeOrMacro,
                    dims
                };
            } else {
                const prims = macros[typeOrMacro] || macros[addMatch[2]] || [];
                apertures[id] = {
                    type: 'MACRO',
                    macroName: typeOrMacro,
                    primitives: prims,
                    dims: [0.2, 0.2]
                };
            }
        }
        const parseCoord = (str, dec) => {
            if (!str) return null;
            const val = parseInt(str, 10);
            if (isNaN(val)) return null;
            return (val / Math.pow(10, dec)) * unitScale;
        };
        const linearizeArc = (x1, y1, x2, y2, offI, offJ, isCCW) => {
            const cx = x1 + offI;
            const cy = y1 + offJ;
            const r = Math.hypot(offI, offJ);
            if (r < 1e-7) return [{
                x: x2,
                y: y2
            }];
            let startAngle = Math.atan2(y1 - cy, x1 - cx);
            let endAngle = Math.atan2(y2 - cy, x2 - cx);
            const distEndStart = Math.hypot(x2 - x1, y2 - y1);
            let delta = 0;
            if (distEndStart < 1e-6) {
                delta = isCCW ? 2 * Math.PI : -2 * Math.PI;
            } else {
                if (isCCW) {
                    while (endAngle <= startAngle) endAngle += 2 * Math.PI;
                    delta = endAngle - startAngle;
                } else {
                    while (endAngle >= startAngle) endAngle -= 2 * Math.PI;
                    delta = endAngle - startAngle;
                }
            }
            const steps = Math.max(8, Math.ceil(Math.abs(delta) / (Math.PI / 18)));
            const points = [];
            for (let i = 1; i <= steps; i++) {
                const ang = startAngle + (delta * i) / steps;
                points.push({
                    x: cx + r * Math.cos(ang),
                    y: cy + r * Math.sin(ang)
                });
            }
            return points;
        };
        const items = [];
        let currentX = 0,
            currentY = 0;
        let currentAperture = null;
        let interpMode = 'G01';
        let inRegion = false;
        let regionContours = [];
        let currentContour = [];
        let currentD = '1';
        const cleanText = text.replace(/[\r\n]/g, '');
        const blocks = cleanText.split('*');
        for (let block of blocks) {
            block = block.trim();
            if (!block || block.startsWith('%') || block.startsWith('G04')) continue;
            if (block.includes('G36')) {
                inRegion = true;
                regionContours = [];
                currentContour = [];
            }
            if (/G0?1(?!\d)/i.test(block)) interpMode = 'G01';
            else if (/G0?2(?!\d)/i.test(block)) interpMode = 'G02';
            else if (/G0?3(?!\d)/i.test(block)) interpMode = 'G03';
            const g54Match = block.match(/G54\s*D(\d+)/i);
            if (g54Match && apertures['D' + g54Match[1]]) currentAperture = apertures['D' + g54Match[1]];
            const apMatch = block.match(/(?:^|[^G])D([1-9]\d+)/i);
            if (apMatch && apertures['D' + apMatch[1]]) currentAperture = apertures['D' + apMatch[1]];
            const xMatch = block.match(/X([+-]?\d+)/i);
            const yMatch = block.match(/Y([+-]?\d+)/i);
            const iMatch = block.match(/I([+-]?\d+)/i);
            const jMatch = block.match(/J([+-]?\d+)/i);
            const dMatch = block.match(/D0?([123])(?!\d)/i);
            let newX = currentX,
                newY = currentY;
            if (xMatch) {
                const vx = parseCoord(xMatch[1], decX);
                if (vx !== null) newX = vx;
            }
            if (yMatch) {
                const vy = parseCoord(yMatch[1], decY);
                if (vy !== null) newY = vy;
            }
            const offI = iMatch ? (parseCoord(iMatch[1], decX) || 0) : 0;
            const offJ = jMatch ? (parseCoord(jMatch[1], decY) || 0) : 0;
            let op = dMatch ? dMatch[1] : null;
            if (op === '1' || op === '2') currentD = op;
            else if (!op && (xMatch || yMatch)) op = currentD;
            if (op === '2') {
                currentX = newX;
                currentY = newY;
                if (inRegion) {
                    if (currentContour.length > 0) {
                        regionContours.push(currentContour);
                        currentContour = [];
                    }
                    currentContour.push({
                        x: currentX,
                        y: currentY
                    });
                }
            } else if (op === '1') {
                if (interpMode === 'G01') {
                    if (inRegion) currentContour.push({
                        x: newX,
                        y: newY
                    });
                    else items.push({
                        type: 'line',
                        x1: currentX,
                        y1: currentY,
                        x2: newX,
                        y2: newY,
                        width: currentAperture ? (currentAperture.dims[0] || 0.1) : 0.1
                    });
                } else if (interpMode === 'G02' || interpMode === 'G03') {
                    const arcPts = linearizeArc(currentX, currentY, newX, newY, offI, offJ, interpMode === 'G03');
                    if (inRegion) arcPts.forEach(pt => currentContour.push(pt));
                    else {
                        const width = currentAperture ? (currentAperture.dims[0] || 0.1) : 0.1;
                        let lastPt = {
                            x: currentX,
                            y: currentY
                        };
                        arcPts.forEach(pt => {
                            items.push({
                                type: 'line',
                                x1: lastPt.x,
                                y1: lastPt.y,
                                x2: pt.x,
                                y2: pt.y,
                                width
                            });
                            lastPt = pt;
                        });
                    }
                }
                currentX = newX;
                currentY = newY;
            } else if (op === '3') {
                currentX = newX;
                currentY = newY;
                if (currentAperture && !inRegion) {
                    items.push({
                        type: 'pad',
                        shape: currentAperture.type,
                        dims: currentAperture.dims,
                        macroName: currentAperture.macroName,
                        primitives: currentAperture.primitives,
                        x: currentX,
                        y: currentY
                    });
                }
            }
            if (block.includes('G37')) {
                inRegion = false;
                if (currentContour.length > 0) regionContours.push(currentContour);
                if (regionContours.length > 0) items.push({
                    type: 'region',
                    contours: regionContours
                });
                regionContours = [];
                currentContour = [];
            }
        }
        return items;
    }
    static parseMacroBody(body, unitScale) {
        const primitives = [];
        const lines = body.split('*');
        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('0')) continue;
            const tokens = line.split(/[\s,]+/).filter(t => t.length > 0).map(t => parseFloat(t));
            if (tokens.length < 2) continue;
            const code = tokens[0],
                exposure = tokens[1];
            if (code === 1 && tokens.length >= 5) {
                primitives.push({
                    type: 'circle',
                    exposure,
                    diam: tokens[2] * unitScale,
                    cx: tokens[3] * unitScale,
                    cy: tokens[4] * unitScale
                });
            } else if (code === 20 && tokens.length >= 7) {
                primitives.push({
                    type: 'line',
                    exposure,
                    width: tokens[2] * unitScale,
                    x1: tokens[3] * unitScale,
                    y1: tokens[4] * unitScale,
                    x2: tokens[5] * unitScale,
                    y2: tokens[6] * unitScale,
                    rot: tokens[7] || 0
                });
            } else if (code === 21 && tokens.length >= 6) {
                primitives.push({
                    type: 'rect',
                    exposure,
                    w: tokens[2] * unitScale,
                    h: tokens[3] * unitScale,
                    cx: tokens[4] * unitScale,
                    cy: tokens[5] * unitScale,
                    rot: tokens[6] || 0
                });
            } else if (code === 4) {
                let rot = 0,
                    endIdx = tokens.length;
                if ((tokens.length - 3) % 2 === 1) {
                    rot = tokens[tokens.length - 1];
                    endIdx = tokens.length - 1;
                }
                const pts = [];
                for (let i = 3; i < endIdx; i += 2) {
                    if (i + 1 < endIdx) pts.push({
                        x: tokens[i] * unitScale,
                        y: tokens[i + 1] * unitScale
                    });
                }
                primitives.push({
                    type: 'polygon',
                    exposure,
                    points: pts,
                    rot
                });
            }
        }
        return primitives;
    }
}
// ==========================================
// 3. TOÁN HỌC & HÌNH HỌC TÍNH TOÁN
// ==========================================
function toUnit(valInMM) {
    return valInMM * UNITS[currentUnit].scale;
}
function formatUnitVal(valInMM) {
    if (valInMM === null || valInMM === undefined || isNaN(valInMM)) return `0${UNITS[currentUnit].label}`;
    return `${toUnit(valInMM).toFixed(UNITS[currentUnit].decimals)}${UNITS[currentUnit].label}`;
}
function getGeometryCenter(item) {
    if (item.type === 'pad') return {
        x: item.x,
        y: item.y,
        label: `Pad ${item.shape}`,
        item
    };
    if (item.type === 'line') return {
        x: (item.x1 + item.x2) / 2,
        y: (item.y1 + item.y2) / 2,
        label: 'Track',
        item
    };
    if (item.type === 'region' && item.contours && item.contours.length > 0) {
        let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
        item.contours.forEach(c => c.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }));
        return {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2,
            label: 'Region',
            item
        };
    }
    return null;
}
function getItemBoundingBox(item) {
    if (item.type === 'pad') {
        if (item.shape === 'MACRO' && item.primitives && item.primitives.length > 0) {
            let minX = Infinity,
                maxX = -Infinity,
                minY = Infinity,
                maxY = -Infinity;
            item.primitives.forEach(p => {
                if (p.type === 'circle') {
                    minX = Math.min(minX, item.x + p.cx - p.diam / 2);
                    maxX = Math.max(maxX, item.x + p.cx + p.diam / 2);
                    minY = Math.min(minY, item.y + p.cy - p.diam / 2);
                    maxY = Math.max(maxY, item.y + p.cy + p.diam / 2);
                } else if (p.type === 'line') {
                    const r = p.width / 2;
                    minX = Math.min(minX, item.x + Math.min(p.x1, p.x2) - r);
                    maxX = Math.max(maxX, item.x + Math.max(p.x1, p.x2) + r);
                    minY = Math.min(minY, item.y + Math.min(p.y1, p.y2) - r);
                    maxY = Math.max(maxY, item.y + Math.max(p.y1, p.y2) + r);
                } else if (p.type === 'rect') {
                    const w2 = p.w / 2,
                        h2 = p.h / 2;
                    minX = Math.min(minX, item.x + p.cx - w2);
                    maxX = Math.max(maxX, item.x + p.cx + w2);
                    minY = Math.min(minY, item.y + p.cy - h2);
                    maxY = Math.max(maxY, item.y + p.cy + h2);
                } else if (p.type === 'polygon' && p.points) {
                    p.points.forEach(pt => {
                        minX = Math.min(minX, item.x + pt.x);
                        maxX = Math.max(maxX, item.x + pt.x);
                        minY = Math.min(minY, item.y + pt.y);
                        maxY = Math.max(maxY, item.y + pt.y);
                    });
                }
            });
            if (isFinite(minX)) return {
                minX,
                maxX,
                minY,
                maxY
            };
        }
        const w = item.dims ? (item.dims[0] || 0.2) : 0.2;
        const h = item.dims ? (item.dims[1] || w) : w;
        return {
            minX: item.x - w / 2,
            maxX: item.x + w / 2,
            minY: item.y - h / 2,
            maxY: item.y + h / 2
        };
    } else if (item.type === 'line') {
        const r = (item.width || 0.1) / 2;
        return {
            minX: Math.min(item.x1, item.x2) - r,
            maxX: Math.max(item.x1, item.x2) + r,
            minY: Math.min(item.y1, item.y2) - r,
            maxY: Math.max(item.y1, item.y2) + r
        };
    } else if (item.type === 'region' && item.contours && item.contours.length > 0) {
        let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
        item.contours.forEach(c => c.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }));
        return {
            minX,
            maxX,
            minY,
            maxY
        };
    }
    return null;
}
// Kiểm tra item có đang được bật hiển thị hay không
function isItemVisible(item) {
    const displayPads = document.getElementById('displayPads');
    const displayTracks = document.getElementById('displayTracks');
    const displayRegions = document.getElementById('displayRegions');
    if (item.type === 'pad' && displayPads && !displayPads.checked) return false;
    if (item.type === 'line' && displayTracks && !displayTracks.checked) return false;
    if (item.type === 'region' && displayRegions && !displayRegions.checked) return false;
    return true;
}
function findNearestGeometry(wx, wy) {
    const maxDist = 25 / zoom;
    let closestItem = null,
        closestCenter = null;
    let minDist = maxDist;
    for (const layer of layers) {
        if (!layer.visible) continue;
        for (const item of layer.items) {
            if (!isItemVisible(item)) continue;
            const center = getGeometryCenter(item);
            if (center) {
                const dist = Math.hypot(center.x - wx, center.y - wy);
                if (dist < minDist) {
                    minDist = dist;
                    closestItem = item;
                    closestCenter = center;
                }
            }
        }
    }
    return {
        item: closestItem,
        center: closestCenter
    };
}
// Hàm bổ trợ: Bỏ chọn tất cả các vùng/điểm đang chọn
function clearAllSelections() {
    pinnedPoint = null;
    measureStart = null;
    measureEnd = null;
    selectedGeometries = [];
    calculatedCentroid = null;
    currentSelectedBounds = null;
    boxStartWorld = null;
    boxEndWorld = null;
    isBoxSelecting = false;
    const btnMovetozero = document.getElementById('btnMovetozero');
    if (btnMovetozero) btnMovetozero.classList.add('not-allowed');
}
// ==========================================
// 4. KẾT NỐI DOM VÀ QUẢN LÝ GIAO DIỆN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Khởi tạo Canvas linh hoạt
    const container = document.getElementById('canvasContainer');
    const canvas = document.createElement('canvas');
    canvas.id = 'gerberCanvas';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    // DOM Elements
    const importInput = document.getElementById('importGerber');
    const layerList = document.getElementById('layerList');
    const lblLayerCount = document.getElementById('lblLayerCount');
    // Checkbox cài đặt
    const displayGrid = document.getElementById('displayGrid');
    const displayOrigin = document.getElementById('displayOrigin');
    const displayPads = document.getElementById('displayPads');
    const displayTracks = document.getElementById('displayTracks');
    const displayRegions = document.getElementById('displayRegions');
    // Nút công cụ
    const btnMove = document.getElementById('btnMove');
    const btnSelectpoint = document.getElementById('btnSelectpoint');
    const btnSelectarea = document.getElementById('btnSelectarea');
    const btnMeasure = document.getElementById('btnMeasure');
    const btnUnselect = document.getElementById('btnUnselect');
    const btnMovetozero = document.getElementById('btnMovetozero');
    // Bảng trạng thái
    const boxArea = document.getElementById('boxArea');
    const boxMeasure = document.getElementById('boxMeasure');
    // Text thông tin
    const realtimeX = document.getElementById('realtimeX');
    const realtimeY = document.getElementById('realtimeY');
    const pointX = document.getElementById('pointX');
    const pointY = document.getElementById('pointY');
    const pointW = document.getElementById('pointW');
    const pointH = document.getElementById('pointH');
    const measureX1 = document.getElementById('measureX1');
    const measureY1 = document.getElementById('measureY1');
    const measureX2 = document.getElementById('measureX2');
    const measureY2 = document.getElementById('measureY2');
    const measureW = document.getElementById('measureW');
    function resizeCanvas() {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        requestAnimationFrame(draw);
    }
    window.addEventListener('resize', resizeCanvas);
    function worldToScreen(wx, wy) {
        return {
            x: canvas.width / 2 + panX + wx * zoom,
            y: canvas.height / 2 + panY - wy * zoom
        };
    }
    function screenToWorld(sx, sy) {
        return {
            x: (sx - canvas.width / 2 - panX) / zoom,
            y: (canvas.height / 2 + panY - sy) / zoom
        };
    }
    // ==========================================
    // 5. TẢI VÀ QUẢN LÝ LAYER GERBER
    // ==========================================
    function loadFiles(files) {
        const fileArray = Array.from(files);
        if (!fileArray.length) return;
        fileArray.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const items = GerberParser.parse(event.target.result, file.name);
                const color = PRESET_COLORS[layers.length % PRESET_COLORS.length];
                layers.push({
                    id: Date.now() + Math.random(),
                    name: file.name,
                    visible: true,
                    color,
                    items
                });
                updateSidebar();
                if (layers.length === 1) fitView();
                else requestAnimationFrame(draw);
            };
            reader.readAsText(file);
        });
    }
    importInput.addEventListener('change', (e) => {
        loadFiles(e.target.files);
        importInput.value = '';
    });
    layerList.addEventListener('dragover', (e) => e.preventDefault());
    layerList.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files.length > 0) loadFiles(e.dataTransfer.files);
    });
    function updateSidebar() {
        lblLayerCount.textContent = layers.length;
        if (layers.length === 0) {
            layerList.innerHTML = `<span class="empty-state">Chưa có layer nào.<br>Hãy kéo thả file hoặc bấm "Mở file Gerber".</span>`;
            return;
        }
        layerList.innerHTML = '';
        layers.forEach((layer, idx) => {
            const itemEl = document.createElement('div');
            itemEl.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:8px; background:#1a1a20; padding:6px; border-radius:4px; border:1px solid #262630;';
            itemEl.innerHTML = `
                <input type="checkbox" ${layer.visible ? 'checked' : ''} style="accent-color:#0284c7; cursor:pointer;">
                <input type="color" value="${layer.color}" style="width:20px; height:20px; border:none; background:none; cursor:pointer;">
                <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; color:#e5e7eb;" title="${layer.name}">${layer.name}</span>
                <button class="del-layer" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold;">✕</button>
            `;
            const chk = itemEl.querySelector('input[type="checkbox"]');
            const col = itemEl.querySelector('input[type="color"]');
            const del = itemEl.querySelector('.del-layer');
            chk.addEventListener('change', (e) => {
                layers[idx].visible = e.target.checked;
                requestAnimationFrame(draw);
            });
            col.addEventListener('input', (e) => {
                layers[idx].color = e.target.value;
                requestAnimationFrame(draw);
            });
            del.addEventListener('click', () => {
                layers.splice(idx, 1);
                updateSidebar();
                requestAnimationFrame(draw);
            });
            layerList.appendChild(itemEl);
        });
    }
    function getOverallBoundingBox() {
        let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
        let hasItems = false;
        layers.forEach(l => {
            if (!l.visible) return;
            l.items.forEach(it => {
                if (!isItemVisible(it)) return;
                const bbox = getItemBoundingBox(it);
                if (bbox) {
                    hasItems = true;
                    if (bbox.minX < minX) minX = bbox.minX;
                    if (bbox.maxX > maxX) maxX = bbox.maxX;
                    if (bbox.minY < minY) minY = bbox.minY;
                    if (bbox.maxY > maxY) maxY = bbox.maxY;
                }
            });
        });
        return hasItems ? {
            minX,
            maxX,
            minY,
            maxY
        } : null;
    }
    function fitView() {
        const bbox = getOverallBoundingBox();
        if (!bbox) {
            zoom = SCREEN_PHYSICAL_PX_PER_MM;
            panX = 0;
            panY = 0;
        } else {
            const w = Math.max(bbox.maxX - bbox.minX, 1);
            const h = Math.max(bbox.maxY - bbox.minY, 1);
            const cx = (bbox.minX + bbox.maxX) / 2;
            const cy = (bbox.minY + bbox.maxY) / 2;
            const scaleX = (canvas.width * 0.8) / w;
            const scaleY = (canvas.height * 0.8) / h;
            zoom = Math.min(scaleX, scaleY);
            panX = -cx * zoom;
            panY = cy * zoom;
        }
        updateZoomLabel();
        requestAnimationFrame(draw);
    }
    // ==========================================
    // 6. CHUYỂN ĐỔI TOOL & ĐIỀU KHIỂN TRẠNG THÁI NÚT
    // ==========================================
    function setTool(tool) {
        activeTool = tool;
        // Tự động bỏ vùng chọn khi chuyển về chế độ Move
        if (tool === 'MOVE') {
            clearAllSelections();
        }
        btnMove.classList.toggle('active', tool === 'MOVE');
        btnSelectpoint.classList.toggle('active', tool === 'SELECT_POINT');
        btnSelectarea.classList.toggle('active', tool === 'SELECT_AREA');
        btnMeasure.classList.toggle('active', tool === 'MEASURE');
        if (tool !== 'MOVE') {
            btnUnselect.classList.remove('not-allowed');
        } else {
            btnUnselect.classList.add('not-allowed');
        }
        if (tool === 'SELECT_AREA' && currentSelectedBounds) {
            btnMovetozero.classList.remove('not-allowed');
        } else {
            btnMovetozero.classList.add('not-allowed');
        }
        if (tool === 'SELECT_POINT' || tool === 'SELECT_AREA') {
            boxArea.style.display = 'flex';
            boxMeasure.style.display = 'none';
        } else if (tool === 'MEASURE') {
            boxArea.style.display = 'none';
            boxMeasure.style.display = 'flex';
        } else {
            boxArea.style.display = 'none';
            boxMeasure.style.display = 'none';
        }
        canvas.style.cursor = tool === 'MOVE' ? 'grab' : 'crosshair';
        updateInfoUI();
        requestAnimationFrame(draw);
    }
    btnMove.addEventListener('click', () => setTool('MOVE'));
    btnSelectpoint.addEventListener('click', () => setTool('SELECT_POINT'));
    btnSelectarea.addEventListener('click', () => setTool('SELECT_AREA'));
    btnMeasure.addEventListener('click', () => setTool('MEASURE'));
    btnUnselect.addEventListener('click', () => {
        if (btnUnselect.classList.contains('not-allowed')) return;
        clearAllSelections();
        updateInfoUI();
        requestAnimationFrame(draw);
    });
    btnMovetozero.addEventListener('click', () => {
        if (btnMovetozero.classList.contains('not-allowed')) return;
        if (!currentSelectedBounds) return;
        const dx = -currentSelectedBounds.minX;
        const dy = -currentSelectedBounds.minY;
        layers.forEach(l => {
            l.items.forEach(it => {
                if (it.x !== undefined) it.x += dx;
                if (it.y !== undefined) it.y += dy;
                if (it.x1 !== undefined) {
                    it.x1 += dx;
                    it.x2 += dx;
                    it.y1 += dy;
                    it.y2 += dy;
                }
                if (it.type === 'region' && it.contours) {
                    it.contours.forEach(c => c.forEach(p => {
                        p.x += dx;
                        p.y += dy;
                    }));
                }
            });
        });
        if (currentSelectedBounds) {
            currentSelectedBounds.minX += dx;
            currentSelectedBounds.maxX += dx;
            currentSelectedBounds.minY += dy;
            currentSelectedBounds.maxY += dy;
            if (boxStartWorld && boxEndWorld) {
                boxStartWorld.x += dx;
                boxStartWorld.y += dy;
                boxEndWorld.x += dx;
                boxEndWorld.y += dy;
            }
            if (calculatedCentroid) {
                calculatedCentroid.x += dx;
                calculatedCentroid.y += dy;
            }
        }
        fitView();
    });
    // ==========================================
    // 7. RENDER ĐỒ HỌA TRÊN CANVAS
    // ==========================================
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (displayGrid.checked) drawGrid();
        if (displayOrigin.checked) drawOrigin();
        ctx.save();
        ctx.translate(canvas.width / 2 + panX, canvas.height / 2 + panY);
        ctx.scale(zoom, -zoom);
        layers.forEach(layer => {
            if (!layer.visible) return;
            ctx.fillStyle = layer.color;
            ctx.strokeStyle = layer.color;
            layer.items.forEach(item => {
                if (item.type === 'line' && displayTracks.checked) {
                    ctx.lineWidth = item.width || 0.1;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(item.x1, item.y1);
                    ctx.lineTo(item.x2, item.y2);
                    ctx.stroke();
                } else if (item.type === 'pad' && displayPads.checked) {
                    drawPadShape(ctx, item);
                } else if (item.type === 'region' && displayRegions.checked) {
                    ctx.beginPath();
                    item.contours.forEach(contour => {
                        contour.forEach((pt, i) => {
                            if (i === 0) ctx.moveTo(pt.x, pt.y);
                            else ctx.lineTo(pt.x, pt.y);
                        });
                        ctx.closePath();
                    });
                    ctx.fill('evenodd');
                }
            });
        });
        ctx.restore();
        drawOverlay();
    }
    function drawPadShape(ctx, pad) {
        const {
            shape,
            dims,
            x,
            y,
            primitives
        } = pad;
        if (shape === 'MACRO' && primitives && primitives.length > 0) {
            ctx.save();
            ctx.translate(x, y);
            primitives.forEach(p => {
                ctx.save();
                if (p.rot) ctx.rotate((p.rot * Math.PI) / 180);
                if (p.type === 'circle') {
                    ctx.beginPath();
                    ctx.arc(p.cx, p.cy, p.diam / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else if (p.type === 'line') {
                    ctx.lineWidth = p.width;
                    ctx.lineCap = 'butt';
                    ctx.beginPath();
                    ctx.moveTo(p.x1, p.y1);
                    ctx.lineTo(p.x2, p.y2);
                    ctx.stroke();
                } else if (p.type === 'rect') {
                    ctx.save();
                    ctx.translate(p.cx, p.cy);
                    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                    ctx.restore();
                } else if (p.type === 'polygon' && p.points) {
                    ctx.beginPath();
                    p.points.forEach((pt, i) => {
                        if (i === 0) ctx.moveTo(pt.x, pt.y);
                        else ctx.lineTo(pt.x, pt.y);
                    });
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
            });
            ctx.restore();
            return;
        }
        ctx.beginPath();
        const w = (dims && dims[0]) ? dims[0] : 0.2;
        if (shape === 'C') {
            ctx.arc(x, y, w / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (shape === 'R') {
            const h = (dims && dims[1]) ? dims[1] : w;
            ctx.fillRect(x - w / 2, y - h / 2, w, h);
        } else if (shape === 'O') {
            const h = (dims && dims[1]) ? dims[1] : w;
            if (w > h) {
                const r = h / 2;
                ctx.arc(x - w / 2 + r, y, r, Math.PI / 2, Math.PI * 1.5);
                ctx.arc(x + w / 2 - r, y, r, Math.PI * 1.5, Math.PI / 2);
            } else {
                const r = w / 2;
                ctx.arc(x, y - h / 2 + r, r, Math.PI, 0);
                ctx.arc(x, y + h / 2 - r, r, 0, Math.PI);
            }
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.arc(x, y, w / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    function drawGrid() {
        ctx.strokeStyle = '#181818';
        ctx.lineWidth = 1;
        let step = 1;
        if (zoom < 5) step = 10;
        if (zoom > 50) step = 0.5;
        const minWorld = screenToWorld(0, canvas.height);
        const maxWorld = screenToWorld(canvas.width, 0);
        const startX = Math.floor(minWorld.x / step) * step;
        const endX = Math.ceil(maxWorld.x / step) * step;
        const startY = Math.floor(minWorld.y / step) * step;
        const endY = Math.ceil(maxWorld.y / step) * step;
        ctx.beginPath();
        for (let x = startX; x <= endX; x += step) {
            const s = worldToScreen(x, 0);
            ctx.moveTo(s.x, 0);
            ctx.lineTo(s.x, canvas.height);
        }
        for (let y = startY; y <= endY; y += step) {
            const s = worldToScreen(0, y);
            ctx.moveTo(0, s.y);
            ctx.lineTo(canvas.width, s.y);
        }
        ctx.stroke();
    }
    function drawOrigin() {
        const originS = worldToScreen(0, 0);
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, originS.y);
        ctx.lineTo(canvas.width, originS.y);
        ctx.stroke();
        ctx.strokeStyle = '#444';
        ctx.beginPath();
        ctx.moveTo(originS.x, 0);
        ctx.lineTo(originS.x, canvas.height);
        ctx.stroke();
    }
    function drawCenterMarker(x, y, labelColor = '#38bdf8') {
        const s = worldToScreen(x, y);
        ctx.strokeStyle = labelColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(s.x - 7, s.y);
        ctx.lineTo(s.x + 7, s.y);
        ctx.moveTo(s.x, s.y - 7);
        ctx.lineTo(s.x, s.y + 7);
        ctx.stroke();
    }
    function drawOverlay() {
        const nearest = findNearestGeometry(mouseWorld.x, mouseWorld.y);
        if (nearest.center && (activeTool === 'SELECT_POINT' || activeTool === 'MEASURE')) {
            const s = worldToScreen(nearest.center.x, nearest.center.y);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (boxStartWorld && boxEndWorld && (isBoxSelecting || activeTool === 'SELECT_AREA')) {
            const p1 = worldToScreen(boxStartWorld.x, boxStartWorld.y);
            const p2 = worldToScreen(boxEndWorld.x, boxEndWorld.y);
            const bx = Math.min(p1.x, p2.x),
                by = Math.min(p1.y, p2.y);
            const bw = Math.abs(p1.x - p2.x),
                bh = Math.abs(p1.y - p2.y);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
            ctx.fillRect(bx, by, bw, bh);
            ctx.strokeRect(bx, by, bw, bh);
            ctx.setLineDash([]);
        }
        if (activeTool === 'SELECT_POINT' && pinnedPoint) {
            drawCenterMarker(pinnedPoint.x, pinnedPoint.y, '#38bdf8');
        } else if (activeTool === 'SELECT_AREA' && currentSelectedBounds) {
            const cx = (currentSelectedBounds.minX + currentSelectedBounds.maxX) / 2;
            const cy = (currentSelectedBounds.minY + currentSelectedBounds.maxY) / 2;
            drawCenterMarker(cx, cy, '#38bdf8');
        }
        if (activeTool === 'MEASURE' && measureStart) {
            const targetEnd = measureEnd || (nearest.center ? nearest.center : {
                x: mouseWorld.x,
                y: mouseWorld.y
            });
            const p1 = worldToScreen(measureStart.x, measureStart.y);
            const p2 = worldToScreen(targetEnd.x, targetEnd.y);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.setLineDash([]);
            [p1, p2].forEach(p => {
                ctx.fillStyle = '#38bdf8';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fill();
            });
            const midX = (measureStart.x + targetEnd.x) / 2;
            const midY = (measureStart.y + targetEnd.y) / 2;
            drawCenterMarker(midX, midY, '#f59e0b');
        }
    }
    // ==========================================
    // 8. TƯƠNG TÁC CHUỘT VÀ SỰ KIỆN CANVAS
    // ==========================================
    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left,
            sy = e.clientY - rect.top;
        if (activeTool === 'SELECT_AREA') {
            isBoxSelecting = true;
            boxStartWorld = screenToWorld(sx, sy);
            boxEndWorld = {
                ...boxStartWorld
            };
            selectedGeometries = [];
            calculatedCentroid = null;
            currentSelectedBounds = null;
            btnMovetozero.classList.add('not-allowed');
        }
    });
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left,
            sy = e.clientY - rect.top;
        mouseWorld = screenToWorld(sx, sy);
        if (isDragging) {
            if (activeTool === 'MOVE') {
                panX += (e.clientX - dragStartX);
                panY += (e.clientY - dragStartY);
                dragStartX = e.clientX;
                dragStartY = e.clientY;
            } else if (activeTool === 'SELECT_AREA' && isBoxSelecting) {
                boxEndWorld = mouseWorld;
            }
        }
        realtimeX.textContent = formatUnitVal(mouseWorld.x);
        realtimeY.textContent = formatUnitVal(mouseWorld.y);
        updateInfoUI();
        requestAnimationFrame(draw);
    });
    canvas.addEventListener('mouseup', (e) => {
        if (e.button !== 0) return;
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left,
            sy = e.clientY - rect.top;
        const distDragged = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
        if (activeTool === 'SELECT_AREA' && isBoxSelecting) {
            isBoxSelecting = false;
            calculateAreaSelection();
        } else if (distDragged < 5) {
            handleCanvasClick(screenToWorld(sx, sy));
        }
        isDragging = false;
    });
    function handleCanvasClick(worldPt) {
        const nearest = findNearestGeometry(worldPt.x, worldPt.y);
        if (activeTool === 'SELECT_POINT') {
            pinnedPoint = nearest.center ? {
                x: nearest.center.x,
                y: nearest.center.y
            } : {
                x: worldPt.x,
                y: worldPt.y
            };
        } else if (activeTool === 'MEASURE') {
            const targetObj = nearest.center ? nearest.center : {
                x: worldPt.x,
                y: worldPt.y
            };
            if (!measureStart || (measureStart && measureEnd)) {
                measureStart = targetObj;
                measureEnd = null;
            } else {
                measureEnd = targetObj;
            }
        }
        updateInfoUI();
        requestAnimationFrame(draw);
    }
    function calculateAreaSelection() {
        if (!boxStartWorld || !boxEndWorld) return;
        const selMinX = Math.min(boxStartWorld.x, boxEndWorld.x);
        const selMaxX = Math.max(boxStartWorld.x, boxEndWorld.x);
        const selMinY = Math.min(boxStartWorld.y, boxEndWorld.y);
        const selMaxY = Math.max(boxStartWorld.y, boxEndWorld.y);
        selectedGeometries = [];
        let tightMinX = Infinity,
            tightMaxX = -Infinity;
        let tightMinY = Infinity,
            tightMaxY = -Infinity;
        layers.forEach(layer => {
            if (!layer.visible) return;
            layer.items.forEach(item => {
                if (!isItemVisible(item)) return;
                const center = getGeometryCenter(item);
                if (center && center.x >= selMinX && center.x <= selMaxX && center.y >= selMinY && center.y <= selMaxY) {
                    selectedGeometries.push(center);
                    const bbox = getItemBoundingBox(item);
                    if (bbox) {
                        if (bbox.minX < tightMinX) tightMinX = bbox.minX;
                        if (bbox.maxX > tightMaxX) tightMaxX = bbox.maxX;
                        if (bbox.minY < tightMinY) tightMinY = bbox.minY;
                        if (bbox.maxY > tightMaxY) tightMaxY = bbox.maxY;
                    }
                }
            });
        });
        if (selectedGeometries.length > 0) {
            currentSelectedBounds = {
                minX: tightMinX,
                maxX: tightMaxX,
                minY: tightMinY,
                maxY: tightMaxY
            };
            boxStartWorld = {
                x: tightMinX,
                y: tightMinY
            };
            boxEndWorld = {
                x: tightMaxX,
                y: tightMaxY
            };
            btnMovetozero.classList.remove('not-allowed');
        } else {
            currentSelectedBounds = null;
            btnMovetozero.classList.add('not-allowed');
        }
        updateInfoUI();
        requestAnimationFrame(draw);
    }
    function updateInfoUI() {
        if (activeTool === 'SELECT_POINT') {
            if (pinnedPoint) {
                pointX.textContent = formatUnitVal(pinnedPoint.x);
                pointY.textContent = formatUnitVal(pinnedPoint.y);
                pointW.textContent = "0" + UNITS[currentUnit].label;
                pointH.textContent = "0" + UNITS[currentUnit].label;
            } else {
                pointX.textContent = formatUnitVal(0);
                pointY.textContent = formatUnitVal(0);
                pointW.textContent = formatUnitVal(0);
                pointH.textContent = formatUnitVal(0);
            }
        } else if (activeTool === 'SELECT_AREA') {
            if (currentSelectedBounds) {
                const cx = (currentSelectedBounds.minX + currentSelectedBounds.maxX) / 2;
                const cy = (currentSelectedBounds.minY + currentSelectedBounds.maxY) / 2;
                const w = currentSelectedBounds.maxX - currentSelectedBounds.minX;
                const h = currentSelectedBounds.maxY - currentSelectedBounds.minY;
                pointX.textContent = formatUnitVal(cx);
                pointY.textContent = formatUnitVal(cy);
                pointW.textContent = formatUnitVal(w);
                pointH.textContent = formatUnitVal(h);
            } else {
                pointX.textContent = formatUnitVal(0);
                pointY.textContent = formatUnitVal(0);
                pointW.textContent = formatUnitVal(0);
                pointH.textContent = formatUnitVal(0);
            }
        } else if (activeTool === 'MEASURE') {
            if (measureStart) {
                measureX1.textContent = formatUnitVal(measureStart.x);
                measureY1.textContent = formatUnitVal(measureStart.y);
                const targetEnd = measureEnd || (findNearestGeometry(mouseWorld.x, mouseWorld.y).center || mouseWorld);
                measureX2.textContent = formatUnitVal(targetEnd.x);
                measureY2.textContent = formatUnitVal(targetEnd.y);
                const dist = Math.hypot(targetEnd.x - measureStart.x, targetEnd.y - measureStart.y);
                measureW.textContent = formatUnitVal(dist);
            } else {
                measureX1.textContent = formatUnitVal(0);
                measureY1.textContent = formatUnitVal(0);
                measureX2.textContent = formatUnitVal(0);
                measureY2.textContent = formatUnitVal(0);
                measureW.textContent = formatUnitVal(0);
            }
        }
    }
    // ==========================================
    // 9. ZOOM VÀ ĐƠN VỊ ĐO (DROPDOWN INTEGRATION)
    // ==========================================
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left,
            mouseY = e.clientY - rect.top;
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
        const newZoom = Math.max(0.01, Math.min(1000, zoom * zoomFactor));
        panX = mouseX - canvas.width / 2 - (mouseX - canvas.width / 2 - panX) * (newZoom / zoom);
        panY = mouseY - canvas.height / 2 - (mouseY - canvas.height / 2 - panY) * (newZoom / zoom);
        zoom = newZoom;
        updateZoomLabel();
        requestAnimationFrame(draw);
    }, {
        passive: false
    });
    function updateZoomLabel() {
        const zoomBtn = document.querySelector('.option-zoom .option-select');
        if (zoomBtn) {
            const pct = Math.round((zoom / SCREEN_PHYSICAL_PX_PER_MM) * 100);
            zoomBtn.textContent = `${pct}%`;
        }
    }
    function initDropdowns() {
        const dropdowns = document.querySelectorAll('.option-select-list');
        dropdowns.forEach(container => {
            const selectBtn = container.querySelector(".toggle-dropdown");
            const optionsList = container.querySelector(".option-list");
            const items = container.querySelectorAll(".option-list span");
            if (!selectBtn || !optionsList) return;
            selectBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                document.querySelectorAll(".option-list").forEach(list => {
                    if (list !== optionsList) list.classList.remove("is-open");
                });
                optionsList.classList.toggle("is-open");
            });
            items.forEach(item => {
                item.addEventListener("click", () => {
                    const value = item.getAttribute("data-value");
                    selectBtn.textContent = item.textContent;
                    optionsList.classList.remove("is-open");
                    if (container.classList.contains('option-unit')) {
                        if (UNITS[value]) {
                            currentUnit = value;
                            updateInfoUI();
                            requestAnimationFrame(draw);
                        }
                    }
                    if (container.classList.contains('option-zoom')) {
                        const pct = parseFloat(value);
                        if (!isNaN(pct)) {
                            const factor = pct / 100;
                            const bbox = getOverallBoundingBox();
                            const cx = bbox ? (bbox.minX + bbox.maxX) / 2 : 0;
                            const cy = bbox ? (bbox.minY + bbox.maxY) / 2 : 0;
                            zoom = SCREEN_PHYSICAL_PX_PER_MM * (factor === 0 ? 0.01 : factor);
                            panX = -cx * zoom;
                            panY = cy * zoom;
                            requestAnimationFrame(draw);
                        }
                    }
                });
            });
        });
        document.addEventListener("click", () => {
            document.querySelectorAll(".option-list").forEach(list => list.classList.remove("is-open"));
        });
    }
    // Lắng nghe sự thay đổi của Settings Checkbox
    [displayGrid, displayOrigin, displayPads, displayTracks, displayRegions].forEach(chk => {
        chk.addEventListener('change', () => {
            if (activeTool === 'SELECT_AREA' && currentSelectedBounds) {
                calculateAreaSelection();
            }
            requestAnimationFrame(draw);
        });
    });
    // Bắt đầu khởi chạy Engine
    initDropdowns();
    resizeCanvas();
    setTool('MOVE');
});