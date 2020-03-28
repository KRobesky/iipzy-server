const bcrypt = require("bcrypt");
const uuidv4 = require("uuid/v4");

const Defs = require("iipzy-shared/src/defs");
const { log } = require("iipzy-shared/src/utils/logFile");
const { format, getConnection, query, release } = require("../utils/mysql");
const { removeClientAuthToken, updateClientAuthToken } = require("./clientDB");
const {
  addAuthToken,
  getAuthToken,
  getAuthTokensOlderThan,
  remAuthToken
} = require("./authTokenCache");
const { addEvent } = require("./eventDB");

// authToken management:
//  In isLoggedIn, set touched time in authToken cache entry.
//  Every ten minutes, go through authToken cache and get array of entries not touched in the last ten minutes.
//    Delete them from the cache.

let inCleanupAuthTokenTable = false;

const TEN_MINUTES = 10 * 60 * 1000;
async function initAuthTokenCache() {
  log(">>>initAuthTokenCache", "auth", "info");

  setInterval(() => {
    if (!inCleanupAuthTokenTable) {
      inCleanupAuthTokenTable = true;
      try {
        cleanupAuthTokenTable();
      } catch (ex) {
        log("Exception)  cleanupAuthTokenTable: " + ex, "auth", "error");
      }
      inCleanupAuthTokenTable = false;
    }
  }, TEN_MINUTES);

  log("<<<initAuthTokenCache", "auth", "info");
}

function cleanupAuthTokenTable() {
  log("cleanupAuthTokenTable", "auth", "info");

  const oldTokens = getAuthTokensOlderThan(Date.now() - TEN_MINUTES);
  for (let i = 0; i < oldTokens.length; i++) {
    const token = oldTokens[i];
    log("cleanupAuthTokenTable: removing token = " + token, "auth", "info");
    remAuthToken(token);
  }
}

initAuthTokenCache();

async function loginUser(userName, password, publicIPAddress, clientToken) {
  log(">>>loginUser: clientToken = " + clientToken, "auth", "info");

  let results = {};

  const connection = await getConnection("loginUser");

  try {
    let selectStatement =
      "SELECT Id, UserName, MobilePhoneNo, EmailAddress, PasswordBcrypt, IsAdmin FROM User " +
      "WHERE UserName = ? AND VerifiedTime IS NOT NULL";
    selectStatement = format(selectStatement, [userName]);
    log("select: '" + selectStatement + "'", "auth", "info");

    const { result, fields } = await query(connection, selectStatement);
    //??TODO handle errors
    if (result[0].PasswordBcrypt) {
      const userId = result[0].Id;
      const isAdmin = result[0].IsAdmin;
      // see if password matches.
      const match = await bcrypt.compare(password, result[0].PasswordBcrypt);
      if (match) {
        const authToken = uuidv4();

        // add to authTokenCache.
        addAuthToken(authToken, userId, isAdmin);

        await updateClientAuthToken(clientToken, authToken, userId, true);

        results = {
          authToken: authToken,
          isLoggedIn: true,
          isAdmin: isAdmin
        };
      } else {
        log("loginUser password mismatch", "auth", "info");
        results = {
          authToken: "",
          isLoggedIn: false,
          isAdmin: false
        };
      }
    } else {
      log("...loginUser failed", "auth", "info");
      results = {
        authToken: "",
        isLoggedIn: false,
        isAdmin: false
      };
    }
  } catch (err) {
    log("(Exception) loginUser: " + err, "auth", "info");
    results = {
      authToken: "",
      isLoggedIn: false,
      isAdmin: false
    };
  }

  release(connection, "loginUser");

  log("<<<loginUser", "auth", "info");

  return results;
}

async function logoutUser(authToken, clientToken) {
  log(
    ">>>logoutUser: authToken = " +
      authToken +
      ", clientToken = " +
      clientToken,
    "db"
  );

  // remove from authTokenCache.
  log(".....logoutUser. remove authToken=" + authToken, "auth", "info");
  remAuthToken(authToken);

  await removeClientAuthToken(authToken);

  log("<<<logoutUser", "auth", "info");

  return { authToken: "", isLoggedIn: false, isAdmin: false };
}

function isLoggedIn(authToken) {
  const { userId } = getAuthToken(authToken);
  // log(
  //   ".....isLoggedIn: authToken = '" + authToken + "', userId = " + userId,
  //   "db"
  // );
  return userId ? userId : 0;
}

function isAdmin(authToken) {
  const { userId, isAdmin } = getAuthToken(authToken);
  // log(
  //   ".....isLoggedIn: authToken = '" + authToken + "', userId = " + userId,
  //   "db"
  // );
  return userId && isAdmin;
}

async function verifyUser(userName, password) {
  log(">>>verifyUser", "auth", "info");

  let results = {};

  const connection = await getConnection("verifyUser");

  try {
    let selectStatement =
      "SELECT PasswordBcrypt FROM User WHERE UserName = ? AND VerifiedTime IS NOT NULL";
    selectStatement = format(selectStatement, [userName]);
    log("select: '" + selectStatement + "'", "auth", "info");

    const { result } = await query(connection, selectStatement);
    if (result.length > 0 && result[0].PasswordBcrypt) {
      // see if password matches.
      const match = await bcrypt.compare(password, result[0].PasswordBcrypt);
      if (match) {
        results = { verified: true };
      } else {
        log("loginUser password mismatch", "auth", "info");
        results = { verified: false };
      }
    } else {
      log("...loginUser failed", "auth", "info");
      results = { verified: false };
    }
  } catch (err) {
    log("(Exception) loginUser: " + err, "auth", "info");
    results = { verified: false };
  }

  release(connection, "verifyUser");

  log("<<<verifyUser", "auth", "info");

  return results;
}

module.exports = { isAdmin, isLoggedIn, loginUser, logoutUser, verifyUser };
