console.clear();

// Chọn các phần tử DOM
const importInput = document.getElementById("import-picture");
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

importInput.addEventListener("change", function(e) {
	const file = e.target.files[0];
	if (!file) return;
	fileName = file.name;
	fileType = file.type;
	const fileSize = (file.size / 1024).toFixed(2) + "KB";
	const reader = new FileReader();
	reader.onload = function(event) {
		originalImage.src = event.target.result;
		originalImage.onload = function() {
			previewImg.src = originalImage.src;
			dataName.innerText = fileName;
			dataType.innerText = fileType.split("/")[1].toUpperCase();
			dataDimensions.innerText = `${originalImage.width}x${originalImage.height}`;
			dataSize.innerText = fileSize;
			renderResult();
		};
	};
	reader.readAsDataURL(file);
});

// Lắng nghe sự kiện thay đổi tùy chọn để render lại
[changeW, changeH, optionFill].forEach(el => {
	el.addEventListener("input", renderResult);
});
angleRadios.forEach(radio => {
	radio.addEventListener("change", renderResult);
});

// Hàm xử lý chính: Vẽ lại ảnh dựa trên các tham số
function renderResult() {
	if (!originalImage.src) return;
	// Lấy thông số kích thước mới (nếu trống thì lấy placeholder)
	const newW = parseInt(changeW.value) || 1920;
	const newH = parseInt(changeH.value) || 1080;
	const isFill = optionFill.checked;
	const selectedAngle = document.querySelector('input[name="change-angle"]:checked').value;
	// Tạo canvas để xử lý ảnh
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	canvas.width = newW;
	canvas.height = newH;
	// Xoá canvas (trong suốt)
	ctx.clearRect(0, 0, newW, newH);
	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, newW, newH);
	if (isFill) {
		// Chế độ Fill: Kéo giãn ảnh lấp đầy canvas
		ctx.drawImage(originalImage, 0, 0, newW, newH);
	} else {
		// Chế độ Angle: Giữ nguyên size gốc và đặt vào vị trí
		let posX = 0;
		let posY = 0;
		const imgW = originalImage.width;
		const imgH = originalImage.height;
		// Tính toán tọa độ X
		if (selectedAngle.includes('left')) posX = 0;
		else if (selectedAngle.includes('right')) posX = newW - imgW;
		else posX = (newW - imgW) / 2; // Center
		// Tính toán tọa độ Y
		if (selectedAngle.includes('top')) posY = 0;
		else if (selectedAngle.includes('bottom')) posY = newH - imgH;
		else posY = (newH - imgH) / 2; // Center
		ctx.drawImage(originalImage, posX, posY, imgW, imgH);
	}
	// Xuất kết quả ra thẻ img #return
	returnImg.src = canvas.toDataURL(fileType || 'image/png');
}