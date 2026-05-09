const multer = require("multer");
const path = require("path");

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel"
    ];
    const allowedExtensions = [".xlsx", ".xls"];
    const extension = path.extname(file.originalname || "").toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(extension)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files are allowed"));
    }
  }
});

module.exports = upload;
