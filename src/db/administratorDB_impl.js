const EventEmitter = require("events");
const uuidv4 = require("uuid/v4");

const Defs = require("iipzy-shared/src/defs");
const { handleError } = require("iipzy-shared/src/utils/handleError");
const { log } = require("iipzy-shared/src/utils/logFile");
const { format, getConnection, query, release } = require("../utils/mysql");

const tgtByClientToken = new Map();

const eventEmitter = new EventEmitter();

function wait(actionUuid) {
  return new Promise((resolve, reject) => {
    eventEmitter.on(actionUuid, (actionResult) => {
      resolve(actionResult);
    });
  });
}

// request from a client.
async function addAction(request) {
  log(
    "administratorDB.addAction: request = " + JSON.stringify(request, null, 2),
    "admn",
    "info"
  );

  let actionResult = {};

  let actionUuid = null;
  let tgt = tgtByClientToken.get(request.tgtClientToken);
  if (tgt) {
    log("....tgt=" + JSON.stringify(tgt, null, 2));
    actionUuid = uuidv4();
    const action = { actionUuid, request };
    tgt.actions.push(action);
    log(
      "administratorDB.addAction: actions = " +
        JSON.stringify(tgt.actions, null, 2),
      "admn",
      "info"
    );

    if (actionUuid) actionResult = await wait(actionUuid);
  }

  log("<<<administratorDB.addAction", "admn", "info");

  return actionResult;
}

// request from an appliance.
async function checkForAction(clientToken, actionAcks) {
  log(
    "administratorDB.checkForAction: clientToken = " +
      clientToken +
      ", actionAcks = " +
      JSON.stringify(actionAcks, null, 2),
    "admn",
    "info"
  );

  let tgt = tgtByClientToken.get(clientToken);
  if (tgt) {
    if (actionAcks) {
      for (let i = 0; i < actionAcks.length; i++) {
        const { actionUuid, actionResult } = actionAcks[i];
        if (actionUuid) {
          // completion.
          log(
            "administratorDB.checkForAction: completion for actionUuid = " +
              actionUuid +
              ", result = " +
              JSON.stringify(actionResult, null, 2),
            "admn",
            "info"
          );
          // remove from tgt object
          for (let j = 0; j < tgt.actions.length; j++) {
            const action = tgt.actions[j];
            if (action.actionUuid === actionUuid) {
              //log("---removing tgt action= " + JSON.stringify(action, null, 2));
              tgt.actions.splice(j, 1);
              break;
            }
          }
          // wake waiter.
          eventEmitter.emit(actionUuid, actionResult);
        }
      }
    }
    if (tgt.actions.length > 0) {
      log(
        "administratorDB.checkForAction: actions = " +
          JSON.stringify(tgt.actions, null, 2),
        "admn",
        "info"
      );
      return tgt.actions;
    }
  } else {
    const actions = [];
    tgtByClientToken.set(clientToken, { actions });
  }

  return [];
}

module.exports = {
  addAction,
  checkForAction
};
