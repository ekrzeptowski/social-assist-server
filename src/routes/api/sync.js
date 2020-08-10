import { Router } from "express";
import requireJwtAuth from "../../middleware/requireJwtAuth";
import User from "../../models/User";
import Twitter from "twitter-lite";
import TwitterUser from "../../models/TwitterUser";
import timer from "../../utils/timer";

const router = Router();

router.post("/", requireJwtAuth, async (req, res) => {
  const settings = req.user.settings;
  const socket = res.app.locals.lookup[req.session.passport.user];

  const user = settings.debug
    ? (await User.findOne({ twitterId: settings.debugId })) ||
      new User({
        twitterId: settings.debugId,
        username: `user${settings.debugId}`,
        provider: "twitter",
      })
    : await User.findById(req.user._id);

  const client = new Twitter({
    subdomain: "api", // "api" is the default (change for other subdomains)
    version: "1.1", // version "1.1" is the default (change for other subdomains)
    consumer_key: process.env.TWITTER_CONSUMER_KEY, // from Twitter.
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET, // from Twitter.
    access_token_key: req.user.token.accessToken, // from your User (oauth_token)
    access_token_secret: req.user.token.tokenSecret, // from your User (oauth_token_secret)
  });

  function getFollowers(user_id, cursor = -1, followers = []) {
    socket?.send(
      JSON.stringify({
        type: "SYNC",
        status: "INFO",
        message: "FETCHING_FOLLOWERS_IDS",
      })
    );
    return new Promise((resolve, reject) => {
      client
        .get("followers/ids", {
          stringify_ids: true,
          user_id,
          cursor,
        })
        .then(async (res) => {
          cursor = res.next_cursor_str;
          followers.push(res.ids);
          if (cursor > 0) {
            await timer(6000);
            return resolve(getFollowers(user_id, cursor, followers));
          } else {
            return resolve([].concat(...followers));
          }
        });
    });
  }

  function getFriends(user_id, cursor = -1, friends = []) {
    socket?.send(
      JSON.stringify({
        type: "SYNC",
        status: "INFO",
        message: "FETCHING_FOLLOWING_IDS",
      })
    );
    return new Promise((resolve, reject) => {
      client
        .get("friends/ids", {
          stringify_ids: true,
          user_id,
          cursor,
        })
        .then(async (res) => {
          cursor = res.next_cursor_str;
          friends.push(res.ids);
          if (cursor > 0) {
            await timer(60000);
            return resolve(getFriends(user_id, cursor, friends));
          } else {
            return resolve([].concat(...friends));
          }
        });
    });
  }

  // Forbid frequent syncs
  if (!user.fetchedAt || (new Date() - user.fetchedAt) / 36e5 > 12) {
    const twitterId = settings.debug ? settings.debugId : user.twitterId;
    const oldFollowers = await TwitterUser.find(
      {
        followingUsers: twitterId,
      },
      { _id: 1 }
    );

    const followers = await getFollowers(
      settings.debug ? settings.debugId : null
    );
    socket?.send(
      JSON.stringify({
        type: "SYNC",
        status: "INFO",
        message: "FETCHED_FOLLOWERS_IDS",
      })
    );
    const following = await getFriends(
      settings.debug ? settings.debugId : null
    );
    socket?.send(
      JSON.stringify({
        type: "SYNC",
        status: "INFO",
        message: "FETCHED_FOLLOWING_IDS",
      })
    );

    try {
      user.totalFollowers = await followers.length;
      user.followersHistory.push({
        date: Date.now(),
        followers: await followers.length,
      });
      user.following = await following;
      user.totalFollowing = following.length;
      user.fetchedAt = new Date();

      const newUnfollowers = [...oldFollowers].filter(
        (x) => !followers.includes(x.id)
      );

      // console.log(newUnfollowers.length);
      // console.log(followers.length);

      newUnfollowers.map((id) => user.unfollowers.push({ user: id }));

      user.save();
      socket?.send(
        JSON.stringify({
          type: "SYNC",
          status: "INFO",
          message: "SAVED_FOLLOWERS_IDS",
        })
      );

      // Hydrate users
      let toFetch = [];
      let promises_arr = [];

      for await (let id of followers) {
        const current = await TwitterUser.findById(id);
        if (current) {
          // At least 7 days between twitter account data update
          if (
            !current.fetchedAt ||
            (new Date() - current.fetchedAt) / 36e5 > 24 * 7
          ) {
            toFetch.push(id);
          }
        } else {
          toFetch.push(id);
        }
      }
      for await (let id of user.following) {
        const current = await TwitterUser.findById(id);
        if (current) {
        } else {
          if (!toFetch.includes(id)) {
            toFetch.push(id);
          }
        }
      }

      if (toFetch.length > 0) {
        let requestNum = Math.floor(toFetch.length / 100);
        let remainder = toFetch.length % 100;

        for (var i = 0; i < requestNum; i++) {
          promises_arr.push(toFetch.slice(i * 100, i * 100 + 100).join(","));
        }
        if (remainder != 0) {
          promises_arr.push(
            toFetch.slice(requestNum * 100, requestNum * 100 + 100).join(",")
          );
        }
      }
      let len = promises_arr.length;
      if (len > 0) {
        for (let i = 0; i < len; i++) {
          const users = await client.post("users/lookup", {
            user_id: promises_arr[i],
          });
          delete users._headers;
          const preparedUser = [];
          for (let index = 0; index < users.length; index++) {
            let cuser = users[index];
            preparedUser.push({
              _id: cuser.id_str,
              name: cuser.name,
              screen_name: cuser.screen_name,
              protected: cuser.protected,
              avatar: cuser.profile_image_url_https,
              followers_count: cuser.followers_count,
              friends_count: cuser.friends_count,
              listed_count: cuser.listed_count,
              favourites_count: cuser.favourites_count,
              statuses_count: cuser.statuses_count,
              created_at: cuser.created_at,
              fetchedAt: new Date(),
            });
          }

          TwitterUser.bulkWrite(
            preparedUser.map((item) => ({
              updateOne: {
                filter: { _id: item._id },
                update: { $set: item },
                upsert: true,
              },
            }))
          );
          socket?.send(
            JSON.stringify({
              type: "SYNC",
              status: "INFO",
              message: `PROCESSING_FOLLOWERS_DATA`,
              progress: (i + 1) / len,
            })
          );
          // Rate limit
          await timer(1100);
        }
      }

      // Save followers
      for await (let id of followers) {
        let current = await TwitterUser.findById(id);
        if (current) {
          if (!current.followingUsers) {
            current.followingUsers = [twitterId];
            current.save();
          } else if (
            !current.followingUsers.includes(twitterId) ||
            current.followingUsers.length === 0
          ) {
            current.followingUsers.push(twitterId);
            current.save();
          }
        }
      }

      // Save unfollowers
      for await (let id of newUnfollowers) {
        const current = await TwitterUser.findById(id);
        if (current) {
          const temp = current.followingUsers;
          current.followingUsers = temp.filter((val) => val !== twitterId);

          current.save();
        }
      }

      socket?.send(
        JSON.stringify({
          type: "SYNC",
          status: "DONE",
          message: "SUCCESS",
        })
      );

      res.status(200).json({
        type: "SYNC",
        status: "DONE",
        message: "SUCCESS",
      });
    } catch (err) {
      res.status(500).json(err);
    }
  } else {
    socket?.send(
      JSON.stringify({
        type: "SYNC",
        status: "ERROR",
        message: "RATE_LIMIT",
      })
    );
    res.status(200).json({
      type: "SYNC",
      status: "ERROR",
      message: "RATE_LIMIT",
    });
  }
});

export default router;
