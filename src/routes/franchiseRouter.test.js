const request = require('supertest');
const app = require('../service');
const { setAuth } = require('./authRouter.js');
const { Role, DB } = require('../database/database.js');

let admin;
let adminToken;

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

test('list franchises', async () => {
    const response = await request(app)
        .get('/api/franchise')
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.franchises)).toBe(true);
});

test('delete franchise', async () => {
    const name = 'Franchise ' + randomName();
    const franchiseResponse = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, admins: [{ email: admin.email }] });
    expect(franchiseResponse.status).toBe(200);

    const deleteResponse = await request(app)
        .delete(`/api/franchise/${franchiseResponse.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({ message: 'franchise deleted' });
});

test('delete store', async () => {
    const name = 'Franchise ' + randomName();
    const franchiseResponse = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, admins: [{ email: admin.email }] });
    expect(franchiseResponse.status).toBe(200);
    const franchiseId = franchiseResponse.body.id;
    expect(franchiseId).toBeDefined();

    const storeResponse = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Store ' + randomName() });

    expect(storeResponse.status).toBe(200);
    expect(storeResponse.body.name).toMatch(/Store /);
    const storeId = storeResponse.body.id ?? storeResponse.body.storeId ?? (storeResponse.body.store && storeResponse.body.store.id);
    expect(storeId).toBeDefined();

    const deleteStoreResponse = await request(app)
        .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteStoreResponse.status).toBe(200);
    expect(deleteStoreResponse.body).toEqual({ message: 'store deleted' });
});
