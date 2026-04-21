console.clear();

const data = [
	{
		"website": "accounts.google.com",
		"username": "vanhiepofficial@gmail.com",
		"password": "Hiepdz!992"
	},
	{
		"website": "auth.riotgames.com",
		"username": "hiepdeep",
		"password": "Ngovanhiep2000"
	},
	{
		"website": "codepen.io",
		"username": "hiepdeep",
		"password": "Ngovanhiep2000"
	},
	{
		"website": "github.com",
		"username": "vanhiepofficial@gmail.com",
		"password": "HieNv@992"
	},
	{
		"website": "gitlab.com",
		"username": "hiedev",
		"password": "Ngovanhieo2000"
	},
	{
		"website": "facebook.com",
		"username": "hiepdeep",
		"password": "m@tkh@u.fb.0099"
	}
]

let tb = "";

for (let i in data) {
	console.log( data[i] );
	tb += `<tr>`;
		tb += `<td>${data[i].website}</td>`;
		tb += `<td>${data[i].username}</td>`;
		tb += `<td>${data[i].password}</td>`;
	tb += `</tr>`;
}

document.getElementById("table").innerHTML += tb;