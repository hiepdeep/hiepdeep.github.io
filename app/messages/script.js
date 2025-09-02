console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://eimi-fukada-default-rtdb.firebaseio.com"
});
const database = firebase.database();

const loggedToken = localStorage.getItem("logged") ? localStorage.getItem("logged") : null;

document.addEventListener("DOMContentLoaded", () => {
	renderLogin();
	renderCol_1();
	renderCol_2();
	if (loggedToken) {
		document.forms["login-form"]["login-key"].value = loggedToken;
		database.ref(`abc/${loggedToken}`).once("value", (snapshot) => {
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

async function renderCol_1() {
	const userLists = document.getElementById("col-1").getElementsByTagName("ul")[0];
	userLists.innerHTML = "";
	const snapshot = await database.ref(`abc`).orderByChild("online").once("value");
	snapshot.forEach((childSnapshot) => {
		const userKey = childSnapshot.key;
		const userData = childSnapshot.val();
		if (loggedToken != userKey) {
			const userBlock = document.createElement("li");
			userBlock.innerHTML = `
				<div class="item">
					<div class="${userData.online == '1' ? 'thumb online' : 'thumb'}">
						<img src="https://hiepdeep.github.io/library/pictures/200/${randomInt(1, 18)}.png">
					</div>
					<div class="dataUser">
						<a href="javascript:;" class="displayName">${userData.displayName}</a>
					</div>
				</div>
			`;
			userLists.insertBefore(userBlock, userLists.firstChild);
			userBlock.addEventListener("click", (e) => {
				e.preventDefault();
				renderCol_3(userKey);
			});
		}
	});
}

async function renderCol_2() {
	const userLists = document.getElementById("col-2").getElementsByTagName("ul")[0];
	userLists.innerHTML = "";
	const recentChats = {};
	const messagesSnapshot = await database.ref("abc-messages").orderByChild("timeamp").once("value");
	messagesSnapshot.forEach((childSnapshot) => {
		const messageKey = childSnapshot.key;
		const message = childSnapshot.val();
		if (message.sendFrom === loggedToken || message.sendTo === loggedToken) {
			const otherUserKey = message.sendFrom === loggedToken ? message.sendTo : message.sendFrom;
			if (!recentChats[otherUserKey] || new Date(recentChats[otherUserKey].timeamp) < new Date(message.timeamp)) {
				recentChats[otherUserKey] = {
					...message,
					key: messageKey,
					unread: message.readed === 0 && message.sendTo === loggedToken,
					isSentByMe: message.sendFrom === loggedToken
				};
			}
		}
	});
	const userPromises = Object.keys(recentChats).map(key => database.ref("abc").child(key).once('value'));
	const userSnapshots = await Promise.all(userPromises);
	const sortedRecentChats = Object.values(recentChats).sort((a, b) => {
		return new Date(b.timeamp) - new Date(a.timeamp);
	});
	for (const lastMessage of sortedRecentChats) {
		const otherUserKey = lastMessage.sendFrom === loggedToken ? lastMessage.sendTo : lastMessage.sendFrom;
		const userDataSnapshot = userSnapshots.find(snapshot => snapshot.key === otherUserKey);
		if (userDataSnapshot && userDataSnapshot.val()) {
			const userData = userDataSnapshot.val();
			const messageText = lastMessage.isSentByMe ? `Bạn: ${lastMessage.contents}` : lastMessage.contents;
			const userBlock = document.createElement("li");
			userBlock.setAttribute("data-messageuser", otherUserKey);
			userBlock.innerHTML = `
				<div class="item">
					<div class="${userData.online == '1' ? 'thumb online' : 'thumb'}">
						<img src="https://hiepdeep.github.io/library/pictures/200/${randomInt(1, 18)}.png">
					</div>
					<div class="dataUser">
						<a href="javascript:;" class="displayName">${userData.displayName}</a>
						<div class="lastMess">
							<span class="${lastMessage.unread ? 'text unread' : 'text'}" data-messagekey="${lastMessage.key}">${entities(messageText)}</span>
							<span class="timeamp">${formatTimeAgo(lastMessage.timeamp)}</span>
						</div>
					</div>
				</div>
			`;
			userLists.appendChild(userBlock);
			userBlock.addEventListener("click", (e) => {
				e.preventDefault();
				userBlock.querySelector(".lastMess .text").classList.remove("unread");
				database.ref("abc-messages").once("value", (snapshot) => {
					snapshot.forEach(childSnapshot => {
						const message = childSnapshot.val();
						if (message.sendFrom === lastMessage.sendFrom && message.sendTo === loggedToken && message.readed === 0) {
							database.ref("abc-messages").child(childSnapshot.key).update({
								readed: 1
							});
						}
					})
				})
				renderCol_3(otherUserKey);
			});
		}
	}
}

async function renderCol_3(k) {
	const dataUser = await database.ref("abc").child(k).once("value");
	const dataMess = await database.ref("abc-messages").orderByChild("timeamp").once("value");
	let messageList = "";
	let messageStatus = false;
	dataMess.forEach((childSnapshot) => {
		const message = childSnapshot.val();
		if ((message.sendFrom === loggedToken && message.sendTo === k) || (message.sendFrom === k && message.sendTo === loggedToken)) {
			messageStatus = true;
			const messageClass = message.sendFrom === loggedToken ? "item r" : "item";
			messageList += `
				<div class="${messageClass}" data-message="${childSnapshot.key}">
					<div class="itemm">${entities(message.contents)}</div>
					<span class="timeamp">${formatTimeAgo(message.timeamp)}</span>
				</div>
			`;
		}
	});
	if (!messageStatus) {
		messageList = `<span class="null-messages">Chưa có tin nhắn nào.</span>`;
	}
	document.getElementById("col-3").innerHTML = `
		<div id="col-3-row-1">
			<div class="${dataUser.val().online == '1' ? 'thumb online' : 'thumb'}">
				<img src="https://hiepdeep.github.io/library/pictures/512/${randomInt(1, 32)}.png">
			</div>
			<div class="displayName">
				<a href="javascript:;">${dataUser.val().displayName}</a>
				<span class="timeStatus">${dataUser.val().online == "1" ? "Online" : "Offline"}</span>
			</div>
		</div>
		<div id="col-3-row-2">${messageList}</div>
		<div id="col-3-row-3">
			<form action="" id="form-chat">
				<input type="text" name="text-message" placeholder="Aa">
				<button btn-style blue class="material-symbols-rounded" type="submit">arrow_upward</button>
			</form>
		</div>
	`;
	const formChat = document.forms["form-chat"];
	if (formChat) {
		const textMessage = formChat["text-message"];
		let sendValue = "";
		textMessage.addEventListener("input", function(event) {
			event.preventDefault();
			sendValue = entities(textMessage.value.trim());
		});
		formChat.addEventListener("submit", async function(event) {
			event.preventDefault();
			if (sendValue.length > 0) {
				database.ref(`abc-messages`).push({
					sendFrom: loggedToken,
					sendTo: k,
					contents: entities(sendValue),
					readed: 0,
					timeamp: createTimes()
				}).then(() => {
					console.error("Gửi tin nhắn thành công.");
				}).catch((error) => {
					console.error("Có lỗi khi gửi tin nhắn:", error);
				});
				sendValue = "";
				formChat.reset();
			} else {
				alert("Vui lòng nhập tin nhắn.");
			}
		});
	}
	document.getElementById("col-3-row-2").scrollTop = document.getElementById("col-3-row-2").scrollHeight;
}

database.ref("abc-messages").on("child_added", (snapshot) => {
	const message = snapshot.val();
	const messageList = document.querySelector("#col-3-row-2");
	if (!messageList) {
		return;
	}
	if (message.sendFrom === loggedToken || message.sendTo === loggedToken) {
		const nullMessage = messageList.querySelector(".null-messages");
		if (nullMessage) {
			nullMessage.remove();
		}
		const messageBlock = document.createElement("div");
		messageBlock.className = message.sendFrom === loggedToken ? "item r" : "item";
		messageBlock.innerHTML = `
			<div class="itemm">${entities(message.contents)}</div>
			<span class="timeamp">${formatTimeAgo(message.timeamp)}</span>
		`;
		messageList.appendChild(messageBlock);
		messageList.scrollTop = messageList.scrollHeight;
		renderCol_2();
	}
});

