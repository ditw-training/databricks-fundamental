# ─────────────────────────────────────────────────────────────────────────────
# Unity Catalog layer: storage credential -> external location -> catalog.
# Same as external_connection.ipynb steps 3–5, plus the catalog on top.
# ─────────────────────────────────────────────────────────────────────────────

# Only when the region's metastore does not auto-assign new workspaces.
resource "databricks_metastore_assignment" "this" {
  count    = var.metastore_id == null ? 0 : 1
  provider = databricks.account

  workspace_id = azurerm_databricks_workspace.this.workspace_id
  metastore_id = var.metastore_id

  lifecycle {
    precondition {
      condition     = var.databricks_account_id != null
      error_message = "metastore_id is set, so databricks_account_id is required (the assignment is an account-level operation)."
    }
  }
}

resource "databricks_storage_credential" "this" {
  name    = "sc-${local.name}"
  comment = "Access Connector ${azurerm_databricks_access_connector.this.name} — managed by Terraform"

  azure_managed_identity {
    access_connector_id = azurerm_databricks_access_connector.this.id
  }

  depends_on = [databricks_metastore_assignment.this]
}

resource "databricks_external_location" "training" {
  name            = "el-${local.name}"
  url             = "${local.container_url}/"
  credential_name = databricks_storage_credential.this.name
  comment         = "Training container — managed location for the training catalogs"

  depends_on = [time_sleep.rbac_propagation]
}

resource "databricks_catalog" "training" {
  name          = var.catalog_name
  storage_root  = "${local.container_url}/${var.catalog_name}"
  comment       = "Databricks Fundamental training catalog — managed by Terraform"
  force_destroy = var.catalog_force_destroy

  depends_on = [databricks_external_location.training]
}

resource "databricks_schema" "medallion" {
  for_each = toset(var.schemas)

  catalog_name = databricks_catalog.training.name
  name         = each.value
  comment      = "Medallion layer: ${each.value}"
}

# A catalog created through the API gets only information_schema, so `default`
# has to be declared here (00_pre_config and 00_setup expect it).
resource "databricks_schema" "default" {
  catalog_name = databricks_catalog.training.name
  name         = "default"
  comment      = "Default schema: holds the datasets volume"
}

resource "databricks_volume" "datasets" {
  name         = "datasets"
  catalog_name = databricks_catalog.training.name
  schema_name  = databricks_schema.default.name
  volume_type  = "MANAGED"
  comment      = "Training datasets for the RetailHub project"
}
