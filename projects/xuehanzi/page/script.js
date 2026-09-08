console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://xue-hanzi-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const db = firebase.database();

// Khai báo các phần tử DOM
const menuToggle = document.querySelector(".navbar_hamburger");
const navSidebar = document.querySelector(".navbar");
const $innerBasic = document.getElementById("data-basic");
const $data_definitions = document.getElementById("definitions");

// Hàm xử lý bóc tách Query Parameters linh hoạt
function getUrlParams() {
	let searchStr = window.location.search;
	// Xử lý trường hợp URL có dạng index.html&hanzi=... hoặc chứa dấu ? thứ 2
	if (!searchStr && window.location.href.includes("&")) {
		const parts = window.location.href.split("&");
		parts.shift();
		searchStr = "?" + parts.join("&");
	}
	searchStr = searchStr.replace(/\?/g, "&").replace(/^&/, "?");
	const urlParams = new URLSearchParams(searchStr);
	let hanzi = urlParams.get("hanzi");
	let hsk = urlParams.get("hsk");
	if (hanzi) {
		// Loại bỏ dấu ngoặc kép thừa nếu URL truyền dạng "家"
		hanzi = hanzi.replace(/^["']|["']$/g, "").trim();
	}
	return {hanzi, hsk};
}

// Khởi chạy ứng dụng
document.addEventListener("DOMContentLoaded", () => {
	const {hanzi, hsk} = getUrlParams();
	// Nếu thiếu 1 trong 2 tham số -> chuyển hướng về trang chủ index.html
	if (!hanzi || !hsk) {
		if (window.location.pathname !== "/index.html" && window.location.pathname !== "/") {
			window.location.href = "../../index.html";
		} else if (window.location.search) {
			window.location.href = "../../index.html";
		}
		return;
	}
	// Chuyển format hsk (ví dụ: "01" hoặc "1" -> "hsk01")
	const formattedHsk = hsk.toLowerCase().startsWith("hsk") ? hsk.toLowerCase() : `hsk${hsk.padStart(2, '0')}`;
	renderHanziAnimation(hanzi);
	fetchHanziData(hanzi, formattedHsk);
});

async function fetchHanziData(hanzi, hskNode) {
	try {
		const snapshot = await db.ref(`hsk-detail/${hskNode}`).orderByChild("simplified").equalTo(hanzi).once("value");
		if (snapshot.exists()) {
			const data = snapshot.val();
			const results = Object.values(data);
			const targetWord = results[0];
			// Hiển thị thông tin cơ bản
			$innerBasic.innerHTML = `
				<p class="simplified">Giản thể: <strong id="txt-simplified">${targetWord.simplified || ''}</strong></p>
				<p class="traditional">Phồn thể: <strong id="txt-traditional">${targetWord.traditional || ''}</strong></p>
				<p class="pinyin">Bính âm: <strong id="txt-pinyin">${targetWord.pinyin || ''}</strong></p>
				<p class="zhuyin">Chú âm: <strong id="txt-zhuyin">${targetWord.zhuyin || ''}</strong></p>
				<p class="stroke_count">Số nét: <strong id="txt-stroke_count">${targetWord.stroke_count || ''}</strong></p>
				<p class="label">Cấp độ: <strong id="txt-label">${targetWord.label ? targetWord.label[1] : ''}</strong></p>
			`;
			// Hiển thị định nghĩa & ví dụ
			if (targetWord.definitions) {
				$data_definitions.innerHTML = targetWord.definitions.map(def => {
					const meaningsHtml = (def.meanings || []).map(meaningObj => {
						const examplesHtml = (meaningObj.examples || []).map(ex => formatSentence(ex)).join("");
						return `
							<li>
								<h6 class="meaning">${meaningObj.meaning}</h6>
								<ul class="examples">
									${examplesHtml}
								</ul>
							</li>
						`;
					}).join("");
					return `
						<li>
							<h4 class="pos">${def.pos}</h4>
							<ul class="meanings">
								${meaningsHtml}
							</ul>
						</li>
					`;
				}).join("");
			}
		} else {
			$innerBasic.innerHTML = `<p class="data-error">Không tìm thấy dữ liệu cho từ: <strong>${hanzi}</strong></p>`;
		}
	} catch (error) {
		console.error("Lỗi khi truy vấn Firebase:", error);
		$innerBasic.innerHTML = `<p class="data-error">Có lỗi xảy ra khi tải dữ liệu.</p>`;
	}
}

// Navbar Mobile Toggle
if (menuToggle) {
	menuToggle.addEventListener("click", () => {
		menuToggle.classList.toggle("active");
		navSidebar.classList.toggle("active");
	});
}

// Hiệu ứng chữ Hanzi Writer
async function renderHanziAnimation(hanziText, containerId = "writer-hanzi") {
	const container = document.getElementById(containerId);
	if (!container) return;
	container.innerHTML = "";
	const characters = Array.from(hanziText);
	const writers = [];
	characters.forEach((char, index) => {
		const cardContainer = document.createElement("div");
		cardContainer.id = `${containerId}-card-${index}`;
		cardContainer.className = "hanzi-card";
		container.appendChild(cardContainer);
		const writer = HanziWriter.create(cardContainer.id, char, {
			width: 176,
			height: 176,
			padding: 0,
			delayBetweenStrokes: 500,
			showCharacter: false,
			strokeColor: "#333333",
			outlineColor: "#ecd9c6"
		});
		writers.push(writer);
		cardContainer.addEventListener("click", () => {
			writer.animateCharacter();
		});
	});
	for (const writer of writers) {
		await new Promise((resolve) => {
			writer.animateCharacter({
				onComplete: resolve
			});
		});
	}
}

// Format câu ví dụ dạng (Hanzi || Pinyin || Tiếng Việt)
function formatSentence(text) {
	const [hanziStr, pinyinStr, viStr] = text.split("||");
	if (!hanziStr || !pinyinStr) return `<li>${text}</li>`;
	const hanziArr = Array.from(hanziStr.trim());
	const pinyinArr = pinyinStr.trim().split(/\s+/);
	const rubyContent = hanziArr.map((char, index) => {
		const pinyin = pinyinArr[index] || "";
		return `<span>${char}<rt>${pinyin}</rt></span>`;
	}).join("\n\t\t\t");
	return `
		<li>
			<div class="hanzi">
				<ruby>${rubyContent}</ruby>
			</div>
			<span class="vietnamese">${viStr ? viStr.trim() : ''}</span>
		</li>
	`;
}

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