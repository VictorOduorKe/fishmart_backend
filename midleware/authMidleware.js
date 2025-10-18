import jwt from "jsonwebtoken";
import db from "../config/db.js"; // adjust import

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔍 Check if refresh token still exists for this user (optional but strong)
    const [rows] = await db.query("SELECT token FROM jwt_tokens WHERE user_id = ?", [decoded.id]);
    if (!rows[0] || !rows[0].token) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token has expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
};


export const getProfile = (req, res) => {
  // protect runs before this
  const user = req.user;

  res.status(200).json({
    message: "User details fetched successfully",
    user,
  });
};
