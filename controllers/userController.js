const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
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
const registerBusiness = async (req, res) => {
  const {
    email,
    business_name,
    business_address,
    business_phone,
    business_email,
    id_number,
    id_image,
    business_license,
  } = req.body;

  if (!email || !business_name || !business_address || !business_phone || !business_email || !id_number || !id_image)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const [userResults] = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (userResults.length === 0)
      return res.status(404).json({ message: "User not found. Please register first." });

    const user_id = userResults[0].id;
    const [existing] = await db.query("SELECT id FROM businesses WHERE user_id = ?", [user_id]);
    if (existing.length > 0)
      return res.status(400).json({ message: "User already registered a business." });

    const uploadDir = path.join(__dirname, "../uploads/business");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const downloadImage = async (url, filename) => {
      const response = await axios.get(url, { responseType: "arraybuffer" });
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, response.data);
      return `/uploads/business/${filename}`;
    };

    const idImageName = `id_${Date.now()}.jpg`;
    const idImagePath = await downloadImage(id_image, idImageName);

    let licenseImagePath = null;
    if (business_license) {
      const licenseImageName = `license_${Date.now()}.jpg`;
      licenseImagePath = await downloadImage(business_license, licenseImageName);
    }

    const insertSql = `
      INSERT INTO businesses (
        user_id, business_name, business_address, business_phone,
        business_email, id_number, id_image, business_license
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(insertSql, [
      user_id,
      business_name,
      business_address,
      business_phone,
      business_email,
      id_number,
      idImagePath,
      licenseImagePath,
    ]);

    return res.status(201).json({
      message: "Business registered successfully",
      business_id: result.insertId,
      status: "pending",
    });
  } catch (error) {
    console.error("❌ registerBusiness error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
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
