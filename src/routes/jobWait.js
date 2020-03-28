const express = require("express");
const router = express.Router();
const uuidv4 = require("uuid/v4");

const Defs = require("iipzy-shared/src/defs");
const { log, timestampToString } = require("iipzy-shared/src/utils/logFile");

const { isValidClient } = require("./validateClient");

//??
let sent = true;

router.get("/", async (req, res) => {
  log(
    "GET jobWait: timestamp = " + timestampToString(req.header("x-timestamp")),
    "jobw",
    "info"
  );

  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");
  if (!isValidClient(res, clientToken, true, authToken, true, false)) return;

  if (!sent) {
    const req = { jobUuid: uuidv4(), jobParams: "tail" };
    setTimeout(() => {
      res.send(req);
    }, 2 * 1000);
    sent = true;
  } else {
    setTimeout(() => {
      res.send({});
    }, 5 * 1000);
  }
});

let count = 0;

router.put("/job", async (req, res) => {
  log(
    "PUT job: timestamp = " + timestampToString(req.header("x-timestamp")),
    "jobw",
    "info"
  );

  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");
  if (!isValidClient(res, clientToken, true, authToken, true, false)) return;

  const { jobUuid, str, done } = req.body;

  log("job: uuid = " + jobUuid + ", str: '" + str + "'", "jobw", "info");

  //count++;
  const cancel = count >= 1000;

  res.send({ cancel: cancel });
});

module.exports = router;
