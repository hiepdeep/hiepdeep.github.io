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
// CSV
document.getElementById("newCSV").addEventListener("change", function() {
	let file = this.files[0];
	if (!file) return;
	let reader = new FileReader();
	reader.onload = function(e) {
		let result = e.target.result.trim();
		let $a = [];
		let $b = [];
		let $c = [];
		let $d = [];
		let inputElement = document.getElementById("importCSV");
		let txtInput = result.split("\n");
		for (let x = 0; x < txtInput.length; x++) {
			$a.push([]);
			let cells = txtInput[x].split(",");
			for (let xx = 0; xx < cells.length; xx++) {
				$a[x].push(cells[xx].trim());
			}
		}
		if ($a.length > 0 && $a[0].length > 0) {
			for (let x = 0; x < $a[0].length; x++) {
				$b.push([]);
				$c.push([]);
				$d.push([]);
				for (let xx = 0; xx < $a.length; xx++) {
					let cellValue = $a[xx][x] || "";
					$b[x].push(cellValue);
					$c[x].push(cellValue.length);
				}
				$d[x].push(Math.max.apply(null, $c[x]));
				for (let u = 0; u < $b[x].length; u++) {
					let uLength = $b[x][u].length;
					let maxLength = $d[x][0];
					if (uLength < maxLength) {
						for (let k = 0; k < (maxLength - uLength); k++) {
							$b[x][u] += " ";
						}
					}
				}
			}
			let ee = "";
			for (let x = 0; x < $b[0].length; x++) {
				for (let xx = 0; xx < $b.length; xx++) {
					ee += $b[xx][x];
					if (xx < $b.length - 1) {
						ee += " | ";
					}
				}
				if (x < $b[0].length - 1) {
					ee += "\n";
				}
			}
			inputElement.value = ee.trim();
			document.getElementById("sumPlacement").innerText = txtInput.length;
		}
	};
	reader.readAsText(file);
});
////////////////////////////////////////////////////////////////////////////////////////////////////
// Chức năng kéo thả file
const importCSVArea = document.getElementById("importCSV");
if (importCSVArea) {
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
			let fileInput = document.getElementById("newCSV");
			// Gán file vừa kéo thả vào input #newCSV và kích hoạt lại sự kiện change sẵn có
			let dataTransfer = new DataTransfer();
			dataTransfer.items.add(files[0]);
			fileInput.files = dataTransfer.files;

			fileInput.dispatchEvent(new Event("change"));
		}
	});
}
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
	let data_CSV = document.getElementById("importCSV").value.trim();
	let row_CSV = [];
	let tempCSVRows = data_CSV.split("\n");
	for (let x = 0; x < tempCSVRows.length; x++) {
		row_CSV.push([]);
		let cells = tempCSVRows[x].split("|");
		for (let xx = 0; xx < cells.length; xx++) {
			row_CSV[x].push(cells[xx].trim());
		}
	}
	let csv_Board = row_CSV[0].indexOf("Pattern");
	let csv_Ref = row_CSV[0].indexOf("Designator");
	let csv_PosX = row_CSV[0].indexOf("X");
	let csv_PosY = row_CSV[0].indexOf("Y");
	let csv_Rotation = row_CSV[0].indexOf("Rotation");
	let csv_PartNumber = row_CSV[0].indexOf("Part Name");
	// Generator CAD
	let sumPoint = 0;
	let table = document.createElement("table");
	let headerRow = table.insertRow();
	["Board", "Ref.", "Pos X", "Pos Y", "Pos Z", "Rotation", "Part Number", "Place Before", "Gluing", "Skip", "Main Mark", "Sub Mark", "Sub Mark1", "Sub Mark2", "Carry Mode", "Stack Target", "Memo", "Tag", "Assign"].forEach(text => {
		headerRow.appendChild(Object.assign(document.createElement("th"), { textContent: text }));
	});
	let mark = [
		[
			document.getElementById("mark-X1").value.trim() || 0,
			document.getElementById("mark-Y1").value.trim() || 0
		],
		[
			document.getElementById("mark-X2").value.trim() || 0,
			document.getElementById("mark-Y2").value.trim() || 0
		]
	]
	for (let i = 0; i < 2; i++) {
		let row = table.insertRow();
		["0", `Mark${i + 1}`, mark[i][0], mark[i][1], "0", "0", "MARK", "", "Yes", "No", "", "", "", "", "Arc", "", "", "No", ""].forEach(val => row.insertCell().textContent = val);
	}
	for (let i = 1; i < row_CSV.length; i++) {
		sumPoint++;
		let row = table.insertRow();
		row.insertCell().textContent = row_CSV[i][csv_Board];
		row.insertCell().textContent = row_CSV[i][csv_Ref];
		row.insertCell().textContent = row_CSV[i][csv_PosX];
		row.insertCell().textContent = row_CSV[i][csv_PosY];
		row.insertCell().textContent = "0";
		row.insertCell().textContent = rotateFormat(row_CSV[i][csv_Rotation]);
		row.insertCell().textContent = row_CSV[i][csv_PartNumber];
		row.insertCell().textContent = "";
		row.insertCell().textContent = "Yes";
		row.insertCell().textContent = "No";
		row.insertCell().textContent = "";
		row.insertCell().textContent = "";
		row.insertCell().textContent = "";
		row.insertCell().textContent = "";
		row.insertCell().textContent = "Arc";
		row.insertCell().textContent = "";
		row.insertCell().textContent = "";
		row.insertCell().textContent = "No";
		row.insertCell().textContent = "";
	}
	document.getElementById("tableResult").innerHTML = "";
	document.getElementById("tableResult").appendChild(table);
	document.getElementById("sumPoint").innerText = sumPoint;
});
////////////////////////////////////////////////////////////////////////////////////////////////////
// Function
function rotateFormat(value) {
	let num = Number(value);
	if (isNaN(num)) return value;
	let positiveAngle = ((num % 360) + 360) % 360;
	return String(positiveAngle);
}