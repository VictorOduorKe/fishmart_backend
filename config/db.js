// config/db.js
require("dotenv").config();
const mysql = require("mysql2");

// ✅ Create a regular pool
const pool = mysql.createPool({
  host: process.env.ALWAYSDATA_HOST,
  user: process.env.ALWAYSDATA_USER,
  password: process.env.ALWAYSDATA_PASSWORD,
  database: process.env.ALWAYSDATA_DB,
  port: process.env.ALWAYSDATA_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ✅ Wrap the pool with .promise() to use async/await or .then()
const promisePool = pool.promise();

// ✅ Test the connection
(async () => {
  try {
    const connection = await promisePool.getConnection();
    console.log("✅ MySQL Pool Connected!");
    connection.release();
  } catch (err) {
    console.error("❌ MySQL Connection Error:", err.message);
  }
})();

module.exports = promisePool;
