const mysql = require("mysql2");
require("dotenv").config(); // Make sure this line is here

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: process.env.DB_CONNECTION_LIMIT || 10,
  queueLimit: process.env.DB_QUEUE_LIMIT || 0,
});

module.exports = pool.promise();
