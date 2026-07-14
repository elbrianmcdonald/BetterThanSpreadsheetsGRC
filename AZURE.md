# Deploying to Azure Container Apps

A runbook for running BetterThanSpreadsheetsGRC on Azure Container Apps with the Azure CLI.

If your container is **down right now**, jump to [Emergency: the container won't
start](#emergency-the-container-wont-start). You probably do not need to redeploy.

---

## Shell variables used throughout

```bash
RG=my-resource-group
APP=betterthanspreadsheetsgrc-app
ACR=myregistry                      # ACR name, without .azurecr.io
IMAGE=$ACR.azurecr.io/btsgrc        # image repository
TAG=v1                              # bump this on every deploy; avoid :latest
```

Avoid the `:latest` tag. Container Apps only creates a new revision when the image
*reference* changes, so redeploying `:latest` can silently leave the old image running.

---

## Emergency: the container won't start

### Symptom

The container exits at startup and the logs contain:

```
Error: An error occurred while loading instrumentation hook: Invalid environment variables
    at h (.next/server/chunks/7006.js:1:57552)
```

### Cause

A **required environment variable is missing** — almost always `CRON_SECRET`. The app hard-requires
three variables in production, and `NODE_ENV=production` is baked into the image:

| Variable | Requirement |
|---|---|
| `DATABASE_URL` | Must be a parseable Postgres URL. A bare `host:port` is rejected. |
| `AUTH_SECRET` | Non-empty. |
| `CRON_SECRET` | Non-empty **and at least 32 characters**. |

`CRON_SECRET` is the usual culprit: it was added later than the other two, and a Container App
created before that will not have it.

The error message is unhelpful on older images because the underlying library throws a bare
`Invalid environment variables` without naming the variable. **Newer images name it explicitly**
(see [Better diagnostics](#better-diagnostics-requires-a-rebuild)).

### Fix — no rebuild, no redeploy needed

```bash
az containerapp secret set -n $APP -g $RG --secrets \
  cron-secret="$(openssl rand -hex 32)"

az containerapp update -n $APP -g $RG --set-env-vars \
  CRON_SECRET=secretref:cron-secret
```

`az containerapp update` creates a new revision and restarts the app automatically.

> **No `openssl`?** On PowerShell:
> `-join ((1..64) | %{ '{0:x}' -f (Get-Random -Max 16) })`

### Verify

```bash
az containerapp logs show -n $APP -g $RG --type console --tail 50
```

Expect `✓ Ready in ...ms` and `[Scheduler] All workers started`. Then:

```bash
curl https://$(az containerapp show -n $APP -g $RG --query properties.configuration.ingress.fqdn -o tsv)/api/health
# {"status":"healthy","timestamp":"..."}
```

### Still failing?

Confirm all three variables are actually present and non-empty:

```bash
az containerapp show -n $APP -g $RG \
  --query "properties.template.containers[0].env[?name=='DATABASE_URL' || name=='AUTH_SECRET' || name=='CRON_SECRET']" -o table
```

> **An empty string counts as missing.** A `secretref:` pointing at a secret that does not exist
> resolves to an empty string and fails exactly like an unset variable. Check the secret names
> match: `az containerapp secret list -n $APP -g $RG -o table`

---

## Reading logs

```bash
# Application stdout/stderr — this is where startup errors appear
az containerapp logs show -n $APP -g $RG --type console --tail 100

# Follow live
az containerapp logs show -n $APP -g $RG --type console --follow

# Platform events (image pull failures, probe failures, OOM kills)
az containerapp logs show -n $APP -g $RG --type system --tail 50
```

If the app is crash-looping, `--follow` may attach to a dead replica. Pin to a revision:

```bash
az containerapp revision list -n $APP -g $RG -o table
az containerapp logs show -n $APP -g $RG --revision <revision-name> --type console --tail 100
```

---

## Full environment variable reference

### Required in production

Store all three as secrets, never as plain env vars:

```bash
az containerapp secret set -n $APP -g $RG --secrets \
  database-url="postgresql://user:pass@myserver.postgres.database.azure.com:5432/btsgrc?sslmode=require" \
  auth-secret="$(openssl rand -base64 32)" \
  cron-secret="$(openssl rand -hex 32)"

az containerapp update -n $APP -g $RG --set-env-vars \
  DATABASE_URL=secretref:database-url \
  AUTH_SECRET=secretref:auth-secret \
  CRON_SECRET=secretref:cron-secret
```

Azure Database for PostgreSQL requires `?sslmode=require` in the connection string, and the
server's firewall must allow Azure services (or the Container App's outbound IPs).

### Optional

| Variable | Default | Purpose |
|---|---|---|
| `AUTH_URL` | — | Public base URL, e.g. `https://grc.example.com`. Set this if auth callbacks land on the wrong host. |
| `SEED_ON_STARTUP` | `false` | Seeds frameworks + demo data. The app also self-seeds when the DB has no users. Remove after first boot. |
| `EMAIL_PROVIDER` | `console` | `sendgrid`, `ses`, or `console`. **`console` mode shows password-reset links on screen** — do not leave it on a public deployment. |
| `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` | — | Sender identity. |
| `SENDGRID_API_KEY` | — | Required when `EMAIL_PROVIDER=sendgrid`. Use a secret. |
| `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY` | — | Required when `EMAIL_PROVIDER=ses`. Use secrets. |
| `ENABLE_MALWARE_SCAN`, `CLAMAV_HOST`, `CLAMAV_PORT` | off | ClamAV evidence scanning; needs a reachable ClamAV service. |
| `WORKER_ENABLED` | `true` | Set `false` to disable in-process background workers. |
| `WORKER_INTERVAL` | `30000` | Worker tick, in milliseconds. |

> `docker-compose.yml` spells two of these differently (`ENABLE_CLAMAV`, `NEXTAUTH_URL`). The app
> reads **`ENABLE_MALWARE_SCAN`** and **`AUTH_URL`**. Use the names in this table — the Compose
> spellings are silently ignored.

---

## Ingress and scaling

### Port

The container listens on **3000**.

```bash
az containerapp ingress update -n $APP -g $RG --type external --target-port 3000
```

Images built from `9c4f65f` onward set `HOSTNAME=0.0.0.0` themselves. **On an older image you must
set it manually**, or the server binds `localhost`, health probes fail, and the revision never goes
healthy — a failure that looks nothing like a config problem:

```bash
az containerapp update -n $APP -g $RG --set-env-vars HOSTNAME=0.0.0.0 PORT=3000
```

### Scaling — pin to a single replica

```bash
az containerapp update -n $APP -g $RG --min-replicas 1 --max-replicas 1
```

Both halves of this matter:

- **`--max-replicas 1`** — every replica runs its own in-process background workers *and* runs
  `prisma db push` against the shared database at startup. Two replicas means duplicate worker
  runs (double emails, double SLA processing) and concurrent schema pushes racing each other.
- **`--min-replicas 1`** — the default scale-to-zero stops the background workers when there is no
  HTTP traffic. Evidence-request reminders and SLA breach detection silently stop running.

If you need real horizontal scaling, set `WORKER_ENABLED=false` and drive the work through the cron
endpoints instead (below).

---

## Building and deploying a new image

Pick whichever path matches how you already build. All of them end with a new tag; the deploy step
is the same for each.

### Path A — ACR builds it (no local Docker)

```bash
az acr build --registry $ACR --image btsgrc:$TAG .
```

### Path B — build locally, push to ACR

```bash
az acr login --name $ACR
docker build -t $IMAGE:$TAG .
docker push $IMAGE:$TAG
```

### Path C — build and deploy in one step

```bash
az containerapp up -n $APP -g $RG --source . --ingress external --target-port 3000
```

Convenient, but it can reset configuration you set by hand. Prefer A or B for an app that already
exists.

### Deploy the new tag (paths A and B)

```bash
az containerapp update -n $APP -g $RG --image $IMAGE:$TAG
```

If the Container App cannot pull from ACR, grant it access once:

```bash
az containerapp registry set -n $APP -g $RG \
  --server $ACR.azurecr.io --identity system
```

Then watch it come up:

```bash
az containerapp logs show -n $APP -g $RG --type console --follow
```

---

## Better diagnostics (requires a rebuild)

Images built from `9c4f65f` onward fail loudly and by name. Instead of the opaque instrumentation
stack trace, the **first thing** in the container log is:

```
ERROR: the app cannot start — required environment variables are missing or invalid:

  CRON_SECRET   is not set. Generate one with: openssl rand -hex 32
```

This check lives inside the image (in the entrypoint), so **pulling the repo is not enough — you
must rebuild and redeploy** to get it. It does not fix a broken deployment; it explains the next
one. If you are down right now, set the variable first and rebuild at your leisure.

---

## Scheduling cron jobs

Nothing calls the cron endpoints for you on Container Apps. Without a scheduler, evidence-request
reminders and SLA breach detection never run. Each endpoint takes the `CRON_SECRET` as a bearer
token.

Create a Container Apps Job per endpoint:

```bash
FQDN=$(az containerapp show -n $APP -g $RG --query properties.configuration.ingress.fqdn -o tsv)

az containerapp job create \
  -n btsgrc-cron-sla -g $RG \
  --environment <your-container-apps-environment> \
  --trigger-type Schedule --cron-expression "5 8 * * *" \
  --image mcr.microsoft.com/azure-cli:latest \
  --secrets cron-secret="<same value as the app's CRON_SECRET>" \
  --env-vars CRON_SECRET=secretref:cron-secret \
  --command "/bin/sh" \
  --args "-c","curl -fsS -X POST -H \"Authorization: Bearer \$CRON_SECRET\" https://$FQDN/api/cron/finding-sla-breach"
```

Repeat for the other two endpoints, staggering the cron expressions:

| Endpoint | Suggested schedule |
|---|---|
| `/api/cron/evidence-request-reminders` | `0 8 * * *` |
| `/api/cron/finding-sla-breach` | `5 8 * * *` |
| `/api/cron/treatment-sla-breach` | `10 8 * * *` |

Test one by hand first:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://$FQDN/api/cron/finding-sla-breach
# {"success":true,"processedCount":0,"breachedCount":0,"errors":[]}
```

A `401` means the job's `CRON_SECRET` does not match the app's.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `Invalid environment variables` in an instrumentation-hook stack trace | A required var is missing. On older images it is not named — assume `CRON_SECRET`. See [Emergency](#emergency-the-container-wont-start). |
| Container starts, then the revision never goes healthy | Health probe cannot reach the app. Ingress target port must be **3000**, and `HOSTNAME=0.0.0.0` must be set on older images. |
| Prisma connection errors at startup | `DATABASE_URL` is wrong, missing `?sslmode=require`, or the Postgres firewall blocks the Container App. |
| App is healthy but reminders/SLA never fire | No scheduler is hitting `/api/cron/*`, or the app scaled to zero. Set `--min-replicas 1`. |
| Duplicate emails, SLA flags flipping twice | More than one replica running background workers. Set `--max-replicas 1`. |
| `401` from a cron endpoint | The caller's `CRON_SECRET` does not match the app's. |
| Password-reset links appear on screen | `EMAIL_PROVIDER=console`. Configure `sendgrid` or `ses`. |
| Deployed a new image but nothing changed | You reused a tag. Container Apps keys revisions off the image reference — use a new tag. |

---

## Known gap

This repository contains **no Azure infrastructure-as-code** — no Bicep, no `azure.yaml`, no
pipeline. The Container App's configuration lives only in Azure. That is precisely why
`CRON_SECRET` was never propagated when it became required: there was no file to update. Until
that changes, **any newly required environment variable must be added to the Container App by
hand**, and this document is the only place that records the contract.
