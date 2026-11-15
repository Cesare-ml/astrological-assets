# Strict asset-pack closure check

The default `npm run verify:pack` checks that every entry in the approved
manifest exists with its expected bytes, SHA-256 and approval metadata.
Historically, **additional files inside the pack were not inspected**. That
behavior is retained for compatibility with existing local development.

Before packaging or proposing migration, opt in to the **read-only strict
closure check**:

```sh
npm run verify:pack -- --strict
```

Equivalent direct invocation:

```sh
node scripts/verify-pack.mjs --root ./public/assets --manifest ./manifests/approved-assets.json --strict
```

Strict mode first performs the normal manifest verification and then scans
the entire pack root. It fails if it finds:

- a regular file absent from the manifest (including dotfiles and nested files);
- a symlink, including a dangling symlink;
- a non-regular filesystem entry;
- two entries whose normalized, case-folded paths collide (important when
  moving from Linux to Windows or macOS).

The pack root itself must also be a real directory, not a symlink, in either
mode. An empty directory is harmless. The scan reads files and directory
metadata; it never deletes, publishes, relabels or rewrites any asset.

Use a clean staging directory when building a distributable pack. If strict
mode fails, review the unexpected files or paths; **do not add them to the
manifest merely to make the check pass**. Each addition must go through the
separate provenance and rights-approval process.

This is an **integrity/inventory safeguard**, not proof of copyright
clearance. `npm run check:public-release` remains a separate mandatory gate;
its expected exit code is currently 2 until file-specific public permissions
have been established. Existing public Git history requires independent review.

No GitHub Actions or application deployment are involved.
