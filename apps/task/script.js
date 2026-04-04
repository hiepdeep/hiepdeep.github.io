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
	let datesHtml = "";
	for (let i = start; i > 0; i--) {
		datesHtml += `<li class="old"><span class="day">${endDatePrev - i + 1}</span></li>`;
	}
	for (let i = 1; i <= endDate; i++) {
		const dayKey = String(i).padStart(2, "0");
		const dayData = task_data[yearKey] && task_data[yearKey][monthKey] ? task_data[yearKey][monthKey][dayKey] : null;
		const isSunday = new Date(year, month, i).getDay() === 0 ? " sunday" : "";
		let morningClass = "";
		let afternoonClass = "";
		let overtimeClass = "";
		let overtime200Class = "";
		if (dayData) {
			if (dayData.task.morning > 0) morningClass = "attendance";
			if (dayData.task.afternoon > 0) afternoonClass = "attendance";
			if (dayData.overtime.o150 > 0) overtimeClass = "attendance";
			if (dayData.overtime.o200 > 0) overtime200Class = "o200";
		}
		let isToday = i === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear() ? ' class="today"' : "";
		datesHtml += `
			<li${isToday} ${isSunday} ${overtime200Class}>
				<span class="day">${String(i).padStart(2, "0")}</span>
				<div class="data-task">
					<div class="process">
						<span class="half-day off-half-morning ${morningClass}"></span>
						<span class="half-day off-half-afternoon ${afternoonClass}"></span>
					</div>
					<span class="overtime ${overtimeClass}"></span>
				</div>
			</li>
		`;
	}
	for (let i = end; i < 6; i++) {
		datesHtml += `<li class="old"><span class="day">${i - end + 1}</span></li>`;
	}
	dates.innerHTML = datesHtml;
	header.textContent = `${months[month]} ${year}`;
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

renderCalendar();

document.addEventListener("DOMContentLoaded", () => {
	renderCalendar();
	document.forms["form"].addEventListener("submit", async function(event) {
		event.preventDefault();
		const $half_morning = document.forms["form"]["half-morning"].checked;
		const $half_afternoon = document.forms["form"]["half-afternoon"].checked;
		const $o150 = document.forms["form"]["overtime150"].checked;
		const $o200 = document.forms["form"]["overtime200"].checked;
		let getTime = new Date();
		let timeYear = String(getTime.getFullYear());
		let timeMonth = String(getTime.getMonth() + 1).padStart(2, "0");
		let timeDate = String(getTime.getDate()).padStart(2, "0");
		let returnTime = `${timeYear}/${timeMonth}/${timeDate}`;
		const data = {
			task: {
				morning: 4,
				afternoon: 4
			},
			overtime: {
				o150: 0,
				o200: 0
			}
		};
		if ($half_morning) data.task.morning = 0;
		if ($half_afternoon) data.task.afternoon = 0;
		if ($o150) data.overtime.o150 = 3;
		if ($o200) data.overtime.o200 = 11;
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