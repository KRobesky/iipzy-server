const express = require("express");
const router = express.Router();

const Defs = require("iipzy-shared/src/defs");
const { handleError } = require("iipzy-shared/src/utils/handleError");
const { log, timestampToString } = require("iipzy-shared/src/utils/logFile");

const { addAction } = require("../db/administratorDB");
const { isValidClientToken } = require("../db/clientDB");
//const { sendDelayedResults } = require("../utils/sendDelayedResults");

const { isValidClient } = require("./validateClient");

router.post("/command", async (req, res) => {
  log(
    "POST administrator/command: timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "admn"
  );

  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");
  if (!isValidClient(res, clientToken, true, authToken, true, true)) return;

  /*
    const action = {
    command: Defs.adminCmd_setLogLevel,
    tgtClientToken: "12345...""",
    params: { logLevel: "detailed" }
  };
  */

  // NB: make copy of action.
  const action = JSON.parse(JSON.stringify(req.body));
  if (!action || !action.command || !action.tgtClientToken || !action.params) {
    const results = handleError(
      Defs.objectType_clientInstance,
      clientToken,
      Defs.statusMissingParam,
      "missing params"
    );
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  log(
    "POST administrator/command: params = " + JSON.stringify(action, null, 2),
    "admn"
  );

  const { tgtClientToken, command, params } = action;
  if (!isValidClientToken(tgtClientToken)) {
    const results = handleError(
      Defs.objectType_clientInstance,
      tgtClientToken,
      Defs.statusInvalidClientToken,
      "invalid client token"
    );
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  // validate command
  switch (command) {
    case Defs.adminCmd_admin: {
      break;
    }
    case Defs.adminCmd_getLogLevel: {
      break;
    }
    case Defs.adminCmd_setLogLevel: {
      const logLevel = params.logLevel;
      if (!logLevel || (logLevel !== "normal" && logLevel !== "detailed")) {
        const results = handleError(
          Defs.objectType_clientInstance,
          clientToken,
          Defs.statusInvalidParam,
          "invalid log level"
        );
        return res.status(Defs.httpStatusUnprocessableEntity).send(results);
      }
      break;
    }
    case Defs.adminCmd_sendLogs: {
      break;
    }
    default: {
      const results = handleError(
        Defs.objectType_clientInstance,
        clientToken,
        Defs.statusInvalidParam,
        "invalid command"
      );
      return res.status(Defs.httpStatusUnprocessableEntity).send(results);
    }
  }

  const results = await addAction(action);

  log("<<<POST administrator/command", "admn", "info");

  res.send(results);
});

module.exports = router;
