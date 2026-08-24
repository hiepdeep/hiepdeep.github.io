console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://eimi-fukada-default-rtdb.firebaseio.com"
});
const database = firebase.database();

const loggedToken = localStorage.getItem("logged") ? localStorage.getItem("logged") : null;

document.addEventListener("DOMContentLoaded", () => {
	if (loggedToken) {
		renderLogin();
		renderUser();
		document.forms["login-form"]["login-key"].value = loggedToken;
		database.ref("abc").child(loggedToken).once("value", (snapshot) => {
			const loggedInUser = snapshot.val();
			document.getElementById("logged-user").innerHTML = `
				<span class="displayName">Loging for <b>${loggedInUser.displayName}</b></span>
			`;
		});
	}
});

async function renderLogin() {
	document.getElementById("login-list").innerHTML = "";
	const snapshot = await database.ref("abc").once("value");
	snapshot.forEach((childSnapshot) => {
		const userData = childSnapshot.val();
		const userKey = childSnapshot.key;
		if (loggedToken != userKey) {
			const userBlock = document.createElement("li");
			userBlock.innerHTML = userData.displayName;
			document.getElementById("login-list").appendChild(userBlock);
			userBlock.addEventListener("click", (e) => {
				e.preventDefault();
				localStorage.setItem("logged", userKey);
				window.location.href = "";
			});
		}
	});
}

async function renderUser() {
	const snapshot = await database.ref("abc").child(loggedToken).once("value");
	const userKey = snapshot.key;
	const userData = snapshot.val();
	const thumbnail = document.getElementById("profile-image");
	const inputName = document.getElementById("profile-name");
	const inputBirthday = document.getElementById("profile-birthday");
	const inputSex = document.getElementById("profile-sex");
	const inputUsername = document.getElementById("profile-username");
	const inputPassword = document.getElementById("profile-password");
	thumbnail.src = userData.pictures?.i200 ? userData.pictures.i200 : "https://hiepdeep.github.io/library/pictures/200/no_thumb.png";
	inputName.value = userData.displayName;
	inputBirthday.value = userData.birthday;
	inputSex.value = userData.sex;
	inputUsername.value = userData.auth.username;
	inputPassword.value = userData.auth.password;
	const btnSave = document.getElementById("btn-save-profile");
	const btnRemove = document.getElementById("btn-remove-profile");
	btnSave.addEventListener("click", () => {
		changeUser(userKey);
	});
	btnRemove.addEventListener("click", () => {
		deleteUser(userKey);
	});
}

function changeUser(userKey) {
	const thumb = document.getElementById("profile-image").src;
	const inputName = document.getElementById("profile-name").value.trim();
	const inputBirthday = document.getElementById("profile-birthday").value.trim();
	const inputSex = document.getElementById("profile-sex").value.trim();
	const inputUsername = document.getElementById("profile-username").value.trim();
	const inputPassword = document.getElementById("profile-password").value.trim();
	checkUsernameExists(inputUsername, userKey).then(usernameExists => {
		if (usernameExists) {
			alert("Tên người dùng đã tồn tại. Vui lòng chọn tên khác.");
			return;
		}
		database.ref("abc").child(userKey).update({
			pictures: {
				i200: thumb
			},
			displayName: inputName,
			auth: {
				username: inputUsername,
				password: inputPassword
			},
			sex: inputSex.checked ? "male" : "female",
			birthday: inputBirthday,
			accountUpdateDate: createTimes()
		}).then(() => {
			snackbar();
			renderUser();
		}).catch((error) => {
			console.error("Lỗi khi cập nhật tài khoản:", error);
		});
	}).catch(error => {
		console.error("Lỗi khi kiểm tra tên người dùng:", error);
	});
}

function deleteUser(userKey) {
	if (confirm("Bạn có chắc chắn muốn xóa người dùng này?")) {
		database.ref("abc").child(userKey).remove().then(() => {
			alert("Xóa thành công!");
			localStorage.removeItem("logged");
			window.location.href = "index.html?ref=login";
		}).catch((error) => {
			console.error("Lỗi khi xóa tài khoản:", error);
		});
	}
}

async function checkUsernameExists(username, currentUserKey = null) {
	const snapshot = await database.ref("abc").orderByChild("auth/username").equalTo(username).once("value");
	const usersWithUsername = snapshot.val();
	if (!usersWithUsername) {
		return false;
	}
	const userKeys = Object.keys(usersWithUsername);
	if (userKeys.length === 1 && userKeys[0] === currentUserKey) {
		return false;
	}
	return true;
}

const cropperImage = function() {
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
	document.getElementById("avatar-image").addEventListener("click", function() {
		boxCtrl.classList.add("active");
	});
	savePicture.addEventListener("click", () => {
		if (dataImage) {
			profilePicture.src = dataImage;
			boxCtrl.classList.remove("active");
		} else {
			alert("Chưa có ảnh nào được tải.");
		}
	});
	closeBox.addEventListener("click", function() {
		boxCtrl.classList.remove("active");
	});
}
cropperImage();

function snackbar() {
	var x = document.getElementById("snackbar");
	x.className = "show";
	setTimeout(function(){
		x.className = x.className.replace("show", "");
	}, 3000);
}
