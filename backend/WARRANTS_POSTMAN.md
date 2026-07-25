# Legal Personnel and Warrants API

Use `Authorization: Bearer <token>` and `Content-Type: application/json`.

## Endpoints and roles

| Endpoint | Roles |
|---|---|
| `GET /api/legal-personnel/options?type=judge` | Admin, court, CID, officer and station-management roles that can create/view warrants |
| `GET/POST /api/legal-personnel` | `admin`, `court`, `court_admin` |
| `PUT /api/legal-personnel/:id` | `admin`, `court`, `court_admin` |
| `GET /api/warrants` | Admin, court, CID, officer and station management roles |
| `GET /api/warrants/:id` | Same warrant roles, station-scoped in the backend |
| `POST /api/warrants` | Same warrant roles, station-scoped in the backend |
| `PUT /api/warrants/:id` | Same warrant roles; terminal warrants are immutable |
| `PATCH /api/warrants/:id/cancel` | Same warrant roles, station-scoped in the backend |
| `PATCH /api/warrants/:id/execute` | Same warrant roles, station-scoped in the backend |
| `GET /api/warrants/:id/document` | Same warrant roles, station-scoped in the backend |

## Postman examples

Create a judge:

```json
{
  "personnel_type": "judge",
  "full_name": "Amina Hassan",
  "identification_number": "J-1007",
  "phone_number": "+252610000001",
  "email": "amina@example.so",
  "court_or_office": "Benadir Regional Court",
  "position": "Presiding Judge",
  "status": "active"
}
```

Create a warrant:

```json
{
  "warrant_number": "WR-2026-0001",
  "warrant_type": "arrest",
  "case_id": 12,
  "subject_name": "Example Subject",
  "reason": "Failure to appear before the court.",
  "issued_by_judge_id": 1,
  "police_station_id": 4,
  "issue_date": "2026-07-24",
  "expiry_date": "2026-08-24",
  "status": "issued"
}
```

Successful response:

```json
{"success":true,"data":{"id":1,"warrant_number":"WR-2026-0001","status":"issued"}}
```

Execute:

```json
{"execution_date":"2026-07-25","execution_notes":"Subject arrested and transferred to custody."}
```

Cancel:

```json
{"reason":"Court order withdrawn."}
```

Filters: `?status=issued&type=arrest&station_id=4&case_number=CASE-1&suspect=Ali&from_date=2026-01-01&to_date=2026-12-31&page=1&limit=20`.

Station tests must use two commander tokens. A commander from station A must receive HTTP 403/404 when requesting or creating data for station B. Inactive legal personnel must remain visible on historical records but must disappear from `/options`.
