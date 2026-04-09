const app = require('./service.js');
const metrics = require('./metrics');

const port = process.argv[2] || 80;
app.use((req, res, next) => metrics.requestTracker(req, res, next));
metrics.start(5000);
app.listen(port, '0.0.0.0', () => {
  console.log(`Server started on port ${port}`);
});