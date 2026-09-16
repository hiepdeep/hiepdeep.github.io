/**
 * GERBER VIEWER ENGINE (RS-274X Parser & Canvas 2D Renderer)
 * Standard Vanilla JavaScript implementation
 */

console.clear();

// --- 1. GERBER RS-274X PARSER ENGINE ---
class GerberParser {
    constructor() {
        this.reset();
    }

    reset() {
        this.unitScale = 1.0; // Mặc định Millimeter (mm)
        this.xInt = 2; this.xDec = 4;
        this.yInt = 2; this.yDec = 4;
        this.zeroSuppression = 'L'; // 'L': Leading, 'T': Trailing
        this.apertures = {};
        this.currentDCode = null;
        this.currentX = 0;
        this.currentY = 0;
        this.regionMode = false;
        this.currentRegionPoints = [];
        this.commands = [];
    }

    parse(fileContent) {
        this.reset();
        const cleanText = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        let blocks = [];
        let isExtended = false;
        let extBuffer = '';
        
        for (let i = 0; i < cleanText.length; i++) {
            let ch = cleanText[i];
            if (ch === '%') {
                if (isExtended) {
                    if (extBuffer.trim()) blocks.push({ type: 'EXT', data: extBuffer.trim() });
                    extBuffer = '';
                    isExtended = false;
                } else {
                    isExtended = true;
                }
            } else {
                if (isExtended) {
                    extBuffer += ch;
                } else {
                    if (ch === '*') {
                        if (extBuffer.trim()) blocks.push({ type: 'STD', data: extBuffer.trim() });
                        extBuffer = '';
                    } else if (ch !== '\n' && ch !== '\r') {
                        extBuffer += ch;
                    }
                }
            }
        }

        for (let block of blocks) {
            if (block.type === 'EXT') {
                this.parseExtendedCommand(block.data);
            } else {
                this.parseStandardCommand(block.data);
            }
        }

        return this.commands;
    }

    parseExtendedCommand(cmd) {
        if (cmd.startsWith('MO')) {
            if (cmd.includes('IN')) this.unitScale = 25.4; // Inch -> mm
            else if (cmd.includes('MM')) this.unitScale = 1.0; // mm
        } else if (cmd.startsWith('FS')) {
            const match = /X(\d)(\d)Y(\d)(\d)/.exec(cmd);
            if (match) {
                this.xInt = parseInt(match[1]);
                this.xDec = parseInt(match[2]);
                this.yInt = parseInt(match[3]);
                this.yDec = parseInt(match[4]);
            }
            if (cmd.includes('L')) this.zeroSuppression = 'L';
            if (cmd.includes('T')) this.zeroSuppression = 'T';
        } else if (cmd.startsWith('AD')) {
            const match = /^ADD(\d+)([CROP])(?:,(.+))?$/.exec(cmd);
            if (match) {
                const dCode = 'D' + match[1];
                const shape = match[2];
                const params = match[3] ? match[3].split('X').map(v => parseFloat(v) * this.unitScale) : [];
                this.apertures[dCode] = { shape, params };
            }
        }
    }

    parseStandardCommand(cmd) {
        if (cmd.startsWith('G36')) {
            this.regionMode = true;
            this.currentRegionPoints = [];
            return;
        }
        if (cmd.startsWith('G37')) {
            this.regionMode = false;
            if (this.currentRegionPoints.length > 2) {
                this.commands.push({
                    type: 'REGION',
                    points: [...this.currentRegionPoints]
                });
            }
            this.currentRegionPoints = [];
            return;
        }

        const dSelectMatch = /^D(\d+)$/.exec(cmd);
        if (dSelectMatch && parseInt(dSelectMatch[1]) >= 10) {
            this.currentDCode = 'D' + dSelectMatch[1];
            return;
        }

        let x = this.currentX;
        let y = this.currentY;
        let iVal = 0, jVal = 0;
        let hasX = false, hasY = false;

        const xMatch = /X(-?\d+)/.exec(cmd);
        if (xMatch) {
            x = this.parseCoord(xMatch[1], this.xDec);
            hasX = true;
        }
        const yMatch = /Y(-?\d+)/.exec(cmd);
        if (yMatch) {
            y = this.parseCoord(yMatch[1], this.yDec);
            hasY = true;
        }
        const iMatch = /I(-?\d+)/.exec(cmd);
        if (iMatch) iVal = this.parseCoord(iMatch[1], this.xDec);
        
        const jMatch = /J(-?\d+)/.exec(cmd);
        if (jMatch) jVal = this.parseCoord(jMatch[1], this.yDec);

        const dOperationMatch = /D0?([123])$/.exec(cmd);
        const op = dOperationMatch ? 'D0' + dOperationMatch[1] : null;

        if (this.regionMode) {
            if (op === 'D01' || op === 'D02' || hasX || hasY) {
                this.currentX = x;
                this.currentY = y;
                this.currentRegionPoints.push({ x, y });
            }
            return;
        }

        if (op === 'D01') {
            const aperture = this.apertures[this.currentDCode];
            const width = aperture && aperture.params[0] ? aperture.params[0] : 0.2;
            
            if (cmd.includes('G02') || cmd.includes('G03')) {
                this.commands.push({
                    type: 'ARC',
                    x1: this.currentX, y1: this.currentY,
                    x2: x, y2: y,
                    i: iVal, j: jVal,
                    width: width,
                    isCCW: cmd.includes('G03')
                });
            } else {
                this.commands.push({
                    type: 'TRACK',
                    x1: this.currentX, y1: this.currentY,
                    x2: x, y2: y,
                    width: width
                });
            }
            this.currentX = x;
            this.currentY = y;
        } else if (op === 'D02') {
            this.currentX = x;
            this.currentY = y;
        } else if (op === 'D03') {
            this.currentX = x;
            this.currentY = y;
            const aperture = this.apertures[this.currentDCode];
            this.commands.push({
                type: 'PAD',
                x: x, y: y,
                aperture: aperture || { shape: 'C', params: [0.5] }
            });
        }
    }

    parseCoord(str, decDigits) {
        let isNeg = false;
        if (str.startsWith('-')) {
            isNeg = true;
            str = str.substring(1);
        } else if (str.startsWith('+')) {
            str = str.substring(1);
        }
        
        while (str.length < decDigits + 1) {
            str = '0' + str;
        }
        
        const intPart = str.substring(0, str.length - decDigits);
        const decPart = str.substring(str.length - decDigits);
        let val = parseFloat((intPart || '0') + '.' + decPart) * this.unitScale;
        return isNeg ? -val : val;
    }
}


// --- 2. GERBER VIEWER APPLICATION CONTROLLER ---
class GerberViewerApp {
    constructor() {
        this.layers = [];
        this.activeTool = 'move'; // 'move', 'selectpoint', 'selectarea', 'measure'
        this.selectedUnit = 'mm';
        
        // Transform Matrix Props
        this.scale = 10; // Pixels per MM
        this.offsetX = 0;
        this.offsetY = 0;

        // Mouse Interaction States
        this.isMouseDown = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.mouseWorldX = 0;
        this.mouseWorldY = 0;

        // Active Selections
        this.selectedPoint = null;
        this.selectedArea = null;
        this.measureLine = null;

        // Toggles
        this.displaySettings = {
            grid: true,
            origin: true,
            pads: true,
            tracks: true,
            regions: true
        };

        this.colorPalette = ['#00FFcc', '#FF0055', '#FFCC00', '#0099FF', '#CC00FF', '#00FF33'];

        this.initDOM();
        this.initCanvas();
        this.initEvents();
        this.initDropdowns();
        this.render();
    }

    initDOM() {
        this.canvasContainer = document.getElementById('canvasContainer');
        this.canvas = document.createElement('canvas');
        this.canvasContainer.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.lblLayerCount = document.getElementById('lblLayerCount');
        this.layerListEl = document.getElementById('layerList');
        this.importInput = document.getElementById('importGerber');

        // Status Elements
        this.realtimeX = document.getElementById('realtimeX');
        this.realtimeY = document.getElementById('realtimeY');
        
        this.boxArea = document.getElementById('boxArea');
        this.pointX = document.getElementById('pointX');
        this.pointY = document.getElementById('pointY');
        this.pointW = document.getElementById('pointW');
        this.pointH = document.getElementById('pointH');

        this.boxMeasure = document.getElementById('boxMeasure');
        this.areaX = document.getElementById('areaX');
        this.areaY = document.getElementById('areaY');
        this.areaW = document.getElementById('areaW');
        this.areaH = document.getElementById('areaH');
        this.areaC = document.getElementById('areaC');

        // Toolbar Buttons
        this.btnMove = document.getElementById('btnMove');
        this.btnSelectpoint = document.getElementById('btnSelectpoint');
        this.btnSelectarea = document.getElementById('btnSelectarea');
        this.btnMeasure = document.getElementById('btnMeasure');
        this.btnUnselect = document.getElementById('btnUnselect');
        this.btnMovetozero = document.getElementById('btnMovetozero');

        this.updateToolButtons();
    }

    initCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const rect = this.canvasContainer.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        if (this.layers.length === 0) {
            this.offsetX = this.canvas.width / 2;
            this.offsetY = this.canvas.height / 2;
        }
        this.render();
    }

    initEvents() {
        // File Import & Drag-Drop
        this.importInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));
        
        const dragTarget = document.querySelector('.sidebar');
        dragTarget.addEventListener('dragover', (e) => e.preventDefault());
        dragTarget.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files) this.handleFileSelect(e.dataTransfer.files);
        });

        // Settings Checkboxes Sync
        const settingsMap = {
            displayGrid: 'grid',
            displayOrigin: 'origin',
            displayPads: 'pads',
            displayTracks: 'tracks',
            displayRegions: 'regions'
        };

        Object.keys(settingsMap).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    this.displaySettings[settingsMap[id]] = e.target.checked;
                    this.render();
                });
            }
        });

        // Toolbar Button Handlers
        this.btnMove.addEventListener('click', () => this.setTool('move'));
        this.btnSelectpoint.addEventListener('click', () => this.setTool('selectpoint'));
        this.btnSelectarea.addEventListener('click', () => this.setTool('selectarea'));
        this.btnMeasure.addEventListener('click', () => this.setTool('measure'));
        
        this.btnUnselect.addEventListener('click', () => {
            if (this.btnUnselect.classList.contains('not-allowed')) return;
            this.selectedPoint = null;
            this.selectedArea = null;
            this.measureLine = null;
            this.updateToolButtons();
            this.updateToolBoxes();
            this.render();
        });

        this.btnMovetozero.addEventListener('click', () => {
            if (this.btnMovetozero.classList.contains('not-allowed')) return;
            this.moveSelectionToZero();
        });

        // Canvas Interactions
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    }

    initDropdowns() {
        document.querySelectorAll('.option-select-list').forEach(container => {
            const selectBtn = container.querySelector('.toggle-dropdown');
            const optionsList = container.querySelector('.option-list');
            const items = container.querySelectorAll('.option-list span');

            if (!selectBtn || !optionsList) return;

            selectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.option-list').forEach(l => {
                    if (l !== optionsList) l.classList.remove('is-open');
                });
                optionsList.classList.toggle('is-open');
            });

            items.forEach(item => {
                item.addEventListener('click', () => {
                    const value = item.getAttribute('data-value');
                    const text = item.textContent;
                    selectBtn.textContent = text;
                    optionsList.classList.remove('is-open');

                    if (container.classList.contains('option-unit')) {
                        this.selectedUnit = value;
                        this.updateCoordinatesDisplay();
                        this.render();
                    } else if (container.classList.contains('option-zoom')) {
                        this.handleZoomOption(value);
                    }
                });
            });
        });

        document.addEventListener('click', () => {
            document.querySelectorAll('.option-list').forEach(l => l.classList.remove('is-open'));
        });
    }

    setTool(tool) {
        this.activeTool = tool;
        this.updateToolButtons();
        this.updateToolBoxes();
        this.render();
    }

    updateToolButtons() {
        [this.btnMove, this.btnSelectpoint, this.btnSelectarea, this.btnMeasure].forEach(b => b.classList.remove('active'));
        
        if (this.activeTool === 'move') this.btnMove.classList.add('active');
        if (this.activeTool === 'selectpoint') this.btnSelectpoint.classList.add('active');
        if (this.activeTool === 'selectarea') this.btnSelectarea.classList.add('active');
        if (this.activeTool === 'measure') this.btnMeasure.classList.add('active');

        // Cập nhật trạng thái nút Bỏ chọn (btnUnselect)
        const hasSelection = this.selectedPoint || this.selectedArea || this.measureLine;
        const isInteractive = ['selectpoint', 'selectarea', 'measure'].includes(this.activeTool);
        if (isInteractive || hasSelection) {
            this.btnUnselect.classList.remove('not-allowed');
        } else {
            this.btnUnselect.classList.add('not-allowed');
        }
        
        // Cập nhật trạng thái nút Di chuyển vùng chọn về 0 (btnMovetozero)
        if (this.activeTool === 'selectarea' && this.selectedArea) {
            this.btnMovetozero.classList.remove('not-allowed');
        } else {
            this.btnMovetozero.classList.add('not-allowed');
        }
    }

    updateToolBoxes() {
        this.boxArea.style.display = (this.activeTool === 'selectpoint' || this.activeTool === 'selectarea') ? 'flex' : 'none';
        this.boxMeasure.style.display = (this.activeTool === 'measure') ? 'flex' : 'none';
        this.updateCoordinatesDisplay();
    }

    worldToScreen(wx, wy) {
        const sx = this.offsetX + wx * this.scale;
        const sy = this.offsetY - wy * this.scale;
        return { x: sx, y: sy };
    }

    screenToWorld(sx, sy) {
        const wx = (sx - this.offsetX) / this.scale;
        const wy = (this.offsetY - sy) / this.scale;
        return { x: wx, y: wy };
    }

    formatUnit(mmValue) {
        let val = mmValue;
        let suffix = this.selectedUnit;
        switch (this.selectedUnit) {
            case 'cm': val = mmValue / 10; break;
            case 'mils': val = mmValue * 39.3700787; suffix = 'mil'; break;
            case 'inch': val = mmValue / 25.4; suffix = 'in'; break;
            case 'micron': val = mmValue * 1000; suffix = 'µm'; break;
            case 'mm': default: val = mmValue; suffix = 'mm'; break;
        }
        return val.toFixed(4) + suffix;
    }

    updateCoordinatesDisplay() {
        this.realtimeX.textContent = this.formatUnit(this.mouseWorldX);
        this.realtimeY.textContent = this.formatUnit(this.mouseWorldY);

        if (this.selectedPoint) {
            this.pointX.textContent = this.formatUnit(this.selectedPoint.x);
            this.pointY.textContent = this.formatUnit(this.selectedPoint.y);
            this.pointW.textContent = this.formatUnit(0);
            this.pointH.textContent = this.formatUnit(0);
        } else if (this.selectedArea) {
            const minX = Math.min(this.selectedArea.x1, this.selectedArea.x2);
            const minY = Math.min(this.selectedArea.y1, this.selectedArea.y2);
            const w = Math.abs(this.selectedArea.x2 - this.selectedArea.x1);
            const h = Math.abs(this.selectedArea.y2 - this.selectedArea.y1);
            this.pointX.textContent = this.formatUnit(minX);
            this.pointY.textContent = this.formatUnit(minY);
            this.pointW.textContent = this.formatUnit(w);
            this.pointH.textContent = this.formatUnit(h);
        }

        if (this.measureLine) {
            const dx = this.measureLine.x2 - this.measureLine.x1;
            const dy = this.measureLine.y2 - this.measureLine.y1;
            const dist = Math.hypot(dx, dy);
            this.areaX.textContent = this.formatUnit(this.measureLine.x1);
            this.areaY.textContent = this.formatUnit(this.measureLine.y1);
            this.areaW.textContent = this.formatUnit(this.measureLine.x2);
            this.areaH.textContent = this.formatUnit(this.measureLine.y2);
            this.areaC.textContent = this.formatUnit(dist);
        }
    }

    onMouseDown(e) {
        this.isMouseDown = true;
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        this.dragStartX = mouseX;
        this.dragStartY = mouseY;

        const worldPos = this.screenToWorld(mouseX, mouseY);

        if (this.activeTool === 'selectpoint') {
            this.selectedPoint = { x: worldPos.x, y: worldPos.y };
            this.selectedArea = null;
        } else if (this.activeTool === 'selectarea') {
            this.selectedArea = { x1: worldPos.x, y1: worldPos.y, x2: worldPos.x, y2: worldPos.y };
            this.selectedPoint = null;
        } else if (this.activeTool === 'measure') {
            this.measureLine = { x1: worldPos.x, y1: worldPos.y, x2: worldPos.x, y2: worldPos.y };
        }

        this.updateToolButtons();
        this.updateToolBoxes();
        this.render();
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldPos = this.screenToWorld(mouseX, mouseY);
        this.mouseWorldX = worldPos.x;
        this.mouseWorldY = worldPos.y;

        this.updateCoordinatesDisplay();

        if (this.isMouseDown) {
            if (this.activeTool === 'move') {
                const dx = mouseX - this.dragStartX;
                const dy = mouseY - this.dragStartY;
                this.offsetX += dx;
                this.offsetY += dy;
                this.dragStartX = mouseX;
                this.dragStartY = mouseY;
            } else if (this.activeTool === 'selectarea' && this.selectedArea) {
                this.selectedArea.x2 = worldPos.x;
                this.selectedArea.y2 = worldPos.y;
                this.updateToolBoxes();
            } else if (this.activeTool === 'measure' && this.measureLine) {
                this.measureLine.x2 = worldPos.x;
                this.measureLine.y2 = worldPos.y;
                this.updateToolBoxes();
            }
            this.render();
        }
    }

    onMouseUp() {
        this.isMouseDown = false;
        this.updateToolButtons();
    }

    onWheel(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldBefore = this.screenToWorld(mouseX, mouseY);
        this.scale *= zoomFactor;
        const worldAfter = this.screenToWorld(mouseX, mouseY);

        this.offsetX += (worldAfter.x - worldBefore.x) * this.scale;
        this.offsetY -= (worldAfter.y - worldBefore.y) * this.scale;

        this.updateZoomDropdownText();
        this.render();
    }

    handleZoomOption(value) {
        if (value === '0%') {
            this.autoFitToScreen();
            return;
        }
        const pct = parseFloat(value);
        if (!isNaN(pct) && pct > 0) {
            this.scale = (pct / 100) * 10;
            this.render();
        }
    }

    updateZoomDropdownText() {
        const pct = Math.round((this.scale / 10) * 100);
        const dropdown = document.querySelector('.option-zoom .toggle-dropdown');
        if (dropdown) dropdown.textContent = `${pct}%`;
    }

    async handleFileSelect(files) {
        if (!files || files.length === 0) return;

        const emptyState = this.layerListEl.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        for (let file of files) {
            const text = await file.text();
            const parser = new GerberParser();
            const commands = parser.parse(text);

            const color = this.colorPalette[this.layers.length % this.colorPalette.length];
            const layer = {
                id: 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                name: file.name,
                color: color,
                visible: true,
                commands: commands
            };

            this.layers.push(layer);
            this.addLayerToUI(layer);
        }

        this.lblLayerCount.textContent = this.layers.length;
        this.autoFitToScreen();
    }

    addLayerToUI(layer) {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 6px; background: #1a1a20; border: 1px solid #282830; border-radius: 4px; margin-bottom: 6px;';
        item.dataset.id = layer.id;

        item.innerHTML = `
            <input type="checkbox" checked style="cursor: pointer;">
            <div style="width: 12px; height: 12px; border-radius: 2px; background: ${layer.color}; flex-shrink: 0;"></div>
            <span style="flex: 1; color: #d1d5db; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${layer.name}">${layer.name}</span>
            <button class="btn-remove" style="background: transparent; border: none; color: #ef4444; cursor: pointer; font-weight: bold; font-size: 14px;">×</button>
        `;

        item.querySelector('input').addEventListener('change', (e) => {
            layer.visible = e.target.checked;
            this.render();
        });

        item.querySelector('.btn-remove').addEventListener('click', () => {
            this.layers = this.layers.filter(l => l.id !== layer.id);
            item.remove();
            this.lblLayerCount.textContent = this.layers.length;
            if (this.layers.length === 0) {
                this.layerListEl.innerHTML = '<span class="empty-state">Chưa có layer nào.<br>Hãy kéo thả file hoặc bấm "Mở file Gerber".</span>';
            }
            this.render();
        });

        this.layerListEl.appendChild(item);
    }

    moveSelectionToZero() {
        if (!this.selectedArea) return;

        const minX = Math.min(this.selectedArea.x1, this.selectedArea.x2);
        const minY = Math.min(this.selectedArea.y1, this.selectedArea.y2);

        this.layers.forEach(layer => {
            layer.commands.forEach(cmd => {
                if (cmd.type === 'PAD') {
                    cmd.x -= minX;
                    cmd.y -= minY;
                } else if (cmd.type === 'TRACK' || cmd.type === 'ARC') {
                    cmd.x1 -= minX; cmd.y1 -= minY;
                    cmd.x2 -= minX; cmd.y2 -= minY;
                } else if (cmd.type === 'REGION') {
                    cmd.points.forEach(p => {
                        p.x -= minX;
                        p.y -= minY;
                    });
                }
            });
        });

        const w = Math.abs(this.selectedArea.x2 - this.selectedArea.x1);
        const h = Math.abs(this.selectedArea.y2 - this.selectedArea.y1);
        this.selectedArea = { x1: 0, y1: 0, x2: w, y2: h };

        this.updateToolBoxes();
        this.render();
    }

    autoFitToScreen() {
        if (this.layers.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        this.layers.forEach(layer => {
            layer.commands.forEach(cmd => {
                if (cmd.type === 'PAD') {
                    minX = Math.min(minX, cmd.x); maxX = Math.max(maxX, cmd.x);
                    minY = Math.min(minY, cmd.y); maxY = Math.max(maxY, cmd.y);
                } else if (cmd.type === 'TRACK' || cmd.type === 'ARC') {
                    minX = Math.min(minX, cmd.x1, cmd.x2); maxX = Math.max(maxX, cmd.x1, cmd.x2);
                    minY = Math.min(minY, cmd.y1, cmd.y2); maxY = Math.max(maxY, cmd.y1, cmd.y2);
                } else if (cmd.type === 'REGION') {
                    cmd.points.forEach(p => {
                        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                    });
                }
            });
        });

        if (minX === Infinity) return;

        const boundingWidth = maxX - minX || 10;
        const boundingHeight = maxY - minY || 10;

        const padding = 40;
        const scaleX = (this.canvas.width - padding * 2) / boundingWidth;
        const scaleY = (this.canvas.height - padding * 2) / boundingHeight;
        
        this.scale = Math.min(scaleX, scaleY);
        
        const centerWorldX = (minX + maxX) / 2;
        const centerWorldY = (minY + maxY) / 2;

        this.offsetX = this.canvas.width / 2 - centerWorldX * this.scale;
        this.offsetY = this.canvas.height / 2 + centerWorldY * this.scale;

        this.updateZoomDropdownText();
        this.render();
    }

    // --- 3. RENDER ENGINE (CANVAS 2D) ---
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Render Grid
        if (this.displaySettings.grid) this.drawGrid();

        // 2. Render Origin (0,0)
        if (this.displaySettings.origin) this.drawOrigin();

        // 3. Render Layers Primitives
        this.layers.forEach(layer => {
            if (!layer.visible) return;
            this.ctx.fillStyle = layer.color;
            this.ctx.strokeStyle = layer.color;
            
            this.ctx.globalCompositeOperation = 'screen';
            
            layer.commands.forEach(cmd => {
                if (cmd.type === 'PAD' && this.displaySettings.pads) {
                    this.drawPad(cmd);
                } else if (cmd.type === 'TRACK' && this.displaySettings.tracks) {
                    this.drawTrack(cmd);
                } else if (cmd.type === 'ARC' && this.displaySettings.tracks) {
                    this.drawArc(cmd);
                } else if (cmd.type === 'REGION' && this.displaySettings.regions) {
                    this.drawRegion(cmd);
                }
            });
        });

        this.ctx.globalCompositeOperation = 'source-over';

        // 4. Render Active Tool Overlays
        this.drawOverlays();
    }

    drawGrid() {
        this.ctx.save();
        this.ctx.strokeStyle = '#1e1e28';
        this.ctx.lineWidth = 1;

        const step = 10 * this.scale; // Lưới 10mm

        if (step > 6) {
            const startX = this.offsetX % step;
            const startY = this.offsetY % step;

            this.ctx.beginPath();
            for (let x = startX; x < this.canvas.width; x += step) {
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.canvas.height);
            }
            for (let y = startY; y < this.canvas.height; y += step) {
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.canvas.width, y);
            }
            this.ctx.stroke();
        }
        this.ctx.restore();
    }

    drawOrigin() {
        this.ctx.save();
        const originScreen = this.worldToScreen(0, 0);

        this.ctx.lineWidth = 1.5;

        // Trục X (Đỏ)
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.beginPath();
        this.ctx.moveTo(0, originScreen.y);
        this.ctx.lineTo(this.canvas.width, originScreen.y);
        this.ctx.stroke();

        // Trục Y (Xanh lá)
        this.ctx.strokeStyle = '#10b981';
        this.ctx.beginPath();
        this.ctx.moveTo(originScreen.x, 0);
        this.ctx.lineTo(originScreen.x, this.canvas.height);
        this.ctx.stroke();

        // Tâm Gốc (0,0)
        this.ctx.fillStyle = '#f59e0b';
        this.ctx.beginPath();
        this.ctx.arc(originScreen.x, originScreen.y, 5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    drawPad(cmd) {
        const pos = this.worldToScreen(cmd.x, cmd.y);
        const shape = cmd.aperture ? cmd.aperture.shape : 'C';
        const params = cmd.aperture ? cmd.aperture.params : [0.5];

        this.ctx.beginPath();
        if (shape === 'C') {
            const radius = (params[0] / 2) * this.scale;
            this.ctx.arc(pos.x, pos.y, Math.max(radius, 0.5), 0, Math.PI * 2);
            this.ctx.fill();
        } else if (shape === 'R' || shape === 'O') {
            const w = (params[0] || 0.5) * this.scale;
            const h = (params[1] || params[0] || 0.5) * this.scale;
            this.ctx.fillRect(pos.x - w / 2, pos.y - h / 2, w, h);
        } else if (shape === 'P') {
            const outerR = (params[0] / 2) * this.scale;
            const sides = params[1] || 5;
            this.ctx.moveTo(pos.x + outerR * Math.cos(0), pos.y + outerR * Math.sin(0));
            for (let i = 1; i <= sides; i++) {
                const angle = (i * 2 * Math.PI) / sides;
                this.ctx.lineTo(pos.x + outerR * Math.cos(angle), pos.y + outerR * Math.sin(angle));
            }
            this.ctx.closePath();
            this.ctx.fill();
        }
    }

    drawTrack(cmd) {
        const p1 = this.worldToScreen(cmd.x1, cmd.y1);
        const p2 = this.worldToScreen(cmd.x2, cmd.y2);
        const width = Math.max(cmd.width * this.scale, 1);

        this.ctx.beginPath();
        this.ctx.lineCap = 'round';
        this.ctx.lineWidth = width;
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
    }

    drawArc(cmd) {
        const p1 = this.worldToScreen(cmd.x1, cmd.y1);
        const p2 = this.worldToScreen(cmd.x2, cmd.y2);
        const width = Math.max(cmd.width * this.scale, 1);

        const centerX = cmd.x1 + cmd.i;
        const centerY = cmd.y1 + cmd.j;
        const centerScreen = this.worldToScreen(centerX, centerY);

        const radius = Math.hypot(cmd.i, cmd.j) * this.scale;
        const startAngle = Math.atan2(p1.y - centerScreen.y, p1.x - centerScreen.x);
        const endAngle = Math.atan2(p2.y - centerScreen.y, p2.x - centerScreen.x);

        this.ctx.beginPath();
        this.ctx.lineWidth = width;
        this.ctx.arc(centerScreen.x, centerScreen.y, radius, startAngle, endAngle, cmd.isCCW);
        this.ctx.stroke();
    }

    drawRegion(cmd) {
        if (!cmd.points || cmd.points.length < 3) return;

        this.ctx.beginPath();
        const start = this.worldToScreen(cmd.points[0].x, cmd.points[0].y);
        this.ctx.moveTo(start.x, start.y);

        for (let i = 1; i < cmd.points.length; i++) {
            const p = this.worldToScreen(cmd.points[i].x, cmd.points[i].y);
            this.ctx.lineTo(p.x, p.y);
        }
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawOverlays() {
        this.ctx.save();

        if (this.selectedPoint) {
            const p = this.worldToScreen(this.selectedPoint.x, this.selectedPoint.y);
            this.ctx.strokeStyle = '#0284c7';
            this.ctx.fillStyle = '#0284c7';
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            this.ctx.fill();
        }

        if (this.selectedArea) {
            const p1 = this.worldToScreen(this.selectedArea.x1, this.selectedArea.y1);
            const p2 = this.worldToScreen(this.selectedArea.x2, this.selectedArea.y2);

            const x = Math.min(p1.x, p2.x);
            const y = Math.min(p1.y, p2.y);
            const w = Math.abs(p2.x - p1.x);
            const h = Math.abs(p2.y - p1.y);

            this.ctx.strokeStyle = '#0284c7';
            this.ctx.fillStyle = 'rgba(2, 132, 199, 0.2)';
            this.ctx.lineWidth = 1.5;
            this.ctx.setLineDash([4, 4]);
            this.ctx.fillRect(x, y, w, h);
            this.ctx.strokeRect(x, y, w, h);
        }

        if (this.measureLine) {
            const p1 = this.worldToScreen(this.measureLine.x1, this.measureLine.y1);
            const p2 = this.worldToScreen(this.measureLine.x2, this.measureLine.y2);

            this.ctx.strokeStyle = '#ef4444';
            this.ctx.fillStyle = '#ef4444';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([2, 2]);

            this.ctx.beginPath();
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
            this.ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new GerberViewerApp();
});