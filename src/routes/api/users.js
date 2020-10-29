import { Router } from "express";

import requireJwtAuth from "../../middleware/requireJwtAuth";
import User from "../../models/User";

const router = Router();

router.put("/:id", requireJwtAuth, async (req, res, next) => {
  try {
    const tempUser = await User.findById(req.params.id);
    if (!tempUser) return res.status(404).json({ message: "No such user." });
    if (!(tempUser.id === req.user.id))
      return res
        .status(400)
        .json({ message: "You do not have privilegies to edit this user." });

    const updatedUser = {
      ...req.body,
    };
    Object.keys(updatedUser).forEach(
      (k) =>
        !updatedUser[k] && updatedUser[k] !== undefined && delete updatedUser[k]
    );
    console.log(req.body, updatedUser);
    const user = await User.findByIdAndUpdate(
      tempUser.id,
      { $set: updatedUser },
      { new: true }
    );

    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

router.get("/me", requireJwtAuth, async (req, res) => {
  const me = req.user.toJSON();
  res.json({ me });
});

router.get("/:username", requireJwtAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "No user found." });
    res.json({ user: user.toJSON() });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

router.get("/", requireJwtAuth, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: "desc" });

    res.json({
      users: users.map((m) => {
        return m.toJSON();
      }),
    });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

router.delete("/:id", requireJwtAuth, async (req, res) => {
  try {
    const tempUser = await User.findById(req.params.id);
    if (!tempUser) return res.status(404).json({ message: "No such user." });
    if (!(tempUser.id === req.user.id || req.user.role === "ADMIN"))
      return res
        .status(400)
        .json({ message: "You do not have privilegies to delete that user." });

    // if (['email0@email.com', 'email1@email.com'].includes(tempUser.email))
    //   return res.status(400).json({ message: 'You can not delete seeded user.' });

    //delete user
    const user = await User.findByIdAndRemove(tempUser.id);
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

export default router;
