const express = require("express");
const router = express.Router();

const Defs = require("iipzy-shared/src/defs");
const { handleError } = require("iipzy-shared/src/utils/handleError");
const { log, timestampToString } = require("iipzy-shared/src/utils/logFile");

const {
  getThirdPartyApiUsageCounters,
  updateThirdPartyApiUsageCounters
} = require("../db/thirdPartyApiDB");

const { isValidClient } = require("./validateClient");

router.put("/", async (req, res) => {
  log(
    "PUT thirdpartyapi: timestamp = " +
      timestampToString(req.header("x-timestamp")),
    "alrt"
  );

  const clientToken = req.header("x-client-token");
  const authToken = req.header("x-auth-token");
  if (!isValidClient(res, clientToken, false, authToken, false, false)) return;

  const { apiName } = req.body;
  switch (apiName) {
    case Defs.thirdPartyApiName_ipGeolocation: {
      break;
    }
    default: {
      const results = handleError(
        Defs.objectType_clientInstance,
        clientToken,
        Defs.statusInvalidThirdPartyApi,
        "invalid third party api"
      );
      return res.status(Defs.httpStatusUnprocessableEntity).send(results);
    }
  }

  const getOptions = { wantIpGeolocation: true };
  const thirdPartyUsage = await getThirdPartyApiUsageCounters(getOptions);
  thirdPartyUsage.ipGeolocationRequestsDaily++;
  thirdPartyUsage.ipGeolocationRequestsTotal++;
  await updateThirdPartyApiUsageCounters(getOptions, thirdPartyUsage);

  res.send({});
});

module.exports = router;
