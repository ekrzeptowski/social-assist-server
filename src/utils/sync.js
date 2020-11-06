import User from "../models/User";
import Twitter from "twitter-lite";
import TwitterUser from "../models/TwitterUser";
import { hydrateUsers } from "./hydrateUsers";
import { getIds } from "./getIds";

export async function sync({ req_user, socket }) {
  const settings = req_user.settings;

  const user = settings.debug
    ? (await User.findOne({ twitterId: settings.debugId })) ||
      new User({
        twitterId: settings.debugId,
        username: `user${settings.debugId}`,
        provider: "twitter",
      })
    : await User.findById(req_user._id);

  const client = new Twitter({
    subdomain: "api",
    version: "1.1",
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: req_user.token.accessToken,
    access_token_secret: req_user.token.tokenSecret,
  });

  const twitterId = settings.debug ? settings.debugId : user.twitterId;

  if (
    !user.fetchedAt ||
    !user.syncPending &&
    (new Date() - user.fetchedAt) / 36e5 > 12
  ) {
    user.syncPending = true;
    user.save();

    const oldFollowers = await TwitterUser.find(
      {
        followingUsers: twitterId,
      },
      { _id: 1 }
    );

    const followers = await getIds({
      type: "followers",
      user_id: settings.debug ? settings.debugId : null,
      socket,
      client,
    });
    socket?.forEach((connection) => {
      connection.send(
        JSON.stringify({
          type: "SYNC",
          status: "INFO",
          message: "FETCHED_FOLLOWERS_IDS",
        })
      );
    });

    console.log("Followers: " + followers.length);
    const following = await getIds({
      type: "friends",
      user_id: settings.debug ? settings.debugId : null,
      socket,
      client,
    });
    socket?.forEach((connection) => {
      connection.send(
        JSON.stringify({
          type: "SYNC",
          status: "INFO",
          message: "FETCHED_FOLLOWING_IDS",
        })
      );
    });
    console.log("Following: " + following.length);

    user.totalFollowers = await followers.length;
    console.log("TFollowers: " + user.totalFollowers);
    user.followersHistory.push({
      date: Date.now(),
      followers: await followers.length,
    });
    user.following = await following;
    user.totalFollowing = following.length;
    console.log("TFollowing: " + user.totalFollowing);
    user.fetchedAt = new Date();

    const newUnfollowers = [...oldFollowers].filter(
      (x) => !followers.includes(x.id)
    );

    console.log("Old followers: " + oldFollowers.length);

    console.log("New unfollowers: " + newUnfollowers.length);

    let toFetchUnfollowers = [];
    let unfollowersPromises_arr = [];

    for await (let id of newUnfollowers) {
      user.unfollowers.push({ user: id });
      toFetchUnfollowers.push(id._id);
    }

    if (toFetchUnfollowers.length > 0) {
      let requestNum = Math.floor(toFetchUnfollowers.length / 100);
      let remainder = toFetchUnfollowers.length % 100;

      for (var i = 0; i < requestNum; i++) {
        unfollowersPromises_arr.push(
          toFetchUnfollowers.slice(i * 100, i * 100 + 100).join(",")
        );
      }
      if (remainder != 0) {
        unfollowersPromises_arr.push(
          toFetchUnfollowers
            .slice(requestNum * 100, requestNum * 100 + 100)
            .join(",")
        );
      }
    }
    let unfollowersRequestsLength = unfollowersPromises_arr.length;
    if (unfollowersRequestsLength > 0) {
      const removed = await hydrateUsers(
        unfollowersRequestsLength,
        client,
        unfollowersPromises_arr,
        socket,
        toFetchUnfollowers
      );
      console.log("Removed unfollowers: " + removed.length);
      for await (let id of removed) {
        const suspendedUser = await TwitterUser.findById(id);
        suspendedUser.suspended = true;
        suspendedUser.save();
      }
    }

    user.save();
    socket?.forEach((connection) => {
      connection.send(
        JSON.stringify({
          type: "SYNC",
          status: "INFO",
          message: "SAVED_FOLLOWERS_IDS",
        })
      );
    });

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
      await hydrateUsers(len, client, promises_arr, socket);
    }

    socket?.forEach((connection) => {
      connection.send(
        JSON.stringify({
          type: "SYNC",
          status: "INFO",
          message: `SAVING_FOLLOWERS_DATA`,
        })
      );
    });

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

    socket?.forEach((connection) => {
      connection.send(
        JSON.stringify({
          type: "SYNC",
          status: "INFO",
          message: `SAVING_UNFOLLOWERS_DATA`,
        })
      );
    });

    // Save unfollowers
    for await (let id of newUnfollowers) {
      const current = await TwitterUser.findById(id);
      if (current) {
        const temp = current.followingUsers;
        current.followingUsers = temp.filter((val) => val !== twitterId);

        current.save();
      }
    }

    user.syncPending = false;
    user.save();

    socket?.forEach((connection) => {
      connection.send(
        JSON.stringify({
          type: "SYNC",
          status: "DONE",
          message: "SUCCESS",
        })
      );
    });
  } else {
    socket?.forEach((connection) => {
      connection.send(
        JSON.stringify({
          type: "SYNC",
          status: "ERROR",
          message: "RATE_LIMIT",
        })
      );
    });
  }
}
