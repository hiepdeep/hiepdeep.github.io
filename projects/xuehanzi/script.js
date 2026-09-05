console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://xue-hanzi-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const database = firebase.database();
const db_vocabularys = "vocabularys";

const progressBar = document.getElementById("vocab-progress__bar");
const progressText = document.querySelector(".vocab-progress__count");
const index_vocabulary = document.getElementById("vocabulary-list");
const searchInput = document.getElementById("search-vocabulary");
const filterRadios = document.querySelectorAll('input[name="view-learn"]');

// Lưu trữ toàn bộ dữ liệu từ vựng để lọc phía client nhanh chóng
let allVocabularyData = {};
let currentFilter = "all";
let currentSearchText = "";
let hasAnimated = false;

document.addEventListener("DOMContentLoaded", () => {
	render_vocabularys();
	// Lắng nghe sự kiện tìm kiếm
	searchInput.addEventListener("input", (e) => {
		currentSearchText = e.target.value.toLowerCase().trim();
		filterAndDisplayVocabulary();
	});
	// Lắng nghe sự kiện chọn radio lọc trạng thái
	filterRadios.forEach(radio => {
		radio.addEventListener("change", (e) => {
			currentFilter = e.target.value; // "all", "learn", "learned"
			filterAndDisplayVocabulary();
		});
	});
});

async function render_vocabularys() {
	try {
		const snapshot = await database.ref(db_vocabularys).once("value");
		if (snapshot.exists()) {
			const val = snapshot.val();
			console.log(val);
			allVocabularyData = snapshot.val() || {};
			filterAndDisplayVocabulary();
			// Xử lý sự kiện click nút học trên danh sách
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
						// Cập nhật lại dữ liệu local
						if (allVocabularyData[itemKey]) {
							allVocabularyData[itemKey].learn = newLearnState;
						}
						filterAndDisplayVocabulary();
						if (newLearnState === "learned") {
							console.log("Đã học từ:", itemKey);
						} else {
							console.log("Đã bỏ trạng thái học từ:", itemKey);
						}
					} catch (err) {
						console.error("Lỗi khi cập nhật database:", err);
					}
				}
			});
		} else {
			console.log("Không tìm thấy dữ liệu từ vựng nào!");
			index_vocabulary.innerHTML = `<span class="null">Không tìm thấy dữ liệu từ vựng nào!</span>`;
		}
	} catch (error) {
		console.error("Lỗi khi lấy dữ liệu: ", error);
	}
}

// Hàm lọc và hiển thị danh sách từ vựng dựa vào từ khóa search và trạng thái radio
function filterAndDisplayVocabulary() {
	let learnedCount = 0;
	let totalWords = 0;
	let visibleCount = 0;
	index_vocabulary.innerHTML = "";
	Object.entries(allVocabularyData).forEach(([itemKey, item]) => {
		totalWords++;
		const isLearned = item.learn === "learned";
		if (isLearned) learnedCount++;
		let matchesFilter = true;
		if (currentFilter === "learn") {
			matchesFilter = !isLearned;
		} else if (currentFilter === "learned") {
			matchesFilter = isLearned;
		}
		const pinyin = (item.pinyin || "").toLowerCase();
		const hanzi = (item.hanzi || "").toLowerCase();
		const vietnamese = (item.vietnamese || "").toLowerCase();
		const matchesSearch = pinyin.includes(currentSearchText) || hanzi.includes(currentSearchText) || vietnamese.includes(currentSearchText);
		if (matchesFilter && matchesSearch) {
			visibleCount++;
			const div = document.createElement("div");
			div.classList.add("item");
			div.dataset.label = item.label;
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
		}
	});
	// --- XỬ LÝ ANIMATION KHI RELOAD ---
	if (!hasAnimated && totalWords > 0) {
		hasAnimated = true;
		animateProgress(learnedCount, totalWords);
	} else if (hasAnimated) {
		// Cập nhật tức thì nếu người dùng kích hoạt sự kiện click/search/filter
		progressBar.max = totalWords;
		progressBar.value = learnedCount;
		progressText.textContent = `${learnedCount}/${totalWords}`;
	}
	if (visibleCount === 0) {
		index_vocabulary.innerHTML = `<span class="null">Không tìm thấy dữ liệu từ vựng nào!</span>`;
	}
}

function animateProgress(targetLearned, totalWords, duration = 500) {
	let startTime = null;
	function step(timestamp) {
		if (!startTime) startTime = timestamp;
		// 1. Tỷ lệ thời gian trôi qua từ 0 đến 1 (Chuyển động tuyến tính / Đều)
		const progress = Math.min((timestamp - startTime) / duration, 1);
		// 2. Tính số đếm trực tiếp dựa trên tỷ lệ tuyến tính
		const currentCount = Math.floor(progress * targetLearned);
		progressBar.max = totalWords;
		progressBar.value = currentCount;
		progressText.textContent = `${currentCount}/${totalWords}`;
		if (progress < 1) {
			requestAnimationFrame(step);
		} else {
			// Đảm bảo số chính xác tuyệt đối khi hoàn thành
			progressBar.value = targetLearned;
			progressText.textContent = `${targetLearned}/${totalWords}`;
		}
	}
	requestAnimationFrame(step);
}