# Somali Police Force Case Management System
## Core Project Blueprint - Part 7: Error Handling, Security, Logging, & Performance

This document serves as Part 7 of the comprehensive system blueprint for the Somali Police Force Case Management System, detailing global error middlewares, database constraint parsers, input sanitations, blockchain audits, and database query optimizations.

---

## 7. Security, Error Management, Logging, & Performance

### 7.1. Global Error Handling Strategy
The Express application utilizes a centralized error-handling middleware (`errorHandler.js`) that captures all errors passed via `next(err)` across routes. 

#### Database Exception Mapping:
* **Duplicate Keys (`ER_DUP_ENTRY`)**: Returns a `409 Conflict` status with a message stating that the record already exists.
* **Foreign Key Violations (`ER_NO_REFERENCED_ROW_2`)**: Returns a `400 Bad Request` status indicating that the referenced parent resource (e.g. station ID, user ID) does not exist.
* **Payload Too Large (Status 413)**: Returns a `413 Payload Too Large` status (typically triggered when file uploads exceed the 5MB body size limit).
* **Stack Traces**: Enforces env checks to only append detailed stack traces in `development` mode, hiding them in production to prevent source code leaks.

---

### 7.2. Application & Network Security

#### 7.2.1. SQL Injection Protection
* The application enforces parameterization on all database operations:
  * Raw queries utilize `?` place-holders combined with argument arrays parsed by the driver:
    ```javascript
    await db.query('SELECT * FROM cases WHERE id = ?', [caseId]);
    ```
  * Enforces typed variables casting on values like limits and offsets (`parseInt(limit)`) before inserting them into query strings to prevent string-based injection.

#### 7.2.2. XSS (Cross-Site Scripting) & CORS
* **Body Size Restrictions**: Restricts JSON/url-encoded body payloads to a maximum of `10MB`.
* **CORS Block**: Integrated the `cors()` middleware wrapper in the API pipeline to regulate resource accesses by authorized hostnames.
* **File Uploads Sandbox**: Uploaded evidence files and profile photos are placed inside `/uploads` and served as static resources, preventing remote execution of scripts.

#### 7.2.3. Cryptography & Key Storage
* **Secret Storage**: Key parameters (JWT secrets, DB credentials, ports) are decoupled into an environment file (`.env`).
* **Bcrypt**: Direct password storage is prohibited. All passwords undergo 12 salt rounds hashing.

---

### 7.3. Audit & Logging Engines

#### 7.3.1. Database Audit Logs (`audit_logs`)
Every status change, profile update, or resource creation calls `writeAuditLog()`. It logs:
* User identifiers (`user_id`, `user_email`).
* Action tags (e.g., `'CREATE_CASE'`, `'LOGIN'`, `'LOGOUT'`, `'UPDATE_STATUS'`).
* Targeted entity schema information (`entity_type`, `entity_id`).
* Before-and-after data snapshots (`old_data`, `new_data`) stored as JSON.
* Machine context details (`ip_address`, `user_agent`).

#### 7.3.2. Authentication Auditing (`login_logs`)
Dedicated table tracking authentication status logs:
* Records all successful and failed logins.
* Captures failure reasons (e.g., `'Invalid credentials'`, `'Account is deactivated'`).

---

### 7.4. Performance & Query Optimization

#### 7.4.1. Database Indexes
Core indexes are placed on columns frequently queried by filters and joins:
* `idx_users_location` on `users(state_administration_id, region_id, district_id)` to optimize location scoping checks.
* `idx_users_type` on `users(user_type, assigned_level)`.
* `idx_case_ob_entry` on `cases(ob_entry_id)`.
* `idx_case_original_ob_staff` on `cases(original_ob_staff_id)`.
* `idx_ob_location` on `ob_entries(state_administration_id, region_id, district_id)`.
* `idx_audit_logs_created_at` on `audit_logs(created_at)`.

#### 7.4.2. Pagination Mappings
Retrieval lists (such as `/api/cases`, `/api/ob-entries`, `/api/suspects`) enforce pagination using `LIMIT ? OFFSET ?` clauses to prevent buffer overflow. Returns metadata objects detailing count statistics:
```json
"pagination": {
  "page": 1,
  "limit": 20,
  "total": 142,
  "pages": 8
}
```
