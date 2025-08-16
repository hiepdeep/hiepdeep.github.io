/**
 * Hàm chính để tự động tìm và hoạt ảnh tất cả các số trên trang.
 * Nó tìm các phần tử dựa trên một bộ chọn CSS và sau đó gọi
 * hàm animateSingleNumber cho mỗi phần tử.
 * @param {string} selector - Bộ chọn CSS để tìm các phần tử chứa số (mặc định: '.js-animated-number').
 * @param {number} duration - Thời gian hoạt ảnh tính bằng mili giây (mặc định: 2000ms).
**/
function autoAnimateNumbers(selector, duration) {
	// Lấy tất cả các phần tử khớp với bộ chọn đã cho
	const elements = document.querySelectorAll(selector);
	// Lặp qua từng phần tử tìm thấy
	elements.forEach(element => {
		// Lấy nội dung văn bản của phần tử, loại bỏ dấu chấm (dấu phân cách hàng nghìn)
		// để chuyển đổi thành số nguyên hợp lệ.
		const targetNumberText = element.textContent.replace(/\./g, "");
		const targetNumber = parseInt(targetNumberText, 10); // Chuyển đổi thành số nguyên
		// Kiểm tra xem số đích có hợp lệ không. Nếu không, in cảnh báo và bỏ qua.
		if (isNaN(targetNumber)) {
			console.warn(`Bỏ qua hoạt ảnh cho phần tử:`, element, `vì nội dung "${element.textContent}" không phải là số hợp lệ.`);
			return; // Bỏ qua phần tử này
		}
		// Lưu số đích ban đầu vào một thuộc tính dataset.
		// Điều này hữu ích nếu bạn muốn tham chiếu lại giá trị ban đầu sau này.
		element.dataset.originalNumber = targetNumber;
		// Đặt nội dung văn bản của phần tử thành '0' ngay lập tức trước khi bắt đầu hoạt ảnh.
		// Điều này đảm bảo hoạt ảnh luôn bắt đầu từ 0 về mặt hình ảnh.
		element.textContent = "0";
		// Gọi hàm hoạt ảnh cho từng số
		animateSingleNumber(element, targetNumber, duration);
	});
}
/**
 * Hàm hoạt ảnh một số duy nhất từ 0 đến một số đích đã cho.
 * @param {HTMLElement} element - Phần tử DOM để hiển thị số.
 * @param {number} targetNumber - Số cuối cùng mà hoạt ảnh sẽ đạt được.
 * @param {number} duration - Thời gian hoạt ảnh tính bằng mili giây.
**/
function animateSingleNumber(element, targetNumber, duration) {
	let startTimestamp = null;
	const startNumber = 0; // Hoạt ảnh luôn bắt đầu từ 0
	// Hàm bước được gọi bởi requestAnimationFrame
	const step = (timestamp) => {
		if (!startTimestamp) startTimestamp = timestamp;
		// Tính toán tiến độ hoạt ảnh (từ 0 đến 1)
		const progress = Math.min((timestamp - startTimestamp) / duration, 1);
		// Tính toán số hiện tại dựa trên tiến độ
		// Math.floor để đảm bảo số nguyên trong quá trình đếm
		const currentNumber = Math.floor(progress * (targetNumber - startNumber) + startNumber);
		// Định dạng số với dấu chấm làm dấu phân cách hàng nghìn
		// và cập nhật nội dung văn bản của phần tử
		element.textContent = currentNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
		// Nếu hoạt ảnh chưa hoàn thành, yêu cầu khung hoạt ảnh tiếp theo
		if (progress < 1) {
			requestAnimationFrame(step);
		} else {
			// Đảm bảo số cuối cùng chính xác là số đích, được định dạng đúng
			element.textContent = targetNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
		}
	};
	// Bắt đầu hoạt ảnh bằng cách yêu cầu khung hoạt ảnh đầu tiên
	requestAnimationFrame(step);
}

/**
 * Hướng dẫn sử dụng:
 *
 * Thêm <script src="https://hiepdeep.github.io/library/script/function/autoAnimateNumbers.js"></script> vào thẻ <head>
 * Thêm autoAnimateNumbers(".js-animated-number", 2000); vào thẻ <script>.
 * Thêm class="js-animated-number" vào thẻ muốn sử dụng function này, ".js-animated-number" chỉ chứa số.
**/