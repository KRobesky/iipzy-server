const {
  addEvent,
  addEventWithConnection,
  getClientLatestOfflineEvent,
  getLatestEvents,
  getUnsentAlerts,
  handlePendingAlerts,
  setEventStatus,
  updateAlert,
  updateLastEventReadId
} = require("./eventDB_Impl");
// NB: This module exports eventDB_Impl so that only one copy of eventDB_Impl is loaded, regardless of where
//  this module is referenced.  Effectively making eventDB_Impl a singleton - because it contains shared data.
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
