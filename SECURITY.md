# Security Policy

## Supported Versions

`ustro` is still evolving quickly.

At the moment, security fixes are only guaranteed for:

- the current `main` branch
- the latest released version

Older releases, historical commits, and unpublished snapshots should be considered unsupported unless stated otherwise.

## What To Report

Please report vulnerabilities involving:

- DOM parsing or binding bugs
- validation, coercion, or form state issues
- storage namespace collisions or data exposure
- navigator or transition handling vulnerabilities
- modifier, event, or observer runtime issues
- denial-of-service vectors such as crashes, hangs, or unbounded parsing
- browser or Node compatibility bugs that create security impact

If you are unsure whether something is security-relevant, report it anyway.

## How To Report

Please do not open public issues for suspected vulnerabilities.

Instead, report them privately to:

- `is.kkokotero@gmail.com`

When possible, include:

- a clear description of the issue
- affected version, commit, or branch
- reproduction steps
- proof of concept or sample code
- expected impact
- any suggested remediation

## Response Expectations

The project will try to:

- acknowledge reports within 72 hours
- provide an initial assessment within 7 days when practical
- coordinate a fix before public disclosure

These are goals, not guarantees, especially while the project is still small.

## Disclosure

Please allow time for coordinated remediation before disclosing a vulnerability publicly.

Once a fix is available, the project may publish:

- a summary of the issue
- affected scope
- remediation guidance
- any compatibility notes

## Security Design Notes

`ustro` tries to reduce risk by:

- keeping the runtime surface relatively small and dependency-light
- validating inputs explicitly
- keeping component, modifier, storage, and validator concerns modular
- failing fast on malformed states where practical

That said, no network- or DOM-facing runtime should be assumed to be risk-free. Responsible reports are appreciated.
