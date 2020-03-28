const express = require("express");
const router = express.Router();

const Defs = require("iipzy-shared/src/defs");
const { handleError } = require("iipzy-shared/src/utils/handleError");
const { log, timestampToString } = require("iipzy-shared/src/utils/logFile");

const { isLoggedIn } = require("../db/authDB");
const { getClient } = require("../db/clientDB");
const { addEvent } = require("../db/eventDB");

const { isValidClient } = require("./validateClient");

const { sendDelayedResults } = require("../utils/sendDelayedResults");

router.post("/", async (req, res) => {
  log(
    "POST alert: timestamp = " + timestampToString(req.header("x-timestamp")),
    "alrt"
  );

  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");
  if (!isValidClient(res, clientToken, true, authToken, true, false)) return;

  const alert = req.body.alert;
  if (!alert)
    return sendDelayedResults(
      res,
      Defs.httpStatusBadRequest,
      handleError(
        Defs.objectType_clientInstance,
        clientToken,
        Defs.statusMissingParam,
        "alert is missing"
      )
    );

  log("POST alert: alert = " + JSON.stringify(alert, null, 2), "alrt");
  /*
  alert = {
    subEventClass: Defs.eventClass_networkDeviceStatus,
    subObjectType: Defs.objectType_networkDevice,
    subObjectId: ipAddress,
    eventActive: !device.pingSucceeded,
    message: message
  };
  */

  // validate alert
  switch (alert.subEventClass) {
    case Defs.eventClass_networkDeviceAdded:
    case Defs.eventClass_networkDeviceDeleted:
    case Defs.eventClass_networkDeviceIPAddressChanged:
    case Defs.eventClass_networkDeviceStatus:
    case Defs.eventClass_pingFail:
      break;
    default:
      return sendDelayedResults(
        res,
        Defs.httpStatusBadRequest,
        handleError(
          Defs.objectType_clientInstance,
          clientToken,
          Defs.statusInvalidParam,
          "Invalid subEventClass"
        )
      );
  }

  switch (alert.subObjectType) {
    case Defs.objectType_networkDevice:
    case Defs.objectType_clientInstance:
      break;
    default:
      return sendDelayedResults(
        res,
        Defs.httpStatusBadRequest,
        handleError(
          Defs.objectType_clientInstance,
          clientToken,
          Defs.statusInvalidParam,
          "Invalid subObjectType"
        )
      );
  }

  const { id: clientId, clientName } = await getClient(clientToken);
  const userId = isLoggedIn(authToken);

  const eventJSON = JSON.stringify({
    clientToken,
    clientName,
    userId,
    isOnLine: alert.eventActive === Defs.eventActive_inactive,
    isLoggedIn: true,
    message: alert.message,
    info: alert.info
  });

  await addEvent(
    Defs.eventClass_clientOnLineStatus,
    Defs.objectType_clientInstance,
    clientId,
    alert.subEventClass,
    alert.subObjectType,
    alert.subObjectId,
    alert.eventActive,
    eventJSON,
    userId
  );

  res.send({});
});

module.exports = router;
