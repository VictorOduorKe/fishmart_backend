import  bcrypt from "bcrypt";
import  jwt from  "jsonwebtoken";
import  fs from  "fs";
import  path from "path";
import  axios from  "axios";
import  multer from  "multer";
import  dotenv from  "dotenv";
dotenv.config();
import  db from  "../config/db.js"; // This is your pool.promise()
import ftp from "basic-ftp";
import { uploadToHostPinnacle } from "../utils/ftpUploads.js";
/** =========================
 *  REGISTER USER
 * ========================= */
export const registerUser = async (req, res) => {
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
export const loginUser = async (req, res) => {
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
export const storage = multer.diskStorage({
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
    const { business_name, business_email, id_number, business_license, business_address, business_phone } = req.body;

    if (!req.files?.id_image || !req.files?.address_proof) {
      return res.status(400).json({ message: "Files are required" });
    }

    // Upload images to HostPinnacle
    const idImageUrl = await uploadToHostPinnacle(
      req.files.id_image[0].path,
      req.files.id_image[0].filename
    );

    const addressProofUrl = await uploadToHostPinnacle(
      req.files.address_proof[0].path,
      req.files.address_proof[0].filename
    );

    // Insert business info into your database with URLs
    const [result] = await db.query(
      `INSERT INTO businesses
       (user_id, business_name, business_license, business_address, business_phone, business_email, id_number, id_image, address_proof)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        business_name,
        business_license,
        business_address,
        business_phone,
        business_email,
        id_number,
        idImageUrl,
        addressProofUrl
      ]
    );

    res.status(201).json({
      message: "Business registered successfully",
      business_id: result.insertId,
      id_image: idImageUrl,
      address_proof: addressProofUrl
    });

  } catch (error) {
    console.error("❌ registerBusiness error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


export const fetchBusinessDetails = async (req, res) => {
  try {
    // Fetch all business records
    const [results] = await db.query(`
      SELECT 
        b.id,
        b.business_name,
        b.business_license,
        b.business_address,
        b.business_phone,
        b.business_email,
        b.id_number,
        b.id_image,
        b.address_proof,
        b.status,
        u.full_name AS owner_name,
        u.email AS owner_email
      FROM businesses AS b
      JOIN users AS u ON b.user_id = u.id
      ORDER BY b.id DESC
    `);

    if (results.length === 0) {
      return res.status(404).json({ message: "No businesses found." });
    }

    // Build full URLs for uploaded files
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const businesses = results.map((business) => ({
      id: business.id,
      business_name: business.business_name,
      business_license: business.business_license,
      business_address: business.business_address,
      business_phone: business.business_phone,
      business_email: business.business_email,
      id_number: business.id_number,
      status: business.status,
      owner_name: business.owner_name,
      owner_email: business.owner_email,
      id_image: business.id_image
        ? `${baseUrl}${business.id_image}`
        : null,
      address_proof: business.address_proof
        ? `${baseUrl}${business.address_proof}`
        : null,
    }));

    return res.status(200).json(businesses);
  } catch (error) {
    console.error("❌ fetchBusinessDetails error:", error);
    res.status(500).json({
      message: "An error occurred while fetching business details",
      error: error.message,
    });
  }
};

/** =========================
 *  LOGOUT USER
 * ========================= */
export const logOutUser = async (req, res) => {
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

