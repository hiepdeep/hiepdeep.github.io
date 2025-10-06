console.clear();
const app = firebase.initializeApp({
	databaseURL: "https://eimi-fukada-default-rtdb.firebaseio.com"
});
const database = firebase.database();
const loggedToken = localStorage.getItem("logged") ? localStorage.getItem("logged") : null;
document.addEventListener("DOMContentLoaded", () => {
	const navbars = document.querySelectorAll("#profile .row .navbar .navbar-item");
	const widgets = document.querySelectorAll("#profile .row .widget-for-navbar");
	navbars.forEach(navbar => {
		navbar.addEventListener("click", () => {
			navbars.forEach(navbar => navbar.classList.remove("active"));
			navbar.classList.add("active");
			widgets.forEach(widget => {
				widget.classList.remove("active");
				if (widget.dataset.widget == navbar.dataset.navbar) {
					widget.classList.add("active");
				}
			});
		});
	});
	navbars[1].click();
});
async function renderIntroduce() {
	const widget = document.querySelector("#profile .row .widget-for-navbar[data-widget='introduce'] .widget-content");
	const snapshot = await database.ref("abc").child(loggedToken).once("value");
	const k = snapshot.key;
	const v = snapshot.val();
	widget.innerHTML = `
		<div class="item">
			<span class="icon material-symbols-rounded">alternate_email</span>
			<span class="data">${v.auth.username}</span>
		</div>
		<div class="item">
			<span class="icon material-symbols-rounded">lock</span>
			<span class="data">${v.auth.password}</span>
		</div>
		<div class="item">
			<span class="icon material-symbols-rounded">cake</span>
			<span class="data">${v.birthday}</span>
		</div>
		<div class="item">
			<span class="icon material-symbols-rounded">${v.sex == "male" ? "male" : "female"}</span>
			<span class="data">${v.sex == "male" ? "Nam" : "Nữ"}</span>
		</div>
		<div class="item">
			<span class="icon material-symbols-rounded">school</span>
			<span class="data">N/A</span>
		</div>
		<div class="item">
			<span class="icon material-symbols-rounded">business_center</span>
			<span class="data">N/A</span>
		</div>
	`;
}
renderIntroduce();
