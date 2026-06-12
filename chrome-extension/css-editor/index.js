console.clear();

document.addEventListener("DOMContentLoaded", () => {
	const inputPath = document.getElementById("reference-path");
	const cssEditor = document.getElementById("css-editor");
	const btnSave = document.getElementById("save");
	const btnDelete = document.getElementById("delete");
	// 1. Phân tích tham số domain từ URL để hiển thị vào input và load dữ liệu cũ
	const urlParams = new URLSearchParams(window.location.search);
	const targetDomain = urlParams.get("domain");
	if (targetDomain) {
		inputPath.value = targetDomain;
		// Load lại cấu hình CSS đã lưu của domain này (nếu có)
		chrome.storage.local.get(["customStyles"], (result) => {
			const styles = result.customStyles || {};
			if (styles[targetDomain]) {
				cssEditor.value = styles[targetDomain];
			}
		});
	}
	// 2. Xử lý Logic thông minh cho Editor (Auto cặp ngoặc, Enter, Tab)
	cssEditor.addEventListener("keydown", function(e) {
		const start = this.selectionStart;
		const end = this.selectionEnd;
		const value = this.value;
		// Tự động đóng ngoặc đằng sau và đặt trỏ chuột ở giữa
		const pairs = {
			"{": "}",
			"[": "]",
			"(": ")"
		};
		if (pairs[e.key]) {
			e.preventDefault();
			this.value = value.substring(0, start) + e.key + pairs[e.key] + value.substring(end);
			this.selectionStart = this.selectionEnd = start + 1;
			return;
		}
		// Khi nhấn Enter ở giữa cặp dấu ngoặc nhọn {}
		if (e.key === "Enter") {
			if (value[start - 1] === "{" && value[start] === "}") {
				e.preventDefault();
				const indent = "\n\t\n"; // Xuống dòng và thụt 1 tab ở dòng giữa
				this.value = value.substring(0, start) + indent + value.substring(end);
				this.selectionStart = this.selectionEnd = start + 2; // Đặt nháy chuột ngay vị trí tab
				return;
			}
		}
		// Cho phép nhấn phím Tab để thụt lề văn bản thay vì chuyển focus ra ngoài
		if (e.key === "Tab") {
			e.preventDefault();
			this.value = value.substring(0, start) + "\t" + value.substring(end);
			this.selectionStart = this.selectionEnd = start + 1;
			return;
		}
	});
	// 3. Sự kiện Save cấu hình
	btnSave.addEventListener("click", () => {
		const domain = inputPath.value.trim();
		const cssContent = cssEditor.value.trim();
		if (!domain) return;
		chrome.storage.local.get(["customStyles"], (result) => {
			const styles = result.customStyles || {};
			styles[domain] = cssContent;
			chrome.storage.local.set({
				customStyles: styles
			}, () => {
				showNotification("Đã lưu cấu hình thành công!");
				reloadTargetTabs(domain);
			});
		});
	});
	// 4. Sự kiện Delete cấu hình
	btnDelete.addEventListener("click", () => {
		const domain = inputPath.value.trim();
		if (!domain) return;
		chrome.storage.local.get(["customStyles"], (result) => {
			const styles = result.customStyles || {};
			if (styles[domain]) {
				delete styles[domain];
				chrome.storage.local.set({
					customStyles: styles
				}, () => {
					cssEditor.value = "";
					showNotification("Đã xoá cấu hình thành công!");
					reloadTargetTabs(domain);
				});
			}
		});
	});
	// Hàm hiển thị thông báo Toast dạng Floating Overlay không ảnh hưởng tới layout
	function showNotification(message) {
		const toast = document.createElement("div");
		toast.textContent = message;
		// Style nhanh cho toast nổi lên màn hình
		Object.assign(toast.style, {
			position: "fixed",
			bottom: "20px",
			right: "20px",
			background: "#28a745",
			color: "#fff",
			padding: "8px 16px",
			borderRadius: "4px",
			fontSize: "14px",
			zIndex: "9999",
			fontFamily: "sans-serif",
			boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
		});
		document.body.appendChild(toast);
		setTimeout(() => toast.remove(), 2500); // 2.5s tự xoá thông báo
	}
	// Tự động tìm và reload các tab đang mở đúng domain vừa sửa để cập nhật trực tiếp CSS
	function reloadTargetTabs(domain) {
		chrome.tabs.query({}, (tabs) => {
			tabs.forEach((tab) => {
				if (tab.url) {
					try {
						const url = new URL(tab.url);
						if (url.hostname === domain) {
							chrome.tabs.reload(tab.id);
						}
					} catch (e) {}
				}
			});
		});
	}
});