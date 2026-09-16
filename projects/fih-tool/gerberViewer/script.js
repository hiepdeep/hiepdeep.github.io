console.clear();
console.log("Gerber Viewer V01 Engine Loaded");

// ==========================================
// 1. CẤU HÌNH ĐƠN VỊ VÀ ĐỔI ĐƠN VỊ TỌA ĐỘ
// ==========================================
const UNIT_FACTORS = {
	mm: 1.0,           // Đơn vị gốc chuẩn là mm
	cm: 0.1,
	mils: 39.3700787,
	inch: 0.0393700787,
	micron: 1000.0
};

const UNIT_DECIMALS = {
	mm: 4,
	cm: 5,
	mils: 2,
	inch: 5,
	micron: 1
};

// ==========================================
// 2. VIEWPORT & RENDER STATE
// ==========================================
class GerberViewport {
	constructor(containerId) {
		this.container = document.getElementById(containerId);
		this.canvas = document.createElement("canvas");
		this.ctx = this.canvas.getContext("2d");
		this.container.appendChild(this.canvas);

		// Trạng thái Viewport
		this.scale = 10;          // 10 pixels = 1mm mặc định
		this.offsetX = 0;         // Tọa độ X màn hình của gốc (0,0)
		this.offsetY = 0;         // Tọa độ Y màn hình của gốc (0,0)
		
		// Trạng thái thao tác chuột
		this.isPanning = false;
		this.startX = 0;
		this.startY = 0;
		this.currentTool = "move"; // 'move', 'selectpoint', 'selectarea', 'measure'
		
		// Đơn vị hiện tại
		this.currentUnit = "mm";
		
		// Tọa độ con trỏ chuột thực tế (World Space - mm)
		this.mouseWorldX = 0;
		this.mouseWorldY = 0;

		// Cài đặt hiển thị
		this.showGrid = true;
		this.showOrigin = true;

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

	    // Kích thước Pixel thực tế dùng để render (HiDPI)
	    this.canvas.width = rect.width * dpr;
	    this.canvas.height = rect.height * dpr;

	    // Kích thước CSS layout: Để 100% và display: block để không bị đè Flexbox & không tràn baseline
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

	// ------------------------------------------
	// CHUYỂN ĐỔI TỌA ĐỘ (WORLD <-> SCREEN)
	// Trục Y của Gerber hướng LÊN TRÊN (+Y up)
	// Trục Y của Canvas hướng XUỐNG DƯỚI (+Y down)
	// ------------------------------------------
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
		const factor = UNIT_FACTORS[unit] || 1;
		const decimals = UNIT_DECIMALS[unit] || 4;
		const val = valMm * factor;
		return `${val.toFixed(decimals)}${unit === 'micron' ? 'µm' : unit}`;
	}

	// ------------------------------------------
	// XỬ LÝ SỰ KIỆN CHUỘT & ZOOM/PAN
	// ------------------------------------------
	bindEvents() {
		// Cuộn chuột để Zoom tại vị trí con trỏ
		this.canvas.addEventListener("wheel", (e) => {
			e.preventDefault();
			const rect = this.canvas.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;

			const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
			const newScale = Math.min(Math.max(this.scale * zoomFactor, 0.1), 5000);

			// Giữ tâm zoom tại vị trí con trỏ chuột
			this.offsetX = mouseX - (mouseX - this.offsetX) * (newScale / this.scale);
			this.offsetY = mouseY - (mouseY - this.offsetY) * (newScale / this.scale);
			this.scale = newScale;

			this.updateZoomUI();
			this.requestRender();
		}, { passive: false });

		// Nhấp/Kéo chuột
		this.canvas.addEventListener("mousedown", (e) => {
			// Click chuột giữa hoặc công cụ 'Move' được chọn -> Cho phép Pan
			if (e.button === 1 || (e.button === 0 && this.currentTool === "move")) {
				this.isPanning = true;
				this.startX = e.clientX - this.offsetX;
				this.startY = e.clientY - this.offsetY;
				this.canvas.style.cursor = "grabbing";
			}
		});

		window.addEventListener("mousemove", (e) => {
			const rect = this.canvas.getBoundingClientRect();
			const screenX = e.clientX - rect.left;
			const screenY = e.clientY - rect.top;

			// Cập nhật vị trí chuột thực tế
			const worldPos = this.screenToWorld(screenX, screenY);
			this.mouseWorldX = worldPos.x;
			this.mouseWorldY = worldPos.y;

			// Cập nhật footer realtime coordinates
			this.updateMouseFooterUI();

			// Kéo di chuyển bản vẽ (Pan)
			if (this.isPanning) {
				this.offsetX = e.clientX - this.startX;
				this.offsetY = e.clientY - this.startY;
				this.requestRender();
			}
		});

		window.addEventListener("mouseup", (e) => {
			if (this.isPanning) {
				this.isPanning = false;
				this.canvas.style.cursor = this.currentTool === "move" ? "grab" : "crosshair";
			}
		});
	}

	// ------------------------------------------
	// VẼ LƯỚI & TRỤC GỐC TỌA ĐỘ
	// ------------------------------------------
	render() {
		const dpr = window.devicePixelRatio || 1;
		const width = this.canvas.width / dpr;
		const height = this.canvas.height / dpr;

		this.ctx.save();
		this.ctx.scale(dpr, dpr);

		// Clear background
		this.ctx.fillStyle = "#000000";
		this.ctx.fillRect(0, 0, width, height);

		// 1. Vẽ Lưới (Grid)
		if (this.showGrid) {
			this.drawGrid(width, height);
		}

		// 2. Vẽ Trục gốc (Origin 0,0)
		if (this.showOrigin) {
			this.drawOrigin();
		}

		this.ctx.restore();
	}

	drawGrid(width, height) {
		// Tự động tính bước lưới linh hoạt theo độ zoom (1mm, 5mm, 10mm, 50mm...)
		const minGridPixel = 40; // Khoảng cách pixel tối thiểu giữa 2 đường lưới
		let gridSpacingWorld = 1; // mm
		
		const steps = [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 20, 50, 100, 500];
		for (let s of steps) {
			if (s * this.scale >= minGridPixel) {
				gridSpacingWorld = s;
				break;
			}
		}

		const gridPixel = gridSpacingWorld * this.scale;

		// Tính điểm bắt đầu lưới
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
		const screenOrigin = this.worldToScreen(0, 0);
		const x = screenOrigin.x;
		const y = screenOrigin.y;

		this.ctx.save();
		
		// Trục X (Đỏ) & Trục Y (Xanh lá)
		this.ctx.lineWidth = 1.5;

		// Trục X
		this.ctx.beginPath();
		this.ctx.strokeStyle = "#ef4444";
		this.ctx.moveTo(x, y);
		this.ctx.lineTo(x + 40, y);
		this.ctx.stroke();

		// Trục Y
		this.ctx.beginPath();
		this.ctx.strokeStyle = "#22c55e";
		this.ctx.moveTo(x, y);
		this.ctx.lineTo(x, y - 40); // Hướng lên
		this.ctx.stroke();

		// Tâm hình tròn gốc (0,0)
		this.ctx.beginPath();
		this.ctx.strokeStyle = "#3b82f6";
		this.ctx.arc(x, y, 6, 0, Math.PI * 2);
		this.ctx.stroke();

		this.ctx.restore();
	}

	requestRender() {
		requestAnimationFrame(() => this.render());
	}

	// ------------------------------------------
	// ĐỒNG BỘ HIỂN THỊ LÊN UI FOOTER
	// ------------------------------------------
	updateMouseFooterUI() {
		const elX = document.getElementById("realtimeX");
		const elY = document.getElementById("realtimeY");
		if (elX) elX.textContent = this.formatUnit(this.mouseWorldX);
		if (elY) elY.textContent = this.formatUnit(this.mouseWorldY);
	}

	updateZoomUI() {
		const zoomBtn = document.querySelector(".option-zoom .option-select");
		if (zoomBtn) {
			const percent = Math.round((this.scale / 10) * 100);
			zoomBtn.textContent = `${percent}%`;
		}
	}

	setZoomPercent(percent) {
		const rect = this.container.getBoundingClientRect();
		const centerX = rect.width / 2;
		const centerY = rect.height / 2;

		const targetScale = (percent / 100) * 10;
		this.offsetX = centerX - (centerX - this.offsetX) * (targetScale / this.scale);
		this.offsetY = centerY - (centerY - this.offsetY) * (targetScale / this.scale);
		this.scale = targetScale;
		
		this.updateZoomUI();
		this.requestRender();
	}
}

// ==========================================
// 3. KHỞI TẠO VÀ BẮT SỰ KIỆN GIAO DIỆN UI
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
	// Khởi tạo Viewport
	const viewport = new GerberViewport("canvasContainer");

	// --- 3.1 Dropdown & Component ---
	initDropdownComponent(".option-select-list");

	// Lắng nghe đổi Đơn vị (Unit)
	document.querySelectorAll(".option-unit .option-list span").forEach(item => {
		item.addEventListener("click", () => {
			const unit = item.getAttribute("data-value");
			viewport.currentUnit = unit;
			viewport.updateMouseFooterUI();
		});
	});

	// Lắng nghe chọn mức Zoom từ dropdown
	document.querySelectorAll(".option-zoom .option-list span").forEach(item => {
		item.addEventListener("click", () => {
			const rawVal = item.getAttribute("data-value");
			const percent = parseInt(rawVal, 10);
			if (!isNaN(percent) && percent > 0) {
				viewport.setZoomPercent(percent);
			}
		});
	});

	// --- 3.2 Lắng nghe Toolbar (Nút công cụ) ---
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
		});
	});

	// --- 3.3 Lắng nghe Sidebar Checkboxes (Lưới & Trục Gốc) ---
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