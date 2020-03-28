const { log } = require("iipzy-shared/src/utils/logFile");
const TokenCache = require("../utils/TokenCache");

//
log("...create clientTokenCacheMap", "clnt", "info");
const clientTokenCache = new TokenCache();

function addClientToken(
  clientToken,
  clientType,
  authToken,
  isOnLine,
  isOnLinePrev,
  isLoggedInPrev
) {
  log(
    "addClientToken: clientToken = '" +
      clientToken +
      ", clientType = " +
      clientType +
      "', authToken = " +
      authToken +
      ", isOnLine = " +
      isOnLine +
      ", isOnLinePrev = " +
      isOnLinePrev +
      ", isLoggedInPrev = " +
      isLoggedInPrev,
    "clnt",
    "info"
  );
  clientTokenCache.set(clientToken, {
    clientType,
    authToken,
    isOnLine,
    isOnLinePrev,
    isLoggedInPrev,
    timestamp: Date.now()
  });
}

// returns { authToken, isOnLine, isOnLinePrev, timestamp }
function getClientToken(clientToken) {
  return clientTokenCache.get(clientToken);
}

function getClientTokenIsOnLine(clientToken) {
  const { IsOnLine } = clientTokenCache.get(clientToken);
  return isOnLine;
}

function hasClientToken(clientToken) {
  return clientTokenCache.has(clientToken);
}

// for iterating.
function getClientTokenCacheMap() {
  return clientTokenCache.getMap();
}

function getClientTokenClientType(clientToken) {
  const { clientType } = clientTokenCache.get(clientToken);
  return clientType;
}

function modClientAuthToken(clientToken, authToken) {
  log("modClientAuthToken: clientToken = '" + clientToken, "clnt", "info");
  const {
    clientType,
    isOnLine,
    isOnLinePrev,
    isLoggedInPrev,
    timestamp
  } = clientTokenCache.get(clientToken);
  clientTokenCache.set(clientToken, {
    clientType,
    authToken,
    isOnLine,
    isOnLinePrev,
    isLoggedInPrev,
    timestamp
  });
}

function modClientToken(
  clientToken,
  clientType,
  authToken,
  isOnLine,
  isOnLinePrev,
  isLoggedInPrev,
  timestamp
) {
  log("modClientToken: clientToken = '" + clientToken, "clnt", "info");
  clientTokenCache.set(clientToken, {
    clientType,
    authToken,
    isOnLine,
    isOnLinePrev,
    isLoggedInPrev,
    timestamp
  });
}

function modClientTokenIsOnLine(clientToken, isOnLine) {
  log(
    "modClientTokenIsOnLine: clientToken = '" +
      clientToken +
      "', isOnLine = " +
      isOnLine,
    "clnt",
    "info"
  );
  const {
    clientType,
    authToken,
    isOnLinePrev,
    isLoggedInPrev,
    timestamp
  } = clientTokenCache.get(clientToken);
  clientTokenCache.set(clientToken, {
    clientType,
    authToken,
    isOnLine,
    isOnLinePrev,
    isLoggedInPrev,
    timestamp
  });
}

function modClientTokenTimestamp(clientToken) {
  log(
    "modClientTokenTimestamp: clientToken = '" + clientToken + "'",
    "clnt",
    "info"
  );
  const {
    clientType,
    authToken,
    isOnLine,
    isOnLinePrev,
    isLoggedInPrev
  } = clientTokenCache.get(clientToken);
  clientTokenCache.set(clientToken, {
    clientType,
    authToken,
    isOnLine,
    isOnLinePrev,
    isLoggedInPrev,
    timestamp: Date.now()
  });
}

function remClientToken(clientToken) {
  clientTokenCache.rem(clientToken);
}

module.exports = {
  addClientToken,
  getClientToken,
  getClientTokenIsOnLine,
  getClientTokenCacheMap,
  getClientTokenClientType,
  hasClientToken,
  //iterateClientTokenCache,
  modClientAuthToken,
  modClientToken,
  modClientTokenIsOnLine,
  modClientTokenTimestamp,

  remClientToken
};
