import express from "express";
import { registerUser, loginUser,registerBusiness,logOutUser } from "../controllers/userController.js";
import { protect, getProfile } from "../midleware/authMidleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getProfile);
router.post("/register-business", protect, registerBusiness);
router.post("/logout", protect, logOutUser);
export default router;
