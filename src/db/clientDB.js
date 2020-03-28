const {
  clearClientIperf3DailyCount,
  createClient,
  createClientBySerialNumber,
  createClientX,
  getAllowIperf3Use,
  getClient,
  getClientName,
  getClients,
  getClientsSansLocalIPAddress,
  getClientType,
  getServerURLForClient,
  isClientConnected,
  isValidClientToken,
  removeClientAuthToken,
  setClientName,
  updateClientAuthToken,
  updateClientIperf3UseCount,
  updateClientLocalIPAddress,
  updateClientOnLineState
} = require("./clientDB_Impl");
// NB: This module exports clientDB_Impl so that only one copy of clientDB_Impl is loaded, regardless of where
//  this module is referenced.  Effectively making clientDB_Impl a singleton - because it contains shared data.
module.exports = {
  clearClientIperf3DailyCount,
  createClient,
  createClientBySerialNumber,
  createClientX,
  getAllowIperf3Use,
  getClient,
  getClientName,
  getClients,
  getClientsSansLocalIPAddress,
  getClientType,
  getServerURLForClient,
  isClientConnected,
  isValidClientToken,
  removeClientAuthToken,
  setClientName,
  updateClientAuthToken,
  updateClientIperf3UseCount,
  updateClientLocalIPAddress,
  updateClientOnLineState
};
