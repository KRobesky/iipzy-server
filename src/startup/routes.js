const express = require("express");

const Defs = require("iipzy-shared/src/defs");
const { handleError } = require("iipzy-shared/src/utils/handleError");
const { log } = require("iipzy-shared/src/utils/logFile");

const administrator = require("../routes/administrator");
const alert = require("../routes/alert");
const areYouServer = require("../routes/areYouServer");
const auth = require("../routes/auth");
const client = require("../routes/client");
const clientUpdate = require("../routes/clientUpdate");
const fileUpload = require("../routes/fileUpload");
const iperf3 = require("../routes/iperf3");
const jobWait = require("../routes/jobWait");
const myIPAddress = require("../routes/myIPAddress");
const sentinelAdmin = require("../routes/sentinelAdmin");
const thirdPartyApi = require("../routes/thirdPartyApi");
const updater = require("../routes/updater");
const user = require("../routes/user");

function error(err, req, res, next) {
  log("(Error) " + err.message, "rout", "error");
  res
    .status(Defs.httpStatusInternalError)
    .send(
      handleError(Defs.objectType_null, "", Defs.statusRouteError, err.message)
    );
}

module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Methods",
      "PUT, GET, POST, DELETE, OPTIONS"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, " +
        Defs.httpCustomHeader_XAuthToken +
        ", " +
        Defs.httpCustomHeader_XClientToken +
        ", " +
        Defs.httpCustomHeader_XConnToken +
        ", " +
        Defs.httpCustomHeader_XTimestamp +
        ", " +
        Defs.httpCustomHeader_XWebClient
    );
    next();
  });
  app.use(express.json());
  app.use("/api/administrator", administrator);
  app.use("/api/alert", alert);
  app.use("/api/areyouserver", areYouServer);
  app.use("/api/auth", auth);
  app.use("/api/client", client);
  app.use("/api/clientupdate", clientUpdate);
  app.use("/api/fileupload", fileUpload);
  app.use("/api/heartbeat", client);
  app.use("/api/iperf3", iperf3);
  app.use("/api/jobWait", jobWait);
  app.use("/api/myipaddress", myIPAddress);
  app.use("/api/sentineladmin", sentinelAdmin);
  app.use("/api/thirdpartyapi", thirdPartyApi);
  app.use("/api/updater", updater);
  app.use("/api/user", user);
  app.use(error);
};
