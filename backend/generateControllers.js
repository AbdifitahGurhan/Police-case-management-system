const fs = require('fs');
const tiers = [
  { name: 'City', table: 'cities', fk: 'region_id', fkTable: 'regions', scopeName: 'city', parentScope: 'region' },
  { name: 'District', table: 'districts', fk: 'city_id', fkTable: 'cities', scopeName: 'district', parentScope: 'city' },
  { name: 'Neighborhood', table: 'neighborhoods', fk: 'district_id', fkTable: 'districts', scopeName: 'neighborhood', parentScope: 'district' }
];

tiers.forEach(t => {
  const content = `'use strict';
const db = require('../config/database');
const bcrypt = require('bcryptjs');

exports.getAll = async (req, res, next) => {
  try { 
    let query = \`
      SELECT c.id, c.${t.name.toLowerCase()}_name, c.${t.name.toLowerCase()}_code, c.username, c.commander_officer_id, c.${t.fk}, p.full_name as commander_name
      FROM ${t.table} c
      LEFT JOIN police_officers p ON c.commander_officer_id = p.id
      WHERE 1=1
    \`;
    const params = [];
    
    if (req.user.scopeType === '${t.parentScope}') {
      query += \` AND c.${t.fk} = ?\`;
      params.push(req.user.scopeId);
    }

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(\`
      SELECT c.*, p.full_name as commander_name, p.rank_id, rnk.rank_name as commander_rank, p.profile_image as commander_photo
      FROM ${t.table} c
      LEFT JOIN police_officers p ON c.commander_officer_id = p.id
      LEFT JOIN ranks rnk ON p.rank_id = rnk.id
      WHERE c.id = ?
    \`, [id]);
    
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const center = rows[0];

    // Authorize
    if (req.user.scopeType === '${t.scopeName}' && req.user.scopeId !== center.id) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.scopeType === '${t.parentScope}' && req.user.scopeId !== center.${t.fk}) return res.status(403).json({ success: false, message: 'Forbidden' });
    
    const [officerRows] = await db.query(\`
      SELECT count(id) as count FROM officer_assignments WHERE assignment_type = '${t.name}' AND assignment_id = ? AND is_current = 1
    \`, [id]);
    center.assigned_officer_count = officerRows[0].count;

    res.json({ success: true, data: center });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { ${t.fk}, ${t.name.toLowerCase()}_name, ${t.name.toLowerCase()}_code, username, password, commander_officer_id } = req.body;
    
    if (req.user.scopeType === '${t.parentScope}' && req.user.scopeId !== parseInt(${t.fk})) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const hash = await bcrypt.hash(password, 10);
    const creator = req.user.username;

    const [result] = await db.query(\`
      INSERT INTO ${t.table} (${t.fk}, ${t.name.toLowerCase()}_name, ${t.name.toLowerCase()}_code, username, password_hash, commander_officer_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    \`, [${t.fk}, ${t.name.toLowerCase()}_name, ${t.name.toLowerCase()}_code, username, hash, commander_officer_id || null, creator]);
    res.json({ success: true, message: 'Created successfully', id: result.insertId });
  } catch (err) { 
    if(err.code === 'ER_DUP_ENTRY') return res.status(400).json({success: false, message: 'Username or Code already exists.'});
    next(err); 
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ${t.fk}, ${t.name.toLowerCase()}_name, ${t.name.toLowerCase()}_code, username, commander_officer_id } = req.body;

    const [rows] = await db.query(\`SELECT * FROM ${t.table} WHERE id = ?\`, [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const center = rows[0];

    if (req.user.scopeType === '${t.scopeName}' && req.user.scopeId !== parseInt(id)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.scopeType === '${t.parentScope}' && req.user.scopeId !== center.${t.fk}) return res.status(403).json({ success: false, message: 'Forbidden' });

    await db.query(\`
      UPDATE ${t.table} SET ${t.fk}=?, ${t.name.toLowerCase()}_name=?, ${t.name.toLowerCase()}_code=?, username=?, commander_officer_id=?
      WHERE id=?
    \`, [${t.fk}, ${t.name.toLowerCase()}_name, ${t.name.toLowerCase()}_code, username, commander_officer_id || null, id]);
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query(\`DELETE FROM ${t.table} WHERE id=?\`, [id]);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) { next(err); }
};
\`;
  fs.writeFileSync(\`backend/src/controllers/\${t.name.toLowerCase()}Controller.js\`, content);
});

console.log('Controllers generated');
