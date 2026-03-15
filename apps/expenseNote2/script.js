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
			renderChitieu();
			renderViewsChart("chart-view");
		}).catch((error) => {
			console.error("Lỗi khi tạo chi tiêu mới:", error);
		});
	});
});

async function renderChitieu() {
	const snapshot = await database.ref(db).once("value");
	const data = snapshot.val() || {};
	const lists = {
		hieu_expense: document.getElementById("list-expense-hieu"),
		hiep_expense: document.getElementById("list-expense-hiep"),
		hieu_borrow: document.getElementById("list-borrow-hieu"),
		hiep_borrow: document.getElementById("list-borrow-hiep")
	};
	Object.values(lists).forEach(list => list.innerHTML = "");
	let s_exp_hieu = 0,
		s_exp_hiep = 0,
		s_bor_hieu = 0,
		s_bor_hiep = 0;
	for (let year in data) {
		for (let month in data[year]) {
			const entries = data[year][month];
			for (let id in entries) {
				const item = entries[id];
				if (item.status === "offline") continue;
				const amountNum = parseInt(item.amount) || 0;
				const path = `${db}/${year}/${month}/${id}`;
				const li = document.createElement("li");
				li.setAttribute("data-key", id);
				li.setAttribute("data-type", item.type);
				const formattedDate = item.creationDate.split(' ')[0].replace(/\//g, '-');
				const formattedAmount = amountNum.toLocaleString('vi-VN');
				li.innerHTML = `
					<div class="data">
						<div class="timeamp">${formattedDate}</div>
						<div class="amount">${formattedAmount}</div>
					</div>
					<div class="description">${item.description}</div>
				`;
				li.addEventListener("click", async () => {
					const confirmDelete = confirm(`Bạn có chắc muốn xóa: "${item.description}"?`);
					if (confirmDelete) {
						try {
							await database.ref(path).update({
								status: "offline"
							});
							renderChitieu();
							renderViewsChart("chart-view");
						} catch (error) {
							console.error("Lỗi khi xóa:", error);
						}
					}
				});
				if (item.person === "hieu") {
					if (item.type === "expense") {
						s_exp_hieu += amountNum;
						lists.hieu_expense.appendChild(li);
					} else {
						s_bor_hieu += amountNum;
						lists.hieu_borrow.appendChild(li);
					}
				} else if (item.person === "hiep") {
					if (item.type === "expense") {
						s_exp_hiep += amountNum;
						lists.hiep_expense.appendChild(li);
					} else {
						s_bor_hiep += amountNum;
						lists.hiep_borrow.appendChild(li);
					}
				}
			}
		}
	}
	Object.values(lists).forEach(list => {
		if (list.children.length === 0) {
			list.innerHTML = "<li>Chưa có dữ liệu</li>";
		}
	});
	const hieu_dang_no = (s_exp_hiep / 2) + s_bor_hiep;
	const hiep_dang_no = (s_exp_hieu / 2) + s_bor_hieu;
	let final_hieu_tra = Math.max(0, hieu_dang_no - hiep_dang_no);
	let final_hiep_tra = Math.max(0, hiep_dang_no - hieu_dang_no);
	document.getElementById("total-expense-hieu").innerText = s_exp_hieu.toLocaleString('vi-VN');
	document.getElementById("total-expense-hiep").innerText = s_exp_hiep.toLocaleString('vi-VN');
	document.getElementById("total-borrow-hieu").innerText = s_bor_hieu.toLocaleString('vi-VN');
	document.getElementById("total-borrow-hiep").innerText = s_bor_hiep.toLocaleString('vi-VN');
	document.getElementById("hieu-tra-hiep").innerText = final_hieu_tra.toLocaleString('vi-VN');
	document.getElementById("hiep-tra-hieu").innerText = final_hiep_tra.toLocaleString('vi-VN');
}

async function renderViewsChart(ctxId) {
	const chartView = document.getElementById("chart-view-box");
	const myCanvas = document.getElementById(ctxId);
	const ctx = myCanvas.getContext("2d");
	myCanvas.width = chartView.getBoundingClientRect().width;
	myCanvas.height = chartView.getBoundingClientRect().height;
	const currentYear = new Date().getFullYear().toString();
	const snapshot = await database.ref(`${db}/${currentYear}`).once("value");
	const yearData = snapshot.val() || {};
	const monthlyExpenses = new Array(12).fill(0);
	for (let month in yearData) {
		const monthIndex = parseInt(month) - 1;
		if (monthIndex >= 0 && monthIndex < 12) {
			const entries = yearData[month];
			for (let id in entries) {
				const item = entries[id];
				if (item.status === "offline") continue;
				if (item.type === "expense") {
					monthlyExpenses[monthIndex] += parseInt(item.amount) || 0;
				}
			}
		}
	}
	const values = monthlyExpenses;
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
		// const my_gradient = ctx.createLinearGradient(0, myCanvas.height, myCanvas.width, 0);
		// my_gradient.addColorStop(0, `rgba(207, 217, 223, ${progress})`);
		// my_gradient.addColorStop(0.5, `rgba(226, 235, 240, ${progress})`);
		// my_gradient.addColorStop(1, `rgba(207, 217, 223, ${progress})`);
		// ctx.fillStyle = my_gradient;
		// ctx.fillRect(0, 0, myCanvas.width, myCanvas.height);
		values.forEach((val, index) => {
			const availableHeight = myCanvas.height - paddingTop - paddingBottom;
			const targetBarHeight = (val / maxVal) * availableHeight;
			const currentBarHeight = targetBarHeight * progress;
			const x = gap + (slot_width + gap) * index;
			const baseY = myCanvas.height - paddingBottom;
			const y = baseY - currentBarHeight;
			ctx.fillStyle = val === maxVal ? "#4CAF50" : "#2196F3";
			ctx.shadowBlur = 10;
			ctx.shadowOffsetX = 6;
			ctx.shadowOffsetY = 6;
			ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
			ctx.beginPath();
			ctx.roundRect(x, y, slot_width, currentBarHeight, borderRadius);
			ctx.fill();
			ctx.fillStyle = val === maxVal ? "#4CAF50" : "#2196F3";
			ctx.shadowBlur = 0;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.font = "500 12px Playpen Sans";
			ctx.textAlign = 'center';
			ctx.fillText(`T${index + 1}`, x + slot_width / 2, baseY + 30 - gap);
			if (progress >= 1 && val > 0) {
				ctx.fillText(val.toLocaleString(), x + slot_width / 2, y - 12);
			}
		});
		if (progress < 1) {
			requestAnimationFrame(animate);
		}
	}
	animate();
}

function aaa() {
	const history_page = document.getElementsByClassName("history-page")[0];

	history_page.style.width = document.getElementsByClassName("sideRight")[0].getBoundingClientRect().width - 24 + "px";
	history_page.style.height = document.getElementsByClassName("sideRight")[0].getBoundingClientRect().height - 24 + "px";
}
aaa();