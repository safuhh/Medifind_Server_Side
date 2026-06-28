import express from "express";
import {
  createSearchRecord,
  getSearchHistory,
  toggleFavoriteSearch,
  deleteSearchRecord,
} from "../controllers/searchHistory.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createSearchRecord);
router.get("/", getSearchHistory);
router.put("/:id/favorite", toggleFavoriteSearch);
router.delete("/:id", deleteSearchRecord);

export default router;
