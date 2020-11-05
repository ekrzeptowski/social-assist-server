import passport from "passport";
import { Strategy as TwitterStrategy } from "passport-twitter";
import agenda from "../agenda/init";

import User from "../models/User";

const serverUrl =
  process.env.NODE_ENV === "production"
    ? process.env.SERVER_URL_PROD
    : process.env.SERVER_URL_DEV;

const twitterLogin = new TwitterStrategy(
  {
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: "/auth/twitter/redirect",
  },
  async (accessToken, tokenSecret, profile, done) => {
    // find current user in UserModel
    const currentUser = await User.findOne({
      twitterId: profile._json.id_str,
    });
    // create new user if the database doesn't have this user
    if (!currentUser) {
      const newUser = await new User({
        provider: "twitter",
        email: profile._json.name,
        username: profile._json.screen_name,
        name: profile._json.name,
        screenName: profile._json.screen_name,
        token: { accessToken, tokenSecret },
        twitterId: profile._json.id_str,
        profileImageUrl: profile._json.profile_image_url_https,
      }).save();
      if (newUser) {
        agenda.every("24 hours", "sync user data", { id: newUser._id });
        done(null, newUser);
      }
    } else {
      currentUser.token = { accessToken, tokenSecret };
      currentUser.profileImageUrl = profile._json.profile_image_url_https;
      currentUser.email = profile._json.name;
      currentUser.username = profile._json.screen_name;
      currentUser.name = profile._json.name;
      currentUser.screenName = profile._json.screen_name;
      currentUser.save();
      const jobs = await agenda.jobs({
        name: "sync user data",
        "data.id": currentUser._id,
      });
      if (jobs.length === 0) {
        const job = agenda.create("sync user data", { id: currentUser._id });
        job.unique({ "data.id": currentUser._id });
        job.repeatEvery("24 hours", { skipImmediate: true });
        await job.save();
      }
    }

    // console.log(token, tokenSecret, done);

    done(null, currentUser);
  }
);

// serialize the user.id to save in the cookie session
// so the browser will remember the user when login
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// deserialize the cookieUserId to user in the database
passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => {
      done(null, user);
    })
    .catch((e) => {
      done(new Error("Failed to deserialize an user"));
    });
});

passport.use(twitterLogin);
