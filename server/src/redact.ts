// Best-effort redaction of secrets from captured shell commands.
//
// The session state file (.walkie-talkie/state.yaml) is meant to be committed
// to git, so command history must not leak credentials. This is heuristic, not
// a guarantee — users are still advised to review the file before committing,
// and `--no-history` disables capture entirely.

// `https://user:password@host` → `https://user:****@host`
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.\-]*:\/\/[^\s:@/]+):([^\s@/]+)@/gi;

// `API_KEY=value`, `export TOKEN="value"`, `--password=value`, etc.
// Any var-like name ending in a sensitive word gets its value masked.
const SENSITIVE_ASSIGNMENT =
  /\b([A-Za-z_][A-Za-z0-9_]*?(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PASSPHRASE|CREDENTIALS?|APIKEY))\s*=\s*("[^"]*"|'[^']*'|\S+)/gi;

// `--password value`, `--token=value`, `--api-key value`, `--bearer value`
const SENSITIVE_FLAG =
  /(--?(?:password|passwd|passphrase|token|secret|api[-_]?key|apikey|auth|bearer)\b[=\s])(\S+)/gi;

const MASK = '****';

/** Mask likely secrets in a single command line. */
export function redactCommand(command: string): string {
  return command
    .replace(URL_CREDENTIALS, `$1:${MASK}@`)
    .replace(SENSITIVE_ASSIGNMENT, `$1=${MASK}`)
    .replace(SENSITIVE_FLAG, `$1${MASK}`);
}
