import { Router } from "express";
import requireJwtAuth from "../../middleware/requireJwtAuth";
import User from "../../models/User";
import TwitterUser from "../../models/TwitterUser";
// import Twitter from "twitter-lite";

const router = Router();

router.get("/", requireJwtAuth, async (req, res) => {
  const settings = req.user.settings;
  console.log(settings);
  // const userId = req.user.settings.debug ? req.user.settings.debugId : req.user._id
  try {
    const user = settings.debug
      ? await User.findOne(
          { twitterId: settings.debugId },
          "totalFollowers totalFollowing fetchedAt"
        )
      : await User.findById(
          req.user._id,
          "totalFollowers totalFollowing fetchedAt"
        );

    // console.log(req);

    res.json({
      totalFollowers: user.totalFollowers,
      totalFollowing: user.totalFollowing,
      fetchedAt: user.fetchedAt,
    });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

router.get("/following", requireJwtAuth, async (req, res) => {
  const settings = req.user.settings;
  console.log(settings);
  // const userId = req.user.settings.debug ? req.user.settings.debugId : req.user._id
  try {
    const myAggregate = User.aggregate([
      {
        $match: settings.debug
          ? { twitterId: settings.debugId }
          : { _id: req.user._id },
      },
      {
        $lookup: {
          from: "twitterusers",
          localField: "following",
          foreignField: "_id",
          as: "followingUsers",
        },
      },
      {
        $project: {
          "followingUsers.followingUsers": 0,
        },
      },
      { $unwind: "$followingUsers" },
      { $replaceRoot: { newRoot: "$followingUsers" } },
    ]);
    const user = await User.aggregatePaginate(myAggregate, {
      page: req.query.page,
      limit: req.query.limit,
      pagination: req.query.limit ? true : false,
    });
    // : await User.findById(req.user._id, "following").populate("following");

    // console.log(req);

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

router.get("/history", requireJwtAuth, async (req, res) => {
  const settings = req.user.settings;
  console.log(settings);
  // const userId = req.user.settings.debug ? req.user.settings.debugId : req.user._id
  try {
    const user = settings.debug
      ? await User.findOne({ twitterId: settings.debugId })
      : await User.findById(
          req.user._id,
          "followersHistory.date followersHistory.followers"
        );

    res.json(user.followersHistory);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

router.get("/followers", requireJwtAuth, async (req, res) => {
  const settings = req.user.settings;
  console.log(settings);
  // const userId = req.user.settings.debug ? req.user.settings.debugId : req.user._id
  try {
    const followers = await TwitterUser.find(
      {
        followingUsers: settings.debug ? settings.debugId : req.user.twitterId,
      },
      "-followingUsers -createdAt -updatedAt"
    );

    // console.log(req);

    res.json(followers);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

router.get("/unfollowers", requireJwtAuth, async (req, res) => {
  const settings = req.user.settings;
  console.log(settings);
  // const userId = req.user.settings.debug ? req.user.settings.debugId : req.user._id
  try {
    const user = settings.debug
      ? await User.findOne(
          { twitterId: settings.debugId },
          "unfollowers.date unfollowers.user"
        ).populate(
          "unfollowers.user",
          "-_id -followingUsers -createdAt -updatedAt"
        )
      : await User.findById(
          req.user._id,
          "unfollowers.date unfollowers.user"
        ).populate(
          "unfollowers.user",
          "-_id -followingUsers -createdAt -updatedAt"
        );

    // console.log(req);

    res.json(user.unfollowers);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

export default router;
