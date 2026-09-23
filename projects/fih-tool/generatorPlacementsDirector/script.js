console.clear();
// Khai báo tên biến Element, trạng thái dữ liệu
const btnImport = document.getElementsByClassName("btn-import");
const dataImport = document.getElementsByClassName("data-import");
const btnExport = document.getElementById("btnGenerator");
const dataExport = document.getElementById("dataGenerator");
const table_basic = document.getElementById("tableBasic");
const table_all = document.getElementById("tableResult");
const rotate90 = document.getElementById("btnTurn90");
const txtSide = document.getElementById("nameSide");
const txtMark_X1 = document.getElementById("markX1");
const txtMark_Y1 = document.getElementById("markY1");
const txtMark_X2 = document.getElementById("markX2");
const txtMark_Y2 = document.getElementById("markY2");
const getMark_1 = document.getElementById("getMark1");
const getMark_2 = document.getElementById("getMark2");
const selectMode = document.getElementById("selectMode");
const clearSelect = document.getElementById("clearSelect");
const btnSetBlock = document.getElementById("setBlock");
const btnClearBlock = document.getElementById("clearBlock");
const myCanvas = document.getElementById("myCanvas");
const exportTableAll = document.getElementById("btnExport");
let $parts = 0, $cads = 0, $cad = 0, $uncad = 0;
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
for (let i = 0; i < btnImport.length; i++) {
	btnImport[i].addEventListener("click", (e) => {
		e.preventDefault();
		for (let j = 0; j < btnImport.length; j++) {
			btnImport[j].classList.remove("active");
			dataImport[j].classList.remove("active");
		}
		btnExport.classList.remove("active");
		dataExport.classList.remove("active");
		btnImport[i].classList.add("active");
		dataImport[i].classList.add("active");
	});
}
// Xử lý file BOMs
document.getElementById("newBoms").addEventListener("change", function() {
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
		let quantityIndex = 6, schemaRefIndex = 8, objectIdIndex = 2, qtyCount = 0;
		headers.forEach((h, c) => {
			if (h === "Quantity" && ++qtyCount === 2) quantityIndex = c;
			if (h === "Schema ref") schemaRefIndex = c;
			if (h === "Object ID") objectIdIndex = c;
		});
		// Dữ liệu BOMs đầy đủ (Quantity == 1,00 và Schema ref không rỗng)
		let filteredRows = parsedRows.filter(row => (row[quantityIndex] || "") === "1,00" && (row[schemaRefIndex] || "") !== "");
		let allData = [headers, ...filteredRows];
		let colWidths = headers.map((_, colIdx) => Math.max(...allData.map(row => (row[colIdx] || "").length)));
		document.getElementById("importBOMs").value = allData.map(row =>row.map((cell, colIdx) => (cell || "").padEnd(colWidths[colIdx], " ")).join(" | ")).join("\n");
		// Lọc danh sách Object ID duy nhất (Yêu cầu: Quantity == 1,00, Schema ref không rỗng, và Object ID chưa xuất hiện)
		let uniqueObjectMap = new Map();
		parsedRows.forEach(row => {
			let objId = row[objectIdIndex] || "";
			let schemaRef = row[schemaRefIndex] || "";
			let qty = row[quantityIndex] || "";
			if (objId && qty === "1,00" && schemaRef !== "" && !uniqueObjectMap.has(objId)) {
				uniqueObjectMap.set(objId, row);
			}
		});
		let objDescIndex = headers.indexOf("Object description");
		let targetHeaders = ["Object ID", "Object description", "Schema ref"];
		let uniqueRowsFiltered = Array.from(uniqueObjectMap.values()).map(row => [
			row[objectIdIndex] || "",
			objDescIndex !== -1 ? (row[objDescIndex] || "") : "",
			row[schemaRefIndex] || ""
		]);
		let uniqueData = [targetHeaders, ...uniqueRowsFiltered];
		let uniqueColWidths = targetHeaders.map((_, colIdx) =>
			Math.max(...uniqueData.map(row => (row[colIdx] || "").length))
		);
		document.getElementById("sameBOMs").value = uniqueData.map(row =>row.map((cell, colIdx) => (cell || "").padEnd(uniqueColWidths[colIdx], " ")).join(" | ")).join("\n");
	};
	reader.readAsText(file);
});
////////////////////////////////////////////////////////////////////////////////////////////////////
// Xử lý file CADs
function formatCADsOutput(headers, rows) {
	let allData = [headers, ...rows];
	let colWidths = headers.map((_, colIdx) => Math.max(...allData.map(row => String(row[colIdx] || "").length)));
	return allData.map(row => row.map((cell, colIdx) => String(cell || "").padEnd(colWidths[colIdx], " ")).join(" | ")).join("\n");
}
document.getElementById("newCads").addEventListener("change", function() {
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
	document.getElementById("sumCads").innerText = $cads;
}
document.getElementById("telitFormat").addEventListener("change", renderCADsTextarea);
////////////////////////////////////////////////////////////////////////////////////////////////////
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
////////////////////////////////////////////////////////////////////////////////////////////////////
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
	// Các điểm thuộc Block hoặc Mark (Làm mờ chấm tròn nếu thuộc Block)
	ctx.save();
	ctx.globalAlpha = 0.35;
	boardData.forEach(p => {
		if (!p.selected && p.block !== "-") {
			ctx.fillStyle = (!p.partNumber || p.partNumber === "N/A") ? "#9fafa1" : "#ffdf82";
			ctx.beginPath();
			ctx.arc(toCX(p.x), toCY(p.y), dotRadius, 0, Math.PI * 2);
			ctx.fill();
		}
	});
	ctx.restore();
	// Các điểm tự do chưa thuộc Block hay Mark nào
	ctx.fillStyle = "#9fafa1"; // Part N/A (Màu xám)
	boardData.forEach(p => {
		if (!p.selected && p.block === "-" && !p.isMark && (!p.partNumber || p.partNumber === "N/A")) {
			ctx.beginPath();
			ctx.arc(toCX(p.x), toCY(p.y), dotRadius, 0, Math.PI * 2);
			ctx.fill();
		}
	});
	ctx.fillStyle = "#ffdf82"; // Có Part (Màu vàng đồng)
	boardData.forEach(p => {
		if (!p.selected && p.block === "-" && !p.isMark && p.partNumber && p.partNumber !== "N/A") {
			ctx.beginPath();
			ctx.arc(toCX(p.x), toCY(p.y), dotRadius, 0, Math.PI * 2);
			ctx.fill();
		}
	});
	ctx.fillStyle = "#007bff"; // Mark (Xanh dương)
	boardData.forEach(p => {
		if (!p.selected && p.isMark) {
			ctx.beginPath();
			ctx.arc(toCX(p.x), toCY(p.y), dotRadius + 1, 0, Math.PI * 2);
			ctx.fill();
		}
	});
	ctx.fillStyle = "#ffffff"; // Đang chọn (Màu trắng)
	boardData.forEach(p => {
		if (p.selected) {
			ctx.beginPath();
			ctx.arc(toCX(p.x), toCY(p.y), dotRadius, 0, Math.PI * 2);
			ctx.fill();
		}
	});
	// Gom nhóm vẽ khung cho cả Block (#1, #2...) và Mark (#FD1, #FD2)
	const blocks = {};
	boardData.forEach(p => {
		let labelKey = null;
		if (p.isMark) {
			labelKey = p.markLabel; // #FD1 hoặc #FD2
		} else if (p.block && p.block !== "-") {
			labelKey = `#${p.block}`;
		}
		if (labelKey) {
			if (!blocks[labelKey]) blocks[labelKey] = [];
			blocks[labelKey].push(p);
		}
	});
	Object.keys(blocks).forEach(blockId => {
		const pts = blocks[blockId];
		let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
		pts.forEach(p => {
			const cx = toCX(p.x);
			const cy = toCY(p.y);
			if (cx < bMinX) bMinX = cx;
			if (cx > bMaxX) bMaxX = cx;
			if (cy < bMinY) bMinY = cy;
			if (cy > bMaxY) bMaxY = cy;
		});
		const padBox = dotRadius + 10;
		const rectX = bMinX - padBox;
		const rectY = bMinY - padBox;
		const rectW = (bMaxX - bMinX) + padBox * 2;
		const rectH = (bMaxY - bMinY) + padBox * 2;
		ctx.save();
		ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
		ctx.lineWidth = 1.5;
		ctx.setLineDash([4, 4]);
		ctx.strokeRect(rectX, rectY, rectW, rectH);
		// Hiển thị số Block / Mark ở trung tâm
		const midBlockX = (bMinX + bMaxX) / 2;
		const midBlockY = (bMinY + bMaxY) / 2;
		const fontSize = Math.max(14, Math.round(scale * 2.5));
		ctx.font = `bold ${fontSize}px "Courier New", sans-serif`;
		const text = blockId;
		const metrics = ctx.measureText(text);
		// Khung nền nhãn text
		ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
		ctx.fillRect(midBlockX - metrics.width / 2 - 6, midBlockY - fontSize / 2 - 4, metrics.width + 12, fontSize + 8);
		ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
		ctx.lineWidth = 1;
		ctx.setLineDash([]);
		ctx.strokeRect(midBlockX - metrics.width / 2 - 6, midBlockY - fontSize / 2 - 4, metrics.width + 12, fontSize + 8);
		// Chữ nhãn (#FD1/#FD2 có màu xanh nhạt hoặc sáng để nổi bật)
		ctx.fillStyle = blockId.startsWith("#FD") ? "#70bfff" : "#00ffff";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(text, midBlockX, midBlockY);
		ctx.restore();
	});
	// Khung bôi chọn (Marquee) khi đang giữ chuột phải kéo chọn vùng
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
////////////////////////////////////////////////////////////////////////////////////////////////////
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
////////////////////////////////////////////////////////////////////////////////////////////////////
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
	document.getElementById("onCad").innerText = $cad;
	document.getElementById("unCad").innerText = $uncad;
}
////////////////////////////////////////////////////////////////////////////////////////////////////
// Khi nhấn nút Generator
btnExport.addEventListener("click", function(e) {
	e.preventDefault();
	for (let j = 0; j < btnImport.length; j++) {
		btnImport[j].classList.remove("active");
		dataImport[j].classList.remove("active");
	}
	btnExport.classList.add("active");
	dataExport.classList.add("active");
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
		boardData.push({ ref, x, y, rot, partNumber, selected: false, block: "-" });
	}
	if (boardData.length > 0) {
		origMinX = Math.min(...boardData.map(p => p.x));
		origMinY = Math.min(...boardData.map(p => p.y));
		updateBoardBounds();
	}
	renderBasicTable();
	setTimeout(() => {
		initCanvasSize();
		zoomLevel = 1.0;
		panOffset = { x: 0, y: 0 };
		renderCanvas();
	}, 50);
});
////////////////////////////////////////////////////////////////////////////////////////////////////
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
	updateBoardBounds();
	// Render lại bảng và canvas
	renderBasicTable();
	zoomLevel = 1.0;
	panOffset = { x: 0, y: 0 };
	renderCanvas();
});
////////////////////////////////////////////////////////////////////////////////////////////////////
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
	// Gán giá trị vào Input
	txtMark_X1.value = selectedPoints[0].x;
	txtMark_Y1.value = selectedPoints[0].y;
	// Xóa trạng thái Mark cũ của FD1 (nếu có)
	boardData.forEach(p => { if (p.markLabel === "#FD1") { p.isMark = false; p.markLabel = null; } });
	// Thiết lập trạng thái Mark 1 cho điểm được chọn
	selectedPoints[0].isMark = true;
	selectedPoints[0].markLabel = "#FD1";
	// YÊU CẦU 3: Tự động Clear Select sau khi xong
	boardData.forEach(p => p.selected = false);
	renderCanvas();
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
	// Gán giá trị vào Input
	txtMark_X2.value = selectedPoints[0].x;
	txtMark_Y2.value = selectedPoints[0].y;
	// Xóa trạng thái Mark cũ của FD2 (nếu có)
	boardData.forEach(p => { if (p.markLabel === "#FD2") { p.isMark = false; p.markLabel = null; } });
	// Thiết lập trạng thái Mark 2 cho điểm được chọn
	selectedPoints[0].isMark = true;
	selectedPoints[0].markLabel = "#FD2";
	// YÊU CẦU 3: Tự động Clear Select sau khi xong
	boardData.forEach(p => p.selected = false);
	renderCanvas();
});
////////////////////////////////////////////////////////////////////////////////////////////////////
// Huỷ bỏ đánh dấu trong Canvas
clearSelect.addEventListener("click", function(e) {
	e.preventDefault();
	boardData.forEach(p => p.selected = false);
	renderCanvas();
});
////////////////////////////////////////////////////////////////////////////////////////////////////
// Nút Thiết lập Block (Set Block)
btnSetBlock.addEventListener("click", function(e) {
	e.preventDefault();
	const selectedPoints = boardData.filter(p => p.selected);
	if (selectedPoints.length === 0) {
		alert("Vui lòng bật Select Mode và bôi chọn các điểm trên Canvas trước!");
		return;
	}
	// Tự động tính số thứ tự Block tiếp theo
	let maxBlock = 0;
	boardData.forEach(p => {
		if (p.block && p.block !== "-") {
			let num = parseInt(p.block, 10);
			if (!isNaN(num) && num > maxBlock) {
				maxBlock = num;
			}
		}
	});
	let nextBlockNum = (maxBlock + 1).toString();
	// Hiển thị Prompt với số thứ tự kế tiếp được điền sẵn
	const blockNum = prompt("Nhập số thứ tự panel (Block):", nextBlockNum);
	if (blockNum === null || blockNum.trim() === "") return;
	const cleanBlockNum = blockNum.trim();
	selectedPoints.forEach(p => {
		p.block = cleanBlockNum;
		// Tự động bỏ chọn điểm
		p.selected = false;
	});
	renderCanvas();
});
////////////////////////////////////////////////////////////////////////////////////////////////////
// Nút xoá Block (Clear Block)
btnClearBlock.addEventListener("click", function(e) {
	e.preventDefault();
	const selectedPoints = boardData.filter(p => p.selected);
	if (selectedPoints.length === 0) {
		alert("Vui lòng bôi chọn các điểm trên Canvas để xóa khỏi Block!");
		return;
	}
	selectedPoints.forEach(p => {
		p.block = "-";
		// Tự động bỏ chọn điểm
		p.selected = false;
	});
	renderCanvas();
});
////////////////////////////////////////////////////////////////////////////////////////////////////
// Tạo bảng dữ liệu đầy đủ
exportTableAll.addEventListener("click", function(e) {
	e.preventDefault();
	if (boardData.length === 0) {
		alert("Chưa có dữ liệu Board!");
		return;
	}
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
	// Thêm dòng dữ liệu Mark 1 (nếu có tọa độ X1, Y1)
	if (txtMark_X1.value.trim() !== "" && txtMark_Y1.value.trim() !== "") {
		addRow(["0", "Mark1", txtMark_X1.value.trim(), txtMark_Y1.value.trim(), "0", "0", "MARK", "", "Yes", "No", "", "", "", "", "Arc", "", "", "No", "", sideVal]);
	}
	// Thêm dòng dữ liệu Mark 2 (nếu có tọa độ X2, Y2)
	if (txtMark_X2.value.trim() !== "" && txtMark_Y2.value.trim() !== "") {
		addRow(["0", "Mark2", txtMark_X2.value.trim(), txtMark_Y2.value.trim(), "0", "0", "MARK", "", "Yes", "No", "", "", "", "", "Arc", "", "", "No", "", sideVal]);
	}
	// Thêm danh sách linh kiện (Xuất cột Board tương ứng với Block đã set, loại bỏ Part N/A)
	boardData.forEach(p => {
		if (!p.partNumber || p.partNumber === "N/A") return; // Bỏ qua linh kiện N/A
		addRow([p.block || "-", p.ref, p.x, p.y, "0", p.rot, p.partNumber, "", "Yes", "No", "", "", "", "", "Arc", "", "", "No", "", sideVal]);
	});
	table_all.innerHTML = "";
	table_all.appendChild(table);
});
////////////////////////////////////////////////////////////////////////////////////////////////////
// Tự động căn chỉnh kích thước Canvas khi đổi kích thước cửa sổ
window.addEventListener("resize", () => {
	if (dataExport.classList.contains("active")) {
		initCanvasSize();
		renderCanvas();
	}
});