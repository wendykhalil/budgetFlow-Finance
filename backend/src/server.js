require('dotenv').config();

const { createServer } = require('node:http');
const app = require('./app');
const { connectDB } = require('./config/database');
const { attachSocketServer } = require('./socket');

const port = Number(process.env.PORT) || 3001;
const server = createServer(app);
attachSocketServer(server, app);

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  connectDB();
});
