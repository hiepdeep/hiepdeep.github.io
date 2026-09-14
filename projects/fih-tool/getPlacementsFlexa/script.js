console.clear();
console.log("Mã được tạo vào ngày 14/09/2026 bởi HiepDz");
console.log("");
console.log("Hướng dẫn sử dụng:");
console.log("1. Tải lên file BOM.");
console.log("2. Tải lên file CAD (Nếu là hàng Telit thì ấn nút 'Telit Format'.");
console.log("3. Ấn nút 'Generator'.");
console.log("4. Điền ô 'Assign', 'Side'.");
console.log("5. Ấn nút 'Select Mode' và giữ chuột phải quét 1 điểm và ấn nút 'Get FD1' để tạo điểm Mark 1. Ấn nút 'Clear select' để bỏ chọn và quét điểm Mark 2.");
console.log("6. Ấn nút 'Clear select' để bỏ chọn và phóng to 1 panel và quét chọn để lấy 1 panel.");
console.log("7. Ấn nút 'Export' để tạo bảng dữ liệu.");
console.log("8. Ấn vào bảng dữ liệu đã tạo và Ctrl+C để sao chép dữ liệu rồi ném vào chương trình Director.");

// Khai báo tên biến Element, trạng thái dữ liệu
const btnImports = document.getElementsByClassName("btn-import");
const txtImports = document.getElementsByClassName("txt-import");
const btnExport = document.getElementById("btn-generator");
const txtExport = document.getElementById("txt-generator");
const table_basic = document.getElementById("txtExportTable-basic");
const table_all = document.getElementById("txtExportTable-all");
const rotate90 = document.getElementById("btn-turn90deg");
const txtAssign = document.getElementById("setAssign");
const txtSide = document.getElementById("setSide");
const txtMark_X1 = document.getElementById("mark-x1");
const txtMark_Y1 = document.getElementById("mark-y1");
const txtMark_X2 = document.getElementById("mark-x2");
const txtMark_Y2 = document.getElementById("mark-y2");
const getMark_1 = document.getElementById("getMark1");
const getMark_2 = document.getElementById("getMark2");
const selectMode = document.getElementById("selectMode");
const clearSelect = document.getElementById("btn-clearSelect");
const myCanvas = document.getElementById("myCanvas");
const exportTableAll = document.getElementById("btn-exportTable");
let $cads = 0, $cad = 0, $uncad = 0;
let cadOriginalData = { headers: [], rows: [] };
let boardData = [];
const ctx = myCanvas.getContext("2d");
let origMinX = 0, origMinY = 0;
let boardBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 }; // Cache Bounding Box
let zoomLevel = 1.0;
let panOffset = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let isSelecting = false;
let selectStart = { x: 0, y: 0 };
let selectEnd = { x: 0, y: 0 };

// Chuyển Tab
for (let i = 0; i < btnImports.length; i++) {
	btnImports[i].addEventListener("click", (e) => {
		e.preventDefault();
		for (let j = 0; j < btnImports.length; j++) {
			btnImports[j].classList.remove("active");
			txtImports[j].classList.remove("active");
		}
		btnExport.classList.remove("active");
		txtExport.classList.remove("active");
		btnImports[i].classList.add("active");
		txtImports[i].classList.add("active");
	});
}

// Xử lý file BOMs
document.getElementById("addBOMs").addEventListener("change", function() {
	let file = this.files[0];
	if (!file) return;
	let reader = new FileReader();
	reader.onload = function(e) {
		let rawText = e.target.result;
		let startIndex = rawText.indexOf("|Lev|");
		if (startIndex === -1) {
			alert("Không tìm thấy dòng tiêu đề '|Lev|' trong file!");
			return;
		}
		let lines = rawText.slice(startIndex).split("\n");
		let parsedRows = [], headers = [];
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i].trim();
			if (!line || line.startsWith("|-") || line.startsWith("-")) continue;
			let cells = line.split("|").slice(1, -1).map(cell => cell.trim());
			if (headers.length === 0) headers = cells;
			else parsedRows.push(cells);
		}
		let quantityIndex = 6, schemaRefIndex = 8, qtyCount = 0;
		headers.forEach((h, c) => {
			if (h === "Quantity" && ++qtyCount === 2) quantityIndex = c;
			if (h === "Schema ref") schemaRefIndex = c;
		});
		let filteredRows = parsedRows.filter(row => (row[quantityIndex] || "") === "1,00" && (row[schemaRefIndex] || "") !== "");
		let allData = [headers, ...filteredRows];
		let colWidths = headers.map((_, colIdx) => Math.max(...allData.map(row => (row[colIdx] || "").length)));
		document.getElementById("importBOMs").value = allData.map(row =>
			row.map((cell, colIdx) => (cell || "").padEnd(colWidths[colIdx], " ")).join(" | ")
		).join("\n");
	};
	reader.readAsText(file);
});

// Xử lý file CADs
function formatCADsOutput(headers, rows) {
	let allData = [headers, ...rows];
	let colWidths = headers.map((_, colIdx) => Math.max(...allData.map(row => String(row[colIdx] || "").length)));
	return allData.map(row => row.map((cell, colIdx) => String(cell || "").padEnd(colWidths[colIdx], " ")).join(" | ")).join("\n");
}
document.getElementById("addCADs").addEventListener("change", function() {
	let file = this.files[0];
	if (!file) return;
	let reader = new FileReader();
	reader.onload = function(e) {
		let lines = e.target.result.split("\n");
		let headerIndex = lines.findIndex(l => l.includes("Designator") && l.includes("Center-X(mm)"));
		if (headerIndex === -1) {
			alert("Không tìm thấy dòng tiêu đề CADs!");
			return;
		}
		let headers = lines[headerIndex].trim().split(/\s+/);
		let parsedRows = [];
		for (let i = headerIndex + 1; i < lines.length; i++) {
			let line = lines[i].trim();
			if (!line) continue;
			let cells = line.split(/\s+/);
			if (cells.length >= 4) {
				parsedRows.push(cells);
			}
		}
		cadOriginalData = { headers, rows: parsedRows };
		renderCADsTextarea();
	};
	reader.readAsText(file);
});
function renderCADsTextarea() {
	if (cadOriginalData.headers.length === 0) return;
	let isTelit = document.getElementById("telitFormat").checked;
	let processedRows = cadOriginalData.rows.map(row => [...row]);
	if (isTelit) {
		processedRows.forEach(cells => {
			let rotVal = parseFloat(cells[3]);
			if (!isNaN(rotVal)) {
				rotVal -= 90;
				cells[3] = (rotVal === -90 ? 270 : rotVal).toString();
			}
		});
	}
	document.getElementById("importCADs").value = formatCADsOutput(cadOriginalData.headers, processedRows);
	$cads = cadOriginalData.rows.length;
	document.getElementById("total-cads").innerText = $cads;
}
document.getElementById("telitFormat").addEventListener("change", renderCADsTextarea);

// Cập nhật Cache Bounding Box
function updateBoardBounds() {
	if (boardData.length === 0) return;
	let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
	boardData.forEach(p => {
		if (p.x < minX) minX = p.x;
		if (p.x > maxX) maxX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.y > maxY) maxY = p.y;
	});
	boardBounds = { minX, maxX, minY, maxY };
}

// Vẽ & quản lý Canvas
function initCanvasSize() {
	const container = myCanvas.parentElement;
	myCanvas.width = container.clientWidth || 600;
	myCanvas.height = container.clientHeight || 400;
}
function renderCanvas() {
	if (!myCanvas.width || myCanvas.width === 0) initCanvasSize();
	ctx.clearRect(0, 0, myCanvas.width, myCanvas.height);
	if (boardData.length === 0) return;

	// Dùng cache Bounding Box để tránh lặp tính toán
	const { minX, maxX, minY, maxY } = boardBounds;
	const dataW = maxX - minX || 1;
	const dataH = maxY - minY || 1;
	const pad = 30;
	const baseScale = Math.min((myCanvas.width - pad * 2) / dataW, (myCanvas.height - pad * 2) / dataH);
	const scale = baseScale * zoomLevel;
	const centerX = myCanvas.width / 2 + panOffset.x;
	const centerY = myCanvas.height / 2 + panOffset.y;
	const midX = (minX + maxX) / 2;
	const midY = (minY + maxY) / 2;
	const toCX = x => centerX + (x - midX) * scale;
	const toCY = y => centerY - (y - midY) * scale;

	const dotRadius = Math.max(3, Math.min(6, scale * 1.5));

	// Tối ưu 3-Pass Rendering (Không sử dụng .sort() để tiết kiệm CPU)
	// Lượt 1: Part N/A (Thiếu Part = Màu xám - Nằm dưới cùng)
	ctx.fillStyle = "#9fafa1";
	boardData.forEach(p => {
		if (!p.selected && (!p.partNumber || p.partNumber === "N/A")) {
			ctx.beginPath();
			ctx.arc(toCX(p.x), toCY(p.y), dotRadius, 0, Math.PI * 2);
			ctx.fill();
		}
	});

	// Lượt 2: Có Part (Màu vàng đồng - Ở giữa)
	ctx.fillStyle = "#ffdf82";
	boardData.forEach(p => {
		if (!p.selected && p.partNumber && p.partNumber !== "N/A") {
			ctx.beginPath();
			ctx.arc(toCX(p.x), toCY(p.y), dotRadius, 0, Math.PI * 2);
			ctx.fill();
		}
	});

	// Lượt 3: Đang chọn (Màu trắng - Nằm trên cùng)
	ctx.fillStyle = "#ffffff";
	boardData.forEach(p => {
		if (p.selected) {
			ctx.beginPath();
			ctx.arc(toCX(p.x), toCY(p.y), dotRadius, 0, Math.PI * 2);
			ctx.fill();
		}
	});

	// Vẽ khung bôi chọn (Marquee) khi đang giữ chuột phải kéo chọn vùng
	if (isSelecting) {
		ctx.strokeStyle = "#00ffff";
		ctx.lineWidth = 1;
		ctx.setLineDash([4, 4]);
		const rectX = Math.min(selectStart.x, selectEnd.x);
		const rectY = Math.min(selectStart.y, selectEnd.y);
		const rectW = Math.abs(selectEnd.x - selectStart.x);
		const rectH = Math.abs(selectEnd.y - selectStart.y);
		ctx.strokeRect(rectX, rectY, rectW, rectH);
		ctx.setLineDash([]);
	}
}

// Tương tác chuột trên Canvas
myCanvas.addEventListener("contextmenu", e => e.preventDefault());
myCanvas.addEventListener("wheel", function(e) {
	e.preventDefault();
	const rect = myCanvas.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;
	const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
	const newZoom = zoomLevel * zoomFactor;

	if (newZoom <= 1.0) {
		zoomLevel = 1.0;
		panOffset = { x: 0, y: 0 };
	} else {
		const centerX = myCanvas.width / 2 + panOffset.x;
		const centerY = myCanvas.height / 2 + panOffset.y;
		panOffset.x -= (mouseX - centerX) * (zoomFactor - 1);
		panOffset.y -= (mouseY - centerY) * (zoomFactor - 1);
		zoomLevel = newZoom;
	}
	renderCanvas();
});
myCanvas.addEventListener("mousedown", function(e) {
	const rect = myCanvas.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;
	if (e.button === 0) { // Chuột trái: Kéo di chuyển Canvas
		isPanning = true;
		panStart = { x: mouseX - panOffset.x, y: mouseY - panOffset.y };
	} else if (e.button === 2 && selectMode.checked) { // Chuột phải: Bôi quét chọn điểm
		isSelecting = true;
		selectStart = { x: mouseX, y: mouseY };
		selectEnd = { x: mouseX, y: mouseY };
	}
});
myCanvas.addEventListener("mousemove", function(e) {
	const rect = myCanvas.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;
	if (isPanning) {
		panOffset.x = mouseX - panStart.x;
		panOffset.y = mouseY - panStart.y;
		renderCanvas();
	} else if (isSelecting) {
		selectEnd = { x: mouseX, y: mouseY };
		renderCanvas();
	}
});
myCanvas.addEventListener("mouseup", function(e) {
	if (e.button === 0 && isPanning) {
		isPanning = false;
	} else if (e.button === 2 && isSelecting) {
		isSelecting = false;
		const minX = Math.min(selectStart.x, selectEnd.x);
		const maxX = Math.max(selectStart.x, selectEnd.x);
		const minY = Math.min(selectStart.y, selectEnd.y);
		const maxY = Math.max(selectStart.y, selectEnd.y);
		const isDrag = (maxX - minX >= 3) && (maxY - minY >= 3);
		if (isDrag) {
			const { minX: pMinX, maxX: pMaxX, minY: pMinY, maxY: pMaxY } = boardBounds;
			const dataW = pMaxX - pMinX || 1;
			const dataH = pMaxY - pMinY || 1;
			const pad = 30;
			const baseScale = Math.min((myCanvas.width - pad * 2) / dataW, (myCanvas.height - pad * 2) / dataH);
			const scale = baseScale * zoomLevel;
			const centerX = myCanvas.width / 2 + panOffset.x;
			const centerY = myCanvas.height / 2 + panOffset.y;
			const midX = (pMinX + pMaxX) / 2;
			const midY = (pMinY + pMaxY) / 2;
			const toCX = x => centerX + (x - midX) * scale;
			const toCY = y => centerY - (y - midY) * scale;
			boardData.forEach(p => {
				const cx = toCX(p.x);
				const cy = toCY(p.y);
				if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
					p.selected = true;
				}
			});
		}
		renderCanvas();
	}
});

// Tạo bảng dữ liệu cơ bản
function renderBasicTable() {
	let table = document.createElement("table");
	let headerRow = table.insertRow();
	["Ref.", "Pos X", "Pos Y", "Rotation", "Part Number"].forEach(h => {
		let th = document.createElement("th");
		th.textContent = h;
		headerRow.appendChild(th);
	});
	$cad = 0;
	$uncad = 0;
	boardData.forEach(p => {
		let row = table.insertRow();
		row.insertCell().textContent = p.ref;
		row.insertCell().textContent = p.x;
		row.insertCell().textContent = p.y;
		row.insertCell().textContent = p.rot;
		row.insertCell().textContent = p.partNumber;
		if (p.partNumber !== "N/A" && p.partNumber !== "") $cad++;
		else $uncad++;
	});
	table_basic.innerHTML = "";
	table_basic.appendChild(table);
	document.getElementById("total-cad").innerText = $cad;
	document.getElementById("total-uncad").innerText = $uncad;
}

// Khi nhấn nút Generator
btnExport.addEventListener("click", function(e) {
	e.preventDefault();
	for (let j = 0; j < btnImports.length; j++) {
		btnImports[j].classList.remove("active");
		txtImports[j].classList.remove("active");
	}
	btnExport.classList.add("active");
	txtExport.classList.add("active");
	let rowBOMs = document.getElementById("importBOMs").value.trim().split("\n").map(r => r.split("|").map(c => c.trim()));
	let rowCADs = document.getElementById("importCADs").value.trim().split("\n").map(r => r.split("|").map(c => c.trim()));
	if (rowCADs.length <= 1 || !rowCADs[0][0]) return;
	let boms_PartNumber = rowBOMs[0].indexOf("Object ID");
	let boms_SchemaRef = rowBOMs[0].indexOf("Schema ref");
	let cads_Designator = rowCADs[0].indexOf("Designator");
	let cads_X = rowCADs[0].indexOf("Center-X(mm)");
	let cads_Y = rowCADs[0].indexOf("Center-Y(mm)");
	let cads_Rotation = rowCADs[0].indexOf("Rotation");
	boardData = [];
	for (let i = 1; i < rowCADs.length; i++) {
		if (!rowCADs[i] || rowCADs[i].length < 4) continue;
		let ref = rowCADs[i][cads_Designator];
		let x = parseFloat(rowCADs[i][cads_X]) || 0;
		let y = parseFloat(rowCADs[i][cads_Y]) || 0;
		let rot = rowCADs[i][cads_Rotation] || "0";
		const matchedRow = rowBOMs.slice(1).find(r => r[boms_SchemaRef] === ref);
		let partNumber = matchedRow ? matchedRow[boms_PartNumber] : "N/A";
		boardData.push({ ref, x, y, rot, partNumber, selected: false });
	}
	if (boardData.length > 0) {
		origMinX = Math.min(...boardData.map(p => p.x));
		origMinY = Math.min(...boardData.map(p => p.y));
		updateBoardBounds(); // Cập nhật cache Bounding Box
	}
	renderBasicTable();
	setTimeout(() => {
		initCanvasSize();
		zoomLevel = 1.0;
		panOffset = { x: 0, y: 0 };
		renderCanvas();
	}, 50);
});

// Khi ấn nút xoay board +90°
rotate90.addEventListener("click", function(e) {
	e.preventDefault();
	if (boardData.length === 0) return;
	// Xoay 90 độ theo chiều kim đồng hồ: (X_rot, Y_rot) = (Y, -X)
	let rotatedCoords = boardData.map(p => ({
		rotX: p.y,
		rotY: -p.x
	}));
	// Tìm tọa độ nhỏ nhất hiện tại sau khi xoay
	let currentMinX = Math.min(...rotatedCoords.map(c => c.rotX));
	let currentMinY = Math.min(...rotatedCoords.map(c => c.rotY));
	// Dịch chuyển để điểm góc bản mạch duy trì đúng khoảng cách gốc ban đầu (origMinX, origMinY)
	boardData.forEach((p, index) => {
		p.x = Math.round((rotatedCoords[index].rotX - currentMinX + origMinX) * 1000) / 1000;
		p.y = Math.round((rotatedCoords[index].rotY - currentMinY + origMinY) * 1000) / 1000;
		let newRot = ((parseFloat(p.rot) || 0) + 90) % 360;
		p.rot = newRot.toString();
	});

	updateBoardBounds(); // Cập nhật cache Bounding Box sau khi xoay

	// Render lại bảng và canvas
	renderBasicTable();
	zoomLevel = 1.0;
	panOffset = { x: 0, y: 0 };
	renderCanvas();
});

// Lấy toạ độ điểm Mark
getMark_1.addEventListener("click", function(e) {
	e.preventDefault();
	if (!selectMode.checked) {
		alert("Vui lòng bật Select Mode trước!");
		return;
	}
	const selectedPoints = boardData.filter(p => p.selected);
	if (selectedPoints.length !== 1) {
		alert("Vui lòng bôi chọn đúng 1 điểm trên Canvas để đặt làm Mark 1!");
		return;
	}
	txtMark_X1.value = selectedPoints[0].x;
	txtMark_Y1.value = selectedPoints[0].y;
});
getMark_2.addEventListener("click", function(e) {
	e.preventDefault();
	if (!selectMode.checked) {
		alert("Vui lòng bật Select Mode trước!");
		return;
	}
	const selectedPoints = boardData.filter(p => p.selected);
	if (selectedPoints.length !== 1) {
		alert("Vui lòng bôi chọn đúng 1 điểm trên Canvas để đặt làm Mark 2!");
		return;
	}
	txtMark_X2.value = selectedPoints[0].x;
	txtMark_Y2.value = selectedPoints[0].y;
});

// Huỷ bỏ đánh dấu trong Canvas
clearSelect.addEventListener("click", function(e) {
	e.preventDefault();
	boardData.forEach(p => p.selected = false);
	renderCanvas();
});

// Tạo bảng dữ liệu đầy đủ
exportTableAll.addEventListener("click", function(e) {
	e.preventDefault();
	const selectedPoints = boardData.filter(p => p.selected);
	if (selectedPoints.length === 0) {
		alert("Vui lòng bật Select Mode và chọn các điểm thuộc Panel 1 trên Canvas!");
		return;
	}
	const assignVal = txtAssign ? txtAssign.value : "";
	const sideVal = txtSide ? txtSide.value : "";
	let table = document.createElement("table");
	let headerRow = table.insertRow();
	const headers = ["Board", "Ref.", "Pos X", "Pos Y", "Pos Z", "Rotation", "Part Number", "Place Before", "Gluing", "Skip", "Main Mark", "Sub Mark", "Sub Mark1", "Sub Mark2", "Carry Mode", "Stack Target", "Memo", "Tag", "Assign", "Side"];
	headers.forEach(h => {
		let th = document.createElement("th");
		th.textContent = h;
		headerRow.appendChild(th);
	});
	// Hàm hỗ trợ chèn 1 dòng dữ liệu vào bảng
	const addRow = (data) => {
		let row = table.insertRow();
		data.forEach(val => {
			row.insertCell().textContent = val;
		});
	};
	// 1. Thêm dòng dữ liệu Mark 1 (nếu có tọa độ X1, Y1)
	if (txtMark_X1.value.trim() !== "" && txtMark_Y1.value.trim() !== "") {
		addRow(["0", "Mark1", txtMark_X1.value.trim(), txtMark_Y1.value.trim(), "0", "0", "MARK", "", "Yes", "No", "FD1", "FD2", "No", "No", "Arc", "", "", "No", assignVal, sideVal]);
	}
	// 2. Thêm dòng dữ liệu Mark 2 (nếu có tọa độ X2, Y2)
	if (txtMark_X2.value.trim() !== "" && txtMark_Y2.value.trim() !== "") {
		addRow(["0", "Mark2", txtMark_X2.value.trim(), txtMark_Y2.value.trim(), "0", "0", "MARK", "", "Yes", "No", "FD1", "FD2", "No", "No", "Arc", "", "", "No", assignVal, sideVal]);
	}
	// 3. Thêm danh sách linh kiện đã được chọn thuộc Panel 1 (Board = 1)
	selectedPoints.forEach(p => {
		addRow([
			"1", p.ref, p.x, p.y, "0", p.rot,
			p.partNumber, "", "Yes", "No", "FD1", "FD2", "", "",
			"Arc", "", "", "No", assignVal, sideVal
		]);
	});
	table_all.innerHTML = "";
	table_all.appendChild(table);
});

// Tự động căn chỉnh kích thước Canvas khi đổi kích thước cửa sổ
window.addEventListener("resize", () => {
	if (txtExport.classList.contains("active")) {
		initCanvasSize();
		renderCanvas();
	}
});