const Defs = require("iipzy-shared/src/defs");
const { handleError } = require("iipzy-shared/src/utils/handleError");
const { log } = require("iipzy-shared/src/utils/logFile");

const actionInstanceByClientToken = new Map();
const actionInstanceByActionUuid = new Map();

// request from a sentinel-admin.
async function checkForAction(clientToken, actionStatus) {
  log(
    "sentinelAdminDB.checkForAction: clientToken = " + clientToken,
    "sadm",
    "info"
  );

  let actionInstance = actionInstanceByClientToken.get(clientToken);
  if (actionInstance) {
    actionInstance.actionStatus = actionStatus;
    log(
      "sentinelAdminDB.checkForAction - actionInstance1: " +
        JSON.stringify(actionInstance, null, 2),
      "sadm"
    );
    //
    if (actionInstance.starting || actionInstance.actionStatus.inProgress) {
      if (actionInstance.actionStatus.inProgress)
        actionInstance.starting = false;
      return {
        status: Defs.statusOk,
        results: {
          params: actionInstance.params,
          starting: actionInstance.starting
        }
      };
    }
    if (!actionInstance.completed) {
      actionInstance.completed = true;
      log(
        "sentinelAdminDB.checkForAction - completed: " +
          JSON.stringify(actionInstance, null, 2),
        "sadm"
      );
    }
  } else {
    actionInstance = { actionStatus };
    log(
      "sentinelAdminDB.checkForAction - actionInstance2: " +
        JSON.stringify(actionInstance, null, 2),
      "sadm"
    );
    actionInstanceByClientToken.set(clientToken, actionInstance);
  }
  return { status: Defs.statusOk };
}

function getActionStatus(clientToken) {
  log(
    "sentinelAdminDB.getActionStatus: tgtClientToken = " + clientToken,
    "sadm",
    "info"
  );
  const actionInstance = actionInstanceByClientToken.get(clientToken);
  let actionStatus = null;
  if (actionInstance && actionInstance.actionStatus) {
    actionStatus = actionInstance.actionStatus;
  } else {
    actionStatus = {
      inProgress: false,
      step: "done",
      failed: false
    };
  }

  log(
    "sentinelAdminDB.getActionStatus: status = " +
      JSON.stringify(actionStatus, null, 2),
    "sadm"
  );

  return actionStatus;
}

function setActionStatus(clientToken, actionStatus) {
  const actionInstance = actionInstanceByClientToken.get(clientToken);
  if (actionInstance) {
    actionInstance.actionStatus = actionStatus;
    log(
      "sentinelAdminDB.setActionStatus: clientToken = " +
        clientToken +
        ", actionStatus = " +
        JSON.stringify(actionInstance.actionStatus, null, 2),
      "sadm"
    );
  }
}

// request from a client.
async function startAction(params_) {
  const params = JSON.parse(JSON.stringify(params_));
  log(
    "sentinelAdminDB.startAction: clientToken = " + params.tgtClientToken,
    "sadm",
    "info"
  );

  let actionInstance = actionInstanceByClientToken.get(params.tgtClientToken);
  if (actionInstance && actionInstance.actionStatus) {
    // see if action is in progress.
    if (actionInstance.actionStatus.inProgress) {
      const results = handleError(
        Defs.objectType_clientInstance,
        params.tgtClientToken,
        Defs.statusActionInProgress,
        "Another action is already in progress"
      );
      return { status: Defs.statusActionInProgress, results };
    }
  }

  actionInstance = { params, starting: true, completed: false };

  log(
    "sentinelAdminDB.startAction - starting: " +
      JSON.stringify(actionInstance, null, 2),
    "sadm"
  );

  actionInstanceByClientToken.set(
    actionInstance.params.tgtClientToken,
    actionInstance
  );
  actionInstanceByActionUuid.set(
    actionInstance.params.actionUuid,
    actionInstance
  );

  return { status: Defs.statusOk, results: {} };
}

module.exports = {
  checkForAction,
  getActionStatus,
  setActionStatus,
  startAction
};
