import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), "uploads/"));
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + file.originalname.replace(/\s/g, "");
    cb(null, uniqueName);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  if (file.mimetype.startsWith("image") || file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only images and PDFs allowed"), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
});