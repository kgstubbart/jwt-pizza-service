const request = require('supertest');
const app = require('../service');
const { setAuth } = require('./authRouter.js');
const { Role, DB } = require('../database/database.js');

let admin;
let adminToken;
let dinerToken;

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

beforeAll(async () => {
    admin = await createAdminUser();
    adminToken = await setAuth(admin);
    const diner = { name: randomName(), email: randomName() + '@diner.com', password: 'dinerpassword' };
    const registerRes = await request(app).post('/api/auth').send(diner);
    dinerToken = registerRes.body.token;
});

test('admin create franchise', async () => {
    const name = 'Franchise ' + randomName();
    const franchiseResponse = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, admins: [{ email: admin.email }] });
    
    expect(franchiseResponse.status).toBe(200);
    expect(franchiseResponse.body.name).toBe(name);
    expect(Array.isArray(franchiseResponse.body.admins)).toBe(true);
});

test('admin creates a store for franchise', async () => {
    const name = 'Franchise ' + randomName();
    const franchiseResponse = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, admins: [{ email: admin.email }] });
    expect(franchiseResponse.status).toBe(200);

    const franchiseId = franchiseResponse.body.id;
    const storeResponse = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Store ' + randomName() });

    expect(storeResponse.status).toBe(200);
    expect(storeResponse.body.name).toMatch(/Store /);
});

