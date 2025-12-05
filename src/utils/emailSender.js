const fs = require("fs");
const fetch = require("node-fetch");
//const sgMail = require('@sendgrid/mail')
const os = require("os");

const { log } = require("iipzy-shared/src/utils/logFile");

const emailConfigPath = "/etc/iipzy/email-config.json";

let emailApi;
let emailApiUrl;
let emailApiKeyHeader; 
let emailApiKey; 
let emailApiSender;

function getEmailCredentials() {
  try {
    const { api, apiUrl, apiKeyHeader, apiKey, apiSender } = JSON.parse(fs.readFileSync(emailConfigPath));
    emailApi = api;
    emailApiUrl = apiUrl;
    emailApiKeyHeader = apiKeyHeader; 
    emailApiKey = apiKey; 
    emailApiSender = apiSender;
  } catch (error) {
    log(
      "(Exception) getEmailCredentials: " + error + ", code = " + error.code,
      "mail",
      "error"
    );
    return;
  }

  if (!emailApi || emailApi !== "smpt2go" || !emailApiUrl || !emailApiKeyHeader || !emailApiKey || !emailApiSender) {
    log(
      "(Error) getEmailCredentials: invalid email config",
      "mail",
      "error"
    );
    return;
  }

  log("getEmailCredentials: api = '" + emailApi + "'", "mail", "info");
  log("getEmailCredentials: apiUrl = '" + emailApiUrl + "'", "mail", "info");
  log("getEmailCredentials: apiKeyHeader = '" + emailApiKeyHeader + "'", "mail", "info");
  log("getEmailCredentials: apiKey = '" + emailApiKey + "'", "mail", "info");
  log("getEmailCredentials: apiSender = '" + emailApiSender + "'", "mail", "info");
}

getEmailCredentials();

//log("emailSender: homeDir = " + os.homedir(), "mail", "info");

let sendEmailRetryTimestamp = 0;
const sendEmailRetryTime = 30 * 60 * 1000; // retry in 30 minutes

async function sendEmail(recipient, subject, body) {
  if (!emailApi || emailApi !== "smpt2go") return false;
  
  if (!recipient) return false;

  if (sendEmailRetryTimestamp > 0 && sendEmailRetryTimestamp > Date.now()) return false;

  const body_ = {
    to: [recipient],
    sender: emailApiSender,
    text_body: body,
    subject: subject
  };

  const headers_ = {
    "Content-Type": "application/json",
    [emailApiKeyHeader] : emailApiKey,
    "Accept": "application/json"
  };

  //log(
  //  "sendEmail: headers: '" + JSON.stringify(headers_) + "'",
  //  "mail",
  //  "info"
  //);

  const response = await fetch(emailApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [emailApiKeyHeader] : emailApiKey,
      "Accept": "application/json"
    },
    body: JSON.stringify(body_)
  });

  const data = await response.json();
  // sendEmail: response: '{"request_id":"d46ad82c-5bbd-4f97-b570-a46c61d74771","data":{"succeeded":1,"failed":0,"failures":[],"email_id":"1vRJsm-FnQW0hPr94H-RGxI"}}'
  log(
    "sendEmail: response: '" + JSON.stringify(data) + "'",
    "mail",
    "info"
  );
  const success = data.data.succeeded === 1;
  log(
    "sendEmail: success: " + success,
    "mail",
    "info"
  );

 
  return success;

}

//async function sendEmail(recipient, subject, body) {
//   if (!recipient) return false;

//   if (sendEmailRetryTimestamp > 0 && sendEmailRetryTimestamp > Date.now()) {
//     return false;
//   }

//   /*
//   const mailOptions = {
//     from: "iipzy.com@gmail.com",
//     to: recipient,
//     subject: subject,
//     text: body
//   };

//   try {
//     await new Promise((resolve, reject) => {
//       transporter.sendMail(mailOptions, function(error, info) {
//         if (error) {
//           log(error, "mail", "info");
//           sendEmailRetryTimestamp = Date.now() + sendEmailRetryTime;
//           reject(error);
//         } else {
//           log("Email sent: " + info.response, "mail", "info");
//           sendEmailRetryTimestamp = 0;
//           resolve(info);
//         }
//       });
//     });
//   } catch (ex) {
//     log("(Exception) sendEmail: " + ex, "mail", "error");
//     return false;
//   }
//   return true;
//   */

//   const msg = {
//     to: recipient,
//     from: "iipzy.com@gmail.com",
//     subject: subject,
//     text: body,
//     html: '<strong>' + body + '</strong>',
//   }

//   try {
//     await sgMail.send(msg);
//     log("Email sent", "mail", "info");
//     sendEmailRetryTimestamp = 0;
//   } catch (error) {
//     log("(Error): " + error, "mail", "error"); 
//     if (error.response) {
//       log("(Error) response: " + error.response.body, "mail", "error");
//     }
//     sendEmailRetryTimestamp = Date.now() + sendEmailRetryTime;
//     return false;
//   }
//   return true;
// }


module.exports = { sendEmail };
