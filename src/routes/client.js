const express = require("express");
const router = express.Router();

const Defs = require("iipzy-shared/src/defs");
const { log, timestampToString } = require("iipzy-shared/src/utils/logFile");
const { isLoggedIn } = require("../db/authDB");
const { checkForAction } = require("../db/administratorDB");
const {
  createClient,
  createClientBySerialNumber,
  createClientX,
  getClientName,
  getClients,
  getClientsSansLocalIPAddress,
  isClientConnected,
  setClientName,
  // updateClientAuthToken
  updateClientOnLineState,
  updateClientLocalIPAddress,
} = require("../db/clientDB");
const { ispDB_init, getIPAddressTimezoneId, getIPAddressTimezoneInfo } = require("../db/ispDB");
const { isValidClient } = require("./validateClient");

ispDB_init();

let inClientsSansLocalIPAddress = false;
let clientsSansLocalIPAddress = new Set();

async function getClientsSans_() {
  try {
    const clients = await getClientsSansLocalIPAddress();
    log(
      "clientsSansLocalIPAddress: " + JSON.stringify(clients, null, 2),
      "clnt",
      "info"
    );
    clientsSansLocalIPAddress = new Set(clients);
  } catch (ex) {
    log("(Exception) clientsSansLocalIPAddress:" + ex, "clnt", "error");
  }
}

async function init() {
  log(">>>client.init", "clnt", "info");
  setInterval(async () => {
    if (!inClientsSansLocalIPAddress) {
      inClientsSansLocalIPAddress = true;
      await getClientsSans_();
      inClientsSansLocalIPAddress = false;
    }
  }, 5 * 60 * 1000);
  await getClientsSans_();
  log("<<<client.init", "clnt", "info");
}

init();

router.get("/", async (req, res) => {
  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");

  log(
    "GET clients: clientToken = " +
      clientToken +
      timestampToString(req.header("x-timestamp")),
    "clnt"
  );

  const localSentinelsOnly = req.query.localSentinelsOnly === "1";

  log("GET clients: localSentinelsOnly = " + localSentinelsOnly, "clnt");

  if (
    !isValidClient(res, clientToken, true, authToken, true, !localSentinelsOnly)
  )
    return;

  const userId = localSentinelsOnly ? isLoggedIn(authToken) : 0;

  res.send(await getClients(req.ip, localSentinelsOnly, userId));
});

router.get("/timezoneid", async (req, res) => {
  const clientToken = req.header("x-client-token");

  log(
    "GET client/timezoneid: clientToken = " +
      clientToken +
      timestampToString(req.header("x-timestamp")),
    "clnt"
  );

  res.send(await getIPAddressTimezoneId(req.ip));
});

router.get("/timezoneinfo", async (req, res) => {
  const clientToken = req.header("x-client-token");

  log(
    "GET client/timezoneinfo: clientToken = " +
      clientToken +
      timestampToString(req.header("x-timestamp")),
    "clnt"
  );

  res.send(await getIPAddressTimezoneInfo(req.ip));
});

router.post("/", async (req, res) => {
  const clientToken = req.header("x-client-token");

  log(
    "POST heartbeat: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")) +
      ", reqData = " +
      JSON.stringify(req.body, null, 2),
    "clnt",
    "info"
  );

  // if (req.body.periodicData)
  //   log(JSON.stringify(req.body.periodicData, null, 2), "clnt", "info");

  let userId = 0;
  let clientTokenRet = null;
  let isLoggedInRet = true;

  let authToken = req.header("x-auth-token");
  if (!authToken || authToken === "") authToken = null;
  log("authToken='" + authToken + "'", "clnt", "info");

  if (!authToken) {
    log("Not logged in.  No token provided.", "clnt", "info");
    isLoggedInRet = false;
  } else {
    userId = isLoggedIn(authToken);
    if (userId === 0) {
      log("Not logged in.  Invalid or expired token provided.", "clnt", "info");
      isLoggedInRet = false;
      authToken = null;
    }
  }

  let actions = null;
  const timestamp = isClientConnected(clientToken, authToken);
  if (!clientToken || timestamp < 0) {
    // create client record and return clientToken to client.
    const { clientToken: clientTokenNew } = await createClient(
      req.ip,
      req.body.localIPAddress,
      req.body.clientType ? req.body.clientType : Defs.clientType_pc,
      req.body.clientMode ? req.body.clientMode : Defs.clientMode_pcOnly,
      req.body.clientName,
      userId,
      authToken,
      true
    );
    clientTokenRet = clientTokenNew;
  } else {
    if (timestamp === 0)
      result = await updateClientOnLineState(clientToken, true);

    const { actionAcks } = req.body;

    actions = await checkForAction(clientToken, actionAcks);
  }

  if (clientsSansLocalIPAddress.has(clientToken) && req.body.localIPAddress) {
    await updateClientLocalIPAddress(clientToken, req.body.localIPAddress);
    clientsSansLocalIPAddress.delete(clientToken);
  }

  res.send({ clientToken: clientTokenRet, isLoggedIn: isLoggedInRet, actions });
});

router.post("/heartbeat", async (req, res) => {
  const clientToken = req.header("x-client-token");

  log(
    "POST heartbeat - new -: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")) +
      ", reqData = " +
      JSON.stringify(req.body, null, 2),
    "clnt",
    "info"
  );

  // must have a client token.
  if (!isValidClient(res, clientToken, true, null, false, false)) return;

  let userId = 0;
  let isLoggedInRet = true;

  let authToken = req.header("x-auth-token");
  if (authToken === "") authToken = null;
  log("authToken=" + authToken, "clnt", "info");

  if (!authToken) {
    log("Not logged in.  No token provided.", "clnt", "info");
    isLoggedInRet = false;
  } else {
    userId = isLoggedIn(authToken);
    if (userId === 0) {
      log("Not logged in.  Invalid or expired token provided.", "clnt", "info");
      isLoggedInRet = false;
      authToken = null;
    }
  }

  let actions = null;
  const timestamp = isClientConnected(clientToken, authToken);
  if (timestamp === 0)
    result = await updateClientOnLineState(clientToken, true);

  const { actionAcks } = req.body;

  actions = await checkForAction(clientToken, actionAcks);

  //?? TODO - get rid of this.
  if (clientsSansLocalIPAddress.has(clientToken) && req.body.localIPAddress) {
    await updateClientLocalIPAddress(clientToken, req.body.localIPAddress);
    clientsSansLocalIPAddress.delete(clientToken);
  }

  res.send({ isLoggedIn: isLoggedInRet, actions });
});

router.get("/clientname", async (req, res) => {
  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");

  log(
    "GET clientname: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "clnt"
  );

  if (!isValidClient(res, clientToken, true, authToken, true, false)) return;

  const results = await getClientName(clientToken);

  res.send(results);
});

router.post("/clientname", async (req, res) => {
  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");

  log(
    "POST clientname: clientToken = " +
      clientToken +
      timestampToString(req.header("x-timestamp")) +
      ", reqData = " +
      JSON.stringify(req.body, null, 2),
    "clnt"
  );

  if (!isValidClient(res, clientToken, true, authToken, true, false)) return;

  const results = await setClientName(clientToken, req.body.clientName);

  res.send(results);
});

router.post("/client", async (req, res) => {
  log(
    "POST client: reqData = " + JSON.stringify(req.body, null, 2),
    "clnt",
    "info"
  );

  // create client record.
  const results = await createClientX(
    req.ip,
    req.body.localIPAddress,
    req.body.interfaceName,
    req.body.clientType,
    req.body.clientToken,
    req.body.clientName
  );

  log(
    "<<<POST client: results = " + JSON.stringify(results, null, 2),
    "clnt",
    "info"
  );

  res.send(results);
});

router.post("/clientbyserialnumber", async (req, res) => {
  log(
    "POST clienty: reqData = " + JSON.stringify(req.body, null, 2),
    "clnt",
    "info"
  );

  // create client record.
  const results = await createClientBySerialNumber(
    req.ip,
    req.body.localIPAddress,
    req.body.interfaceName,
    req.body.clientType,
    req.body.clientToken,
    req.body.clientName
  );

  log(
    "<<<POST clientbyserialnumber: results = " +
      JSON.stringify(results, null, 2),
    "clnt",
    "info"
  );

  //?? TODO - else where
  const { __hadError__ } = results;
  const httpStatus = __hadError__
    ? Defs.httpStatusUnprocessableEntity
    : Defs.httpStatusOk;

  res.status(httpStatus).send(results);
});

router.post("/trace", async (req, res) => {
  const clientToken = req.header("x-client-token");
  log(
    "POST trace: clientToken = " +
      clientToken +
      ", reqData = " +
      JSON.stringify(req.body),
    "clnt",
    "info"
  );

  res.send({});
});

module.exports = router;
