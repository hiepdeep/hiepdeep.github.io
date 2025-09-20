console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://eimi-fukada-default-rtdb.firebaseio.com"
});
const database = firebase.database();

const db = "so-ghi-no";
document.addEventListener("DOMContentLoaded", () => {
	renderChitieu();
	document.forms["form"]["amount"].addEventListener("input", function(e) {
		let value = this.value.replace(/\D/g, "");
		const formattedValue = new Intl.NumberFormat("vi-VN").format(value);
		this.value = formattedValue;
	});
	document.forms["form"].addEventListener("submit", async function(event) {
		event.preventDefault();
		const personName = document.forms["form"]["person-name"].value.trim();
		const amount = document.forms["form"]["amount"].value.trim().replace(/\./g, "");
		if (!personName) {
			alert("Vui lòng nhập Tên.");
			return;
		}
		if (!/^\d+$/.test(amount)) {
			alert("Vui lòng chỉ nhập số vào ô số tiền.");
			return;
		}
		const data = {
			person: personName,
			amount: amount,
			creationDate: createTimes()
		}
		database.ref(db).push(data).then(() => {
			document.forms["form"].reset();
			renderChitieu();
		}).catch((error) => {
			console.error("Lỗi khi tạo chi tiêu mới:", error);
		});
	});
});
async function renderChitieu() {
	const snapshot = await database.ref(db).once("value");
	const data = snapshot.val() || {};
	const lists = document.getElementById("lists");
	lists.innerHTML = "";
}
function formatAmount(amount) {
	return new Intl.NumberFormat("vi-VN").format(amount);
}