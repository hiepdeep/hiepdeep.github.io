console.clear();

const importInput = document.getElementById("import-image");
const pasteInput = document.getElementById("paste-image");
const changeW = document.getElementById("change-w");
const changeH = document.getElementById("change-h");
const optionFill = document.getElementById("option-fill");
const angleRadios = document.querySelectorAll("input[name='change-angle']");
const previewImg = document.querySelector("#preview img");
const returnImg = document.querySelector("#return img");
const dataName = document.getElementById("data-image-name");
const dataType = document.getElementById("data-image-type");
const dataDimensions = document.getElementById("data-image-dimensions");
const dataSize = document.getElementById("data-image-size");
let originalImage = new Image();
let fileName = "";
let fileType = "";

document.addEventListener("DOMContentLoaded", (e) => {
	e.preventDefault();
	const $return = document.getElementById("return");
	const $return_top = $return.getBoundingClientRect().top;
	$return.style.maxHeight = `calc(100vh - ${$return_top}px - 12px * 2 - 1px)`;
});

// Xử lý tải file từ máy tính
importInput.addEventListener("change", function(e) {
	const file = e.target.files[0];
	if (!file) return;
	fileName = file.name;
	fileType = file.type;
	const fileSize = (file.size / 1024).toFixed(2) + "KB";
	const reader = new FileReader();
	reader.onload = function(event) {
		loadImage(event.target.result, fileSize);
	};
	reader.readAsDataURL(file);
});

// Xử lý tải file từ URL
pasteInput.addEventListener("change", function() {
	const url = this.value.trim();
	if (!url) return;
	originalImage.crossOrigin = "Anonymous";
	loadImage(url, "N/A");
});

// Hàm bổ trợ để load ảnh dùng chung cho cả 2 cách
function loadImage(src, sizeText) {
	originalImage.src = src;
	originalImage.onload = function() {
		previewImg.src = originalImage.src;
		dataName.innerText = fileName || "Image from URL";
		dataType.innerText = fileType ? fileType.split("/")[1].toUpperCase() : "IMG";
		dataDimensions.innerText = `${originalImage.width}x${originalImage.height}`;
		dataSize.innerText = sizeText;
		renderResult();
	};
}

[changeW, changeH, optionFill].forEach(el => el.addEventListener("input", renderResult));
angleRadios.forEach(radio => radio.addEventListener("change", renderResult));

function renderResult() {
	if (!originalImage.src) return;
	const newW = parseInt(changeW.value) || 1920;
	const newH = parseInt(changeH.value) || 1080;
	const isFill = optionFill.checked;
	const selectedAngle = document.querySelector("input[name='change-angle']:checked").value;

	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");
	canvas.width = newW;
	canvas.height = newH;

	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, newW, newH);

	if (isFill) {
		ctx.drawImage(originalImage, 0, 0, newW, newH);
	} else {
		let posX = 0,
			posY = 0;
		const imgW = originalImage.width;
		const imgH = originalImage.height;
		if (selectedAngle.includes("left")) posX = 0;
		else if (selectedAngle.includes("right")) posX = newW - imgW;
		else posX = (newW - imgW) / 2;
		if (selectedAngle.includes("top")) posY = 0;
		else if (selectedAngle.includes("bottom")) posY = newH - imgH;
		else posY = (newH - imgH) / 2;
		ctx.drawImage(originalImage, posX, posY, imgW, imgH);
	}
	returnImg.src = canvas.toDataURL("image/png");
}