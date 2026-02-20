const request = require("supertest");
const app = require("../service");

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = randomName() + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

test('list users unauthorized', async () => {
  const listUsersRes = await request(app).get('/api/user');
  expect(listUsersRes.status).toBe(401);
});

test('list users', async () => {
  const [user, userToken] = await registerUser(request(app));
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + userToken);
  expect(listUsersRes.status).toBe(200);
});

test('list users returns list', async () => {
  const [user1, userToken] = await registerUser(request(app));
  const [user2] = await registerUser(request(app));
  const [user3] = await registerUser(request(app));

  const listUsersRes = await request(app)
    .get('/api/user?page=1&limit=10&name=*')
    .set('Authorization', 'Bearer ' + userToken);
  console.log(listUsersRes.body);
  expect(listUsersRes.status).toBe(200);
  expect(listUsersRes.body).toHaveProperty('users');
  expect(Array.isArray(listUsersRes.body.users)).toBe(true);

  expect(listUsersRes.body.users.length).toBeGreaterThanOrEqual(3);

  const emails = listUsersRes.body.users.map(u => u.email);
  expect(emails).toEqual(expect.arrayContaining([user1.email, user2.email, user3.email]));

  if (listUsersRes.body.users.length > 0) {
    const user = listUsersRes.body.users[0];
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('roles');
  }
});

test('list users paginates and sets more=true when there are more results', async () => {
  const [u, token] = await registerUser(request(app));
  for (let i = 0; i < 12; i++) await registerUser(request(app));

  const res = await request(app)
    .get('/api/user?page=1&limit=10&name=*')
    .set('Authorization', 'Bearer ' + token);

  expect(res.status).toBe(200);
  expect(res.body.users).toHaveLength(10);
  expect(res.body.more).toBe(true);
});

test('list users sets more=false on last page', async () => {
  const service = request(app);
  const [u, token] = await registerUser(service);

  const prefix = `zz-${randomName()}`;

  // create exactly 7 users with that prefix
  for (let i = 0; i < 7; i++) {
    await service.post('/api/auth').send({
      name: `${prefix}-${i}`,
      email: `${randomName()}@t.com`,
      password: 'a',
    });
  }

  const page1 = await service
    .get(`/api/user?page=1&limit=5&name=${prefix}`)
    .set('Authorization', 'Bearer ' + token);
  expect(page1.status).toBe(200);
  expect(page1.body.users).toHaveLength(5);
  expect(page1.body.more).toBe(true);

  const page2 = await service
    .get(`/api/user?page=2&limit=5&name=${prefix}`)
    .set('Authorization', 'Bearer ' + token);
  expect(page2.status).toBe(200);
  expect(page2.body.users).toHaveLength(2);
  expect(page2.body.more).toBe(false);
});

test('list users filters by name', async () => {
  const service = request(app);
  const [u, token] = await registerUser(service);

  await service.post('/api/auth').send({ name: 'Kai Chen', email: `${randomName()}@t.com`, password: 'a' });
  await service.post('/api/auth').send({ name: 'Buddy', email: `${randomName()}@t.com`, password: 'a' });

  const res = await service
    .get('/api/user?page=1&limit=10&name=Kai')
    .set('Authorization', 'Bearer ' + token);

  expect(res.status).toBe(200);
  expect(res.body.users.length).toBeGreaterThan(0);
  expect(res.body.users.every(u => u.name.includes('Kai'))).toBe(true);
});

test('delete user', async () => {
  const service = request(app);
  const [user] = await registerUser(service);
  const deleteRes = await service
    .delete(`/api/user/${user.id}`)
    .set('Authorization', 'Bearer ' + testUserAuthToken);
  expect(deleteRes.status).toBe(200);

  const listRes = await service
    .get('/api/user?page=1&limit=10&name=*')
    .set('Authorization', 'Bearer ' + testUserAuthToken);
  expect(listRes.body.users.some(u => u.id === user.id)).toBe(false);
});

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}
