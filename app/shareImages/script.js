console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://eimi-fukada-default-rtdb.firebaseio.com"
});
const database = firebase.database();
const db = "db_images";

document.addEventListener("DOMContentLoaded", function() {
	loadImagesFromFirebase();
	cropperImage();
	const imageContainers = document.querySelectorAll(".image-container");
	const observer = new IntersectionObserver((entries, observer) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				const imgContainer = entry.target;
				const img = imgContainer.querySelector("img");
				const dataSrc = img.getAttribute("data-src");
				if (dataSrc) {
					img.src = dataSrc;
					imgContainer.classList.add("lazy-loaded");
					observer.unobserve(imgContainer);
				}
			}
		});
	}, {
		rootMargin: "0px 0px 0px 0px"
	});
	imageContainers.forEach(container => {
		observer.observe(container);
	});
});

async function uploadImageToFirebase(dataUrl) {
	database.ref(db).push({
		url: dataUrl,
		timestamp: createTimes()
	}).then(() => {
		loadImagesFromFirebase();
		console.log("Ảnh đã được tải lên và lưu vào database!");
	}).catch((error) => {
		console.error("Lỗi khi tải ảnh:", error);
	});
}

function loadImagesFromFirebase() {}

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
	let size = 200;
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
						minSize = size * ratio;
						draggArea.style.width = newWidth + "px";
						draggArea.style.height = newHeight + "px";
						const draggSize = Math.min(newWidth, newHeight);
						dragg.style.width = draggSize + "px";
						dragg.style.height = draggSize + "px";
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
			tempCanvas.width = size;
			tempCanvas.height = size;
			const tempCtx = tempCanvas.getContext("2d");
			tempCtx.fillStyle = "#fff";
			tempCtx.fillRect(0, 0, size, size);
			tempCtx.drawImage(uploadedImage, drg_left, drg_top, cropWidth, cropHeight, 0, 0, size, size);
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
			let newWidth, newHeight;
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			newWidth = initialWidth + dx;
			newHeight = initialHeight + dy;
			const sizeChange = Math.min(newWidth, newHeight);
			if (sizeChange < minSize) {
				return;
			}
			let finalWidth = sizeChange;
			let finalHeight = sizeChange;
			let finalLeft = initialLeft;
			let finalTop = initialTop;
			if (initialLeft + finalWidth > draggAreaRect.width) {
				finalWidth = draggAreaRect.width - initialLeft;
			}
			if (initialTop + finalHeight > draggAreaRect.height) {
				finalHeight = draggAreaRect.height - initialTop;
			}
			finalWidth = finalHeight = Math.min(finalWidth, finalHeight);
			dragg.style.width = finalWidth + "px";
			dragg.style.height = finalHeight + "px";
			dragg.style.left = finalLeft + "px";
			dragg.style.top = finalTop + "px";
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
			console.log(dataImage);
			uploadImageToFirebase(dataImage);
			boxCtrl.classList.remove("active");
		} else {
			alert("Chưa có ảnh nào được tải.");
		}
	});
	closeBox.addEventListener("click", function() {
		boxCtrl.classList.remove("active");
	});
}