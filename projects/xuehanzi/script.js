console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://xue-hanzi-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const database = firebase.database();
const db_vocabularys = "vocabularys";

const progressBar = document.getElementById("range-vocabulary");
const progressText = document.querySelector(".checked-total");
const index_vocabulary = document.getElementById("vocabularys");

document.addEventListener("DOMContentLoaded", () => {
	render_vocabularys();
});

async function render_vocabularys() {
	try {
		const snapshot = await database.ref(db_vocabularys).once("value");
		if (snapshot.exists()) {
			const data = snapshot.val() || {};
			let learnedCount = 0;
			index_vocabulary.innerHTML = "";
			Object.entries(data).forEach(([itemKey, item], index) => {
				const isLearned = item.learn === "learned";
				if (isLearned) learnedCount++;
				const div = document.createElement("div");
				div.classList.add("item");
				if (isLearned) div.classList.add("learned");
				div.innerHTML = `
					<span class="pinyin">${item.pinyin}</span>
					<span class="hanzi">${item.hanzi}</span>
					<span class="vietnamese">${item.vietnamese}</span>
					<div class="bottom">
						<span class="label">${item.label}</span>
						<button
							btn-light-gray
							class="material-symbols-rounded learn-btn ${isLearned ? 'learned' : ''}"
							data-key="${itemKey}"
						>${isLearned ? "star_shine" : "star"}</button>
					</div>
				`;
				index_vocabulary.appendChild(div);
			});
			const totalWords = Object.keys(data).length;
			progressBar.max = totalWords;
			progressBar.value = learnedCount;
			progressText.textContent = `${learnedCount}/${totalWords}`;
			index_vocabulary.onclick = null;
			index_vocabulary.addEventListener("click", async function(e) {
				const learnBtn = e.target.closest(".learn-btn");
				if (learnBtn) {
					const itemKey = learnBtn.getAttribute("data-key");
					const isCurrentlyLearned = learnBtn.classList.contains("learned");
					const newLearnState = isCurrentlyLearned ? "" : "learned";
					try {
						await database.ref(`${db_vocabularys}/${itemKey}`).update({
							learn: newLearnState
						});
						if (newLearnState === "learned") {
							learnBtn.classList.add("learned");
							learnBtn.textContent = "star_shine";
							learnedCount++;
							console.log("Đã học từ:", itemKey);
						} else {
							learnBtn.classList.remove("learned");
							learnBtn.textContent = "star";
							learnedCount--;
							console.log("Đã bỏ trạng thái học từ:", itemKey);
						}
						progressBar.value = learnedCount;
						progressText.textContent = `${learnedCount}/${totalWords}`;
					} catch (err) {
						console.error("Lỗi khi cập nhật database:", err);
					}
				}
			});
		} else {
			console.log("Không tìm thấy dữ liệu từ vựng nào!");
		}
	} catch (error) {
		console.error("Lỗi khi lấy dữ liệu: ", error);
	}
}