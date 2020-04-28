import { Router } from "express";
import usersRoutes from "./users";
import followersRoutes from "./followers";
import syncRoutes from "./sync";
const router = Router();

router.use("/users", usersRoutes);
router.use("/followers", followersRoutes);
router.use("/sync", syncRoutes);

export default router;
