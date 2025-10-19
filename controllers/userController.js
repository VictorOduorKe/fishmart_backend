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
import { json } from "stream/consumers";
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

  // ✅ Ensure both email and password are provided
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

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
    await db.query(
      "UPDATE jwt_tokens SET token = ? WHERE user_id = ?",
      [refreshToken, user.id]
    );

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

// ✅ Allowed image types
const allowedTypes = /jpeg|jpg|png/;

// ✅ File type validation
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (!allowedTypes.test(ext) || !allowedTypes.test(mime)) {
    return cb(new Error("Only .jpg, .jpeg, or .png files are allowed!"));
  }

  cb(null, true);
};

// ✅ Limit file size to 2MB (2 * 1024 * 1024 bytes)
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});


// === Register business function ===



export const registerBusiness = async (req, res) => {
  try {
    const {
      business_name,
      business_email,
      id_number,
      business_license,
      business_address,
      business_phone,
    } = req.body;

    // Step 1: Ensure files are present
    if (!req.files?.id_image || !req.files?.address_proof) {
      return res
        .status(400)
        .json({ message: "Files (ID and Address proof) are required." });
    }

    // Step 2: Find user_id from users table using business_email
    const [userResult] = await db.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [business_email]
    );

    if (userResult.length === 0) {
      return res
        .status(404)
        .json({ message: "User with that email not found." });
    }

    const user_id = userResult[0].id;

    //----- Check if user with that email already has a business account ----//
const [businessResult] = await db.query(
  "SELECT id FROM business WHERE business_email = ? LIMIT 1",
  [business_email]
);

if (businessResult.length > 0) {
  return res.status(409).json({
    message: "A business with that email already exists.",
  });
}

    // Step 3: Upload both files to HostPinnacle
    const idImageUrl = await uploadToHostPinnacle(
      req.files.id_image[0].path,
      req.files.id_image[0].filename
    );

    const addressProofUrl = await uploadToHostPinnacle(
      req.files.address_proof[0].path,
      req.files.address_proof[0].filename
    );

    // Step 4: Insert into businesses table
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
        addressProofUrl,
      ]
    );

    // ✅ Step 5: Update user role to 'seller'
    await db.query("UPDATE users SET user_role = 'seller' WHERE id = ?", [
      user_id,
    ]);

    // Step 6: Respond to frontend
    res.status(201).json({
      message: "✅ Business registered successfully",
      business_id: result.insertId,
      user_id,
      id_image: idImageUrl,
      address_proof: addressProofUrl,
    });
  } catch (error) {
    console.error("❌ registerBusiness error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};



export const fetchBusinessDetails = async (req, res) => {
  try {
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

    // Normalize file URLs (don’t double-prefix if already absolute)
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
      id_image: business.id_image?.startsWith("http")
        ? business.id_image
        : `${req.protocol}://${req.get("host")}${business.id_image}`,
      address_proof: business.address_proof?.startsWith("http")
        ? business.address_proof
        : `${req.protocol}://${req.get("host")}${business.address_proof}`,
    }));

    res.status(200).json(businesses);
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


export const fetchSingleBusiness = async (req, res) => {
  try {
    const user_id = req.user?.id;
    const role = req.user?.role;

    // 🔒 Check authentication and role
    if (!user_id) {
      return res.status(401).json({ message: "Unauthorized: Missing user ID" });
    }

    if (role !== "seller" && role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Access denied" });
    }

    // 🧠 Fetch the business data
    const [rows] = await db.query(
      "SELECT business_name, business_phone, status FROM businesses WHERE user_id = ? LIMIT 1",
      [user_id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "No business found for this user" });
    }

    const business = {
      name: rows[0].business_name,
      phone: rows[0].business_phone,
      status: rows[0].status,
    };

    // ✅ Success
    return res.status(200).json({
      success: true,
      business,
    });
  } catch (error) {
    console.error("❌ Business fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching business",
      error: error.message,
    });
  }
};
