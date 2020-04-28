import { Router } from "express";
import twitterAuthRoutes from "./twitterAuth";
import apiRoutes from "./api";
const router = Router();

router.use("/auth", twitterAuthRoutes);
router.use("/api", apiRoutes);
// fallback 404
router.use("/api", (req, res) =>
  res.status(404).json("No route for this path")
);

export default router;

/*
routes:

GET /auth/twitter
GET /auth/twitter/callback

GET /auth/logout

GET /api/users/me
GET /api/users/feature

*/
