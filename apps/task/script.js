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

function calculateAttendanceData(y, m, d) {
	const isHalfMorning = document.forms["form"]["half-morning"].checked;
	const isHalfAfternoon = document.forms["form"]["half-afternoon"].checked;
	const isOvertime = document.forms["form"]["overtime"].checked;
	const isNightShift = document.forms["form"]["night-shift"].checked;
	const dateObj = new Date(y, m, d);
	const dayOfWeek = dateObj.getDay();
	const data = {
		task: { morning: 4, afternoon: 4 },
		overtime: { o150: 0, o200: 0, o210: 0, o270: 0 },
		shift: isNightShift ? "nightshift" : "dayshift"
	};
	if (dayOfWeek === 0) {
		data.task.morning = 0;
		data.task.afternoon = 0;
	} else {
		if (isHalfMorning) data.task.morning = 0;
		if (isHalfAfternoon) data.task.afternoon = 0;
	}
	if (isOvertime) {
		if (!isNightShift) {
			if (dayOfWeek === 0) {
				data.overtime.o200 = 11;
			} else {
				data.overtime.o150 = 3;
			}
		} else {
			if (dayOfWeek === 0) {
				data.overtime.o210 = 2;
				data.overtime.o270 = 0.75;
			} else {
				data.overtime.o150 = 2;
				data.overtime.o200 = 0.75;
			}
		}
	}
	return data;
}

async function sendDataToFirebase(y, m, d, data) {
	const timeYear = y;
	const timeMonth = String(m + 1).padStart(2, "0");
	const timeDate = String(d).padStart(2, "0");
	const path = `${db}/${timeYear}/${timeMonth}/${timeDate}`;
	try {
		await database.ref(path).set(data);
		renderCalendar();
	} catch (error) {
		console.error("Lỗi Firebase:", error);
		alert("Không thể lưu dữ liệu.");
	}
}

async function autoFillMissingDays() {
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
	const today = now.getDate();
	const snapshot = await database.ref(`${db}/${currentYear}/${currentMonth}`).once("value");
	const monthData = snapshot.val() || {};
	let updates = {};
	let hasMissing = false;
	for (let i = 1; i < today; i++) {
		const dayKey = String(i).padStart(2, "0");
		if (!monthData[dayKey]) {
			hasMissing = true;
			updates[dayKey] = {
				task: { morning: 0, afternoon: 0 },
				overtime: { o150: 0, o200: 0, o210: 0, o270: 0 },
				shift: "dayshift"
			};
		}
	}
	if (hasMissing) {
		await database.ref(`${db}/${currentYear}/${currentMonth}`).update(updates);
		renderCalendar();
	}
}

async function renderCalendar() {
	const snapshot = await database.ref(db).once("value");
	const task_data = snapshot.val() || {};
	const startDay = new Date(year, month, 1).getDay();
	const endDate = new Date(year, month + 1, 0).getDate();
	const endDay = new Date(year, month, endDate).getDay();
	const endDatePrev = new Date(year, month, 0).getDate();
	const monthKey = String(month + 1).padStart(2, "0");
	const yearKey = String(year);
	let stats = { ds: 0, ns: 0, leave: 0, o150: 0, o200: 0, o210: 0, o270: 0 };
	let countWorkDays = 0;
	let datesHtml = "";
	for (let i = startDay; i > 0; i--) {
		datesHtml += `<li class="old"><span class="day">${endDatePrev - i + 1}</span></li>`;
	}
	for (let i = 1; i <= endDate; i++) {
		const dayKey = String(i).padStart(2, "0");
		const dayData = task_data[yearKey]?.[monthKey]?.[dayKey];
		const isSunday = new Date(year, month, i).getDay() === 0;
		if (!isSunday) countWorkDays++;
		let attrs = { morning: "", afternoon: "", ns: "", o_ds: "", o_ns: "", o_sun_ds: "", o_sun_ns: "" };
		if (dayData) {
			if (!isSunday) {
				attrs.morning = dayData.task.morning > 0 ? "work" : "leave";
				attrs.afternoon = dayData.task.afternoon > 0 ? "work" : "leave";
			} else {
				attrs.morning = dayData.task.morning > 0 ? "work" : "";
				attrs.afternoon = dayData.task.afternoon > 0 ? "work" : "";
			}
			const dailyHours = dayData.task.morning + dayData.task.afternoon;
			if (dayData.shift === "nightshift") {
				stats.ns += dailyHours;
				attrs.ns = "ns";
			} else {
				stats.ds += dailyHours;
			}
			if (!isSunday && dayData.shift === "dayshift" && dayData.overtime.o150 > 0) attrs.o_ds = "overtime_dayshift";
			if (isSunday && dayData.shift === "dayshift" && dayData.overtime.o200 > 0) attrs.o_sun_ds = "overtime_sunday_dayshift";
			if (!isSunday && dayData.shift === "nightshift" && dayData.overtime.o150 > 0) attrs.o_ns = "overtime_nightshift";
			if (isSunday && dayData.shift === "nightshift" && dayData.overtime.o210 > 0) attrs.o_sun_ns = "overtime_sunday_nightshift";
			if (!isSunday) stats.leave += (8 - dailyHours);
			stats.o150 += dayData.overtime.o150 || 0;
			stats.o200 += dayData.overtime.o200 || 0;
			stats.o210 += dayData.overtime.o210 || 0;
			stats.o270 += dayData.overtime.o270 || 0;
		}
		const isToday = i === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear() ? "today" : "";
		datesHtml += `
            <li ${isSunday ? "sunday" : ""} ${isToday} ${attrs.ns} data-day="${i}" style="cursor: pointer;">
                <span class="day">${dayKey}</span>
                <div class="data-task" ${attrs.o_sun_ds} ${attrs.o_sun_ns}>
                    <div class="process">
                        <span class="half-day" ${attrs.morning}></span>
                        <span class="half-day" ${attrs.afternoon}></span>
                    </div>
                    <span class="overtime" ${attrs.o_ds} ${attrs.o_ns}></span>
                </div>
            </li>
        `;
	}
	for (let i = endDay; i < 6; i++) {
		datesHtml += `<li class="old"><span class="day">${i - endDay + 1}</span></li>`;
	}
	header.textContent = `${months[month]} ${year}`;
	dates.innerHTML = datesHtml;
	document.getElementById("hours_in_dayshift").textContent = `${stats.ds}/${countWorkDays * 8}`;
	document.getElementById("hours_in_nightshift").textContent = `${stats.ns}/${countWorkDays * 8}`;
	document.getElementById("half_in_month").textContent = stats.leave;
	document.getElementById("hours_150").textContent = stats.o150;
	document.getElementById("hours_200").textContent = stats.o200;
	document.getElementById("hours_210").textContent = stats.o210;
	document.getElementById("hours_270").textContent = stats.o270;
}

function updateMonth(delta) {
	month += delta;
	if (month < 0) {
		month = 11;
		year--;
	} else if (month > 11) {
		month = 0;
		year++;
	}
	renderCalendar();
}

nav.forEach(btn => btn.addEventListener("click", () => updateMonth(btn.id === "next" ? 1 : -1)));

window.addEventListener("keydown", (e) => {
	if (e.key === "ArrowLeft") updateMonth(-1);
	if (e.key === "ArrowRight") updateMonth(1);
});

document.addEventListener("DOMContentLoaded", () => {
	autoFillMissingDays();
	renderCalendar();
	document.forms["form"].addEventListener("submit", (e) => {
		e.preventDefault();
		const now = new Date();
		const data = calculateAttendanceData(now.getFullYear(), now.getMonth(), now.getDate());
		sendDataToFirebase(now.getFullYear(), now.getMonth(), now.getDate(), data).then(() => {
			alert("Đã chấm công hôm nay.");
			document.forms["form"].reset();
		});
	});
	dates.addEventListener("click", (e) => {
		const li = e.target.closest("li");
		if (li && li.dataset.day && !li.classList.contains("old")) {
			const d = parseInt(li.dataset.day);
			if (confirm(`Chấm công ngày ${d}/${month + 1}/${year} với tùy chọn đang chọn?`)) {
				const data = calculateAttendanceData(year, month, d);
				sendDataToFirebase(year, month, d, data);
			}
		}
	});
});