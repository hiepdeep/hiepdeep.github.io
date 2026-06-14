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
	// Hàm xử lý Lưu cấu hình (Dùng chung cho cả click chuột và phím tắt)
	function handleSave() {
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
	}
	// 2. Xử lý Logic thông minh cho Editor (Auto cặp ngoặc, Enter, Tab, và Ctrl+S)
	cssEditor.addEventListener("keydown", function(e) {
		const start = this.selectionStart;
		const end = this.selectionEnd;
		const value = this.value;
		// TÍNH NĂNG MỚI: Bắt phím tắt Ctrl + S (hoặc Cmd + S trên Mac) để lưu nhanh
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
			e.preventDefault(); // Chặn hành vi mở hộp thoại lưu file mặc định của trình duyệt
			handleSave(); // Gọi hàm lưu dữ liệu
			return;
		}
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
			// Tìm vị trí bắt đầu của dòng hiện tại
			const lastNewLine = value.lastIndexOf("\n", start - 1);
			const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
			// Lấy toàn bộ phần thụt lề (khoảng trắng/tab) của dòng hiện tại
			const currentLine = value.substring(lineStart, start);
			const match = currentLine.match(/^[\t ]*/);
			const currentIndent = match ? match[0] : "";
			// Trường hợp đặc biệt: Nhấn Enter ở giữa cặp dấu ngoặc nhọn {}
			if (value[start - 1] === "{" && value[start] === "}") {
				e.preventDefault();
				// Dòng giữa tăng 1 tab, dòng chứa dấu } đóng ngoặc giữ nguyên độ thụt lề cũ
				const indentMiddle = "\n" + currentIndent + "\t";
				const indentEnd = "\n" + currentIndent;
				this.value = value.substring(0, start) + indentMiddle + indentEnd + value.substring(end);
				// Đặt con trỏ chuột ở cuối dòng giữa (sau tab mới tăng)
				this.selectionStart = this.selectionEnd = start + indentMiddle.length;
				return;
			}
			// Trường hợp Enter bình thường: Giữ nguyên độ thụt lề của dòng trước (giống các code editor)
			else {
				e.preventDefault();
				const insertText = "\n" + currentIndent;
				this.value = value.substring(0, start) + insertText + value.substring(end);
				this.selectionStart = this.selectionEnd = start + insertText.length;
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
	// 3. Sự kiện Click nút Save bằng chuột
	btnSave.addEventListener("click", handleSave);
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