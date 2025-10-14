const mysql = require("mysql2");
require("dotenv").config(); // Make sure this line is here

const pool = mysql.createPool({
  host: process.env.ALWAYSDATA_HOST,
  user: process.env.ALWAYSDATA_USER,
  password: process.env.ALWAYSDATA_PASSWORD,
  database: process.env.ALWAYSDATA_DB,
  waitForConnections: true,
  connectionLimit: process.env.ALWAYSDATA_CONNECTION_LIMIT || 10,
  queueLimit: process.env.ALWAYSDATA_QUEUE_LIMIT || 0,
});

module.exports = pool.promise();
