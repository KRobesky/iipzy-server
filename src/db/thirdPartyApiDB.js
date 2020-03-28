const schedule = require("node-schedule");

const Defs = require("iipzy-shared/src/defs");
const { handleDBException } = require("iipzy-shared/src/utils/handleError");
const { log } = require("iipzy-shared/src/utils/logFile");
const { format, getConnection, query, release } = require("../utils/mysql");

function scheduleDailyWork() {
  const rule = new schedule.RecurrenceRule();
  rule.dayOfWeek = [new schedule.Range(0, 6)];
  rule.hour = 8; // NB: UTC
  rule.minute = 2;

  const j = schedule.scheduleJob(rule, async function() {
    log("running daily cleanup", "3rdp", "info");
    await clearDailyCounts();
  });
}

scheduleDailyWork();

async function clearDailyCounts() {
  log(">>>clearDailyCounts", "3rdp", "info");

  const connection = await getConnection("clearDailyCounts");

  try {
    let updateStatement =
      "UPDATE ThirdPartyApiUsageCounters SET " +
      "EmailSendsDaily = 0, " +
      "SMSSendsDaily = 0, " +
      "IpApiRequestsDaily = 0, " +
      "IpGeolocationRequestsDaily = 0";
    log("update: '" + updateStatement + "'", "3rdp", "info");
    await query(connection, updateStatement);
  } catch (err) {
    log("(Exception) clearDailyCounts: " + err, "3rdp", "error");
    results = handleDBException("event", "", "select", err);
  }

  release(connection, "clearDailyCounts");

  log("<<<clearDailyCounts", "3rdp", "info");
}

async function getThirdPartyApiUsageCounters(options) {
  log(">>>getThirdPartyApiUsageCounters", "3rdp", "info");

  const { wantEmail, wantSMS, wantIpApi, wantIpGeolocation } = options;

  let results = {};

  const connection = await getConnection("getThirdPartyApiUsageCounters");

  try {
    let selectStatement = "SELECT * FROM ThirdPartyApiUsageCounters";
    log("select: '" + selectStatement + "'", "3rdp", "info");

    const { result } = await query(connection, selectStatement);

    if (wantEmail) {
      results.emailSendsDailyLimit = result[0].EmailSendsDailyLimit;
      results.emailSendsDaily = result[0].EmailSendsDaily;
      results.emailSendsTotal = result[0].EmailSendsTotal;
    }
    if (wantSMS) {
      results.smsSendsDailyLimit = result[0].SMSSendsDailyLimit;
      results.smsSendsDaily = result[0].SMSSendsDaily;
      results.smsSendsTotal = result[0].SMSSendsTotal;
    }
    if (wantIpApi) {
      results.ipApiRequestsDailyLimit = result[0].IpApiRequestsDailyLimit;
      results.ipApiRequestsDaily = result[0].IpApiRequestsDaily;
      results.ipApiRequestsTotal = result[0].IpApiRequestsTotal;
    }
    if (wantIpGeolocation) {
      results.ipGeolocationRequestsDailyLimit =
        result[0].IpGeolocationRequestsDailyLimit;
      results.ipGeolocationRequestsDaily = result[0].IpGeolocationRequestsDaily;
      results.ipGeolocationRequestsTotal = result[0].IpGeolocationRequestsTotal;
    }
  } catch (err) {
    log("(Exception) getThirdPartyApiUsageCounters: " + err, "3rdp", "error");
    results = handleDBException("event", "", "select", err);
  }

  release(connection, "getThirdPartyApiUsageCounters");

  log("<<<getThirdPartyApiUsageCounters", "3rdp", "info");

  return results;
}

async function updateThirdPartyApiUsageCounters(options, thirdPartyUsage) {
  log(">>>updateThirdPartyApiUsageCounters", "3rdp", "info");

  const { wantEmail, wantSMS, wantIpApi, wantIpGeolocation } = options;

  let results = {};

  const connection = await getConnection("updateThirdPartyApiUsageCounters");

  try {
    let updateStatement = "UPDATE ThirdPartyApiUsageCounters SET ";
    let params = [];
    let needComma = false;
    if (wantEmail) {
      updateStatement += "EmailSendsDaily = ?, EmailSendsTotal = ?";
      needComma = true;
      params.push(thirdPartyUsage.emailSendsDaily);
      params.push(thirdPartyUsage.emailSendsTotal);
    }
    if (wantSMS) {
      if (needComma) updateStatement += ", ";
      updateStatement += "SMSSendsDaily = ?, SMSSendsTotal = ?";
      needComma = true;
      params.push(thirdPartyUsage.smsSendsDaily);
      params.push(thirdPartyUsage.smsSendsTotal);
    }
    if (wantIpApi) {
      if (needComma) updateStatement += ", ";
      updateStatement += "IpApiRequestsDaily = ?, IpApiRequestsTotal = ?";
      needComma = true;
      params.push(thirdPartyUsage.ipApiRequestsDaily);
      params.push(thirdPartyUsage.ipApiRequestsTotal);
    }
    if (wantIpGeolocation) {
      if (needComma) updateStatement += ", ";
      updateStatement +=
        "IpGeolocationRequestsDaily = ?, IpGeolocationRequestsTotal = ?";
      needComma = true;
      params.push(thirdPartyUsage.ipGeolocationRequestsDaily);
      params.push(thirdPartyUsage.ipGeolocationRequestsTotal);
    }
    updateStatement = format(updateStatement, params);
    log("update: '" + updateStatement + "'", "3rdp", "info");

    await query(connection, updateStatement);
  } catch (err) {
    log(
      "(Exception) updateThirdPartyApiUsageCounters: " + err,
      "3rdp",
      "error"
    );
    results = handleDBException("event", "", "select", err);
  }

  release(connection, "updateThirdPartyApiUsageCounters");

  log("<<<updateThirdPartyApiUsageCounters", "3rdp", "info");

  return results;
}

module.exports = {
  getThirdPartyApiUsageCounters,
  updateThirdPartyApiUsageCounters
};
