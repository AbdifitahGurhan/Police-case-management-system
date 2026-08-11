# Somali Police Force Case Management System
## Core Project Blueprint - Part 4: API Documentation

This document serves as Part 4 of the comprehensive system blueprint for the Somali Police Force Case Management System, detailing REST API endpoints, routing patterns, controller mappings, middleware chains, and required roles.

---

## 4. REST API Endpoint Catalog

All routes are prefixed by the base URL: `http://localhost:5000/api`

### 4.1. Authentication Module (`/api/auth`)

Handles system authentication, profile fetching, and session destruction.

| Method | Path | Controller Method | Middleware | Auth Required | Roles Allowed | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/login` | `login` | None | No | Any | Logs in a user, returning a JWT token inside cookies or payload. |
| **POST** | `/logout` | `logout` | `authMiddleware` | Yes | Any | Invalidates the user session. |
| **GET** | `/me` | `getMe` | `authMiddleware` | Yes | Any | Returns profile details of the logged-in user. |

#### Example Request/Response:
* **POST `/api/auth/login`**:
  * **Request Body**:
    ```json
    {
      "username": "admin",
      "password": "password123"
    }
    ```
  * **Success Response (200 OK)**:
    ```json
    {
      "success": true,
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": 1,
        "username": "admin",
        "role": "admin",
        "full_name": "System Administrator"
      }
    }
    ```
  * **Failure Response (401 Unauthorized)**:
    ```json
    {
      "success": false,
      "message": "Invalid username or password"
    }
    ```

---

### 4.2. Occurrence Book Module (`/api/ob-entries`)

Manages initial public complaint entries at local stations.

| Method | Path | Controller Method | Middleware | Auth Required | Roles Allowed | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/` | `getObEntries` | `authMiddleware`, `allowRoles` | Yes | `admin`, `ob_staff`, `staff`, `officer`, `district_admin`, `cid`, `cid_director`, `cid_supervisor`, `cid_officer`, `STATE_COMMANDER`, `REGION_COMMANDER`, `DISTRICT_COMMANDER`, `POLICE_STATION_COMMANDER` | Retrieves all OB entries scoped to the user's location jurisdiction. |
| **GET** | `/:id` | `getObEntryById` | `authMiddleware`, `allowRoles` | Yes | Same as GET `/` roles | Fetches details of a specific OB entry by ID. |
| **POST** | `/` | `createObEntry` | `authMiddleware`, `allowRoles` | Yes | `admin`, `ob_staff`, `officer`, `district_admin` | Creates a new OB entry in the system. |
| **POST** | `/:id/convert-to-case` | `convertObToCase` | `authMiddleware`, `allowRoles` | Yes | `admin`, `officer`, `district_admin`, `cid`, `cid_director`, `cid_supervisor`, `cid_officer`, `STATE_COMMANDER`, `REGION_COMMANDER`, `DISTRICT_COMMANDER`, `POLICE_STATION_COMMANDER` | Converted specified OB entry into an active case. |

---

### 4.3. Case Management Module (`/api/cases`)

Handles the lifecycle of formal investigations.

| Method | Path | Controller Method | Middleware | Auth Required | Roles Allowed | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/` | `getCases` | `authMiddleware`, `allowRoles` | Yes | `admin`, `staff`, `officer`, `district_admin`, `cid`, `cid_director`, `cid_supervisor`, `cid_officer`, `STATE_COMMANDER`, `REGION_COMMANDER`, `DISTRICT_COMMANDER`, `POLICE_STATION_COMMANDER` | Lists location-scoped cases. |
| **GET** | `/stats` | `getCaseStats` | `authMiddleware`, `allowRoles` | Yes | Same as GET `/` roles + `officer` | Retrieves count matrices of cases (open, pending, closed, critical). |
| **GET** | `/my-assigned` | `getMyAssignedCases` | `authMiddleware`, `allowRoles` | Yes | Same as GET `/` roles + `officer` | Lists cases assigned to the authenticated officer. |
| **GET** | `/assignable/officers` | `getAssignableOfficers` | `authMiddleware`, `allowRoles` | Yes | `admin`, `district_commander`, `police_station_commander`, `district_admin` | Fetches officers eligible for case assignment. |
| **GET** | `/:id` | `getCaseById` | `authMiddleware`, `allowRoles` | Yes | Same as GET `/` roles | Details a case and links to witnesses, victims, and suspects. |
| **GET** | `/:id/export` | `exportCasePackage` | `authMiddleware`, `allowRoles` | Yes | Same as GET `/` roles | Exports all case evidence and statements into a compressed PDF/ZIP package. |
| **POST** | `/` | `createCase` | `authMiddleware`, `allowRoles` | Yes | `admin`, `officer`, `district_admin`, `cid`, `cid_director`, `cid_supervisor`, `cid_officer` | Creates a new case draft. |
| **POST** | `/:id/court-decision` | `recordCourtDecision` | `authMiddleware`, `allowRoles` | Yes | `admin`, `court` | Records judicial trial outcomes. |
| **PATCH** | `/:id/assign` | `assignCaseOfficer` | `authMiddleware`, `allowRoles` | Yes | `admin`, `district_commander`, `police_station_commander`, `district_admin` | Assigns an officer to a specific case. |
| **PUT** | `/:id` | `updateCase` | `authMiddleware`, `allowRoles` | Yes | `admin`, `officer`, `district_admin`, `cid`, `cid_director`, `cid_supervisor`, `cid_officer` | Updates case status or updates data points. |

---

### 4.4. CID Investigations Module (`/api/cid`)

Manages advanced CID case escalations, supervisors' reviews, and crime scene registers.

| Method | Path | Controller Method | Middleware | Auth Required | Roles Allowed | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/dashboard` | `getCidDashboard` | `authMiddleware`, `allowRoles` | Yes | `admin`, `cid`, `cid_director`, `cid_supervisor`, `cid_officer`, `prosecutor_liaison` | Fetches CID-specific metrics. |
| **GET** | `/cases` | `getCidCases` | `authMiddleware`, `allowRoles` | Yes | Same as GET `/dashboard` | Lists CID investigations. |
| **POST** | `/cases/sync` | `syncCidCase` | `authMiddleware`, `allowRoles` | Yes | Same as GET `/dashboard` + `STATE_COMMANDER`, `REGION_COMMANDER`, `DISTRICT_COMMANDER`, `POLICE_STATION_COMMANDER` | Synchronizes station-level cases to the CID database. |
| **GET** | `/cases/:id` | `getCidCaseById` | `authMiddleware`, `allowRoles` | Yes | Same as GET `/dashboard` | Fetches details of a single CID investigation. |
| **PATCH** | `/cases/:id/assign` | `assignCidCase` | `authMiddleware`, `allowRoles` | Yes | `admin`, `cid`, `cid_director`, `cid_supervisor`, `prosecutor_liaison`, ...COMMANDER_ROLES | Assigns a CID case to an investigator. |
| **PATCH** | `/cases/:id/acknowledge` | `acknowledgeCidCase` | `authMiddleware`, `allowRoles` | Yes | Same as GET `/dashboard` | Acknowledges receipt of case by the assigned investigator. |
| **PATCH** | `/cases/:id/investigation` | `updateInvestigation` | `authMiddleware`, `allowRoles` | Yes | `admin`, `cid`, `cid_director`, `cid_supervisor`, `cid_officer` | Appends status notes and logs search findings. |
| **POST** | `/cases/:id/crime-scenes` | `addCrimeScene` | `authMiddleware`, `allowRoles` | Yes | Same as PATCH `/:id/investigation` | Logs physical evidence found at the crime scene. |
| **POST** | `/cases/:id/reports` | `submitReport` | `authMiddleware`, `allowRoles` | Yes | Same as PATCH `/:id/investigation` | Submits final investigation reports. |
| **PATCH** | `/cases/:id/review` | `reviewInvestigation` | `authMiddleware`, `allowRoles` | Yes | `admin`, `cid`, `cid_director`, `cid_supervisor`, `prosecutor_liaison`, ...COMMANDER_ROLES | Submits supervisor review notes. |
| **POST** | `/cases/:id/forward-prosecutor` | `forwardToProsecutor` | `authMiddleware`, `allowRoles` | Yes | Same as PATCH `/:id/review` | Forwards evidence package to the prosecution office. |

---

### 4.5. Prisoner Custody Module (`/api/custody`)

Coordinates medical logs, booking notes, visitors, and releases.

| Method | Path | Controller Method | Middleware | Auth Required | Roles Allowed | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/prisoners` | `getPrisoners` | `authMiddleware`, `allowRoles` | Yes | `admin`, `jail`, `court`, `judge`, `prosecutor` | Lists all booked prisoners. |
| **GET** | `/prisoners/:id` | `getPrisonerById` | `authMiddleware`, `allowRoles` | Yes | Same as GET `/prisoners` | Retrieves a prisoner's full folder, including warrants. |
| **POST** | `/prisoners` | `bookPrisoner` | `authMiddleware`, `allowRoles` | Yes | `admin`, `jail` | Performs prisoner intake booking. |
| **POST** | `/prisoners/:id/medical` | `addMedicalRecord` | `authMiddleware`, `allowRoles` | Yes | `admin`, `jail` | Logs physical checks and hospital referrals. |
| **POST** | `/prisoners/:id/visitors` | `logVisitor` | `authMiddleware`, `allowRoles` | Yes | `admin`, `jail` | Logs visitor details. |
| **POST** | `/prisoners/:id/transfers` | `transferPrisoner` | `authMiddleware`, `allowRoles` | Yes | `admin`, `jail` | Logs facility transfers. |
| **GET** | `/releases` | `getReleaseRequests` | `authMiddleware`, `allowRoles` | Yes | Same as GET `/prisoners` | Lists pending release approvals. |
| **POST** | `/releases/request` | `requestRelease` | `authMiddleware`, `allowRoles` | Yes | `admin`, `jail` | Submits a request for release. |
| **PATCH** | `/releases/:id/approve` | `approveRelease` | `authMiddleware`, `allowRoles` | Yes | `admin`, `court`, `jail` | Validates a step in the release approval pipeline. |

---

### 4.6. Judicial Court Module (`/api/court`)

Coordinates scheduling hearings, court actions, and sentencing entries.

| Method | Path | Description |
| :--- | :--- | :--- |
| **GET** | `/api/court/cases` | Lists all court-referred cases |
| **GET** | `/api/court/cases/:id` | Court case detail |
| **GET** | `/api/court/dashboard` | Court dashboard metrics/status counts |
| **GET** | `/api/court/notifications` | Court notifications |
| **GET** | `/api/court/calendar` | Hearings calendar (supports date_range, court_room, case_status filters) |
| **GET** | `/api/court/personnel` | Court personnel list (judges etc.) |
| **POST** | `/api/court/cases` | Files a case with the court |
| **POST** | `/api/court/cases/:id/hearings` | Schedules a hearing for a case |
| **POST** | `/api/court/hearings/:hearingId/proceedings` | Logs proceedings/judge remarks for a hearing |
| **POST** | `/api/court/cases/:id/judgments` | Records the judgment |
| **POST** | `/api/court/cases/:id/sentences` | Records the sentence |
| **POST** | `/api/court/cases/:id/appeals` | Files an appeal |
| **PATCH** | `/api/court/cases/:id/assign` | Assigns court personnel to a case |
| **PATCH** | `/api/court/cases/:id/close` | Closes a court case |

---

### 4.7. General System Modules

* **Ranks (`/api/ranks`)**: GET `/`, POST `/`, DELETE `/:id` (Admin only)
* **Police Officers (`/api/police-officers`)**: GET `/`, POST `/`, PATCH `/:id`, DELETE `/:id` (Admin/Commanders)
* **Blockchain (`/api/blockchain`)**: GET `/verify/:caseId` (Calculates blockchain hash changes to detect modifications)
* **Search (`/api/search`)**: GET `/` (Global search by case number, name, or ob number)
* **Notifications (`/api/notifications`)**: GET `/`, PATCH `/:id/read` (Fetches system warnings and notification logs)

---

### 4.8. Live API Delta: Permission-Based Routes and New Workflows

The live API has moved many routes from fixed role gates to `requirePermission(...)`. The following endpoints must be treated as current live endpoints.

#### Case Investigation Records (`/api/cases`)

| Method | Path | Gate | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/cases/:id/investigations` | `cases.view` | Lists investigation records attached to a police case. |
| POST | `/api/cases/:id/investigations` | `cases.investigate` | Creates an investigation record with evidence, witnesses, interview steps, files, and conclusions. |
| PUT | `/api/cases/:id/investigations/:investigationId` | `cases.investigate` | Edits an existing investigation record. |
| POST | `/api/cases/:id/remands/:remandId/return` | `cases.investigate` | Returns a court remand back to court after additional investigation. |

#### Court Workflow (`/api/court`)

| Method | Path | Gate | Description |
| :--- | :--- | :--- | :--- |
| POST | `/api/court/cases/:id/arraignment` | court admin/judge/court clerk roles | Records arraignment/horgeyn. |
| GET | `/api/court/cases/:id/remands` | court read roles | Lists remand investigation orders. |
| POST | `/api/court/cases/:id/remands` | court admin/judge roles | Sends a case back for additional investigation. |
| PATCH | `/api/court/cases/:id/assign` | court admin roles | Assigns prosecutor/judge or legal team. |
| POST | `/api/court/cases/:id/hearings` | court write roles | Schedules hearing. |
| PATCH | `/api/court/hearings/:hearingId` | court write roles | Updates hearing details/status. |
| POST | `/api/court/hearings/:hearingId/proceedings` | court write roles | Adds hearing proceedings. |
| POST | `/api/court/cases/:id/evidence-defense` | court write/judge roles | Completes evidence and defense stage. |
| POST | `/api/court/cases/:id/judgments` | court admin/judge roles | Records final judgment. |
| POST | `/api/court/cases/:id/sentences` | court admin/judge roles | Issues sentence and updates linked arrest sentence fields. |
| POST | `/api/court/cases/:id/appeals` | court write roles | Registers appeal. |
| PATCH | `/api/court/cases/:id/close` | court admin roles | Closes court case. |

#### Station Jail and Central Jail (`/api/custody`)

| Method | Path | Gate | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/custody/admissions` | `station_jail.view` | Lists station jail admissions and eligible offenders. |
| POST | `/api/custody/admissions` | `station_jail.intake` | Performs station jail admission/intake. |
| POST | `/api/custody/admissions/:id/cell-assignments` | `station_jail.assign_cell` | Assigns station jail cell. |
| POST | `/api/custody/admissions/:id/roll-calls` | `station_jail.intake` | Records roll call. |
| POST | `/api/custody/roll-calls/bulk` | `station_jail.intake` | Records daily bulk roll call. |
| GET | `/api/custody/cells` | `station_jail.view` or `jail.view` | Lists cells by station/central scope. |
| POST | `/api/custody/cells` | `station_jail.assign_cell` | Creates/updates station jail cell capacity. |
| POST | `/api/custody/criminals/:id/transfers` | `station_jail.intake` | Creates pending transfer document to central jail. |
| GET | `/api/custody/transfers/:id/document` | `station_jail.view` | Fetches printable transfer document. |
| GET | `/api/custody/central/transfers` | `jail.view` | Lists pending incoming central jail transfers. |
| GET | `/api/custody/central/admissions` | `jail.view` | Lists prisoners received into central jail. |
| PATCH | `/api/custody/central/transfers/:id/receive` | `jail.receive_transfer` | Completes transfer and assigns central jail cell. |

#### Dynamic Permissions (`/api/permissions`)

| Method | Path | Gate | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/permissions` | `permissions.manage` | Reads roles, permissions, matrix, and overrides. |
| POST | `/api/permissions/roles` | `roles.manage` | Creates a role. |
| PUT | `/api/permissions/roles/:roleId` | `permissions.manage` | Updates role permission grants. |
| PUT | `/api/permissions/users/:userId` | `permissions.manage` | Updates user-level permission overrides. |
