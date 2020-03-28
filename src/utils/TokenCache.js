const { log } = require("iipzy-shared/src/utils/logFile");

class TokenCache {
  constructor() {
    log("TokenCache - constructor", "tokn", "info");
    this.tokenCache = new Map();
  }

  set(token, value) {
    //log("Token.set: token = '" + token);
    //log("Token.set: value = " + Object.entries(value));

    this.tokenCache.set(token, value);
  }

  get(token) {
    //log("Token.get: token = '" + token + "'");
    const value = this.tokenCache.get(token);
    // if (value != null)
    //   log("Token.get: value = " + Object.entries(value), "tokn", "info");
    return value;
  }

  has(token) {
    //log("Token.has: token = '" + token + "'");
    return this.tokenCache.has(token);
  }

  rem(token) {
    //log("Token.rem: token = '" + token + "'");
    this.tokenCache.delete(token);
  }

  getMap() {
    return this.tokenCache;
  }
}

module.exports = TokenCache;
