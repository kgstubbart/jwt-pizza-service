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
  expect(listUsersRes.status).toBe(200);
  expect(listUsersRes.body).toHaveProperty('users');
  expect(Array.isArray(listUsersRes.body.users)).toBe(true);

  if (listUsersRes.body.users.length > 0) {
    const user = listUsersRes.body.users[0];
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('roles');
  }
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
