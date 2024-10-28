# Welcome to the Seahorse Contributing Guide 🌊

*Thanks for investing your time in contributing to the Seahorse project!*

#### This document covers an overview of the contribution workflow from opening an issue, branch naming, creating a PR, reviewing and merging the PR.

## New to the Project?

To get an overview of the project, **read the README files for each section of the project** - [frontend](https://github.com/KonferCA/Seahorse/blob/main/frontend/README.md), [contract](https://github.com/KonferCA/Seahorse/blob/main/contract/README.md) and [backend](https://github.com/KonferCA/Seahorse/blob/main/backend/README.md). Here is the list of tools you need to install before starting out:

- [Install Node.js LTS](https://nodejs.org/en/download)
- [Install PNPM](https://pnpm.io/installation)
- [Install Python](https://www.python.org/downloads/)

❗ Take a look at our [Project Board](https://github.com/orgs/KonferCA/projects/1) for more details about the current focus of the project!

## Getting Started

Let's start by explaining the folder structure for this project:

```
.
├── backend -> handles all things regarding the model (i.e eda, fine tuning and so on)
│   └── src
│       └── data
├── contract -> handles the NEAR smart contract 
│   ├── build
│   ├── sandbox-test
│   └── src
├── docs -> all documentation, including this guide!
└── frontend -> handles user auth, wallet connections, user components and calling the model
    ├── public
    └── src
        ├── app
        │   ├── api
        │   │   ├── auth
        │   │   │   └── google
        │   │   └── user-data
        │   ├── components
        │   │   └── icons
        │   ├── data
        │   └── utils
        ├── components
        ├── wallets
        └── workers
```

## Issues

### Create a new issue

Before making a new issue, make sure there is no duplicate of the issue. If there is no existing issue for the problem
create one using the [issue form](https://github.com/KonferCA/Seahorse/issues/new).

**New Issue Checklist**:
- [ ] Issue is not duplicated
- [ ] Descripting Title
- [ ] Description of the problem/feature
- [ ] Steps to replicate problem (if applicable)
- [ ] Assign correct labels

### Work on an issue

For this project, in general, we don't assign issues to anyone. If you find an issue that you can work on, you can assign yourself to the issue. Make sure to link your development branch to the issue.

## Branching

As a general rule, always branch off from `main`. If you need a specific feature that is being worked on, you can branch off from that but make sure to note down which one has to be merged first in the PR.

### ✍️ Name a branch

Here is the convention we have for branch names:

- `feature/issue-number/description`
- `bugfix/issue-number/description`
- `doc/issue-number/description`
- `refactor/issue-number/description`
- `release/version`

A very simple example: `feature/1/register-form`

## Pull Requests

### ✔️ Pull request checklist:

- [ ] Does my PR have an appropriate title?
- [ ] Does my PR have at least two other developers in the team as reviewiers?
- [ ] Is my PR up to date with branch `main` and there are no merge clonficts?

### Merge pull requests

When you PR has gotten 2 approvals from the [CODEOWNERS](https://github.com/KonferCA/Seahorse/blob/main/.github/CODEOWNERS), you are ready to merge the PR. 
As a general rule, we don't merge PRs in place of the creator of the PR.
Keep an eye of your PRs and merge them when they are approved.

### 🥳 PR Merged!

Congratulations, you made it! Thanks for reading through the contribution guide.
