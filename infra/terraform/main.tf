# ─────────────────────────────────────────────────────────────────────────────
# Azure layer: resource group, workspace, ADLS Gen2, Access Connector, RBAC.
# This is the same chain the course walks through by hand in
# utilization/external_connection.ipynb (steps 1–2).
# ─────────────────────────────────────────────────────────────────────────────

resource "random_string" "suffix" {
  length  = 5
  upper   = false
  special = false
}

locals {
  name = "${var.prefix}-${random_string.suffix.result}"

  # Storage account names: 3-24 chars, lowercase letters and digits only.
  storage_account_name = "${var.prefix}${random_string.suffix.result}st"

  # abfss root of the training container, without a trailing slash, so that
  # 00_pre_config's f"{STORAGE_LOCATION}/{catalog}" yields clean paths.
  container_url = "abfss://${azurerm_storage_container.training.name}@${azurerm_storage_account.this.name}.dfs.core.windows.net"

  tags = merge({
    project    = "databricks-fundamental"
    managed_by = "terraform"
  }, var.tags)
}

# Either create a resource group, or deploy into one prepared by the training
# provider (typical for lab tenants, where the trainer is Owner only on that RG).
resource "azurerm_resource_group" "this" {
  count    = var.resource_group_name == null ? 1 : 0
  name     = "rg-${local.name}"
  location = coalesce(var.location, "westeurope")
  tags     = local.tags
}

data "azurerm_resource_group" "existing" {
  count = var.resource_group_name == null ? 0 : 1
  name  = var.resource_group_name
}

locals {
  rg_name = var.resource_group_name == null ? azurerm_resource_group.this[0].name : data.azurerm_resource_group.existing[0].name
  # A resource group's region is only metadata — its resources may live elsewhere.
  rg_location = coalesce(var.location, var.resource_group_name == null ? azurerm_resource_group.this[0].location : data.azurerm_resource_group.existing[0].location)
}

resource "azurerm_databricks_workspace" "this" {
  name                        = "dbw-${local.name}"
  resource_group_name         = local.rg_name
  location                    = local.rg_location
  sku                         = var.workspace_sku
  managed_resource_group_name = "rg-${local.name}-managed"
  tags                        = local.tags
}

# Managed identity Unity Catalog uses to reach the storage account.
resource "azurerm_databricks_access_connector" "this" {
  name                = "ac-${local.name}"
  resource_group_name = local.rg_name
  location            = local.rg_location
  tags                = local.tags

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_storage_account" "this" {
  name                            = local.storage_account_name
  resource_group_name             = local.rg_name
  location                        = local.rg_location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  account_kind                    = "StorageV2"
  is_hns_enabled                  = true # ADLS Gen2 — required for abfss://
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  tags                            = local.tags
}

# storage_account_id (not _name) goes through the management plane, so the
# deploying identity needs no data-plane permissions on the account.
resource "azurerm_storage_container" "training" {
  name                  = var.storage_container_name
  storage_account_id    = azurerm_storage_account.this.id
  container_access_type = "private"
}

# Contributor, not Reader: the catalog's managed tables are written here.
# The course's external_connection guide recommends Reader for read-only
# production sources — this container is a managed location, so it needs write.
resource "azurerm_role_assignment" "connector_blob_contributor" {
  scope                = azurerm_storage_account.this.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_databricks_access_connector.this.identity[0].principal_id
}

# Azure RBAC takes a while to propagate. Without the wait, Unity Catalog's
# validation of the external location fails on the first apply.
resource "time_sleep" "rbac_propagation" {
  depends_on      = [azurerm_role_assignment.connector_blob_contributor]
  create_duration = "90s"
}
