// 1. Lắng nghe khi click vào biểu tượng Extension để mở index.html
chrome.action.onClicked.addListener((tab) => {
	let domain = "";
	if (tab.url && (tab.url.startsWith("http://") || tab.url.startsWith("https://"))) {
		try {
			const url = new URL(tab.url);
			domain = url.hostname;
		} catch (e) {
			domain = "";
		}
	}
	// Tạo URL dẫn đến file custom.html kèm theo tham số domain
	const pageUrl = chrome.runtime.getURL("index.html") + (domain ? `?domain=${encodeURIComponent(domain)}` : "");
	chrome.tabs.create({
		url: pageUrl
	});
});

// 2. Logic hiển thị Badge thông báo trang đã tùy chỉnh CSS
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (tab.url) updateBadge(tabId, tab.url);
});
chrome.tabs.onActivated.addListener((activeInfo) => {
	chrome.tabs.get(activeInfo.tabId, (tab) => {
		if (tab.url) updateBadge(activeInfo.tabId, tab.url);
	});
});
function updateBadge(tabId, urlString) {
	try {
		if (!urlString.startsWith("http")) return;
		const url = new URL(urlString);
		const hostname = url.hostname;
		chrome.storage.local.get(["customStyles"], (result) => {
			const styles = result.customStyles || {};
			if (styles[hostname] && styles[hostname].trim() !== "") {
				chrome.action.setBadgeText({
					tabId: tabId,
					text: "&"
				});
				chrome.action.setBadgeBackgroundColor({
					tabId: tabId,
					color: "#555"
				});
			} else {
				chrome.action.setBadgeText({
					tabId: tabId,
					text: ""
				});
			}
		});
	} catch (e) {
		chrome.action.setBadgeText({
			tabId: tabId,
			text: ""
		});
	}
}