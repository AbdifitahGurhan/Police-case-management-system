# Somali Police Force Case Management System
## Core Project Blueprint - Part 3B: Database Schema Verification & Live Delta

This document lists the actual tables currently present in the running database, detailing schemas for tables missing from the initial blueprint, and cataloging any differences or deprecated definitions.

### 1. Complete List of Current Live Tables (47 tables)

The following tables are currently active in the live MySQL `police_cms` database:

1. `arrests`
2. `audit_logs`
3. `biometric_identifiers`
4. `blockchain_records`
5. `case_actions`
6. `case_confirmations`
7. `case_criminals`
8. `case_transfers`
9. `case_victims`
10. `cases`
11. `chain_of_custody`
12. `cid_cases`
13. `cid_crime_scenes`
14. `cid_progress_notes`
15. `cid_reports`
16. `cities`
17. `complainants`
18. `court_appeals`
19. `court_cases`
20. `court_evidence_notes`
21. `court_hearings`
22. `court_judgments`
23. `court_proceedings`
24. `court_sentences`
25. `court_witnesses`
26. `criminals`
27. `districts`
28. `evidence`
29. `login_logs`
30. `ob_entries`
31. `officer_assignments`
32. `officer_transfers`
33. `police_officers`
34. `prison_transfers`
35. `prisoner_documents`
36. `prisoner_medical_records`
37. `prisoner_visitor_logs`
38. `ranks`
39. `referrals`
40. `regions`
41. `release_approvals`
42. `roles`
43. `state_administrations`
44. `users`
45. `victims`
46. `witness_statements`
47. `witnesses`

---

### 2. Live Column Structures for Missing/Undocumented Tables

The following schemas detail the actual column structure (types, constraints, keys) for tables that exist in the live database but were omitted from the Part 1 & Part 2 blueprints:

#### Table: `audit_logs`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `user_id` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `user_email` | `varchar(150)` | `YES` | `` | `NULL` | `` |
| `action` | `varchar(100)` | `NO` | `` | `NULL` | `` |
| `entity_type` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `entity_id` | `int` | `YES` | `` | `NULL` | `` |
| `details` | `json` | `YES` | `` | `NULL` | `` |
| `old_data` | `json` | `YES` | `` | `NULL` | `` |
| `new_data` | `json` | `YES` | `` | `NULL` | `` |
| `ip_address` | `varchar(50)` | `YES` | `` | `NULL` | `` |
| `user_agent` | `text` | `YES` | `` | `NULL` | `` |
| `created_at` | `timestamp` | `YES` | `MUL` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `biometric_identifiers`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `suspect_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `biometric_type` | `enum('fingerprint','face','iris','other')` | `NO` | `MUL` | `NULL` | `` |
| `biometric_hash` | `varchar(255)` | `NO` | `` | `NULL` | `` |
| `quality_score` | `decimal(5,2)` | `YES` | `` | `NULL` | `` |
| `captured_by` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `captured_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |
| `notes` | `text` | `YES` | `` | `NULL` | `` |

#### Table: `case_actions`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `case_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `performed_by` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `action_type` | `varchar(100)` | `NO` | `` | `NULL` | `` |
| `description` | `text` | `YES` | `` | `NULL` | `` |
| `status_before` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `status_after` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `created_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `case_victims`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `case_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `victim_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `notes` | `text` | `YES` | `` | `NULL` | `` |
| `added_by` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `added_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `cid_progress_notes`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `cid_case_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `note` | `text` | `NO` | `` | `NULL` | `` |
| `status` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `created_by` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `created_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `cid_reports`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `cid_case_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `report_title` | `varchar(255)` | `NO` | `` | `NULL` | `` |
| `case_summary` | `text` | `YES` | `` | `NULL` | `` |
| `activities` | `text` | `YES` | `` | `NULL` | `` |
| `evidence_summary` | `text` | `YES` | `` | `NULL` | `` |
| `witness_summary` | `text` | `YES` | `` | `NULL` | `` |
| `suspect_analysis` | `text` | `YES` | `` | `NULL` | `` |
| `findings` | `text` | `NO` | `` | `NULL` | `` |
| `recommendations` | `text` | `YES` | `` | `NULL` | `` |
| `submitted_by` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `submitted_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `court_appeals`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `court_case_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `filed_by` | `varchar(150)` | `NO` | `` | `NULL` | `` |
| `appeal_reason` | `text` | `NO` | `` | `NULL` | `` |
| `filing_date` | `date` | `NO` | `` | `NULL` | `` |
| `status` | `enum('pending','approved','rejected')` | `YES` | `` | `pending` | `` |
| `created_by` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `created_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `court_evidence_notes`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `court_case_id` | `int` | `NO` | `PRI` | `NULL` | `` |
| `evidence_id` | `int` | `NO` | `PRI` | `NULL` | `` |
| `notes` | `text` | `YES` | `` | `NULL` | `` |

#### Table: `court_judgments`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `court_case_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `judge_name` | `varchar(150)` | `YES` | `` | `NULL` | `` |
| `decision_date` | `date` | `NO` | `` | `NULL` | `` |
| `decision_type` | `enum('convicted','acquitted','dismissed')` | `NO` | `` | `NULL` | `` |
| `judgment_summary` | `text` | `NO` | `` | `NULL` | `` |
| `created_by` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `created_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `court_proceedings`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `court_case_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `hearing_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `proceeding_date` | `date` | `NO` | `` | `NULL` | `` |
| `notes` | `text` | `YES` | `` | `NULL` | `` |
| `judge_remarks` | `text` | `YES` | `` | `NULL` | `` |
| `prosecutor_remarks` | `text` | `YES` | `` | `NULL` | `` |
| `defense_remarks` | `text` | `YES` | `` | `NULL` | `` |
| `created_by` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `created_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `court_sentences`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `court_case_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `defendant_name` | `varchar(150)` | `NO` | `` | `NULL` | `` |
| `sentence_type` | `varchar(100)` | `NO` | `` | `NULL` | `` |
| `duration` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `fine_amount` | `decimal(15,2)` | `YES` | `` | `NULL` | `` |
| `sentence_date` | `date` | `NO` | `` | `NULL` | `` |
| `created_by` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `created_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `court_witnesses`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `court_case_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `witness_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `status` | `enum('summoned','present','absent')` | `YES` | `` | `summoned` | `` |
| `testimony` | `text` | `YES` | `` | `NULL` | `` |
| `signed_statement_url` | `varchar(500)` | `YES` | `` | `NULL` | `` |
| `summoned_at` | `timestamp` | `YES` | `` | `NULL` | `` |
| `created_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `login_logs`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `user_id` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `username` | `varchar(150)` | `YES` | `` | `NULL` | `` |
| `success` | `tinyint(1)` | `NO` | `` | `0` | `` |
| `failure_reason` | `varchar(255)` | `YES` | `` | `NULL` | `` |
| `ip_address` | `varchar(50)` | `YES` | `` | `NULL` | `` |
| `user_agent` | `text` | `YES` | `` | `NULL` | `` |
| `created_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `prison_transfers`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `suspect_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `arrest_id` | `int` | `YES` | `MUL` | `NULL` | `` |
| `from_facility` | `varchar(255)` | `YES` | `` | `NULL` | `` |
| `to_facility` | `varchar(255)` | `NO` | `` | `NULL` | `` |
| `transfer_reason` | `text` | `NO` | `` | `NULL` | `` |
| `transfer_date` | `datetime` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |
| `authorized_by` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `status` | `enum('pending','completed','cancelled')` | `YES` | `` | `completed` | `` |
| `notes` | `text` | `YES` | `` | `NULL` | `` |
| `created_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `prisoner_documents`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `suspect_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `arrest_id` | `int` | `YES` | `MUL` | `NULL` | `` |
| `document_type` | `varchar(100)` | `NO` | `` | `NULL` | `` |
| `title` | `varchar(255)` | `NO` | `` | `NULL` | `` |
| `file_url` | `varchar(500)` | `YES` | `` | `NULL` | `` |
| `file_hash` | `varchar(64)` | `YES` | `` | `NULL` | `` |
| `uploaded_by` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `uploaded_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |
| `notes` | `text` | `YES` | `` | `NULL` | `` |

#### Table: `prisoner_medical_records`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `suspect_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `arrest_id` | `int` | `YES` | `MUL` | `NULL` | `` |
| `record_date` | `datetime` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |
| `condition_summary` | `text` | `NO` | `` | `NULL` | `` |
| `treatment_given` | `text` | `YES` | `` | `NULL` | `` |
| `doctor_name` | `varchar(150)` | `YES` | `` | `NULL` | `` |
| `facility` | `varchar(255)` | `YES` | `` | `NULL` | `` |
| `fitness_status` | `enum('fit','needs_treatment','hospitalized','critical')` | `YES` | `` | `fit` | `` |
| `recorded_by` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `created_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `prisoner_visitor_logs`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `suspect_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `arrest_id` | `int` | `YES` | `MUL` | `NULL` | `` |
| `visitor_name` | `varchar(150)` | `NO` | `` | `NULL` | `` |
| `visitor_id_number` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `relationship` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `visit_date` | `datetime` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |
| `purpose` | `text` | `YES` | `` | `NULL` | `` |
| `approved_by` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `notes` | `text` | `YES` | `` | `NULL` | `` |
| `created_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `referrals`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `case_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `referred_by` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `referred_to_role` | `varchar(50)` | `YES` | `` | `NULL` | `` |
| `referred_to_user` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `reason` | `text` | `YES` | `` | `NULL` | `` |
| `notes` | `text` | `YES` | `` | `NULL` | `` |
| `status` | `enum('pending','accepted','rejected','completed')` | `YES` | `` | `pending` | `` |
| `response` | `text` | `YES` | `` | `NULL` | `` |
| `referred_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |
| `responded_at` | `timestamp` | `YES` | `` | `NULL` | `` |

#### Table: `victims`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `full_name` | `varchar(150)` | `NO` | `` | `NULL` | `` |
| `gender` | `enum('male','female')` | `YES` | `` | `male` | `` |
| `age` | `int` | `YES` | `` | `NULL` | `` |
| `nationality` | `varchar(100)` | `YES` | `` | `Somali` | `` |
| `id_type` | `varchar(50)` | `YES` | `` | `NULL` | `` |
| `id_number` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `phone` | `varchar(30)` | `YES` | `` | `NULL` | `` |
| `address` | `text` | `YES` | `` | `NULL` | `` |
| `injury_description` | `text` | `YES` | `` | `NULL` | `` |
| `created_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `witness_statements`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `case_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `witness_id` | `int` | `NO` | `MUL` | `NULL` | `` |
| `statement` | `text` | `NO` | `` | `NULL` | `` |
| `statement_date` | `date` | `YES` | `` | `NULL` | `` |
| `taken_by` | `varchar(100)` | `YES` | `` | `NULL` | `` |
| `created_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |

#### Table: `witnesses`

| Field | Type | Null | Key | Default | Extra |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `int` | `NO` | `PRI` | `NULL` | `auto_increment` |
| `full_name` | `varchar(150)` | `NO` | `` | `NULL` | `` |
| `gender` | `enum('male','female')` | `YES` | `` | `male` | `` |
| `age` | `int` | `YES` | `` | `NULL` | `` |
| `phone` | `varchar(30)` | `YES` | `` | `NULL` | `` |
| `address` | `text` | `YES` | `` | `NULL` | `` |
| `relationship_to_case` | `varchar(150)` | `YES` | `` | `NULL` | `` |
| `created_at` | `timestamp` | `YES` | `` | `CURRENT_TIMESTAMP` | `DEFAULT_GENERATED` |


---

### 3. Schema Differences in Documented Tables

Comparing the live column definitions for the original documented tables:

* **Status**: Verified all live table definitions. No structural column discrepancies or type-mismatches exist between the live DB and the documented tables. All columns mapped correctly.


---

### 4. Deprecated/Unused Tables

The following tables were previously documented but do not exist in the live database or are unused:

* **None**: All tables documented in Part 1 and Part 2 are active in the live MySQL database.

---

### 5. Secondary Data Store: MongoDB Integration

Based on direct inspection of the codebase:

1. **Connection Mappings**:
   * **File Path**: The connection helper is configured in [mongodb.js](file:///c:/Users/micro/Documents/Police-case-management-system-main/backend/src/config/mongodb.js).
   * **Library**: The app uses the `mongoose` (v9.6.2) Object Data Modeling (ODM) library.
   * **Connection String**: Resolved via `process.env.MONGODB_URI` from `.env`.
   * **Initialization**: The connection function `connectMongoDB()` is loaded on startup inside [app.js](file:///c:/Users/micro/Documents/Police-case-management-system-main/backend/src/app.js) (line 99).
2. **Current Usage Status**:
   * **Skipped on Startup**: In `.env`, `MONGODB_URI` is left blank, meaning `connectMongoDB()` outputs `MongoDB connection skipped: MONGODB_URI is not set` on startup and returns `null`.
   * **No DB Operations**: Codebase searches confirm `mongoose` is never imported, and MongoDB collections or schemas are never defined outside the config file. All state actions (including audit logs and session logs) write directly to the MySQL database.
   * **Functional Requirement**: MongoDB is completely **optional** and **unused** in the current system implementation. All core operations continue to function relying solely on MySQL.

