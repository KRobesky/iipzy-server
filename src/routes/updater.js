const express = require("express");
const router = express.Router();

const Defs = require("iipzy-shared/src/defs");
const { handleError } = require("iipzy-shared/src/utils/handleError");
const { log, timestampToString } = require("iipzy-shared/src/utils/logFile");

const { getClientType, isValidClientToken } = require("../db/clientDB");
const {
  checkForUpdate,
  getUpdateStatus,
  setUpdateStatus,
  setUpdateVersionInfo,
  startUpdate
} = require("../db/updaterDB");

const { sendDelayedResults } = require("../utils/sendDelayedResults");

const { isValidClient } = require("./validateClient");

// const updateInstanceByClientToken = new Map();
// const updateInstanceByUpdateUuid = new Map();

// NB: request from an updater.
router.post("/heartbeat", async (req, res) => {
  const clientToken = req.header("x-client-token");

  log(
    "POST updater/heartbeat: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "updt",
    "info"
  );

  if (!isValidClient(res, clientToken, true, null, false, false)) return;

  log(
    "POST updater/heartbeat: " + JSON.stringify(req.body, null, 2),
    "updt",
    "info"
  );

  const { data } = req.body;
  if (data && data.updateStatus) {
    const checkResponse = await checkForUpdate(clientToken, data.updateStatus);
    if (checkResponse.results) {
      const starting = checkResponse.results.starting;
      const updateResponse = { starting, params: checkResponse.results.params };
      if (starting) {
        // return immediately
        return res.status(Defs.httpStatusOk).send(updateResponse);
      }
      // return at regular interval.
      return sendDelayedResults(
        res,
        Defs.httpStatusOk,
        updateResponse,
        20 * 1000
      );
    }
  }
  return sendDelayedResults(res, Defs.httpStatusOk, {}, 20 * 1000);
});

// NB: request from an updater.
router.post("/status", async (req, res) => {
  const clientToken = req.header("x-client-token");

  log(
    "POST updater/status: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "updt",
    "info"
  );

  if (!isValidClient(res, clientToken, true, null, false, false)) return;

  log(
    "POST updater/status: " + JSON.stringify(req.body, null, 2),
    "updt",
    "info"
  );

  const { data } = req.body;
  if (data && data.updateStatus) {
    setUpdateStatus(clientToken, data.updateStatus);
    // return immediately
    return res.send({});
  }
  // else, let the request hang.
  //?? TODO invalid request
  //??return sendDelayedResults(res, Defs.httpStatusOk, {}, 20 * 1000);
});

// NB: request from an updater.
router.post("/versioninfo", async (req, res) => {
  const clientToken = req.header("x-client-token");

  let results = {};

  log(
    "POST updater/versioninfo: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "updt",
    "info"
  );

  if (!isValidClient(res, clientToken, true, null, false, false)) return;

  log(
    "POST updater/versioninfo: " + JSON.stringify(req.body, null, 2),
    "updt",
    "info"
  );

  if (req.body.data && req.body.data.versionInfo)
    results = await setUpdateVersionInfo(
      clientToken,
      req.body.data.versionInfo
    );
  //?? TODO else invalid request.

  return res.send(results);
});

// NB: request from a client.
router.get("/status", async (req, res) => {
  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");

  log(
    "GET updater/status: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "updt",
    "info"
  );

  if (!isValidClient(res, clientToken, true, authToken, true, true)) return;

  const tgtClientToken = req.query.tgtclienttoken;

  const updateStatus = await getUpdateStatus(tgtClientToken);

  return res.status(Defs.httpStatusOk).send({ updateStatus });
});

// NB: request from a client.
router.post("/update", async (req, res) => {
  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");

  log(
    "POST updater/update: clientToken = " +
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

  const updateResults = await startUpdate(params);
  /*
  return { status: Defs.statusUpdateInProgress, results };
  */
  if (updateResults.status === Defs.statusOk)
    return res.send(updateResults.results);
  // else, an error occurred.
  return res
    .status(Defs.httpStatusUnprocessableEntity)
    .send(updateResults.results);
});

// function isEmpty(obj) {
//   if (obj == null) return true;
//   if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
//   for (var key in obj) if (_.has(obj, key)) return false;
//   return true;
// }

module.exports = router;
