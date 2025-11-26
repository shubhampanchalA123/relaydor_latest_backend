import multer from "multer";
import path from "path";
import fs from "fs";

// Storage Engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder = "";
    if (file.fieldname === "profileImage") {
      folder = path.join("public", "upload", "images");
    } else {
      // All other fields (documents) go to docs folder
      folder = path.join("public", "upload", "docs");
    }
    // Ensure directory exists
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "-" + file.fieldname + ext);
  },
});

// File Filter (Only PDFs, Images)
const fileFilter = (req, file, cb) => {
  const allowed = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Invalid file type"), false);
};

const upload = multer({ storage, fileFilter });

export default upload;
