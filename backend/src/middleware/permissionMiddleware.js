'use strict';
const db=require('../config/database');
const {normalizeRole}=require('../utils/locationScope');

async function loadPermissions(user){
 if(!user)return [];
 const role=normalizeRole(user.role);
 const [roleRows]=await db.query(`SELECT p.permission_key FROM roles r JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE LOWER(r.name)=?`,[role]);
 let permissions=new Set(roleRows.map(row=>row.permission_key));
 if(role==='admin')permissions.add('*');
 if(role==='jail'){
  ['jail.view','jail.receive_transfer','jail.assign_cell','jail.medical','jail.visitors','jail.release_confirm'].forEach(key=>permissions.add(key));
 }
 // Hierarchy logins are not always rows in users; only apply overrides to regular users.
 if(user.id){const [overrides]=await db.query(`SELECT p.permission_key,up.effect FROM user_permissions up JOIN permissions p ON p.id=up.permission_id JOIN users u ON u.id=up.user_id WHERE up.user_id=? AND u.username=?`,[user.id,user.username]);for(const item of overrides)item.effect==='DENY'?permissions.delete(item.permission_key):permissions.add(item.permission_key);}
 return [...permissions];
}

const permissionImplies = {
 'suspects.manage': ['suspects.view', 'suspects.create', 'suspects.update'],
};

const hasPermission = (permissions, key) => (
 permissions.includes('*') ||
 permissions.includes(key) ||
 Object.entries(permissionImplies).some(([parent, children]) => permissions.includes(parent) && children.includes(key))
);

const requirePermission=key=>async(req,res,next)=>{try{const permissions=req.user.permissions||await loadPermissions(req.user);req.user.permissions=permissions;if(hasPermission(permissions,key))return next();return res.status(403).json({success:false,message:`Awoodda loo baahan yahay: ${key}`});}catch(error){next(error)}};
module.exports={loadPermissions,requirePermission};
