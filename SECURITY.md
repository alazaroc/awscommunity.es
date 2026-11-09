# Security Policy

## Reporting a vulnerability

If you find a vulnerability, report it **privately**; do not open a public issue.

Use GitHub's [private vulnerability reporting](https://github.com/alazaroc/awscommunity.es/security/advisories/new) (Security → Report a vulnerability).

Please include, if you can:

- A description of the issue and its impact.
- Steps to reproduce or a proof of concept.
- The affected component (website, discovery Lambda, admin Lambda, infrastructure).

I will respond within a few days. Once the issue is confirmed and fixed, coordinated disclosure is welcome.

## Scope

This is a personal open-source project. There is no bug-bounty program, but responsibly reported issues are appreciated and, if you wish, will be credited.

## Good to know

- No credentials live in the repository; deployment uses GitHub OIDC and configuration is kept in SSM Parameter Store.
- The admin Lambda has no public URL: it can only be invoked through IAM.
- The backend never modifies Git and never publishes ambiguous events.
