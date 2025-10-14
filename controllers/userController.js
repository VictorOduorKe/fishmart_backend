const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const multer = require("multer");
require("dotenv").config();
const db = require("../config/db"); // This is your pool.promise()

/** =========================
 *  REGISTER USER
 * ========================= */
const registerUser = async (req, res) => {
  const { full_name, email, phone, password, confirm_password } = req.body;

  // ✅ Validate inputs
  if (!full_name || !email || !phone || !password || !confirm_password)
    return res.status(400).json({ message: "All fields are required" });

  if (password.length < 8)
    return res.status(400).json({ message: "Password must be at least 8 characters long" });

  if (password !== confirm_password)
    return res.status(400).json({ message: "Passwords do not match" });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ message: "Invalid email format" });

  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(phone))
    return res.status(400).json({ message: "Invalid phone number format (e.g., +2547123456)" });

  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password))
    return res.status(400).json({
      message:
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character and be at least 8 characters long",
    });

  try {
    // 🔍 Check if user exists
    const [existingUser] = await db.query(
      "SELECT email, phone FROM users WHERE email = ? OR phone = ? LIMIT 1",
      [email, phone]
    );

    if (existingUser.length > 0) {
      if (existingUser[0].email === email)
        return res.status(400).json({ message: "User with this email already exists" });
      if (existingUser[0].phone === phone)
        return res.status(400).json({ message: "User with this phone number already exists" });
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🧑‍💻 Insert user
    const [result] = await db.query(
      "INSERT INTO users (full_name, email, phone, password) VALUES (?, ?, ?, ?)",
      [full_name, email, phone, hashedPassword]
    );

    // 💾 Initialize JWT record
    await db.query("INSERT INTO jwt_tokens (user_id, token) VALUES (?, ?)", [result.insertId, ""]);

    return res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("❌ registerUser error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/** =========================
 *  LOGIN USER
 * ========================= */
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT id, full_name, email, password, user_role FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    // 🪙 Create tokens
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, full_name: user.full_name, role: user.user_role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { id: user.id, email: user.email, role: user.user_role },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    // 💾 Store refresh token
    await db.query("UPDATE jwt_tokens SET token = ? WHERE user_id = ?", [refreshToken, user.id]);

    return res.json({
      message: "Login successful",
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.user_role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("❌ loginUser error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/** =========================
 *  REGISTER BUSINESS
 * ========================= */
// === Setup multer for file uploads ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "business");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// === Register business function ===
export const registerBusiness = async (req, res) => {
  try {
    const {
      business_name,
      business_license,
      business_address,
      business_phone,
      business_email,
      id_number,
    } = req.body;

    // Step 1: Get user_id using business_email
    const [userRows] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [business_email]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found for the provided email." });
    }

    const user_id = userRows[0].id;

    // Step 2: Validate required fields
    if (
      !business_name ||
      !business_license ||
      !business_address ||
      !business_phone ||
      !business_email ||
      !id_number ||
      !req.files?.id_image ||
      !req.files?.address_proof
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Step 3: Check if the business already exists for this user
    const [existingBusiness] = await db.query(
      "SELECT id FROM businesses WHERE user_id = ? LIMIT 1",
      [user_id]
    );

    if (existingBusiness.length > 0) {
      return res.status(400).json({ message: "Business already registered for this user." });
    }

    // Step 4: Extract uploaded file paths
    const id_image = `/uploads/business/${req.files.id_image[0].filename}`;
    const address_proof = `/uploads/business/${req.files.address_proof[0].filename}`;

    // Step 5: Insert business record
    const insertSql = `
      INSERT INTO businesses (
        user_id, business_name, business_license, business_address,
        business_phone, business_email, id_number, id_image, address_proof
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(insertSql, [
      user_id,
      business_name,
      business_license,
      business_address,
      business_phone,
      business_email,
      id_number,
      id_image,
      address_proof,
    ]);

    return res.status(201).json({
      message: "Business registered successfully",
      business_id: result.insertId,
      status: "pending",
    });

  } catch (error) {
    console.error("❌ registerBusiness error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


/** =========================
 *  LOGOUT USER
 * ========================= */
const logOutUser = async (req, res) => {
  const userId = req.user?.id;
  if (!userId)
    return res.status(401).json({ message: "Unauthorized: No user found" });

  try {
    const [result] = await db.query("UPDATE jwt_tokens SET token = NULL WHERE user_id = ?", [userId]);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "No token found for this user" });

    console.log(`✅ User ${userId} logged out successfully`);
    return res.status(200).json({ message: "User logged out successfully" });
  } catch (error) {
    console.error("❌ logOutUser error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { registerUser, loginUser, registerBusiness, logOutUser };
