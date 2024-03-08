const Defs = require("iipzy-shared/src/defs");
const { log } = require("iipzy-shared/src/utils/logFile");
const { format, getConnection, query, release } = require("../utils/mysql");
const { sleep } = require("iipzy-shared/src/utils/utils");

async function getIperf3Servers() {
  log(">>>getIperf3Servers", "iprf", "info");

  let results = {};

  const connection = await getConnection("getIperf3Servers");

  log(">>>getIperf3Servers.01", "iprf", "info");

  try {
    let selectStatement = "SELECT * FROM Iperf3Server WHERE Enabled = 1";
    log("select: '" + selectStatement + "'", "iprf", "info");

    const { result } = await query(connection, selectStatement);
    log("after select: result = " + JSON.stringify(result, null, 2), "iprf", "info");
    await sleep(5*1000);
    let servers = [];
    for (let i = 0; i < result.length; i++) {
      const row = result[i];
      log(
        "getIperf3Server: instanceGuid = " + row.InstanceGuid,
        "iprf",
        "info"
      );
      servers.push({
        instanceGuid: row.InstanceGuid,
        instanceIPV4Addr: row.InstanceIPV4Addr,
        instanceURL: row.InstanceURL,
        latitude: row.Latitude,
        longitude: row.Longitude
      });
    }
    results = { iperf3Servers: servers };
  } catch (err) {
    log("(Exception) getIperf3Servers: " + err, "iprf", "error");
    results = handleDBException("event", "", "select", err);
  }

  release(connection, "getIperf3Servers");

  log("<<<getIperf3Servers", "iprf", "info");

  return results;
}

module.exports = { getIperf3Servers };
