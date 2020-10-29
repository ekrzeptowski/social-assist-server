import timer from "./timer";

export function getIds({
  socket,
  client,
  type,
  user_id,
  cursor = -1,
  ids = [],
  request = 0,
}) {
  socket?.forEach((connection) => {
    connection.send(
      JSON.stringify({
        type: "SYNC",
        status: "INFO",
        message:
          type === "followers"
            ? "FETCHING_FOLLOWERS_IDS"
            : type === "friends"
            ? "FETCHING_FOLLOWING_IDS"
            : "",
      })
    );
  });

  return new Promise((resolve, reject) => {
    client
      .get(`${type}/ids`, {
        stringify_ids: true,
        user_id,
        cursor,
      })
      .then(async (res) => {
        cursor = res?.next_cursor_str;
        request++;
        ids.push(res.ids);
        if (res._headers.get("x-rate-limit-remaining") === 1) {
          // if ((request + 1) % 15 === 0) {
          let delta =
            res._headers.get("x-rate-limit-reset") * 1000 - Date.now();
          console.log(`Reset in ${delta}`);
          await timer(delta);
        }
        if (cursor > 0) {
          return resolve(
            getIds({ socket, client, type, user_id, cursor, ids, request })
          );
        } else {
          return resolve([].concat(...ids));
        }
      })
      .catch(async (error) => {
        if ("errors" in error) {
          // Twitter API error
          if (error.errors[0].code === 88) {
            // rate limit exceeded
            let delta =
              error._headers.get("x-rate-limit-reset") * 1000 - Date.now();
            console.log(
              "Rate limit will reset on",
              new Date(error._headers.get("x-rate-limit-reset") * 1000),
              `${type}, ${cursor}, ${request}`
            );
            await timer(delta);
            return resolve(
              getIds({ socket, client, type, user_id, cursor, ids, request })
            );
          } else {
          }
          // some other kind of error, e.g. read-only API trying to POST
        } else {
          // non-API error, e.g. network problem or invalid JSON in response
        }
      });
  });
}
