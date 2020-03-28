const express = require("express");
const router = express.Router();
const path = require("path");
const schedule = require("node-schedule");

const Defs = require("iipzy-shared/src/defs");
const { handleError } = require("iipzy-shared/src/utils/handleError");
const { log, timestampToString } = require("iipzy-shared/src/utils/logFile");
const {
  clearClientIperf3DailyCount,
  getAllowIperf3Use,
  updateClientIperf3UseCount
} = require("../db/clientDB");
const { getIperf3Servers } = require("../db/iperf3ServerDB");

const { isValidClient } = require("./validateClient");

let iperf3Path = null;
switch (process.platform) {
  case "darwin": {
    iperf3Path = "iperf3";
    break;
  }
  case "linux": {
    iperf3Path = "iperf3";
    break;
  }
  case "win32": {
    iperf3Path = path.resolve(__dirname, "../../extraResources/iperf3");
    break;
  }
}

log("iperf3Path=" + iperf3Path, "iprf", "info");

const iperf3ServerByInstanceGuid = new Map();

async function populateIperf3Servers() {
  const { iperf3Servers, __hadError__ } = await getIperf3Servers();
  if (__hadError__) return;

  for (let i = 0; i < iperf3Servers.length; i++) {
    let server = iperf3Servers[i];
    server.token = "";
    iperf3ServerByInstanceGuid.set(server.instanceGuid, server);
    log("  instanceGuid     = " + server.instanceGuid, "iprf", "info");
    log("  instanceIPV4Addr = " + server.instanceIPV4Addr, "iprf", "info");
    log("  instanceURL      = " + server.instanceURL, "iprf", "info");
    log("  latitude         = " + server.latitude, "iprf", "info");
    log("  longitude        = " + server.longitude, "iprf", "info");
  }
}
populateIperf3Servers();

function scheduleDailyWork() {
  const rule = new schedule.RecurrenceRule();
  rule.dayOfWeek = [new schedule.Range(0, 6)];
  rule.hour = 8; // NB: UTC.
  rule.minute = 1;

  const j = schedule.scheduleJob(rule, async function() {
    log("running daily cleanup", "iprf", "info");
    await clearClientIperf3DailyCount();
  });
}

scheduleDailyWork();

// NB: from iipzy-client or appliance
router.get("/server", async (req, res) => {
  log(
    "GET - iperf3/server: timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "iprf",
    "info"
  );

  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");
  if (!isValidClient(res, clientToken, true, authToken, true, false)) return;

  // see if daily request limit has been exceeded.
  const allowIperf3Use = await getAllowIperf3Use(clientToken);
  log("allowIperf3Use =" + allowIperf3Use, "iprf", "info");
  if (!allowIperf3Use) {
    results = handleError(
      "client",
      clientToken,
      Defs.statusDailyIperf3LimitReached,
      "Daily Speed Test limit reached"
    );
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  // TODO:  find server based on client location.
  let server = null;
  for (let [guid, server_] of iperf3ServerByInstanceGuid) {
    if (!server) server = server_;
  }
  if (server)
    res.send({ iperf3Server: server.instanceURL, iperf3Token: server.token });
  else {
    results = handleError(
      "client",
      clientToken,
      Defs.statusCannotAllocateIperf3Server,
      "Could not access Speed Test Server"
    );
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }
});

// NB: from iipzy-client or appliance
router.get("/pingtarget", async (req, res) => {
  log(
    "GET - iperf3/pingtarget: timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "iprf",
    "info"
  );

  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");
  if (!isValidClient(res, clientToken, true, authToken, true, false)) return;

  // TODO:  find server based on client location.
  let server = null;
  for (let [guid, server_] of iperf3ServerByInstanceGuid) {
    if (!server) server = server_;
  }
  if (server) res.send({ pingTarget: sansPort(server.instanceURL) });
  else res.send({});
});

// NB: from iipzy-iperf3Server.
router.post("/token", async (req, res) => {
  log(
    "POST iperf3/token: timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "iprf",
    "info"
  );

  const iperf3InstanceGuid = req.body.iperf3InstanceGuid;
  const iperf3Token = req.body.iperf3Token;
  log(
    "POST iperf3: iperf3InstanceGuid = " + iperf3InstanceGuid,
    "iprf",
    "info"
  );
  log("POST iperf3: iperf3Token        = " + iperf3Token, "iprf", "info");
  log("POST iperf3: req.ip             = " + req.ip, "iprf", "info");

  const server = iperf3ServerByInstanceGuid.get(iperf3InstanceGuid);
  if (!server || !isValidIp(server.instanceIPV4Addr, req.ip)) {
    log(
      "(Error) POST iperf3/token: invalid instance or ip address",
      "iprf",
      "info"
    );
    setTimeout(() => {
      // ignore.  Send response in 5 seconds.
      res.send({});
    }, 5 * 1000);
    return;
  }
  server.token = iperf3Token;
  iperf3ServerByInstanceGuid.set(server.instanceGuid, server);

  res.send({});
});

// NB: from iipzy-iperf3Server.
router.post("/tokenused", async (req, res) => {
  log(
    "POST iperf3/tokenused: timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "iprf",
    "info"
  );

  const clientToken = req.body.clientToken;
  const iperf3InstanceGuid = req.body.iperf3InstanceGuid;
  const iperf3Token = req.body.iperf3Token;
  log("POST iperf3: clientToken        = " + clientToken, "iprf", "info");
  log(
    "POST iperf3: iperf3InstanceGuid = " + iperf3InstanceGuid,
    "iprf",
    "info"
  );
  log("POST iperf3: iperf3Token        = " + iperf3Token, "iprf", "info");
  log("POST iperf3: req.ip             = " + req.ip, "iprf", "info");

  const server = iperf3ServerByInstanceGuid.get(iperf3InstanceGuid);
  if (!server || !isValidIp(server.instanceIPV4Addr, req.ip)) {
    log(
      "(Error) POST iperf3/tokenused: invalid instance or ip address",
      "iprf",
      "info"
    );
    setTimeout(() => {
      // ignore.  Send response in 5 seconds.
      res.send({});
    }, 5 * 1000);
    return;
  }

  await updateClientIperf3UseCount(clientToken);

  res.send({});
});

function isValidIp(instanceIPV4Addr, reqIp) {
  // validate.
  return instanceIPV4Addr === reqIp;
}

function sansPort(url) {
  let r = url.indexOf(":");
  if (r < 0) return url;
  return url.substring(0, r);
}

module.exports = router;
