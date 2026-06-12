const hostname = window.location.hostname;

chrome.storage.local.get(["customStyles"], (result) => {
	const styles = result.customStyles || {};
	const customCss = styles[hostname];
	if (customCss && customCss.trim() !== "") {
		const styleElement = document.createElement("style");
		styleElement.setAttribute("id", "custom-css-injector");
		styleElement.textContent = customCss;
		// Inject sớm nhất có thể, nếu chưa có head thì đợi DOMContentLoaded
		if (document.head) {
			document.head.appendChild(styleElement);
		} else {
			document.addEventListener("DOMContentLoaded", () => {
				document.head.appendChild(styleElement);
			});
		}
	}
});