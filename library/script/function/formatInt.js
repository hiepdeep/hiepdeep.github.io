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