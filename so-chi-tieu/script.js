console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://eimi-fukada-default-rtdb.firebaseio.com"
});
const database = firebase.database();
document.addEventListener("DOMContentLoaded", () => {
	renderChitieu();
	document.forms["form"]["amount"].addEventListener("input", function(e) {
		let value = this.value.replace(/\D/g, "");
		const formattedValue = new Intl.NumberFormat("vi-VN").format(value);
		this.value = formattedValue;
	});
	document.forms["form"].addEventListener("submit", async function(event) {
		event.preventDefault();
		const personSelect = document.forms["form"]["person"].value;
		const description = document.forms["form"]["description"].value.trim();
		const amount = document.forms["form"]["amount"].value.trim().replace(/\./g, "");
		if (!description) {
			alert("Vui lòng nhập mô tả chi tiêu.");
			return;
		}
		if (!/^\d+$/.test(amount)) {
			alert("Vui lòng chỉ nhập số vào ô số tiền.");
			return;
		}
		const data = {
			person: personSelect,
			description: description,
			amount: amount,
			creationDate: createTimes()
		}
		database.ref("chi-tieu").push(data).then(() => {
			document.forms["form"].reset();
			renderChitieu();
		}).catch((error) => {
			console.error("Lỗi khi tạo chi tiêu mới:", error);
		});
	});
});
function formatAmount(amount) {
	return new Intl.NumberFormat("vi-VN").format(amount);
}
async function renderChitieu() {
	const snapshot = await database.ref("chi-tieu").once("value");
	const data = snapshot.val() || {};
	let totalSum = 0;
	let totalSum1 = 0;
	let totalSum2 = 0;
	const list1 = document.getElementById("returnList-1");
	const list2 = document.getElementById("returnList-2");
	list1.innerHTML = "";
	list2.innerHTML = "";
	for (const key in data) {
		const item = data[key];
		const amount = parseInt(item.amount);
		const person = item.person;
		const creationDate = item.creationDate;
		const datePart = creationDate.split(" ")[0].replace(/\//g, "-");
		totalSum += amount;
		const listItem = document.createElement("li");
		listItem.setAttribute("data-key", key);
		listItem.innerHTML = `
            <div class="data">
                <div class="timeamp">${datePart}</div>
                <div class="amount">${formatAmount(amount)}</div>
            </div>
            <div class="description">${item.description}</div>
        `;
		listItem.addEventListener("click", () => {
			if (confirm("Bạn có chắc chắn muốn xóa chi tiêu này?")) {
				database.ref("chi-tieu").child(key).remove().then(() => {
					alert("Xóa thành công!");
					renderChitieu();
				}).catch((error) => {
					console.error("Lỗi khi xóa:", error);
				});
			}
		});
		if (person === "person-1") {
			totalSum1 += amount;
			list1.appendChild(listItem);
		} else if (person === "person-2") {
			totalSum2 += amount;
			list2.appendChild(listItem);
		}
	}
	document.getElementById("return_sumData").textContent = formatAmount(totalSum);
	document.getElementById("return_totalSum1").textContent = formatAmount(totalSum1);
	document.getElementById("return_totalSum2").textContent = formatAmount(totalSum2);
	const average = totalSum / 2;
	const diff1 = totalSum1 - average;
	const diff2 = totalSum2 - average;
	const person1ToPerson2 = document.getElementById("person1-to-person2");
	const person2ToPerson1 = document.getElementById("person2-to-person1");
	if (diff1 > 0) {
		person2ToPerson1.textContent = formatAmount(Math.abs(diff1));
		person1ToPerson2.textContent = "0";
	} else if (diff2 > 0) {
		person1ToPerson2.textContent = formatAmount(Math.abs(diff2));
		person2ToPerson1.textContent = "0";
	} else {
		person1ToPerson2.textContent = "0";
		person2ToPerson1.textContent = "0";
	}
}