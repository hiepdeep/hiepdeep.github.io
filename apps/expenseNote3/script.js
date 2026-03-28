console.clear();

const app = firebase.initializeApp({
	databaseURL: "https://eimi-fukada-default-rtdb.firebaseio.com"
});
const database = firebase.database();
const db = "so-chi-tieu-v2";

document.addEventListener("DOMContentLoaded", () => {
	renderViewsChart("chart-view");
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

document.getElementById("add-new").addEventListener("click", function() {
	event.preventDefault();
	document.getElementById("side-l").classList.add("open-form");
});

document.getElementById("close-form").addEventListener("click", function() {
	event.preventDefault();
	document.getElementById("side-l").classList.remove("open-form");
});