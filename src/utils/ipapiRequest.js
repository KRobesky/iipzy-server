const fs = require("fs");

const Defs = require("iipzy-shared/src/defs");
const http = require("iipzy-shared/src/services/httpService");
const { log } = require("iipzy-shared/src/utils/logFile");

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
  // https://api.ipapi.com/<ipv4Address>?access_key=<ipapiAccessKey>
  const { data, status } = await http.get(
    "https://api.ipapi.com/" + ipv4Address + "?access_key=" + ipapiAccessKey
  );

  console.log("------------status = " + status);

  if (status != Defs.httpStatusOk) {
    log("(Error) getIpAddressInfo: status = " + status, "ipap", "error");
    return null;
  }

  if (data.error) {
    log(
      "(Error) getIpAddressInfo: data = " + JSON.stringify(data, null, 2),
      "ipap",
      "error"
    );
    return null;
  }

  const ret = {
    ispAutonomousSystemNumber: data.connection.asn,
    ispName: data.connection.isp,
    continentCode: data.continent_code,
    continentName: data.continent_name,
    countryCode: data.country_code,
    countryName: data.country_name,
    regionCode: data.region_code,
    regionName: data.region_name,
    city: data.city,
    zip: data.zip,
    latitude: data.latitude,
    longitude: data.longitude,
    timezoneId: data.time_zone.id,
    timezoneGmtOffset: data.time_zone.gmt_offset,
    timezoneCode: data.time_zone.code,
    timezoneIsDaylightSaving: data.time_zone.is_daylight_saving
  };

  log(
    "getIpAddressInfo: ret = " + JSON.stringify(ret, null, 2),
    "ipap",
    "info"
  );

  return ret;

  // example of success
  // data = {
  //   ip: "172.217.14.174",
  //   type: "ipv4",
  //   continent_code: "NA",
  //   continent_name: "North America",
  //   country_code: "US",
  //   country_name: "United States",
  //   region_code: "TX",
  //   region_name: "Texas",
  //   city: "Dallas",
  //   zip: "75219",
  //   latitude: 32.8054313659668,
  //   longitude: -96.8142318725586,
  //   location: {
  //     geoname_id: 4684888,
  //     capital: "Washington D.C.",
  //     languages: [
  //       {
  //         code: "en",
  //         name: "English",
  //         native: "English"
  //       }
  //     ],
  //     country_flag: "https://assets.ipapi.com/flags/us.svg",
  //     country_flag_emoji: "ðŸ‡ºðŸ‡¸",
  //     country_flag_emoji_unicode: "U+1F1FA U+1F1F8",
  //     calling_code: "1",
  //     is_eu: false
  //   },
  //   time_zone: {
  //     id: "America/Chicago",
  //     current_time: "2019-09-19T13:36:26-05:00",
  //     gmt_offset: -18000,
  //     code: "CDT",
  //     is_daylight_saving: true
  //   },
  //   currency: {
  //     code: "USD",
  //     name: "US Dollar",
  //     plural: "US dollars",
  //     symbol: "$",
  //     symbol_native: "$"
  //   },
  //   connection: {
  //     asn: 15169,
  //     isp: "Google LLC"
  //   }
  // };

  // example of failure.
  // data = {
  //   success: false,
  //   error: {
  //     code: 101,
  //     type: "invalid_access_key",
  //     info:
  //       "You have not supplied a valid API Access Key. [Technical Support: support@apilayer.com]"
  //   }
  // };
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
