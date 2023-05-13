SET NAMES utf8;

SET SQL_MODE='';

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';
SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0;

CREATE DATABASE IF NOT EXISTS `ConfigDB` DEFAULT CHARACTER SET utf8;

USE `ConfigDB`;

DROP TABLE IF EXISTS `DBVersion`;

CREATE TABLE `DBVersion` (
  `Id` int(11) unsigned NOT NULL DEFAULT 1,
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdateTime` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `MajorVersion` int(11) unsigned NOT NULL DEFAULT 0,
  `MinorVersion` int(11) unsigned NOT NULL DEFAULT 0,
  `UpgradeId` int(11) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Id_UNIQUE` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT INTO `DBVersion` (`MajorVersion`, `MinorVersion`, `UpgradeId`) VALUES (1,0,0);

DROP TABLE IF EXISTS `UserWhiteList`;

CREATE TABLE `UserWhiteList` (
  `Id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdateTime` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `UserName` varchar(128) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Id_UNIQUE` (`id`),
  UNIQUE KEY `Name_UNIQUE` (`UserName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS `User`;

CREATE TABLE `User` (
  `Id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdateTime` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `UserName` varchar(128) NOT NULL,
  `EmailAddress` varchar(128) NOT NULL,
  `PasswordBcrypt` varchar(128) NOT NULL,
  `MobilePhoneNo` varchar(128) DEFAULT NULL,
  `IsAdmin` tinyint(1) unsigned DEFAULT 0,
  `VerificationCode` varchar(10) NOT NULL,
  `VerifiedTime` datetime DEFAULT NULL,
  `PasswordResetCode` varchar(10) DEFAULT NULL,
  `PasswordResetTime` datetime DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Id_UNIQUE` (`id`),
  UNIQUE KEY `Name_UNIQUE` (`UserName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

/* default password is "password" */
INSERT INTO User VALUES (0, CURRENT_TIMESTAMP, NULL, '', '', '', '', 0, 0, 0, NULL, CURRENT_TIMESTAMP);
INSERT INTO User VALUES (1, CURRENT_TIMESTAMP, NULL, 'head.buzzard@iipzy.com', 'head.buzzard@iipzy.com', '$2b$10$5mEQ0ktbrsJx8cWOwbOfBecP.NaDx1PwPdIrCD5yJgKSC5MjP19wu', '650-555-1212', 1, 0, 0, NULL, CURRENT_TIMESTAMP);

DROP TABLE IF EXISTS `InternetServiceProvider`;

CREATE TABLE `InternetServiceProvider` (
  `Id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdateTime` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `AutonomousSystemNumber` int(11) unsigned NOT NULL,
  `IspName` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Id_UNIQUE` (`id`),
  UNIQUE KEY `AutonomousSystemNumber_UNIQUE` (`AutonomousSystemNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS `ClientInstanceLocation`; 
DROP TABLE IF EXISTS `ClientInstance`; 

CREATE TABLE `ClientInstance` ( 
  `Id` int(11) unsigned NOT NULL AUTO_INCREMENT, 
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP, 
  `UpdateTime` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP, 
  `PublicIPAddress` varchar(64) NOT NULL, 
  `LocalIPAddress` varchar(64) NOT NULL, 
  `InterfaceName` varchar(16) DEFAULT NULL,
  `ClientToken` varchar(255) NOT NULL, 
  `ClientType` varchar(16) NOT NULL, 
  `ClientName` varchar(63) DEFAULT NULL, 
  `UserId` int(11) unsigned NOT NULL,
  `AuthToken` varchar(255) DEFAULT NULL, 
  `IspAutonomousSystemNumber` int(11) unsigned DEFAULT NULL,
  `IsOnLine` tinyint(1) DEFAULT 0, 
  `Iperf3UseCountDaily` int(11) unsigned DEFAULT 0,
  `Iperf3UseCountTotal` int(11) unsigned DEFAULT 0,
  `SuppressAlerts` tinyint(1) DEFAULT 0, 
  PRIMARY KEY (`Id`), 
  UNIQUE KEY `Id_UNIQUE` (`Id`), 
  UNIQUE KEY `PublicIPAddressLocalIPAddressClientType_UNIQUE` (`PublicIPAddress`,`LocalIPAddress`, `ClientType`),
  UNIQUE KEY `ClientToken_UNIQUE` (`ClientToken`),
  UNIQUE KEY `AuthToken_UNIQUE` (`AuthToken`), 
  CONSTRAINT `ClientInstance_UserId` FOREIGN KEY (`UserId`) REFERENCES `User` (`Id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `ClientInstance_IspAutonomousSystemNumber` FOREIGN KEY (`IspAutonomousSystemNumber`) REFERENCES `InternetServiceProvider` (`AutonomousSystemNumber`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8; 

CREATE TABLE `ClientInstanceLocation` ( 
  `Id` int(11) unsigned NOT NULL AUTO_INCREMENT, 
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP, 
  `UpdateTime` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP, 
  `ClientInstanceId` int(11) unsigned NOT NULL, 
  `ContinentCode` varchar(16) DEFAULT NULL,
  `ContinentName` varchar(64) DEFAULT NULL,
  `CountryCode` varchar(16) DEFAULT NULL,
  `CountryName` varchar(64) DEFAULT NULL,
  `RegionCode` varchar(16) DEFAULT NULL,
  `RegionName` varchar(64) DEFAULT NULL,
  `City` varchar(64) DEFAULT NULL,
  `Zip` varchar(16) DEFAULT NULL,
  `Latitude` DECIMAL(8,5) DEFAULT NULL,
  `Longitude` DECIMAL(8,5) DEFAULT NULL,
  `TimezoneId` varchar(64) DEFAULT NULL,
  `TimezoneGmtOffset` int(11) DEFAULT NULL,
  `TimezoneCode` varchar(16) DEFAULT NULL,
  `TimezoneIsDaylightSaving` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`Id`), 
  UNIQUE KEY `Id_UNIQUE` (`Id`), 
  CONSTRAINT `ClientInstanceLocation_ClientInstanceId` FOREIGN KEY (`ClientInstanceId`) REFERENCES `ClientInstance` (`Id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8; 


CREATE TABLE `ClientInstanceVersionInfo` ( 
  `Id` int(11) unsigned NOT NULL AUTO_INCREMENT, 
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP, 
  `UpdateTime` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP, 
  `ClientInstanceId` int(11) unsigned NOT NULL, 
  `ModuleName` varchar(64) NOT NULL,
  `ModuleUpdateTime` datetime DEFAULT NULL, 
  `ModuleVersion` varchar(16) DEFAULT NULL,
  `ModuleSharedVersion` varchar(16) DEFAULT NULL,
  PRIMARY KEY (`Id`), 
  UNIQUE KEY `Id_UNIQUE` (`Id`), 
  UNIQUE KEY `ClientIID_ModuleName_UNIQUE` (`ClientInstanceId`,`ModuleName`),
  CONSTRAINT `ClientInstanceVersionInfo_ClientInstanceId` FOREIGN KEY (`ClientInstanceId`) REFERENCES `ClientInstance` (`Id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8; 


CREATE TABLE `ClientInstanceVersionInfo_OBSOLETE` ( 
  `Id` int(11) unsigned NOT NULL AUTO_INCREMENT, 
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP, 
  `UpdateTime` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP, 
  `ClientInstanceId` int(11) unsigned NOT NULL, 
  `SentinelUpdateTime` datetime DEFAULT NULL, 
  `SentinelVersion` varchar(16) DEFAULT NULL,
  `SentinelSharedVersion` varchar(16) DEFAULT NULL,
  `SentinelAdminUpdateTime` datetime DEFAULT NULL, 
  `SentinelAdminVersion` varchar(16) DEFAULT NULL,
  `SentinelAdminSharedVersion` varchar(16) DEFAULT NULL,
  `SentinelWebUpdateTime` datetime DEFAULT NULL, 
  `SentinelWebVersion` varchar(16) DEFAULT NULL,
  `SentinelWebSharedVersion` varchar(16) DEFAULT NULL,
  `UpdaterUpdateTime` datetime DEFAULT NULL, 
  `UpdaterVersion` varchar(16) DEFAULT NULL,
  `UpdaterSharedVersion` varchar(16) DEFAULT NULL,
  PRIMARY KEY (`Id`), 
  UNIQUE KEY `Id_UNIQUE` (`Id`), 
  CONSTRAINT `ClientInstanceVersionInfo_ClientInstanceId` FOREIGN KEY (`ClientInstanceId`) REFERENCES `ClientInstance` (`Id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8; 

DROP TABLE IF EXISTS `Alert`;
DROP TABLE IF EXISTS `Event`; 
DROP TABLE IF EXISTS `EventStatus`;

CREATE TABLE `EventStatus` (
  `Id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdateTime` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `EventTuple` varchar(512) NOT NULL,
  `EventActive` tinyint(1) DEFAULT 0,
  `AlertUserId` int(11) unsigned NOT NULL,
  `AlertTime` datetime DEFAULT NULL,
  `AlertPending` tinyint(1) DEFAULT 0,
  `Message` TEXT DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Id_UNIQUE` (`Id`),
  UNIQUE KEY `EventStatus_EventTuple_UNIQUE` (`EventTuple`),
  CONSTRAINT `EventStatus_AlertUserId` FOREIGN KEY (`AlertUserId`) REFERENCES `User` (`Id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `Event` ( 
  `Id` int(11) unsigned NOT NULL AUTO_INCREMENT, 
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP, 
  `EventTuple` varchar(512) NOT NULL,
  `EventActive` tinyint(1) DEFAULT 0,
  `AlertUserId` int(11) unsigned NOT NULL,
  `EventData` JSON NOT NULL,
  `EventTupleSearchable` JSON NOT NULL,
  PRIMARY KEY (`Id`), 
  UNIQUE KEY `Id_UNIQUE` (`Id`),
  CONSTRAINT `Event_AlertUserId` FOREIGN KEY (`AlertUserId`) REFERENCES `User` (`Id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8; 

CREATE TABLE `Alert` (
  `Id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdateTime` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `EventStatusId` int(11) unsigned NOT NULL,
  `AlertTime` datetime NOT NULL,
  `UserName` varchar(128) NOT NULL,
  `EmailAddress` varchar(128) NOT NULL,
  `MobilePhoneNo` varchar(128) DEFAULT NULL,
  `Message` TEXT DEFAULT NULL,
  `EmailSent` tinyint(1) DEFAULT 0,
  `TextSent` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Id_UNIQUE` (`Id`),
  CONSTRAINT `Alert_EventStatusId` FOREIGN KEY (`EventStatusId`) REFERENCES `EventStatus` (`Id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS `ThirdPartyApiUsageCounters`;

CREATE TABLE `ThirdPartyApiUsageCounters` (
  `Id` int(11) unsigned NOT NULL,
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdateTime` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `EmailSendsDailyLimit` int(11) unsigned DEFAULT 100,
  `EmailSendsDaily` int(11) unsigned DEFAULT 0,
  `EmailSendsTotal` int(11) unsigned DEFAULT 0,
  `SMSSendsDailyLimit` int(11) unsigned DEFAULT 100,
  `SMSSendsDaily` int(11) unsigned DEFAULT 0,
  `SMSSendsTotal` int(11) unsigned DEFAULT 0,
  `IpApiRequestsDailyLimit` int(11) unsigned DEFAULT 100,
  `IpApiRequestsDaily` int(11) unsigned DEFAULT 0,
  `IpApiRequestsTotal` int(11) unsigned DEFAULT 0,
  `IpGeolocationRequestsDailyLimit` int(11) unsigned DEFAULT 100,
  `IpGeolocationRequestsDaily` int(11) unsigned DEFAULT 0,
  `IpGeolocationRequestsTotal` int(11) unsigned DEFAULT 0,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Id_UNIQUE` (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT INTO ThirdPartyApiUsageCounters SET `Id` = 1, `CreateTime` = CURRENT_TIMESTAMP; 

DROP TABLE IF EXISTS `MonitorControl`;

CREATE TABLE `MonitorControl` (
  `Id` int(11) unsigned NOT NULL,
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdateTime` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `LastReadEventId` int(11) unsigned DEFAULT 0,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Id_UNIQUE` (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT INTO MonitorControl SET `Id` = 1, `CreateTime` = CURRENT_TIMESTAMP;

DROP TABLE IF EXISTS `Iperf3Server`;

CREATE TABLE `Iperf3Server` (
  `Id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdateTime` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `Enabled` tinyint(1) DEFAULT 1, 
  `InstanceGuid` varchar(40) NOT NULL,
  `InstanceIPV4Addr` varchar(64) NOT NULL,	/* NB: InstanceGUID must come from this address */
  `InstanceURL` varchar(256) NOT NULL,
  `Latitude` DECIMAL(8,5) NOT NULL,
  `Longitude` DECIMAL(8,5) NOT NULL,
  `Comment` TEXT NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Id_UNIQUE` (`id`),
  UNIQUE KEY `InstanceGuid_UNIQUE` (`InstanceGuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS `GitCredentials`;

CREATE TABLE `GitCredentials` (
  `Id` int(11) unsigned DEFAULT 1,
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdateTime` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `Enabled` tinyint(1) DEFAULT 1, 
  `Credentials` varchar(256) DEFAULT NULL,
  `Comment` TEXT DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Id_UNIQUE` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS `SystemParameters`;

CREATE TABLE `SystemParameters` (
  `Id` int(11) unsigned DEFAULT 1,
  `CreateTime` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdateTime` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `Iperf3UseCountDailyLimit` int(11) unsigned DEFAULT 0,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Id_UNIQUE` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT INTO SystemParameters SET `Id` = 1, `CreateTime` = CURRENT_TIMESTAMP, `Iperf3UseCountDailyLimit` = 10;
