import { Router } from "express";
import requireJwtAuth from "../../middleware/requireJwtAuth";
import User from "../../models/User";
// import Twitter from "twitter-lite";

const router = Router();

router.get("/", requireJwtAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    // console.log(req);

    res.json({
      followers: user.followers,
      totalFollowers: user.totalFollowers,
      fetchedAt: user.fetchedAt
    });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

export default router;
