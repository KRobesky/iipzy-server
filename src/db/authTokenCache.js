const { log } = require("iipzy-shared/src/utils/logFile");
const TokenCache = require("../utils/TokenCache");

//
log("create authTokenCacheMap", "auth", "info");
const authTokenCache = new TokenCache();

function addAuthToken(authToken, userId, isAdmin) {
  // log(
  //   "addAuthToken: authToken = '" + authToken + "', userId = " + userId,
  //   "db", "verbose"
  // );
  authTokenCache.set(authToken, { userId, isAdmin, timestamp: Date.now() });
}

function getAuthToken(authToken) {
  try {
    const data = authTokenCache.get(authToken);
    if (data) {
      log(
        "getAuthToken: token = " +
          JSON.stringify(data, null, 2) +
          ", now = " +
          Date.now()
      );
      data.timestamp = Date.now();

      // authTokenCache.set(authToken, {
      //   userId: data.userId,
      //   timestamp: Date.now()
      // });
      return data;
    }
  } catch (ex) {
    log("(Exception) getAuthTokenUserId: ex = " + ex, "auth", "error");
  }
  return { userId: 0, isAdmin: false };
}

function getAuthTokensOlderThan(timestamp) {
  const tokenCacheMap = authTokenCache.getMap();
  let authTokens = [];
  for (var [token, data] of tokenCacheMap) {
    log("getAuthTokenOlderThan: token = " + JSON.stringify(data, null, 2));
    if (data.timestamp < timestamp) authTokens.push(token);
  }
  return authTokens;
}

function remAuthToken(authToken) {
  authTokenCache.rem(authToken);
}

module.exports = {
  addAuthToken,
  getAuthToken,
  getAuthTokensOlderThan,
  remAuthToken
};
