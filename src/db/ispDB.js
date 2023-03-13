const Defs = require("iipzy-shared/src/defs");
const { log } = require("iipzy-shared/src/utils/logFile");
const { format, getConnection, query, release } = require("../utils/mysql");

const { getIpAddressInfo } = require("../utils/ipapiRequest");

const {
  getThirdPartyApiUsageCounters,
  updateThirdPartyApiUsageCounters
} = require("./thirdPartyApiDB");

let inUpdate = false;
function ispDB_init() {
  log(">>>ispDB_init", "isp", "info");
  setInterval(async () => {
    if (!inUpdate) {
      inUpdate = true;
      try {
        await updateClientInstancesSansISP();
      } catch (ex) {
        log("Exception) updateClientInstancesSansISP: " + ex, "isp", "error");
      }
      inUpdate = false;
    }
  }, 5 * 60 * 1000);
  log("<<<ispDB_init", "isp", "info");
}

//init();

async function updateClientInstancesSansISP() {
  log(">>>updateClientInstancesSansISP", "isp", "info");

  // check for daily third party usage at limit.  NB: $$$
  const getOptions = { wantIpApi: true };
  const thirdPartyUsage = await getThirdPartyApiUsageCounters(getOptions);
  const thirdPartyUsage_Org = Object.assign({}, thirdPartyUsage);
  log("--thrd - before: " + JSON.stringify(thirdPartyUsage, null, 2));

  const connection = await getConnection("updateClientInstancesSansISP");

  try {
    let selectStatement =
      "SELECT Id, PublicIPAddress FROM ClientInstance WHERE IspAutonomousSystemNumber IS NULL";
    log("select: '" + selectStatement + "'", "isp", "info");

    const { result } = await query(connection, selectStatement);
    for (let i = 0; i < result.length; i++) {
      const row = result[i];
      // ::ffff:172.217.1.238
      const clientInstanceId = row.Id;
      const ipv4Address = row.PublicIPAddress.substring(7);
      const ispInfo = await getIpAddressInfo(ipv4Address);
      if (!ispInfo) break;

      thirdPartyUsage.ipApiRequestsDaily++;
      thirdPartyUsage.ipApiRequestsTotal++;

      // see if ispInfo exists in InternetServiceProvider table.
      let selectStatement =
        "SELECT COUNT(*) AS Count FROM InternetServiceProvider WHERE AutonomousSystemNumber = ?";
      selectStatement = format(selectStatement, [
        ispInfo.ispAutonomousSystemNumber
      ]);
      log("select: '" + selectStatement + "'", "isp", "info");
      const { result: result2 } = await query(connection, selectStatement);

      if (result2[0].Count === 0) {
        // add to isp table.
        let insertStatement =
          "INSERT INTO InternetServiceProvider SET " +
          "AutonomousSystemNumber = ?, " +
          "IspName = ?";
        insertStatement = format(insertStatement, [
          ispInfo.ispAutonomousSystemNumber,
          ispInfo.ispName
        ]);
        log("insert: '" + insertStatement + "'", "isp", "info");

        await query(connection, insertStatement);
      }

      // add to ClientInstanceLocation table
      let insertStatement =
        "INSERT INTO ClientInstanceLocation SET " +
        "ClientInstanceId = ?, " +
        "ContinentCode = ?, " +
        "ContinentName = ?, " +
        "CountryCode = ?, " +
        "CountryName = ?, " +
        "RegionCode = ?, " +
        "RegionName = ?, " +
        "City = ?, " +
        "Zip = ?, " +
        "Latitude = ?, " +
        "Longitude = ?, " +
        "TimezoneId = ?, " +
        "TimezoneGmtOffset = ?, " +
        "TimezoneCode = ?, " +
        "TimezoneIsDaylightSaving = ?";
      insertStatement = format(insertStatement, [
        clientInstanceId,
        ispInfo.continentCode,
        ispInfo.continentName,
        ispInfo.countryCode,
        ispInfo.countryName,
        ispInfo.regionCode,
        ispInfo.regionName,
        ispInfo.city,
        ispInfo.zip,
        ispInfo.latitude,
        ispInfo.longitude,
        ispInfo.timezoneId,
        ispInfo.timezoneGmtOffset,
        ispInfo.timezoneCode,
        ispInfo.timezoneIsDaylightSaving
      ]);
      log("insert: '" + insertStatement + "'", "isp", "info");

      await query(connection, insertStatement);

      // update ClientInstance table
      let updateStatement =
        "UPDATE ClientInstance SET IspAutonomousSystemNumber = ? WHERE Id = ?";
      updateStatement = format(updateStatement, [
        ispInfo.ispAutonomousSystemNumber,
        row.Id
      ]);
      log("update: '" + updateStatement + "'", "isp", "info");

      await query(connection, updateStatement);
    }
  } catch (err) {
    log("(Exception) updateClientInstancesSansISP: " + err, "isp", "error");
    results = handleDBException("event", "", "select", err);
  }

  release(connection, "updateClientInstancesSansISP");

  log("--thrd - after: " + JSON.stringify(thirdPartyUsage, null, 2));

  if (JSON.stringify(thirdPartyUsage) !== JSON.stringify(thirdPartyUsage_Org))
    await updateThirdPartyApiUsageCounters(getOptions, thirdPartyUsage);

  log("<<<updateClientInstancesSansISP", "isp", "info");
}

async function getIPAddressTimezoneId(publicIPAddress) {
  log(
    ">>>getIPAddressTimezoneId: ipAddress = " + publicIPAddress,
    "isp",
    "info"
  );

  // check for daily third party usage at limit.  NB: $$$
  const getOptions = { wantIpApi: true };
  const thirdPartyUsage = await getThirdPartyApiUsageCounters(getOptions);
  const thirdPartyUsage_Org = Object.assign({}, thirdPartyUsage);
  log("--thrd - before: " + JSON.stringify(thirdPartyUsage, null, 2));

  let timezoneId = "";

  try {
    if (
      thirdPartyUsage.ipApiRequestsDaily <
      thirdPartyUsage.ipApiRequestsDailyLimit
    ) {
      const ipv4Address = publicIPAddress.substring(7);
      const ispInfo = await getIpAddressInfo(ipv4Address);
      if (ispInfo) {
        timezoneId = ispInfo.timezoneId;

        thirdPartyUsage.ipApiRequestsTotal++;
        thirdPartyUsage.ipApiRequestsDaily++;
      }
    }
  } catch (err) {
    log("(Exception) getIPAddressTimezoneId: " + err, "isp", "error");
    results = handleDBException("event", "", "select", err);
  }

  log("--thrd - after: " + JSON.stringify(thirdPartyUsage, null, 2));

  if (JSON.stringify(thirdPartyUsage) !== JSON.stringify(thirdPartyUsage_Org))
    await updateThirdPartyApiUsageCounters(getOptions, thirdPartyUsage);

  log("<<<getIPAddressTimezoneId: timezoneId = " + timezoneId, "isp", "info");

  return { timezoneId };
}

async function getIPAddressTimezoneInfo(publicIPAddress) {
  log(
    ">>>getIPAddressTimezoneInfo: ipAddress = " + publicIPAddress,
    "isp",
    "info"
  );

  // check for daily third party usage at limit.  NB: $$$
  const getOptions = { wantIpApi: true };
  const thirdPartyUsage = await getThirdPartyApiUsageCounters(getOptions);
  const thirdPartyUsage_Org = Object.assign({}, thirdPartyUsage);
  log("--thrd - before: " + JSON.stringify(thirdPartyUsage, null, 2));

  let timezoneInfo = {};

  try {
    if (
      thirdPartyUsage.ipApiRequestsDaily <
      thirdPartyUsage.ipApiRequestsDailyLimit
    ) {
      const ipv4Address = publicIPAddress.substring(7);
      const ispInfo = await getIpAddressInfo(ipv4Address);
      if (ispInfo) {
        timezoneInfo.timezoneId = ispInfo.timezoneId;
        timezoneInfo.timezoneGmtOffset = ispInfo.timezoneGmtOffset;
        timezoneInfo.timezoneCode = ispInfo.timezoneCode;
        timezoneInfo.timezoneIsDaylightSaving = ispInfo.timezoneIsDaylightSaving;

        thirdPartyUsage.ipApiRequestsTotal++;
        thirdPartyUsage.ipApiRequestsDaily++;
      }
    }
  } catch (err) {
    log("(Exception) getIPAddressTimezoneInfo: " + err, "isp", "error");
    results = handleDBException("event", "", "select", err);
  }

  log("--thrd - after: " + JSON.stringify(thirdPartyUsage, null, 2));

  if (JSON.stringify(thirdPartyUsage) !== JSON.stringify(thirdPartyUsage_Org))
    await updateThirdPartyApiUsageCounters(getOptions, thirdPartyUsage);

  log("<<<getIPAddressTimezoneInfo: timezoneInfo = " + JSON.stringify(timezoneInfo, null, 2), "isp", "info");

  return timezoneInfo;
}

module.exports = { ispDB_init, getIPAddressTimezoneId, getIPAddressTimezoneInfo };
