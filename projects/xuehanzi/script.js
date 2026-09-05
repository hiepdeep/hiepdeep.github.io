console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://xue-hanzi-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const db = firebase.database();

// Khai báo tên thẻ
const data_lists = document.getElementById("data_lists");
const favoritesBtn = document.getElementById("favorites-btn");
const favoritesCount = document.getElementById("data_dashboard_favorite_count");
const progressCount = document.getElementById("data_dashboard_progress_count");
const progressPercent = document.getElementById("data_dashboard_progress_percent");
const progressBar = document.getElementById("data_dashboard_progress_bar");
const searchInput = document.getElementById("search_vocabulary");
const filterRadios = document.querySelectorAll("input[name='view-learn']");
let isOnlyFavorite = false;
let totalWords = 0;
let favoriteCount = 0;
let learnedCount = 0;
let currentFilter = "all";
let currentSearchText = "";
let hasAnimated = false;

// Reload
document.addEventListener("DOMContentLoaded", render_lists);

// Tải dữ liệu từ Realtime Database
async function render_lists() {
	totalWords = 0;
	favoriteCount = 0;
	learnedCount = 0;
	data_lists.innerHTML = "";
	try {
		const snapshot = await db.ref("hsk-basic/hsk01").once("value");
		if (!snapshot.exists()) {
			data_lists.innerHTML = "<span class='null'>Không tìm thấy dữ liệu từ vựng nào!</span>";
			return;
		}
		const val = snapshot.val();
		Object.entries(val).forEach(([itemKey, item]) => {
			totalWords++;
			const isFavorite = String(item.status?.favorite) === "true";
			const isLearned = String(item.status?.learned) === "true";
			if (isFavorite) favoriteCount++;
			if (isLearned) learnedCount++;
			const div = document.createElement("div");
			div.classList.add("item");
			div.dataset.label = item.label[0];
			div.dataset.key = itemKey;
			if (isLearned) div.classList.add("learned");
			div.innerHTML = `
				<span class="pinyin">${item.pinyin || "N/A"}</span>
				<span class="hanzi">${item.simplified || "N/A"}</span>
				<div class="bottom">
					<span class="label">${item.label[1] || "N/A"}</span>
					<div class="btn-gr">
						<button btn-light-gray class="material-symbols-rounded view-btn" data-key="${itemKey}">language_pinyin</button>
						<button btn-light-gray class="material-symbols-rounded favorite-btn ${isFavorite ? 'active' : ''}" data-key="${itemKey}">${isFavorite ? "heart_minus" : "heart_plus"}</button>
						<button btn-light-gray class="material-symbols-rounded learn-btn ${isLearned ? 'active' : ''}" data-key="${itemKey}">done</button>
					</div>
				</div>
			`;
			data_lists.appendChild(div);
			// Nút View
			div.querySelector(`.view-btn[data-key="${itemKey}"]`).addEventListener("click", () => {
				window.open(`?page=${encodeURIComponent(item.simplified)}`, "_blank");
			});
			// Nút Thêm vào danh sách Yêu thích
			div.querySelector(`.favorite-btn[data-key="${itemKey}"]`).addEventListener("click", async (e) => {
				const btn = e.currentTarget;
				const favoriteRef = db.ref(`hsk-basic/hsk01/${itemKey}/status/favorite`);
				try {
					const snap = await favoriteRef.once("value");
					const isFav = String(snap.val()) === "true";
					const message = isFav ? "Bạn có chắc chắn muốn bỏ từ này khỏi danh sách Yêu thích?" : "Bạn có muốn thêm từ này vào danh sách Yêu thích?";
					if (!confirm(message)) return;
					const nextState = isFav ? "" : "true";
					await favoriteRef.set(nextState);
					btn.classList.toggle("active", !isFav);
					btn.textContent = !isFav ? "heart_minus" : "heart_plus";
					if (!isFav) {
						favoriteCount++;
					} else {
						favoriteCount = Math.max(0, favoriteCount - 1);
					}
					updateDashboard();
				} catch (error) {
					console.error("Lỗi khi cập nhật dữ liệu từ Firebase:", error);
				}
			});
			// Nút Đã học
			div.querySelector(`.learn-btn[data-key="${itemKey}"]`).addEventListener("click", async (e) => {
				const btn = e.currentTarget;
				const learnedRef = db.ref(`hsk-basic/hsk01/${itemKey}/status/learned`);
				try {
					const snap = await learnedRef.once("value");
					const isLearnedState = String(snap.val()) === "true";
					const message = isLearnedState ? "Bạn muốn đánh dấu mục này là CHƯA HỌC?" : "Xác nhận bạn đã HỌC XONG mục này?";
					if (!confirm(message)) return;
					const nextState = isLearnedState ? "" : "true";
					await learnedRef.set(nextState);
					btn.classList.toggle("active", !isLearnedState);
					div.classList.toggle("learned", !isLearnedState);
					if (!isLearnedState) {
						learnedCount++;
					} else {
						learnedCount = Math.max(0, learnedCount - 1);
					}
					updateDashboard();
				} catch (error) {
					console.error("Lỗi khi cập nhật trạng thái đã học:", error);
				}
			});
		});
		updateDashboard();
	} catch (error) {
		console.error("Lỗi khi tải dữ liệu từ Firebase:", error);
		data_lists.innerHTML = "<span class='null'>Không thể tải dữ liệu từ vựng!</span>";
	}
}

// Hiển thị danh sách Yêu thích
favoritesBtn.addEventListener("click", () => {
	isOnlyFavorite = !isOnlyFavorite;
	favoritesBtn.classList.toggle("active", isOnlyFavorite);
	const items = data_lists.querySelectorAll(".item");
	items.forEach((item) => {
		const favBtn = item.querySelector(".favorite-btn");
		const isFav = favBtn && favBtn.classList.contains("active");
		if (isOnlyFavorite) {
			item.style.display = isFav ? "flex" : "none";
		} else {
			filterAndSearchList();
		}
	});
});

// Hiệu ứng đếm số
function animateValue(element, start, end, duration, formatFn) {
	if (start === end) {
		element.innerHTML = formatFn ? formatFn(end) : end;
		return;
	}
	let startTimestamp = null;
	const step = (timestamp) => {
		if (!startTimestamp) startTimestamp = timestamp;
		const progress = Math.min((timestamp - startTimestamp) / duration, 1);
		const current = Math.floor(progress * (end - start) + start);
		element.innerHTML = formatFn ? formatFn(current) : current;
		if (progress < 1) {
			window.requestAnimationFrame(step);
		} else {
			element.innerHTML = formatFn ? formatFn(end) : end;
		}
	};
	window.requestAnimationFrame(step);
}

// Cập nhật Dashboard & Xử lý Tìm kiếm, Lọc
function updateDashboard() {
	const targetPercent = totalWords > 0 ? Number(((learnedCount / totalWords) * 100).toFixed(1)) : 0;
	if (!hasAnimated) {
		animateValue(favoritesCount, 0, favoriteCount, 1000);
		animateValue(progressCount, 0, learnedCount, 1000, (val) => {
			return `<strong>${val}/${totalWords}</strong> từ đã học thuộc`;
		});
		animateValue(progressPercent, 0, targetPercent, 1000, (val) => {
			return `${val}%`;
		});
		let startProgress = 0;
		const duration = 1000;
		let startTimestamp = null;
		const animateProgress = (timestamp) => {
			if (!startTimestamp) startTimestamp = timestamp;
			const progress = Math.min((timestamp - startTimestamp) / duration, 1);
			progressBar.value = progress * learnedCount;
			progressBar.max = totalWords;
			if (progress < 1) {
				window.requestAnimationFrame(animateProgress);
			} else {
				progressBar.value = learnedCount;
				progressBar.max = totalWords;
			}
		};
		window.requestAnimationFrame(animateProgress);
		hasAnimated = true;
	} else {
		favoritesCount.textContent = favoriteCount;
		progressCount.innerHTML = `<strong>${learnedCount}/${totalWords}</strong> từ đã học thuộc`;
		progressPercent.textContent = `${targetPercent}%`;
		progressBar.value = learnedCount;
		progressBar.max = totalWords;
	}
	filterAndSearchList();
}

// Hàm thực thi lọc và tìm kiếm
function filterAndSearchList() {
	const items = data_lists.querySelectorAll(".item");
	let visibleCount = 0;
	items.forEach((item) => {
		const pinyinText = (item.querySelector(".pinyin")?.textContent || "").toLowerCase();
		const hanziText = item.querySelector(".hanzi")?.textContent || "";
		const isLearned = item.classList.contains("learned");
		let matchesFilter = true;
		if (currentFilter === "learned") {
			matchesFilter = isLearned;
		} else if (currentFilter === "unlearned") {
			matchesFilter = !isLearned;
		}
		const matchesSearch = pinyinText.includes(currentSearchText) || hanziText.includes(currentSearchText);
		if (matchesFilter && matchesSearch) {
			item.style.display = "flex";
			visibleCount++;
		} else {
			item.style.display = "none";
		}
	});
	let nullMsg = data_lists.querySelector(".null-search");
	if (visibleCount === 0 && items.length > 0) {
		if (!nullMsg) {
			nullMsg = document.createElement("span");
			nullMsg.className = "null null-search";
			data_lists.appendChild(nullMsg);
		}
		nullMsg.textContent = "Không tìm thấy từ vựng phù hợp!";
		nullMsg.style.display = "block";
	} else if (nullMsg) {
		nullMsg.style.display = "none";
	}
}

// Search
searchInput.addEventListener("input", (e) => {
	currentSearchText = e.target.value.trim().toLowerCase();
	filterAndSearchList();
});

// Filter
filterRadios.forEach((radio) => {
	radio.addEventListener("change", (e) => {
		if (e.target.checked) {
			currentFilter = e.target.value;
			filterAndSearchList();
		}
	});
});

// Xử lý nút cuộn lên đầu trang
const backToTopBtn = document.getElementById("backToTop");
window.addEventListener("scroll", () => {
	if (window.scrollY > 300) {
		backToTopBtn.style.display = "block";
	} else {
		backToTopBtn.style.display = "none";
	}
});
function scrollToTop(duration) {
	const startPosition = window.scrollY;
	const startTime = performance.now();
	function step(currentTime) {
		const elapsed = currentTime - startTime;
		const progress = Math.min(elapsed / duration, 1);
		const easeOutCubic = 1 - Math.pow(1 - progress, 3);
		window.scrollTo(0, startPosition * (1 - easeOutCubic));
		if (progress < 1) {
			requestAnimationFrame(step);
		}
	}
	requestAnimationFrame(step);
}
backToTopBtn.addEventListener("click", () => {
	scrollToTop(2000);
});