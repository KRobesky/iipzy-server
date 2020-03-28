const express = require("express");
const router = express.Router();

const Defs = require("iipzy-shared/src/defs");
const { log, timestampToString } = require("iipzy-shared/src/utils/logFile");

router.get("/", async (req, res) => {
  log(
    "GET areyouserver: timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "rusv",
    "info"
  );

  const reqUuid = req.query.requuid;
  if (reqUuid && reqUuid === Defs.reqAreYouServerUuid) {
    return res.send({ rspUuid: Defs.rspAreYouServerUuid });
  }

  setTimeout(() => {
    res.send({});
  }, 5 * 1000);
});

module.exports = router;
