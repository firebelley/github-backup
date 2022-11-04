### About

This script will clone and bundle the entire history of all of your GitHub repositories.

Only repositories that have changed since the last backup will be cloned.

### How to Use

1. Clone this repo
1. Run `npm install`
1. Copy `.env.template` into a `.env` file at the root of this repository and enter the required values
1. Run with `node index.mjs`

If it ran successfully, all of the repositories that can be accessed with the token you supplied will be cloned and bundled in `/your/specified/backup/path/<github_username>`.

### Notes

When `USE_SSH_URL` in your `.env` is set to true, your repositories will be cloned using ssh. It is `false` by default.

### Other

I do not plan to maintain or accept contributions to this repository. Please feel free to fork and maintain as you see fit!
