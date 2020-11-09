import User from "../models/User";
import { sync } from "../utils/sync";
// import agenda from "./init";
export const syncUserData = (agenda) => {
  agenda.define("sync user data", async (job, done) => {
    const user = await User.findById(job.attrs.data.id);
    console.log(`Running ${user.name}`);
    if (user.tier.expiry.getTime() > new Date().getTime()) {
      sync({ req_user: user, agenda: true });
    } else {
      job.remove();
    }
    done();
  });
};
