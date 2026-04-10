const app = require('./service.js');
const metrics = require('./metrics');

const port = process.argv[2] || 80;

metrics.start(5000);

app.listen(port, '0.0.0.0', () => {
  console.log(`Server started on port ${port}`);
});