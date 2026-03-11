console.clear();

console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://eimi-fukada-default-rtdb.firebaseio.com"
});
const database = firebase.database();
const db = "so-chi-tieu-v2";

function date_YM() {
	let getTime = new Date();
	let timeYear = getTime.getFullYear();
	let timeMonth = getTime.getMonth() + 1;
	timeYear = timeYear.toString();
	timeMonth = timeMonth.toString().padStart(2, "0");
	return `${timeYear}/${timeMonth}`;
}

document.addEventListener("DOMContentLoaded", function() {
	const personInputs = document.querySelectorAll('input[name="person"]');
	const typeInputs = document.querySelectorAll('input[name="form-type"]');
	const savedPerson = localStorage.getItem('selectedPerson');
	if (savedPerson) {
		const inputToCheck = document.querySelector(`input[name="person"][value="${savedPerson}"]`);
		if (inputToCheck) inputToCheck.checked = true;
	}
	personInputs.forEach(input => {
		input.addEventListener('change', (e) => {
			localStorage.setItem('selectedPerson', e.target.value);
		});
	});
	const savedType = localStorage.getItem('selectedType');
	if (savedType) {
		const inputToCheck = document.querySelector(`input[name="form-type"][value="${savedType}"]`);
		if (inputToCheck) inputToCheck.checked = true;
	}
	typeInputs.forEach(input => {
		input.addEventListener('change', (e) => {
			localStorage.setItem('selectedType', e.target.value);
		});
	});
});

document.addEventListener("DOMContentLoaded", () => {
	renderChitieu();
	renderViewsChart("chart-view");
	document.forms["form-data"]["amount"].addEventListener("input", function(e) {
		let value = this.value.replace(/\D/g, "");
		const formattedValue = new Intl.NumberFormat("vi-VN").format(value);
		this.value = formattedValue;
	});
	document.forms["form-data"].addEventListener("submit", async function(event) {
		event.preventDefault();
		const $personSelect = document.forms["form-person"]["person"].value;
		const $description = document.forms["form-data"]["description"].value.trim();
		const $amount = document.forms["form-data"]["amount"].value.trim().replace(/\./g, "").trim();
		const $type = document.forms["form-data"]["form-type"].value;
		if (!$description) {
			alert("Vui lòng nhập mô tả chi tiêu.");
			return;
		}
		if (!/^\d+$/.test($amount)) {
			alert("Vui lòng chỉ nhập số vào ô số tiền.");
			return;
		}
		const data = {
			person: $personSelect,
			description: $description,
			amount: $amount,
			type: $type,
			status: "online",
			creationDate: createTimes()
		}
		database.ref(`${db}/${date_YM()}`).push(data).then(() => {
			document.forms["form-data"].reset();
			alert("Thành công.");
			renderChitieu();
		}).catch((error) => {
			console.error("Lỗi khi tạo chi tiêu mới:", error);
		});
	});
});

async function renderChitieu() {
	const snapshot = await database.ref(db).once("value");
	const data = snapshot.val() || {};
	const total_expense_hieu = document.getElementById("total-expense-hieu");
	const list_expense_hieu = document.getElementById("list-expense-hieu");
	const total_expense_hiep = document.getElementById("total-expense-hiep");
	const list_expense_hiep = document.getElementById("list-expense-hiep");
	const total_borrow_hieu = document.getElementById("total-borrow-hieu");
	const list_borrow_hieu = document.getElementById("list-borrow-hieu");
	const total_borrow_hiep = document.getElementById("total-borrow-hiep");
	const list_borrow_hiep = document.getElementById("list-borrow-hiep");
	const hieu_tra_hiep = document.getElementById("hieu-tra-hiep");
	const hiep_tra_hieu = document.getElementById("hiep-tra-hieu");
	let s_exp_hieu = 0,
		s_exp_hiep = 0,
		s_bor_hieu = 0,
		s_bor_hiep = 0;
	let h_exp_hieu = "",
		h_exp_hiep = "",
		h_bor_hieu = "",
		h_bor_hiep = "";
	for (let year in data) {
		for (let month in data[year]) {
			const entries = data[year][month];
			for (let id in entries) {
				const item = entries[id];
				const amountNum = parseInt(item.amount) || 0;
				const formattedAmount = amountNum.toLocaleString('vi-VN');
				const formattedDate = item.creationDate.split(' ')[0].replace(/\//g, '-');
				const htmlTemplate = `
					<li data-key="${id}" data-type="${item.type}">
						<div class="data">
							<div class="timeamp">${formattedDate}</div>
							<div class="amount">${formattedAmount}</div>
						</div>
						<div class="description">${item.description}</div>
					</li>`;
				if (item.person === "hieu") {
					if (item.type === "expense") {
						s_exp_hieu += amountNum;
						h_exp_hieu += htmlTemplate;
					} else if (item.type === "borrow") {
						s_bor_hieu += amountNum;
						h_bor_hieu += htmlTemplate;
					}
				} else if (item.person === "hiep") {
					if (item.type === "expense") {
						s_exp_hiep += amountNum;
						h_exp_hiep += htmlTemplate;
					} else if (item.type === "borrow") {
						s_bor_hiep += amountNum;
						h_bor_hiep += htmlTemplate;
					}
				}
			}
		}
	}
	const hieu_dang_no = (s_exp_hiep / 2) + s_bor_hiep;
	const hiep_dang_no = (s_exp_hieu / 2) + s_bor_hieu;
	let final_hieu_tra = 0;
	let final_hiep_tra = 0;
	if (hieu_dang_no > hiep_dang_no) {
		final_hieu_tra = hieu_dang_no - hiep_dang_no;
		final_hiep_tra = 0;
	} else if (hiep_dang_no > hieu_dang_no) {
		final_hiep_tra = hiep_dang_no - hieu_dang_no;
		final_hieu_tra = 0;
	}
	total_expense_hieu.innerText = s_exp_hieu.toLocaleString('vi-VN');
	list_expense_hieu.innerHTML = h_exp_hieu || "<li>Chưa có dữ liệu</li>";
	total_expense_hiep.innerText = s_exp_hiep.toLocaleString('vi-VN');
	list_expense_hiep.innerHTML = h_exp_hiep || "<li>Chưa có dữ liệu</li>";
	total_borrow_hieu.innerText = s_bor_hieu.toLocaleString('vi-VN');
	list_borrow_hieu.innerHTML = h_bor_hieu || "<li>Chưa có dữ liệu</li>";
	total_borrow_hiep.innerText = s_bor_hiep.toLocaleString('vi-VN');
	list_borrow_hiep.innerHTML = h_bor_hiep || "<li>Chưa có dữ liệu</li>";
	hieu_tra_hiep.innerText = final_hieu_tra.toLocaleString('vi-VN');
	hiep_tra_hieu.innerText = final_hiep_tra.toLocaleString('vi-VN');
}

async function renderViewsChart(ctxId) {
	const chartView = document.getElementById("chart-view-box");
	const myCanvas = document.getElementById(ctxId);
	const ctx = myCanvas.getContext("2d");
	myCanvas.width = chartView.getBoundingClientRect().width;
	myCanvas.height = chartView.getBoundingClientRect().height;
	const dataa = {
		tong_chi_thang_01: "0",
		tong_chi_thang_02: "90000",
		tong_chi_thang_03: "130000",
		tong_chi_thang_04: "0",
		tong_chi_thang_05: "0",
		tong_chi_thang_06: "0",
		tong_chi_thang_07: "0",
		tong_chi_thang_08: "0",
		tong_chi_thang_09: "0",
		tong_chi_thang_10: "0",
		tong_chi_thang_11: "0",
		tong_chi_thang_12: "0",
	}
	const values = Object.values(dataa).map(Number);
	const maxVal = Math.max(...values) || 1;
	const total_month = values.length;
	const gap = 12;
	const paddingTop = 20 + gap;
	const paddingBottom = 30;
	const slot_width = (myCanvas.width - (gap * (total_month + 1))) / total_month;
	const borderRadius = [6, 6, 6, 6];
	let progress = 0;
	function animate() {
		progress += 0.02;
		ctx.clearRect(0, 0, myCanvas.width, myCanvas.height);
		values.forEach((val, index) => {
			const availableHeight = myCanvas.height - paddingTop - paddingBottom;
			const targetBarHeight = (val / maxVal) * availableHeight;
			const currentBarHeight = targetBarHeight * progress;
			const x = gap + (slot_width + gap) * index;
			const baseY = myCanvas.height - paddingBottom;
			const y = baseY - currentBarHeight;
			ctx.fillStyle = val === maxVal ? "#4CAF50" : "#2196F3";
			ctx.beginPath();
			ctx.roundRect(x, y, slot_width, currentBarHeight, borderRadius);
			ctx.fill();
			ctx.fillStyle = val === maxVal ? "#4CAF50" : "#2196F3";
			ctx.shadowBlur = 10;
			ctx.shadowOffsetX = 6;
			ctx.shadowOffsetY = 6;
			ctx.shadowColor = "#ccc";
			ctx.font = "500 12px Playpen Sans";
			ctx.textAlign = 'center';
			ctx.fillText(`T${index + 1}`, x + slot_width / 2, baseY + 30 - gap);
			if (progress >= 1) {
				ctx.fillStyle = val === maxVal ? "#4CAF50" : "#2196F3";
				ctx.font = "500 12px Playpen Sans";
				ctx.fillText(val.toLocaleString(), x + slot_width / 2, y - 12);
			}
		});
		if (progress < 1) {
			requestAnimationFrame(animate);
		}
	}
	animate();
}
