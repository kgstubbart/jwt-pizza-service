const request = require("supertest");
const app = require("../service");
const { setAuth } = require("./authRouter.js");
const { DB, Role } = require("../database/database.js");

function randomName() {
	return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
	let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
	user.name = randomName();
	user.email = user.name + "@admin.com";

	user = await DB.addUser(user);
	return { ...user, password: "toomanysecrets" };
}

let admin;
let adminToken;
let diner;
let dinerToken;

beforeAll(async () => {
	admin = await createAdminUser();
	adminToken = await setAuth(admin);

	diner = {
		name: randomName(),
		email: randomName() + "@diner.com",
		password: "dinerpassword",
	};
	const registerRes = await request(app).post("/api/auth").send(diner);
	dinerToken = registerRes.body.token;
});

test('get menu', async () => {
    const menuRes = await request(app)
        .get('/api/order/menu')
    expect(menuRes.status).toBe(200);
    expect(Array.isArray(menuRes.body)).toBe(true);
});
