const Defs = require("iipzy-shared/src/defs");
const { log } = require("iipzy-shared/src/utils/logFile");
const { handleDBException } = require("iipzy-shared/src/utils/handleError");
const {
  abortTransaction,
  beginTransaction,
  commitTransaction,
  format,
  getConnection,
  query,
  release
} = require("../utils/mysql");

function createEventTuple(
  eventClass,
  objectType,
  objectId,
  subEventClass,
  subObjectType,
  subObjectId
) {
  return (
    '{"ec":"' +
    eventClass +
    '","ot":"' +
    objectType +
    '","id":"' +
    objectId +
    '","sec":"' +
    subEventClass +
    '","sot":"' +
    subObjectType +
    '","sid":"' +
    subObjectId +
    '"}'
  );
}

// SELECT * FROM Event WHERE JSON_EXTRACT(EventTupleSearchable, '$.id') = "64";

async function addEvent(
  eventClass,
  objectType,
  objectId,
  subEventClass,
  subObjectType,
  subObjectId,
  eventActive,
  eventData,
  alertUserId
) {
  log(">>>addEvent", "evnt", "info");

  let results = {};

  const connection = await getConnection("addEvent");

  try {
    results = await addEventWithConnection(
      connection,
      eventClass,
      objectType,
      objectId,
      subEventClass,
      subObjectType,
      subObjectId,
      eventActive,
      eventData,
      alertUserId
    );
  } catch (ex) {
    log("(Exception) addEvent: " + ex, "evnt", "info");
    results = handleDBException("event", "", "insert", ex);
  }

  release(connection, "addEvent");

  log("<<<addEvent", "evnt", "info");

  return results;
}

async function addEventWithConnection(
  connection,
  eventClass,
  objectType,
  objectId,
  subEventClass,
  subObjectType,
  subObjectId,
  eventActive,
  eventData,
  alertUserId
) {
  log(">>>addEventWithConnection", "evnt", "info");

  let results = {};

  const eventTuple = createEventTuple(
    eventClass,
    objectType,
    objectId,
    subEventClass,
    subObjectType,
    subObjectId
  );

  let insertStatement =
    "INSERT INTO Event SET EventTuple = ?, EventActive = ?, EventData = ?, AlertUserId = ?, EventTupleSearchable = ?";
  insertStatement = format(insertStatement, [
    eventTuple,
    eventActive,
    eventData,
    alertUserId,
    eventTuple
  ]);
  log("insert: '" + insertStatement + "'", "evnt", "info");

  await query(connection, insertStatement);

  log("<<<addEventWithConnection", "evnt", "info");

  return results;
}

async function getClientLatestOfflineEvent(clientId) {
  log(">>>getClientLatestOfflineEvent", "evnt", "info");

  let results = {};

  const connection = await getConnection("getClientLatestOfflineEvent");

  try {
    let selectStatement =
      "SELECT Id, UNIX_TIMESTAMP(CreateTime) AS EventTimestamp, EventActive FROM Event " +
      "WHERE CONVERT(JSON_EXTRACT(EventTupleSearchable, '$.id'), UNSIGNED INTEGER) = ? " +
      "AND JSON_EXTRACT(EventTupleSearchable, '$.ec') = 'clientOnLineStatus' " +
      "AND JSON_EXTRACT(EventTupleSearchable, '$.sec') = '' " +
      "ORDER BY CreateTime DESC LIMIT 1";
    selectStatement = format(selectStatement, [clientId]);
    log("select: '" + selectStatement + "'", "evnt", "info");

    const { result } = await query(connection, selectStatement);
    results = result;
  } catch (ex) {
    log("(Exception) getClientLatestOfflineEvent: " + ex, "evnt", "info");
    results = handleDBException("event", "", "select", ex);
  }

  release(connection, "getClientLatestOfflineEvent");

  log("<<<getClientLatestOfflineEvent", "evnt", "info");

  return results;
}

async function getLatestEvents() {
  log(">>>getLatestEvents", "evnt", "info");

  let results = {};

  const connection = await getConnection("getLatestEvents");

  try {
    const selectStatement =
      "SELECT Event.*, ClientInstance.ClientType, ClientInstance.SuppressAlerts FROM `Event` " +
      "LEFT JOIN ClientInstance ON ClientInstance.Id = CONVERT(JSON_EXTRACT(EventTupleSearchable, '$.id'), UNSIGNED INTEGER) " +
      "LEFT JOIN MonitorControl ON MonitorControl.Id = 1 WHERE Event.Id > MonitorControl.LastReadEventId";
    log("select: '" + selectStatement + "'", "evnt", "info");

    const { result } = await query(connection, selectStatement);

    results = result;
  } catch (ex) {
    log("(Exception) getLatestEvents: " + ex, "evnt", "info");
    results = handleDBException("event", "", "select", ex);
  }

  release(connection, "getLatestEvents");

  log("<<<getLatestEvents", "evnt", "info");

  return results;
}

async function getUnsentAlerts() {
  log(">>>getUnsentAlert", "evnt", "info");

  let results = {};

  const connection = await getConnection("getUnsentAlerts");

  try {
    const selectStatement =
      "SELECT Alert.*, EventStatus.EventTuple FROM Alert " +
      "LEFT JOIN EventStatus ON EventStatus.Id = Alert.EventStatusId " +
      "WHERE EmailSent = 0 OR TextSent = 0";
    log("select: '" + selectStatement + "'", "evnt", "info");

    const { result } = await query(connection, selectStatement);

    results = result;
  } catch (ex) {
    log("(Exception) getUnsentAlert: " + ex, "evnt", "info");
    results = handleDBException("event", "", "select", ex);
  }

  release(connection, "getUnsentAlerts");

  log("<<<getUnsentAlert", "evnt", "info");

  return results;
}

async function getUser(connection, userId) {
  selectStatement = "SELECT * FROM User WHERE Id = ?";
  selectStatement = format(selectStatement, [userId]);
  log("select: '" + selectStatement + "'", "evnt", "info");
  const { result } = await query(connection, selectStatement);
  return result[0];
}

async function handlePendingAlerts() {
  log(">>>handlePendingAlerts", "evnt", "info");

  const connection = await getConnection("handlePendingAlerts");

  try {
    let selectStatement =
      "SELECT * FROM EventStatus WHERE AlertPending = 0 AND AlertTime < CURRENT_TIME";
    log("select: '" + selectStatement + "'", "evnt", "info");

    const { result } = await query(connection, selectStatement);
    for (let i = 0; i < result.length; i++) {
      try {
        await beginTransaction(connection, "handlePendingAlerts");

        const row = result[i];
        log("  Id          = " + row.Id, "bkgd");
        log("  CreateTime  = " + row.CreateTime, "bkgd");
        log("  UpdateTime  = " + row.UpdateTime, "bkgd");
        log("  EventTuple  = " + row.EventTuple, "bkgd");
        log("  EventActive = " + row.EventActive, "bkgd");
        log("  AlertUserId = " + row.AlertUserId, "bkgd");
        log("  AlertTime   = " + row.AlertTime, "bkgd");
        log("  Message     = " + row.Message, "bkgd");

        const userResult = await getUser(connection, row.AlertUserId);

        // add Alert
        let insertStatement =
          "INSERT INTO Alert SET " +
          "EventStatusId = ?, " +
          "AlertTime = ?, " +
          "UserName = ?, " +
          "EmailAddress = ?, " +
          "MobilePhoneNo = ?, " +
          "Message = ?";
        insertStatement = format(insertStatement, [
          row.Id,
          row.AlertTime,
          userResult.UserName,
          userResult.EmailAddress,
          userResult.MobilePhoneNo,
          row.Message
        ]);
        log("insert: '" + insertStatement + "'", "evnt", "info");
        await query(connection, insertStatement);

        let updateStatement =
          "UPDATE EventStatus SET AlertPending = 1 WHERE Id = ?";
        updateStatement = format(updateStatement, [row.Id]);
        log("update: '" + updateStatement + "'", "evnt", "info");
        await query(connection, updateStatement);

        await commitTransaction(connection, "handlePendingAlerts");
      } catch (ex) {
        log("(Exception) handlePendingAlerts-inner: " + ex, "evnt", "info");
        await abortTransaction(connection, "handlePendingAlerts");
        results = handleDBException("event", "", "select", ex);
      }
    }
  } catch (ex) {
    log("(Exception) handlePendingAlerts: " + ex, "evnt", "info");
    results = handleDBException("event", "", "select", ex);
  }

  release(connection, "handlePendingAlerts");

  log("<<<handlePendingAlerts", "evnt", "info");
}

async function setEventStatus(eventTuple, eventActive, alertUserId, message) {
  log(
    ">>>setEventStatus: eventTuple = " +
      JSON.stringify(eventTuple, null, 2) +
      ", eventActive = " +
      eventActive +
      ", alertUserId = " +
      alertUserId +
      ", message = '" +
      message +
      "'",
    "db"
  );

  const connection = await getConnection("setEventStatus");

  try {
    await beginTransaction(connection, "setEventStatus");

    const eventTupleString = createEventTuple(
      eventTuple.ec,
      eventTuple.ot,
      eventTuple.id,
      eventTuple.sec,
      eventTuple.sot,
      eventTuple.sid
    );

    let selectStatement = "SELECT * FROM EventStatus WHERE EventTuple = ?";
    selectStatement = format(selectStatement, [eventTupleString]);

    log("select: '" + selectStatement + "'", "evnt", "info");

    const { result } = await query(connection, selectStatement);

    let eventActiveDB = 0;

    if (result[0]) {
      eventActiveDB = result[0].EventActive;
      log(
        "---eventActiveDB = " +
          eventActiveDB +
          ", diff = " +
          (eventActiveDB !== eventActive),
        "db"
      );
    } else {
      log("---new entry", "evnt", "info");
    }

    let updateStatement = null;
    if (!result[0]) {
      if (eventActive) {
        // NB: We don't care about going inactive on initial change.
        updateStatement =
          "INSERT INTO EventStatus SET EventTuple = ?, " +
          "EventActive = ?, AlertUserId = ?, AlertTime = CURRENT_TIMESTAMP, AlertPending = 0, Message = ?";
        updateStatement = format(updateStatement, [
          eventTupleString,
          eventActive,
          alertUserId,
          message
        ]);
      }
    } else if (eventActiveDB !== eventActive) {
      if (!result[0].AlertTime) {
        // no alert pending, so set the alert.
        updateStatement =
          "UPDATE EventStatus SET EventActive = ?, AlertUserId = ?, AlertTime = CURRENT_TIMESTAMP, AlertPending = 0, Message = ? " +
          "WHERE EventTuple = ?";
        updateStatement = format(updateStatement, [
          eventActive,
          alertUserId,
          message,
          eventTupleString
        ]);
      } else if (!eventActive) {
        // going inactive and alert pending (i.e., not yet sent.).  Just clear.
        updateStatement =
          "UPDATE EventStatus SET EventActive = ?, AlertUserId = ?, AlertTime = NULL, AlertPending = 0, Message = ? " +
          "WHERE EventTuple = ?";
        updateStatement = format(updateStatement, [
          eventActive,
          alertUserId,
          message,
          eventTupleString
        ]);
      }
    }

    if (updateStatement != null) {
      log("update: '" + updateStatement + "'", "evnt", "info");
      await query(connection, updateStatement);
    }

    await commitTransaction(connection, "setEventStatus");
  } catch (ex) {
    log("(Exception) setEventStatus: " + ex, "evnt", "info");
    await abortTransaction(connection, "setEventStatus");
    result = handleDBException("event", "", "update", ex);
  }

  release(connection, "setEventStatus");

  log("<<<setEventStatus", "evnt", "info");
}

async function updateAlert(
  alertId,
  eventStatusId,
  alertTime,
  emailSent,
  textSent
) {
  log(
    ">>>updateAlert: alertId = " +
      alertId +
      ", emailSent = " +
      emailSent +
      ", textSent = " +
      textSent,
    "db"
  );

  const connection = await getConnection("updateAlert");

  try {
    await beginTransaction(connection, "updateAlert");

    if (emailSent && textSent) {
      // update EventStatus

      // NB: for Defs.eventActive_activeAutoInactive
      let updateStatement =
        "UPDATE EventStatus SET EventActive = 0 WHERE Id = ? AND AlertTime = ? AND EventActive = ?";
      updateStatement = format(updateStatement, [
        eventStatusId,
        alertTime,
        Defs.eventActive_activeAutoInactive
      ]);
      log("update: '" + updateStatement + "'", "evnt", "info");
      await query(connection, updateStatement);

      updateStatement =
        "UPDATE EventStatus SET AlertPending = 0, AlertTime = NULL WHERE Id = ? AND AlertTime = ?";
      updateStatement = format(updateStatement, [eventStatusId, alertTime]);
      log("update: '" + updateStatement + "'", "evnt", "info");
      await query(connection, updateStatement);
    }

    let updateStatement =
      "UPDATE Alert SET EmailSent = ?, TextSent = ? WHERE Id = ?";
    updateStatement = format(updateStatement, [emailSent, textSent, alertId]);
    log("update: '" + updateStatement + "'", "evnt", "info");
    await query(connection, updateStatement);

    await commitTransaction(connection, "updateAlert");
  } catch (ex) {
    log("(Exception) updateAlert: " + ex, "evnt", "info");
    await abortTransaction(connection, "updateAlert");
    results = handleDBException("event", "", "update", ex);
  }

  release(connection, "updateAlert");

  log("<<<updateAlert", "evnt", "info");
}

async function updateLastEventReadId(eventId) {
  log(">>>updateLastEventReadId: eventId = " + eventId, "evnt", "info");

  let results = {};

  const connection = await getConnection("updateLastEventReadId");

  try {
    let updateStatement = "UPDATE MonitorControl SET LastReadEventId = ?";
    updateStatement = format(updateStatement, [eventId]);
    log("update: '" + updateStatement + "'", "evnt", "info");

    const { result } = await query(connection, updateStatement);

    results = result;
  } catch (ex) {
    log("(Exception) addEvent: " + ex, "evnt", "info");
    result = Exception("event", "", "update", ex);
  }

  release(connection, "updateLastEventReadId");

  log("<<<updateLastEventReadId", "evnt", "info");

  return results;
}

module.exports = {
  addEvent,
  addEventWithConnection,
  getClientLatestOfflineEvent,
  getLatestEvents,
  getUnsentAlerts,
  handlePendingAlerts,
  setEventStatus,
  updateAlert,
  updateLastEventReadId
};
