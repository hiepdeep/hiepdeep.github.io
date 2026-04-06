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
		const isSunday = new Date(year, month, i).getDay() === 0 ? "sunday" : "";
		if (isSunday) countSunday++;
		let attr_morning = "";
		let attr_afternoon = "";
		let attr_nightshift = "";
		let attr_overtime_dayshift = "";
		let attr_overtime_nightshift = "";
		let attr_overtime_sunday_dayshift = "";
		let attr_overtime_sunday_nightshift = "";
		if (dayData) {
			if (dayData.task.morning > 0) attr_morning = "work";
			if (dayData.task.afternoon > 0) attr_afternoon = "work";
			if (!isSunday && dayData.shift === "dayshift" && dayData.overtime.o150 > 0) attr_overtime_dayshift = "overtime_dayshift";
			if (isSunday && dayData.shift === "dayshift" && dayData.overtime.o200 > 0) attr_overtime_sunday_dayshift = "overtime_sunday_dayshift";
			if (!isSunday && dayData.shift === "nightshift" && dayData.overtime.o150 > 0) attr_overtime_nightshift = "overtime_nightshift";
			if (isSunday && dayData.shift === "nightshift" && dayData.overtime.o210 > 0) attr_overtime_sunday_nightshift = "overtime_sunday_nightshift";
			let dailyHours = dayData.task.morning + dayData.task.afternoon;
			if (dayData.shift === "nightshift") {
				totalNightShiftHours += dailyHours;
				attr_nightshift = "ns";
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
			<li ${isSunday} ${isToday} ${attr_nightshift}>
				<span class="day">${String(i).padStart(2, "0")}</span>
				<div class="data-task" ${attr_overtime_sunday_dayshift} ${attr_overtime_sunday_nightshift}>
					<div class="process">
						<span class="half-day" ${attr_morning}></span>
						<span class="half-day" ${attr_afternoon}></span>
					</div>
					<span class="overtime" ${attr_overtime_dayshift} ${attr_overtime_nightshift}></span>
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
		const isHalfMorning = document.forms["form"]["half-morning"].checked;
		const isHalfAfternoon = document.forms["form"]["half-afternoon"].checked;
		const isOvertime = document.forms["form"]["overtime"].checked;
		const isNightShift = document.forms["form"]["night-shift"].checked;
		let now = new Date();
		let timeYear = now.getFullYear();
		let timeMonth = String(now.getMonth() + 1).padStart(2, "0");
		let timeDate = String(now.getDate()).padStart(2, "0");
		let returnTime = `${timeYear}/${timeMonth}/${timeDate}`;
		let dayOfWeek = now.getDay(); // 0: Chủ Nhật, 6: Thứ 7
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
			shift: isNightShift ? "nightshift" : "dayshift"
		};
		// 4. Xử lý nghỉ nửa buổi (Chỉ áp dụng nếu không phải Chủ Nhật)
		if (dayOfWeek !== 0) {
			if (isHalfMorning) data.task.morning = 0;
			if (isHalfAfternoon) data.task.afternoon = 0;
		} else {
			// Nếu là Chủ Nhật, mặc định giờ hành chính bằng 0
			data.task.morning = 0;
			data.task.afternoon = 0;
		}
		// 5. Logic tính toán Tăng ca (Overtime)
		if (isOvertime) {
			if (!isNightShift) {
				// Ca ngày
				if (dayOfWeek === 0) {
					data.overtime.o200 = 11; // Tăng ca Chủ Nhật
				} else {
					data.overtime.o150 = 3; // Tăng ca ngày thường
				}
			} else {
				// Ca đêm
				if (dayOfWeek === 6) {
					// Tăng ca đêm Thứ 7 (sang rạng sáng CN)
					data.overtime.o210 = 2;
					data.overtime.o270 = 0.75;
				} else {
					// Tăng ca đêm ngày thường
					data.overtime.o150 = 2;
					data.overtime.o200 = 0.75;
				}
			}
		}
		database.ref(`${db}/${returnTime}`).set(data).then(() => {
			alert("Đã chấm công ngày hôm nay.");
			document.forms["form"].reset();
			renderCalendar();
		}).catch((error) => {
			alert("Lỗi khi gửi yêu cầu.");
			console.error("Chi tiết lỗi:", error);
		});
	});
});