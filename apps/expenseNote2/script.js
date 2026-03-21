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

document.addEventListener("DOMContentLoaded", () => {
	renderChitieu();
	renderViewsChart("chart-view");
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
		database.ref(`${db}/${date_YM()}`).push(data).then(() => {
			document.forms["form"].reset();
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
		hieu_expense: document.getElementById("lists-expense-hieu"),
		hiep_expense: document.getElementById("lists-expense-hiep"),
		hieu_borrow: document.getElementById("lists-borrow-hieu"),
		hiep_borrow: document.getElementById("lists-borrow-hiep")
	};
	Object.values(lists).forEach(list => list.innerHTML = "");
	let s_exp_hieu = 0,
		s_exp_hiep = 0,
		s_bor_hieu = 0,
		s_bor_hiep = 0;
	const allItems = [];
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
	allItems.forEach(item => {
		const amountNum = parseInt(item.amount) || 0;
		const li = document.createElement("li");
		li.setAttribute("data-key", item.id);
		li.setAttribute("data-type", item.type);
		li.setAttribute("data-status", item.status);
		const status = item.status === "unpaid" ? "Chưa thanh toán" : "Đã thanh toán";
		const formattedDate = item.creationDate.split(" ")[0].replace(/\//g, "-");
		const formattedAmount = amountNum.toLocaleString("vi-VN");
		li.innerHTML = `
			<span class="timeamp">${formattedDate}</span>
			<span class="amount">${formattedAmount}</span>
			<span class="description">${item.description}</span>
			<span class="status">${status}</span>
		`;
		if (item.status === "unpaid") {
			li.addEventListener("click", async () => {
				const confirmDel = confirm(`Xác nhận thanh toán ${formattedAmount}đ cho "${item.description}"?`);
				if (confirmDel) {
					try {
						await database.ref(item.path).update({
							status: "paid"
						});
						renderChitieu();
						renderViewsChart("chart-view");
					} catch (error) {
						console.error("Lỗi khi xác nhận:", error);
					}
				}
			});
			if (item.person === "hieu") {
				if (item.type === "expense") s_exp_hieu += amountNum;
				else s_bor_hieu += amountNum;
			} else if (item.person === "hiep") {
				if (item.type === "expense") s_exp_hiep += amountNum;
				else s_bor_hiep += amountNum;
			}
		}
		if (item.person === "hieu") {
			if (item.type === "expense") lists.hieu_expense.appendChild(li);
			else lists.hieu_borrow.appendChild(li);
		} else if (item.person === "hiep") {
			if (item.type === "expense") lists.hiep_expense.appendChild(li);
			else lists.hiep_borrow.appendChild(li);
		}
	});
	Object.values(lists).forEach(list => {
		if (list.children.length === 0) {
			list.innerHTML = "";
		}
	});
	const hieu_dang_no = (s_exp_hiep / 2) + s_bor_hiep;
	const hiep_dang_no = (s_exp_hieu / 2) + s_bor_hieu;
	let final_hieu_tra = Math.max(0, hieu_dang_no - hiep_dang_no);
	let final_hiep_tra = Math.max(0, hiep_dang_no - hieu_dang_no);
	document.getElementById("total-expense-hieu").innerText = s_exp_hieu.toLocaleString("vi-VN");
	document.getElementById("total-expense-hiep").innerText = s_exp_hiep.toLocaleString("vi-VN");
	document.getElementById("total-borrow-hieu").innerText = s_bor_hieu.toLocaleString("vi-VN");
	document.getElementById("total-borrow-hiep").innerText = s_bor_hiep.toLocaleString("vi-VN");
	document.getElementById("hieu-tra-hiep").innerText = final_hieu_tra.toLocaleString("vi-VN");
	document.getElementById("hiep-tra-hieu").innerText = final_hiep_tra.toLocaleString("vi-VN");
}

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
			ctx.fillStyle = val === maxVal ? "hsl(215deg 70% 45%)" : "hsl(215deg 70% 55%)";
			ctx.shadowBlur = 10;
			ctx.shadowOffsetX = 6;
			ctx.shadowOffsetY = 6;
			ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
			ctx.beginPath();
			ctx.roundRect(x, y, slot_width, currentBarHeight, borderRadius);
			ctx.fill();
			ctx.fillStyle = "hsl(215deg 70% 5%)";
			ctx.shadowBlur = 0;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.font = "500 12px Bai Jamjuree";
			ctx.textAlign = "center";
			ctx.fillText(`T${(index + 1).toString().padStart(2, '0')}`, x + slot_width / 2, baseY + 30 - gap);
			// if (progress >= 1 && val > 0) {
			// 	ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
			// 	ctx.fillText(val.toLocaleString() + "đ", x + slot_width / 2, y - 12);
			// }
		});
		if (progress < 1) {
			requestAnimationFrame(animate);
		}
	}
	animate();
}

// https://codepen.io/themustafaomar/full/jLMPKm