const express =require("express");
const { registerUser, loginUser,registerBusiness } =require("../controllers/userController");
const { protect, getProfile } =require("../midleware/authMidleware");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getProfile);
router.post("/register-business", protect, registerBusiness);

module.exports = router;
