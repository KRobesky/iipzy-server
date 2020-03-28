const express = require("express");
const app = express();
const https = require("https");
const fs = require("fs");

const Defs = require("iipzy-shared/src/defs");
const { ConfigFile } = require("iipzy-shared/src/utils/configFile");
const {
  fileExistsAsync,
  fileDeleteAsync,
  fileReadAsync,
  fileWriteAsync
} = require("iipzy-shared/src/utils/fileIO");
const { log, logInit, setLogLevel } = require("iipzy-shared/src/utils/logFile");
const periodicHandler = require("iipzy-shared/src/utils/periodicHandler");
const { processErrorHandler } = require("iipzy-shared/src/utils/utils");

const logPath = process.platform === "win32" ? "c:/temp/" : "/var/log";
logInit(logPath, "iipzy-server");

require("./startup/routes")(app);
const {
  init: monitorEventsInit
} = require("./backgroundServices/monitorEvents");
const { init: userInit } = require("./backgroundServices/user");
const { addEvent } = require("./db/eventDB");

const userDataPath = "/etc/iipzy";

let configFile = null;

let logLevel = undefined;

let server = null;

const highCpuPercentAlertMinutes = 1;
const highCpuPercentAlertThreshold = 50;
let highCpuPercentStartTime = 0;
let highCpuPercentAlertSent = false;

async function main() {
  configFile = new ConfigFile(userDataPath, Defs.configFilename);
  await configFile.init();
  configFile.watch(configWatchCallback);
  logLevel = configFile.get("logLevel");
  if (logLevel) setLogLevel(logLevel);
  else configFile.set("logLevel", "info");

  monitorEventsInit();
  userInit();
  periodicHandler.init({});
  setInterval(async () => {
    try {
      const periodicData = periodicHandler.periodicCB();
      if (periodicData) {
        // check cpu usage.
        const userPercent = periodicData.cpuInfo.userPercent;
        log("periodic - userPercent = " + userPercent, "main", "info");
        if (userPercent > highCpuPercentAlertThreshold) {
          if (highCpuPercentStartTime) {
            if (
              Date.now() - highCpuPercentStartTime >
              highCpuPercentAlertMinutes * 60 * 1000
            ) {
              if (!highCpuPercentAlertSent) {
                const eventJSON = JSON.stringify({
                  clientToken: "server",
                  clientName: "server",
                  userId: Defs.headBuzzardUserId,
                  isOnLine: false,
                  isLoggedIn: false,
                  message:
                    "cpu usage greater than " +
                    highCpuPercentAlertThreshold +
                    "% for more than " +
                    highCpuPercentAlertMinutes +
                    " minute(s)"
                });

                await addEvent(
                  Defs.eventClass_cpuusage,
                  Defs.objectType_server,
                  0,
                  Defs.eventClass_null,
                  Defs.objectType_null,
                  Defs.eventId_null,
                  Defs.eventActive_activeAutoInactive,
                  eventJSON,
                  Defs.headBuzzardUserId
                );
                highCpuPercentAlertSent = true;
              }
            }
          } else highCpuPercentStartTime = Date.now();
        } else highCpuPercentStartTime = 0;
      }
    } catch (ex) {
      log("(Exception) periodicHandler.periodicCB: " + ex, "main", "error");
    }
  }, 60 * 1000);
  await checkProcessStopFile();

  //const port = process.env.PORT || config.get("port");

  const port = 8001;
  server = https
    .createServer(
      {
        key: fs.readFileSync(__dirname + "/certificate/server.key"),
        cert: fs.readFileSync(__dirname + "/certificate/server.cert")
      },
      app
    )
    .listen(port, () => {
      log(`Listening on port ${port}...`, "main", "info");
    });

  // server = app.listen(port, () =>
  //   log(`Listening on port ${port}...`, "main", "info")
  // );
}

function configWatchCallback() {
  log("configWatchCallback", "main", "info");
  const logLevel_ = configFile.get("logLevel");
  if (logLevel_ !== logLevel) {
    log(
      "configWatchCallback: logLevel change: old = " +
        logLevel +
        ", new = " +
        logLevel_,
      "main",
      "info"
    );
  }
  if (logLevel_) {
    // tell log.
    logLevel = logLevel_;
    setLogLevel(logLevel);
  }
}

processErrorHandler(processStopHandler, processAlertHandler);

main();

async function processStopHandler(message) {
  console.log(
    "-----------------------processStopHandler: message = '" + message + "'"
  );
  const processStopMessage = userDataPath + "/" + Defs.crashFilename;
  await fileWriteAsync(processStopMessage, message);
  console.log("<<<-----------------------processStopHandler");
}

async function checkProcessStopFile() {
  const processStopMessage = userDataPath + "/" + Defs.crashFilename;
  if (await fileExistsAsync(processStopMessage)) {
    const message = await fileReadAsync(processStopMessage);

    log("checkProcessStopFile: message = '" + message + "'", "main", "info");

    const eventJSON = JSON.stringify({
      clientToken: "server",
      clientName: "server",
      userId: Defs.headBuzzardUserId,
      isOnLine: false,
      isLoggedIn: false,
      message: message.toString()
    });

    await addEvent(
      Defs.eventClass_crash,
      Defs.objectType_server,
      0,
      Defs.eventClass_null,
      Defs.objectType_null,
      Defs.eventId_null,
      Defs.eventActive_activeAutoInactive,
      eventJSON,
      Defs.headBuzzardUserId
    );

    await fileDeleteAsync(processStopMessage);
    await fileDeleteAsync(processStopMessage + ".bak");
  }
}

async function processAlertHandler(message) {
  log("processAlertHandler: message = '" + message + "'", "main", "info");

  const eventJSON = JSON.stringify({
    clientToken: "server",
    clientName: "server",
    userId: Defs.headBuzzardUserId,
    isOnLine: false,
    isLoggedIn: false,
    message: message.toString()
  });

  await addEvent(
    Defs.eventClass_crash,
    Defs.objectType_server,
    0,
    Defs.eventClass_null,
    Defs.objectType_null,
    Defs.eventId_null,
    Defs.eventActive_activeAutoInactive,
    eventJSON,
    Defs.headBuzzardUserId
  );
}

/*
async function fileDeleteAsync(path) {
  return await new Promise((resolve, reject) => {
    fs.unlink(path, err => {
      if (err) resolve(false);
      else resolve(true);
    });
  });
}

async function fileExistsAsync(path) {
  return await new Promise((resolve, reject) => {
    fs.exists(path, exists => {
      resolve(exists);
    });
  });
}

async function fileReadAsync(path) {
*/
module.exports = server;
