'use strict';

const COMMANDER_ROLES = ['state_commander', 'region_commander', 'district_commander', 'police_station_commander', 'ward_commander', 'waax_commander'];
const OPERATIONAL_ROLES = ['ob_staff', 'staff'];
const COURT_SPECIAL_ROLES = ['court', 'court_admin', 'judge', 'prosecutor', 'prosecutor_liaison', 'court_clerk'];
const CORE_CASE_READ_ROLES = ['admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', 'state_commander', 'region_commander', 'district_commander', 'ward_commander', 'police_station_commander', 'waax_commander'];
const UNIT_ROLES = ['state_admin', 'region_admin', 'city_admin', 'district_admin'];
const CASE_READ_ROLES = [...CORE_CASE_READ_ROLES, ...COURT_SPECIAL_ROLES, 'jail'];
const STATION_OPERATION_ROLES = ['district_admin'];
const CASE_WRITE_ROLES = ['admin', 'officer', 'ob_staff', ...COMMANDER_ROLES, ...STATION_OPERATION_ROLES];
const CASE_STATUS_ROLES = ['admin', 'officer', 'cid', 'staff', ...COMMANDER_ROLES, ...STATION_OPERATION_ROLES];
const COMMAND_REVIEW_ROLES = ['admin', ...COMMANDER_ROLES];
const INVESTIGATION_WRITE_ROLES = ['admin', 'officer', 'cid', 'staff', 'ob_staff', ...COMMANDER_ROLES, ...STATION_OPERATION_ROLES];
const LEGAL_WRITE_ROLES = ['admin', 'officer', 'cid', ...COMMANDER_ROLES, ...STATION_OPERATION_ROLES];
const REPORT_ROLES = ['admin', 'region_admin', 'officer', 'cid', 'jail', 'ob_staff', ...COMMANDER_ROLES, ...STATION_OPERATION_ROLES, ...COURT_SPECIAL_ROLES];
const COURT_READ_ROLES = ['admin', ...COURT_SPECIAL_ROLES];
const COURT_ADMIN_ROLES = ['admin', 'court', 'court_admin'];
const COURT_WRITE_ROLES = ['admin', ...COURT_SPECIAL_ROLES];

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
  COURT_SPECIAL_ROLES,
  COURT_READ_ROLES,
  COURT_ADMIN_ROLES,
  COURT_WRITE_ROLES,
};
