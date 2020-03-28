const fs = require("fs");
const mysql = require("mysql");

const { log } = require("iipzy-shared/src/utils/logFile");
const { sleep } = require("iipzy-shared/src/utils/utils");

const dataPath = process.platform === "win32" ? "c:/temp/" : "/etc/iipzy";
const mysqlConfigPath = dataPath + "/mysql-config.json";

const { host, user, password } = JSON.parse(fs.readFileSync(mysqlConfigPath));

const connectionPool = mysql.createPool({
  connectionLimit: 10,
  host: host,
  user: user,
  password: password,
  database: "ConfigDB"
});

// use UTC time.
connectionPool.on("connection", conn => {
  conn.query("SET time_zone='+00:00';", error => {
    if (error) {
      throw error;
    }
  });
});

function abortTransaction(connection, title) {
  log("---abortTransaction--- " + title, "sql", "info");
  return new Promise((resolve, reject) => {
    connection.rollback(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function beginTransaction(connection, title) {
  log("---beginTransaction--- " + title, "sql", "info");
  return new Promise((resolve, reject) => {
    connection.beginTransaction(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function commitTransaction(connection, title) {
  log("---commitTransaction--- " + title, "sql", "info");
  return new Promise((resolve, reject) => {
    connection.commit(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function format(template, params) {
  return mysql.format(template, params);
}

let useCount = 0;
let firstTime = true;

function getConnection(title) {
  log(">>>getConnection(" + useCount + "): " + title, "sql", "info");
  let p = null;
  try {
    p = new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        log("(Error) getConnection: " + title + " timed out", "sql", "error");
        throw new Error("getConnection: " + title + " timed out");
      }, 20 * 1000);
      //?? test
      // if (firstTime) {
      //   firstTime = false;
      //   await sleep(12 * 1000);
      // }
      connectionPool.getConnection((err, connection) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else {
          useCount++;
          resolve(connection);
        }
      });
    });
  } catch (ex) {
    log("(Exception) getConnection: " + title + " " + ex, "sql", "error");
  }
  log("<<<getConnection: " + title, "sql", "info");
  return p;
}

function query(connection, statement) {
  return new Promise((resolve, reject) => {
    connection.query(statement, (error, result, fields) => {
      if (error) reject(error);
      else {
        resolve({ result, fields });
      }
    });
  });
}

function release(connection, title) {
  log(">>>releaseConnection(" + useCount + "): " + title, "sql", "info");
  connection.release();
  useCount--;
  log("<<<releaseConnection: " + title, "sql", "info");
}

function epochToMySqlDatetime(epoch) {
  log(">>>epochToMySqlDatetime: " + epoch, "sql", "info");
  const date = new Date();
  date.setTime(epoch);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  const ret = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  log("<<<epochToMySqlDatetime: " + ret, "sql", "info");
  return ret;
}

module.exports = {
  abortTransaction,
  beginTransaction,
  commitTransaction,
  epochToMySqlDatetime,
  format,
  getConnection,
  query,
  release
};
