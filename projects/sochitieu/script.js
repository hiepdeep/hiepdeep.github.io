console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://hiepdeep-default-rtdb.firebaseio.com"
});
const database = firebase.database();
const db = "so-chi-tieu";

document.addEventListener("DOMContentLoaded", () => {
	renderViewsChart("chart-view");
	initApp();
});

// Hàm khởi tạo toàn bộ ứng dụng: Lắng nghe dữ liệu, render thống kê và xử lý form/click
function initApp() {
	// 1. Mặc định khi mở trang, thẻ #dataResult không hiện gì
	const dataResultEl = document.getElementById("dataResult");
	if (dataResultEl) {
		dataResultEl.innerHTML = "";
	}

	// Lắng nghe dữ liệu realtime từ Firebase theo năm hiện tại
	const currentYear = new Date().getFullYear().toString();
	database.ref(`${db}/${currentYear}`).on("value", (snapshot) => {
		const yearData = snapshot.val() || {};
		processAndRenderData(yearData);
	});

	// 1. Chức năng nhập dữ liệu form
	const form = document.getElementById("form");
	if (form) {
		form.addEventListener("submit", (e) => {
			e.preventDefault();
			
			const person = form.querySelector('input[name="form-person"]:checked')?.value || "hiep";
			const description = form.querySelector('input[name="form-description"]').value.trim();
			const amountStr = form.querySelector('input[name="form-amount"]').value.trim().replace(/\./g, "");
			const type = form.querySelector('input[name="form-type"]:checked')?.value || "expense";

			if (!description || !amountStr || isNaN(amountStr)) {
				alert("Vui lòng nhập đầy đủ mô tả và số tiền hợp lệ!");
				return;
			}

			const amount = amountStr;
			
			// Tạo chuỗi thời gian định dạng YYYY/MM/DD HH:mm:ss:SSS giống mẫu dữ liệu
			const now = new Date();
			const year = now.getFullYear().toString();
			const month = String(now.getMonth() + 1).padStart(2, "0");
			const day = String(now.getDate()).padStart(2, "0");
			const hours = String(now.getHours()).padStart(2, "0");
			const minutes = String(now.getMinutes()).padStart(2, "0");
			const seconds = String(now.getSeconds()).padStart(2, "0");
			const millis = String(now.getMilliseconds()).padStart(3, "0");
			const creationDate = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}:${millis}`;

			const newItem = {
				amount: amount,
				creationDate: creationDate,
				description: description,
				person: person,
				status: "unpaid", // Mặc định mục mới tạo là chưa thanh toán
				type: type
			};

			// Đẩy dữ liệu lên Firebase namespaced theo năm và tháng
			database.ref(`${db}/${year}/${month}`).push(newItem)
				.then(() => {
					form.reset();
					document.getElementById("hiep").checked = true;
					document.getElementById("form-expense").checked = true;
				})
				.catch((error) => {
					console.error("Lỗi khi thêm dữ liệu: ", error);
				});
		});
	}
}

// Xử lý tính toán và hiển thị dữ liệu tổng hợp lên .data-basic, đồng thời gắn sự kiện click cho các nút xem chi tiết
function processAndRenderData(yearData) {
	let hieuTotalsExpenseCount = 0;
	let hieuSumsExpenseVal = 0;

	let hiepTotalsExpenseCount = 0;
	let hiepSumsExpenseVal = 0;

	let hieuTotalsBorrowCount = 0;
	let hieuSumsBorrowVal = 0;

	let hiepTotalsBorrowCount = 0;
	let hiepSumsBorrowVal = 0;

	const categoriesData = {
		"expense-hieu": [],
		"expense-hiep": [],
		"borrow-hieu": [],
		"borrow-hiep": []
	};

	for (let month in yearData) {
		const entries = yearData[month];
		for (let id in entries) {
			const item = entries[id];
			const amount = parseInt(item.amount) || 0;
			const isUnpaid = item.status === "unpaid";

			const wrappedItem = { ...item, id: id };

			if (item.type === "expense") {
				if (item.person === "hieu") {
					categoriesData["expense-hieu"].push(wrappedItem);
					if (isUnpaid) {
						hieuTotalsExpenseCount++;
						hieuSumsExpenseVal += amount;
					}
				} else if (item.person === "hiep") {
					categoriesData["expense-hiep"].push(wrappedItem);
					if (isUnpaid) {
						hiepTotalsExpenseCount++;
						hiepSumsExpenseVal += amount;
					}
				}
			} else if (item.type === "borrow") {
				if (item.person === "hieu") {
					categoriesData["borrow-hieu"].push(wrappedItem);
					if (isUnpaid) {
						hieuTotalsBorrowCount++;
						hieuSumsBorrowVal += amount;
					}
				} else if (item.person === "hiep") {
					categoriesData["borrow-hiep"].push(wrappedItem);
					if (isUnpaid) {
						hiepTotalsBorrowCount++;
						hiepSumsBorrowVal += amount;
					}
				}
			}
		}
	}

	// Hiển thị ra DOM phần .data-basic
	document.getElementById("hieu-totals-expense").textContent = hieuTotalsExpenseCount;
	document.getElementById("hieu-sums-expense").textContent = formatCurrency(hieuSumsExpenseVal);

	document.getElementById("hiep-totals-expense").textContent = hiepTotalsExpenseCount;
	document.getElementById("hiep-sums-expense").textContent = formatCurrency(hiepSumsExpenseVal);

	document.getElementById("hieu-totals-borrow").textContent = hieuTotalsBorrowCount;
	document.getElementById("hieu-sums-borrow").textContent = formatCurrency(hieuSumsBorrowVal);

	document.getElementById("hiep-totals-borrow").textContent = hiepTotalsBorrowCount;
	document.getElementById("hiep-sums-borrow").textContent = formatCurrency(hiepSumsBorrowVal);

	// Tính toán số dư ròng giữa 2 người để quyết định ai cần trả ai
	let balanceHieuPayHiep = 0;
	let balanceHiepPayHieu = 0;
	let netHieuOwesHiep = 0;
	let netHiepOwesHieu = 0;

	for (let key in categoriesData) {
		categoriesData[key].forEach(item => {
			if (item.status === "unpaid") {
				const amt = parseInt(item.amount) || 0;
				if (item.type === "expense") {
					if (item.person === "hiep") {
						netHieuOwesHiep += amt / 2;
					} else {
						netHiepOwesHieu += amt / 2;
					}
				} else if (item.type === "borrow") {
					if (item.person === "hieu") {
						netHiepOwesHieu += amt;
					} else {
						netHieuOwesHiep += amt;
					}
				}
			}
		});
	}

	let finalBalance = netHieuOwesHiep - netHiepOwesHieu;
	if (finalBalance > 0) {
		balanceHieuPayHiep = finalBalance;
		balanceHiepPayHieu = 0;
	} else if (finalBalance < 0) {
		balanceHieuPayHiep = 0;
		balanceHiepPayHieu = -finalBalance;
	} else {
		balanceHieuPayHiep = 0;
		balanceHiepPayHieu = 0;
	}

	document.getElementById("hieu-pay-hiep").textContent = formatCurrency(balanceHieuPayHiep);
	document.getElementById("hiep-pay-hieu").textContent = formatCurrency(balanceHiepPayHieu);

	// Gắn sự kiện click cho các nút mở chi tiết trong .data-basic kèm theo tiêu đề tương ứng của mục nhỏ
	setupDetailButton("openbox-expense-hieu", categoriesData["expense-hieu"], "Chi trả của Hiếu:");
	setupDetailButton("openbox-expense-hiep", categoriesData["expense-hiep"], "Chi trả của Hiệp:");
	setupDetailButton("openbox-borrow-hieu", categoriesData["borrow-hieu"], "Hiệp vay mượn của Hiếu:");
	setupDetailButton("openbox-borrow-hiep", categoriesData["borrow-hiep"], "Hiếu vay mượn của Hiệp:");
}

// Helper: Định dạng số tiền có dấu chấm phân cách hàng nghìn
function formatCurrency(num) {
	return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Hàm thiết lập sự kiện bấm nút hiển thị dữ liệu chi tiết vào #dataResult và cập nhật H3 bảng to
function setupDetailButton(buttonId, itemsList, sectionTitle) {
	const btn = document.getElementById(buttonId);
	if (!btn) return;

	const newBtn = btn.cloneNode(true);
	btn.parentNode.replaceChild(newBtn, btn);

	newBtn.addEventListener("click", () => {
		const dataResultEl = document.getElementById("dataResult");
		if (!dataResultEl) return;

		// Tìm thẻ H3 của bảng to (nằm trong cột thứ 2) để cập nhật tiêu đề mục nhỏ sang
		const colRightTitleH3 = document.querySelector(".box .col:nth-child(2) .title h3");
		if (colRightTitleH3) {
			colRightTitleH3.textContent = sectionTitle;
		}

		dataResultEl.innerHTML = "";

		if (!itemsList || itemsList.length === 0) {
			dataResultEl.innerHTML = `<li style="background:transparent; border:none; text-align:center; color:#777; grid-column: 1 / -1;">Không có dữ liệu chi tiết.</li>`;
			return;
		}

		const sortedList = [...itemsList].sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));

		sortedList.forEach(item => {
			const li = document.createElement("li");
			
			li.setAttribute("data-key", item.id || "");
			li.setAttribute("data-type", item.type || "");
			li.setAttribute("data-status", item.status || "unpaid");
			
			if (item.status === "paid") {
				li.classList.add("item-paid");
				li.style.cursor = "default";
				li.style.opacity = "0.7";
			} else {
				li.classList.add("item-unpaid");
				li.style.cursor = "pointer";
			}

			let displayDate = "";
			if (item.creationDate) {
				displayDate = item.creationDate.split(" ")[0].replace(/-/g, "/");
			}

			const formattedAmount = formatCurrency(parseInt(item.amount) || 0);
			const statusText = item.status === "paid" ? "Đã thanh toán" : "Chưa thanh toán";

			li.innerHTML = `
				<div class="item-row">
					<div class="item-col time">
						<span class="material-symbols-rounded">calendar_today</span>
						<span class="text">${displayDate}</span>
					</div>
					<span class="item-col status">${statusText}</span>
				</div>
				<div class="item-row">
					<div class="item-col description">${item.description || ""}</div>
					<div class="item-col amount">${formattedAmount}</div>
				</div>
			`;

			// Chỉ cho phép ấn vào các mục "Chưa thanh toán" (unpaid) để xác nhận thanh toán
			if (item.status === "unpaid") {
				li.addEventListener("click", () => {
					const confirmMsg = `Bạn có chắc chắn muốn xác nhận thanh toán cho mục: "${item.description}" (${formattedAmount} đ)?`;
					if (confirm(confirmMsg)) {
						toggleItemStatus(item);
					}
				});
			}

			dataResultEl.appendChild(li);
		});
	});
}

// Hàm hỗ trợ đổi trạng thái thanh toán và cập nhật lên Firebase
function toggleItemStatus(item) {
	if (!item.id || !item.creationDate) return;
	const year = item.creationDate.substring(0, 4);
	const month = item.creationDate.substring(5, 7);
	const newStatus = "paid";

	database.ref(`${db}/${year}/${month}/${item.id}`).update({
		status: newStatus
	}).then(() => {
		// Dữ liệu Realtime từ Firebase sẽ tự động gọi lại on("value") để refresh giao diện
	}).catch((error) => {
		console.error("Lỗi cập nhật trạng thái: ", error);
	});
}

// Render biểu đồ thống kê
async function renderViewsChart(ctxId) {
	const chartView = document.getElementById("return-chart");
	const myCanvas = document.getElementById(ctxId);
	if (!chartView || !myCanvas) return;
	
	const ctx = myCanvas.getContext("2d");
	myCanvas.width = chartView.getBoundingClientRect().width - 2;
	myCanvas.height = chartView.getBoundingClientRect().height - 2;
	const currentYear = new Date().getFullYear().toString();
	const snapshot = await database.ref(`${db}/${currentYear}`).once("value");
	const yearData = snapshot.val() || {};
	const monthlyExpenses = new Array(12).fill(0);
	
	for (let month in yearData) {
		const monthIndex = parseInt(month) - 1;
		if (monthIndex >= 0 && monthIndex < 12) {
			const entries = yearData[month];
			for (let id in entries) {
				const item = entries[id];
				if (item.type === "expense") {
					monthlyExpenses[monthIndex] += parseInt(item.amount) || 0;
				}
			}
		}
	}
	const values = monthlyExpenses;
	const maxVal = Math.max(...values) || 1;
	const total_month = values.length;
	const gap = 12;
	const paddingTop = gap * 0;
	const paddingBottom = 30 - 12;
	const slot_width = (myCanvas.width - (gap * (total_month + 1))) / total_month;
	const borderRadius = [4, 4, 2, 2];
	let progress = 0;
	
	function animate() {
		progress += 0.02;
		ctx.clearRect(0, 0, myCanvas.width, myCanvas.height);
		values.forEach((val, index) => {
			const availableHeight = myCanvas.height - paddingTop - paddingBottom;
			const targetBarHeight = (val / maxVal) * availableHeight;
			const currentBarHeight = targetBarHeight * progress;
			const x = gap + (slot_width + gap) * index;
			const baseY = myCanvas.height - paddingBottom;
			const y = baseY - currentBarHeight;
			ctx.fillStyle = val === maxVal ? "hsl(210deg, 70%, 50%)" : "hsl(210deg, 70%, 60%)";
			ctx.beginPath();
			ctx.roundRect(x, y, slot_width, currentBarHeight, borderRadius);
			ctx.fill();
			ctx.fillStyle = "hsl(200deg, 10%, 40%)";
			ctx.shadowBlur = 0;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.font = "400 10px Bai Jamjuree";
			ctx.textAlign = "center";
			ctx.fillText(`T${(index + 1).toString().padStart(2, "0")}`, x + slot_width / 2, baseY + 30 - gap);
		});
		if (progress < 1) {
			requestAnimationFrame(animate);
		}
	}
	animate();
}