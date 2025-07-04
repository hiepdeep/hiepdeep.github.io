function entities(value) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;")
		.replace(/\n/g, "<br>");
}

function utf8ToBase64(value) {
	return btoa(unescape(encodeURIComponent(value)));
}

function base64ToUtf8(value) {
	return decodeURIComponent(escape(atob(value)));
}

function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1) ) + min;
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

function convertVietnameseToUrl(value) {
	return value
		.toLowerCase()
		.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a")
		.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a")
		.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e")
		.replace(/ì|í|ị|ỉ|ĩ/g, "i")
		.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o")
		.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u")
		.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y")
		.replace(/đ/g, "d")
		.replace(/[^a-z0-9]/g, " ")
		.replace(/\s+/g, " ")
		.trim().replace(/\s/g, "-");
}

function convertVietnameseToUsn(value) {
	return value
		.toLowerCase()
		.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a")
		.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e")
		.replace(/ì|í|ị|ỉ|ĩ/g, "i")
		.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o")
		.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u")
		.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y")
		.replace(/đ/g, "d")
		.replace(/[^a-z0-9]/g, "")
		.replace(/\s+/g, "")
		.trim().replace(/\s/g, "");
}
