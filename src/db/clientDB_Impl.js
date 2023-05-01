const schedule = require("node-schedule");
const uuidv4 = require("uuid/v4");

const Defs = require("iipzy-shared/src/defs");
const { handleDBException } = require("iipzy-shared/src/utils/handleError");
const { log } = require("iipzy-shared/src/utils/logFile");

// NB: this reference is needed so that ipapiRequest is initialized.
const { getIpAddressInfo } = require("../utils/ipapiRequest");
if (false) getIpAddressInfo();
const {
  abortTransaction,
  beginTransaction,
  commitTransaction,
  format,
  getConnection,
  query,
  release,
} = require("../utils/mysql");
// const TokenCache = require("../utils/TokenCache");
// const { getAuthTokenUserId } = require("./authTokenCache");
const {
  addClientToken,
  getClientToken,
  getClientTokenCacheMap,
  getClientTokenClientType,
  hasClientToken,
  modClientAuthToken,
  modClientToken,
  modClientTokenIsOnLine,
  modClientTokenTimestamp,
  remClientToken,
} = require("./clientTokenCache");
const { addEvent, addEventWithConnection } = require("./eventDB");

function scheduleDailyWork() {
  const rule = new schedule.RecurrenceRule();
  rule.dayOfWeek = [new schedule.Range(0, 6)];
  rule.hour = 8; // NB: UTC
  rule.minute = 3;

  const j = schedule.scheduleJob(rule, async function () {
    log("running daily cleanup", "clnt", "info");
    await dailyCleanup();
  });
}

let iperf3UseCountDailyLimit = 10;

async function getIperf3UseCountDailyLimit() {
  log(">>>getIperf3UseCountDailyLimit", "clnt", "info");

  const connection = await getConnection("getIperf3UseCountDailyLimit");

  try {
    const selectStatement =
      "SELECT Iperf3UseCountDailyLimit FROM SystemParameters";
    log("select: '" + selectStatement + "'", "clnt", "info");
    const { result } = await query(connection, selectStatement);
    if (result.length > 0 && result[0])
      iperf3UseCountDailyLimit = result[0].Iperf3UseCountDailyLimit;
  } catch (err) {
    log("(Exception) getIperf3UseCountDailyLimit: " + err, "clnt", "info");
    handleDBException("client", clientToken, "insert", err);
  }

  release(connection, "getIperf3UseCountDailyLimit");

  log(
    "<<<getIperf3UseCountDailyLimit: limit = " + iperf3UseCountDailyLimit,
    "clnt",
    "info"
  );
}

scheduleDailyWork();

getIperf3UseCountDailyLimit();

initClientTokenCache();

async function clearClientIperf3DailyCount() {
  log(">>>clearClientIperf3DailyCount", "clnt", "info");

  const connection = await getConnection("clearClientIperf3DailyCount");

  try {
    const updateStatement = "UPDATE ClientInstance SET Iperf3UseCountDaily = 0";
    log("update: '" + updateStatement + "'", "clnt", "info");

    await query(connection, updateStatement);
  } catch (err) {
    log("(Exception) clearClientIperf3DailyCount: " + err, "clnt", "info");
    handleDBException("client", clientToken, "insert", err);
  }

  release(connection, "clearClientIperf3DailyCount");

  log("<<<clearClientIperf3DailyCount", "clnt", "info");
}

async function createClient(
  publicIPAddress,
  localIPAddress,
  clientType,
  clientMode,
  clientName,
  userId,
  authToken,
  isOnLine
) {
  log(
    ">>>createClient: userId = " +
      userId +
      ", clientType = " +
      clientType +
      ", publicIPAddress = " +
      publicIPAddress +
      ", clientName = " +
      clientName +
      ", localIPAddress = " +
      localIPAddress,
    "db"
  );

  let results = {};

  const connection = await getConnection("createClient");

  try {
    let clientToken = null;
    // if ClientInstance.PublicIPAddress, LocalIPAddress exists, use it.
    await beginTransaction(connection, "createClient");

    let selectStatement =
      "SELECT ClientToken FROM ClientInstance WHERE PublicIPAddress = ? AND LocalIpAddress = ? AND ClientType = ?";
    selectStatement = format(selectStatement, [
      publicIPAddress,
      localIPAddress,
      clientType,
    ]);
    log("select: '" + selectStatement + "'", "clnt", "info");

    const { result, fields } = await query(connection, selectStatement);
    if (result.length > 0 && result[0]) {
      // already exists.
      clientToken = result[0].ClientToken;
      let updateStatement =
        "UPDATE ClientInstance SET ClientName = ?, UserId = ?, " +
        "AuthToken = ?, IsOnLine = ? WHERE ClientToken = ?";
      updateStatement = format(updateStatement, [
        clientName,
        userId,
        authToken,
        isOnLine,
        clientToken,
      ]);
      log("update: '" + updateStatement + "'", "clnt", "info");

      await query(connection, updateStatement);
    } else {
      // new entry.
      clientToken = uuidv4();
      // if (clientCount == 0) {
      let insertStatement =
        "INSERT INTO ClientInstance SET PublicIPAddress = ?, LocalIPAddress = ?, ClientToken = ?, ClientType = ?, " +
        "ClientName = ?, UserId = ?, AuthToken = ?, IsOnLine = ?";
      insertStatement = format(insertStatement, [
        publicIPAddress,
        localIPAddress,
        clientToken,
        clientType,
        clientName,
        userId,
        authToken,
        isOnLine,
      ]);
      log("insert: '" + insertStatement + "'", "clnt", "info");

      await query(connection, insertStatement);
    }

    results = { clientToken: clientToken };

    addClientToken(
      clientToken,
      clientType,
      authToken,
      isOnLine,
      clientType,
      false,
      false
    );

    await commitTransaction(connection, "createClient");
  } catch (err) {
    log("(Exception) createClient: " + err, "clnt", "info");
    await abortTransaction(connection, "createClient");
    results = handleDBException("client", clientToken, "insert", err);
  }

  release(connection, "createClient");

  log("<<<createClient", "clnt", "info");

  return results;
}

async function createClientBySerialNumber(
  publicIPAddress,
  localIPAddress,
  interfaceName,
  clientType,
  clientToken,
  clientName
) {
  log(
    ">>>createClientBySerialNumber: publicIPAddress = " +
      publicIPAddress +
      ", localIPAddress = " +
      localIPAddress +
      ", interfaceName = " +
      interfaceName +
      ", clientType = " +
      clientType +
      ", clientToken = " +
      clientToken +
      ", clientName = " +
      clientName,
    "db"
  );

  let results = {};

  const connection = await getConnection("createClientBySerialNumber");

  try {
    await beginTransaction(connection, "createClientBySerialNumber");

    // see if record with old style client token exists
    let selectStatement =
      "SELECT Id, ClientToken FROM ClientInstance WHERE PublicIPAddress = ? AND LocalIPAddress = ? AND ClientType = 'appliance'";

    selectStatement = format(selectStatement, [
      publicIPAddress,
      localIPAddress,
    ]);
    log("select: '" + selectStatement + "'", "clnt", "info");

    const { result: resultCheckOld } = await query(connection, selectStatement);
    if (resultCheckOld.length > 0) {
      if (resultCheckOld[0].ClientToken.indexOf(":") !== -1) {
        // delete old record.
        let deleteStatement =
          "DELETE ClientInstance FROM ClientInstance WHERE Id = ?";
        deleteStatement = format(deleteStatement, [resultCheckOld[0].Id]);
        log("delete: '" + deleteStatement + "'", "clnt", "info");

        await query(connection, deleteStatement);
      }
    }

    selectStatement =
      "SELECT Id, PublicIPAddress, LocalIPAddress, UserId, AuthToken FROM ClientInstance WHERE ClientToken = ?";
    selectStatement = format(selectStatement, [clientToken]);
    log("select: '" + selectStatement + "'", "clnt", "info");

    let doInsert = false;
    let doUpdate = false;
    let id = 0;
    let prevPublicIPAddress = null;
    let prevLocalIPAddress = null;
    let userId = 0;
    let authToken = null;
    const { result } = await query(connection, selectStatement);
    log("result: " + JSON.stringify(result));
    if (result.length > 0) {
      id = result[0].Id;
      prevPublicIPAddress = result[0].PublicIPAddress;
      prevLocalIPAddress = result[0].LocalIPAddress;
      userId = result[0].UserId;
      authToken = result[0].AuthToken;
      if (
        prevPublicIPAddress !== publicIPAddress ||
        prevLocalIPAddress !== localIPAddress
      ) {
        // update existing record
        doUpdate = true;
      } else {
        // let it stand.
      }
    } else doInsert = true;

    if (doInsert) {
      let insertStatement =
        "INSERT INTO ClientInstance SET PublicIPAddress = ?, LocalIPAddress = ?, interfaceName = ?, ClientToken = ?, " +
        "ClientType = ?, ClientName = ?, UserId = ?";
      insertStatement = format(insertStatement, [
        publicIPAddress,
        localIPAddress,
        interfaceName,
        clientToken,
        clientType,
        clientName,
        userId,
      ]);
      log("insert: '" + insertStatement + "'", "clnt", "info");

      const { result: resultInsert } = await query(connection, insertStatement);
      id = resultInsert.insertId;
    } else if (doUpdate) {
      let updateStatement =
        "UPDATE ClientInstance SET PublicIPAddress = ?, LocalIPAddress = ?, interfaceName = ? " +
        "WHERE Id = ?";
      updateStatement = format(updateStatement, [
        publicIPAddress,
        localIPAddress,
        interfaceName,
        id,
      ]);
      log("update: '" + updateStatement + "'", "clnt", "info");

      await query(connection, updateStatement);
    }

    if (doInsert || doUpdate) {
      let message = doInsert
        ? "new Sentinel added: "
        : "Sentinel address changed: ";
      if (doInsert)
        message +=
          "PublicIPAddress = " +
          publicIPAddress +
          ", LocalIPAddress = " +
          localIPAddress;
      else
        message +=
          "Old PublicIPAddress = " +
          prevPublicIPAddress +
          ", New PublicIPAddress = " +
          publicIPAddress +
          ", Old LocalIPAddress = " +
          prevLocalIPAddress +
          ", New LocalIPAddress = " +
          localIPAddress;

      const eventJSON = JSON.stringify({
        clientToken,
        clientName,
        userId,
        isOnLine: false,
        isLoggedIn: authToken !== null,
        message,
      });

      await addEventWithConnection(
        connection,
        doInsert
          ? Defs.eventClass_clientAdded
          : Defs.eventClass_clientAddressChanged,
        Defs.objectType_clientInstance,
        id,
        Defs.eventClass_null,
        Defs.objectType_null,
        Defs.eventId_null,
        Defs.eventActive_activeAutoInactive,
        eventJSON,
        userId
      );
    }

    results = { clientToken };

    addClientToken(clientToken, clientType, authToken, false, false, false);

    await commitTransaction(connection, "createClientBySerialNumber");
  } catch (err) {
    log("(Exception) createClientBySerialNumber: " + err, "clnt", "info");
    await abortTransaction(connection, "createClient");
    results = handleDBException("client", clientToken, "insert", err);
  }

  release(connection, "createClientBySerialNumber");

  log("<<<createClientBySerialNumber", "clnt", "info");

  return results;
}

async function createClientX(
  publicIPAddress,
  localIPAddress,
  interfaceName,
  clientType,
  clientToken,
  clientName
) {
  log(
    ">>>createClientX: publicIPAddress = " +
      publicIPAddress +
      ", localIPAddress = " +
      localIPAddress +
      ", interfaceName = " +
      interfaceName +
      ", clientType = " +
      clientType +
      ", clientToken = " +
      clientToken +
      ", clientName = " +
      clientName,
    "db"
  );

  let results = {};

  const connection = await getConnection("createClientX");

  try {
    await beginTransaction(connection, "createClientX");

    let selectStatement =
      "SELECT Id, ClientToken FROM ClientInstance WHERE PublicIPAddress = ? AND LocalIPAddress = ?";
    selectStatement = format(selectStatement, [
      publicIPAddress,
      localIPAddress,
    ]);
    log("select: '" + selectStatement + "'", "clnt", "info");

    let doInsert = true;
    const { result } = await query(connection, selectStatement);
    log("-----result: " + JSON.stringify(result));
    if (result.length > 0) {
      if (result[0].ClientToken === clientToken) {
        // let it stand.
        doInsert = false;
      } else {
        // delete old record.
        let deleteStatement =
          "DELETE ClientInstance FROM ClientInstance WHERE Id = ?";
        deleteStatement = format(deleteStatement, [result[0].Id]);
        log("delete: '" + deleteStatement + "'", "clnt", "info");

        await query(connection, deleteStatement);
      }
    }

    if (doInsert) {
      let insertStatement =
        "INSERT INTO ClientInstance SET PublicIPAddress = ?, LocalIPAddress = ?, interfaceName = ?, ClientToken = ?, " +
        "ClientType = ?, ClientName = ?, UserId = 0";
      insertStatement = format(insertStatement, [
        publicIPAddress,
        localIPAddress,
        interfaceName,
        clientToken,
        clientType,
        clientName,
      ]);
      log("insert: '" + insertStatement + "'", "clnt", "info");

      await query(connection, insertStatement);
    }

    results = { clientToken };

    addClientToken(clientToken, clientType, null, false, false, false);

    await commitTransaction(connection, "createClientX");
  } catch (err) {
    log("(Exception) createClient: " + err, "clnt", "info");
    await abortTransaction(connection, "createClient");
    results = handleDBException("client", clientToken, "insert", err);
  }

  release(connection, "createClientX");

  log("<<<createClientX", "clnt", "info");

  return results;
}

async function dailyCleanup() {
  log(">>>dailyCleanup", "clnt", "info");

  const clientNameByClientToken = new Map();

  const connection = await getConnection("dailyCleanup");

  try {
    await beginTransaction(connection, "dailyCleanup");

    // get list of obsolete clientTokens. (Not online in > 24 hours)
    const selectStatement =
      "SELECT ClientName, ClientToken FROM ClientInstance " +
      "WHERE IsOnLine = 0 AND UpdateTime < ADDDATE(NOW(), INTERVAL -24 HOUR)";
    log("select: '" + selectStatement + "'", "clnt", "info");

    const { result, fields } = await query(connection, selectStatement);
    for (let i = 0; i < result.length; i++) {
      const clientToken = result[i].ClientToken;
      const clientName = result[i].ClientName;
      clientNameByClientToken.set(clientToken, clientName);
    }

    // delete obsolete clients
    const deleteStatement =
      "DELETE ClientInstance FROM ClientInstance " +
      "WHERE IsOnLine = 0 AND UpdateTime < ADDDATE(NOW(), INTERVAL -24 HOUR)";
    log("delete: '" + deleteStatement + "'", "clnt", "info");

    await query(connection, deleteStatement);

    // remove deleted clientTokens
    for (var [clientToken, clientName] of clientNameByClientToken) {
      log(
        "dailyCleanup: deleting obsolete client " +
          clientToken +
          ", name = " +
          clientName,
        "clnt",
        "info"
      );
      remClientToken(clientToken);
    }

    await commitTransaction(connection, "dailyCleanup");
  } catch (err) {
    log("(Exception) dailyCleanup: " + err, "clnt", "info");
    await abortTransaction(connection, "dailyCleanup");
  }

  release(connection, "dailyCleanup");

  log("<<<dailyCleanup", "clnt", "info");
}

async function deleteClient(clientToken) {
  log(">>>deleteClient: clientToken = " + clientToken, "clnt", "info");

  let results = {};

  const connection = await getConnection("deleteClient");

  try {
    let deleteStatement =
      "DELETE ClientInstance FROM ClientInstance WHERE ClientToken = ?";
    deleteStatement = format(deleteStatement, [authToken, clientToken]);
    log("deleteStatement: '" + deleteStatement + "'", "clnt", "info");

    const { result, fields } = await query(connection, deleteStatement);

    remClientToken(clientToken);
  } catch (err) {
    log("(Exception) deleteClient: " + err, "clnt", "info");
    results = handleDBException("client", clientToken, "delete", err);
  }

  release(connection, "deleteClient");

  log("<<<deleteClient", "clnt", "info");

  return results;
}

async function getAllowIperf3Use(clientToken) {
  log(">>>getAllowIperf3Use: clientToken = " + clientToken, "clnt", "info");

  let allowIperf3Use = false;

  const connection = await getConnection("getAllowIperf3Use");

  try {
    let selectStatement =
      "SELECT Iperf3UseCountDaily FROM ClientInstance WHERE ClientToken = ? AND Iperf3UseCountDaily < ?";
    selectStatement = format(selectStatement, [
      clientToken,
      iperf3UseCountDailyLimit,
    ]);

    const { result, fields } = await query(connection, selectStatement);
    if (result.length > 0 && result[0]) allowIperf3Use = true;
  } catch (err) {
    log("(Exception) getAllowIperf3Use: " + err, "clnt", "info");
    results = handleDBException("client", clientToken, "select", err);
  }

  release(connection, "getAllowIperf3Use");

  log("<<<getAllowIperf3Use", "clnt", "info");

  return allowIperf3Use;
}
async function getClient(clientToken) {
  log(">>>getClient", "clnt", "info");

  const connection = await getConnection("getClient");

  let results = null;

  try {
    let selectStatement = "SELECT * FROM ClientInstance WHERE ClientToken = ?";
    selectStatement = format(selectStatement, [clientToken]);
    log("select: '" + selectStatement + "'", "clnt", "info");

    const { result, fields } = await query(connection, selectStatement);
    results = {
      id: result[0].Id,
      createTime: result[0].CreateTime,
      updateTime: result[0].UpdateTime,
      userId: result[0].UserId,
      authToken: result[0].AuthToken,
      clientToken: result[0].ClientToken,
      clientName: result[0].ClientName,
      localIPAddress: result[0].LocalIPAddress,
      publicIPAddress: result[0].PublicIPAddress,
      isOnLine: result[0].IsOnLine ? true : false,
      isWiFi: result[0].InterfaceName && result[0].InterfaceName === "wlan0",
    };
  } catch (err) {
    log("(Exception) getClient: " + err, "clnt", "info");
    results = handleDBException("client", clientToken, "select", err);
  }

  release(connection, "getClient");

  log("<<<getClient", "clnt", "info");

  return results;
}

async function getClients(publicIPAddress, localSentinelsOnly, userId, isAdmin) {
  log(
    ">>>getClients: publicIPAddress = " +
      publicIPAddress +
      ", localSentinelsOnly (ignored) = " +
      localSentinelsOnly +
      ", userId = " +
      userId,
    "clnt",
    "info"
  );

  // NB: With advent of sentinel-web proxy, localSentinelsOnly is ignored.

  const connection = await getConnection("getClients");

  let results = [];

  try {
    let selectStatement;
    if (isAdmin) {
      selectStatement =
        "SELECT *, UserName, IspName, PublicIpAddress = \"" + publicIPAddress + "\" AS IsLocalClient, SentinelUpdateTime, " +
        "SentinelAdminUpdateTime, SentinelWebUpdateTime, UpdaterUpdateTime FROM ClientInstance " +
        "LEFT JOIN User ON User.Id = ClientInstance.UserId " +
        "LEFT JOIN InternetServiceProvider ON InternetServiceProvider.AutonomousSystemNumber = ClientInstance.IspAutonomousSystemNumber " +
        "LEFT JOIN ClientInstanceVersionInfo ON ClientInstanceVersionInfo.ClientInstanceId = ClientInstance.Id " +
        "ORDER BY ClientName";
    } else if (userId) {
      selectStatement =
        "SELECT *, UserName, IspName, PublicIpAddress = \"" + publicIPAddress + "\" AS IsLocalClient FROM ClientInstance " +
        "LEFT JOIN User ON User.Id = ClientInstance.UserId " +
        "LEFT JOIN InternetServiceProvider ON InternetServiceProvider.AutonomousSystemNumber = ClientInstance.IspAutonomousSystemNumber " +
        "WHERE ClientType = 'appliance' && userId = ClientInstance.UserId " +
        "ORDER BY ClientName";
      selectStatement = format(selectStatement, [publicIPAddress]);
      //} else {
      //  selectStatement =
      //    "SELECT *, UserName, IspName FROM ClientInstance " +
      //    "LEFT JOIN User ON User.Id = ClientInstance.UserId " +
      //    "LEFT JOIN InternetServiceProvider ON InternetServiceProvider.AutonomousSystemNumber = ClientInstance.IspAutonomousSystemNumber " +
      //    "WHERE (UserId = ? OR UserId = 0) AND PublicIPAddress = ? AND ClientType = 'appliance' " +
      //    "ORDER BY ClientName";
      //  selectStatement = format(selectStatement, [userId, publicIPAddress]);
      //}
    } else {

    }

    if (selectStatement) {
      log("select: '" + selectStatement + "'", "clnt", "info");

      const { result, fields } = await query(connection, selectStatement);
      for (let i = 0; i < result.length; i++) {
        results.push({
          id: result[i].Id,
          createTime: result[i].CreateTime,
          updateTime: result[i].UpdateTime,
          clientType: result[i].ClientType,
          userName: result[i].UserName,
          isLoggedIn: !!result[i].AuthToken,
          clientToken: result[i].ClientToken,
          clientName: result[i].ClientName,
          publicIPAddress: result[i].PublicIPAddress,
          localIPAddress: result[i].LocalIPAddress,
          ispAutonomousSystemNumber: result[i].IspAutonomousSystemNumber,
          ispName: result[i].IspName,
          isOnLine: result[i].IsOnLine ? true : false,
          isWiFi: result[i].InterfaceName && result[i].InterfaceName === "wlan0",
          iperf3UseCountDaily: result[i].Iperf3UseCountDaily,
          iperf3UseCountTotal: result[i].Iperf3UseCountTotal,
          sentinelUpdateTime: result[i].SentinelUpdateTime,
          sentinelAdminUpdateTime: result[i].SentinelAdminUpdateTime,
          sentinelWebUpdateTime: result[i].SentinelWebUpdateTime,
          updaterUpdateTime: result[i].UpdaterUpdateTime,
          isLocalClient: result[i].IsLocalClient
        });
      }
    } else {
      results.push({});
    }
  } catch (err) {
    log("(Exception) getClients: " + err, "clnt", "info");
    results = handleDBException("client", clientToken, "select", err);
  }

  release(connection, "getClients");

  log("<<<getClients", "clnt", "info");
  log("...results=" + JSON.stringify(results, null, 2));

  return results;
}

// NB: Returns array of client tokens.
async function getClientsSansLocalIPAddress() {
  log(">>>getClientsSansLocalIPAddress", "clnt", "info");

  const connection = await getConnection("getClientsSansLocalIPAddress");

  let results = [];

  try {
    let selectStatement =
      "SELECT ClientToken FROM ClientInstance WHERE LocalIPAddress IS NULL OR LocalIPAddress = '0.0.0.0';";
    log("select: '" + selectStatement + "'", "clnt", "info");

    const { result, fields } = await query(connection, selectStatement);
    for (let i = 0; i < result.length; i++) {
      results.push(result[i].ClientToken);
    }
  } catch (err) {
    log("(Exception) getClientsSansLocalIPAddress: " + err, "clnt", "info");
    results = handleDBException("client", clientToken, "select", err);
  }

  release(connection, "getClientsSansLocalIPAddress");

  log("<<<getClientsSansLocalIPAddress", "clnt", "info");

  return results;
}

function getClientType(clientToken) {
  log("getClientType", "clnt", "info");
  return getClientTokenClientType(clientToken);
}

async function getServerURLForClient(userId) {
  log(">>>getServerURLForClient: userId = " + userId, "clnt", "info");

  let results = {};

  const connection = await getConnection("getServerURLForClient");

  try {
    let selectStatement = "SELECT ServerURL, ServerPort FROM Server";
    ("AuthToken = ?, ClientToken = ?, PublicIPAddress = ?, IsOnLine = ?");
    log("select: '" + selectStatement + "'", "clnt", "info");

    const { result, fields } = await query(connection, selectStatement);
    results = {
      serverURL: result[0].ServerURL,
      serverPort: result[0].serverPort,
    };
  } catch (err) {
    log("(Exception) getServerURLForClient: " + err, "clnt", "info");
    results = handleDBException("client", clientToken, "select", err);
  }

  release(connection, "getServerURLForClient");

  log("<<<getServerURLForClient", "clnt", "info");

  return results;
}

// returns:
//    -1 if client not in DB,
//    0 if client offline or authToken from client is different than cached authToken.
//    timestamp of latest request if online
function isClientConnected(clientToken, authTokenFromClient) {
  log("isClientConnected", "clnt", "info");
  if (!hasClientToken(clientToken)) {
    log("isClientConnected, returning -1", "clnt", "info");
    return -1;
  }

  const { authToken, isOnLine, timestamp } = getClientToken(clientToken);
  log(
    "isClientConnected: clientToken = '" +
      clientToken +
      "', authToken = '" +
      authToken +
      "', isOnLine = " +
      isOnLine +
      ", timestamp = " +
      timestamp,
    "db"
  );
  modClientTokenTimestamp(clientToken);

  if (authTokenFromClient !== authToken) return 0;

  return isOnLine && timestamp ? timestamp : 0;
}

function isValidClientToken(clientToken) {
  log("isValidClientToken: " + clientToken, "clnt", "info");
  return hasClientToken(clientToken);
}

async function removeClientAuthToken(authToken) {
  log(">>>removeClientAuthToken: authToken = " + authToken, "clnt", "info");

  let results = {};

  const connection = await getConnection("removeClientAuthToken");

  let clientToken = null;

  try {
    await beginTransaction(connection, "removeClientAuthToken");

    let selectStatement =
      "SELECT Id, ClientToken FROM ClientInstance WHERE AuthToken = ?";
    selectStatement = format(selectStatement, [authToken]);
    log("select: '" + selectStatement + "'", "clnt", "info");

    const { result, fields } = await query(connection, selectStatement);
    if (result.length > 0) {
      const id = result[0].Id;
      clientToken = result[0].ClientToken;

      let updateStatement =
        "UPDATE ClientInstance SET AuthToken = NULL WHERE Id = ?";
      updateStatement = format(updateStatement, id);
      log("update: '" + updateStatement + "'", "clnt", "info");

      const { result2, fields2 } = await query(connection, updateStatement);

      modClientAuthToken(clientToken, null);
    }

    await commitTransaction(connection, "removeClientAuthToken");
  } catch (err) {
    log("(Exception) removeClientAuthToken: " + err, "clnt", "info");
    await abortTransaction(connection, "removeClientAuthToken");
    results = handleDBException("client", clientToken, "update", err);
  }

  release(connection, "removeClientAuthToken");

  log("<<<removeClientAuthToken", "clnt", "info");

  return results;
}

async function updateClientAuthToken(clientToken, authToken, userId, isOnLine) {
  log(
    ">>>updateClientAuthToken: clientToken = " +
      clientToken +
      ", authToken = " +
      authToken +
      ",userId = " +
      userId +
      ", isOnLine = " +
      isOnLine,
    "db"
  );

  let results = {};

  const connection = await getConnection("updateClientAuthToken");

  try {
    let updateStatement =
      "UPDATE ClientInstance SET UserId = ?, " +
      "AuthToken = ?, IsOnLine = ? WHERE ClientToken = ?";
    updateStatement = format(updateStatement, [
      userId,
      authToken,
      isOnLine,
      clientToken,
    ]);
    log("update: '" + updateStatement + "'", "clnt", "info");

    const { result, fields } = await query(connection, updateStatement);

    const {
      clientType,
      isOnLinePrev,
      isLoggedInPrev,
      timestamp,
    } = getClientToken(clientToken);

    modClientToken(
      clientToken,
      clientType,
      authToken,
      isOnLine,
      isOnLinePrev,
      isLoggedInPrev,
      timestamp
    );
    //??TODO handle errors
  } catch (err) {
    log("(Exception) updateClientAuthToken: " + err, "clnt", "info");
    results = handleDBException("client", clientToken, "update", err);
  }

  release(connection, "updateClientAuthToken");

  log("<<<updateClientAuthToken", "clnt", "info");

  return results;
}

async function updateClientIperf3UseCount(clientToken) {
  log(
    ">>>updateClientIperf3UseCount: clientToken = " + clientToken,
    "clnt",
    "info"
  );

  let results = {};

  const connection = await getConnection("updateClientIperf3UseCount");

  try {
    let updateStatement =
      "UPDATE ClientInstance SET Iperf3UseCountDaily = Iperf3UseCountDaily + 1, Iperf3UseCountTotal = Iperf3UseCountTotal + 1  WHERE ClientToken = ?";
    updateStatement = format(updateStatement, [clientToken]);
    log("update: '" + updateStatement + "'", "clnt", "info");

    const { result, fields } = await query(connection, updateStatement);
  } catch (err) {
    log("(Exception) updateClientIperf3UseCount: " + err, "clnt", "info");
    results = handleDBException("client", clientToken, "update", err);
  }

  release(connection, "updateClientIperf3UseCount");

  log("<<<updateClientIperf3UseCount", "clnt", "info");

  return results;
}

async function updateClientLocalIPAddress(clientToken, localIPAddress) {
  log(
    ">>>updateClientLocalIPAddress: clientToken = " +
      clientToken +
      ", localIPAddress = " +
      localIPAddress,
    "clnt",
    "info"
  );

  let results = {};

  const connection = await getConnection("updateClientLocalIPAddress");

  try {
    let updateStatement =
      "UPDATE ClientInstance SET LocalIPAddress = ? WHERE ClientToken = ?";
    updateStatement = format(updateStatement, [localIPAddress, clientToken]);
    log("update: '" + updateStatement + "'", "clnt", "info");

    const { result, fields } = await query(connection, updateStatement);
  } catch (err) {
    log("(Exception) updateClientLocalIPAddress: " + err, "clnt", "info");
    results = handleDBException("client", clientToken, "update", err);
  }

  release(connection, "updateClientLocalIPAddress");

  log("<<<updateClientLocalIPAddress", "clnt", "info");

  return results;
}

async function updateClientOnLineState(clientToken, isOnLine) {
  log(
    ">>>updateClientOnLineState: clientToken = " +
      clientToken +
      ", isOnLine = " +
      isOnLine,
    "db"
  );

  let results = {};

  const connection = await getConnection("updateClientOnLineState");

  try {
    let updateStatement =
      "UPDATE ClientInstance SET IsOnLine = ? WHERE ClientToken = ?";
    updateStatement = format(updateStatement, [isOnLine, clientToken]);
    log("update: '" + updateStatement + "'", "clnt", "info");

    const { result, fields } = await query(connection, updateStatement);

    modClientTokenIsOnLine(clientToken, isOnLine);
  } catch (err) {
    log("(Exception) updateClientOnLineState: " + err, "clnt", "info");
    results = handleDBException("client", clientToken, "update", err);
  }

  release(connection, "updateClientOnLineState");

  log("<<<updateClientOnLineState", "clnt", "info");

  return results;
}

let inCheckClientOnLineStatus = false;

async function initClientTokenCache() {
  log(">>>initClientTokenCache", "clnt", "info");

  const connection = await getConnection("initClientTokenCache");

  try {
    const selectStatement =
      "SELECT ClientToken, ClientType, AuthToken, IsOnLine FROM ClientInstance";
    log("select: '" + selectStatement + "'", "clnt", "info");

    const { result, fields } = await query(connection, selectStatement);
    for (let i = 0; i < result.length; i++) {
      const clientToken = result[i].ClientToken;
      const clientType = result[i].ClientType;
      const authToken = result[i].AuthToken;
      const isOnLine = result[i].IsOnLine ? true : false;
      addClientToken(
        clientToken,
        clientType,
        authToken,
        isOnLine,
        isOnLine,
        !!authToken
      );
    }
  } catch (err) {
    log("(Exception) initClientTokenCache: " + err, "clnt", "info");
    results = handleDBException("client", "", "select", err);
  }

  release(connection, "initClientTokenCache");

  setInterval(async () => {
    if (!inCheckClientOnLineStatus) {
      inCheckClientOnLineStatus = true;
      try {
        await checkClientOnLineStatus();
      } catch (ex) {
        log("Exception)  checkClientOnLineStatus: " + ex, "clnt", "error");
      }
      inCheckClientOnLineStatus = false;
    }
  }, 30 * 1000);

  log("<<<initClientTokenCache", "clnt", "info");
}

async function checkClientOnLineStatus() {
  log(">>>checkClientOnLineStatus", "clnt", "info");

  try {
    const changeCache = [];
    log(">>>iterateClientTokenCache", "clnt", "info");

    const clientTokenCacheMap = getClientTokenCacheMap();
    for (const [key, value] of clientTokenCacheMap.entries()) {
      const clientToken = key;
      let {
        clientType,
        authToken,
        isOnLine,
        isOnLinePrev,
        isLoggedInPrev,
        timestamp,
      } = value;

      log(">>>iterateClientTokenCache", "clnt", "info");
      log(
        "checkClientOnLineStatus: clientToken    = " + clientToken,
        "clnt",
        "info"
      );
      log(
        "checkClientOnLineStatus: authToken      = " + authToken,
        "clnt",
        "info"
      );
      log(
        "checkClientOnLineStatus: isOnLine       = " + isOnLine,
        "clnt",
        "info"
      );
      log(
        "checkClientOnLineStatus: isOnLinePrev   = " + isOnLinePrev,
        "clnt",
        "info"
      );
      log(
        "checkClientOnLineStatus: isLoggedInPrev = " + isLoggedInPrev,
        "clnt",
        "info"
      );
      log(
        "checkClientOnLineStatus: timestamp      = " + timestamp,
        "clnt",
        "info"
      );

      const _5MinutesAgo = Date.now() - 5 * 60 * 1000;
      const diff = timestamp - _5MinutesAgo;
      log(
        "timestamp = " +
          timestamp +
          ", _5MinutesAgo = " +
          _5MinutesAgo +
          ", diff = " +
          diff,
        "db"
      );
      // NB: setting offline state is done here.
      //      setting online state is done in updateClientAuthToken.  In this case,
      //      the isOnLine will be true.
      //

      if (isOnLine) {
        let doAdd = false;
        if (isOnLine != isOnLinePrev) {
          log("report on line", "clnt", "info");
          isOnLine = true;
          doAdd = true;
        } else if (timestamp < _5MinutesAgo) {
          // 60 seconds old.
          log("report off line", "clnt", "info");
          isOnLine = false;
          doAdd = true;
        }

        if (doAdd) {
          changeCache.push({
            clientToken,
            clientType,
            authToken,
            isOnLine,
            isOnLinePrev,
            isLoggedInPrev,
            timestamp,
            eventClass: Defs.eventClass_clientOnLineStatus,
          });
        }
      }

      // check for login state change.
      const isLoggedIn = !!authToken;
      if (isLoggedIn != isLoggedInPrev) {
        if (isLoggedIn) log("report logged in", "clnt", "info");
        else log("report logged out", "clnt", "info");
        changeCache.push({
          clientToken,
          clientType,
          authToken,
          isOnLine,
          isOnLinePrev,
          isLoggedInPrev,
          timestamp,
          eventClass: Defs.eventClass_clientLoginStatus,
        });
      }
      log("<<<iterateClientTokenCache", "clnt", "info");
    }
    log("<<<iterateClientTokenCache", "clnt", "info");

    log(">>>changeCache.iterate", "clnt", "info");
    for (let i = 0; i < changeCache.length; i++) {
      log(">>>changeCache[" + i + "]", "clnt", "info");

      let {
        clientToken,
        clientType,
        authToken,
        isOnLine,
        isOnLinePrev,
        isLoggedInPrev,
        timestamp,
        eventClass,
      } = changeCache[i];

      log("-----report eventClass = " + eventClass, "clnt", "info");

      if (!isOnLine && eventClass === Defs.eventClass_clientOnLineStatus) {
        // update db.
        await updateClientOnLineState(clientToken, isOnLine);
      }

      // update cache.
      isOnLinePrev = isOnLine;
      isLoggedInPrev = !!authToken;
      modClientToken(
        clientToken,
        clientType,
        authToken,
        isOnLine,
        isOnLinePrev,
        isLoggedInPrev,
        timestamp
      );

      // add to event table.
      log("-----before getClient", "clnt", "info");
      const { id, clientName, userId } = await getClient(clientToken);
      log("-----after getClient", "clnt", "info");
      let message = null;
      if (eventClass === Defs.eventClass_clientOnLineStatus)
        message = isOnLine ? "came on line" : "went off line";
      else message = authToken != null ? "logged in" : "logged out";

      const eventJSON = JSON.stringify({
        clientToken,
        clientName,
        userId,
        isOnLine,
        isLoggedIn: authToken != null,
        message,
      });

      await addEvent(
        eventClass,
        Defs.objectType_clientInstance,
        id,
        Defs.eventClass_null,
        Defs.objectType_null,
        Defs.eventId_null,
        !isOnLine,
        eventJSON,
        userId
      );

      log("<<<changeCache[" + i + "]", "clnt", "info");
    }
    log("<<<changeCache.iterate", "clnt", "info");
  } catch (ex) {
    log("(Exception) checkClientOnLineStatus: " + ex, "clnt", "info");
  }
  log("<<<checkClientOnLineStatus", "clnt", "info");
}

async function getClientName(clientToken) {
  log(">>>getClientName: clientToken = " + clientToken, "db");

  let results = {};

  const connection = await getConnection("getClientName");

  try {
    let selectStatement =
      "SELECT ClientName FROM ClientInstance WHERE ClientToken = ?";
    selectStatement = format(selectStatement, [clientToken]);
    log("select: '" + selectStatement + "'", "clnt", "info");

    const { result } = await query(connection, selectStatement);
    if (result.length > 0 && result[0].ClientName)
      results = { clientName: result[0].ClientName };
  } catch (err) {
    log("(Exception) setClientName: " + err, "clnt", "info");
    results = handleDBException("client", clientToken, "update", err);
  }

  release(connection, "getClientName");

  log("<<<getClientName", "clnt", "info");

  return results;
}

async function setClientName(clientToken, clientName) {
  log(
    ">>>setClientName: clientToken = " +
      clientToken +
      ", clientName = " +
      clientName,
    "db"
  );

  let results = {};

  const connection = await getConnection("setClientName");

  try {
    let updateStatement =
      "UPDATE ClientInstance SET ClientName = ? WHERE ClientToken = ?";
    updateStatement = format(updateStatement, [clientName, clientToken]);
    log("update: '" + updateStatement + "'", "clnt", "info");

    const { result, fields } = await query(connection, updateStatement);
  } catch (err) {
    log("(Exception) setClientName: " + err, "clnt", "info");
    results = handleDBException("client", clientToken, "update", err);
  }

  release(connection, "setClientName");

  log("<<<setClientName", "clnt", "info");

  return results;
}

module.exports = {
  clearClientIperf3DailyCount,
  createClient,
  createClientBySerialNumber,
  createClientX,
  getAllowIperf3Use,
  getClient,
  getClientName,
  getClients,
  getClientsSansLocalIPAddress,
  getClientType,
  getServerURLForClient,
  isClientConnected,
  isValidClientToken,
  removeClientAuthToken,
  setClientName,
  updateClientAuthToken,
  updateClientIperf3UseCount,
  updateClientLocalIPAddress,
  updateClientOnLineState,
};
