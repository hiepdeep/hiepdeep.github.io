function createTimes() {
	let getTime = new Date();
	let timeYear = getTime.getFullYear();
	let timeMonth = getTime.getMonth() + 1;
	let timeDate = getTime.getDate();
	let timeHours = getTime.getHours();
	let timeMinutes = getTime.getMinutes();
	let timeSeconds = getTime.getSeconds();
	let timeMilliseconds = getTime.getMilliseconds();
	return `${timeYear}-${timeMonth}-${timeDate}-${timeHours}-${timeMinutes}-${timeSeconds}-${timeMilliseconds}`.split(/[\/-]/).map(i => i.padStart(2, "0")).join("-");
}