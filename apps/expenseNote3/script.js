console.clear();

const app = firebase.initializeApp({
	databaseURL: "https://eimi-fukada-default-rtdb.firebaseio.com"
});
const database = firebase.database();
const db = "so-chi-tieu-v2";
let allItems = [];
let currentView = { person: null, type: null };

document.addEventListener("DOMContentLoaded", () => {
	renderViewsChart("chart-view");
	renderChitieu();
	document.forms["form"]["form-amount"].addEventListener("input", function(e) {
		let value = this.value.replace(/\D/g, "");
		const formattedValue = new Intl.NumberFormat("vi-VN").format(value);
		this.value = formattedValue;
	});
	document.forms["form"].addEventListener("submit", async function(event) {
		event.preventDefault();
		const $personSelect = document.forms["form"]["form-person"].value;
		const $description = document.forms["form"]["form-description"].value.trim();
		const $amount = document.forms["form"]["form-amount"].value.trim().replace(/\./g, "").trim();
		const $type = document.forms["form"]["form-type"].value;
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
			status: "unpaid",
			creationDate: createTimes()
		}
		database.ref(`${db}/${createTimes().split(" ")[0]}`).push(data).then(() => {
			document.forms["form"].reset();
			renderChitieu();
			renderViewsChart("chart-view");
		}).catch((error) => {
			console.error("Lỗi khi tạo chi tiêu mới:", error);
		});
	});
});

async function renderViewsChart(ctxId) {
	const chartView = document.getElementById("return-chart");
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
	const paddingTop = gap;
	const paddingBottom = 30;
	const slot_width = (myCanvas.width - (gap * (total_month + 1))) / total_month;
	const borderRadius = [6, 6, 2, 2];
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
			ctx.fillStyle = val === maxVal ? "hsl(205deg, 70%, 50%)" : "hsl(205deg, 70%, 70%)";
			ctx.beginPath();
			ctx.roundRect(x, y, slot_width, currentBarHeight, borderRadius);
			ctx.fill();
			ctx.fillStyle = "hsl(215deg 70% 5%)";
			ctx.shadowBlur = 0;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.font = "400 10px Bai Jamjuree";
			ctx.textAlign = "center";
			ctx.fillText(`T${(index + 1).toString().padStart(2, "0")}`, x + slot_width / 2, baseY + 30 - gap);
		});
		if (progress < 1) {
			requestAnimationFrame(animate);
		}
	}
	animate();
}

async function renderChitieu() {
	const snapshot = await database.ref(db).once("value");
	const data = snapshot.val() || {};
	allItems = [];
	for (let year in data) {
		for (let month in data[year]) {
			const entries = data[year][month];
			for (let id in entries) {
				allItems.push({
					id: id,
					path: `${db}/${year}/${month}/${id}`,
					...entries[id]
				});
			}
		}
	}
	allItems.sort((a, b) => {
		const formatDate = (str) => {
			if (!str) return 0;
			const lastColon = str.lastIndexOf(":");
			const standardStr = str.substring(0, lastColon) + "." + str.substring(lastColon + 1);
			return new Date(standardStr).getTime();
		};
		return formatDate(b.creationDate) - formatDate(a.creationDate);
	});
	const id_tag = {
		hieu_totals_expense: document.getElementById("hieu-totals-expense"),
		hiep_totals_expense: document.getElementById("hiep-totals-expense"),
		hieu_totals_borrow: document.getElementById("hieu-totals-borrow"),
		hiep_totals_borrow: document.getElementById("hiep-totals-borrow"),
		hieu_sums_expense: document.getElementById("hieu-sums-expense"),
		hiep_sums_expense: document.getElementById("hiep-sums-expense"),
		hieu_sums_borrow: document.getElementById("hieu-sums-borrow"),
		hiep_sums_borrow: document.getElementById("hiep-sums-borrow"),
		hieu_pay_hiep: document.getElementById("hieu-pay-hiep"),
		hiep_pay_hieu: document.getElementById("hiep-pay-hieu")
	};
	let num_hieu_totals_expense = 0,
		num_hiep_totals_expense = 0,
		num_hieu_totals_borrow = 0,
		num_hiep_totals_borrow = 0,
		num_hieu_sums_expense = 0,
		num_hiep_sums_expense = 0,
		num_hieu_sums_borrow = 0,
		num_hiep_sums_borrow = 0,
		num_hieu_pay_hiep = 0,
		num_hiep_pay_hieu = 0;
	allItems.forEach(item => {
		if (item.status === "unpaid") {
			const amount = parseInt(item.amount) || 0;
			if (item.person === "hieu") {
				if (item.type === "expense") {
					num_hieu_totals_expense++;
					num_hieu_sums_expense += amount;
				} else if (item.type === "borrow") {
					num_hieu_totals_borrow++;
					num_hieu_sums_borrow += amount;
				}
			} else if (item.person === "hiep") {
				if (item.type === "expense") {
					num_hiep_totals_expense++;
					num_hiep_sums_expense += amount;
				} else if (item.type === "borrow") {
					num_hiep_totals_borrow++;
					num_hiep_sums_borrow += amount;
				}
			}
		}
	});
	let hieu_owes_hiep = (num_hiep_sums_expense / 2) + num_hiep_sums_borrow;
	let hiep_owes_hieu = (num_hieu_sums_expense / 2) + num_hieu_sums_borrow;
	if (hieu_owes_hiep > hiep_owes_hieu) {
		num_hieu_pay_hiep = hieu_owes_hiep - hiep_owes_hieu;
		num_hiep_pay_hieu = 0;
	} else {
		num_hiep_pay_hieu = hiep_owes_hieu - hieu_owes_hiep;
		num_hieu_pay_hiep = 0;
	}
	const formatMoney = (amount) => new Intl.NumberFormat("vi-VN").format(amount);
	id_tag.hieu_totals_expense.textContent = num_hieu_totals_expense;
	id_tag.hiep_totals_expense.textContent = num_hiep_totals_expense;
	id_tag.hieu_totals_borrow.textContent = num_hieu_totals_borrow;
	id_tag.hiep_totals_borrow.textContent = num_hiep_totals_borrow;
	id_tag.hieu_sums_expense.textContent = formatMoney(num_hieu_sums_expense);
	id_tag.hiep_sums_expense.textContent = formatMoney(num_hiep_sums_expense);
	id_tag.hieu_sums_borrow.textContent = formatMoney(num_hieu_sums_borrow);
	id_tag.hiep_sums_borrow.textContent = formatMoney(num_hiep_sums_borrow);
	id_tag.hieu_pay_hiep.textContent = formatMoney(num_hieu_pay_hiep);
	id_tag.hiep_pay_hieu.textContent = formatMoney(num_hiep_pay_hieu);
}

function renderDetailBox(person, type) {
	document.getElementById("close-return-lists-box").addEventListener("click", function() {
		event.preventDefault();
		document.getElementById("return-lists-box").classList.remove("open-box");
	});
	currentView.person = person;
    currentView.type = type;
	const titleBox = document.getElementById("title-box");
	const listContainer = document.getElementById("return-lists");
	const personName = person === "hieu" ? "Hiếu" : "Hiệp";
    const typeName = type === "expense" ? "chi trả" : "cho vay";
	titleBox.getElementsByTagName("h3")[0].innerText = `Lịch sử ${typeName} của ${personName}:`;
	const filteredItems = allItems.filter(item => item.person === person && item.type === type);
	if (filteredItems.length === 0) {
		listContainer.innerHTML = `<div style="text-align: center; color: var(--hsl-gray-70);">Không có dữ liệu</div>`;
		return;
	}
	listContainer.innerHTML = "";
	filteredItems.forEach(item => {
		const li = document.createElement("li");
		li.setAttribute("data-key", item.id);
		li.setAttribute("data-type", item.type);
		li.setAttribute("data-status", item.status);
		const statusText = item.status === "paid" ? "Đã thanh toán" : "Chưa thanh toán";
		const dateDisplay = item.creationDate ? item.creationDate.split(' ')[0] : "N/A";
		const amountDisplay = new Intl.NumberFormat("vi-VN").format(item.amount);
		li.innerHTML = `
			<div class="item-row">
				<div class="item-col time">
					<i class="material-symbols-rounded">calendar_today</i>
					<span class="text">${dateDisplay}</span>
				</div>
				<span class="item-col status">${statusText}</span>
			</div>
			<div class="item-row">
				<div class="item-col description">${item.description}</div>
				<div class="item-col amount">${amountDisplay}</div>
			</div>
		`;
		listContainer.appendChild(li);
		if (item.status === "unpaid") {
			li.addEventListener("click", async () => {
				const confirmDel = confirm(`Xác nhận thanh toán ${amountDisplay}đ cho "${item.description}"?`);
				if (confirmDel) {
					try {
						await database.ref(item.path).update({
							status: "paid"
						});
						renderViewsChart("chart-view");
						await renderChitieu();
						renderDetailBox(currentView.person, currentView.type);
					} catch (error) {
						console.error("Lỗi khi xác nhận:", error);
					}
				}
			});
		}
	});
}

function openDetailBox(person, type) {
	renderDetailBox(person, type);
	const box = document.getElementById("return-lists-box");
	box.classList.add("open-box");
}

document.getElementById("openbox-expense-hieu").addEventListener("click", () => openDetailBox("hieu", "expense"));
document.getElementById("openbox-expense-hiep").addEventListener("click", () => openDetailBox("hiep", "expense"));
document.getElementById("openbox-borrow-hieu").addEventListener("click", () => openDetailBox("hieu", "borrow"));
document.getElementById("openbox-borrow-hiep").addEventListener("click", () => openDetailBox("hiep", "borrow"));

document.getElementById("add-new").addEventListener("click", function() {
	event.preventDefault();
	document.getElementById("side-l").classList.add("open-form");
});

document.getElementById("close-form").addEventListener("click", function() {
	event.preventDefault();
	document.getElementById("side-l").classList.remove("open-form");
});