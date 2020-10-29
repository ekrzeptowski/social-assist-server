import TwitterUser from "../models/TwitterUser";
import timer from "./timer";

export async function hydrateUsers(
  requestsLength,
  client,
  promises_arr,
  socket,
  toFetchUnfollowers
) {
  console.log(
    (toFetchUnfollowers ? "[Unfollowers] " : "") +
      `Requests length: ${requestsLength}`
  );
  let removed = toFetchUnfollowers ? [...toFetchUnfollowers] : undefined;
  for (let i = 0; i < requestsLength; i++) {
    try {
      const users = await client.post("users/lookup", {
        user_id: promises_arr[i],
      });
      // Rate limit

      if (users._headers.get("x-rate-limit-remaining") === 0) {
        // if (i + (1 % 900) === 0) {
        let delta =
          users._headers.get("x-rate-limit-reset") * 1000 - Date.now();
        console.log(`[${i}] Resetting in ${delta}`);
        await timer(delta);
      }
      delete users._headers;
      const preparedUser = [];
      for (let index = 0; index < users.length; index++) {
        let cuser = users[index];
        if (toFetchUnfollowers) {
          removed = removed.filter((user) => user !== cuser.id_str);
        }
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
      console.log(
        "Prepared users: " +
          preparedUser.length +
          (toFetchUnfollowers ? "unfollowers" : "")
      );

      TwitterUser.bulkWrite(
        preparedUser.map((item) => ({
          updateOne: {
            filter: { _id: item._id },
            update: { $set: item },
            upsert: true,
          },
        }))
      );
      socket?.forEach((connection) => {
        connection.send(
          JSON.stringify({
            type: "SYNC",
            status: "INFO",
            message: toFetchUnfollowers
              ? "PROCESSING_UNFOLLOWERS_DATA"
              : `PROCESSING_USERS_DATA`,
            progress: (i + 1) / requestsLength,
          })
        );
      });
    } catch (error) {
      if ("errors" in e) {
        // Twitter API error
        if (e.errors[0].code === 88) {
          // rate limit exceeded
          let delta =
            users._headers.get("x-rate-limit-reset") * 1000 - Date.now();
          console.log(
            "Rate limit will reset on",
            new Date(e._headers.get("x-rate-limit-reset") * 1000)
          );
          i--;
          await timer(delta);
        } else {
        }
        // some other kind of error, e.g. read-only API trying to POST
      } else {
        // non-API error, e.g. network problem or invalid JSON in response
      }
    }
  }

  if (toFetchUnfollowers) return removed;
}
