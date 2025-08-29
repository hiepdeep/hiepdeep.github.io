function entities(value) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;")
		.replace(/\n/g, "<br>");
}

function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1) ) + min;
}

function createDate() {
	let getTime = new Date();
	let timeYear = getTime.getFullYear();
	let timeMonth = getTime.getMonth() + 1;
	let timeDate = getTime.getDate();
	let timeHours = getTime.getHours();
	let timeMinutes = getTime.getMinutes();
	timeYear = timeYear.toString().padStart(2, "0");
	timeMonth = timeMonth.toString().padStart(2, "0");
	timeDate = timeDate.toString().padStart(2, "0");
	timeHours = timeHours.toString().padStart(2, "0");
	timeMinutes = timeMinutes.toString().padStart(2, "0");
	return `${timeYear}-${timeMonth}-${timeDate}-${timeHours}-${timeMinutes}`;
}

function createTimes() {
	let getTime = new Date();
	let timeYear = getTime.getFullYear();
	let timeMonth = getTime.getMonth() + 1;
	let timeDate = getTime.getDate();
	let timeHours = getTime.getHours();
	let timeMinutes = getTime.getMinutes();
	let timeSeconds = getTime.getSeconds();
	let timeMilliseconds = getTime.getMilliseconds();
	timeYear = timeYear.toString().padStart(2, "0");
	timeMonth = timeMonth.toString().padStart(2, "0");
	timeDate = timeDate.toString().padStart(2, "0");
	timeHours = timeHours.toString().padStart(2, "0");
	timeMinutes = timeMinutes.toString().padStart(2, "0");
	timeSeconds = timeSeconds.toString().padStart(2, "0");
	timeMilliseconds = timeMilliseconds.toString().padStart(3, "0");
	return `${timeYear}/${timeMonth}/${timeDate} ${timeHours}:${timeMinutes}:${timeSeconds}:${timeMilliseconds}`;
}

function formatTimeAgo(timestamp) {
	const messageDate = new Date(timestamp.replace(/:(\d{3})$/, '.$1'));
	const now = new Date();
	const diffMs = now - messageDate;
	const diffMins = Math.round(diffMs / (1000 * 60));
	const diffHours = Math.round(diffMs / (1000 * 60 * 60));
	const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
	if (diffMins < 60) {
		return diffMins <= 1 ? "Vừa xong" : `${diffMins} phút trước`;
	} else if (diffHours < 24) {
		return `${diffHours} giờ trước`;
	} else if (diffDays < 7) {
		return `${diffDays} ngày trước`;
	} else {
		return messageDate.toLocaleDateString('vi-VN');
	}
}

function timeampPro(value) {
	let now = new Date();
	let cleanTimeString = value.includes(".") ? value.split(".")[0].replace(/-/g, "/") : value.replace(/-/g, "/");
	let past = new Date(cleanTimeString);
	let seconds = Math.floor((now - past) / 1000);
	let minutes = Math.floor(seconds / 60);
	let hours = Math.floor(minutes / 60);
	let days = Math.floor(hours / 24);
	let years = now.getFullYear() - past.getFullYear();
	let months = (years * 12) + now.getMonth() - past.getMonth();
	if (now.getDate() < past.getDate()) {
		months--;
	}
	if (years > 0) {
		return `${years} năm trước`;
	} else if (months > 0) {
		return `${months} tháng trước`;
	} else if (days > 0) {
		return `${days} ngày trước`;
	} else if (hours > 0) {
		return `${hours} giờ trước`;
	} else if (minutes > 0) {
		return `${minutes} phút trước`;
	} else {
		return "vài giây trước";
	}
}

function $timeampPro(value) {
	const now = new Date();
	const timeWithoutMilliseconds = value.replace(/:(\d+)$/, '.$1');
	const past = new Date(timeWithoutMilliseconds.replace(/-/g, '/'));
	const seconds = Math.floor((now - past) / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	if (days > 0) {
		return `${days} ngày trước`;
	} else if (hours > 0) {
		return `${hours} giờ trước`;
	} else if (minutes > 0) {
		return `${minutes} phút trước`;
	} else {
		return "vài giây trước";
	}
}

function formatInt1(value) {
	return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatInt2(value) {
	return value.split(/[\/-]/).map(i => i.padStart(2, "0")).join("-");
}

function formatInt3(value) {
	return value.split(/[\/-]/).map(i => i.padStart(2, "0")).join("/");
}

function formatInt4(value) {
	let fomats = value.split(/[\/-]/).map(i => i.padStart(2, "0")).join("-");
	let fomat = fomats.split("-");
	return `${fomat[0]}/${fomat[1]}/${fomat[2]} ${fomat[3]}:${fomat[4]}:${fomat[5]}`;
}