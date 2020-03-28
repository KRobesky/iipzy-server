const fs = require("fs");
const Nexmo = require("nexmo");
const os = require("os");

const { log } = require("iipzy-shared/src/utils/logFile");

const dataPath = process.platform === "win32" ? "c:/temp/" : "/etc/iipzy";
const smsConfigPath = dataPath + "/sms-config.json";
let smsApiKey = null;
let smsApiSecret = null;
let smsFrom = null;

function getSMSCredentials() {
  try {
    const { apiKey, apiSecret, from } = JSON.parse(
      fs.readFileSync(smsConfigPath)
    );
    log(
      "smsCredentials: apiKey =" +
        apiKey +
        ", apiSecret=" +
        apiSecret +
        ", from = " +
        from,
      "sms",
      "info"
    );
    smsApiKey = apiKey;
    smsApiSecret = apiSecret;
    smsFrom = from;
  } catch (error) {
    log(
      "(Exception) getSMSCredentials: " + error + ", code = " + error.code,
      "sms",
      "info"
    );
    return {};
  }
}

getSMSCredentials();

const nexmo = new Nexmo({ apiKey: smsApiKey, apiSecret: smsApiSecret });

async function sendSMS(recipient, message) {
  log("sendSMS: recipient = " + recipient + ", message = " + message);

  if (!recipient) return false;

  try {
    await new Promise((resolve, reject) => {
      nexmo.message.sendSms(smsFrom, recipient, message, (error, response) => {
        if (error) {
          log("(Error) SMS send failed: error = " + error, "sms", "error");
          reject(error);
        } else {
          log("SMS sent: " + JSON.stringify(response), "sms", "verbose");
          resolve(response);
        }
      });
    });
  } catch (ex) {
    log("(Exception) sendSMS: " + ex, "sms", "error");
    return false;
  }
  return true;
}

module.exports = { sendSMS };
