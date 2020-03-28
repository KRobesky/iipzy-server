const { log } = require("iipzy-shared/src/utils/logFile");
const { userDBPeriodicWork } = require("../db/userDB");

let inUserDBPeriodicWork = false;

function init() {
  log("users.init", "bkgd", "verbose");
  setInterval(async () => {
    if (!inUserDBPeriodicWork) {
      inUserDBPeriodicWork = true;
      try {
        await userDBPeriodicWork();
      } catch (ex) {
        log("Exception)  userDBPeriodicWork: " + ex, "bkgd", "error");
      }
      inUserDBPeriodicWork = false;
    }
  }, 5 * 60 * 1000);
}

module.exports = { init };
