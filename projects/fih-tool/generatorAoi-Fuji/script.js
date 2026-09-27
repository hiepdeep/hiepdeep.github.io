console.clear();
console.log("Create: 27/09/2026. By HiepDz");
console.log("Update: 27/09/2026. By HiepDz");
////////////////////////////////////////////////////////////////////////////////////////////////////
// Khai báo tên biến Element, trạng thái dữ liệu
const btnImport = document.getElementsByClassName("btn-import");
const dataImport = document.getElementsByClassName("data-import");
const btnExport = document.getElementById("btnGenerator");
const dataExport = document.getElementById("dataGenerator");
let $parts = 0, $cads = 0, $cad = 0, $uncad = 0;
////////////////////////////////////////////////////////////////////////////////////////////////////
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
////////////////////////////////////////////////////////////////////////////////////////////////////
// Mark
document.getElementById("pasteMark").addEventListener("input", (e) => {
	e.target.value = formatData_1(e.target.value);
});
////////////////////////////////////////////////////////////////////////////////////////////////////
// Placement
document.getElementById("pastePlacement").addEventListener("input", (e) => {
	e.target.value = formatData_1(e.target.value);
	document.getElementById("sumPlacement").innerText = e.target.value.trim().split("\n").length - 1;
});
////////////////////////////////////////////////////////////////////////////////////////////////////
// PartReportUnit
document.getElementById("newPartReportUnit").addEventListener("change", function() {
	let files = this.files;
	if (!files || files.length === 0) return;
	let allDataRows = [];
	let globalCounter = 1;
	function readIndividualFile(index) {
		if (index >= files.length) {
			formatData_2("importPartReportUnit", allDataRows);
			document.getElementById("sumPartUnit").innerText = globalCounter - 1;
			return;
		}
		let reader = new FileReader();
		reader.onload = function(e) {
			let result = e.target.result.replace(/(\<\?)(.+)(\?\>)/gi, "").trim();
			let tempDiv = document.createElement("div");
			tempDiv.innerHTML = result;
			let xml_partreportunit = tempDiv.getElementsByTagName("partreportunit");
			let xml_unit = xml_partreportunit.length > 0 ? xml_partreportunit[0].getElementsByTagName("unit") : [];
			for (let i = 0; i < xml_unit.length; i++) {
				if (index > 0 && i === 0) continue;
				let rowData = [];
				let children = xml_unit[i].children;
				for (let j = 0; j < children.length; j++) {
					let cellText = (children[j].innerText || children[j].textContent || "").trim();
					if (j === 0 && cellText !== "seqInsOrder") {
						rowData.push(globalCounter.toString());
					} else {
						rowData.push(cellText);
					}
				}
				if (rowData[0] !== "seqInsOrder") {
					globalCounter++;
				}
				allDataRows.push(rowData);
			}
			readIndividualFile(index + 1);
		};
		reader.readAsText(files[index]);
	}
	readIndividualFile(0);
});
////////////////////////////////////////////////////////////////////////////////////////////////////
// Insert Order
document.getElementById("pasteInsertOrder").addEventListener("input", function(e) {
	e.target.value = formatData_1(e.target.value);
});
////////////////////////////////////////////////////////////////////////////////////////////////////
// Generator
btnExport.addEventListener("click", function(e) {
	e.preventDefault();
	for (let j = 0; j < btnImport.length; j++) {
		btnImport[j].classList.remove("active");
		dataImport[j].classList.remove("active");
	}
	btnExport.classList.add("active");
	dataExport.classList.add("active");
	// Mark
	let data_Mark = document.getElementById("pasteMark").value.trim();
	let row_Mark = [];
	let tempMarkRows = data_Mark.split("\n");
	for (let x = 0; x < tempMarkRows.length; x++) {
		row_Mark.push([]);
		let cells = tempMarkRows[x].split("|");
		for (let xx = 0; xx < cells.length; xx++) {
			row_Mark[x].push(cells[xx].trim());
		}
	}
	let mark_Block = row_Mark[0].indexOf("Board");
	let mark_LocationName = row_Mark[0].indexOf("Ref.");
	let mark_X = row_Mark[0].indexOf("Pos X");
	let mark_Y = row_Mark[0].indexOf("Pos Y");
	let arr_Mark = [["Block", "Location Name", "X", "Y"]];
	for (let row = 1; row < row_Mark.length; row++) {
		arr_Mark.push([]);
		let newRowIndex = arr_Mark.length - 1;
		arr_Mark[newRowIndex].push(row_Mark[row][mark_Block].trim());
		arr_Mark[newRowIndex].push(row_Mark[row][mark_LocationName].trim());
		arr_Mark[newRowIndex].push(row_Mark[row][mark_X].trim());
		arr_Mark[newRowIndex].push(row_Mark[row][mark_Y].trim());
	}
	// Place
	let data_Place = document.getElementById("pastePlacement").value.trim();
	let row_Place = [];
	let tempPlaceRows = data_Place.split("\n");
	for (let x = 0; x < tempPlaceRows.length; x++) {
		row_Place.push([]);
		let cells = tempPlaceRows[x].split("|");
		for (let xx = 0; xx < cells.length; xx++) {
			row_Place[x].push(cells[xx].trim());
		}
	}
	let place_Board = row_Place[0].indexOf("Board");
	let place_Ref = row_Place[0].indexOf("Ref.");
	let place_PosX = row_Place[0].indexOf("Pos X");
	let place_PosY = row_Place[0].indexOf("Pos Y");
	let place_Rotation = row_Place[0].indexOf("Rotation");
	let place_PartNumber = row_Place[0].indexOf("Part Number");
	let place_Assign = row_Place[0].indexOf("Assign");
	let arr_Place = [["BoardRef", "Board", "Ref.", "Pos X", "Pos Y", "Rotation", "Part Number", "Assign"]];
	for (let row = 1; row < row_Place.length; row++) {
		arr_Place.push([]);
		let newRowIndex = arr_Place.length - 1;
		let brdNum = row_Place[row][place_Board].trim();
		let ref = row_Place[row][place_Ref].trim();
		arr_Place[newRowIndex].push(brdNum + ref);
		arr_Place[newRowIndex].push(brdNum);
		arr_Place[newRowIndex].push(ref);
		arr_Place[newRowIndex].push(row_Place[row][place_PosX].trim());
		arr_Place[newRowIndex].push(row_Place[row][place_PosY].trim());
		arr_Place[newRowIndex].push(row_Place[row][place_Rotation].trim());
		arr_Place[newRowIndex].push(row_Place[row][place_PartNumber].trim());
		arr_Place[newRowIndex].push(row_Place[row][place_Assign].trim());
	}
	// PartReportUnit
	let data_PartReportUnit = document.getElementById("importPartReportUnit").value.trim();
	let row_PartReportUnit = [];
	let tempPartReportUnitRows = data_PartReportUnit.split("\n");
	for (let x = 0; x < tempPartReportUnitRows.length; x++) {
		row_PartReportUnit.push([]);
		let cells = tempPartReportUnitRows[x].split("|");
		for (let xx = 0; xx < cells.length; xx++) {
			row_PartReportUnit[x].push(cells[xx].trim());
		}
	}
	let unit_seqBrdNum = row_PartReportUnit[0].indexOf("seqBrdNum");
	let unit_seqRef = row_PartReportUnit[0].indexOf("seqRef");
	let unit_seqPartNum = row_PartReportUnit[0].indexOf("seqPartNum");
	let unit_fsSetPos = row_PartReportUnit[0].indexOf("fsSetPos");
	let arr_PartReportUnit = [
		["Board", "Ref.", "Part Number", "Mounter", "Feeder", "BoardRef"]
	];
	for (let row = 1; row < row_PartReportUnit.length; row++) {
		arr_PartReportUnit.push([]);
		let newRowIndex = arr_PartReportUnit.length - 1;
		let brdNum = row_PartReportUnit[row][unit_seqBrdNum].trim();
		let ref = row_PartReportUnit[row][unit_seqRef].trim();
		arr_PartReportUnit[newRowIndex].push(brdNum);
		arr_PartReportUnit[newRowIndex].push(ref);
		arr_PartReportUnit[newRowIndex].push(row_PartReportUnit[row][unit_seqPartNum].trim());
		arr_PartReportUnit[newRowIndex].push(convertFsSetPos(row_PartReportUnit[row][unit_fsSetPos].trim(), "M"));
		arr_PartReportUnit[newRowIndex].push(convertFsSetPos(row_PartReportUnit[row][unit_fsSetPos].trim(), "F"));
		arr_PartReportUnit[newRowIndex].push(brdNum + ref);
	}
	// Insert Order
	let data_InsertOrder = document.getElementById("pasteInsertOrder").value.trim();
	let hasInsertOrderData = data_InsertOrder.length > 0;
	let arr_InsertOrder = [
		["Reference", "Holder"]
	];
	if (hasInsertOrderData) {
		let row_InsertOrder = [];
		let tempInsertOrderRows = data_InsertOrder.split("\n");
		for (let x = 0; x < tempInsertOrderRows.length; x++) {
			row_InsertOrder.push([]);
			let cells = tempInsertOrderRows[x].split("|");
			for (let xx = 0; xx < cells.length; xx++) {
				row_InsertOrder[x].push(cells[xx].trim());
			}
		}
		let order_Reference = null;
		let order_Holder = null;
		if (row_InsertOrder.length > 0 && row_InsertOrder[0].length > 0) {
			order_Reference = row_InsertOrder[0].indexOf("Reference");
			order_Holder = row_InsertOrder[0].indexOf("Holder Number");
		} else {
			order_Reference = -1;
			order_Holder = -1;
		}
		for (let row = 1; row < row_InsertOrder.length; row++) {
			if (row_InsertOrder[row].length > order_Reference && row_InsertOrder[row].length > order_Holder && order_Reference !== -1 && order_Holder !== -1) {
				arr_InsertOrder.push([]);
				let newRowIndex = arr_InsertOrder.length - 1;
				arr_InsertOrder[newRowIndex].push(row_InsertOrder[row][order_Reference].trim());
				arr_InsertOrder[newRowIndex].push(row_InsertOrder[row][order_Holder].trim());
			}
		}
	}
	// Generator CAD
	let table = document.createElement("table");
	let headerRow = table.insertRow();
	let headers = ["Block", "Location Name", "X", "Y", "Angle", "Part Number", "Mouter", "Feeder"];
	if (hasInsertOrderData) {
		headers.push("Holder");
	}
	for (let h = 0; h < headers.length; h++) {
		let th = document.createElement("th");
		th.textContent = headers[h];
		headerRow.appendChild(th);
	}
	for (let tr_Mark = 1; tr_Mark < arr_Mark.length; tr_Mark++) {
		if (arr_Mark[tr_Mark][0] == "0") {
			let locationName = arr_Mark[tr_Mark][1];
			let lastChar = locationName.charAt(locationName.length - 1);
			let row = table.insertRow();
			row.insertCell().textContent = arr_Mark[tr_Mark][0];
			row.insertCell().textContent = arr_Mark[tr_Mark][1];
			row.insertCell().textContent = arr_Mark[tr_Mark][2];
			row.insertCell().textContent = arr_Mark[tr_Mark][3];
			row.insertCell().textContent = "0";
			row.insertCell().textContent = "Mark";
			row.insertCell().textContent = "0";
			row.insertCell().textContent = "0";
			if (hasInsertOrderData) {
				row.insertCell().textContent = "0";
			}
		}
	}
	let ref_PartUnit = arr_PartReportUnit[0].indexOf("BoardRef");
	let sumPoint = 0;
	for (let tr_PartUnit = 1; tr_PartUnit < arr_PartReportUnit.length; tr_PartUnit++) {
		let boardRefKey = arr_PartReportUnit[tr_PartUnit][ref_PartUnit];
		let board = vlookup(boardRefKey, arr_Place, 1);
		let ref = vlookup(boardRefKey, arr_Place, 2);
		let posX = vlookup(boardRefKey, arr_Place, 3);
		let posY = vlookup(boardRefKey, arr_Place, 4);
		let rotation = vlookup(boardRefKey, arr_Place, 5);
		let partNumber = vlookup(boardRefKey, arr_Place, 6);
		let assign = vlookup(boardRefKey, arr_Place, 7);
		let mounter = arr_PartReportUnit[tr_PartUnit][3];
		let feeder = arr_PartReportUnit[tr_PartUnit][4];
		if (board && ref) {
			sumPoint++;
			let row = table.insertRow();
			row.insertCell().textContent = board.trim();
			row.insertCell().textContent = ref.trim();
			row.insertCell().textContent = posX.trim();
			row.insertCell().textContent = posY.trim();
			row.insertCell().textContent = rotation.trim();
			row.insertCell().textContent = partNumber.trim();
			row.insertCell().textContent = assign.trim() + "-" + mounter.trim();
			row.insertCell().textContent = feeder.trim();
			if (hasInsertOrderData) {
				let searchOrder = board.trim() + ":" + ref.trim();
				let holderValue = getHolder(searchOrder, arr_InsertOrder);
				let holderCell = holderValue ? "H" + holderValue.trim() : "";
				row.insertCell().textContent = holderCell;
			}
		}
	}
	document.getElementById("tableResult").innerHTML = "";
	document.getElementById("tableResult").appendChild(table);
	document.getElementById("sumPoint").innerText = sumPoint;
});
////////////////////////////////////////////////////////////////////////////////////////////////////
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
		return Array.from({length: numCols}, (_, i) => {
			const cell = row[i] || "";
			return cell.padEnd(colWidths[i], " ");
		}).join(" | ");
	}).join("\n");
}
function formatData_2(elementId, rows) {
	const inputElement = document.getElementById(elementId);
	if (!inputElement) return;
	if (!rows || rows.length === 0 || !rows[0] || rows[0].length === 0) {
		inputElement.value = "Lỗi: Không tìm thấy dữ liệu!";
		return;
	}
	const maxCols = Math.max(...rows.map(row => row.length));
	const colMaxLengths = Array.from({length: maxCols}, (_, colIdx) => {
		return Math.max(...rows.map(row => (row[colIdx] ? String(row[colIdx]) : "").length));
	});
	const formattedText = rows.map(row => {
		return Array.from({length: maxCols}, (_, colIdx) => {
			const cellValue = row[colIdx] != null ? String(row[colIdx]) : "";
			return cellValue.padEnd(colMaxLengths[colIdx], " ");
		}).join(" | ");
	}).join("\n");
	inputElement.value = formattedText.trim();
}
function convertFsSetPos(fsSetPos, type) {
	if (!fsSetPos) return;
	let x = fsSetPos.split(/[\s-]+/);
	if (x.length === 2) {
		if (type == "M") {
			return "M" + x[0];
		}
		else if (type == "F") {
			return "F" + x[1];
		}
	}
	else if (x.length >= 3) {
		if (type == "M") {
			return "M" + x[0];
		}
		else if (type == "F") {
			return x[1] + x[2];
		}
	}
	return;
}
function vlookup(key, range, col) {
	for (let i = 0; i < range.length; i++) {
		if (range[i].length > 6 && range[i][0] == key) {
			return range[i][col];
		}
	}
	return "";
}
function getHolder(searchOrderKey, arr) {
	for (let i = 1; i < arr.length; i++) {
		if (arr[i].length >= 2) {
			let reference = arr[i][0];
			let holder = arr[i][1];
			if (reference === searchOrderKey) {
				return holder;
			}
		}
	}
	return "";
}