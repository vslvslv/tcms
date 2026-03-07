---
name: create-pr
description: When on main, create a new branch with current changes, make one or more logical commits, push, and open a pull request. Use when the user wants to create a PR, open a pull request, commit their changes and open a PR, or get changes off main into a branch and create a PR.
---

# Create Pull Request

Workflow for turning uncommitted changes on `main` into a branch with commits and a pull request.

## Prerequisites

- Current branch is `main` (or `master`). If not, ask the user whether to switch to main first or create the branch from current branch.
- There are local changes (staged and/or unstaged). If none, there is nothing to commit—inform the user.

## Workflow

### 1. Create a new branch

- Branch name: use a short, descriptive name. Prefer prefixes like `feature/`, `fix/`, or `chore/` (e.g. `feature/e2e-run-view`, `fix/cases-overview-filter`).
- If the user gives a branch name, use it. Otherwise infer from the changes (e.g. from file paths or diff) and suggest one; confirm or let the user edit.
- Create and switch to the new branch; uncommitted changes stay in the working tree:
  - `git checkout -b <branch-name>`

### 2. Stage and commit (one or more commits)

- Review the changes (`git status`, `git diff`). Group them into **logical commits** (e.g. one commit per feature area, or one for implementation and one for tests).
- For each logical group:
  - Stage the relevant files: `git add <paths>` or `git add -p` for partial staging.
  - Commit with a clear message: `git commit -m "<type>: <short description>"` (e.g. `feat: add run view e2e tests`, `fix: ignore e2e auth in gitignore`).
- Prefer conventional commit types when it fits: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.

If everything belongs in one logical change, a single commit is fine.

### 3. Push the branch

- Push and set upstream: `git push -u origin <branch-name>`.

### 4. Create the pull request

- **If GitHub CLI is available** (`gh`): run `gh pr create` and, if needed, add title/body (e.g. `gh pr create --title "Title" --body "Description"`). Optionally use `gh pr create --fill` to use the first commit message.
- **Otherwise**: output the repository’s “new PR” URL (e.g. GitHub: `https://github.com/<owner>/<repo>/compare/<branch-name>?expand=1`) and tell the user to open it to create the PR.

## Checklist

Before finishing, confirm:

- [ ] Branch was created from main (or user-approved base).
- [ ] All intended changes are committed (no accidental leftover staging).
- [ ] Branch has been pushed to `origin`.
- [ ] PR was created (via `gh`) or the user was given the link to create it.

## Optional: commit message format

Use one line summary, optionally with a body:

```
<type>: <short summary>

Optional body with details.
```

Types: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`.
