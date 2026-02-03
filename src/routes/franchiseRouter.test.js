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