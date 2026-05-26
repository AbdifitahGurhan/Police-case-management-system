'use strict';

const COMMANDER_ROLES = ['state_commander', 'region_commander', 'district_commander', 'police_station_commander', 'waax_commander'];
const OPERATIONAL_ROLES = ['ob_staff', 'staff'];
const CORE_CASE_READ_ROLES = ['admin', 'officer', 'ward_commander', 'cid', 'court', 'jail', ...COMMANDER_ROLES, ...OPERATIONAL_ROLES];
const UNIT_ROLES = ['state_admin', 'region_admin', 'city_admin', 'district_admin', 'neighborhood_admin'];
const CASE_READ_ROLES = [...CORE_CASE_READ_ROLES, ...UNIT_ROLES];
const STATION_OPERATION_ROLES = ['district_admin', 'neighborhood_admin'];
const CASE_WRITE_ROLES = ['admin', 'officer', 'ob_staff', ...STATION_OPERATION_ROLES];
const CASE_STATUS_ROLES = ['admin', 'officer', 'cid', 'staff', ...COMMANDER_ROLES, ...STATION_OPERATION_ROLES];
const COMMAND_REVIEW_ROLES = ['admin', 'ward_commander', ...COMMANDER_ROLES];
const INVESTIGATION_WRITE_ROLES = ['admin', 'officer', 'cid', 'staff', ...STATION_OPERATION_ROLES];
const LEGAL_WRITE_ROLES = ['admin', 'officer', 'cid', ...COMMANDER_ROLES, ...STATION_OPERATION_ROLES];
const REPORT_ROLES = ['admin', 'region_admin', 'officer', 'cid', 'court', 'jail', ...STATION_OPERATION_ROLES];

module.exports = {
  COMMANDER_ROLES,
  OPERATIONAL_ROLES,
  CORE_CASE_READ_ROLES,
  UNIT_ROLES,
  STATION_OPERATION_ROLES,
  CASE_READ_ROLES,
  CASE_WRITE_ROLES,
  CASE_STATUS_ROLES,
  COMMAND_REVIEW_ROLES,
  INVESTIGATION_WRITE_ROLES,
  LEGAL_WRITE_ROLES,
  REPORT_ROLES,
};
