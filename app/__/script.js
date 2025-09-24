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
	const containerWidth = canvasArea.clientWidth;
	const containerHeight = canvasArea.clientHeight;
	btn_uploadImage.addEventListener("change", (e) => {
		const file = e.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = function(event) {
				const img = new Image();
				img.onload = function() {
					uploadedImage = new Image();
					uploadedImage.onload = function() {
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
						dragg.style.width = newWidth - 12 + "px";
						dragg.style.height = newHeight - 12 + "px";
						dragg.style.left = "6px";
						dragg.style.top = "6px";
						dragg.style.boxShadow = `0 0 0 ${boxShadow}px rgba(0, 0, 0, 0.5)`;
						croperBox.classList.add("active");
					}
					uploadedImage.src = event.target.result;
				};
				img.src = event.target.result;
			}
			reader.readAsDataURL(file);
		}
	});
	if (btnSave && btnClose) {
		btnSave.addEventListener("click", () => {
			croperBox.classList.remove("active");
			console.log(uploadedImage.width, uploadedImage.height);
		});
		btnClose.addEventListener("click", () => {
			croperBox.classList.remove("active");
		});
	}
}
