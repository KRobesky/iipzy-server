const fs = require("fs");

const Defs = require("iipzy-shared/src/defs");
const http = require("iipzy-shared/src/services/httpService");
const { log } = require("iipzy-shared/src/utils/logFile");
const { spawnAsync } = require("iipzy-shared/src/utils/spawnAsync");

const dataPath = "/etc/iipzy";
const ipapiConfigPath = dataPath + "/ipapi-config.json";
let ipapiAccessKey = null;

function getIpapiCredentials() {
  try {
    const { apiAccessKey } = JSON.parse(fs.readFileSync(ipapiConfigPath));
    //log("ipapiCredentials: apiAccessKey =" + apiAccessKey, "ipap", "info");
    ipapiAccessKey = apiAccessKey;
  } catch (error) {
    log(
      "(Exception) getIpapiCredentials: " + error + ", code = " + error.code,
      "ipap",
      "info"
    );
    return {};
  }
}

getIpapiCredentials();

async function getIpAddressInfo(ipv4Address) {
  log("getIpAddressInfo: ipv4Address = " + ipv4Address, "ipap", "info");
  //--const { data, status } = await http.get("https://api.ipapi.com/" + ipv4Address + "?access_key=" + ipapiAccessKey);

  const { stdout, stderr } = await spawnAsync("curl", [
    "--fail",
    "--silent", 
    "--show-error",
    "http://ip-api.com/json/" + ipv4Address]);
  if (stderr) {
    log("(Error) getIpAddressInfo : stderr = " + stderr, "ipap", "error");
    return null;
  }
  const data = JSON.parse(stdout);
  log(
    "getIpAddressInfo: data = " + JSON.stringify(data, null, 2), "ipap", "info");

  // returns
  /*
    {
      "status": "success",
      "country": "United States",
      "countryCode": "US",
      "region": "CA",
      "regionName": "California",
      "city": "Mountain View",
      "zip": "94043",
      "lat": 37.4043,
      "lon": -122.0748,
      "timezone": "America/Los_Angeles",
      "isp": "AT&T Services, Inc.",
      "org": "AT&T Corp",
      "as": "AS7018 AT&T Services, Inc.",
      "query": "108.211.109.62"
    }
  */

  if (data.status !== "success") {
    log("(Error) getIpAddressInfo: status = " + data.status, "ipap", "error");
    return null;
  }

  let ispAutonomousSystemNumber = "0000";
  let stringArray = data.as.split(" ");
  if (stringArray.length > 0)
    ispAutonomousSystemNumber = stringArray[0].substr(2);

  let timezoneCode = "UTC";
  {
    const { stdout, stderr } = await spawnAsync("zdump", [data.timezone]);
    if (stderr)
      log("(Error) getIpAddressInfo : stderr = " + stderr, "ipap", "error");
    if (stdout)
      log("getIpAddressInfo : stdout = " + stdout, "ipap", "info");
      // returns
      /*
        America/Los_Angeles  Thu Mar  9 17:07:30 2023 PST
      */
        let stringArray = stdout.split(" ");
        timezoneCode = stringArray[stringArray.length-1].replace(/\n$/, "");
  }

  let timezoneGmtOffset = "+000";
  {
    const { stdout, stderr } = await spawnAsync("timezone_to_offset", [data.timezone]);
    if (stderr)
      log("(Error) getIpAddressInfo : stderr = " + stderr, "ipap", "error");
    if (stdout) {
      log("getIpAddressInfo : stdout = " + stdout, "ipap", "info"); 
      timezoneGmtOffset = stdout.replace(/\n$/, "");
    }
  }

  const ret = {
    ispAutonomousSystemNumber: ispAutonomousSystemNumber,
    ispName: data.isp,
    continentCode: "0",
    continentName: "unknown-contenent",
    countryCode: data.countryCode,
    countryName: data.country,
    regionCode: data.region,
    regionName: data.regionName,
    city: data.city,
    zip: data.zip,
    latitude: data.lat,
    longitude: data.lon,
    timezoneId: data.timezone,
    timezoneGmtOffset: timezoneGmtOffset,
    timezoneCode: timezoneCode,
    timezoneIsDaylightSaving: true
  };

  log(
    "getIpAddressInfo: ret = " + JSON.stringify(ret, null, 2),
    "ipap",
    "info"
  );

  return ret;

  // example of success
  /*
  ret = {
    "ispAutonomousSystemNumber": "7018",
    "ispName": "AT&T Services, Inc.",
    "continentCode": "0",
    "continentName": "unknown-contenent",
    "countryCode": "US",
    "countryName": "United States",
    "regionCode": "CA",
    "regionName": "California",
    "city": "Mountain View",
    "zip": "94043",
    "latitude": 37.4043,
    "longitude": -122.0748,
    "timezoneId": "America/Los_Angeles",
    "timezoneGmtOffset": "-0800",
    "timezoneCode": "PST",
    "timezoneIsDaylightSaving": true
  }
  */
}

// function sendSMS(recipient, message) {
//   log("sendSMS: recipient = " + recipient + ", message = " + message);
//   return new Promise((resolve, reject) => {
//     nexmo.message.sendSms(ipapiFrom, recipient, message, (error, response) => {
//       if (error) {
//         log("SMS send failed: error = " + error, "ipapi", "info");
//         reject(error);
//       } else {
//         log("SMS sent: " + response, "ipapi", "info");
//         resolve(response);
//       }
//     });
//   });
// }

module.exports = { getIpAddressInfo };
