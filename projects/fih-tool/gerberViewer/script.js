console.clear();
console.log("Gerber Viewer Engine Integrated");

// ==========================================
// 1. CẤU HÌNH ĐƠN VỊ VÀ ĐỔI ĐƠN VỊ TỌA ĐỘ
// ==========================================
const UNITS = {
	mm: { name: 'Millimeter', scale: 1.0, decimals: 4, label: 'mm' },
	cm: { name: 'Centimeter', scale: 0.1, decimals: 5, label: 'cm' },
	inch: { name: 'Inch', scale: 1 / 25.4, decimals: 5, label: 'in' },
	mils: { name: 'Mils', scale: 1000 / 25.4, decimals: 2, label: 'mil' },
	micron: { name: 'Micron', scale: 1000.0, decimals: 1, label: 'µm' }
};

const PRESET_COLORS = ['#00FF66', '#FF3366', '#33CCFF', '#FFCC00', '#CC66FF', '#FF9933'];

// ==========================================
// 2. BỘ PHÂN TÍCH CÚ PHÁP GERBER (RS-274X PARSER ENGINE)
// ==========================================
class GerberParser {
	static parse(text, fileName) {
		let unitScale = 1.0;
		let decX = 4, decY = 4;

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
			if (macroName.startsWith('D')) {
				macros[macroName.substring(1)] = primitives;
			} else {
				macros['D' + macroName] = primitives;
			}
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
					dims = [
						dimsRaw[0] * unitScale,
						dimsRaw[1] || 4,
						dimsRaw[2] || 0,
						dimsRaw[3] ? dimsRaw[3] * unitScale : 0
					];
				}
				apertures[id] = { type: typeOrMacro, dims };
			} else {
				const prims = macros[typeOrMacro] || macros[addMatch[2]] || [];
				apertures[id] = { type: 'MACRO', macroName: typeOrMacro, primitives: prims, dims: [0.2, 0.2] };
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
			if (r < 1e-7) return [{ x: x2, y: y2 }];

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
		let currentX = 0, currentY = 0;
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
			if (g54Match) {
				const code = 'D' + g54Match[1];
				if (apertures[code]) currentAperture = apertures[code];
			}

			const apMatch = block.match(/(?:^|[^G])D([1-9]\d+)/i);
			if (apMatch) {
				const code = 'D' + apMatch[1];
				if (apertures[code]) currentAperture = apertures[code];
			}

			const xMatch = block.match(/X([+-]?\d+)/i);
			const yMatch = block.match(/Y([+-]?\d+)/i);
			const iMatch = block.match(/I([+-]?\d+)/i);
			const jMatch = block.match(/J([+-]?\d+)/i);
			const dMatch = block.match(/D0?([123])(?!\d)/i);

			let newX = currentX;
			let newY = currentY;

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
			if (op === '1' || op === '2') {
				currentD = op;
			} else if (!op && (xMatch || yMatch)) {
				op = currentD;
			}

			if (op === '2') { // Move
				currentX = newX;
				currentY = newY;
				if (inRegion) {
					if (currentContour.length > 0) {
						regionContours.push(currentContour);
						currentContour = [];
					}
					currentContour.push({ x: currentX, y: currentY });
				}
			} else if (op === '1') { // Interpolate
				if (interpMode === 'G01') {
					if (inRegion) {
						currentContour.push({ x: newX, y: newY });
					} else {
						const width = currentAperture ? (currentAperture.dims[0] || 0.1) : 0.1;
						items.push({
							type: 'line',
							x1: currentX, y1: currentY,
							x2: newX, y2: newY,
							width
						});
					}
				} else if (interpMode === 'G02' || interpMode === 'G03') {
					const isCCW = (interpMode === 'G03');
					const arcPts = linearizeArc(currentX, currentY, newX, newY, offI, offJ, isCCW);

					if (inRegion) {
						arcPts.forEach(pt => currentContour.push(pt));
					} else {
						const width = currentAperture ? (currentAperture.dims[0] || 0.1) : 0.1;
						let lastPt = { x: currentX, y: currentY };
						arcPts.forEach(pt => {
							items.push({
								type: 'line',
								x1: lastPt.x, y1: lastPt.y,
								x2: pt.x, y2: pt.y,
								width
							});
							lastPt = pt;
						});
					}
				}
				currentX = newX;
				currentY = newY;
			} else if (op === '3') { // Flash
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
				if (currentContour.length > 0) {
					regionContours.push(currentContour);
				}
				if (regionContours.length > 0) {
					items.push({
						type: 'region',
						contours: regionContours
					});
				}
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
			const code = tokens[0];
			const exposure = tokens[1];

			if (code === 1) { // Circle
				if (tokens.length >= 5) {
					primitives.push({
						type: 'circle',
						exposure,
						diam: tokens[2] * unitScale,
						cx: tokens[3] * unitScale,
						cy: tokens[4] * unitScale
					});
				}
			} else if (code === 20) { // Vector Line
				if (tokens.length >= 7) {
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
				}
			} else if (code === 21) { // Rectangle
				if (tokens.length >= 6) {
					primitives.push({
						type: 'rect',
						exposure,
						w: tokens[2] * unitScale,
						h: tokens[3] * unitScale,
						cx: tokens[4] * unitScale,
						cy: tokens[5] * unitScale,
						rot: tokens[6] || 0
					});
				}
			} else if (code === 4) { // Polygon
				let rot = 0;
				let endIdx = tokens.length;
				if ((tokens.length - 3) % 2 === 1) {
					rot = tokens[tokens.length - 1];
					endIdx = tokens.length - 1;
				}
				const pts = [];
				for (let i = 3; i < endIdx; i += 2) {
					if (i + 1 < endIdx) {
						pts.push({
							x: tokens[i] * unitScale,
							y: tokens[i + 1] * unitScale
						});
					}
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

// HÀM TÍNH TÂM VÀ BOUNDING BOX CỦA ĐỐI TƯỢNG HÌNH HỌC
function getGeometryCenter(item) {
	if (item.type === 'pad') {
		return { x: item.x, y: item.y, label: `Pad ${item.shape}`, item: item };
	} else if (item.type === 'line') {
		return { x: (item.x1 + item.x2) / 2, y: (item.y1 + item.y2) / 2, label: 'Track', item: item };
	} else if (item.type === 'region' && item.contours && item.contours.length > 0) {
		let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
		item.contours.forEach(contour => {
			contour.forEach(p => {
				if (p.x < minX) minX = p.x;
				if (p.x > maxX) maxX = p.x;
				if (p.y < minY) minY = p.y;
				if (p.y > maxY) maxY = p.y;
			});
		});
		return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, label: 'Region', item: item };
	}
	return null;
}

function getItemBoundingBox(item) {
	if (item.type === 'pad') {
		if (item.shape === 'MACRO' && item.primitives && item.primitives.length > 0) {
			let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
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
					const w2 = p.w / 2, h2 = p.h / 2;
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
			if (isFinite(minX)) return { minX, maxX, minY, maxY };
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
		let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
		item.contours.forEach(contour => {
			contour.forEach(p => {
				if (p.x < minX) minX = p.x;
				if (p.x > maxX) maxX = p.x;
				if (p.y < minY) minY = p.y;
				if (p.y > maxY) maxY = p.y;
			});
		});
		return { minX, maxX, minY, maxY };
	}
	return null;
}

// ==========================================
// 3. GERBER VIEWPORT & RENDER ENGINE
// ==========================================
class GerberViewport {
	constructor(containerId) {
		this.container = document.getElementById(containerId);
		this.canvas = document.createElement("canvas");
		this.ctx = this.canvas.getContext("2d");
		this.container.appendChild(this.canvas);

		// Trạng thái Viewport
		this.scale = 10;          // Pixel per mm
		this.offsetX = 0;         // Offset X của gốc (0,0) trên màn hình
		this.offsetY = 0;         // Offset Y của gốc (0,0) trên màn hình
		
		// Layers & Tools State
		this.layers = [];
		this.currentTool = "move"; // 'move', 'selectpoint', 'selectarea', 'measure'
		this.currentUnit = "mm";
		
		// Toạ độ con trỏ chuột thực tế (World Space - mm)
		this.mouseWorldX = 0;
		this.mouseWorldY = 0;

		// Thao tác kéo chuột / Chọn vùng / Đo đạc
		this.isDragging = false;
		this.dragStartX = 0;
		this.dragStartY = 0;
		this.isBoxSelecting = false;
		this.boxStartWorld = null;
		this.boxEndWorld = null;
		
		this.pinnedPoint = null;
		this.measureStart = null;
		this.measureEnd = null;
		this.selectedGeometries = [];
		this.calculatedCentroid = null;
		this.currentSelectedBounds = null;

		// Cài đặt hiển thị
		this.showGrid = true;
		this.showOrigin = true;
		this.showPads = true;
		this.showTracks = true;
		this.showRegions = true;

		this.initCanvas();
		this.bindEvents();
		this.centerOrigin();
		this.requestRender();
	}

	initCanvas() {
		this.resize();
		window.addEventListener("resize", () => this.resize());
	}

	resize() {
		const rect = this.container.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;

		this.canvas.width = rect.width * dpr;
		this.canvas.height = rect.height * dpr;
		this.canvas.style.width = "100%";
		this.canvas.style.height = "100%";
		this.canvas.style.display = "block";

		this.ctx.imageSmoothingEnabled = false;
		this.requestRender();
	}

	centerOrigin() {
		const rect = this.container.getBoundingClientRect();
		this.offsetX = rect.width / 2;
		this.offsetY = rect.height / 2;
	}

	screenToWorld(screenX, screenY) {
		const worldX = (screenX - this.offsetX) / this.scale;
		const worldY = -(screenY - this.offsetY) / this.scale;
		return { x: worldX, y: worldY };
	}

	worldToScreen(worldX, worldY) {
		const screenX = worldX * this.scale + this.offsetX;
		const screenY = -worldY * this.scale + this.offsetY;
		return { x: screenX, y: screenY };
	}

	formatUnit(valMm, unit = this.currentUnit) {
		const info = UNITS[unit] || UNITS.mm;
		const val = valMm * info.scale;
		return `${val.toFixed(info.decimals)}${info.label}`;
	}

	findNearestGeometry(wx, wy) {
		const maxDist = 25 / this.scale;
		let closestItem = null, closestCenter = null;
		let minDist = maxDist;
		for (const layer of this.layers) {
			if (!layer.visible) continue;
			for (const item of layer.items) {
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
		return { item: closestItem, center: closestCenter };
	}

	// ------------------------------------------
	// BẮT SỰ KIỆN CHUỘT / WHEEL / DRAG DROP
	// ------------------------------------------
	bindEvents() {
		// Zoom bằng con trỏ chuột
		this.canvas.addEventListener("wheel", (e) => {
			e.preventDefault();
			const rect = this.canvas.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;

			const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
			const newScale = Math.min(Math.max(this.scale * zoomFactor, 0.01), 10000);

			this.offsetX = mouseX - (mouseX - this.offsetX) * (newScale / this.scale);
			this.offsetY = mouseY - (mouseY - this.offsetY) * (newScale / this.scale);
			this.scale = newScale;

			this.updateZoomUI();
			this.requestRender();
		}, { passive: false });

		this.canvas.addEventListener("mousedown", (e) => {
			if (e.button !== 0) return;
			this.isDragging = true;
			this.dragStartX = e.clientX;
			this.dragStartY = e.clientY;

			const rect = this.canvas.getBoundingClientRect();
			const sx = e.clientX - rect.left;
			const sy = e.clientY - rect.top;

			if (this.currentTool === "selectarea") {
				this.isBoxSelecting = true;
				this.boxStartWorld = this.screenToWorld(sx, sy);
				this.boxEndWorld = { ...this.boxStartWorld };
				this.selectedGeometries = [];
				this.calculatedCentroid = null;
				this.currentSelectedBounds = null;
			}
		});

		window.addEventListener("mousemove", (e) => {
			const rect = this.canvas.getBoundingClientRect();
			const sx = e.clientX - rect.left;
			const sy = e.clientY - rect.top;

			const worldPos = this.screenToWorld(sx, sy);
			this.mouseWorldX = worldPos.x;
			this.mouseWorldY = worldPos.y;

			this.updateMouseFooterUI();

			if (this.isDragging) {
				if (this.currentTool === "move") {
					this.offsetX += (e.clientX - this.dragStartX);
					this.offsetY += (e.clientY - this.dragStartY);
					this.dragStartX = e.clientX;
					this.dragStartY = e.clientY;
				} else if (this.currentTool === "selectarea" && this.isBoxSelecting) {
					this.boxEndWorld = { x: this.mouseWorldX, y: this.mouseWorldY };
				}
				this.requestRender();
			} else if (this.currentTool === "selectpoint" || this.currentTool === "measure") {
				this.requestRender();
			}
		});

		window.addEventListener("mouseup", (e) => {
			if (e.button !== 0 || !this.isDragging) return;
			const rect = this.canvas.getBoundingClientRect();
			const sx = e.clientX - rect.left;
			const sy = e.clientY - rect.top;
			const distDragged = Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY);

			if (this.currentTool === "selectarea" && this.isBoxSelecting) {
				this.isBoxSelecting = false;
				this.calculateAllGeometriesCentroid();
			} else if (distDragged < 5) {
				this.handleCanvasClick(this.screenToWorld(sx, sy));
			}

			this.isDragging = false;
		});

		// Drag and Drop File Gerber vào cửa sổ
		window.addEventListener('dragover', (e) => e.preventDefault());
		window.addEventListener('drop', (e) => {
			e.preventDefault();
			if (e.dataTransfer && e.dataTransfer.files.length > 0) {
				this.loadFiles(e.dataTransfer.files);
			}
		});
	}

	handleCanvasClick(worldPt) {
		const nearest = this.findNearestGeometry(worldPt.x, worldPt.y);
		if (this.currentTool === 'selectpoint') {
			if (nearest.center) {
				this.pinnedPoint = { x: nearest.center.x, y: nearest.center.y, info: nearest.center.label };
			} else {
				this.pinnedPoint = { x: worldPt.x, y: worldPt.y, info: 'Free Point' };
			}
			this.updatePointFooterUI(this.pinnedPoint.x, this.pinnedPoint.y, 0, 0);
		} else if (this.currentTool === 'measure') {
			const targetObj = nearest.center ? nearest.center : { x: worldPt.x, y: worldPt.y };
			if (!this.measureStart || (this.measureStart && this.measureEnd)) {
				this.measureStart = targetObj;
				this.measureEnd = null;
				this.updateMeasureFooterUI(targetObj.x, targetObj.y, targetObj.x, targetObj.y, 0);
			} else {
				this.measureEnd = targetObj;
				const dist = Math.hypot(this.measureEnd.x - this.measureStart.x, this.measureEnd.y - this.measureStart.y);
				this.updateMeasureFooterUI(this.measureStart.x, this.measureStart.y, this.measureEnd.x, this.measureEnd.y, dist);
			}
		}
		this.requestRender();
	}

	calculateAllGeometriesCentroid() {
		if (!this.boxStartWorld || !this.boxEndWorld) return;
		const selMinX = Math.min(this.boxStartWorld.x, this.boxEndWorld.x);
		const selMaxX = Math.max(this.boxStartWorld.x, this.boxEndWorld.x);
		const selMinY = Math.min(this.boxStartWorld.y, this.boxEndWorld.y);
		const selMaxY = Math.max(this.boxStartWorld.y, this.boxEndWorld.y);

		this.selectedGeometries = [];
		let tightMinX = Infinity, tightMaxX = -Infinity;
		let tightMinY = Infinity, tightMaxY = -Infinity;

		this.layers.forEach(layer => {
			if (!layer.visible) return;
			layer.items.forEach(item => {
				const center = getGeometryCenter(item);
				if (center) {
					if (center.x >= selMinX && center.x <= selMaxX && center.y >= selMinY && center.y <= selMaxY) {
						this.selectedGeometries.push(center);
						const bbox = getItemBoundingBox(item);
						if (bbox) {
							if (bbox.minX < tightMinX) tightMinX = bbox.minX;
							if (bbox.maxX > tightMaxX) tightMaxX = bbox.maxX;
							if (bbox.minY < tightMinY) tightMinY = bbox.minY;
							if (bbox.maxY > tightMaxY) tightMaxY = bbox.maxY;
						}
					}
				}
			});
		});

		if (this.selectedGeometries.length > 0) {
			this.currentSelectedBounds = {
				minX: tightMinX, maxX: tightMaxX,
				minY: tightMinY, maxY: tightMaxY
			};
			this.boxStartWorld = { x: tightMinX, y: tightMinY };
			this.boxEndWorld = { x: tightMaxX, y: tightMaxY };
			const centerX = (tightMinX + tightMaxX) / 2;
			const centerY = (tightMinY + tightMaxY) / 2;
			const width = tightMaxX - tightMinX;
			const height = tightMaxY - tightMinY;

			this.calculatedCentroid = {
				x: centerX, y: centerY,
				w: width, h: height,
				count: this.selectedGeometries.length
			};

			this.updatePointFooterUI(centerX, centerY, width, height);
		} else {
			this.currentSelectedBounds = null;
			this.calculatedCentroid = null;
			this.updatePointFooterUI(0, 0, 0, 0);
		}
		this.requestRender();
	}

	shiftAllGerbers(dx, dy) {
		this.layers.forEach(l => {
			l.items.forEach(it => {
				if (it.x !== undefined) it.x += dx;
				if (it.y !== undefined) it.y += dy;
				if (it.x1 !== undefined) {
					it.x1 += dx; it.x2 += dx;
					it.y1 += dy; it.y2 += dy;
				}
				if (it.type === 'region' && it.contours) {
					it.contours.forEach(contour => {
						contour.forEach(p => { p.x += dx; p.y += dy; });
					});
				}
			});
		});

		if (this.currentSelectedBounds) {
			this.currentSelectedBounds.minX += dx; this.currentSelectedBounds.maxX += dx;
			this.currentSelectedBounds.minY += dy; this.currentSelectedBounds.maxY += dy;
			if (this.boxStartWorld && this.boxEndWorld) {
				this.boxStartWorld.x += dx; this.boxStartWorld.y += dy;
				this.boxEndWorld.x += dx; this.boxEndWorld.y += dy;
			}
			if (this.calculatedCentroid) {
				this.calculatedCentroid.x += dx; this.calculatedCentroid.y += dy;
				this.updatePointFooterUI(this.calculatedCentroid.x, this.calculatedCentroid.y, this.calculatedCentroid.w, this.calculatedCentroid.h);
			}
		}
		this.pinnedPoint = null;
		this.measureStart = null;
		this.measureEnd = null;
		this.fitView();
	}

	loadFiles(files) {
		const fileArray = Array.from(files);
		if (!fileArray.length) return;
		fileArray.forEach((file) => {
			const reader = new FileReader();
			reader.onload = (event) => {
				const items = GerberParser.parse(event.target.result, file.name);
				const color = PRESET_COLORS[this.layers.length % PRESET_COLORS.length];
				this.layers.push({
					id: Date.now() + Math.random(),
					name: file.name,
					visible: true,
					color,
					items
				});
				this.updateSidebarUI();
				if (this.layers.length === 1) this.fitView();
				else this.requestRender();
			};
			reader.readAsText(file);
		});
	}

	getOverallBoundingBox() {
		let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
		let hasItems = false;
		this.layers.forEach(l => {
			if (!l.visible) return;
			l.items.forEach(it => {
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
		return hasItems ? { minX, maxX, minY, maxY } : null;
	}

	fitView() {
		const bbox = this.getOverallBoundingBox();
		const rect = this.container.getBoundingClientRect();
		if (!bbox) {
			this.scale = 10;
			this.centerOrigin();
		} else {
			const w = Math.max(bbox.maxX - bbox.minX, 1);
			const h = Math.max(bbox.maxY - bbox.minY, 1);
			const cx = (bbox.minX + bbox.maxX) / 2;
			const cy = (bbox.minY + bbox.maxY) / 2;
			const scaleX = (rect.width * 0.82) / w;
			const scaleY = (rect.height * 0.82) / h;
			this.scale = Math.min(scaleX, scaleY);
			this.offsetX = rect.width / 2 - cx * this.scale;
			this.offsetY = rect.height / 2 + cy * this.scale;
		}
		this.updateZoomUI();
		this.requestRender();
	}

	// ------------------------------------------
	// VẼ BẢN VẼ CANVAS & ĐỐI TƯỢNG HÌNH HỌC
	// ------------------------------------------
	render() {
		const dpr = window.devicePixelRatio || 1;
		const width = this.canvas.width / dpr;
		const height = this.canvas.height / dpr;

		this.ctx.save();
		this.ctx.scale(dpr, dpr);

		// Xoá nền
		this.ctx.fillStyle = "#000000";
		this.ctx.fillRect(0, 0, width, height);

		if (this.showGrid) this.drawGrid(width, height);
		if (this.showOrigin) this.drawOrigin();

		// Transformation Gerber Space (+Y UP)
		this.ctx.save();
		this.ctx.translate(this.offsetX, this.offsetY);
		this.ctx.scale(this.scale, -this.scale);

		this.layers.forEach(layer => {
			if (!layer.visible) return;
			this.ctx.fillStyle = layer.color;
			this.ctx.strokeStyle = layer.color;

			layer.items.forEach(item => {
				if (item.type === 'line' && this.showTracks) {
					this.ctx.lineWidth = item.width || 0.1;
					this.ctx.lineCap = 'round';
					this.ctx.beginPath();
					this.ctx.moveTo(item.x1, item.y1);
					this.ctx.lineTo(item.x2, item.y2);
					this.ctx.stroke();
				} else if (item.type === 'pad' && this.showPads) {
					this.drawPadShape(this.ctx, item);
				} else if (item.type === 'region' && this.showRegions) {
					this.ctx.beginPath();
					item.contours.forEach(contour => {
						contour.forEach((pt, i) => {
							if (i === 0) this.ctx.moveTo(pt.x, pt.y);
							else this.ctx.lineTo(pt.x, pt.y);
						});
						this.ctx.closePath();
					});
					this.ctx.fill('evenodd');
				}
			});
		});

		this.ctx.restore();

		// Vẽ Overlay (Chỉ báo Snapping, Bôi chọn, Đo đạc, Pin)
		this.drawOverlay();

		this.ctx.restore();
	}

	drawPadShape(ctx, pad) {
		const { shape, dims, x, y, primitives } = pad;
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
				} else if (p.type === 'polygon' && p.points && p.points.length > 0) {
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
			ctx.beginPath();
			if (w > h) {
				const r = h / 2;
				ctx.arc(x - w / 2 + r, y, r, Math.PI / 2, Math.PI * 1.5);
				ctx.arc(x + w / 2 - r, y, r, Math.PI * 1.5, Math.PI / 2);
			} else if (h > w) {
				const r = w / 2;
				ctx.arc(x, y - h / 2 + r, r, Math.PI, 0);
				ctx.arc(x, y + h / 2 - r, r, 0, Math.PI);
			} else {
				ctx.arc(x, y, w / 2, 0, Math.PI * 2);
			}
			ctx.closePath();
			ctx.fill();
		} else if (shape === 'P') {
			const vertices = dims[1];
			const rot = dims[2] * Math.PI / 180;
			ctx.beginPath();
			for (let i = 0; i < vertices; i++) {
				const angle = rot + (i * 2 * Math.PI / vertices);
				const px = x + (w / 2) * Math.cos(angle);
				const py = y + (w / 2) * Math.sin(angle);
				if (i === 0) ctx.moveTo(px, py);
				else ctx.lineTo(px, py);
			}
			ctx.closePath();
			ctx.fill();
		} else {
			ctx.arc(x, y, w / 2, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	drawGrid(width, height) {
		const minGridPixel = 40;
		let gridSpacingWorld = 1;
		const steps = [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 20, 50, 100];
		for (let s of steps) {
			if (s * this.scale >= minGridPixel) {
				gridSpacingWorld = s;
				break;
			}
		}

		const gridPixel = gridSpacingWorld * this.scale;
		const startX = (this.offsetX % gridPixel) - gridPixel;
		const startY = (this.offsetY % gridPixel) - gridPixel;

		this.ctx.beginPath();
		this.ctx.strokeStyle = "#1a1a24";
		this.ctx.lineWidth = 1;

		for (let x = startX; x < width + gridPixel; x += gridPixel) {
			this.ctx.moveTo(Math.floor(x) + 0.5, 0);
			this.ctx.lineTo(Math.floor(x) + 0.5, height);
		}

		for (let y = startY; y < height + gridPixel; y += gridPixel) {
			this.ctx.moveTo(0, Math.floor(y) + 0.5);
			this.ctx.lineTo(width, Math.floor(y) + 0.5);
		}
		this.ctx.stroke();
	}

	drawOrigin() {
		const origin = this.worldToScreen(0, 0);
		this.ctx.save();
		this.ctx.lineWidth = 1.5;

		this.ctx.beginPath();
		this.ctx.strokeStyle = "#ef4444";
		this.ctx.moveTo(origin.x, origin.y);
		this.ctx.lineTo(origin.x + 40, origin.y);
		this.ctx.stroke();

		this.ctx.beginPath();
		this.ctx.strokeStyle = "#22c55e";
		this.ctx.moveTo(origin.x, origin.y);
		this.ctx.lineTo(origin.x, origin.y - 40);
		this.ctx.stroke();

		this.ctx.beginPath();
		this.ctx.strokeStyle = "#38bdf8";
		this.ctx.arc(origin.x, origin.y, 5, 0, Math.PI * 2);
		this.ctx.stroke();

		this.ctx.font = 'bold 11px monospace';
		this.ctx.fillStyle = '#ef4444';
		this.ctx.fillText('(0,0)', origin.x + 8, origin.y - 8);

		this.ctx.restore();
	}

	drawOverlay() {
		const nearest = this.findNearestGeometry(this.mouseWorldX, this.mouseWorldY);
		if (nearest.center && (this.currentTool === 'selectpoint' || this.currentTool === 'measure')) {
			const s = this.worldToScreen(nearest.center.x, nearest.center.y);
			this.ctx.strokeStyle = '#38bdf8';
			this.ctx.lineWidth = 2;
			this.ctx.beginPath();
			this.ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
			this.ctx.stroke();
			this.ctx.beginPath();
			this.ctx.moveTo(s.x - 12, s.y);
			this.ctx.lineTo(s.x + 12, s.y);
			this.ctx.moveTo(s.x, s.y - 12);
			this.ctx.lineTo(s.x, s.y + 12);
			this.ctx.stroke();
		}

		if (this.boxStartWorld && this.boxEndWorld && (this.isBoxSelecting || this.currentTool === 'selectarea')) {
			const p1 = this.worldToScreen(this.boxStartWorld.x, this.boxStartWorld.y);
			const p2 = this.worldToScreen(this.boxEndWorld.x, this.boxEndWorld.y);
			const bx = Math.min(p1.x, p2.x), by = Math.min(p1.y, p2.y);
			const bw = Math.abs(p1.x - p2.x), bh = Math.abs(p1.y - p2.y);
			this.ctx.strokeStyle = '#38bdf8';
			this.ctx.lineWidth = 1.5;
			this.ctx.setLineDash([5, 4]);
			this.ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
			this.ctx.fillRect(bx, by, bw, bh);
			this.ctx.strokeRect(bx, by, bw, bh);
			this.ctx.setLineDash([]);
		}

		if (this.calculatedCentroid) {
			const s = this.worldToScreen(this.calculatedCentroid.x, this.calculatedCentroid.y);
			this.ctx.strokeStyle = '#38bdf8';
			this.ctx.lineWidth = 2;
			this.ctx.beginPath();
			this.ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
			this.ctx.stroke();
			const labelText = `+ Tâm (${this.calculatedCentroid.count} Shapes): X: ${this.formatUnit(this.calculatedCentroid.x)}, Y: ${this.formatUnit(this.calculatedCentroid.y)} | W: ${this.formatUnit(this.calculatedCentroid.w)}, H: ${this.formatUnit(this.calculatedCentroid.h)}`;
			this.ctx.font = 'bold 12px Segoe UI, sans-serif';
			this.ctx.strokeStyle = '#000000';
			this.ctx.lineWidth = 3.5;
			this.ctx.strokeText(labelText, s.x + 16, s.y - 6);
			this.ctx.fillStyle = '#38bdf8';
			this.ctx.fillText(labelText, s.x + 16, s.y - 6);
		}

		if (this.pinnedPoint) {
			const s = this.worldToScreen(this.pinnedPoint.x, this.pinnedPoint.y);
			this.ctx.strokeStyle = '#38bdf8';
			this.ctx.lineWidth = 2.5;
			this.ctx.beginPath();
			this.ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
			this.ctx.stroke();
			const textPin = `📍 X: ${this.formatUnit(this.pinnedPoint.x)}, Y: ${this.formatUnit(this.pinnedPoint.y)}`;
			this.ctx.font = 'bold 12px Segoe UI, sans-serif';
			this.ctx.strokeStyle = '#000000';
			this.ctx.lineWidth = 3.5;
			this.ctx.strokeText(textPin, s.x + 10, s.y - 10);
			this.ctx.fillStyle = '#38bdf8';
			this.ctx.fillText(textPin, s.x + 10, s.y - 10);
		}

		if (this.currentTool === 'measure' && this.measureStart) {
			const targetEndCenter = this.measureEnd || (nearest.center ? nearest.center : { x: this.mouseWorldX, y: this.mouseWorldY });
			const p1World = { x: this.measureStart.x, y: this.measureStart.y };
			const p2World = { x: targetEndCenter.x, y: targetEndCenter.y };
			const p1 = this.worldToScreen(p1World.x, p1World.y);
			const p2 = this.worldToScreen(p2World.x, p2World.y);

			this.ctx.strokeStyle = '#38bdf8';
			this.ctx.lineWidth = 2;
			this.ctx.setLineDash([5, 4]);
			this.ctx.beginPath();
			this.ctx.moveTo(p1.x, p1.y);
			this.ctx.lineTo(p2.x, p2.y);
			this.ctx.stroke();
			this.ctx.setLineDash([]);

			[p1, p2].forEach(p => {
				this.ctx.fillStyle = '#38bdf8';
				this.ctx.beginPath();
				this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
				this.ctx.fill();
				this.ctx.strokeStyle = '#ffffff';
				this.ctx.lineWidth = 1.5;
				this.ctx.stroke();
			});

			const dist = Math.hypot(p2World.x - p1World.x, p2World.y - p1World.y);
			const midX = (p1.x + p2.x) / 2;
			const midY = (p1.y + p2.y) / 2;
			const text = `Dist: ${this.formatUnit(dist)}`;
			this.ctx.font = 'bold 12px Segoe UI, sans-serif';
			this.ctx.strokeStyle = '#000000';
			this.ctx.lineWidth = 3.5;
			this.ctx.strokeText(text, midX + 10, midY - 10);
			this.ctx.fillStyle = '#38bdf8';
			this.ctx.fillText(text, midX + 10, midY - 10);
		}
	}

	requestRender() {
		requestAnimationFrame(() => this.render());
	}

	// ------------------------------------------
	// CẬP NHẬT GIAO DIỆN FOOTER & SIDEBAR
	// ------------------------------------------
	updateMouseFooterUI() {
		const elX = document.getElementById("realtimeX");
		const elY = document.getElementById("realtimeY");
		if (elX) elX.textContent = this.formatUnit(this.mouseWorldX);
		if (elY) elY.textContent = this.formatUnit(this.mouseWorldY);
	}

	updatePointFooterUI(x, y, w, h) {
		const px = document.getElementById("pointX");
		const py = document.getElementById("pointY");
		const pw = document.getElementById("pointW");
		const ph = document.getElementById("pointH");
		if (px) px.textContent = this.formatUnit(x);
		if (py) py.textContent = this.formatUnit(y);
		if (pw) pw.textContent = this.formatUnit(w);
		if (ph) ph.textContent = this.formatUnit(h);
	}

	updateMeasureFooterUI(x1, y1, x2, y2, dist) {
		const ax = document.getElementById("areaX");
		const ay = document.getElementById("areaY");
		const aw = document.getElementById("areaW");
		const ah = document.getElementById("areaH");
		const ac = document.getElementById("areaC");
		if (ax) ax.textContent = this.formatUnit(x1);
		if (ay) ay.textContent = this.formatUnit(y1);
		if (aw) aw.textContent = this.formatUnit(x2);
		if (ah) ah.textContent = this.formatUnit(y2);
		if (ac) ac.textContent = this.formatUnit(dist);
	}

	clearSelection() {
		this.pinnedPoint = null;
		this.measureStart = null;
		this.measureEnd = null;
		this.selectedGeometries = [];
		this.calculatedCentroid = null;
		this.currentSelectedBounds = null;
		this.boxStartWorld = null;
		this.boxEndWorld = null;
		this.updatePointFooterUI(0, 0, 0, 0);
		this.updateMeasureFooterUI(0, 0, 0, 0, 0);
		this.requestRender();
	}

	updateZoomUI() {
		const zoomBtn = document.querySelector(".option-zoom .option-select");
		if (zoomBtn) {
			const percent = Math.round((this.scale / 10) * 100);
			zoomBtn.textContent = `${percent}%`;
		}
	}

	setZoomPercent(percent) {
		if (percent === 'FIT') {
			this.fitView();
			return;
		}
		const val = parseInt(percent, 10);
		if (isNaN(val) || val <= 0) return;

		const rect = this.container.getBoundingClientRect();
		const centerX = rect.width / 2;
		const centerY = rect.height / 2;

		const targetScale = (val / 100) * 10;
		this.offsetX = centerX - (centerX - this.offsetX) * (targetScale / this.scale);
		this.offsetY = centerY - (centerY - this.offsetY) * (targetScale / this.scale);
		this.scale = targetScale;
		
		this.updateZoomUI();
		this.requestRender();
	}

	updateSidebarUI() {
		const lblCount = document.getElementById('lblLayerCount');
		const layerListEl = document.getElementById('layerList');
		if (lblCount) lblCount.textContent = this.layers.length;
		if (!layerListEl) return;

		if (this.layers.length === 0) {
			layerListEl.innerHTML = `<span class="empty-state">Chưa có layer nào.<br>Hãy kéo thả file hoặc bấm "Mở file Gerber".</span>`;
			return;
		}

		layerListEl.innerHTML = '';
		this.layers.forEach((layer, idx) => {
			const itemEl = document.createElement('div');
			itemEl.className = 'layer-item';
			itemEl.innerHTML = `
				<input type="checkbox" ${layer.visible ? 'checked' : ''} data-idx="${idx}">
				<div class="color-picker-wrapper" style="background-color: ${layer.color}">
					<input type="color" value="${layer.color}" data-idx="${idx}">
				</div>
				<div class="layer-info">
					<div class="layer-name" title="${layer.name}">${layer.name}</div>
					<div class="layer-count">${layer.items.length.toLocaleString()} đối tượng</div>
				</div>
				<button class="layer-del" data-idx="${idx}">✕</button>
			`;
			itemEl.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
				this.layers[idx].visible = e.target.checked;
				this.requestRender();
			});
			itemEl.querySelector('input[type="color"]').addEventListener('input', (e) => {
				this.layers[idx].color = e.target.value;
				itemEl.querySelector('.color-picker-wrapper').style.backgroundColor = e.target.value;
				this.requestRender();
			});
			itemEl.querySelector('.layer-del').addEventListener('click', () => {
				this.layers.splice(idx, 1);
				this.updateSidebarUI();
				this.requestRender();
			});
			layerListEl.appendChild(itemEl);
		});
	}
}

// ==========================================
// 4. QUẢN LÝ UI THEO CÔNG CỤ TOOLBAR
// ==========================================
function updateToolUI(tool) {
	const statusBoxPoint = document.getElementById("statusBoxPoint");
	const statusBoxMeasure = document.getElementById("statusBoxMeasure");
	const btnMovetozero = document.getElementById("btnMovetozero");
	const splitMovetozero = document.querySelector(".split-movetozero");

	const isPointOrArea = (tool === "selectpoint" || tool === "selectarea");

	if (statusBoxPoint) {
		statusBoxPoint.classList.toggle("hidden", !isPointOrArea);
	}
	if (statusBoxMeasure) {
		statusBoxMeasure.classList.toggle("hidden", tool !== "measure");
	}
	if (btnMovetozero) {
		btnMovetozero.classList.toggle("hidden", !isPointOrArea);
	}
	if (splitMovetozero) {
		splitMovetozero.classList.toggle("hidden", !isPointOrArea);
	}
}

// ==========================================
// 5. KHỞI TẠO VÀ RÀNG BUỘC SỰ KIỆN GIAO DIỆN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
	const viewport = new GerberViewport("canvasContainer");

	initDropdownComponent(".option-select-list");

	// Lắng nghe Đơn vị (Unit)
	document.querySelectorAll(".option-unit .option-list span").forEach(item => {
		item.addEventListener("click", () => {
			const unit = item.getAttribute("data-value");
			viewport.currentUnit = unit;
			viewport.updateMouseFooterUI();
			viewport.requestRender();
		});
	});

	// Lắng nghe chọn Zoom
	document.querySelectorAll(".option-zoom .option-list span").forEach(item => {
		item.addEventListener("click", () => {
			const rawVal = item.getAttribute("data-value");
			viewport.setZoomPercent(rawVal);
		});
	});

	// Nút Toolbar
	const toolButtons = [
		{ id: "btnMove", tool: "move", cursor: "grab" },
		{ id: "btnSelectpoint", tool: "selectpoint", cursor: "crosshair" },
		{ id: "btnSelectarea", tool: "selectarea", cursor: "crosshair" },
		{ id: "btnMeasure", tool: "measure", cursor: "crosshair" }
	];

	toolButtons.forEach(btnConfig => {
		const btn = document.getElementById(btnConfig.id);
		if (!btn) return;
		btn.addEventListener("click", () => {
			document.querySelectorAll(".toolbar button").forEach(b => b.classList.remove("active"));
			btn.classList.add("active");
			
			viewport.currentTool = btnConfig.tool;
			viewport.canvas.style.cursor = btnConfig.cursor;
			updateToolUI(btnConfig.tool);
		});
	});

	// Nút "Bỏ chọn"
	const btnUnselect = document.getElementById("btnUnselect");
	if (btnUnselect) {
		btnUnselect.addEventListener("click", () => {
			viewport.clearSelection();
		});
	}

	// Nút "Di chuyển vùng chọn về 0"
	const btnMovetozero = document.getElementById("btnMovetozero");
	if (btnMovetozero) {
		btnMovetozero.addEventListener("click", () => {
			if (!viewport.currentSelectedBounds || viewport.selectedGeometries.length === 0) {
				alert('Vui lòng dùng công cụ "Chọn 1 vùng" để khoanh vùng bôi chọn trước khi di chuyển về 0!');
				return;
			}
			const dx = -viewport.currentSelectedBounds.minX;
			const dy = -viewport.currentSelectedBounds.minY;
			viewport.shiftAllGerbers(dx, dy);
		});
	}

	// Mở file Gerber
	const importInput = document.getElementById("importGerber");
	if (importInput) {
		importInput.addEventListener("change", (e) => {
			viewport.loadFiles(e.target.files);
			importInput.value = '';
		});
	}

	// Lắng nghe Checkboxes trong Sidebar
	const chkGrid = document.getElementById("displayGrid");
	if (chkGrid) {
		chkGrid.addEventListener("change", (e) => {
			viewport.showGrid = e.target.checked;
			viewport.requestRender();
		});
	}

	const chkOrigin = document.getElementById("displayOrigin");
	if (chkOrigin) {
		chkOrigin.addEventListener("change", (e) => {
			viewport.showOrigin = e.target.checked;
			viewport.requestRender();
		});
	}

	const chkPads = document.getElementById("displayPads");
	if (chkPads) {
		chkPads.addEventListener("change", (e) => {
			viewport.showPads = e.target.checked;
			viewport.requestRender();
		});
	}

	const chkTracks = document.getElementById("displayTracks");
	if (chkTracks) {
		chkTracks.addEventListener("change", (e) => {
			viewport.showTracks = e.target.checked;
			viewport.requestRender();
		});
	}

	const chkRegions = document.getElementById("displayRegions");
	if (chkRegions) {
		chkRegions.addEventListener("change", (e) => {
			viewport.showRegions = e.target.checked;
			viewport.requestRender();
		});
	}

	updateToolUI(viewport.currentTool);
});

function initDropdownComponent(selector) {
	const dropdowns = document.querySelectorAll(selector);
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
				const text = item.textContent;
				selectBtn.textContent = text;
				optionsList.classList.remove("is-open");
			});
		});
	});

	document.addEventListener("click", () => {
		document.querySelectorAll(".option-list").forEach(list => {
			list.classList.remove("is-open");
		});
	});
}