const bcrypt = require("bcrypt");

const Defs = require("iipzy-shared/src/defs");
const {
  handleDBError,
  handleDBException
} = require("iipzy-shared/src/utils/handleError");
const { log } = require("iipzy-shared/src/utils/logFile");
const {
  abortTransaction,
  beginTransaction,
  commitTransaction,
  format,
  getConnection,
  query,
  release
} = require("../utils/mysql");

async function deleteUser(userId) {
  log(">>>deleteUser", "user", "info");

  const connection = await getConnection("deleteUser");

  const results = await deleteUserHelper(connection, userId);

  release(connection, "deleteUser");

  log("<<<deleteUser", "user", "info");

  return results;
}

async function deleteUserHelper(connection, userId) {
  log(">>>deleteUserHelper", "user", "info");

  let results = null;

  try {
    let deleteStatement = "DELETE User FROM User WHERE Id = ?";
    deleteStatement = format(deleteStatement, [userId]);
    log("delete: '" + deleteStatement + "'", "user", "info");
    const { result } = await query(connection, deleteStatement);
    results = {};
  } catch (err) {
    log("(Exception) deleteUserHelper: " + err, "user", "info");
    results = handleDBException("user", "", "delete", err);
  }

  log("<<<deleteUserHelper", "user", "info");

  return results;
}

async function getUser(userId) {
  log(">>>getUser", "user", "info");

  const connection = await getConnection("getUser");

  let results = null;

  try {
    let selectStatement =
      "SELECT Id, UserName, MobilePhoneNo, EmailAddress, IsAdmin FROM User WHERE Id = ?";
    selectStatement = format(selectStatement, [userId]);
    log("select: '" + selectStatement + "'", "user", "info");

    const { result, fields } = await query(connection, selectStatement);
    if (result.length > 0) {
      results = {
        userId: result[0].Id,
        userName: result[0].UserName,
        mobilePhoneNo: result[0].MobilePhoneNo,
        emailAddress: result[0].EmailAddress,
        isAdmin: result[0].IsAdmin
      };
    } else results = {};
  } catch (err) {
    log("(Exception) getUser: " + err, "user", "info");
    results = handleDBException("user", "", "select", err);
  }

  release(connection, "getUser");

  log("<<<getUser", "user", "info");

  return results;
}

async function insertUser(
  userName,
  mobilePhoneNo,
  emailAddress,
  password,
  verificationCode
) {
  log(">>>insertUser", "user", "info");

  const connection = await getConnection("insertUser");

  let results = null;

  const salt = await bcrypt.genSalt(10);
  const passwordBcrypt = await bcrypt.hash(password, salt);

  try {
    let insertStatement =
      "INSERT INTO User SET UserName = ?" +
      ", MobilePhoneNo = ?" +
      ", EmailAddress = ?" +
      ", PasswordBcrypt = ?" +
      ", VerificationCode = ?";

    insertStatement = format(insertStatement, [
      userName,
      mobilePhoneNo,
      emailAddress,
      passwordBcrypt,
      verificationCode
    ]);
    log("insert statement = '" + insertStatement + "'", "user", "info");

    const { result } = await query(connection, insertStatement);

    results = { userId: result.insertId };
  } catch (err) {
    log("(Exception) insertUser: " + err.code, "user", "info");
    results = handleDBException("user", userName, "insert", err);
  }

  release(connection, "insertUser");

  log("<<<insertUser", "user", "info");

  return results;
}

async function isUserWhiteListed(userName) {
  log(">>>isUserWhiteListed", "user", "info");

  const connection = await getConnection("isUserWhiteListed");

  let ok = false;

  try {
    let selectStatement =
      "SELECT COUNT(*) AS Count FROM UserWhiteList WHERE UserName = ?";
    selectStatement = format(selectStatement, [userName]);
    log("select: '" + selectStatement + "'", "user", "info");

    const { result, fields } = await query(connection, selectStatement);
    if (result.length > 0) ok = result[0].Count > 0;
  } catch (err) {
    log("(Exception) getUser: " + err, "user", "info");
    results = handleDBException("user", "", "select", err);
  }

  release(connection, "isUserWhiteListed");

  log("<<<isUserWhiteListed: " + ok, "user", "info");

  return ok;
}

async function setNewPassword(userName, passwordResetCode, password) {
  log(">>>setNewPassword", "user", "info");

  const connection = await getConnection("setNewPassword");

  let results = null;

  try {
    await beginTransaction(connection, "setNewPassword");

    let selectStatement =
      "SELECT Id, PasswordResetCode FROM User WHERE UserName = ?";
    selectStatement = format(selectStatement, userName);
    log(
      "setNewPassword - select statement = '" + selectStatement + "'",
      "user",
      "info"
    );

    const { result } = await query(connection, selectStatement);
    if (result.length > 0 && result[0]) {
      const userId = result[0].Id;
      const passwordResetCodeDB = result[0].PasswordResetCode;
      if (passwordResetCodeDB === passwordResetCode) {
        const salt = await bcrypt.genSalt(10);
        const passwordBcrypt = await bcrypt.hash(password, salt);

        let updateStatement =
          "UPDATE User SET PasswordBcrypt = ?, PasswordResetCode = NULL, PasswordResetTime = NULL" +
          " WHERE Id = ?";
        updateStatement = format(updateStatement, [passwordBcrypt, userId]);
        log(
          "setNewPassword - update statement = '" + updateStatement + "'",
          "db"
        );

        {
          const { result } = await query(connection, updateStatement);
        }
        results = {};
      } else {
        results = handleDBError(
          "user",
          "",
          "update",
          Defs.statusInvalidPasswordResetCode,
          "Invalid Password Reset Code"
        );
      }
    } else {
      results = handleDBError(
        "user",
        "",
        "update",
        Defs.statusInvalidUserName,
        "Invalid User Name"
      );
    }

    await commitTransaction(connection, "setNewPassword");
  } catch (err) {
    log(
      "(Exception) setNewPassword: " + err + ", code = " + err.code,
      "user",
      "info"
    );
    await abortTransaction(connection, "setNewPassword");
    results = handleDBException("user", userName, "update", err);
  }

  release(connection, "setNewPassword");

  log("<<<setNewPassword", "user", "info");

  return results;
}

async function setPasswordResetCode(userName, passwordResetCode) {
  log(">>>setPasswordResetCode", "user", "info");

  const connection = await getConnection("setPasswordResetCode");

  let results = null;

  try {
    await beginTransaction(connection, "setNewPassword");

    let selectStatement =
      "SELECT Id, EmailAddress FROM User WHERE UserName = ?";
    selectStatement = format(selectStatement, userName);
    log(
      "setPasswordResetCode - select statement = '" + selectStatement + "'",
      "db"
    );

    const { result } = await query(connection, selectStatement);
    if (result.length > 0 && result[0]) {
      const userId = result[0].Id;
      const emailAddress = result[0].EmailAddress;

      let updateStatement =
        "UPDATE User SET PasswordResetCode = ?, PasswordResetTime = CURRENT_TIMESTAMP WHERE Id = ?";
      updateStatement = format(updateStatement, [passwordResetCode, userId]);
      log(
        "setPasswordResetCode - update statement = '" + updateStatement + "'",
        "db"
      );

      {
        const { result } = await query(connection, updateStatement);
      }
      results = { emailAddress: emailAddress };
    } else {
      results = handleDBError(
        "user",
        "",
        "update",
        Defs.statusInvalidUserName,
        "Invalid User Name"
      );
    }

    await commitTransaction(connection, "setNewPassword");
  } catch (err) {
    log(
      "(Exception) setPasswordResetCode: " + err + ", code = " + err.code,
      "db"
    );
    await abortTransaction(connection, "setNewPassword");
    results = handleDBException("user", userName, "update", err);
  }

  release(connection, "setPasswordResetCode");

  log("<<<setPasswordResetCode", "user", "info");

  return results;
}

async function updateUser(userId, mobilePhoneNo, emailAddress, password) {
  log(">>>updateUser", "user", "info");

  const connection = await getConnection("updateUser");

  let results = {};

  const salt = await bcrypt.genSalt(10);
  const passwordBcrypt = await bcrypt.hash(password, salt);

  try {
    let updateStatement =
      "UPDATE User SET MobilePhoneNo = ?" +
      ", EmailAddress = ?" +
      ", PasswordBcrypt = ? " +
      "WHERE Id = ?";
    updateStatement = format(updateStatement, [
      mobilePhoneNo,
      emailAddress,
      passwordBcrypt,
      userId
    ]);
    log("select: '" + updateStatement + "'", "user", "info");

    const { result, fields } = await query(connection, updateStatement);
  } catch (err) {
    log("(Exception) updateUser: " + err, "user", "info");
    results = handleDBException("user", "", "update", err);
  }

  release(connection, "updateUser");

  log("<<<updateUser", "user", "info");

  return results;
}

async function userDBPeriodicWork() {
  log(">>>userDBPeriodicWork", "user", "info");

  const connection = await getConnection("userDBPeriodicWork");

  let results = null;

  try {
    const deleteStatement =
      "DELETE  User FROM User WHERE CreateTime < NOW() - INTERVAL 5 MINUTE AND VerifiedTime IS NULL";
    log(
      "userDBPeriodicWork - delete: '" + deleteStatement + "'",
      "user",
      "info"
    );

    const { result, fields } = await query(connection, deleteStatement);

    const updateStatement =
      "UPDATE User SET PasswordResetCode = NULL, PasswordResetTime = NULL " +
      "WHERE PasswordResetTime < NOW() - INTERVAL 5 MINUTE";
    log(
      "userDBPeriodicWork - update: '" + updateStatement + "'",
      "user",
      "info"
    );

    await query(connection, updateStatement);
  } catch (err) {
    log("(Exception) userDBPeriodicWork: " + err, "user", "info");
    results = handleDBException("user", "", "delete", err);
  }

  release(connection, "userDBPeriodicWork");

  log("<<<userDBPeriodicWork", "user", "info");

  return results;
}

async function verifyUser(userId, verificationCode) {
  log(">>>verifyUser", "user", "info");

  const connection = await getConnection("verifyUser");

  let results = {};

  try {
    let updateStatement =
      "UPDATE User SET VerifiedTime = CURRENT_TIMESTAMP " +
      "WHERE Id = ? AND VerificationCode = ?";
    updateStatement = format(updateStatement, [userId, verificationCode]);
    log("update: '" + updateStatement + "'", "user", "info");

    const { result } = await query(connection, updateStatement);
    const isVerified = result.changedRows === 1;
    if (!isVerified) {
      //await deleteUserHelper(connection, userId);
      results = handleDBError(
        "user",
        "",
        "update",
        Defs.statusInvalidVerificationCode,
        "Invalid verification code"
      );
    }
  } catch (err) {
    log("(Exception) verifyUser: " + err, "user", "info");
    results = handleDBException("user", "", "update", err);
  }

  release(connection, "verifyUser");

  log("<<<verifyUser", "user", "info");

  return results;
}

module.exports = {
  deleteUser,
  getUser,
  insertUser,
  isUserWhiteListed,
  setNewPassword,
  setPasswordResetCode,
  updateUser,
  userDBPeriodicWork,
  verifyUser
};
