console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://eimi-fukada-default-rtdb.firebaseio.com"
});
const database = firebase.database();
const db = "db_images";
const boxImages = document.getElementById("box-images");
const totalImageSpan = document.getElementById("total-image");
document.addEventListener("DOMContentLoaded", function() {
	loadImagesFromFirebase();
	cropperImage();
});
async function loadImagesFromFirebase() {
	const snapshot = await database.ref(db).orderByChild("timestamp").once("value");
	boxImages.innerHTML = "";
	let totalImages = 0;
	const fragment = document.createDocumentFragment();
	snapshot.forEach((childSnapshot) => {
		totalImages++;
		const userData = childSnapshot.val();
		const userKey = childSnapshot.key;
		const container = document.createElement("div");
		container.className = "image-container";
		const img = document.createElement("img");
		img.src = userData.url;
		img.alt = userKey;
		const btnGr = document.createElement("div");
		btnGr.className = "btn-gr";
		const addSpan = document.createElement("span");
		addSpan.className = "material-symbols-rounded";
		addSpan.textContent = "add";
		const delSpan = document.createElement("span");
		delSpan.className = "material-symbols-rounded";
		delSpan.textContent = "delete";
		btnGr.appendChild(addSpan);
		btnGr.appendChild(delSpan);
		container.appendChild(img);
		container.appendChild(btnGr);
		boxImages.appendChild(container);
		delSpan.addEventListener("click", () => {
			if (confirm("Bạn có chắc chắn muốn xóa?")) {
				database.ref(db).child(userKey).remove().then(() => {
					alert("Xóa thành công!");
					loadImagesFromFirebase();
				}).catch((error) => {
					console.error("Lỗi khi xóa:", error);
				});
			}
		});
	});
	totalImageSpan.textContent = totalImages;
	const imageContainer = document.querySelectorAll(".image-container");
	console.log(imageContainer.length);
	imageContainer.forEach((child) => {
		child.addEventListener("click", () => {
			console.log(child.getElementsByTagName("img")[0].src);
			const preview = document.getElementById("preview-image");
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
						alert("Xóa thành công!");
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
function cropperImage() {
	const boxCtrl = document.getElementById("crop-image");
	const uploadPicture = document.getElementById("btn-upload-image");
	const uploadError = document.getElementById("upload-image-error");
	const savePicture = document.getElementById("btn-save-image");
	const closeBox = document.getElementById("btn-close-box");
	const draggArea = document.getElementById("dragg-area");
	const dragg = document.getElementById("dragg");
	const defaultPicture = document.getElementById("canvas1");
	const ctxPicture = defaultPicture.getContext("2d");
	const profilePicture = document.getElementById("profile-image");
	const resizer = document.getElementById("resizer");
	let isDragging = false;
	let isResizing = false;
	let uploadedImage = null;
	let dataImage = null;
	let offsetX, offsetY, startX, startY, initialWidth, initialHeight, initialLeft, initialTop, $scale, minSize;
	uploadPicture.addEventListener("change", (e) => {
		const file = e.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = function(event) {
				const img = new Image();
				img.onload = function() {
					if (img.width < 200 || img.height < 200) {
						uploadError.innerText = "Ảnh phải có kích thước tối thiểu 200x200";
						uploadPicture.value = "";
						return;
					}
					uploadedImage = new Image();
					uploadedImage.onload = function() {
						uploadError.innerText = "";
						const maxWidth = 600;
						const maxHeight = 400;
						const ratioWidth = maxWidth / uploadedImage.width;
						const ratioHeight = maxHeight / uploadedImage.height;
						const ratio = Math.min(ratioWidth, ratioHeight);
						const newWidth = uploadedImage.width * ratio;
						const newHeight = uploadedImage.height * ratio;
						minSize = 50;
						draggArea.style.width = newWidth + "px";
						draggArea.style.height = newHeight + "px";
						const defaultCropWidth = Math.min(newWidth, 250);
						const defaultCropHeight = Math.min(newHeight, 150);
						dragg.style.width = defaultCropWidth + "px";
						dragg.style.height = defaultCropHeight + "px";
						defaultPicture.width = draggArea.getBoundingClientRect().width;
						defaultPicture.height = draggArea.getBoundingClientRect().height;
						ctxPicture.fillStyle = "white";
						ctxPicture.fillRect(0, 0, defaultPicture.width, defaultPicture.height);
						ctxPicture.drawImage(uploadedImage, 0, 0, defaultPicture.width, defaultPicture.height);
						dragg.style.display = "block";
						dragg.style.left = (defaultPicture.width - dragg.getBoundingClientRect().width) / 2 + "px";
						dragg.style.top = (defaultPicture.height - dragg.getBoundingClientRect().height) / 2 + "px";
						$scale = (uploadedImage.width / defaultPicture.width);
						updateCroppedImage();
					}
					uploadedImage.src = event.target.result;
				};
				img.src = event.target.result;
			}
			reader.readAsDataURL(file);
		}
	});
	function updateCroppedImage() {
		if (uploadedImage) {
			const blockRect = defaultPicture.getBoundingClientRect();
			const draggRect = dragg.getBoundingClientRect();
			let drg_left = (draggRect.left - blockRect.left) * $scale;
			let drg_top = (draggRect.top - blockRect.top) * $scale;
			const cropWidth = draggRect.width * $scale;
			const cropHeight = draggRect.height * $scale;
			const tempCanvas = document.createElement("canvas");
			tempCanvas.width = cropWidth;
			tempCanvas.height = cropHeight;
			const tempCtx = tempCanvas.getContext("2d");
			tempCtx.fillStyle = "#fff";
			tempCtx.fillRect(0, 0, cropWidth, cropHeight);
			tempCtx.drawImage(uploadedImage, drg_left, drg_top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
			dataImage = tempCanvas.toDataURL();
		}
	}
	dragg.addEventListener("mousedown", (e) => {
		if (e.target === resizer) {
			return;
		}
		isDragging = true;
		offsetX = e.clientX - dragg.getBoundingClientRect().left;
		offsetY = e.clientY - dragg.getBoundingClientRect().top;
		dragg.style.cursor = "grabbing";
	});
	resizer.addEventListener("mousedown", (e) => {
		isResizing = true;
		startX = e.clientX;
		startY = e.clientY;
		initialWidth = dragg.offsetWidth;
		initialHeight = dragg.offsetHeight;
		initialLeft = dragg.offsetLeft;
		initialTop = dragg.offsetTop;
		e.preventDefault();
	});
	document.addEventListener("mousemove", (e) => {
		if (!isDragging && !isResizing) return;
		e.preventDefault();
		const draggAreaRect = draggArea.getBoundingClientRect();
		if (isDragging) {
			let newLeft = e.clientX - draggAreaRect.left - offsetX;
			let newTop = e.clientY - draggAreaRect.top - offsetY;
			newLeft = Math.max(0, Math.min(newLeft, draggAreaRect.width - dragg.offsetWidth));
			newTop = Math.max(0, Math.min(newTop, draggAreaRect.height - dragg.offsetHeight));
			dragg.style.left = newLeft + "px";
			dragg.style.top = newTop + "px";
		} else if (isResizing) {
			let newWidth = initialWidth + (e.clientX - startX);
			let newHeight = initialHeight + (e.clientY - startY);
			newWidth = Math.max(newWidth, minSize);
			newHeight = Math.max(newHeight, minSize);
			newWidth = Math.min(newWidth, draggAreaRect.width - initialLeft);
			newHeight = Math.min(newHeight, draggAreaRect.height - initialTop);
			dragg.style.width = newWidth + "px";
			dragg.style.height = newHeight + "px";
		}
		updateCroppedImage();
	});
	document.addEventListener("mouseup", () => {
		isDragging = false;
		isResizing = false;
		dragg.style.cursor = "grab";
	});
	document.getElementById("btn-open-form").addEventListener("click", function() {
		boxCtrl.classList.add("active");
	});
	savePicture.addEventListener("click", () => {
		if (dataImage) {
			database.ref(db).push({
				url: dataImage,
				timestamp: createTimes()
			}).then(() => {
				loadImagesFromFirebase();
				console.log("Ảnh đã được tải lên và lưu vào database!");
			}).catch((error) => {
				console.error("Lỗi khi tải ảnh:", error);
			});
			console.log(dataImage);
			boxCtrl.classList.remove("active");
		} else {
			alert("Chưa có ảnh nào được tải.");
		}
	});
	closeBox.addEventListener("click", function() {
		boxCtrl.classList.remove("active");
	});
}