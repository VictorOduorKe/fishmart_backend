import express from "express";
import multer from "multer";
import path from "path";
import { 
  registerUser, 
  loginUser, 
  registerBusiness, 
  logOutUser, 
  fetchBusinessDetails,
  fetchSingleBusiness
} from "../controllers/userController.js";
import { protect, getProfile } from "../midleware/authMidleware.js";

const router = express.Router();

// === Multer setup ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/business/"); // Folder where files are stored
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// === Routes ===
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getProfile);
router.get("/businesses", fetchBusinessDetails);
router.get("/business",protect, fetchSingleBusiness);
router.get('/logout',protect,logOutUser)
// 👇 Add upload middleware here
router.post(
  "/register-business",
  upload.fields([
    { name: "id_image", maxCount: 1 },
    { name: "address_proof", maxCount: 1 },
  ]),
  registerBusiness
);

router.post("/logout", protect, logOutUser);

export default router;
