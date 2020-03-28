const fs = require("fs");
const nodemailer = require("nodemailer");
const os = require("os");

const { log } = require("iipzy-shared/src/utils/logFile");

const dataPath = process.platform === "win32" ? "c:/temp/" : "/etc/iipzy";
const emailConfigPath = dataPath + "/email-config.json";
let emailUserName = null;
let emailPassword = null;

function getEmailCredentials() {
  try {
    const { user, pass } = JSON.parse(fs.readFileSync(emailConfigPath));
    log("emailCredentials: user =" + user + ", pass=" + pass, "emal", "info");
    emailUserName = user;
    emailPassword = pass;
  } catch (error) {
    log(
      "(Exception) getEmailCredentials: " + error + ", code = " + error.code,
      "emal",
      "info"
    );
    return {};
  }
}

getEmailCredentials();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: emailUserName,
    pass: emailPassword
  }
});

log("emailSender: homeDir = " + os.homedir(), "emal", "info");

let sendEmailRetryTimestamp = 0;
const sendEmailRetryTime = 30 * 60 * 1000; // retry in 30 minutes

async function sendEmail(recipient, subject, body) {
  if (!recipient) return false;

  if (sendEmailRetryTimestamp > 0 && sendEmailRetryTimestamp > Date.now()) {
    return false;
  }

  const mailOptions = {
    from: "iipzy.com@gmail.com",
    to: recipient,
    subject: subject,
    text: body
  };

  try {
    await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
          log(error, "emal", "info");
          sendEmailRetryTimestamp = Date.now() + sendEmailRetryTime;
          reject(error);
        } else {
          log("Email sent: " + info.response, "emal", "info");
          sendEmailRetryTimestamp = 0;
          resolve(info);
        }
      });
    });
  } catch (ex) {
    log("(Exception) sendEmail: " + ex, "emal", "error");
    return false;
  }
  return true;
}

module.exports = { sendEmail };
