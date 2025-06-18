function utf8ToBase64(str) {
	return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(str) {
	return decodeURIComponent(escape(atob(str)));
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
	timeYear = timeYear.padStart(2, "0");
	timeMonth = timeMonth.padStart(2, "0");
	timeDate = timeDate.padStart(2, "0");
	timeHours = timeHours.padStart(2, "0");
	timeMinutes = timeMinutes.padStart(2, "0");
	timeMilliseconds = timeMilliseconds.padStart(3, "0");
	return `${timeYear}/${timeMonth}/${timeDate} ${timeHours}:${timeMinutes}:${timeSeconds}:${timeMilliseconds}`;
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

function convertVietnameseToUrl(str) {
	str = str.toLowerCase();
	str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
	str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
	str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
	str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
	str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
	str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
	str = str.replace(/đ/g, "d");
	str = str.replace(/[^a-z0-9]/g, " ");
	str = str.replace(/\s+/g, " ");
	str = str.trim().replace(/\s/g, "-");
	return str;
}

function convertVietnameseToUsn(str) {
	str = str.toLowerCase();
	str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
	str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
	str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
	str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
	str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
	str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
	str = str.replace(/đ/g, "d");
	str = str.replace(/[^a-z0-9]/g, "");
	str = str.replace(/\s+/g, "");
	str = str.trim().replace(/\s/g, "");
	return str;
}

