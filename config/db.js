const  mysql =require("mysql2");

require("dotenv").config();

const db = mysql.createConnection({
  host: process.env.ALWAYSDATA_HOST,
  user: process.env.ALWAYSDATA_USER,
  password: process.env.ALWAYSDATA_PASSWORD,
  database: process.env.ALWAYSDATA_DB,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("✅ MySQL Connected!");
  }
});

module.exports = db;