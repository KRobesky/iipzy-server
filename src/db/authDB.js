const {
  isAdmin,
  isLoggedIn,
  loginUser,
  logoutUser,
  verifyUser
} = require("./authDB_Impl");
// NB: This module exports authDB_Impl so that only one copy of authDB_Impl is loaded, regardless of where
//  this module is referenced.  Effectively making authDB_Impl a singleton - because it contains shared data.
module.exports = { isAdmin, isLoggedIn, loginUser, logoutUser, verifyUser };
