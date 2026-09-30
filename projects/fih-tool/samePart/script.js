console.clear();
console.log("Create: 28/09/2026. By HiepDz");
console.log("Update: 30/09/2026. By HiepDz");
////////////////////////////////////////////////////////////////////////////////////////////////////
// Chuyển Tab
const btnImport = document.getElementsByClassName("btn-import");
const dataImport = document.getElementsByClassName("data-import");
Array.from(btnImport).forEach((btn, i) => {
	btn.addEventListener("click", (e) => {
		e.preventDefault();
		Array.from(btnImport).forEach((b, j) => {
			b.classList.remove("active");
			dataImport[j].classList.remove("active");
		});
		btn.classList.add("active");
		dataImport[i].classList.add("active");
		// Cập nhật lại số lượng dữ liệu footer khi đổi tab
		if (i === 0) {
			updateFujiCounts();
		} else {
			updatePanaCounts();
		}
	});
});
////////////////////////////////////////////////////////////////////////////////////////////////////
// Lưu trữ dữ liệu Map (Part -> Ref/Designator) và Tổng số dòng dữ liệu thực tế
const fujiData = { 1: null, 2: null, count1: 0, count2: 0 };
const panaData = { 1: null, 2: null, count1: 0, count2: 0 };
////////////////////////////////////////////////////////////////////////////////////////////////////
// Tách dòng dữ liệu thành các ô hỗ trợ Tab (\t), Phẩy (,), Pipe (|) hoặc Khoảng trắng
function parseLineCells(line) {
	if (line.includes("\t")) return line.split("\t");
	if (line.includes("|")) return line.split("|");
	if (line.includes(",")) return line.split(",");
	return line.split(/\s{2,}/);
}
////////////////////////////////////////////////////////////////////////////////////////////////////
// Cập nhật giá trị lên DOM theo ID
function updateElementText(id, text) {
	const el = document.getElementById(id);
	if (el) el.textContent = text;
}
////////////////////////////////////////////////////////////////////////////////////////////////////
// Cập nhật các thông số lên Footer
function updateFooterStatus(sum1, sum2, totalPart) {
	updateElementText("sumData_1", sum1);
	updateElementText("sumData_2", sum2);
	updateElementText("sumPlacement", totalPart);
}
////////////////////////////////////////////////////////////////////////////////////////////////////
// Render một bảng dữ liệu HTML tiêu chuẩn (Header & Rows)
function createHTMLTable(headers, rowsData) {
	const table = document.createElement("table");
	const headerRow = table.insertRow();
	headers.forEach(h => {
		const th = document.createElement("th");
		th.textContent = h;
		headerRow.appendChild(th);
	});
	rowsData.forEach(rowData => {
		const row = table.insertRow();
		rowData.forEach(cellText => {
			row.insertCell().textContent = cellText;
		});
	});
	return table;
}
////////////////////////////////////////////////////////////////////////////////////////////////////
// Render bảng tổng hợpPart duy nhất từ 2 Map
function renderCombinedTable(containerId, map1, map2, col1Name, col2Name) {
	const container = document.getElementById(containerId);
	if (!container) return 0;
	container.innerHTML = "";
	if ((!map1 || map1.size === 0) && (!map2 || map2.size === 0)) {
		container.textContent = "Các Part được sử dụng.";
		return 0;
	}
	const allParts = new Set([
		...(map1 ? map1.keys() : []),
		...(map2 ? map2.keys() : [])
	]);
	const rows = [];
	allParts.forEach(part => {
		const desig1 = map1 ? map1.get(part) : null;
		const desig2 = map2 ? map2.get(part) : null;
		let finalDesig = "";
		if (desig1 && desig2) {
			finalDesig = `${desig1} / ${desig2}`;
		} else if (desig1) {
			finalDesig = desig1;
		} else {
			finalDesig = desig2;
		}
		rows.push([finalDesig, part]);
	});
	const table = createHTMLTable([col1Name, col2Name], rows);
	container.appendChild(table);
	return allParts.size;
}
////////////////////////////////////////////////////////////////////////////////////////////////////
// XỬ LÝ PART FUJI (TEXTAREA PASTE DATA)
const textarea1 = document.getElementById("pastePlacement_1");
const textarea2 = document.getElementById("pastePlacement_2");
if (textarea1) textarea1.addEventListener("input", function() {
	processFujiTextarea(this, 1);
});
if (textarea2) textarea2.addEventListener("input", function() {
	processFujiTextarea(this, 2);
});
function processFujiTextarea(textareaEl, index) {
	const text = textareaEl.value;
	if (!text.trim()) {
		fujiData[index] = null;
		fujiData[`count${index}`] = 0;
		updateFujiCounts();
		return;
	}
	const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
	if (lines.length === 0) return;
	// Tìm vị trí cột Ref và Part Number từ tiêu đề
	const headers = parseLineCells(lines[0]).map(c => c.toLowerCase());
	const refIndex = headers.findIndex(h => h.includes("ref"));
	const partIndex = headers.findIndex(h => h.includes("part number") || h.includes("part"));
	if (refIndex === -1 || partIndex === -1) {
		fujiData[index] = null;
		fujiData[`count${index}`] = 0;
		updateFujiCounts();
		return;
	}
	const partMap = new Map();
	const formattedRows = [{
		ref: "Ref.",
		part: "Part Number"
	}];
	let validDataCount = 0;
	for (let i = 1; i < lines.length; i++) {
		const cells = parseLineCells(lines[i]);
		const refVal = (cells[refIndex] || "").trim();
		const partVal = (cells[partIndex] || "").trim();
		if (!partVal) continue;
		validDataCount++;
		if (!partMap.has(partVal)) {
			partMap.set(partVal, refVal);
		}
		formattedRows.push({
			ref: refVal,
			part: partVal
		});
	}
	// Lưu bộ nhớ
	fujiData[index] = partMap;
	fujiData[`count${index}`] = validDataCount;
	// Căn dóng dải cột bằng " | "
	let maxRefLen = 0, maxPartLen = 0;
	formattedRows.forEach(r => {
		if (r.ref.length > maxRefLen) maxRefLen = r.ref.length;
		if (r.part.length > maxPartLen) maxPartLen = r.part.length;
	});
	textareaEl.value = formattedRows.map(r => `${r.ref.padEnd(maxRefLen, " ")} | ${r.part.padEnd(maxPartLen, " ")}`).join("\n");
	updateFujiCounts();
}
function updateFujiCounts() {
	const totalParts = renderCombinedTable("samePart_F", fujiData[1], fujiData[2], "Ref.", "Part Number");
	updateFooterStatus(fujiData.count1, fujiData.count2, totalParts);
}
////////////////////////////////////////////////////////////////////////////////////////////////////
// XỬ LÝ PART PANA (IMPORT CSV FILE / DRAG & DROP)
const importLabels = document.querySelectorAll(".label-importfile");
importLabels.forEach((label, index) => {
	const fileIndex = index + 1;
	const fileInput = label.querySelector("input[type='file']");
	if (fileInput) {
		fileInput.addEventListener("change", function() {
			if (this.files && this.files[0]) processCSVFile(this.files[0], fileIndex);
		});
	}
	label.addEventListener("dragover", (e) => {
		e.preventDefault();
		e.stopPropagation();
		label.classList.add("drag-over");
	});
	label.addEventListener("dragleave", (e) => {
		e.preventDefault();
		e.stopPropagation();
		label.classList.remove("drag-over");
	});
	label.addEventListener("drop", (e) => {
		e.preventDefault();
		e.stopPropagation();
		label.classList.remove("drag-over");
		if (e.dataTransfer.files && e.dataTransfer.files[0]) {
			processCSVFile(e.dataTransfer.files[0], fileIndex);
		}
	});
});
function processCSVFile(file, fileIndex) {
	const reader = new FileReader();
	reader.onload = function(e) {
		const text = e.target.result.trim();
		if (!text) return;
		const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
		if (lines.length === 0) return;
		const headers = lines[0].split(",").map(cell => cell.trim().toLowerCase());
		const desigIndex = headers.findIndex(h => h === "designator" || h.startsWith("ref"));
		const partIndex = headers.findIndex(h => h === "part name" || h === "part");
		const containerId = `importCSV_${fileIndex}`;
		const container = document.getElementById(containerId);
		if (desigIndex === -1 || partIndex === -1) {
			if (container) container.textContent = "Không tìm thấy cột 'Designator' hoặc 'Part Name'!";
			return;
		}
		const partMap = new Map();
		const rowsData = [];
		let validDataCount = 0;
		for (let i = 1; i < lines.length; i++) {
			const cells = lines[i].split(",").map(cell => cell.trim());
			const desigVal = cells[desigIndex] || "";
			const partVal = cells[partIndex] || "";
			if (!partVal) continue;
			validDataCount++;
			if (!partMap.has(partVal)) {
				partMap.set(partVal, desigVal);
			}
			rowsData.push([desigVal, partVal]);
		}
		// Lưu bộ nhớ
		panaData[fileIndex] = partMap;
		panaData[`count${fileIndex}`] = validDataCount;
		// Render bảng đơn lẻ của file CSV vừa chọn
		if (container) {
			container.innerHTML = "";
			const table = createHTMLTable(["Designator", "Part Name"], rowsData);
			container.appendChild(table);
		}
		updatePanaCounts();
	};
	reader.readAsText(file);
}
function updatePanaCounts() {
	const totalParts = renderCombinedTable("samePart_P", panaData[1], panaData[2], "Designator", "Part Name");
	updateFooterStatus(panaData.count1, panaData.count2, totalParts);
}