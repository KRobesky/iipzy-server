const fs = require("fs");
const sgMail = require('@sendgrid/mail')
const os = require("os");

const { log } = require("iipzy-shared/src/utils/logFile");

const emailConfigPath = "/etc/iipzy/email-config.json";

function getEmailCredentials() {
  try {
    const { sgMailApiKey } = JSON.parse(fs.readFileSync(emailConfigPath));
    log("emailCredentials: apiKey =" + sgMailApiKey, "mail", "info");
    sgMail.setApiKey(sgMailApiKey)
  } catch (error) {
    log(
      "(Exception) getEmailCredentials: " + error + ", code = " + error.code,
      "mail",
      "info"
    );
    return {};
  }
}

getEmailCredentials();

log("emailSender: homeDir = " + os.homedir(), "mail", "info");

let sendEmailRetryTimestamp = 0;
const sendEmailRetryTime = 30 * 60 * 1000; // retry in 30 minutes

async function sendEmail(recipient, subject, body) {
  if (!recipient) return false;

  if (sendEmailRetryTimestamp > 0 && sendEmailRetryTimestamp > Date.now()) {
    return false;
  }

  /*
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
          log(error, "mail", "info");
          sendEmailRetryTimestamp = Date.now() + sendEmailRetryTime;
          reject(error);
        } else {
          log("Email sent: " + info.response, "mail", "info");
          sendEmailRetryTimestamp = 0;
          resolve(info);
        }
      });
    });
  } catch (ex) {
    log("(Exception) sendEmail: " + ex, "mail", "error");
    return false;
  }
  return true;
  */

  const msg = {
    to: recipient,
    from: "iipzy.com@gmail.com",
    subject: subject,
    text: body,
    html: '<strong>iipzy</strong>',
  }

  try {
    await sgMail.send(msg);
    log("Email sent", "mail", "info");
    sendEmailRetryTimestamp = 0;
  } catch (error) {
    log("(Error): " + error, "mail", "error"); 
    if (error.response) {
      log("(Error) response: " + error.response.body, "mail", "error");
    }
    sendEmailRetryTimestamp = Date.now() + sendEmailRetryTime;
    return false;
  }
  return true;
}

module.exports = { sendEmail };
