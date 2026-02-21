---
name: create-pr
description: A skill to create a pull request on a GitHub repository. Use this skill when the user wants to create a pull request for the changes you have made.
allowed-tools:
  - Read
  - Bash(gh:*)
  - Bash(git:*)
metadata:
  internal: true
---

# Create Pull Request Skill

To satisfy the user's request to create a pull request on a GitHub repository, follow these steps:

1. Create a new branch for the changes (if not already done).
2. Commit the changes to the new branch.
3. Push the branch to the remote repository.
4. Use the `gh` CLI to create a pull request. The target branch is `master` unless specified otherwise.

Then inform the user that the pull request has been created successfully, providing the URL to the pull request.

## Merging the Pull Request

After the user reviews the pull request and requests to merge it, you can use the `gh` CLI to merge the pull request. Confirm with the user before merging.

Note that you should use the squash merge.

## Steps After Merging the Pull Request

After merging the pull request, follow these steps so that the local repository is ready for future work:

1. Switch back to the `master` branch.
2. Pull the latest changes from the remote `master` branch to ensure the local repository is up to date.
3. Delete the local branch that was used for the pull request. (Note: remote branch is automatically deleted by GitHub)
4. Inform the user that the pull request is merged and the local repository is now up to date and ready for future work.
