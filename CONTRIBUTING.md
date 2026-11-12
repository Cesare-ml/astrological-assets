# Contributing to Astrological Assets

Thank you for helping build reusable astrological graphics and verification tools for VirgoStars.

## License and attribution

Original software and supporting source documentation are offered under [CPAL-1.0](LICENSE), including the required Exhibit B attribution **Powered by VirgoStars** (https://www.virgostars.it/). Preserve applicable notices and follow [licensing and credits](docs/LICENSING_AND_CREDITS.md). Contributors retain applicable copyright in their own contributions. Contributing does not transfer ownership or grant unrelated trademark rights.

**Assets are different from code.** The repository currently holds owner-attested images authorized for *private* use only. Do not assume these images, graphics based on third-party fonts, textures or branded artwork are publicly licensed. Every proposed public image needs its own human-supplied authorship, third-party clearance, chosen public license and a pinned SHA-256 record, per [rights protocol](docs/RIGHTS_AND_REVIEW.md).

## Workflow

1. Open or reference an issue with a focused scope and work in a branch. Use English for code, docs, commit messages and PRs.
2. Describe the provenance and purpose of every added/modified asset. For images include exact path, source file, SHA-256, rights holder, public redistribution evidence, license and any third-party/font review.
3. Keep paths compatible with existing `/assets/img/...` references; include before/after visual comparisons when images change.
4. Run `npm test`, `npm run audit:catalog`, `npm run verify:pack`, and `npm run check:public-release`. A release check failing because public permissions are not granted is expected. Never suppress that failure.
5. Submit a PR with validation results and remaining risks. Do not merge or release without explicit owner review.

Do not use GitHub Actions, automated deploys, access to production user data, or unauthorized imports. For renderer work, contribute to [astrological-charts](https://github.com/Cesare-ml/astrological-charts) instead.

Before publishing anything from this private repository, review the [public release checklist](docs/PUBLIC_RELEASE_CHECKLIST.md). A visibility change reveals historical content as well as the latest files.
