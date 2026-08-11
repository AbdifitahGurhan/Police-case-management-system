# Somali Police Force Case Management System
## Core Project Blueprint - Part 5: Authentication & Authorization

This document serves as Part 5 of the comprehensive system blueprint for the Somali Police Force Case Management System, detailing authentication mechanisms, roles structures, JWT specifications, and routing permissions validation gates.

---

## 5. Security & Access Control Infrastructure

### 5.1. The Unified Authentication Flow
The system processes login requests using a unified authentication algorithm that aggregates credentials checks across different databases tables:

```mermaid
sequenceDiagram
    autonumber
    actor Client as User Client
    participant Auth as Auth Controller
    participant DB as MySQL Database
    participant JWT as JWT Service
    
    Client->>Auth: POST /api/auth/login (username/email, password)
    Auth->>DB: Query username/email across UNION (users, state_administrations, regions, cities, districts)
    alt User Not Found
        DB-->>Auth: Empty rows
        Auth->>DB: Insert failure log (login_logs)
        Auth-->>Client: 401 Unauthorized (Invalid credentials)
    else User Found
        DB-->>Auth: Return id, username, email, role, password_hash, is_active, location details
        alt Account Deactivated
            Auth->>DB: Insert failure log (login_logs)
            Auth-->>Client: 403 Forbidden (Account is deactivated)
        else Account Active
            Auth->>Auth: bcrypt.compare(password, password_hash)
            alt Password Mis-match
                Auth->>DB: Insert failure log (login_logs)
                Auth-->>Client: 401 Unauthorized (Invalid credentials)
            else Password Matches
                Auth->>DB: Update last_login timestamp (for regular users)
                Auth->>DB: Insert successful log (login_logs)
                Auth->>JWT: sign(payload, JWT_SECRET, { expiresIn: '24h' })
                JWT-->>Auth: Encoded token
                Auth-->>Client: 200 OK (payload + token)
            end
        end
    end
```

### 5.2. Password Hashing Specification
* **Library**: `bcryptjs`
* **Workflow**: On user creation or password updates, passwords undergo 12 salt rounds hashing.
* **Storage Column**: `password_hash` (`VARCHAR(255)`)

---

### 5.3. JWT & Session Implementation
Authentication is token-based. Clients must attach the returned JWT token to every request inside the `Authorization` header prefixed with `Bearer `.

#### Token Payload Schema:
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@spf.gov.so",
  "role": "admin",
  "roleCode": "admin",
  "fullName": "System Admin",
  "phone": "+252611111111",
  "rank": "General",
  "userType": "COMMANDER",
  "assignedLevel": "ADMINISTRATION",
  "isCommander": true,
  "scopeType": null,
  "scopeId": null,
  "location": {
    "stateId": 1,
    "stateName": "Banadir",
    "regionId": null,
    "regionName": null,
    "districtId": null,
    "districtName": null
  },
  "iat": 1721245000,
  "exp": 1721331400
}
```
* **Expiration Time**: Fixed at `24h` (configurable in `JWT_EXPIRES_IN` env).

---

### 5.4. Middleware Gates

1. **Authentication Gate (`authMiddleware.js`)**:
   * Extracts token from `Authorization` header.
   * Runs `jwt.verify(token, process.env.JWT_SECRET)`.
   * Sets `req.user = decoded` on success.
   * Catches `TokenExpiredError` (returns `401 Token has expired`) or invalid signatures (returns `401 Invalid token`).
2. **Authorization Role Gate (`roleMiddleware.js`)**:
   * Evaluates permissions using `allowRoles(...roles)` factory.
   * Matches `req.user.role` against list. On failure, responds with `403 Access Denied`.

---

### 5.5. Permission Matrix Per Role

| Role | OB Entries (Read/Write) | Cases (Read/Write) | Assignments/Transfers | CID Investigations | Custody & Bookings | Judicial Hearings |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **admin** | Write / Read | Write / Read | Write / Read | Write / Read | Write / Read | Write / Read |
| **ob_staff** | Write / Read | Read | No | No | No | No |
| **officer** | Write / Read | Write / Read | Read | Read | Read | Read |
| **state_commander** | Read | Read | Write / Read | Read | Read | Read |
| **region_commander** | Read | Read | Write / Read | Read | Read | Read |
| **district_commander** | Read | Read | Write / Read | Read | Read | Read |
| **police_station_commander** | Read | Read | Write / Read | Read | Read | Read |
| **state_admin** | Read | Read | No | No | No | No |
| **region_admin** | Read | Read | No | No | No | No |
| **city_admin** | Read | Read | No | No | No | No |
| **district_admin** | Write / Read | Write / Read | Write / Read | Read | Read | Read |
| **cid_director** | Read | Write / Read | Read | Write / Read | Read | Read |
| **cid_supervisor** | Read | Write / Read | Read | Write / Read | Read | Read |
| **cid_officer** | Read | Write / Read | Read | Write / Read | Read | Read |
| **prosecutor** | Read | Read | No | Read | Read | Write / Read |
| **judge** | Read | Read | No | Read | Read | Write / Read |
| **court_clerk** | Read | Read | No | No | Read | Write / Read |
| **jail** | Read | Read | No | No | Write / Read | No |

---

### 5.6. Live Authorization Delta: Dynamic Permission Catalog

The live system now uses two authorization layers:

1. `allowRoles(...roles)` remains in older route groups and fixed workflow gates.
2. `requirePermission(permission_key)` is the primary gate for dynamic modules and must be treated as the current source of truth for UI access.

Permission data is stored in:

* `permissions`
* `role_permissions`
* `user_permissions`
* `permission_change_history`

The permissions catalog currently includes:

| Permission Key | Purpose |
| :--- | :--- |
| `audit_logs.view` | View audit logs |
| `cases.view` | Read cases |
| `cases.investigate` | Create/update investigation and case workflow records |
| `evidence.manage` | Manage evidence |
| `locations.view` | View state/region/district structures |
| `locations.manage` | Manage state/region/district structures |
| `ob.view` | View OB records |
| `ob.create` | Create OB records |
| `ob.update` | Update OB records |
| `ob.print` | Print OB records |
| `officers.view` | View officers |
| `officers.create` | Create officers |
| `officers.update` | Update officers |
| `officers.delete` | Delete officers |
| `officers.approve` | Approve officers |
| `officers.activate` | Activate officers |
| `officers.transfer` | Transfer officers |
| `permissions.manage` | Manage permissions |
| `roles.manage` | Manage roles |
| `ranks.assign` | Assign ranks |
| `ranks.manage` | Manage rank catalog |
| `reports.view` | View reports |
| `reports.export` | Export reports |
| `station_jail.view` | View station jail |
| `station_jail.intake` | Admit/hold prisoners at station jail |
| `station_jail.assign_cell` | Assign station jail cells |
| `jail.view` | View central jail |
| `jail.receive_transfer` | Receive station jail transfers at central jail |
| `jail.assign_cell` | Assign central jail cells |
| `jail.medical` | Manage prisoner medical records |
| `jail.visitors` | Manage prisoner visitor records |
| `jail.release_confirm` | Confirm central jail release |
| `suspects.view` | View offender/suspect records |
| `suspects.create` | Create offender/suspect records |
| `suspects.update` | Update offender/suspect records |
| `suspects.manage` | Composite suspect management permission |
| `users.manage` | Manage users |

Permission implication rule:

* `suspects.manage` implies `suspects.view`, `suspects.create`, and `suspects.update`.

Live role redirect rules:

| Role | First Dashboard |
| :--- | :--- |
| `station_jail` | `/dashboard/jail` |
| `jail` | `/dashboard/central-jail` |
| `investigator` | `/dashboard/investigator` |
| `region_admin` | `/dashboard/unit` |
| `district_admin` | `/dashboard/unit` |

Station jail and central jail are separate roles and permission surfaces. Station jail holds offenders locally, creates transfer documents, and performs roll call. Central jail receives completed court-sentence transfers, assigns central cells, and continues custody records.
