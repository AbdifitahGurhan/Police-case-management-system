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

| Method | Path | Controller Method | Middleware | Auth Required | Roles Allowed | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/cases` | `getCourtCases` | `authMiddleware`, `allowRoles` | Yes | `admin`, `court`, `judge`, `prosecutor` | Lists all court-referred cases. |
| **GET** | `/cases/:id` | `getCourtCaseById` | `authMiddleware`, `allowRoles` | Yes | Same as GET `/cases` | Fetches details of a court case. |
| **POST** | `/cases` | `registerCourtCase` | `authMiddleware`, `allowRoles` | Yes | `admin`, `court`, `prosecutor` | Files a case with the court. |
| **POST** | `/hearings` | `scheduleHearing` | `authMiddleware`, `allowRoles` | Yes | `admin`, `court` | Schedules a new hearing. |
| **POST** | `/proceedings` | `recordProceeding` | `authMiddleware`, `allowRoles` | Yes | `admin`, `court`, `judge` | Logs court proceedings and judge remarks. |
| **POST** | `/judgments` | `recordJudgment` | `authMiddleware`, `allowRoles` | Yes | `admin`, `judge` | Records the final judgment of the court. |
| **POST** | `/sentences` | `recordSentence` | `authMiddleware`, `allowRoles` | Yes | `admin`, `judge` | Records sentences (fines/imprisonment). |

---

### 4.7. General System Modules

* **Ranks (`/api/ranks`)**: GET `/`, POST `/`, DELETE `/:id` (Admin only)
* **Police Officers (`/api/police-officers`)**: GET `/`, POST `/`, PATCH `/:id`, DELETE `/:id` (Admin/Commanders)
* **Blockchain (`/api/blockchain`)**: GET `/verify/:caseId` (Calculates blockchain hash changes to detect modifications)
* **Search (`/api/search`)**: GET `/` (Global search by case number, name, or ob number)
* **Notifications (`/api/notifications`)**: GET `/`, PATCH `/:id/read` (Fetches system warnings and notification logs)
