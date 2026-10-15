# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- **No secret**: SMHI open data needs no account, no key, no password.
- **Location**: the integration reads the coordinates of the Gladys houses
  (`location: true`) and the coordinates typed in its configuration, and sends
  them to SMHI only, rounded to six decimals, in the forecast request. They are
  never written to the logs.
- **`/data`**: `smhi-state.json` holds the identifiers of the warnings already
  announced to the scenes, per place. Nothing else is stored.
- **Network**: outbound HTTPS to `opendata-download-metfcst.smhi.se` and
  `opendata-download-warnings.smhi.se`, nothing else. No port is opened.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the SMHI services.
