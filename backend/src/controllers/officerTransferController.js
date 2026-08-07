'use strict';
const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

const STATE_ADMIN_RANK_CODES = new Set(['AL', 'SA', 'XDH', 'LXDH', 'LA', 'SXD']);
const DISTRICT_DEPLOY_TARGET_ROLES = new Set(['sub_admin', 'personnel_registry', 'ob_staff', 'investigator', 'station_jail']);

exports.transferOfficer = async (req, res, next) => {
  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();

    let { officer_id, to_assignment_type, to_assignment_id, transfer_reason, remarks } = req.body;
    transfer_reason = transfer_reason || 'Hawlgelin / Deployment';

    if (!officer_id || !to_assignment_type) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (req.user.role === 'state_admin') {
      const [[officer]] = await connection.query(
        `SELECT r.rank_code, po.approval_status, po.employment_status
         FROM police_officers po
         LEFT JOIN ranks r ON r.id = po.rank_id
         WHERE po.id = ?`,
        [officer_id]
      );
      if (!officer) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Askariga lama helin.' });
      }
      if (officer.approval_status !== 'APPROVED' || String(officer.employment_status).toLowerCase() !== 'active') {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'Waxaa la hawlgelin karaa oo keliya askari la ansixiyey oo Active ah.' });
      }
      if (!STATE_ADMIN_RANK_CODES.has(String(officer.rank_code || '').trim().toUpperCase())) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'State Administration wuxuu hawlgelin karaa oo keliya darajooyinka Al, SA, XDH, LXDH, LA iyo SXD.',
        });
      }
    }
    if (req.user.role === 'district_admin' && to_assignment_type !== 'Sub-Admin') {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: 'Maamulaha Degmada wuxuu askari u deploy gareyn karaa oo keliya User Degmo degmadiisa ah.',
      });
    }

    // 1. Get current active assignment for transfer history
    const [currentRows] = await connection.query('SELECT * FROM officer_assignments WHERE officer_id = ? AND is_current = 1 ORDER BY assigned_at DESC LIMIT 1', [officer_id]);
    const currentAssignment = currentRows.length ? currentRows[0] : null;

    let targetLocation = { state_administration_id: null, region_id: null, district_id: null };
    let targetUser = null;
    if (to_assignment_type === 'State Administration') {
      const [[sa]] = await connection.query('SELECT id FROM state_administrations WHERE id = ?', [to_assignment_id]);
      if (sa) targetLocation.state_administration_id = sa.id;
      else targetLocation = null;
    } else if (to_assignment_type === 'Sub-Admin') {
      const subAdminParams = [to_assignment_id, ...DISTRICT_DEPLOY_TARGET_ROLES];
      let subAdminScopeWhere = '';
      if (req.user.role === 'district_admin') {
        subAdminScopeWhere = ' AND u.district_id = ?';
        subAdminParams.push(req.user.scopeId);
      }
      const [[saUser]] = await connection.query(
        `SELECT u.id, u.state_administration_id, u.region_id, u.district_id
         FROM users u
          JOIN roles r ON r.id = u.role_id
          WHERE u.id = ?
            AND LOWER(REPLACE(r.name, '-', '_')) IN (${[...DISTRICT_DEPLOY_TARGET_ROLES].map(() => '?').join(',')})
            AND u.is_active = 1
            AND UPPER(COALESCE(u.status, 'ACTIVE')) = 'ACTIVE'
            ${subAdminScopeWhere}`,
        subAdminParams
      );
      if (saUser) {
        targetUser = saUser;
        targetLocation.state_administration_id = saUser.state_administration_id || null;
        targetLocation.region_id = saUser.region_id || null;
        targetLocation.district_id = saUser.district_id || null;
      } else targetLocation = null;
    } else if (to_assignment_type === 'Region') {
      const [[rg]] = await connection.query('SELECT id, state_administration_id FROM regions WHERE id = ?', [to_assignment_id]);
      if (rg) {
        targetLocation.region_id = rg.id;
        targetLocation.state_administration_id = rg.state_administration_id;
      } else targetLocation = null;
    } else if (to_assignment_type === 'City') {
      const [[ct]] = await connection.query(
        `SELECT c.id, c.region_id, r.state_administration_id
         FROM cities c LEFT JOIN regions r ON r.id = c.region_id WHERE c.id = ?`,
        [to_assignment_id]
      );
      if (ct) {
        targetLocation.region_id = ct.region_id;
        targetLocation.state_administration_id = ct.state_administration_id;
      } else targetLocation = null;
    } else if (['District', 'District Station'].includes(to_assignment_type)) {
      const [[dt]] = await connection.query(
        `SELECT d.id, c.region_id, r.state_administration_id
         FROM districts d
         LEFT JOIN cities c ON c.id = d.city_id
         LEFT JOIN regions r ON r.id = c.region_id
         WHERE d.id = ?`,
        [to_assignment_id]
      );
      if (dt) {
        targetLocation.district_id = dt.id;
        targetLocation.region_id = dt.region_id;
        targetLocation.state_administration_id = dt.state_administration_id;
      } else targetLocation = null;
    }

    if (!to_assignment_id || !targetLocation) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Dooro goobta la wareejinayo oo dhameystiran.' });
    }

    // 2. Deactivate ALL previous active assignments for this officer to ensure single active location
    await connection.query('UPDATE officer_assignments SET is_current = 0 WHERE officer_id = ?', [officer_id]);

    // 3. Clear this officer from being commander of any other station/unit across all tiers
    await connection.query('UPDATE state_administrations SET commander_officer_id = NULL WHERE commander_officer_id = ?', [officer_id]);
    await connection.query('UPDATE regions SET commander_officer_id = NULL WHERE commander_officer_id = ?', [officer_id]);
    await connection.query('UPDATE cities SET commander_officer_id = NULL WHERE commander_officer_id = ?', [officer_id]);
    await connection.query('UPDATE districts SET commander_officer_id = NULL WHERE commander_officer_id = ?', [officer_id]);

    // 4. Create new single active assignment
    await connection.query(
      `INSERT INTO officer_assignments (officer_id, assignment_type, assignment_id, is_current, assigned_by, remarks)
       VALUES (?, ?, ?, 1, ?, ?)`,
      [officer_id, to_assignment_type, to_assignment_id || null, req.user.username, remarks]
    );
    await connection.query(
      `UPDATE police_officers
       SET state_administration_id=?,region_id=?,district_id=?
       WHERE id=?`,
      [targetLocation.state_administration_id, targetLocation.region_id, targetLocation.district_id, officer_id]
    );

    if (targetUser) {
      const [[deployedOfficer]] = await connection.query(
        `SELECT po.id, po.full_name, po.phone, rk.rank_name
         FROM police_officers po
         LEFT JOIN ranks rk ON rk.id = po.rank_id
         WHERE po.id = ?`,
        [officer_id]
      );
      if (deployedOfficer) {
        await connection.query('UPDATE users SET police_officer_id = NULL WHERE police_officer_id = ? AND id <> ?', [officer_id, targetUser.id]);
        await connection.query(
          `UPDATE users
           SET police_officer_id = ?,
               full_name = ?,
               phone = COALESCE(?, phone),
               \`rank\` = COALESCE(?, \`rank\`)
           WHERE id = ?`,
          [
            deployedOfficer.id,
            deployedOfficer.full_name,
            deployedOfficer.phone || null,
            deployedOfficer.rank_name || null,
            targetUser.id,
          ]
        );
      }
    }

    // 5. Record transfer in history
    await connection.query(
      `INSERT INTO officer_transfers (officer_id, from_assignment_type, from_assignment_id, to_assignment_type, to_assignment_id, transfer_reason, transferred_by, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        officer_id,
        currentAssignment ? currentAssignment.assignment_type : null,
        currentAssignment ? currentAssignment.assignment_id : null,
        to_assignment_type,
        to_assignment_id || null,
        transfer_reason,
        req.user.username,
        remarks
      ]
    );

    // 6. Assign commander on the target center profile if applicable
    const tableMap = {
      'State Administration': 'state_administrations',
      'Region': 'regions',
      'City': 'cities',
      'District': 'districts',
      'District Station': 'districts'
    };

    if (to_assignment_id && tableMap[to_assignment_type]) {
      const table = tableMap[to_assignment_type];
      await connection.query(`UPDATE ${table} SET commander_officer_id = ? WHERE id = ?`, [officer_id, to_assignment_id]);
    }

    await writeAuditLog({
      userId: req.user.username,
      userEmail: req.user.email || req.user.username,
      action: 'OFFICER_TRANSFER',
      entityType: 'police_officers',
      entityId: officer_id,
      details: transfer_reason
    });

    await connection.commit();
    res.json({ success: true, message: 'Officer transferred successfully' });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

exports.getTransferHistory = async (req, res, next) => {
  try {
    const { officer_id } = req.params;
    const [rows] = await db.query('SELECT * FROM officer_transfers WHERE officer_id = ? ORDER BY transferred_at DESC', [officer_id]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};
