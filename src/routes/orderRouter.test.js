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

test('admin add menu item', async () => {
    const newItem ={ title: 'Test Item ' + randomName(), description: 'A test menu item', image:'test.png', price: 2.23 };
    const addMenuRes = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newItem);
    expect(addMenuRes.status).toBe(200);
    expect(addMenuRes.body.find(item => item.title === newItem.title)).toMatchObject(newItem);
});

test('diner get orders', async () => {
    const ordersRes = await request(app)
        .get('/api/order')
        .set('Authorization', `Bearer ${dinerToken}`);
    expect(ordersRes.status).toBe(200);
    expect(ordersRes.body).toBeDefined();
});