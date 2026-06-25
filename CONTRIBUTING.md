# Contributing to Camado

Thank you for contributing to `camado`.

The goal of this project is to keep a modern TypeScript-first UI/runtime toolkit small, understandable, fast, and pleasant to use. Contributions that improve correctness, documentation, examples, tests, performance, and API clarity are welcome.

## Ways To Contribute

You can help by:

- reporting bugs and regressions
- improving documentation and examples
- adding tests for edge cases and runtime behavior
- improving performance-sensitive code paths
- refining developer experience in the component, modifier, or validator APIs
- proposing API changes that stay aligned with the project's design goals

## Before You Start

For small fixes, feel free to open a pull request directly.

For larger changes, please open an issue first so we can align on scope, API shape, compatibility impact, and maintenance cost before implementation starts.

Changes that should usually be discussed first:

- new public subpath exports
- new runtime primitives or modifier helpers
- behavioral changes in component mounting, patching, or scheduler behavior
- validator or form API changes
- storage backend changes
- anything that adds new runtime dependencies

## Local Setup

Install dependencies:

```bash
bun install
```

Run the main validation gate:

```bash
bun run build
bun run test
```

Useful commands during development:

```bash
bun run build
bun run test
bun run test:watch
```

If you change user-facing behavior, it is often helpful to update the relevant example or docs.

## Contribution Guidelines

Please keep these project rules in mind:

- Use English for code comments, docs, issues, and pull requests.
- Keep the public API small and predictable.
- Prefer runtime-light designs and platform APIs before adding dependencies.
- Avoid breaking changes unless they are clearly justified and documented.
- Add or update tests when changing parsing, rendering, validation, storage, or transition behavior.
- Update documentation and examples when public behavior changes.
- Keep module boundaries focused and avoid parallel patterns that solve the same problem in different ways.

## Code Style

When contributing code:

- target the current Node baseline in `package.json`
- prefer readable and explicit TypeScript over clever abstractions
- keep modules focused and avoid parallel patterns that solve the same problem in different ways
- preserve existing naming and public import conventions when extending the library
- be especially careful in request-like DOM flows, runtime helpers, modifiers, and validation code
- treat performance regressions as real regressions in hot paths

## Pull Request Checklist

Before opening a pull request, please make sure:

- `bun run build` passes locally
- `bun run test` passes locally
- new behavior is covered by tests when practical
- docs are updated when public API or behavior changes
- examples are updated when they demonstrate the affected feature
- breaking changes or migration steps are called out clearly

## Commit Messages

Commit messages should be written in English.

Conventional Commits are welcome, but not required. Clear, imperative commit messages are preferred.

Good examples:

- `feat: add typed storage memory backend`
- `fix: tighten validator error paths`
- `docs: clarify module exports`

## Review Expectations

Reviews focus on:

- correctness
- API clarity
- backward compatibility
- documentation quality
- tests
- maintainability
- performance in hot paths

Feedback is meant to improve the project, not to discourage contributors. Questions, follow-up iterations, and design discussion are all welcome.

## Need Help?

If you are unsure whether an idea fits `camado`, open an issue and describe:

- the use case
- the proposed API or behavior
- alternatives you considered
- compatibility or performance concerns

That usually leads to the fastest path forward.
