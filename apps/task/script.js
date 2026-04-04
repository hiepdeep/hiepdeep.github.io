console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://eimi-fukada-default-rtdb.firebaseio.com"
});
const database = firebase.database();
const db = "task";

const dates = document.querySelector(".dates");
const header = document.querySelector(".title");
const nav = document.querySelectorAll("#prev, #next");
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let date = new Date();
let month = date.getMonth();
let year = date.getFullYear();

async function renderCalendar() {
	const snapshot = await database.ref(db).once("value");
	const task_data = snapshot.val() || {};
	const start = new Date(year, month, 1).getDay();
	const endDate = new Date(year, month + 1, 0).getDate();
	const end = new Date(year, month, endDate).getDay();
	const endDatePrev = new Date(year, month, 0).getDate();
	const monthKey = String(month + 1).padStart(2, "0");
	const yearKey = String(year);
	let totalDayShiftHours = 0;
	let totalNightShiftHours = 0;
	let totalLeaveHours = 0;
	let totalO150 = 0;
	let totalO200 = 0;
	let totalO210 = 0;
	let totalO270 = 0;
	let countSunday = 0;
	let datesHtml = "";
	for (let i = start; i > 0; i--) {
		datesHtml += `<li class="old"><span class="day">${endDatePrev - i + 1}</span></li>`;
	}
	for (let i = 1; i <= endDate; i++) {
		const dayKey = String(i).padStart(2, "0");
		const dayData = task_data[yearKey] && task_data[yearKey][monthKey] ? task_data[yearKey][monthKey][dayKey] : null;
		const isSunday = new Date(year, month, i).getDay() === 0 ? " sunday" : "";
		if (isSunday) countSunday++;
		let morningClass = "";
		let afternoonClass = "";
		let overtime1 = "";
		let overtime2 = "";
		let nightshiftClass = "";
		if (dayData) {
			if (dayData.task.morning > 0) morningClass = "attendance";
			if (dayData.task.afternoon > 0) afternoonClass = "attendance";
			if (dayData.overtime.o150 > 0 || dayData.overtime.o210 > 0) overtime1 = "overtime1";
			if (dayData.overtime.o200 > 0 || dayData.overtime.o270 > 0) overtime2 = "overtime2";
			let dailyHours = dayData.task.morning + dayData.task.afternoon;
			if (dayData.shift === "nightshift") {
				totalNightShiftHours += dailyHours;
				nightshiftClass = "ns";
			} else {
				totalDayShiftHours += dailyHours;
			}
			if (!isSunday && dayData.task.morning === 0) totalLeaveHours += 4;
			if (!isSunday && dayData.task.afternoon === 0) totalLeaveHours += 4;
			totalO150 += dayData.overtime.o150 || 0;
			totalO200 += dayData.overtime.o200 || 0;
			totalO210 += dayData.overtime.o210 || 0;
			totalO270 += dayData.overtime.o270 || 0;
		}
		let isToday = i === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear() ? "today" : "";
		datesHtml += `
			<li ${isToday} ${isSunday} ${nightshiftClass}>
				<span class="day">${String(i).padStart(2, "0")}</span>
				<div class="data-task" ${overtime2}>
					<div class="process">
						<span class="half-day off-half-morning ${morningClass}"></span>
						<span class="half-day off-half-afternoon ${afternoonClass}"></span>
					</div>
					<span class="overtime ${overtime1}"></span>
				</div>
			</li>
		`;
	}
	for (let i = end; i < 6; i++) {
		datesHtml += `<li class="old"><span class="day">${i - end + 1}</span></li>`;
	}
	dates.innerHTML = datesHtml;
	header.textContent = `${months[month]} ${year}`;
	document.getElementById("hours_in_dayshift").textContent = totalDayShiftHours;
	document.getElementById("hours_in_nightshift").textContent = totalNightShiftHours;
	document.getElementById("half_in_month").textContent = totalLeaveHours;
	document.getElementById("hours_150").textContent = totalO150;
	document.getElementById("hours_200").textContent = totalO200;
	document.getElementById("hours_210").textContent = totalO210;
	document.getElementById("hours_270").textContent = totalO270;
}

nav.forEach(btn => {
	btn.addEventListener("click", e => {
		month = (e.target.id === "next") ? month + 1 : month - 1;
		if (month < 0) {
			month = 11;
			year--;
		} else if (month > 11) {
			month = 0;
			year++;
		}
		renderCalendar();
	});
});

document.addEventListener("DOMContentLoaded", () => {
	renderCalendar();
	document.forms["form"].addEventListener("submit", async function(event) {
		event.preventDefault();
		const $half_morning = document.forms["form"]["half-morning"].checked;
		const $half_afternoon = document.forms["form"]["half-afternoon"].checked;
		const $o150 = document.forms["form"]["overtime150"].checked;
		const $o200 = document.forms["form"]["overtime200"].checked;
		const $nightshift = document.forms["form"]["night-shift"].checked;
		let getTime = new Date();
		let timeYear = String(getTime.getFullYear());
		let timeMonth = String(getTime.getMonth() + 1).padStart(2, "0");
		let timeDate = String(getTime.getDate()).padStart(2, "0");
		let returnTime = `${timeYear}/${timeMonth}/${timeDate}`;
		let dayOfWeek = getTime.getDay();
		const data = {
			task: {
				morning: 4,
				afternoon: 4
			},
			overtime: {
				o150: 0,
				o200: 0,
				o210: 0,
				o270: 0
			},
			shift: "dayshift"
		};
		if ($half_morning) data.task.morning = 0;
		if ($half_afternoon) data.task.afternoon = 0;
		if ($nightshift) {
			data.shift = "nightshift";
			if ($o150) {
				if (dayOfWeek === 6) {
					data.overtime.o210 = 2;
					data.overtime.o270 = 0.75;
				} else {
					data.overtime.o150 = 2;
					data.overtime.o200 = 0.75;
				}
			}
		} else {
			if ($o150) data.overtime.o150 = 3;
			if ($o200) {
				data.task.morning = 0;
				data.task.afternoon = 0;
				data.overtime.o200 = 11;
			}
		}
		database.ref(`${db}/${returnTime}`).set(data).then(() => {
			alert("Đã chấm công ngày hôm nay.");
			document.forms["form"].reset();
			renderCalendar();
		}).catch((error) => {
			alert("Lỗi khi gửi yêu cầu.");
			console.error("Lỗi khi gửi yêu cầu:", error);
		});
	});
});