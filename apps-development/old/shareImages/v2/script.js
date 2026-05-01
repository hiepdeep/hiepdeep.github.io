console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://eimi-fukada-default-rtdb.firebaseio.com"
});
const database = firebase.database();
const db = "db_images";
document.addEventListener("DOMContentLoaded", function() {
	loadImagesFromFirebase();
	cropImage();
});
async function loadImagesFromFirebase() {
	const boxImages = document.getElementById("box-images");
	const totalImageSpan = document.getElementById("total-image");
	const preview = document.getElementById("preview-image");
	const snapshot = await database.ref(db).orderByChild("timestamp").once("value");
	boxImages.innerHTML = "";
	let totalImages = 0;
	const fragment = document.createDocumentFragment();
	const imagesData = [];
	snapshot.forEach((childSnapshot) => {
		imagesData.push({
			key: childSnapshot.key,
			data: childSnapshot.val()
		});
	});
	imagesData.reverse();
	imagesData.forEach((image) => {
		totalImages++;
		const k = image.key;
		const d = image.data;
		const container = document.createElement("div");
		container.className = "image-container";
		const img = document.createElement("img");
		img.src = d.url;
		img.alt = k;
		container.appendChild(img);
		boxImages.appendChild(container);
	});
	totalImageSpan.textContent = totalImages;
	const imageContainer = document.querySelectorAll(".image-container");
	imageContainer.forEach((child) => {
		child.addEventListener("click", () => {
			preview.innerHTML = "";
			const imgPreview = document.createElement("img");
			imgPreview.src = child.getElementsByTagName("img")[0].src;
			imgPreview.alt = child.getElementsByTagName("img")[0].alt;
			const btnGr = document.createElement("div");
			btnGr.className = "btn-gr";
			const addSpan = document.createElement("span");
			addSpan.className = "material-symbols-rounded";
			addSpan.textContent = "add";
			const delSpan = document.createElement("span");
			delSpan.className = "material-symbols-rounded";
			delSpan.textContent = "delete";
			const clsSpan = document.createElement("span");
			clsSpan.className = "material-symbols-rounded";
			clsSpan.textContent = "close";
			btnGr.appendChild(addSpan);
			btnGr.appendChild(delSpan);
			btnGr.appendChild(clsSpan);
			preview.appendChild(imgPreview);
			preview.appendChild(btnGr);
			preview.classList.add("active");
			clsSpan.addEventListener("click", () => {
				preview.classList.remove("active");
			});
			delSpan.addEventListener("click", () => {
				if (confirm("Bạn có chắc chắn muốn xóa?")) {
					database.ref(db).child(imgPreview.alt).remove().then(() => {
						preview.classList.remove("active");
						loadImagesFromFirebase();
					}).catch((error) => {
						console.error("Lỗi khi xóa:", error);
					});
				}
			});
		});
	});
}
function cropImage() {
	const btn_uploadImage = document.getElementById("btn-upload-image");
	const croperBox = document.getElementById("croper-box");
	const btnSave = document.getElementById("croper-box-save");
	const btnClose = document.getElementById("croper-box-close");
	const canvasArea = document.getElementById("canvas-area");
	const draggArea = document.getElementById("croper-box-dragg-area");
	const dragg = document.getElementById("croper-box-dragg");
	const resizer = document.getElementById("croper-box-dragg-resizer");
	const canvasImage = document.getElementById("croper-box-canvas-image");
	const ctxImage = canvasImage.getContext("2d");
	let uploadedImage = null;
	let originalImage = null;
	let isResizing = false;
	let startX, startY, startWidth, startHeight;
	const PADDING = 0;
	const MIN = 36;
	btn_uploadImage.addEventListener("change", (e) => {
		const file = e.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = function(event) {
				originalImage = new Image();
				originalImage.onload = function() {
					uploadedImage = new Image();
					uploadedImage.onload = function() {
						const containerWidth = canvasArea.clientWidth;
						const containerHeight = canvasArea.clientHeight;
						const imgRatio = uploadedImage.width / uploadedImage.height;
						const containerRatio = containerWidth / containerHeight;
						let newWidth, newHeight;
						if (imgRatio > containerRatio) {
							newWidth = containerWidth;
							newHeight = Math.floor(containerWidth / imgRatio);
						} else {
							newHeight = containerHeight;
							newWidth = Math.floor(containerHeight * imgRatio);
						}
						const boxShadow = Math.max(newWidth, newHeight);
						canvasImage.width = newWidth;
						canvasImage.height = newHeight;
						ctxImage.fillStyle = "white";
						ctxImage.fillRect(0, 0, canvasImage.width, canvasImage.height);
						ctxImage.drawImage(uploadedImage, 0, 0, canvasImage.width, canvasImage.height);
						draggArea.style.width = newWidth + "px";
						draggArea.style.height = newHeight + "px";
						draggArea.style.display = "block";
						dragg.style.width = newWidth - PADDING + "px";
						dragg.style.height = newHeight - PADDING + "px";
						dragg.style.left = PADDING / 2 + "px";
						dragg.style.top = PADDING / 2 + "px";
						dragg.style.boxShadow = `0 0 0 ${boxShadow}px rgba(87, 87, 87, 0.5)`;
						croperBox.classList.add("active");
					}
					uploadedImage.src = event.target.result;
				};
				originalImage.src = event.target.result;
			}
			reader.readAsDataURL(file);
			e.target.value = null;
		}
	});
	resizer.addEventListener("pointerdown", (e) => {
		e.preventDefault();
		isResizing = true;
		startX = e.clientX;
		startY = e.clientY;
		startWidth = parseFloat(getComputedStyle(dragg).width);
		startHeight = parseFloat(getComputedStyle(dragg).height);
		// Sử dụng pointermove và pointerup
		document.addEventListener("pointermove", resize);
		document.addEventListener("pointerup", stopResize);
		dragg.style.cursor = "grabbing";
	});
	function resize(e) {
		if (!isResizing) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		let newWidth = startWidth + dx;
		let newHeight = startHeight + dy;
		const maxW = parseFloat(getComputedStyle(draggArea).width) - parseFloat(dragg.style.left) - PADDING / 2;
		const maxH = parseFloat(getComputedStyle(draggArea).height) - parseFloat(dragg.style.top) - PADDING / 2;
		newWidth = Math.max(MIN, Math.min(newWidth, maxW));
		newHeight = Math.max(MIN, Math.min(newHeight, maxH));
		dragg.style.width = newWidth + "px";
		dragg.style.height = newHeight + "px";
	}
	function stopResize() {
		isResizing = false;
		document.removeEventListener("pointermove", resize);
		document.removeEventListener("pointerup", stopResize);
		dragg.style.cursor = "grab";
	}
	let isDragging = false;
	let dragOffsetX, dragOffsetY;
	dragg.addEventListener("pointerdown", (e) => {
		if (e.target !== resizer) {
			e.preventDefault();
			isDragging = true;
			dragOffsetX = e.clientX - parseFloat(dragg.style.left);
			dragOffsetY = e.clientY - parseFloat(dragg.style.top);
			// Sử dụng pointermove và pointerup
			document.addEventListener("pointermove", drag);
			document.addEventListener("pointerup", stopDrag);
			dragg.style.cursor = "grabbing";
		}
	});
	function drag(e) {
		if (!isDragging) return;
		let newLeft = e.clientX - dragOffsetX;
		let newTop = e.clientY - dragOffsetY;
		const maxLeft = parseFloat(getComputedStyle(draggArea).width) - parseFloat(getComputedStyle(dragg).width) - PADDING / 2;
		const maxTop = parseFloat(getComputedStyle(draggArea).height) - parseFloat(getComputedStyle(dragg).height) - PADDING / 2;
		newLeft = Math.max(PADDING / 2, Math.min(newLeft, maxLeft));
		newTop = Math.max(PADDING / 2, Math.min(newTop, maxTop));
		dragg.style.left = newLeft + "px";
		dragg.style.top = newTop + "px";
	}
	function stopDrag() {
		isDragging = false;
		document.removeEventListener("pointermove", drag);
		document.removeEventListener("pointerup", stopDrag);
		dragg.style.cursor = "grab";
	}
	if (btnSave && btnClose) {
		btnSave.addEventListener("click", () => {
			if (!originalImage) return;
			const cropDisplayX = parseFloat(dragg.style.left) - PADDING / 2;
			const cropDisplayY = parseFloat(dragg.style.top) - PADDING / 2;
			const cropDisplayWidth = parseFloat(getComputedStyle(dragg).width) + PADDING;
			const cropDisplayHeight = parseFloat(getComputedStyle(dragg).height) + PADDING;
			const scaleX = originalImage.width / canvasImage.width;
			const scaleY = originalImage.height / canvasImage.height;
			const cropOriginalX = Math.round(cropDisplayX * scaleX);
			const cropOriginalY = Math.round(cropDisplayY * scaleY);
			const cropOriginalWidth = Math.round(cropDisplayWidth * scaleX);
			const cropOriginalHeight = Math.round(cropDisplayHeight * scaleY);
			const croppedCanvas = document.createElement('canvas');
			croppedCanvas.width = cropOriginalWidth;
			croppedCanvas.height = cropOriginalHeight;
			const croppedCtx = croppedCanvas.getContext('2d');
			croppedCtx.drawImage(originalImage, cropOriginalX, cropOriginalY, cropOriginalWidth, cropOriginalHeight, 0, 0, cropOriginalWidth, cropOriginalHeight);
			const croppedImageUrl = croppedCanvas.toDataURL("image/png");
			database.ref(db).push({
				url: croppedImageUrl,
				info: {
					width: croppedCanvas.width,
					height: croppedCanvas.height,
				},
				timestamp: createTimes()
			}).then(() => {
				loadImagesFromFirebase();
				console.log("Ảnh đã được tải lên và lưu vào database!");
			}).catch((error) => {
				console.error("Lỗi khi tải ảnh:", error);
			});
			croperBox.classList.remove("active");
		});
		btnClose.addEventListener("click", () => {
			croperBox.classList.remove("active");
		});
	}
}