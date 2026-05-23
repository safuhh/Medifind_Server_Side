import express from "express"
import { mostselingproductsinpharmacy } from "../controllers/sellercontroller/mostselleingproduct.js"
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router()

router.get("/mostselingproductsinpharmacy/:sellerId",protect,mostselingproductsinpharmacy)

export default router;