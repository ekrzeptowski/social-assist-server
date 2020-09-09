import { Router } from "express";
import requireJwtAuth from "../../middleware/requireJwtAuth";
import User from "../../models/User";
import TwitterUser from "../../models/TwitterUser";

const router = Router();

router.get("/", requireJwtAuth, async (req, res) => {
  const settings = req.user.settings;
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

    res.json({
      totalFollowers: user.totalFollowers,
      totalFollowing: user.totalFollowing,
      fetchedAt: user.fetchedAt,
    });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

router.get("/stats", requireJwtAuth, async (req, res) => {
  const settings = req.user.settings;
  try {
    const notFollowingCount = await TwitterUser.countDocuments({
      _id: { $nin: req.user.following },
      followingUsers: settings.debug ? settings.debugId : req.user.twitterId,
    });

    const notFollowersCount = await User.aggregate([
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
      { $unwind: "$followingUsers" },
      { $replaceRoot: { newRoot: "$followingUsers" } },
      { $match: { followingUsers: { $ne: req.user.twitterId } } },
      { $group: { _id: null, count: { $sum: 1 } } },
      { $project: { _id: 0 } },
    ]);

    res.json({
      notFollowingCount,
      notFollowersCount: notFollowersCount[0].count,
    });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

router.get("/following", requireJwtAuth, async (req, res) => {
  const settings = req.user.settings;
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
      sort: req.query.sort,
      page: req.query.page,
      limit: req.query.limit,
      pagination: req.query.limit ? true : false,
    });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

router.get("/history", requireJwtAuth, async (req, res) => {
  const settings = req.user.settings;
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
  try {
    const myAggregate = TwitterUser.aggregate([
      {
        $match: {
          followingUsers: settings.debug
            ? settings.debugId
            : req.user.twitterId,
        },
      },
      {
        $project: {
          followingUsers: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    ]);
    const followers = await TwitterUser.aggregatePaginate(myAggregate, {
      sort: req.query.sort,
      page: req.query.page,
      limit: req.query.limit,
      pagination: req.query.limit ? true : false,
    });

    res.json(followers);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

router.get("/unfollowers", requireJwtAuth, async (req, res) => {
  const settings = req.user.settings;
  try {
    const myAggregate = User.aggregate([
      {
        $match: settings.debug
          ? { twitterId: settings.debugId }
          : { _id: req.user._id },
      },
      { $unwind: { path: "$unfollowers", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "twitterusers",
          localField: "unfollowers.user",
          foreignField: "_id",
          as: "unfollowers.user",
        },
      },
      { $replaceRoot: { newRoot: "$unfollowers" } },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          "user.followingUsers": 0,
        },
      },
    ]);
    const user = await User.aggregatePaginate(myAggregate, {
      sort: req.query.sort,
      page: req.query.page,
      limit: req.query.limit,
      pagination: req.query.limit ? true : false,
    });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

// People I don't follow back
router.get("/notfollowing", requireJwtAuth, async (req, res) => {
  const settings = req.user.settings;
  try {
    const myAggregate = TwitterUser.aggregate([
      {
        $match: {
          // Can be problematic with large number of following accounts
          _id: { $nin: req.user.following },
          followingUsers: settings.debug
            ? settings.debugId
            : req.user.twitterId,
        },
      },
      {
        $project: {
          followingUsers: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    ]);
    const followers = await TwitterUser.aggregatePaginate(myAggregate, {
      sort: req.query.sort,
      page: req.query.page,
      limit: req.query.limit,
      pagination: req.query.limit ? true : false,
    });

    res.json(followers);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

// People who don't follow me back
router.get("/notfollowers", requireJwtAuth, async (req, res) => {
  const settings = req.user.settings;
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
      { $unwind: "$followingUsers" },
      { $replaceRoot: { newRoot: "$followingUsers" } },
      { $match: { followingUsers: { $ne: req.user.twitterId } } },
      {
        $project: {
          followingUsers: 0,
        },
      },
    ]);
    const user = await User.aggregatePaginate(myAggregate, {
      sort: req.query.sort,
      page: req.query.page,
      limit: req.query.limit,
      pagination: req.query.limit ? true : false,
    });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

router.get("/followingback", requireJwtAuth, async (req, res) => {
  const settings = req.user.settings;
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
      { $unwind: "$followingUsers" },
      { $replaceRoot: { newRoot: "$followingUsers" } },
      { $match: { followingUsers: { $eq: req.user.twitterId } } },
      {
        $project: {
          followingUsers: 0,
        },
      },
    ]);
    const user = await User.aggregatePaginate(myAggregate, {
      sort: req.query.sort,
      page: req.query.page,
      limit: req.query.limit,
      pagination: req.query.limit ? true : false,
    });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

export default router;
