const Defs = require("iipzy-shared/src/defs");
const { handleError } = require("iipzy-shared/src/utils/handleError");
const { log } = require("iipzy-shared/src/utils/logFile");

const { isAdmin, isLoggedIn } = require("../db/authDB");
const { isValidClientToken } = require("../db/clientDB");

const { sendDelayedResults } = require("../utils/sendDelayedResults");

// returns true if valid client, false otherwise.
function isValidClient(
  res,
  clientToken,
  checkClientToken,
  authToken,
  checkAuthToken,
  needAdmin
) {
  if (checkClientToken) {
    log("isValidClient: clientToken = " + clientToken, "vald", "info");
    if (!clientToken) {
      sendDelayedResults(
        res,
        Defs.httpStatusUnauthorized,
        handleError(
          Defs.objectType_clientInstance,
          "",
          Defs.statusMissingClientToken,
          "Access denied. Missing client token"
        )
      );
      return false;
    }

    if (!isValidClientToken(clientToken)) {
      sendDelayedResults(
        res,
        Defs.httpStatusUnauthorized,
        handleError(
          Defs.objectType_clientInstance,
          "",
          Defs.statusInvalidClientToken,
          "Access denied. Invalid client token"
        )
      );
      return false;
    }
  }

  if (checkAuthToken) {
    log("isValidClient: authToken = " + authToken, "vald", "info");
    if (!authToken || authToken === "") {
      return sendDelayedResults(
        res,
        Defs.httpStatusUnauthorized,
        handleError(
          Defs.objectType_clientInstance,
          clientToken,
          Defs.statusMissingAuthToken,
          "Access denied. Missing auth token"
        )
      );
      return false;
    }

    if (!isLoggedIn(authToken)) {
      return sendDelayedResults(
        res,
        Defs.httpStatusUnauthorized,
        handleError(
          Defs.objectType_clientInstance,
          clientToken,
          Defs.statusInvalidAuthToken,
          "Access denied. Invalid auth token"
        )
      );
      return false;
    }
    if (needAdmin && !isAdmin(authToken)) {
      console.log("-----needAdmin fail-----");
      return sendDelayedResults(
        res,
        Defs.httpStatusUnauthorized,
        handleError(
          Defs.objectType_clientInstance,
          clientToken,
          Defs.statusAdminPriviledgeRequired,
          "Access denied. Operation requires administrative priviledge"
        )
      );
      return false;
    }
  }

  return true;
}

module.exports = { isValidClient };
