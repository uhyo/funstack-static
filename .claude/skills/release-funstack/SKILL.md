---
name: release-funstack
description: A skill to make a GitHub release for the `@funstack/static` package. Use this skill when the user wants to release a new version of the package.
allowed-tools:
  - Read
  - Bash(gh:*)
  - Bash(git:*)
metadata:
  internal: true
---

# Release FUNSTACK Skill

To release a new version of the `@funstack/static` package, follow these steps:

1. Read the `packages/static/package.json` file to determine the current version of the package.

- User may or may not have already updated the version in `package.json`. Ask the user to confirm if they have updated the version. If not, you should update the version based on semantic versioning rules (patch, minor, major) as per user's instruction.

2. Update the version in `packages/static/package.json`, commit and push if necessary.

- The commit message should be `chore: bump version to x.y.z` where `x.y.z` is the new version.

3. Inspect the git log since the last release tag to generate release notes.

- The release notes should summarize the changes made since the last release.
- Especially, highlight any breaking changes, new features, or important fixes.
- Identify external contributors (see "Acknowledging External Contributors" below) and thank them in the release notes.

4. Use the `gh` CLI to create a new release on GitHub with the new version and the generated release notes.

- The tag name should be `x.y.z` where `x.y.z` is the new version.

5. Inform the user that the release has been created successfully, providing the URL to the release page on GitHub.

## Writing Release Notes

When writing release notes, consider the following structure:

```markdown
## What's Changed

### Breaking Changes

- Change defer API to accept JSX element instead of component (#14)

### Features

- Add cache busting for main RSC payload (#16)

### Improvements

- Simplify RSC payload path (#15)

### Thanks

A big thank you to @contributor for contributing the cache busting feature (#16) and for reporting #13, which drove the changes in this release. 🎉

**Full Changelog**: https://github.com/uhyo/funstack-static/compare/0.0.1...0.0.2
```

Notes:

- Highlight breaking changes if any.
- Group changes into categories like "Features", "Improvements", "Fixes", etc.
- Documentation updates and dependency updates should be omitted unless they are significant (e.g. breaking changes).
- Provide a link to the full changelog comparing the previous version and the new version.
- Include a "Thanks" section praising external contributors when there are any (see below). Omit the section if there are none.

## Acknowledging External Contributors

The repository owner is `uhyo`. Anyone else who contributed to the release deserves a shout-out.

To find external contributors:

- List the authors of commits since the last tag (`git log --format='%an <%ae>' <last-tag>..HEAD`) and the authors of the merged PRs (`gh pr view <number> --json author`). Squash-merged PRs are committed under the PR author's name, so check both.
- For each PR, also check the issues it references (`Closes #N`, `Addresses #N`, etc.) and note who reported them (`gh api repos/uhyo/funstack-static/issues/<N> -q .user.login`). Reporting the issue that drove a change counts as a contribution.
- Exclude `uhyo` and bots such as `dependabot[bot]`.

When writing the "Thanks" section:

- Mention each contributor by GitHub handle (`@handle`) so they get credited on the release page.
- Say concretely what they did — which PR they authored and/or which issue they reported — rather than a generic "thanks to everyone".
- Place the section after the change categories and before the "Full Changelog" link.
