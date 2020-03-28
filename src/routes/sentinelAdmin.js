const express = require("express");
const router = express.Router();

const Defs = require("iipzy-shared/src/defs");
const { handleError } = require("iipzy-shared/src/utils/handleError");
const { log, timestampToString } = require("iipzy-shared/src/utils/logFile");

const { getClientType, isValidClientToken } = require("../db/clientDB");
const {
  checkForAction,
  getActionStatus,
  setActionStatus,
  startAction
} = require("../db/sentinelAdminDB");

const { sendDelayedResults } = require("../utils/sendDelayedResults");

const { isValidClient } = require("./validateClient");

// NB: request from a sentinel-admin.
router.post("/heartbeat", async (req, res) => {
  const clientToken = req.header("x-client-token");

  log(
    "POST sentineladmin/heartbeat: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "updt",
    "info"
  );

  if (!isValidClient(res, clientToken, true, null, false, false)) return;

  log(
    "POST sentineladmin/heartbeat: " + JSON.stringify(req.body, null, 2),
    "updt",
    "info"
  );

  const { data } = req.body;
  if (data && data.adminStatus) {
    const checkResponse = await checkForAction(clientToken, data.adminStatus);
    if (checkResponse.results) {
      const starting = checkResponse.results.starting;
      const adminResponse = { starting, params: checkResponse.results.params };
      if (starting) {
        // return immediately
        return res.status(Defs.httpStatusOk).send(adminResponse);
      }
      // return at regular interval.
      return sendDelayedResults(
        res,
        Defs.httpStatusOk,
        adminResponse,
        20 * 1000
      );
    }
  }
  return sendDelayedResults(res, Defs.httpStatusOk, {}, 20 * 1000);
});

// NB: request from a sentinel-admin.
router.post("/status", async (req, res) => {
  const clientToken = req.header("x-client-token");

  log(
    "POST sentineladmin/status: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "updt",
    "info"
  );

  if (!isValidClient(res, clientToken, true, null, false, false)) return;

  log(
    "POST sentineladmin/status: " + JSON.stringify(req.body, null, 2),
    "updt",
    "info"
  );

  const { data } = req.body;
  if (data && data.adminStatus) {
    setActionStatus(clientToken, data.adminStatus);
    // return immediately
    return res.send({});
  }
  // else, let the request hang.
  //?? TODO invalid request
  //??return sendDelayedResults(res, Defs.httpStatusOk, {}, 20 * 1000);
});

// NB: request from a client.
router.get("/status", async (req, res) => {
  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");

  log(
    "GET sentineladmin/status: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "updt",
    "info"
  );

  if (!isValidClient(res, clientToken, true, authToken, true, true)) return;

  const tgtClientToken = req.query.tgtclienttoken;

  const adminStatus = await getActionStatus(tgtClientToken);

  return res.status(Defs.httpStatusOk).send({ adminStatus });
});

// NB: request from a client.
router.post("/action", async (req, res) => {
  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");

  log(
    "POST sentineladmin/action: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "updt",
    "info"
  );

  if (!isValidClient(res, clientToken, true, authToken, true, true)) return;

  const params = JSON.parse(JSON.stringify(req.body));
  if (!params) {
    return sendDelayedResults(
      res,
      Defs.httpStatusBadRequest,
      handleError(
        Defs.objectType_clientInstance,
        clientToken,
        Defs.statusMissingParam,
        "params is missing"
      )
    );
  }

  if (!isValidClientToken(params.tgtClientToken)) {
    const results = handleError(
      Defs.objectType_clientInstance,
      params.tgtClientToken,
      Defs.statusInvalidClientToken,
      "invalid client token"
    );
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  if (getClientType(params.tgtClientToken) !== Defs.clientType_appliance) {
    const results = handleError(
      Defs.objectType_clientInstance,
      params.tgtClientToken,
      Defs.statusInvalidClientType,
      "invalid client type"
    );
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  const adminResults = await startAction(params);
  /*
  return { status: Defs.statusUpdateInProgress, results };
  */
  if (adminResults.status === Defs.statusOk)
    return res.send(adminResults.results);
  // else, an error occurred.
  return res
    .status(Defs.httpStatusUnprocessableEntity)
    .send(adminResults.results);
});

// function isEmpty(obj) {
//   if (obj == null) return true;
//   if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
//   for (var key in obj) if (_.has(obj, key)) return false;
//   return true;
// }

module.exports = router;
