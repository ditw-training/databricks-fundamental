# Training environment — Terraform

Builds a complete Azure Databricks environment for the Databricks Fundamental course:

```
Resource group
├── Databricks workspace (premium — Unity Catalog)
├── Access Connector (system-assigned managed identity)
└── Storage account, ADLS Gen2
    └── container "training"  ◄── Storage Blob Data Contributor → Access Connector

Unity Catalog (in the new workspace)
├── Storage credential   → Access Connector
├── External location    → abfss://training@<account>.dfs.core.windows.net/
└── Catalog retailhub_trainer  (managed location on that external location)
    ├── bronze · silver · gold
    └── default
        └── volume "datasets"

Optional, account level
├── Metastore assignment        (only if new workspaces are not auto-assigned)
└── Account group retailhub_analysts  (for the M06 GRANT/REVOKE demo)
```

It is the same chain `utilization/external_connection.ipynb` teaches by clicking — Access Connector,
RBAC, storage credential, external location — expressed as code.

## Prerequisites

| What | Why |
|---|---|
| `az login` to the target tenant | Both providers authenticate through your Azure session — **no Databricks tokens and no passwords** go into this code |
| **Owner** or **User Access Administrator** on the subscription | The Access Connector's role assignment on the storage account. *Contributor is not enough.* |
| Azure Databricks **account admin** | Only for the optional parts (`metastore_id`, `create_analysts_group`) |

Service principal instead of `az login`: export `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_TENANT_ID`
and `ARM_SUBSCRIPTION_ID` in your own shell. Never commit them, never paste them into a chat.

## Run

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # set subscription_id, optionally location/prefix
terraform init
terraform plan -out tfplan                     # read it before applying
terraform apply tfplan
```

### Lab tenant — prepared resource group, changing participants

When the training provider hands you a resource group where you are Owner (and nothing at
subscription scope), set in `terraform.tfvars`:

```hcl
resource_group_name         = "DBX-FE_140926"
register_resource_providers = false          # you cannot register providers at subscription scope
participants = ["student501@<tenant>.onmicrosoft.com", ...]
```

Log in as the trainer account of that tenant first (`az login --tenant <tenant>.onmicrosoft.com`).
For the next training, replace `participants` and run `plan`/`apply` again — users removed from
the list are removed from the workspace and from the training group.

Terraform also creates the workspace group `training_group_name` (trainer + participants, read by
`00_pre_config`) and a shared autoscaling training cluster in standard access mode (Standard_DS3_v2 workers, 2–10, Standard_D4ds_v5 driver) — the group can restart it
(`terraform output -raw training_cluster_id`).
Participants with Contributor on the resource group become workspace admins when they first log in —
that is Azure's behaviour, not something this code grants.

First apply takes ~10 minutes: the workspace is the slow part, plus a deliberate 90-second wait
for Azure RBAC to propagate before Unity Catalog validates the external location.

## After apply — connect it to the course

1. **`STORAGE_LOCATION`** in `notebooks/setup/00_pre_config.ipynb` ← `terraform output -raw storage_location`
2. **Analysts group** — if you left `create_analysts_group = false`, create `retailhub_analysts` in the
   workspace: Settings → Identity and access → Groups → Add Group → Add new.
   Do **not** use SQL `CREATE GROUP` — it creates a workspace-local group Unity Catalog cannot grant to.
3. Clone the repo into the workspace (Git folders), set `TRAINING_GROUP`, and run `00_pre_config`.
   It creates the per-participant catalogs under the same external location; Step 2b checks the group.

`catalog_name` defaults to `retailhub_trainer` — the catalog `00_setup` maps the trainer account to —
so `00_pre_config`'s `CREATE CATALOG IF NOT EXISTS` simply finds it.

## Metastore — do I need `metastore_id`?

Usually not. A new workspace is attached automatically when the region's metastore has
auto-assignment enabled, which is the default for accounts created after 9 November 2023.
Check after apply: in the workspace, `SHOW CATALOGS` must return catalogs. If it errors with
"Unity Catalog is not enabled", set `databricks_account_id` and `metastore_id` and apply again.

## Cost

The workspace itself costs nothing until compute runs; the storage account costs cents per month
at training volumes. **Compute (clusters, SQL warehouses, serverless) is what you pay for** — stop it
when the training ends.

## Tear down

```bash
terraform destroy
```

The catalog refuses to drop while it still holds schemas and tables. After a training, either set
`catalog_force_destroy = true` and apply once before destroying, or run the cleanup section of
`00_pre_config` first. Participant catalogs created by `00_pre_config` are **not** managed by
Terraform — drop them with that cleanup section, or `destroy` will fail on the external location
still being in use.

## State

State is local (`terraform.tfstate`, git-ignored). It contains resource IDs; keep it off shared drives.
For a team, move it to an Azure Storage backend (`backend "azurerm"`) — not needed for a single trainer.
