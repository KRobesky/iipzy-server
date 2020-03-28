const { log } = require("iipzy-shared/src/utils/logFile");

function generateRandomCode(length, options) {
  if (isNaN(length)) {
    throw new TypeError(
      "Length must be a number",
      "generate-sms-verification-code/index.js",
      3
    );
  }
  if (length < 1) {
    throw new RangeError(
      "Length must be at least 1",
      "generate-sms-verification-code/index.js",
      6
    );
  }
  let possible = "0123456789";
  let string = "";
  for (let i = 0; i < length; i++) {
    string += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  //?? disable option 2019-07-15
  // if (options) {
  //   if (options.type === "number") {
  //     return parseFloat(string);
  //   }
  // }

  return string;
}

module.exports = { generateRandomCode };
