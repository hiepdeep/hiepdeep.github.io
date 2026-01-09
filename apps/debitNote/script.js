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
	const groupedData = {};
	for (const key in data) {
		const item = data[key];
		const personName = item.person;
		if (!groupedData[personName]) {
			groupedData[personName] = [];
		}
		groupedData[personName].push({
			...item,
			key
		});
	}
	for (const personName in groupedData) {
		const listItems = groupedData[personName];
		const personLi = document.createElement("li");
		const personNameDiv = document.createElement("div");
		personNameDiv.className = "personName";
		personNameDiv.textContent = personName;
		personLi.appendChild(personNameDiv);
		personNameDiv.addEventListener("click", () => {
			document.forms["form"]["person-name"].value = personName;
			document.forms["form"]["amount"].focus();
		});
		const dataUl = document.createElement("ul");
		dataUl.className = "data";
		for (const item of listItems) {
			const itemLi = document.createElement("li");
			itemLi.className = "item";
			itemLi.setAttribute("data-key", item.key);
			const creationDate = item.creationDate;
			const datePart = creationDate.split(" ")[0].replace(/\//g, "-");
			itemLi.innerHTML = `
				<div class="amount">${formatAmount(item.amount)}</div>
				<div class="timeamp">${datePart}</div>
			`;
			const btnDelete = document.createElement("button");
			btnDelete.className = "btn-remove";
			btnDelete.setAttribute("btn-style", "");
			btnDelete.setAttribute("red", "");
			btnDelete.innerText = "Remove";
			itemLi.appendChild(btnDelete);
			dataUl.appendChild(itemLi);
			btnDelete.addEventListener("click", () => {
				if (confirm("Bạn có chắc chắn muốn xóa?")) {
					database.ref(db).child(item.key).remove().then(() => {
						alert("Xóa thành công!");
						renderChitieu();
					}).catch((error) => {
						console.error("Lỗi khi xóa:", error);
					});
				}
			});
		}
		personLi.appendChild(dataUl);
		lists.appendChild(personLi);
	}
}
function formatAmount(amount) {
	return new Intl.NumberFormat("vi-VN").format(amount);
}