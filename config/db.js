const mysql = require("mysql2");
require("dotenv").config();

let db;

function handleDisconnect() {
  db = mysql.createConnection({
    host: process.env.ALWAYSDATA_HOST,
    user: process.env.ALWAYSDATA_USER,
    password: process.env.ALWAYSDATA_PASSWORD,
    database: process.env.ALWAYSDATA_DB,
  });

  db.connect((err) => {
    if (err) {
      console.error("❌ Database connection failed:", err);
      setTimeout(handleDisconnect, 2000); // retry after 2 seconds
    } else {
      console.log("✅ MySQL Connected!");
    }
  });

  db.on("error", (err) => {
    console.error("⚠️ MySQL error:", err);
    if (err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "ECONNRESET") {
      console.log("🔁 Reconnecting to MySQL...");
      handleDisconnect();
    } else {
      throw err;
    }
  });
}

handleDisconnect();

module.exports = db;
