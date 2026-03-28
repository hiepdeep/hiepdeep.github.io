console.clear();

const app = firebase.initializeApp({
	databaseURL: "https://eimi-fukada-default-rtdb.firebaseio.com"
});
const database = firebase.database();
const db = "so-chi-tieu-v2";

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
		database.ref(`${db}/${date_YM()}`).push(data).then(() => {
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
	console.log(  allItems  );
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
		// ...
	});
}

document.getElementById("add-new").addEventListener("click", function() {
	event.preventDefault();
	document.getElementById("side-l").classList.add("open-form");
});

document.getElementById("close-form").addEventListener("click", function() {
	event.preventDefault();
	document.getElementById("side-l").classList.remove("open-form");
});