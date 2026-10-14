# Contributing to Shadcn-Admin

Thank you for considering contributing to **shadcn-admin**! Every contribution is valuable, whether it's reporting bugs, suggesting improvements, adding features, or refining README.

## Table of Contents

1. [Getting Started](#getting-started)
2. [How to Contribute](#how-to-contribute)
3. [Code Standards](#code-standards)
4. [Pull Request Guidelines](#pull-request-guidelines)
5. [Reporting Issues](#reporting-issues)
6. [Community Guidelines](#community-guidelines)

---

## Getting Started

1. **Fork** the repository.
2. **Clone** your fork:

   ```bash
   git clone https://github.com/your-username/shadcn-admin.git
   ```

3. **Install dependencies:**

   ```bash
   pnpm install
   ```

4. **Run the project locally:**

   ```bash
   pnpm dev
   ```

5. Create a new branch for your contribution:

   ```bash
   git checkout -b feature/your-feature
   ```

---

## How to Contribute

> **This repository is a fork of [`satnaing/shadcn-admin`](https://github.com/satnaing/shadcn-admin)
> used for a self-hosted subscription-management build. Work here is tracked in this repository,
> not upstream.**

- **Issues are disabled in this repository.** Do not rely on the upstream issue tracker or
  Discussions; they belong to the upstream project and are not monitored here.
- **Bug Fixes / Features:** describe the reproduction steps and the expected result in the
  pull request itself. Work is tracked as task files under `tasks/**/TASK.md`, which are the
  source of truth for scope, acceptance criteria and status.
- **Documentation:** improvements to the documentation are always appreciated.

> **Note:** For the upstream project, PRs adding new features without a prior issue or discussion
> will not be accepted. In this fork, the requirement is instead that **every PR is backed by a
> task file** under `tasks/` (see `docs/agent-collaboration.md`).

---

## Code Standards

- Follow the existing **ESLint** and **Prettier** configurations.
- Ensure your code is **type-safe** with **TypeScript**.
- Maintain consistency with the existing code structure.

> **Tips!** Before submitting your changes, run the following commands:

```bash
pnpm lint && pnpm format && pnpm knip && pnpm build
```

---

## Pull Request Guidelines

- **Follow the [PR Template](./PULL_REQUEST_TEMPLATE.md).** Its sections are:
  - Related task (`Refs: TASK-NNN`)
  - Change summary
  - In scope / out of scope, and the changed-file list
  - Test results — **paste the actual commands and output**, never just "all green"
  - Tests not run, and why
  - Compatibility / security / deployment impact
  - Rollback plan
  - Open issues
  - Author self-check
- Ensure your changes pass **CI checks** (`.github/workflows/ci.yml`).
- Keep PRs **focused** and **concise**; one PR per task.
- Merge strategy is **rebase-merge** (`docs/git-workflow.md` §4).
- Do not push directly to `main`; all changes go through a pull request.
  (Branch protection is not configured yet, so this is a convention — see
  `docs/operations/github-capability.md`.)

---

## Reporting Issues

- Clearly describe the issue.
- Provide reproduction steps if applicable.
- Include screenshots or code examples if relevant.

---

## Community Guidelines

- Be respectful and constructive.
- Follow the [Code of Conduct](./CODE_OF_CONDUCT.md).
- Stay on topic in discussions.

---

Thank you for helping make **shadcn-admin** better! 🚀

If you have any questions about **this fork**, open a pull request with your question, or reach the
maintainer through this repository. Upstream support ([`satnaing/shadcn-admin`](https://github.com/satnaing/shadcn-admin))
and its Discussions belong to the upstream project.
