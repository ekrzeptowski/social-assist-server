import { Router } from "express";
import requireJwtAuth from "../../middleware/requireJwtAuth";
import User from "../../models/User";
import Twitter from "twitter-lite";

const router = Router();

router.post("/", requireJwtAuth, async (req, res) => {
  const socket = res.app.locals.lookup[req.session.passport.user];

  const user = await User.findById(req.user._id);

  // res.status(200).json({ message: "Not the message owner or admin." });

  // const { error } = validateMessage(req.body);
  // if (error) return res.status(400).json({ message: error.details[0].message });
  const client = new Twitter({
    subdomain: "api", // "api" is the default (change for other subdomains)
    version: "1.1", // version "1.1" is the default (change for other subdomains)
    consumer_key: process.env.TWITTER_CONSUMER_KEY, // from Twitter.
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET, // from Twitter.
    access_token_key: req.user.token.accessToken, // from your User (oauth_token)
    access_token_secret: req.user.token.tokenSecret // from your User (oauth_token_secret)
  });

  if (!user.fetchedAt || (new Date() - user.fetchedAt) / 36e5 > 12) {
    const followers = await client.get("followers/ids");
    socket.send(
      JSON.stringify({
        type: "SYNC",
        status: "INFO",
        message: "FETCHED_FOLLOWERS_IDS"
      })
    );
    try {
      // console.log(user);
      user.followers = await followers.ids;
      user.totalFollowers = followers.ids.length;
      user.fetchedAt = new Date();
      user.save();
      socket.send(
        JSON.stringify({
          type: "SYNC",
          status: "INFO",
          message: "SAVED_FOLLOWERS_IDS"
        })
      );

      socket.send(
        JSON.stringify({
          type: "SYNC",
          status: "DONE",
          message: "SUCCESS"
        })
      );

      res.status(200).json({
        type: "SYNC",
        status: "DONE",
        message: "SUCCESS"
      });
    } catch (err) {
      res.status(500).json(err);
    }
  } else {
    socket.send(
      JSON.stringify({
        type: "SYNC",
        status: "ERROR",
        message: "RATE_LIMIT"
      })
    );
    res.status(200).json({
      type: "SYNC",
      status: "ERROR",
      message: "RATE_LIMIT"
    });
  }
});

export default router;
