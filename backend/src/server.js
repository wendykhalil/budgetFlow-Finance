require('dotenv').config();

const app = require('./app');
const { connectDB } = require('./config/database');

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`BudgetFlow API is running on port ${port}.`);
});

// Keep HTTP available if MongoDB is not configured or cannot be reached.
connectDB();
