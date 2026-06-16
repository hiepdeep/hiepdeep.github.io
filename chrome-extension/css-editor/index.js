console.clear();
document.addEventListener("DOMContentLoaded", () => {
	const inputPath = document.getElementById("reference-path");
	const editor = document.getElementById("editor");
	const hl = document.getElementById("hl");
	const lineNums = document.getElementById("lineNums");
	const btnSave = document.getElementById("save");
	const btnDelete = document.getElementById("delete");
	const urlParams = new URLSearchParams(window.location.search);
	const targetDomain = urlParams.get("domain");
	if (targetDomain) {
		inputPath.value = targetDomain;
		chrome.storage.local.get(["customStyles"], (result) => {
			const styles = result.customStyles || {};
			if (styles[targetDomain]) {
				editor.value = styles[targetDomain];
				render();
			}
		});
	}
	function handleSave() {
		const domain = inputPath.value.trim();
		const cssContent = editor.value;
		if (!domain) return;
		chrome.storage.local.get(["customStyles"], (result) => {
			const styles = result.customStyles || {};
			styles[domain] = cssContent;
			chrome.storage.local.set({ customStyles: styles }, () => {
				showNotification("Đã lưu cấu hình thành công!");
				reloadTargetTabs(domain);
			});
		});
	}
	function esc(s) {
		return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}
	function highlightCSS(code) {
		let out = "", i = 0;
		while (i < code.length) {
			// Comments
			if (code[i] === "/" && code[i + 1] === "*") {
				const end = code.indexOf("*/", i + 2);
				const sl = end === -1 ? code.slice(i) : code.slice(i, end + 2);
				out += `<span class="c-cmt">${esc(sl)}</span>`;
				i += sl.length;
				continue;
			}
			// Strings
			if (code[i] === '"' || code[i] === "'") {
				const q = code[i];
				let j = i + 1, s = q;
				while (j < code.length) {
					s += esc(code[j]);
					if (code[j] === q) { j++; break; }
					j++;
				}
				out += `<span class="c-str">${s}</span>`;
				i = j;
				continue;
			}
			// At-rules
			if (code[i] === "@") {
				let j = i;
				while (j < code.length && /[\w-]/.test(code[j] || "")) j++;
				out += `<span class="c-atrule">${esc(code.slice(i, j))}</span>`;
				i = j;
				continue;
			}
			// CSS variable --
			if (code[i] === "-" && code[i + 1] === "-") {
				let j = i;
				while (j < code.length && /[\w-]/.test(code[j])) j++;
				out += `<span class="c-var">${esc(code.slice(i, j))}</span>`;
				i = j;
				continue;
			}
			// Hex color
			if (code[i] === "#") {
				let j = i + 1;
				while (j < code.length && /[0-9a-fA-F]/.test(code[j])) j++;
				if (j - i > 1) {
					out += `<span class="c-hash">${esc(code.slice(i, j))}</span>`;
					i = j;
					continue;
				}
			}
			// Number + optional unit
			if (/[0-9]/.test(code[i]) || (code[i] === "-" && /[0-9]/.test(code[i + 1] || ""))) {
				let j = i;
				if (code[j] === "-") j++;
				while (j < code.length && /[0-9.]/.test(code[j])) j++;
				const num = code.slice(i, j);
				const uM = code.slice(j).match(/^(px|em|rem|vh|vw|vmin|vmax|%|deg|s|ms|fr|ch|ex|pt|pc|cm|mm|in)/);
				const unit = uM ? uM[1] : "";
				out += `<span class="c-num">${esc(num + unit)}</span>`;
				i = j + unit.length;
				continue;
			}
			// Words
			if (/[a-zA-Z_]/.test(code[i])) {
				let j = i;
				while (j < code.length && /[\w-]/.test(code[j])) j++;
				const word = code.slice(i, j);
				const after = code[j] || '';
				const before = code.slice(0, i).trimEnd();
				const lastMeaningful = before[before.length - 1] || "";
				if ((after === ":" && /[{;}\n]/.test(lastMeaningful)) || lastMeaningful === "{" || lastMeaningful === ";" || lastMeaningful === "}") {
					if (lastMeaningful === "{" || lastMeaningful === ";") {
						out += `<span class="c-prop">${esc(word)}</span>`;
					} else {
						out += `<span class="c-sel">${esc(word)}</span>`;
					}
				} else if (/^(px|em|rem|solid|dashed|none|auto|inherit|initial|flex|block|inline|grid|absolute|relative|fixed|sticky|center|left|right|top|bottom|bold|normal|italic|transparent|currentColor|url|rgb|rgba|hsl|hsla|var|calc|min|max|clamp|repeat|wrap|nowrap|column|row|space-between|space-around|stretch|start|end|baseline|unset|revert|pointer|default|cursor|border-box|content-box|uppercase|lowercase|capitalize|underline|overline|line-through|hidden|visible|scroll|clip|ellipsis|pre|nowrap|break-word|serif|sans-serif|monospace)$/.test(word)) {
					out += `<span class="c-val">${esc(word)}</span>`;
				} else {
					out += `<span class="c-sel">${esc(word)}</span>`;
				}
				i = j;
				continue;
			}
			// Punctuation
			if (/[{}:;,()\[\]]/.test(code[i])) {
				out += `<span class="c-punct">${esc(code[i])}</span>`;
				i++;
				continue;
			}
			out += esc(code[i]);
			i++;
		}
		return out;
	}
	function render() {
		const code = editor.value;
		hl.innerHTML = highlightCSS(code) + "\n";
		const lines = code.split("\n").length;
		let ln = "";
		for (let i = 1; i <= lines; i++) {
			ln += `<span>${i}</span>`;
		}
		lineNums.innerHTML = ln;
		syncScroll();
	}
	function syncScroll() {
		hl.scrollTop = editor.scrollTop;
		hl.scrollLeft = editor.scrollLeft;
		lineNums.scrollTop = editor.scrollTop;
	}
	editor.addEventListener("input", render);
	editor.addEventListener("scroll", syncScroll);
	editor.addEventListener("keydown", function(e) {
		const start = this.selectionStart;
		const end = this.selectionEnd;
		const value = this.value;
		const isSelected = start !== end;
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
			e.preventDefault();
			handleSave();
			return;
		}
		const pairs = {
			"{": "}",
			"[": "]",
			"(": ")",
			'"': '"',
			"'": "'"
		};
		if (pairs[e.key]) {
			e.preventDefault();
			if (isSelected) {
				const selectedText = value.substring(start, end);
				this.value = value.substring(0, start) + e.key + selectedText + pairs[e.key] + value.substring(end);
				this.selectionStart = start;
				this.selectionEnd = end + 2;
			} else {
				this.value = value.substring(0, start) + e.key + pairs[e.key] + value.substring(end);
				this.selectionStart = this.selectionEnd = start + 1;
			}
			render();
			return;
		}
		if (e.key === "Enter") {
			const lastNewLine = value.lastIndexOf("\n", start - 1);
			const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
			const currentLine = value.substring(lineStart, start);
			const match = currentLine.match(/^[\t ]*/);
			const currentIndent = match ? match[0] : "";
			if (value[start - 1] === "{" && value[start] === "}") {
				e.preventDefault();
				const indentMiddle = "\n" + currentIndent + "\t";
				const indentEnd = "\n" + currentIndent;
				this.value = value.substring(0, start) + indentMiddle + indentEnd + value.substring(end);
				this.selectionStart = this.selectionEnd = start + indentMiddle.length;
				render();
				return;
			} else {
				e.preventDefault();
				const insertText = "\n" + currentIndent;
				this.value = value.substring(0, start) + insertText + value.substring(end);
				this.selectionStart = this.selectionEnd = start + insertText.length;
				render();
				return;
			}
		}
		if (e.key === "Tab") {
			e.preventDefault();
			this.value = value.substring(0, start) + "\t" + value.substring(end);
			this.selectionStart = this.selectionEnd = start + 1;
			render();
			return;
		}
	});
	btnSave.addEventListener("click", handleSave);
	btnDelete.addEventListener("click", () => {
		const domain = inputPath.value.trim();
		if (!domain) return;
		chrome.storage.local.get(["customStyles"], (result) => {
			const styles = result.customStyles || {};
			if (styles[domain]) {
				delete styles[domain];
				chrome.storage.local.set({ customStyles: styles }, () => {
					editor.value = "";
					showNotification("Đã xoá cấu hình thành công!");
					render();
					reloadTargetTabs(domain);
				});
			}
		});
	});
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
		setTimeout(() => toast.remove(), 2500);
	}
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
	render();
});