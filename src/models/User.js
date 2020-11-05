import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    provider: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      unique: true,
      required: [true, "can't be blank"],
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
    },
    password: {
      type: String,
      trim: true,
      minlength: 6,
      maxlength: 60,
    },
    token: Object,
    name: String,
    avatar: String,
    role: { type: String, default: "USER" },
    screenName: String,
    profileImageUrl: String,
    twitterId: String,
    fetchedAt: Date,
    followers: [{ type: String, ref: "TwitterUser" }],
    totalFollowers: Number,
    settings: { debug: Boolean, debugId: String },
    newFollowers: [
      {
        user: { type: String, ref: "TwitterUser" },
        date: { type: Date, default: Date.now },
      },
    ],
    unfollowers: [
      {
        user: { type: String, ref: "TwitterUser" },
        date: { type: Date, default: Date.now },
      },
    ],
    following: [{ type: String, ref: "TwitterUser" }],
    totalFollowing: Number,
    followersHistory: [
      {
        date: { type: Date, default: Date.now },
        followers: Number,
      },
    ],
    widgets: [{ component: String, dependencies: Array, layout: Object }],
    tier: {
      name: String,
      expiry: Date,
    },
  },
  { timestamps: true }
);

userSchema.methods.toJSON = function () {
  return {
    id: this._id,
    provider: this.provider,
    email: this.email,
    username: this.screenName,
    avatar: this.profileImageUrl,
    name: this.name,
    role: this.role,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    settings: this.settings,
    tier: this.tier,
  };
};

const isProduction = process.env.NODE_ENV === "production";
const secretOrKey = isProduction
  ? process.env.JWT_SECRET_PROD
  : process.env.JWT_SECRET_DEV;

userSchema.methods.generateJWT = function () {
  const token = jwt.sign(
    {
      expiresIn: "12h",
      id: this._id,
      provider: this.provider,
      email: this.email,
    },
    secretOrKey
  );
  return token;
};

userSchema.plugin(aggregatePaginate);

const User = mongoose.model("User", userSchema);

export default User;
