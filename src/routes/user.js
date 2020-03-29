const express = require("express");
const router = express.Router();

const Defs = require("iipzy-shared/src/defs");
const { log, timestampToString } = require("iipzy-shared/src/utils/logFile");
const { handleError } = require("iipzy-shared/src/utils/handleError");

const { sendEmail } = require("../utils/emailSender");
const { generateRandomCode } = require("../utils/generateRandomCode");
const { sendDelayedResults } = require("../utils/sendDelayedResults");
const {
  deleteUser,
  getUser,
  insertUser,
  isUserWhiteListed,
  setNewPassword,
  setPasswordResetCode,
  updateUser,
  verifyUser
} = require("../db/userDB");
const { isLoggedIn } = require("../db/authDB");

const { isValidClient } = require("./validateClient");

router.delete("/", async (req, res) => {
  log(
    "DELETE user: timestamp = " + timestampToString(req.header("x-timestamp")),
    "user",
    "info"
  );

  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");
  if (!isValidClient(res, clientToken, true, authToken, true, true)) return;

  const userId = isLoggedIn(authToken);

  log("delete user: userId " + userId, "user", "info");

  const results = await deleteUser(userId);

  if (results.__hadError__) {
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  res.send({});
});

router.get("/", async (req, res) => {
  log(
    "GET user: timestamp = " + timestampToString(req.header("x-timestamp")),
    "user",
    "info"
  );

  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");
  if (!isValidClient(res, clientToken, true, authToken, true, false)) return;

  const userId = isLoggedIn(authToken);

  log("get user: userId " + userId, "user", "info");

  results = await getUser(userId);

  if (results.__hadError__) {
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  log("get user: userId=" + results.userId, "user", "info");
  log("get user: userName=" + results.userName, "user", "info");
  log("get user: mobilePhoneNo=" + results.mobilePhoneNo, "user", "info");
  log("get user: emailAddress=" + results.emailAddress, "user", "info");
  log("get user: isAdmin=" + results.isAdmin, "user", "info");

  res.send({
    userId: results.userId,
    userName: results.userName,
    mobilePhoneNo: results.mobilePhoneNo,
    emailAddress: results.emailAddress,
    isAdmin: results.isAdmin
  });
});

router.post("/", async (req, res) => {
  log(
    "POST user: timestamp = " + timestampToString(req.header("x-timestamp")),
    "user",
    "info"
  );

  const clientToken = req.header("x-client-token");
  if (!isValidClient(res, clientToken, true, null, false, false)) return;

  const userName = req.body.userName;
  const mobilePhoneNo = req.body.mobilePhoneNo;
  const emailAddress = req.body.emailAddress;
  const password = req.body.password;

  log("post user: userName=" + userName, "user", "info");
  log("post user: mobilePhoneNo=" + mobilePhoneNo, "user", "info");
  log("post user: emailAddress=" + emailAddress, "user", "info");

  if (!(await isUserWhiteListed(userName))) {
    log(
      "post user: user is not white listed.  Dropping request" + userName,
      "user",
      "info"
    );
    return sendDelayedResults(
      res,
      Defs.httpStatusBadRequest,
      handleError(
        Defs.objectType_clientInstance,
        params.tgtClientToken,
        Defs.statusUserNotInWhiteList,
        "User name " + userName + " does not have permission to register"
      ),
      60 * 1000
    );
  }

  const verificationCode = generateRandomCode(6, { type: "number" });

  results = await insertUser(
    userName,
    mobilePhoneNo,
    emailAddress,
    password,
    verificationCode
  );

  if (results.__hadError__) {
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  if (results != null) {
    log("userId = " + results.userId, "user", "info");
  }

  // send verfication code.
  await sendEmail(
    emailAddress,
    "Your iipzy.com verification code",
    "Your code is " + verificationCode + ".  You have five minutes."
  );

  res.send(results);
});

router.post("/newpassword", async (req, res) => {
  log(
    "POST user/newpassword: timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "user",
    "info"
  );

  const clientToken = req.header("x-client-token");
  if (!isValidClient(res, clientToken, true, null, false, false)) return;

  let results = {};
  const userName = req.body.userName;
  const passwordResetCode = req.body.passwordResetCode;
  const password = req.body.password;

  log(
    "post user/newpassword: userName = " +
      userName +
      ", passwordResetCode = " +
      passwordResetCode,
    "user",
    "info"
  );

  results = await setNewPassword(userName, passwordResetCode, password);

  if (results.__hadError__) {
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  res.send(results);
});

router.post("/sendcode", async (req, res) => {
  log(
    "POST user/sendcode: timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "user",
    "info"
  );

  const clientToken = req.header("x-client-token");
  if (!isValidClient(res, clientToken, true, null, false, false)) return;

  let results = {};
  const userName = req.body.userName;

  log("post user/sendcode: userName=" + userName, "user", "info");

  const passwordResetCode = generateRandomCode(6, { type: "number" });

  results = await setPasswordResetCode(userName, passwordResetCode);

  if (results.__hadError__) {
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  if (results.emailAddress) {
    // send password reset code.
    await sendEmail(
      results.emailAddress,
      "Your iipzy.com password reset code",
      "Your code is " + passwordResetCode + ".  You have five minutes."
    );
  }

  res.send(results);
});

router.put("/verify", async (req, res) => {
  log(
    "PUT user/verify: timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "user",
    "info"
  );

  const clientToken = req.header("x-client-token");
  if (!isValidClient(res, clientToken, true, null, false, false)) return;

  let results = {};

  const userId = req.body.userId;
  const verificationCode = req.body.verificationCode;

  results = await verifyUser(userId, verificationCode);

  if (results.__hadError__) {
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  res.send(results);
});

router.put("/user", async (req, res) => {
  log(
    "PUT user/user: timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "user",
    "info"
  );

  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");
  if (!isValidClient(res, clientToken, true, authToken, true, false)) return;

  let results = {};

  const userId = isLoggedIn(authToken);

  const mobilePhoneNo = req.body.mobilePhoneNo;
  const emailAddress = req.body.emailAddress;
  const password = req.body.password;

  result = await updateUser(userId, mobilePhoneNo, emailAddress, password);

  if (results.__hadError__) {
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  res.send(results);
});

module.exports = router;
