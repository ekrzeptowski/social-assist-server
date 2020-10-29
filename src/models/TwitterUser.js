import mongoose from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    _id: String,
    name: String,
    screen_name: String,
    protected: Boolean,
    avatar: String,
    followers_count: Number,
    friends_count: Number,
    listed_count: Number,
    favourites_count: Number,
    statuses_count: Number,
    created_at: Date,
    followingUsers: { type: Array, unique: true, index: true },
    fetchedAt: Date,
    suspended: Boolean,
  },
  { timestamps: true }
);

userSchema.plugin(aggregatePaginate);

const TwitterUser = mongoose.model("TwitterUser", userSchema);

export default TwitterUser;
