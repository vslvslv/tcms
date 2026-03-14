# TestRail Replication Plan — TCMS

This document summarizes the plan to build a Test Case Management System (TCMS) that replicates [TestRail](https://testrail.com/). Use it as the single source of context for all implementation phases.

---

## 1. Goal

Build a TestRail-like test case management system with:

- **Core**: Projects, suites, sections, test cases (with steps), test runs, milestones, and result recording.
- **Extended**: Custom case fields, shared steps, versioning, reporting, roles, and integrations (issue trackers, CI/CD).

---

## 2. Reference

- **Product**: TestRail (e.g. v10.x)
- **Optional live reference**: [copyrail123.testrail.io](https://copyrail123.testrail.io/) (for UI/flow checks).
- **Concepts**: [TestRail platform overview](https://testrail.com/platform), [Support / API](https://support.testrail.com/hc/en-us/sections/7077185274644-API-reference).

---

## 3. Data Model Summary

### 3.1 Hierarchy (test design)

```
Project
  └── Suite(s)          ← single or multiple per project
        └── Section(s)  ← tree (sections can have subsections)
              └── Test Case(s)
                    └── Test Step(s) or Shared Step references
```

### 3.2 Execution hierarchy

```
Project
  └── Suite(s) → Section(s) → Test case(s)
  └── Milestone(s)
  └── Test Run(s)   ← created from a suite; optional milestone
        └── Test(s) ← case instance in run
              └── Result(s) ← one per execution (pass/fail/blocked/etc.)
```

### 3.3 Core entities

| Entity        | Purpose |
|---------------|--------|
| **Project**   | Top-level container; holds suites, runs, milestones. |
| **Suite**     | Test case repository (one or many per project). |
| **Section**   | Folder/hierarchy for organizing cases (tree). |
| **Test case** | Scenario: title, steps, type, priority, custom fields. |
| **Test step** | Action + expected result; can be shared across cases. |
| **Shared steps** | Reusable step set; one edit propagates to all linked cases. |
| **Test run**  | One execution of a set of cases (e.g. “Regression – Chrome”). |
| **Test**      | A case in a run; holds one current result. |
| **Result**    | Outcome (pass/fail/blocked/skip), comment, time, attachments. |
| **Milestone** | Release/version with due date; can be linked to runs. |

### 3.4 Supporting entities

| Entity          | Purpose |
|-----------------|--------|
| Case type       | e.g. Functional, Smoke, Regression. |
| Priority        | e.g. Critical, High, Medium, Low. |
| Case field      | Custom fields (dropdown, text, etc.) per project/global. |
| Template        | Case layout (steps-based, exploratory, etc.). |
| Configuration   | e.g. OS, browser, device for runs. |
| User / Role     | Permissions (global and per project). |

---

## 4. Feature Tiers

### Tier 1 — Core (MVP)

- Projects and suites (single vs multiple).
- Sections (hierarchical).
- Test cases: title, steps (action + expected result), prerequisites, type, priority.
- Test runs: create from suite/section, assign, basic config.
- Execution: record result per test (pass/fail/blocked/skip), comment, time.
- Milestones: name, due date, link to runs.
- Case custom fields (configurable).
- Filtering and list views for cases, runs.
- Basic reporting: run summary (passed/failed/blocked/untested), milestone progress.

### Tier 2 — Parity

- Shared test steps (reuse across cases; edit once).
- Test case versioning and side-by-side diff.
- Test case templates (steps-based, exploratory, etc.).
- Test parameterization / datasets.
- Attachments (cases, runs, results).
- Defect/issue integration (link and push to Jira/GitHub/etc.).
- REST API (CRUD for main entities).
- Roles and permissions (admin, project roles).

### Tier 3 — Full product

- Case approval workflow.
- Requirements coverage and traceability.
- CI/CD integration (ingest automated results).
- Webhooks (notify on changes).
- Scheduled and shareable reports; dashboards.
- SSO, MFA, audit log.
- Import/export (e.g. CSV, TestRail migration).

---

## 5. Phased Implementation

### Phase 1 — MVP

**Goal**: Usable end-to-end flow without custom fields or advanced features.

- [ ] **Data model**: Project, Suite, Section, TestCase, TestStep, Run, Test (case-in-run), Result.
- [ ] **Backend**: CRUD APIs for above; auth (login/session or JWT).
- [ ] **Frontend**: Project/suite/section tree; case list and editor (title + steps); create run from suite/section; run view with test list; record result (pass/fail/blocked) with comment and time.
- [ ] **Reporting**: Run summary (counts by status); optional simple dashboard.

**Out of scope for Phase 1**: Custom fields, plans, milestones, shared steps, versioning, attachments, integrations.

---

### Phase 2 — Structure and execution

**Goal**: Full structure and execution parity with basic reporting and permissions.

- [ ] **Data model**: Milestone, CaseType, Priority, CaseField (config + values), Configuration, User, Role.
- [ ] **Features**: Milestones; custom case fields; priorities and case types; configurations for runs; attachments (cases, results).
- [ ] **Permissions**: Roles (e.g. admin, lead, tester); project-level access.
- [ ] **Reporting**: Milestone progress; filters and export.

---

### Phase 3 — Reuse and integration

**Goal**: Reuse, history, and ecosystem integration.

- [ ] **Data model**: SharedStep, CaseVersion (or equivalent for history), Dataset (for parameterization).
- [ ] **Features**: Shared steps; case versioning and diff; case templates; parameterization/datasets; defect/issue integration (link and push).
- [ ] **API**: Full REST coverage; optional alignment with TestRail-style endpoints for migration.
- [ ] **CI**: Ingest results (e.g. JUnit, Playwright); link to runs/plans.

---

### Phase 4 — Enterprise and scale

**Goal**: Compliance, visibility, and scale.

- [ ] **Features**: Case approval workflow; requirements and traceability; webhooks; scheduled/shareable reports; dashboards.
- [ ] **Security**: SSO (SAML/OAuth/OpenID), MFA, audit log.
- [ ] **Operations**: Import/export (CSV, optional TestRail import); project-level admin.

---

## 6. Architecture and diagrams

Architecture is documented with the **C4 model** and **Mermaid** diagrams (version-controlled, renderable in GitHub/GitLab). See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for:

- Tool choices (C4 + Mermaid)
- System Context diagram (users and external systems)
- Container diagram (Web App, API, Database, File storage)
- High-level execution data flow
- Technology options summary

---

## 7. Technical Guidelines

- **Stack**: Choose one (e.g. React/Vue + Node/Python/Go + Postgres); keep APIs and data model independent of UI.
- **Schema**: Normalize core entities; use JSON or EAV for flexible custom case fields; index runs/plans/milestones and result queries.
- **API**: REST (or GraphQL) for all Tier 1–2 entities; consistent error and validation responses.
- **Auth**: Session or JWT; then SSO and RBAC in Phase 4.
- **Storage**: Attachments via local or S3-compatible store.

---

## 8. Success Criteria (per phase)

- **Phase 1**: Create project → add cases with steps → create run → record results → see run summary.
- **Phase 2**: Use plans/milestones, custom fields, configs, and roles; report on milestone progress.
- **Phase 3**: Reuse shared steps; see case history; link results to issues; ingest automated results.
- **Phase 4**: Approvals, traceability, SSO, and scheduled reports available where applicable.

---

## 9. Document history

| Date       | Change |
|-----------|--------|
| 2025-03-05 | Initial plan from TestRail replication investigation. |

---

*Use this document as the context for all phases; update the checklists and “Document history” as work progresses.*
