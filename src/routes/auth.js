const express = require("express");
const router = express.Router();

const Defs = require("iipzy-shared/src/defs");
const { handleError } = require("iipzy-shared/src/utils/handleError");
const { log, timestampToString } = require("iipzy-shared/src/utils/logFile");
const { loginUser, logoutUser, verifyUser } = require("../db/authDB");

const { sendDelayedResults } = require("../utils/sendDelayedResults");

const { isValidClient } = require("./validateClient");

router.post("/login", async (req, res) => {
  log(
    "POST auth/login: timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "auth"
  );

  const clientToken = req.header("x-client-token");
  if (!isValidClient(res, clientToken, true, null, false, false)) return;

  const userName = req.body.userName;
  const password = req.body.password;

  const results = await loginUser(userName, password, req.ip, clientToken);

  log("auth - authToken=" + results.authToken);

  if (results.isLoggedIn) {
    log("auth - success - authToken= " + results.authToken, "auth", "info");
    return res.status(Defs.httpStatusOk).send(results);
  }

  return sendDelayedResults(
    res,
    Defs.httpStatusUnauthorized,
    handleError(
      Defs.objectType_clientInstance,
      clientToken,
      Defs.statusInvalidCredentials,
      "Access denied. Invalid username or password"
    )
  );
});

router.post("/logout", async (req, res) => {
  log(
    "POST auth/logout: timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "auth",
    "info"
  );

  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");
  if (!isValidClient(res, clientToken, true, authToken, true, false)) return;

  const results = await logoutUser(authToken, clientToken);

  log(
    "<<<POST auth/logout: results = " + JSON.stringify(results),
    "auth",
    "info"
  );
  res.send(results);
});

router.post("/verify", async (req, res) => {
  log(
    "POST auth/verify: timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "auth"
  );

  const userName = req.body.userName;
  const password = req.body.password;

  const results = await verifyUser(userName, password);

  if (results.verified) {
    log("auth - verified", "auth", "info");
    return res.status(Defs.httpStatusOk).send(results);
  }

  return sendDelayedResults(
    res,
    Defs.httpStatusUnauthorized,
    handleError(
      Defs.objectType_clientInstance,
      "",
      Defs.statusInvalidCredentials,
      "Access denied. Invalid username or password"
    )
  );
});

module.exports = router;
