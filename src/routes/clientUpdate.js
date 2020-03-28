const express = require("express");
const router = express.Router();
const fs = require("fs");
const mime = require("mime");
const path = require("path");

const Defs = require("iipzy-shared/src/defs");
const {
  fileExistsAsync,
  fileReadAsync
} = require("iipzy-shared/src/utils/fileIO");
const { handleError } = require("iipzy-shared/src/utils/handleError");
const { log, timestampToString } = require("iipzy-shared/src/utils/logFile");

const { sendDelayedResults } = require("../utils/sendDelayedResults");

const { isValidClient } = require("./validateClient");

const packageDotJsonFileWin =
  "/root/iipzy-service/iipzy-client-installer-win/package.json";
const packageDotJsonFileMac =
  "/root/iipzy-service/iipzy-client-installer-mac/package.json";

const clientInstallerFileMac =
  "/root/iipzy-service/iipzy-client-installer-mac/iipzyclient.dmg";
const clientInstallerFileWin =
  "/root/iipzy-service/iipzy-client-installer-win/IipzyClientAppInstaller.exe";
const raspberryPiImageFile =
  "/root/iipzy-service/iipzy-raspberry-pi-image/iipzypi.zip";

router.get("/version", async (req, res) => {
  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");

  log(
    "POST clientupdate/version: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "dnld",
    "info"
  );

  //if (!isValidClient(res, clientToken, true, authToken, true, false)) return;

  if (!(await fileExistsAsync(packageDotJsonFileWin))) {
    const results = handleError(
      Defs.objectType_clientInstance,
      clientToken,
      Defs.statusDoesNotExist,
      "iipzy client version file is missing"
    );
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  if (!(await fileExistsAsync(clientInstallerFileWin))) {
    const results = handleError(
      Defs.objectType_clientInstance,
      clientToken,
      Defs.statusDoesNotExist,
      "iipzy client installer file is missing"
    );
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  const { version } = JSON.parse(await fileReadAsync(packageDotJsonFileWin));

  return res.send({ version });
});

router.get("/version-mac", async (req, res) => {
  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");

  log(
    "POST clientupdate/version-mac: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "dnld",
    "info"
  );

  //if (!isValidClient(res, clientToken, true, authToken, true, false)) return;

  if (!(await fileExistsAsync(packageDotJsonFileMac))) {
    const results = handleError(
      Defs.objectType_clientInstance,
      clientToken,
      Defs.statusDoesNotExist,
      "iipzy client version file is missing"
    );
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  if (!(await fileExistsAsync(clientInstallerFileMac))) {
    const results = handleError(
      Defs.objectType_clientInstance,
      clientToken,
      Defs.statusDoesNotExist,
      "iipzy client installer file is missing"
    );
    return res.status(Defs.httpStatusUnprocessableEntity).send(results);
  }

  const { version } = JSON.parse(await fileReadAsync(packageDotJsonFileMac));

  return res.send({ version });
});

router.get("/update", async (req, res) => {
  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");

  log(
    "POST clientupdate/update-win: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "dnld",
    "info"
  );

  if (!isValidClient(res, clientToken, true, authToken, true, false)) return;

  get_helper(req, res, clientInstallerFileWin);
});

router.get("/update-mac", async (req, res) => {
  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");

  log(
    "POST clientupdate/update-mac: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "dnld",
    "info"
  );

  if (!isValidClient(res, clientToken, true, authToken, true, false)) return;

  get_helper(req, res, clientInstallerFileMac);
});

// router.get("/3a64e440398a4b21921050d4e355c73b", async (req, res) => {
//   log("GET clientupdate/3a64e440398a4b21921050d4e355c73b", "dnld", "info");

//   get_helper(req, res, clientInstallerFileWin);
// });

// router.get("/633818c8947343ac830a43b9f7ca6db3", async (req, res) => {
//   log("GET clientupdate/633818c8947343ac830a43b9f7ca6db3", "dnld", "info");

//   get_helper(req, res, clientInstallerFileMac);
// });

router.get("/bacec2a221264e32bdc3aa886e80a1b1", async (req, res) => {
  log("GET clientupdate/bacec2a221264e32bdc3aa886e80a1b1", "dnld", "info");

  get_helper(req, res, raspberryPiImageFile);
});

async function get_helper(req, res, file) {
  if (!(await fileExistsAsync(file))) {
    return res.status(Defs.httpStatusUnprocessableEntity).send();
  }

  const filename = path.basename(file);
  const mimetype = mime.lookup(file);

  log(
    "POST clientupdate/update: filename = " +
      filename +
      ", mimetype = " +
      mimetype,
    "dnld",
    "info"
  );

  res.setHeader("Content-disposition", "attachment; filename=" + filename);
  res.setHeader("Content-type", mimetype);

  log("POST clientupdate/update: before createReadStream", "dnld", "info");

  var filestream = fs.createReadStream(file);
  filestream.pipe(res);
}

module.exports = router;
