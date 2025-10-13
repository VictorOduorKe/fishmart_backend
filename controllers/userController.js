const  db =require("../config/db");
const  bcrypt =require("bcrypt");
const  jwt =require("jsonwebtoken");
require("dotenv").config();

 const registerUser = async (req, res) => {
  const { full_name, email, phone, password, confirm_password } = req.body;

  // Validate fields
  if (!full_name || !email || !phone || !password || !confirm_password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters long" });
  }

  if (password !== confirm_password) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(phone)) {
    return res
      .status(400)
      .json({ message: "Invalid phone number format (e.g., +1234567890)" });
  }

  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      message:
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    });
  }

  try {
    // Check if user with same email or phone already exists
    const checkUserQuery = "SELECT email, phone FROM users WHERE email = ? OR phone = ? LIMIT 1";
    db.query(checkUserQuery, [email, phone], async (err, results) => {
      if (err) {
        console.error("Error checking user existence:", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      if (results.length > 0) {
        const existingUser = results[0];
        if (existingUser.email === email) {
          return res.status(400).json({ message: "User with this email already exists" });
        }
        if (existingUser.phone === phone) {
          return res.status(400).json({ message: "User with this phone number already exists" });
        }
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Insert user
      const insertUserQuery =
        "INSERT INTO users (full_name, email, phone, password) VALUES (?, ?, ?, ?)";
      db.query(insertUserQuery, [full_name, email, phone, hashedPassword], (err, result) => {
        if (err) {
          console.error("Error inserting user:", err);
          return res.status(500).json({ message: "Internal server error" });
        }

        // Initialize JWT record
        const insertTokenSql = "INSERT INTO jwt_tokens (user_id, token) VALUES (?, ?)";
        db.query(insertTokenSql, [result.insertId, ""], (err) => {
          if (err) {
            console.error("Error initializing JWT token record:", err);
          }
        });

        return res.status(201).json({ message: "User registered successfully" });
      });
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};




 const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT email, password, id FROM users WHERE email = ? LIMIT 1";

  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0)
      return res.status(404).json({ message: "User not found" });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    // Create access token (short-lived)
    const accessToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // Create refresh token (longer-lived)
    const refreshToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    // Optionally store the refresh token in DB (recommended for security)
    const updateTokenSql = "UPDATE jwt_tokens SET token=? WHERE user_id=?";
    db.query(updateTokenSql, [refreshToken, user.id]);

    res.json({
      message: "Login successful",
      accessToken,
      refreshToken,
    });
  });
};

module.exports = { registerUser, loginUser };