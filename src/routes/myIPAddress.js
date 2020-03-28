const express = require("express");
const router = express.Router();

//const Defs = require("iipzy-shared/src/defs");
const { log } = require("iipzy-shared/src/utils/logFile");

router.get("/", async (req, res) => {
  log("GET myIPAddress: " + req.ip, "myip", "info");

  return res.send({
    yourIPAddress: req.ip.substring(7),
    timestamp: Date.now()
  });
});

module.exports = router;
