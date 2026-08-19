// src/services/officerAssignmentService.js — Logic and rules for officer assignments
'use strict';

const db = require('../config/database');

/**
 * Maps assignment_type to assignment_category (ADMIN vs OPERATIONAL vs SUPPORT)
 */
function determineCategory(assignmentType) {
  const adminTypes = new Set(['State Administration', 'Region', 'District', 'Sub-Admin']);
  if (adminTypes.has(assignmentType)) {
    return 'ADMIN';
  }
  return 'OPERATIONAL';
}

/**
 * Validates officer assignment against business rules.
 */
async function validateAssignment(connection, officerId, toAssignmentType, toAssignmentId, category, reqUser) {
  const assignmentCategory = category || determineCategory(toAssignmentType);

  // Existing assignments are handled as transfers by the controller:
  // the old current assignment in the same category is closed before adding the new one.

  // XEERKA 4: ADMIN_DISTRICT requires Commander status or upper admin authority
  if (toAssignmentType === 'District' && assignmentCategory === 'ADMIN') {
    const [[officer]] = await connection.query('SELECT is_commander FROM police_officers WHERE id = ?', [officerId]);
    const requestingRole = reqUser?.role || '';
    const isUpperAdmin = ['admin', 'state_admin', 'region_admin'].includes(requestingRole);
    if (!officer || (!officer.is_commander && !isUpperAdmin)) {
      const err = new Error('Kaliya Taliyaha Degmada (Commander) ayaa loo qoondeyn karaa District Administrator.');
      err.statusCode = 400;
      throw err;
    }
  }

  // XEERKA 5: ADMIN_SUB requires valid user
  if (toAssignmentType === 'Sub-Admin' && assignmentCategory === 'ADMIN') {
    if (toAssignmentId) {
      const [[user]] = await connection.query('SELECT id, is_active FROM users WHERE id = ?', [toAssignmentId]);
      if (!user) {
        const err = new Error('User-ka loo qoondeeyay ma jiro.');
        err.statusCode = 404;
        throw err;
      }
    }
  }

  return assignmentCategory;
}

/**
 * Retrieves officer assignments grouped into Admin Roles & Operational Locations
 */
async function getOfficerAssignmentsGrouped(officerId) {
  const [rows] = await db.query(
    `SELECT oa.*,
            sa.state_name,
            rg.region_name,
            dt.district_name,
            user_dt.district_name AS user_district_name,
            u.username, u.full_name AS user_full_name
     FROM officer_assignments oa
     LEFT JOIN state_administrations sa ON sa.id = oa.assignment_id AND oa.assignment_type IN ('State Administration', 'State Unit')
     LEFT JOIN regions rg ON rg.id = oa.assignment_id AND oa.assignment_type IN ('Region', 'Region Unit')
     LEFT JOIN districts dt ON dt.id = oa.assignment_id AND (oa.assignment_type = 'District' OR oa.assignment_type = 'District Station')
     LEFT JOIN users u ON u.id = oa.assignment_id AND oa.assignment_type IN ('Sub-Admin', 'District User Link')
     LEFT JOIN districts user_dt ON user_dt.id = u.district_id
     WHERE oa.officer_id = ? AND oa.is_current = 1
     ORDER BY oa.assigned_at DESC`,
    [officerId]
  );

  const adminRoles = [];
  const operationalLocations = [];

  for (const item of rows) {
    const category = item.assignment_category || determineCategory(item.assignment_type);
    let displayName = item.assignment_type === 'District User Link'
      ? 'Operational Account'
      : (item.assignment_type === 'Sub-Admin' ? 'Sub-Admin (Maamul Hoose)' : item.assignment_type);
    if (item.state_name) displayName += `: ${item.state_name}`;
    else if (item.region_name) displayName += `: ${item.region_name}`;
    else if (item.district_name) displayName += `: ${item.district_name}`;
    else if (item.user_district_name) displayName += `: ${item.user_district_name}`;
    if (item.username) displayName += ` (User: ${item.username})`;

    const obj = {
      id: item.id,
      assignment_type: item.assignment_type,
      assignment_id: item.assignment_id,
      assignment_category: category,
      display_name: displayName,
      assigned_at: item.assigned_at,
      assigned_by: item.assigned_by,
      remarks: item.remarks,
    };

    if (category === 'ADMIN') {
      adminRoles.push(obj);
    } else {
      operationalLocations.push(obj);
    }
  }

  return { adminRoles, operationalLocations, allAssignments: rows };
}

module.exports = {
  determineCategory,
  validateAssignment,
  getOfficerAssignmentsGrouped,
};
