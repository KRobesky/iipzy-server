const { parsePhoneNumberFromString } = require("libphonenumber-js");

const Defs = require("iipzy-shared/src/defs");
const { log } = require("iipzy-shared/src/utils/logFile");
const {
  getClientLatestOfflineEvent,
  getLatestEvents,
  getUnsentAlerts,
  handlePendingAlerts,
  setEventStatus,
  updateAlert,
  updateLastEventReadId
} = require("../db/eventDB");
const {
  getThirdPartyApiUsageCounters,
  updateThirdPartyApiUsageCounters
} = require("../db/thirdPartyApiDB");

const { sendEmail } = require("../utils/emailSender");
const { sendSMS } = require("../utils/smsSender");

let inCheckMonitorEvents = false;
let inCheckPendingAlerts = false;
let inSendPendingAlerts = false;

const alertTargetByEventClass = new Map();

const eventClassAlertTarget = [
  { eventClass: Defs.eventClass_null, alertTarget: Defs.alertTarget_null },
  {
    eventClass: Defs.eventClass_clientOnLineStatus,
    alertTarget: Defs.alertTarget_email + Defs.alertTarget_sms
  },
  {
    eventClass: Defs.eventClass_clientLoginStatus,
    alertTarget: Defs.alertTarget_null
  },
  {
    eventClass: Defs.eventClass_cpuusage,
    alertTarget: Defs.alertTarget_email + Defs.alertTarget_sms
  },
  {
    eventClass: Defs.eventClass_crash,
    alertTarget: Defs.alertTarget_email + Defs.alertTarget_sms
  },
  {
    eventClass: Defs.eventClass_networkDeviceAdded,
    alertTarget: Defs.alertTarget_email
  },
  {
    eventClass: Defs.eventClass_networkDeviceDeleted,
    alertTarget: Defs.alertTarget_email
  },
  {
    eventClass: Defs.eventClass_networkDeviceIPAddressChanged,
    alertTarget: Defs.alertTarget_email
  },
  {
    eventClass: Defs.eventClass_networkDeviceStatus,
    alertTarget: Defs.alertTarget_email + Defs.alertTarget_sms
  },
  {
    eventClass: Defs.eventClass_pingFail,
    alertTarget: Defs.alertTarget_email
  },
  {
    eventClass: Defs.eventClass_wanIPAddressChanged,
    alertTarget: Defs.alertTarget_email
  }
];

function init() {
  log("monitorEvents.init", "alrt", "info");

  log(
    "monitorEvents.init: eventClassAlertTarget = " +
      JSON.stringify(eventClassAlertTarget, null, 2),
    "alrt",
    "info"
  );

  for (let i = 0; i < eventClassAlertTarget.length; i++) {
    const alertInfo = eventClassAlertTarget[i];
    log(
      "monitorEvents.init: alertInfo = " + JSON.stringify(alertInfo),
      "alrt",
      "info"
    );
    alertTargetByEventClass.set(alertInfo.eventClass, alertInfo.alertTarget);
  }

  setTimeout(() => {
    log("monitorEvents.init - start checkMonitorEvents", "alrt", "info");
    setInterval(async () => {
      if (!inCheckMonitorEvents) {
        inCheckMonitorEvents = true;
        try {
          await checkMonitorEvents();
        } catch (ex) {
          log("Exception) checkMonitorEvents: " + ex, "alrt", "error");
        }
        inCheckMonitorEvents = false;
      }
    }, 5 * 1000);
  }, 1 * 1000);

  setTimeout(() => {
    log("monitorEvents.init - start checkPendingAlerts", "alrt", "info");
    setInterval(async () => {
      if (!inCheckPendingAlerts) {
        inCheckPendingAlerts = true;
        try {
          await checkPendingAlerts();
        } catch (ex) {
          log("Exception) checkPendingAlerts: " + ex, "alrt", "error");
        }
        inCheckPendingAlerts = false;
      }
    }, 5 * 1000);
  }, 4 * 1000);

  setTimeout(() => {
    log("monitorEvents.init - start sendPendingAlerts", "alrt", "info");
    setInterval(async () => {
      if (!inSendPendingAlerts) {
        inSendPendingAlerts = true;
        try {
          await sendPendingAlerts();
        } catch (ex) {
          log("Exception) sendPendingAlerts: " + ex, "alrt", "error");
        }
        inSendPendingAlerts = false;
      }
    }, 5 * 1000);
  }, 7 * 1000);
}

function getAlertTarget(eventTupleString) {
  try {
    const eventTuple = JSON.parse(eventTupleString);
    let eventClass = eventTuple.sec;
    if (eventClass === "") eventClass = eventTuple.ec;
    log("getAlertTarget: eventClass = " + eventClass, "alrt", "info");
    const alertTarget = alertTargetByEventClass.get(eventClass);
    if (alertTarget) return alertTarget;
  } catch (ex) {
    log("(Exception) getAlertTarget: " + ex, "alrt", "error");
  }
  return Defs.alertTarget_null;
}

async function handleClientStatus_noSub(
  eventTuple,
  eventActive,
  userId,
  eventData
) {
  log(">>>handleClientStatus_noSub", "alrt", "info");
  let eventId = 0;
  if (!eventData.isOnLine) {
    if (eventData.isLoggedIn) {
      log(
        "handleClientStatus_noSub: Unscheduled Down, client = " +
          eventData.clientToken +
          ", time = " +
          eventData.CreateTime,
        "bkgd"
      );
      await setEventStatus(
        eventTuple,
        eventActive,
        userId,
        eventData.clientName + ": " + eventData.message
      );
      eventId = eventData.eventId;
    }
  } else {
    log(
      "monitorEvents.checkMonitorEvents: Up, client = " +
        eventData.clientToken +
        ", time = " +
        eventData.CreateTime,
      "bkgd"
    );
    await setEventStatus(
      eventTuple,
      eventActive,
      userId,
      eventData.clientName + ": " + eventData.message
    );
    eventId = eventData.eventId;
  }
  log("<<<handleClientStatus_noSub", "alrt", "info");
  return eventId;
}

async function handleClientStatus_networkDevicePresence(
  eventTuple,
  eventActive,
  userId,
  eventData
) {
  log(">>>handleClientStatus_networkDevicePresence", "alrt", "info");
  await setEventStatus(
    eventTuple,
    eventActive,
    userId,
    eventData.clientName + ": " + eventData.message
  );
  log("<<<handleClientStatus_networkDevicePresence", "alrt", "info");
  return 0;
}

async function handleClientStatus_networkDeviceIPAddressChanged(
  eventTuple,
  eventActive,
  userId,
  eventData
) {
  log(">>>handleClientStatus_networkDeviceIPAddressChanged", "alrt", "info");
  await setEventStatus(
    eventTuple,
    eventActive,
    userId,
    eventData.clientName + ": " + eventData.message
  );
  log("<<<handleClientStatus_networkDeviceIPAddressChanged", "alrt", "info");
  return 0;
}

async function handleClientStatus_networkDeviceStatus(
  eventTuple,
  eventActive,
  userId,
  eventData
) {
  log(">>>handleClientStatus_networkDeviceStatus", "alrt", "info");
  await setEventStatus(
    eventTuple,
    eventActive,
    userId,
    eventData.clientName + ": " + eventData.message
  );

  log("<<<handleClientStatus_networkDeviceStatus", "alrt", "info");
  return eventData.eventId;
}

async function handleClientStatus_pingFail(
  eventTuple,
  eventActive,
  userId,
  eventData
) {
  log(
    ">>>handleClientStatus_pingFail: eventData = " +
      JSON.stringify(eventData, null, 2),
    "alrt",
    "info"
  );
  let ignoreEvent = false;
  const { info } = eventData;
  if (info) {
    const results = await getClientLatestOfflineEvent(eventTuple.id);
    log(
      "handleClientStatus_pingFail: " + JSON.stringify(results, null, 2),
      "alrt",
      "info"
    );
    if (results && results.length > 0) {
      const result = results[results.length - 1];
      // if offline still active or online event was within the last two minutes, don't report the pingFail event.
      if (
        result.EventActive ||
        result.EventTimestamp > info.timestampLast - 2 * 60 * 1000
      ) {
        log("handleClientStatus_pingFail: ignoring event", "alrt", "info");
        ignoreEvent = true;
      }
    }
  }

  if (!ignoreEvent) {
    await setEventStatus(
      eventTuple,
      eventActive,
      userId,
      eventData.clientName + ": " + eventData.message
    );
  }

  log("<<<handleClientStatus_pingFail", "alrt", "info");
  return eventData.eventId;
}

async function handleClientStatus_wanIPAddressChanged(
  eventTuple,
  eventActive,
  userId,
  eventData
) {
  log(">>>handleClientStatus_wanIPAddressChanged", "alrt", "info");
  await setEventStatus(
    eventTuple,
    eventActive,
    userId,
    eventData.clientName + ": " + eventData.message
  );
  log("<<<handleClientStatus_wanIPAddressChanged", "alrt", "info");
  return 0;
}

async function handleClientStatus(eventTuple, eventActive, userId, eventData) {
  switch (eventTuple.sec) {
    case Defs.eventClass_null:
      return await handleClientStatus_noSub(
        eventTuple,
        eventActive,
        userId,
        eventData
      );
    case Defs.eventClass_networkDeviceAdded:
    case Defs.eventClass_networkDeviceDeleted:
      return await handleClientStatus_networkDevicePresence(
        eventTuple,
        eventActive,
        userId,
        eventData
      );
    case Defs.eventClass_networkDeviceIPAddressChanged:
      return await handleClientStatus_networkDeviceIPAddressChanged(
        eventTuple,
        eventActive,
        userId,
        eventData
      );
    case Defs.eventClass_networkDeviceStatus:
      return await handleClientStatus_networkDeviceStatus(
        eventTuple,
        eventActive,
        userId,
        eventData
      );
    case Defs.eventClass_pingFail:
      return await handleClientStatus_pingFail(
        eventTuple,
        eventActive,
        userId,
        eventData
      );
    case Defs.eventClass_wanIPAddressChanged:
      return await handleClientStatus_wanIPAddressChanged(
        eventTuple,
        eventActive,
        userId,
        eventData
      );
    default:
      return 0;
  }
}

async function handleCpuUsage_server(
  eventTuple,
  eventActive,
  userId,
  eventData
) {
  log(">>>handleCpuUsage_server", "alrt", "info");
  await setEventStatus(eventTuple, eventActive, userId, eventData.message);
  log("<<<handleCpuUsage_server", "alrt", "info");
  return eventData.eventId;
}

async function handleCpuUsage(eventTuple, eventActive, userId, eventData) {
  switch (eventTuple.ot) {
    case Defs.objectType_server: {
      return await handleCpuUsage_server(
        eventTuple,
        eventActive,
        userId,
        eventData
      );
      break;
    }
  }
}

async function handleCrash_server(eventTuple, eventActive, userId, eventData) {
  log(">>>handleCrash_server", "alrt", "info");
  await setEventStatus(eventTuple, eventActive, userId, eventData.message);
  log("<<<handleCrash_server", "alrt", "info");
  return eventData.eventId;
}

async function handleCrash(eventTuple, eventActive, userId, eventData) {
  switch (eventTuple.ot) {
    case Defs.objectType_server: {
      return await handleCrash_server(
        eventTuple,
        eventActive,
        userId,
        eventData
      );
      break;
    }
  }
}

async function checkMonitorEvents() {
  log(">>>checkMonitorEvents", "alrt", "info");

  try {
    //let eventId = 0;
    const results = await getLatestEvents();
    if (results && results.__hadError__) return;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      log(
        "checkMonitorEvents: getLatestEvents result = " +
          JSON.stringify(result, null, 2),
        "alrt",
        "info"
      );

      const eventId = result.Id;

      if (result.ClientType === Defs.clientType_web || result.SuppressAlerts) {
        // skip event from client using an appliance
        // - or - suppressAlerts.
        await updateLastEventReadId(eventId);
        continue;
      }

      const eventTuple = JSON.parse(result.EventTuple);
      log(
        "....eventTuple......" + JSON.stringify(eventTuple, null, 2),
        "alrt",
        "info"
      );
      /*
      eventTuple ={
        "ec": "clientStatus",
        "ot": "clientInstance",
        "id": "1",
        "sec": "",
        "sot": "",
        "sid": ""
      }
      */

      let eventData = JSON.parse(result.EventData);
      eventData.eventId = result.Id;
      eventData.createTime = result.CreateTime;

      switch (eventTuple.ec) {
        case Defs.eventClass_clientOnLineStatus: {
          //eventId =
          await handleClientStatus(
            eventTuple,
            result.EventActive,
            result.AlertUserId,
            eventData
          );
          break;
        }
        case Defs.eventClass_cpuusage: {
          await handleCpuUsage(
            eventTuple,
            result.EventActive,
            result.AlertUserId,
            eventData
          );
          break;
        }
        case Defs.eventClass_crash: {
          await handleCrash(
            eventTuple,
            result.EventActive,
            result.AlertUserId,
            eventData
          );
          break;
        }
        default:
          break;
      }

      //if (eventId != 0)
      await updateLastEventReadId(eventId);
    }
  } catch (ex) {
    log("(Exception) checkMonitorEvents: " + ex);
  }

  log("<<<checkMonitorEvents", "alrt", "info");
}

async function checkPendingAlerts() {
  log(">>>checkPendingAlerts", "alrt", "info");

  try {
    await handlePendingAlerts();
  } catch (ex) {
    log("(Exception) checkPendinglerts: " + ex);
  }
  log("<<<checkPendingAlerts", "alrt", "info");
}

async function sendPendingAlerts() {
  log(">>>sendPendingAlerts", "alrt", "info");

  // check for daily third party usage at limit.  NB: $$$
  const getOptions = { wantEmail: true, wantSMS: true };
  const thirdPartyUsage = await getThirdPartyApiUsageCounters(getOptions);
  const thirdPartyUsage_Org = Object.assign({}, thirdPartyUsage);
  log("--thrd - before: " + JSON.stringify(thirdPartyUsage, null, 2));

  try {
    const results = await getUnsentAlerts();
    if (results && results.__hadError__) return;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      log("  Id            = " + result.Id, "alrt", "info");
      log("  CreateTime    = " + result.CreateTime, "alrt", "info");
      log("  EventStatusId = " + result.EventStatusId, "alrt", "info");
      log("  AlertTime     = " + result.AlertTime);
      log("  UserName      = " + result.UserName, "alrt", "info");
      log("  EmailAddress  = " + result.EmailAddress, "alrt", "info");
      log("  MobilePhoneNo = " + result.MobilePhoneNo, "alrt", "info");
      log("  Message       = " + result.Message, "alrt", "info");
      log("  EmailSent     = " + result.EmailSent, "alrt", "info");
      log("  TextSent      = " + result.TextSent, "alrt", "info");
      log("  EventTuple    = " + result.EventTuple, "alrt", "info");

      const alertTarget = getAlertTarget(result.EventTuple);

      log("  AlertTarget   = " + alertTarget, "alrt", "info");

      // send email.
      let sentEmail = result.EmailSent;
      if (!sentEmail) {
        sentEmail = 2;
        if (
          alertTarget & Defs.alertTarget_email &&
          thirdPartyUsage.emailSendsDaily < thirdPartyUsage.emailSendsDailyLimit
        ) {
          if (result.EmailAddress) {
            if (
              await sendEmail(
                result.EmailAddress,
                "Alert from iipzy.net",
                result.Message
              )
            ) {
              sentEmail = 1;
              thirdPartyUsage.emailSendsDaily++;
              thirdPartyUsage.emailSendsTotal++;
            } else sentEmail = 0;
          }
        }
      }

      // send SMS
      let sentSMS = result.TextSent;
      if (!sentSMS) {
        sentSMS = 2;
        if (
          alertTarget & Defs.alertTarget_sms &&
          thirdPartyUsage.smsSendsDaily < thirdPartyUsage.smsSendsDailyLimit
        ) {
          if (result.MobilePhoneNo) {
            const phoneNumber = parsePhoneNumberFromString(
              result.MobilePhoneNo,
              "US"
            );
            if (
              await sendSMS(
                phoneNumber.number,
                "Alert from iipzy.net: " + result.Message
              )
            ) {
              sentSMS = 1;
              thirdPartyUsage.smsSendsDaily++;
              thirdPartyUsage.smsSendsTotal++;
            } else sentSMS = 0;
          }
        }
      }

      if (sentEmail !== result.EmailSent || sentSMS !== result.TextSent)
        await updateAlert(
          result.Id,
          result.EventStatusId,
          result.AlertTime,
          sentEmail,
          sentSMS
        );
    }
  } catch (ex) {
    log("(Exception) sendPendinglerts: " + ex);
  }

  log("--thrd - after: " + JSON.stringify(thirdPartyUsage, null, 2));

  if (JSON.stringify(thirdPartyUsage) !== JSON.stringify(thirdPartyUsage_Org))
    await updateThirdPartyApiUsageCounters(getOptions, thirdPartyUsage);

  log("<<<sendPendingAlerts", "alrt", "info");
}

module.exports = { init };
