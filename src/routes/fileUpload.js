const express = require("express");
const fileUpload = require("express-fileupload");
//const IncomingForm = require("formidable").IncomingForm;
const router = express.Router();

const Defs = require("iipzy-shared/src/defs");
const { handleError } = require("iipzy-shared/src/utils/handleError");
const { log, timestampToString } = require("iipzy-shared/src/utils/logFile");

const { sendDelayedResults } = require("../utils/sendDelayedResults");

const { isValidClient } = require("./validateClient");

router.use(
  fileUpload()
  //fileUpload({ debug: true, limits: { fileSize: 50 * 1024 * 1024 } })
);

// NB: request from a client.
router.post("/upload", async (req, res) => {
  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");

  log(
    "POST fileupload/upload: clientToken = " +
      clientToken +
      ", timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "upld",
    "info"
  );

  if (!isValidClient(res, clientToken, true, null, false, false)) return;

  //?? TODO fixup return objects.
  if (!req.files) {
    log("(Error) POST fileupload/upload: no file to upload", "upld", "error");
    res.send({
      status: false,
      message: "No file uploaded"
    });
  } else {
    log(
      "POST fileupload/upload: file = " +
        req.files.file.name +
        ", size = " +
        req.files.file.size,
      "upld",
      "error"
    );

    const file_ = req.files.file;
    const fileName = clientToken + "-" + file_.name;
    file_.mv("/var/lib/iipzy/uploads/" + fileName);
    res.send({
      status: true,
      message: "File is uploaded",
      data: {
        name: fileName,
        mimetype: file_.mimetype,
        size: file_.size
      }
    });
  }

  log("<<<POST fileupload/upload", "upld", "info");
});

module.exports = router;
