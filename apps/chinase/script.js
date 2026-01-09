console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://eimi-fukada-default-rtdb.firebaseio.com"
});
const database = firebase.database();
document.addEventListener("DOMContentLoaded", () => {
	renderChinase();
	document.forms["form"].addEventListener("submit", async function(event) {
		event.preventDefault();
		const input_chinase = document.forms["form"]["input_chinase"].value.trim();
		const input_pinyin = document.forms["form"]["input_pinyin"].value.trim();
		const input_vietnamse = document.forms["form"]["input_vietnamse"].value.trim();
		const input_lable = document.forms["form"]["input_lable"].value.trim();
		database.ref("chinase").push({
			chinase: input_chinase,
			pinyin: input_pinyin,
			vietnamse: input_vietnamse,
			lable: input_lable,
			updateDate: createTimes(),
			creationDate: createTimes()
		}).then(() => {
			document.forms["form"].reset();
			renderChinase();
		}).catch((error) => {
			console.error("Lỗi khi tạo tài khoản:", error);
		});
	});
});
async function renderChinase() {
	document.getElementById("list").innerHTML = "";
	const snapshot = await database.ref("chinase").once("value");
	let index = 0;
	snapshot.forEach((childSnapshot) => {
		const v = childSnapshot.val();
		const k = childSnapshot.key;
		const div = document.createElement("div");
		const clss = document.createAttribute("class");
		clss.value = "item";
		div.setAttributeNode(clss);
		const idd = document.createAttribute("id");
		idd.value = k;
		div.setAttributeNode(idd);
		div.innerHTML = `
			<span class="stt">${String(index + 1).padStart(2, "0")}</span>
			<input type="text" name="chinase" id="chinase" value="${v.chinase}">
			<input type="text" name="pinyin" id="pinyin" value="${v.pinyin}">
			<input type="text" name="vietnamse" id="vietnamse" value="${v.vietnamse}">
			<input type="text" name="lable" id="lable" value="${v.lable}">
			<button class="change material-symbols-rounded" data-change="${k}">check</button>
			<button class="delete material-symbols-rounded" data-delete="${k}">close</button>
		`;
		document.getElementById("list").appendChild(div);
		div.querySelector(`[data-change="${k}"]`).addEventListener("click", () => {
			changeUser(k);
		});
		div.querySelector(`[data-delete="${k}"]`).addEventListener("click", () => {
			deleteChinase(k);
		});
		index++;
	});
}
function changeUser(k) {
	const input_chinase = document.querySelector(`#${k} #chinase`).value.trim();
	const input_pinyin = document.querySelector(`#${k} #pinyin`).value.trim();
	const input_vietnamse = document.querySelector(`#${k} #vietnamse`).value.trim();
	const input_lable = document.querySelector(`#${k} #lable`).value.trim();
	database.ref("chinase").child(k).update({
		chinase: input_chinase,
		pinyin: input_pinyin,
		vietnamse: input_vietnamse,
		lable: input_lable,
		updateDate: createTimes()
	}).then(() => {
		alert("Cập nhật thành công!");
		renderChinase();
	}).catch((error) => {
		console.error("Lỗi khi cập nhật:", error);
	});
}
function deleteChinase(k) {
	if (confirm("Bạn có chắc chắn muốn xóa?")) {
		database.ref("chinase").child(k).remove().then(() => {
			alert("Xóa thành công!");
			renderChinase();
		}).catch((error) => {
			console.error("Lỗi khi xóa:", error);
		});
	}
}
