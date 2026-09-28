console.clear();
console.log("Create: 28/09/2026. By HiepDz");
console.log("Update: 29/09/2026. By HiepDz");
////////////////////////////////////////////////////////////////////////////////////////////////////
// Khai báo Element
const btnImport = document.getElementsByClassName("btn-import");
const dataImport = document.getElementsByClassName("data-import");
////////////////////////////////////////////////////////////////////////////////////////////////////
// Chuyển Tab
for (let i = 0; i < btnImport.length; i++) {
	btnImport[i].addEventListener("click", (e) => {
		e.preventDefault();
		for (let j = 0; j < btnImport.length; j++) {
			btnImport[j].classList.remove("active");
			dataImport[j].classList.remove("active");
		}
		btnImport[i].classList.add("active");
		dataImport[i].classList.add("active");
	});
}
////////////////////////////////////////////////////////////////////////////////////////////////////
// TAB FUJI: Xử lý paste dữ liệu trực tiếp vào textarea
document.getElementById("pastePlacement").addEventListener("input", (e) => {
	const formattedText = formatData_1(e.target.value);
	e.target.value = formattedText;
	renderFujiTable(formattedText, "samePart_F");
});
/**
 * Tạo bảng cho Tab Fuji (Ref., Part Number, Assign)
 * - Ref.: Chỉ hiển thị 1 tên đầu tiên đại diện
 */
function renderFujiTable(text, containerId) {
	const container = document.getElementById(containerId);
	if (!container) return;
	container.innerHTML = "";
	if (!text.trim()) {
		container.textContent = "This is data same Placement..";
		updateSumPlacement(0);
		return;
	}
	const lines = text.trim().split("\n");
	if (lines.length === 0) return;
	const headers = lines[0].split("|").map(cell => cell.trim());
	const refIndex = headers.findIndex(h => h.toLowerCase().startsWith("ref"));
	const partNumberIndex = headers.findIndex(h => h.toLowerCase() === "part number");
	const assignIndex = headers.findIndex(h => h.toLowerCase() === "assign");
	if (partNumberIndex === -1 || refIndex === -1 || assignIndex === -1) {
		container.textContent = "Không tìm thấy cột 'Ref.', 'Part Number' hoặc 'Assign'!";
		return;
	}
	const partMap = new Map();
	for (let i = 1; i < lines.length; i++) {
		const cells = lines[i].split("|").map(cell => cell.trim());
		const refVal = cells[refIndex] || "";
		const partNum = cells[partNumberIndex] || "";
		const assignVal = cells[assignIndex] || "";
		if (!partNum) continue;
		if (!partMap.has(partNum)) {
			partMap.set(partNum, {
				firstRef: refVal, // Chỉ lưu tên Ref. đầu tiên gặp
				assignSet: new Set()
			});
		}
		const entry = partMap.get(partNum);
		if (!entry.firstRef && refVal) {
			entry.firstRef = refVal;
		}
		if (assignVal) entry.assignSet.add(assignVal);
	}
	const table = document.createElement("table");
	// Header
	const headerRow = table.insertRow();
	["Ref.", "Part Number", "Assign"].forEach(colName => {
		const th = document.createElement("th");
		th.textContent = colName;
		headerRow.appendChild(th);
	});
	// Rows
	partMap.forEach((data, partNum) => {
		const row = table.insertRow();
		row.insertCell().textContent = data.firstRef || "";
		row.insertCell().textContent = partNum;
		row.insertCell().textContent = Array.from(data.assignSet).join(", ");
	});
	container.appendChild(table);
	updateSumPlacement(partMap.size);
}
////////////////////////////////////////////////////////////////////////////////////////////////////
// TAB PANA: Xử lý Tải File CSV và Kéo thả File
const fileInput = document.getElementById("newCSV");
// 1. Tải file CSV từ nút chọn file
fileInput.addEventListener("change", function() {
	let file = this.files[0];
	if (file) {
		processCSVFile(file);
	}
});
// 2. Chức năng kéo thả file CSV
const importCSVArea = document.getElementById("importCSV");
if (importCSVArea) {
	// Khóa không cho nhập thủ công vào textarea
	importCSVArea.setAttribute("readonly", true);
	importCSVArea.addEventListener("dragover", function(e) {
		e.preventDefault();
		e.stopPropagation();
		this.classList.add("drag-over");
	});
	importCSVArea.addEventListener("dragleave", function(e) {
		e.preventDefault();
		e.stopPropagation();
		this.classList.remove("drag-over");
	});
	importCSVArea.addEventListener("drop", function(e) {
		e.preventDefault();
		e.stopPropagation();
		this.classList.remove("drag-over");
		let files = e.dataTransfer.files;
		if (files && files.length > 0) {
			processCSVFile(files[0]);
		}
	});
}
/**
 * Đọc file CSV, định dạng dữ liệu vào textarea và tự động sinh bảng cho Tab Pana
 */
function processCSVFile(file) {
	let reader = new FileReader();
	reader.onload = function(e) {
		let result = e.target.result.trim();
		let rawRows = result.split("\n");
		let parsedMatrix = [];
		for (let x = 0; x < rawRows.length; x++) {
			let cells = rawRows[x].split(",");
			parsedMatrix.push(cells.map(cell => cell.trim()));
		}
		if (parsedMatrix.length > 0 && parsedMatrix[0].length > 0) {
			// Căn chỉnh độ rộng các cột hiển thị dạng "|"
			let numCols = parsedMatrix[0].length;
			let colWidths = Array(numCols).fill(0);
			for (let col = 0; col < numCols; col++) {
				for (let row = 0; row < parsedMatrix.length; row++) {
					let val = parsedMatrix[row][col] || "";
					if (val.length > colWidths[col]) {
						colWidths[col] = val.length;
					}
				}
			}
			let formattedLines = [];
			for (let row = 0; row < parsedMatrix.length; row++) {
				let rowCells = [];
				for (let col = 0; col < numCols; col++) {
					let cellVal = parsedMatrix[row][col] || "";
					rowCells.push(cellVal.padEnd(colWidths[col], " "));
				}
				formattedLines.push(rowCells.join(" | "));
			}
			const formattedText = formattedLines.join("\n");
			// Hiển thị chuỗi dạng | lên textarea
			document.getElementById("importCSV").value = formattedText;
			// Trích xuất dữ liệu tạo bảng Pana (Designator, Part Name, Slot)
			renderPanaTable(parsedMatrix, "samePart_P");
		}
	};
	reader.readAsText(file);
}
/**
 * Tạo bảng cho Tab Pana từ ma trận dữ liệu CSV (Designator, Part Name, Slot)
 * - Designator: Chỉ hiển thị 1 tên đầu tiên đại diện
 */
function renderPanaTable(matrix, containerId) {
	const container = document.getElementById(containerId);
	if (!container) return;
	container.innerHTML = "";
	if (!matrix || matrix.length === 0) {
		container.textContent = "This is data same Placement..";
		updateSumPlacement(0);
		return;
	}
	// Lấy dòng header
	const headers = matrix[0].map(h => h.trim());
	// Tìm index của 3 cột cần thiết
	const designatorIndex = headers.findIndex(h => h.toLowerCase() === "designator");
	const partNameIndex = headers.findIndex(h => h.toLowerCase() === "part name");
	const slotIndex = headers.findIndex(h => h.toLowerCase() === "slot");
	if (designatorIndex === -1 || partNameIndex === -1 || slotIndex === -1) {
		container.textContent = "Không tìm thấy cột 'Designator', 'Part Name' hoặc 'Slot'!";
		return;
	}
	// Gom nhóm Slot và lấy Designator đại diện theo từng Part Name duy nhất
	const partMap = new Map();
	for (let i = 1; i < matrix.length; i++) {
		const row = matrix[i];
		const designatorVal = row[designatorIndex] || "";
		const partName = row[partNameIndex] || "";
		const slotVal = row[slotIndex] || "";
		if (!partName) continue;
		if (!partMap.has(partName)) {
			partMap.set(partName, {
				firstDesignator: designatorVal, // Chỉ lưu 1 tên Designator đầu tiên
				slotSet: new Set()
			});
		}
		const entry = partMap.get(partName);
		if (!entry.firstDesignator && designatorVal) {
			entry.firstDesignator = designatorVal;
		}
		if (slotVal) entry.slotSet.add(slotVal);
	}
	// Dựng bảng HTML bằng DOM API
	const table = document.createElement("table");
	// Header
	const headerRow = table.insertRow();
	["Designator", "Part Name", "Slot"].forEach(colName => {
		const th = document.createElement("th");
		th.textContent = colName;
		headerRow.appendChild(th);
	});
	// Rows
	partMap.forEach((data, partName) => {
		const row = table.insertRow();
		row.insertCell().textContent = data.firstDesignator || "";
		row.insertCell().textContent = partName;
		row.insertCell().textContent = Array.from(data.slotSet).join(", ");
	});
	container.appendChild(table);
	updateSumPlacement(partMap.size);
}
////////////////////////////////////////////////////////////////////////////////////////////////////
// Hàm bổ trợ
function updateSumPlacement(count) {
	const sumElement = document.getElementById("sumPlacement");
	if (sumElement) {
		sumElement.textContent = count;
	}
}
function formatData_1(text) {
	if (!text.trim()) return "";
	const rows = text.trim().split("\n").map(row =>
		row.split("\t").map(cell => cell.trim())
	);
	const numCols = Math.max(...rows.map(r => r.length));
	const colWidths = Array(numCols).fill(0);
	rows.forEach(row => {
		row.forEach((cell, colIdx) => {
			if (cell.length > colWidths[colIdx]) {
				colWidths[colIdx] = cell.length;
			}
		});
	});
	return rows.map(row => {
		return Array.from({
			length: numCols
		}, (_, i) => {
			const cell = row[i] || "";
			return cell.padEnd(colWidths[i], " ");
		}).join(" | ");
	}).join("\n");
}