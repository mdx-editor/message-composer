#!/usr/bin/env bash
set -euo pipefail

repo="${GITHUB_REPO:-mdx-editor/message-composer}"
secret_name="${GITHUB_SECRET_NAME:-NPM_TOKEN}"
npm_org="${NPM_ORG:-mdxeditor}"
expires_days="${NPM_TOKEN_EXPIRES_DAYS:-7}"
token_name="${NPM_TOKEN_NAME:-message-composer bootstrap publish}"
token_description="${NPM_TOKEN_DESCRIPTION:-Temporary semantic-release bootstrap token for mdx-editor/message-composer}"

usage() {
  cat <<EOF
Create a temporary org-scoped npm publish token and store it as a GitHub Actions secret.

Usage:
  scripts/create-bootstrap-npm-token-secret.sh

Environment overrides:
  GITHUB_REPO              GitHub repo that receives the secret. Default: ${repo}
  GITHUB_SECRET_NAME       Secret name. Default: ${secret_name}
  NPM_ORG                  npm org/scope without @. Default: ${npm_org}
  NPM_TOKEN_EXPIRES_DAYS   Token lifetime in days. Default: ${expires_days}
  NPM_PASSWORD             npm password. If omitted, the script prompts.
  NPM_OTP                  npm one-time password. If omitted, the script prompts.

The token is intentionally scoped to the npm org/scope, not to a single package,
so it can bootstrap the first publish before @${npm_org}/message-composer exists.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

for command_name in npm gh node; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
done

read_from_tty() {
  local prompt="$1"
  local silent="$2"
  local value

  if [[ ! -r /dev/tty ]]; then
    echo "Cannot prompt because /dev/tty is unavailable. Set NPM_PASSWORD and NPM_OTP in the environment." >&2
    exit 1
  fi

  if [[ "${silent}" == "true" ]]; then
    IFS= read -r -s -p "${prompt}" value < /dev/tty
    echo > /dev/tty
  else
    IFS= read -r -p "${prompt}" value < /dev/tty
  fi

  printf "%s" "${value}"
}

if [[ -z "${NPM_PASSWORD:-}" ]]; then
  NPM_PASSWORD="$(read_from_tty "npm password: " true)"
fi

if [[ -z "${NPM_OTP:-}" ]]; then
  NPM_OTP="$(read_from_tty "npm OTP (leave blank only if this account does not require one): " false)"
fi

echo "Creating temporary npm token scoped to @${npm_org} for ${expires_days} day(s)..." >&2

npm_args=(
  token
  create
  --json
  --name "${token_name}"
  --token-description "${token_description}"
  --expires "${expires_days}"
  --scopes "${npm_org}"
  --orgs "${npm_org}"
  --packages-and-scopes-permission read-write
  --orgs-permission read-only
  --bypass-2fa
)

if [[ -n "${NPM_OTP}" ]]; then
  npm_json="$(npm_config_password="${NPM_PASSWORD}" npm_config_otp="${NPM_OTP}" npm "${npm_args[@]}")"
else
  npm_json="$(npm_config_password="${NPM_PASSWORD}" npm "${npm_args[@]}")"
fi

token="$(
  NPM_TOKEN_JSON="${npm_json}" node <<'EOF'
const text = process.env.NPM_TOKEN_JSON ?? "";
const start = text.indexOf("{");
const end = text.lastIndexOf("}");

if (start === -1 || end === -1 || end <= start) {
  console.error("npm did not return a JSON object for the created token.");
  process.exit(1);
}

const data = JSON.parse(text.slice(start, end + 1));
const token = data.token;

if (typeof token !== "string" || token.length === 0) {
  console.error("npm token JSON did not contain a non-empty token field.");
  process.exit(1);
}

process.stdout.write(token);
EOF
)"

printf "%s" "${token}" | gh secret set "${secret_name}" --repo "${repo}" --app actions

echo "Stored ${secret_name} for ${repo}." >&2
echo "Revoke this npm token and remove the GitHub secret after trusted publishing is configured." >&2
