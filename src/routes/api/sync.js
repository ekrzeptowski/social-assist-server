import { Router } from "express";
import requireJwtAuth from "../../middleware/requireJwtAuth";
import { sync } from "../../utils/sync";

const router = Router();

router.post("/", requireJwtAuth, async (req, res) => {
  const socket = res.app.locals.lookup[req.session.passport.user];

  res.status(202).json({
    type: "SYNC",
    status: "PENDING",
    message: "",
  });

  sync({ req_user: req.user, socket });
});

export default router;
