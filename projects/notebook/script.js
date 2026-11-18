console.clear();

let notes = [];
let activeNoteId = null;
let fileSha = null; // Cần thiết để GitHub API cho phép cập nhật file notes.json
let autoSaveTimer = null;

const FILE_PATH = 'notes.json'; // File lưu trữ trên repo

// Xử lý mã hóa tiếng Việt sang Base64 chuẩn UTF-8
function utf8ToBase64(str) {
	return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(base64) {
	return decodeURIComponent(escape(atob(base64)));
}

// Khởi tạo cấu hình từ localStorage
window.addEventListener('DOMContentLoaded', () => {
	if (localStorage.getItem('gh_token')) document.getElementById('ghToken').value = localStorage.getItem('gh_token');
	if (localStorage.getItem('gh_owner')) document.getElementById('ghOwner').value = localStorage.getItem('gh_owner');
	if (localStorage.getItem('gh_repo')) document.getElementById('ghRepo').value = localStorage.getItem('gh_repo');
	loadNotesFromGitHub();
});

function saveConfigAndReload() {
	localStorage.setItem('gh_token', document.getElementById('ghToken').value.trim());
	localStorage.setItem('gh_owner', document.getElementById('ghOwner').value.trim());
	localStorage.setItem('gh_repo', document.getElementById('ghRepo').value.trim());
	loadNotesFromGitHub();
}

// 1. Tải danh sách ghi chú từ GitHub
async function loadNotesFromGitHub() {
	const token = localStorage.getItem('gh_token');
	const owner = localStorage.getItem('gh_owner');
	const repo = localStorage.getItem('gh_repo');
	const globalStatus = document.getElementById('globalStatus');
	if (!token || !owner || !repo) {
		globalStatus.innerText = '⚠️ Chưa cấu hình GitHub API!';
		return;
	}
	globalStatus.innerText = 'Đang tải...';
	const url = `https://api.github.com/repos/${owner}/${repo}/contents/${FILE_PATH}`;
	try {
		const res = await fetch(url, {
			headers: {
				'Authorization': `Bearer ${token}`
			}
		});
		if (res.ok) {
			const data = await res.json();
			fileSha = data.sha; // Lưu SHA để phục vụ cho việc ghi đè file sau này
			const decodedJson = base64ToUtf8(data.content.replace(/\n/g, ''));
			notes = JSON.parse(decodedJson);
			globalStatus.innerText = 'Kết nối GitHub thành công ✓';
		} else if (res.status === 404) {
			notes = []; // Nếu file chưa tồn tại trên repo, khởi tạo mảng rỗng
			fileSha = null;
			globalStatus.innerText = 'Repo chưa có file notes.json (Sẽ tự tạo khi lưu)';
		} else {
			const err = await res.json();
			globalStatus.innerText = `Lỗi: ${err.message}`;
		}
	} catch (error) {
		globalStatus.innerText = `Lỗi mạng: ${error.message}`;
	}

	renderNoteList();
}

// 2. Đồng bộ (Commit) toàn bộ danh sách ghi chú lên GitHub realtime
async function syncToGitHub() {
	const token = localStorage.getItem('gh_token');
	const owner = localStorage.getItem('gh_owner');
	const repo = localStorage.getItem('gh_repo');
	const syncStatus = document.getElementById('syncStatus');
	if (!token || !owner || !repo) return;
	syncStatus.innerText = 'Đang lưu lên GitHub...';
	const url = `https://api.github.com/repos/${owner}/${repo}/contents/${FILE_PATH}`;
	const jsonString = JSON.stringify(notes, null, 2);
	const encodedContent = utf8ToBase64(jsonString);
	const bodyData = {
		message: `chore(notes): auto-sync notes collection (${new Date().toLocaleString('vi-VN')})`,
		content: encodedContent,
		branch: "main" // Hoặc "master" tùy thuộc vào nhánh mặc định của bạn
	};
	if (fileSha) {
		bodyData.sha = fileSha; // Bắt buộc phải có SHA khi cập nhật file đã tồn tại
	}
	try {
		const res = await fetch(url, {
			method: 'PUT',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(bodyData)
		});
		if (res.ok) {
			const resData = await res.json();
			fileSha = resData.content.sha; // Cập nhật lại SHA mới nhất sau khi commit thành công
			syncStatus.innerText = 'Đã lưu và đồng bộ GitHub ✓';
		} else {
			const err = await res.json();
			syncStatus.innerText = `Lỗi đồng bộ: ${err.message}`;
		}
	} catch (error) {
		syncStatus.innerText = `Lỗi kết nối: ${error.message}`;
	}
}

// Hàm kích hoạt tự động đồng bộ ngầm khi người dùng thao tác
function triggerAutoSync() {
	const syncStatus = document.getElementById('syncStatus');
	syncStatus.innerText = 'Đang chờ thay đổi...';
	clearTimeout(autoSaveTimer);
	autoSaveTimer = setTimeout(() => {
		syncToGitHub();
	}, 800); // Lưu tự động sau 0.8 giây ngừng gõ phím
}

// Render giao diện danh sách
function renderNoteList() {
	const listEl = document.getElementById('noteList');
	listEl.innerHTML = '';
	if (notes.length === 0) {
		listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #6a737d; font-size: 0.85rem;">Chưa có ghi chú nào</div>';
		return;
	}
	notes.sort((a, b) => b.updatedAt - a.updatedAt);
	notes.forEach(note => {
		const item = document.createElement('div');
		item.className = `note-item ${note.id === activeNoteId ? 'active' : ''}`;
		item.onclick = () => openNote(note.id);
		const dateStr = new Date(note.updatedAt).toLocaleString('vi-VN', {
			hour: '2-digit',
			minute: '2-digit',
			day: '2-digit',
			month: '2-digit'
		});
		item.innerHTML = `
                    <div class="note-item-title">${note.title || 'Ghi chú không tiêu đề'}</div>
                    <div class="note-item-date">${dateStr}</div>
                `;
		listEl.appendChild(item);
	});
}

// 3. Tạo mới ghi chú
function createNewNote() {
	const newNote = {
		id: Date.now().toString(),
		title: 'Ghi chú mới',
		content: '',
		updatedAt: Date.now()
	};
	notes.unshift(newNote);
	openNote(newNote.id);
	renderNoteList();
	syncToGitHub(); // Lưu ngay lập tức lên GitHub
}

// Mở xem ghi chú
function openNote(id) {
	activeNoteId = id;
	const note = notes.find(n => n.id === id);
	if (!note) return;
	document.getElementById('noteTitle').value = note.title;
	document.getElementById('noteContent').value = note.content;
	document.getElementById('emptyState').style.display = 'none';
	document.getElementById('activeEditor').style.display = 'flex';
	renderNoteList();
}

// 4. Chỉnh sửa ghi chú (Realtime binding)
function handleInputEdit() {
	if (!activeNoteId) return;
	const note = notes.find(n => n.id === activeNoteId);
	if (!note) return;
	note.title = document.getElementById('noteTitle').value;
	note.content = document.getElementById('noteContent').value;
	note.updatedAt = Date.now();
	renderNoteList();
	triggerAutoSync(); // Gọi tự động đồng bộ realtime ngầm
}

document.getElementById('noteTitle').addEventListener('input', handleInputEdit);
document.getElementById('noteContent').addEventListener('input', handleInputEdit);

// 5. Xóa ghi chú
function deleteActiveNote() {
	if (!activeNoteId) return;
	if (confirm('Bạn có chắc chắn muốn xóa ghi chú này?')) {
		notes = notes.filter(n => n.id !== activeNoteId);
		activeNoteId = null;
		document.getElementById('activeEditor').style.display = 'none';
		document.getElementById('emptyState').style.display = 'flex';
		renderNoteList();
		syncToGitHub(); // Cập nhật lại file trên GitHub ngay lập tức
	}
}