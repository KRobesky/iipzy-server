const Defs = require("iipzy-shared/src/defs");
const {
  handleDBException,
  handleError
} = require("iipzy-shared/src/utils/handleError");
const { log } = require("iipzy-shared/src/utils/logFile");
const {
  abortTransaction,
  beginTransaction,
  commitTransaction,
  epochToMySqlDatetime,
  format,
  getConnection,
  query,
  release
} = require("../utils/mysql");

const updateInstanceByClientToken = new Map();
const updateInstanceByUpdateUuid = new Map();

// request from an updater.
async function checkForUpdate(clientToken, updateStatus) {
  log("updaterDB.checkForUpdate: clientToken = " + clientToken, "updt", "info");

  let updateInstance = updateInstanceByClientToken.get(clientToken);
  if (updateInstance) {
    updateInstance.updateStatus = updateStatus;
    log(
      "updaterDB.checkForUpdate - updateInstance1: " +
        JSON.stringify(updateInstance, null, 2),
      "updt"
    );
    //
    if (updateInstance.starting || updateInstance.updateStatus.inProgress) {
      if (updateInstance.updateStatus.inProgress)
        updateInstance.starting = false;
      return {
        status: Defs.statusOk,
        results: {
          params: updateInstance.params,
          starting: updateInstance.starting
        }
      };
    }
    if (!updateInstance.completed) {
      updateInstance.completed = true;
      log(
        "POST updater - completed: " + JSON.stringify(updateInstance, null, 2),
        "updt"
      );
    }
  } else {
    updateInstance = { updateStatus };
    log(
      "POST updater/heartbeat - updateInstance2: " +
        JSON.stringify(updateInstance, null, 2),
      "updt"
    );
    updateInstanceByClientToken.set(clientToken, updateInstance);
  }
  return { status: Defs.statusOk };
}

function getUpdateStatus(clientToken) {
  log("getUpdateStatus: tgtClientToken = " + clientToken, "updt", "info");
  const updateInstance = updateInstanceByClientToken.get(clientToken);
  let updateStatus = null;
  if (updateInstance && updateInstance.updateStatus) {
    updateStatus = updateInstance.updateStatus;
  } else {
    updateStatus = {
      inProgress: false,
      step: "done",
      failed: false
    };
  }

  log(
    "getUpdateStatus: status = " + JSON.stringify(updateStatus, null, 2),
    "updt"
  );

  return updateStatus;
}

function setUpdateStatus(clientToken, updateStatus) {
  const updateInstance = updateInstanceByClientToken.get(clientToken);
  if (updateInstance) {
    updateInstance.updateStatus = updateStatus;
    log(
      "setUpdateStatus: clientToken = " +
        clientToken +
        ", updateStatus = " +
        JSON.stringify(updateInstance.updateStatus, null, 2),
      "updt"
    );
  }
}

// request from a client.
async function startUpdate(params_) {
  const params = JSON.parse(JSON.stringify(params_));
  log(
    "updateDB.startUpdate: clientToken = " + params.tgtClientToken,
    "updt",
    "info"
  );

  let updateInstance = updateInstanceByClientToken.get(params.tgtClientToken);
  if (updateInstance && updateInstance.updateStatus) {
    // see if update is in progress.
    if (updateInstance.updateStatus.inProgress) {
      const results = handleError(
        Defs.objectType_clientInstance,
        params.tgtClientToken,
        Defs.statusUpdateInProgress,
        "Another update is already in progress"
      );
      return { status: Defs.statusUpdateInProgress, results };
    }
  }

  // get credentials.
  const credentials = await getGitCredentials();
  if (credentials) {
    params.credentials = credentials;
    updateInstance = { params, starting: true, completed: false };

    log(
      "POST updater - starting: " + JSON.stringify(updateInstance, null, 2),
      "updt"
    );

    updateInstanceByClientToken.set(
      updateInstance.params.tgtClientToken,
      updateInstance
    );
    updateInstanceByUpdateUuid.set(
      updateInstance.params.updateUuid,
      updateInstance
    );

    return { status: Defs.statusOk, results: {} };
  } else {
    const results = handleError(
      Defs.objectType_clientInstance,
      params.tgtClientToken,
      Defs.statusDoesNotExist,
      "git credentials not in db"
    );
    return { status: Defs.statusDoesNotExist, results };
  }
}

async function getGitCredentials() {
  log(">>>getGitCredentials", "updt", "info");

  let credentials = "";

  const connection = await getConnection("getGitCredentials");

  try {
    const selectStatement = "SELECT Credentials FROM GitCredentials";
    log("select: '" + selectStatement + "'", "updt", "info");

    const { result } = await query(connection, selectStatement);

    credentials = result[0].Credentials;
  } catch (err) {
    log("(Exception) getGitCredentials: " + err, "updt", "info");
    results = handleDBException("event", "", "select", err);
  }

  release(connection, "getGitCredentials");

  log("<<<getGitCredentials: " + credentials, "updt", "info");

  return credentials;
}

async function getUpdateVersionInfo(clientToken) {}

async function setUpdateVersionInfo(clientToken, versionInfo) {
  log(">>>setUpdateVersionInfo", "updt", "info");

  /*
    "versionInfo": {
      "iipzyPi": {
        "version": "1.0.0",
        "sharedVersion": "1.0.0",
        "updateTime": 1585144638556
      },
      "iipzySentinelAdmin": {
        "version": "1.0.0",
        "sharedVersion": "1.0.0",
        "updateTime": 1581116958469
      },
      "iipzySentinelWeb": {
        "version": "0.1.0",
        "sharedVersion": "1.0.0",
        "updateTime": 1584643266339
      },
      "iipzyUpdater": {
        "version": "1.0.0",
        "sharedVersion": "1.0.0",
        "updateTime": 1584637699576
      }
    }
  */

  let results = {};

  const connection = await getConnection("setUpdateVersionInfo");

  try {
    await beginTransaction(connection, "setUpdateVersionInfo");

    let selectStatement = "SELECT Id FROM ClientInstance WHERE ClientToken = ?";
    selectStatement = format(selectStatement, [clientToken]);
    log("select: '" + selectStatement + "'", "updt", "info");
    const { result: result1 } = await query(connection, selectStatement);
    if (result1.length > 0) {
      const clientInstanceId = result1[0].Id;
      selectStatement =
        "SELECT Id FROM ClientInstanceVersionInfo WHERE ClientInstanceId = ?";
      selectStatement = format(selectStatement, [clientInstanceId]);
      log("select: '" + selectStatement + "'", "updt", "info");
      const { result: result2 } = await query(connection, selectStatement);
      if (result2.length > 0) {
        // update.
        const clientInstanceVersionInfoId = result2[0].Id;
        let updateStatement =
          "UPDATE ClientInstanceVersionInfo SET " +
          "ClientInstanceId = ?," +
          "SentinelUpdateTime = ?," +
          "SentinelPiVersion = ?," +
          "SentinelPiSharedVersion = ?," +
          "SentinelAdminUpdateTime = ?," +
          "SentinelAdminVersion = ?," +
          "SentinelAdminSharedVersion = ?," +
          "SentinelWebUpdateTime = ?," +
          "SentinelWebVersion = ?," +
          "SentinelWebSharedVersion = ?," +
          "UpdaterUpdateTime = ?," +
          "UpdaterVersion = ?," +
          "UpdaterSharedVersion = ?" +
          "WHERE Id = ?";
        updateStatement = format(updateStatement, [
          clientInstanceId,
          epochToMySqlDatetime(versionInfo.iipzyPi.updateTime),
          versionInfo.iipzyPi.version,
          versionInfo.iipzyPi.sharedVersion,
          epochToMySqlDatetime(versionInfo.iipzySentinelAdmin.updateTime),
          versionInfo.iipzySentinelAdmin.version,
          versionInfo.iipzySentinelAdmin.sharedVersion,
          epochToMySqlDatetime(versionInfo.iipzySentinelWeb.updateTime),
          versionInfo.iipzySentinelWeb.version,
          versionInfo.iipzySentinelWeb.sharedVersion,
          epochToMySqlDatetime(versionInfo.iipzyUpdater.updateTime),
          versionInfo.iipzyUpdater.version,
          versionInfo.iipzyUpdater.sharedVersion,
          clientInstanceVersionInfoId
        ]);
        log("update: '" + updateStatement + "'", "updt", "info");
        await query(connection, updateStatement);
      } else {
        // insert
        let insertStatement =
          "INSERT INTO ClientInstanceVersionInfo SET " +
          "ClientInstanceId = ?," +
          "SentinelUpdateTime = ?," +
          "SentinelPiVersion = ?," +
          "SentinelPiSharedVersion = ?," +
          "SentinelAdminUpdateTime = ?," +
          "SentinelAdminVersion = ?," +
          "SentinelAdminSharedVersion = ?," +
          "SentinelWebUpdateTime = ?," +
          "SentinelWebVersion = ?," +
          "SentinelWebSharedVersion = ?," +
          "UpdaterUpdateTime = ?," +
          "UpdaterVersion = ?," +
          "UpdaterSharedVersion = ?";
        insertStatement = format(insertStatement, [
          clientInstanceId,
          epochToMySqlDatetime(versionInfo.iipzyPi.updateTime),
          versionInfo.iipzyPi.version,
          versionInfo.iipzyPi.sharedVersion,
          epochToMySqlDatetime(versionInfo.iipzySentinelAdmin.updateTime),
          versionInfo.iipzySentinelAdmin.version,
          versionInfo.iipzySentinelAdmin.sharedVersion,
          epochToMySqlDatetime(versionInfo.iipzySentinelWeb.updateTime),
          versionInfo.iipzySentinelWeb.version,
          versionInfo.iipzySentinelWeb.sharedVersion,
          epochToMySqlDatetime(versionInfo.iipzyUpdater.updateTime),
          versionInfo.iipzyUpdater.version,
          versionInfo.iipzyUpdater.sharedVersion
        ]);
        log("insert: '" + insertStatement + "'", "updt", "info");
        await query(connection, insertStatement);
      }
    }

    await commitTransaction(connection, "setUpdateVersionInfo");
  } catch (err) {
    log("(Exception) setUpdateVersionInfo: " + err, "updt", "info");
    await abortTransaction(connection, "setUpdateVersionInfo");
    results = handleDBException("event", "", "select", err);
  }

  release(connection, "setUpdateVersionInfo");

  log("<<<setUpdateVersionInfo", "updt", "info");

  return results;
}

module.exports = {
  checkForUpdate,
  getUpdateStatus,
  getUpdateVersionInfo,
  setUpdateStatus,
  setUpdateVersionInfo,
  startUpdate
};
