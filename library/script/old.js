const app = firebase.initializeApp({
	databaseURL: "https://hiepdeep-default-rtdb.firebaseio.com"
});
const database = firebase.database();
const accounts = "authentication";
const messages = "messages";
const loggedInUsername = localStorage.getItem("hiepdeep-github-io-authentication") ? window.atob(localStorage.getItem("hiepdeep-github-io-authentication")) : null;
let $check_in_arr = [];
database.ref(accounts).on("value", (snapshot) => {
	if (snapshot.exists()) {
		let data = snapshot.val();
		let data_keys = Object.keys(data);
		$check_in_arr = data_keys;
		document.getElementById("totalUser").innerText = "Total Users: " + (snapshot.numChildren() - 1);
	}
});
if (loggedInUsername) {
	database.ref(`${accounts}/${loggedInUsername}`).once("value", (snapshot) => {
		if (snapshot.exists()) {
			let data = snapshot.val();
			document.getElementById("user-logged").innerHTML = `
				<a href="profile/?ref=${data.private.username}">${data.info.lastname} ${data.info.firstname}</a>
				<button id="btn-logout" class="material-icons">logout</button>
			`;
			document.getElementById("btn-logout").addEventListener("click", (e) => {
				e.preventDefault();
				database.ref(`${accounts}/${loggedInUsername}/status/online`).set("0");
				localStorage.removeItem("hiepdeep-github-io-authentication");
				window.location.href = "authentication/login";
			});
		}
	});
	database.ref(messages).on("value", (messagesSnapshot) => {
		const messagesData = messagesSnapshot.exists() ? messagesSnapshot.val() : {};
		database.ref(accounts).on("value", (accountsSnapshot) => {
			if (accountsSnapshot.exists()) {
				let $userlists = "";
				for (let e in $check_in_arr) {
					if ($check_in_arr[e] !== loggedInUsername) {
						database.ref(`${accounts}/${$check_in_arr[e]}`).on("value", (userSnapshot) => {
							if (userSnapshot.exists()) {
								let userData = userSnapshot.val();
								if (userData && userData.info) {
									let lastMessageContent = "...";
									let relevantMessages = Object.values(messagesData).filter(
										(msg) =>
											(msg.sendFrom === loggedInUsername && msg.sendTo === $check_in_arr[e]) ||
											(msg.sendTo === loggedInUsername && msg.sendFrom === $check_in_arr[e])
									);

									if (relevantMessages.length > 0) {
										relevantMessages.sort((a, b) => new Date(b.timeamp) - new Date(a.timeamp));
										lastMessageContent = relevantMessages[0].contents;
									}

									if (userData.status && userData.status.online === "1") {
										$userlists += `
											<div class="user onl" data-messages-userid="${userData.userid}">
												<div class="user-thumb">
													<img src="https://hiepdeep.netlify.app/library/picture/z.png" alt="">
												</div>
												<div class="user-data">
													<span class="fullname">${userData.info.lastname} ${userData.info.firstname}</span>
													<span class="lastmess">${lastMessageContent}</span>
												</div>
											</div>
										`;
									} else if (userData.status && userData.status.online === "0") {
										$userlists += `
											<div class="user" data-messages-userid="${userData.userid}">
												<div class="user-thumb">
													<img src="https://hiepdeep.netlify.app/library/picture/z.png" alt="">
												</div>
												<div class="user-data">
													<span class="fullname">${userData.info.lastname} ${userData.info.firstname}</span>
													<span class="lastmess">${lastMessageContent}</span>
												</div>
											</div>
										`;
									}
								} else {
									console.warn(`Dữ liệu người dùng ${$check_in_arr[e]} không có thông tin "info"`);
								}
								document.getElementById("user-lists").innerHTML = $userlists;
								let sendTo = "";
								let listitem = document.getElementById("user-lists").getElementsByClassName("user");
								for (let c = 0; c < listitem.length; c++) {
									listitem[c].addEventListener("click", (e) => {
										e.preventDefault();
										for (let d = 0; d < listitem.length; d++) {
											listitem[d].classList.remove("focus");
										}
										listitem[c].classList.add("focus");
										sendTo = window.atob(listitem[c].getAttribute("data-messages-userid"));
										database.ref(`${accounts}/${sendTo}`).once("value", (snapshot) => {
											let x = snapshot.val();
											document.getElementById("toYour").innerHTML = `
												<div class="picture">
													<img src="https://hiepdeep.netlify.app/library/picture/z.png" alt="">
												</div>
												<div class="data-user">
													<a class="fullname" href="profile/?ref=${x.private.username}" target="_blank">${x.info.lastname} ${x.info.firstname}</a>
												</div>
											`;
										});
										updateChat(loggedInUsername, sendTo);
										document.getElementById("toYour").style.display = "flex";
										document.getElementById("messages").style.display = "block";
										document.getElementById("submitChat").style.display = "block";
										document.getElementById("sendChat").value = "";
									});
								}
								let sendvalue = "";
								document.getElementById("sendChat").addEventListener("input", function(event) {
									sendvalue = document.getElementById("sendChat").value.trim();
								});
								document.getElementById("sendChat").addEventListener("keydown", function(event) {
									if (!event.shiftKey && event.key === "Enter") {
										if (sendvalue.length > 0) {
											sendChatssss(loggedInUsername, sendTo, to_slug(sendvalue));
											updateChat(loggedInUsername, sendTo);
											sendvalue = "";
											document.getElementById("sendChat").value = "";
											document.getElementById("sendChat").style.height = "48px";
										} else {
											alert("Vui lòng nhập tin nhắn.");
											sendvalue = "";
											document.getElementById("sendChat").value = "";
											document.getElementById("sendChat").style.height = "48px";
										}
										event.preventDefault();
									}
								});
							}
						});
					}
				}
			}
		});
	});
	//
	// database.ref(accounts).on("value", (snapshot) => {
	// 	if (snapshot.exists()) {
	// 		let $userlists = "";
	// 		for (let e in $check_in_arr) {
	// 			if ($check_in_arr[e] != loggedInUsername) {
	// 				database.ref(`${accounts}/${$check_in_arr[e]}`).on("value", (snapshot) => {
	// 					if (snapshot.exists()) {
	// 						let x = snapshot.val();
	// 						if (x && x.info) {
	// 							if (x.status && x.status.online === "1") {
	// 								$userlists += `
	// 									<div class="user onl" data-messages-userid="${x.userid}">
	// 										<div class="user-thumb">
	// 											<img src="https://hiepdeep.netlify.app/library/picture/z.png" alt="">
	// 										</div>
	// 										<div class="user-data">
	// 											<span class="fullname">${x.info.lastname} ${x.info.firstname}</span>
	// 											<span class="lastmess">...</span>
	// 										</div>
	// 									</div>
	// 								`;
	// 							}
	// 							else if (x.status && x.status.online === "0") {
	// 								$userlists += `
	// 									<div class="user" data-messages-userid="${x.userid}">
	// 										<div class="user-thumb">
	// 											<img src="https://hiepdeep.netlify.app/library/picture/z.png" alt="">
	// 										</div>
	// 										<div class="user-data">
	// 											<span class="fullname">${x.info.lastname} ${x.info.firstname}</span>
	// 											<span class="lastmess">...</span>
	// 										</div>
	// 									</div>
	// 								`;
	// 							}
	// 						}
	// 						else {
	// 							console.warn(`Dữ liệu người dùng ${$check_in_arr[e]} không có thông tin "info"`);
	// 						}
	// 					}
	// 				});
	// 			}
	// 		}
	// 		document.getElementById("user-lists").innerHTML = $userlists;
	// 		let sendTo = "";
	// 		let listitem = document.getElementById("user-lists").getElementsByClassName("user");
	// 		for (let c = 0; c < listitem.length; c++) {
	// 			listitem[c].addEventListener("click", (e) => {
	// 				e.preventDefault();
	// 				for (let d = 0; d < listitem.length; d++) {
	// 					listitem[d].classList.remove("focus");
	// 				}
	// 				listitem[c].classList.add("focus");
	// 				sendTo = window.atob(listitem[c].getAttribute("data-messages-userid"))
	// 				database.ref(`${accounts}/${sendTo}`).once("value", (snapshot) => {
	// 					let x = snapshot.val();
	// 					document.getElementById("toYour").innerHTML = `
	// 						<div class="picture">
	// 							<img src="https://hiepdeep.netlify.app/library/picture/z.png" alt="">
	// 						</div>
	// 						<div class="data-user">
	// 							<a class="fullname" href="profile/?ref=${x.private.username}" target="_blank">${x.info.lastname} ${x.info.firstname}</a>
	// 						</div>
	// 					`;
	// 				});
	// 				updateChat(loggedInUsername, sendTo);
	// 				document.getElementById("toYour").style.display = "flex";
	// 				document.getElementById("messages").style.display = "block";
	// 				document.getElementById("submitChat").style.display = "block";
	// 				document.getElementById("sendChat").value = "";
	// 			});
	// 		}
	// 		let sendvalue = "";
	// 		document.getElementById("sendChat").addEventListener("input", function(event) {
	// 			sendvalue = document.getElementById("sendChat").value.trim();
	// 		});
	// 		document.getElementById("sendChat").addEventListener("keydown", function(event) {
	// 			if (!event.shiftKey && event.key === "Enter") {
	// 				if (sendvalue.length > 0) {
	// 					sendChatssss(loggedInUsername, sendTo, to_slug(sendvalue));
	// 					updateChat(loggedInUsername, sendTo);
	// 					sendvalue = "";
	// 					document.getElementById("sendChat").value = "";
	// 					document.getElementById("sendChat").style.height = "48px";
	// 				} else {
	// 					alert("Vui lòng nhập tin nhắn.");
	// 					sendvalue = "";
	// 					document.getElementById("sendChat").value = "";
	// 					document.getElementById("sendChat").style.height = "48px";
	// 				}
	// 				event.preventDefault();
	// 			}
	// 		});
	// 	}
	// });
	//
} else {
	window.location.href = "authentication/login";
}
function sendChatssss(from, to, contents) {
	database.ref(messages).push({
		sendFrom: from,
		sendTo: to,
		contents: contents,
		timeamp: timesampAll()
	});
}
function updateChat(from, to) {
	document.getElementById("chats").innerHTML = "";
	let allChats = "";
	database.ref(messages).on("child_added", (snapshot) => {
		const message = snapshot.val();
		let chatItem = "";
		if ((from === message.sendFrom && to === message.sendTo) || (from === message.sendTo && to === message.sendFrom)) {
			if (from === message.sendFrom && to === message.sendTo) {
				chatItem += `
					<div class="chat right">
						<div class="timeamp">${timeampPro(message.timeamp)}</div>
						<div class="content">${message.contents}</div>
					</div>
				`;
			} else {
				chatItem += `
					<div class="chat">
						<div class="timeamp">${timeampPro(message.timeamp)}</div>
						<div class="content">${message.contents}</div>
					</div>
				`;
			}
			allChats += chatItem;
		}
		document.getElementById("chats").innerHTML = allChats;
		document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
	});
}
function timesampAll() {
	let getTime = new Date();
	let timeYear = getTime.getFullYear();
	let timeMonth = getTime.getMonth() + 1;
	let timeDate = getTime.getDate();
	let timeHours = getTime.getHours();
	let timeMinutes = getTime.getMinutes();
	let timeSeconds = getTime.getSeconds();
	let timeMilliseconds = getTime.getMilliseconds();
	return `${timeYear}/${timeMonth}/${timeDate} ${timeHours}:${timeMinutes}:${timeSeconds}:${timeMilliseconds}`;
}
function timeampPro(timeString) {
	const now = new Date();
	const timeWithoutMilliseconds = timeString.replace(/:(\d+)$/, '');
	const past = new Date(timeWithoutMilliseconds.replace(/-/g, '/'));
	const seconds = Math.floor((now - past) / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	if (days > 0) {
		return `${days} ngày trước`;
	}
	else if (hours > 0) {
		return `${hours} giờ trước`;
	}
	else if (minutes > 0) {
		return `${minutes} phút trước`;
	}
	else {
		return "vài giây trước";
	}
}
function to_slug(str) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;")
		.replace(/\n/g, "<br>");
}
document.querySelectorAll("textarea").forEach(el => {
	el.style.height = el.setAttribute("style", "height: 48px");
	el.classList.add("auto");
	el.addEventListener("input", e => {
		el.style.height = "auto";
		el.style.height = (el.scrollHeight) + "px";
	});
});