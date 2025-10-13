import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();

const db = mysql.createConnection({
  host: process.env.FISHMART_DB_HOST,
  user: process.env.FISHMART_DB_USER,
  password: process.env.FISHMART_DB_PASSWORD,
  database: process.env.FISHMART_DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("✅ MySQL Connected!");
  }
});

export default db;
