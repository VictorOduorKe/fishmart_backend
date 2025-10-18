import multer from "multer";
import path from "path";
import fs from "fs";

// === Allowed file types ===
const allowedTypes = /jpeg|jpg|png|pdf/;

// === Configure multer storage ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), "uploads", "business");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}_${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// === File filter (type check) ===
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;
  const isValid = allowedTypes.test(ext) && allowedTypes.test(mimeType);

  if (isValid) {
    cb(null, true);
  } else {
    cb(new Error("❌ Invalid file type. Only .jpg, .jpeg, .png, .pdf are allowed."));
  }
};

// === Upload configuration with limits ===
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // ⛔ Limit each file to 2MB
  },
});
