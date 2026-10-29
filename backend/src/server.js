require('dotenv').config();

const app = require('./app');
const { connectDB } = require('./config/database');

const port = Number(process.env.PORT) || 3001;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  connectDB();
});
