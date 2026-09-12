provider "azurerm" {
  subscription_id = var.subscription_id

  # By default azurerm registers resource providers at subscription scope, which
  # fails for a trainer who is Owner on a single resource group. Microsoft.Databricks
  # and Microsoft.Storage must then already be registered by the subscription owner.
  resource_provider_registrations = var.register_resource_providers ? "core" : "none"

  features {}
}

# Workspace-level provider — Unity Catalog objects inside the new workspace.
# Authenticates through the same Azure identity as azurerm (your `az login`
# session, or ARM_* environment variables). No Databricks tokens involved.
provider "databricks" {
  host                        = "https://${azurerm_databricks_workspace.this.workspace_url}"
  azure_workspace_resource_id = azurerm_databricks_workspace.this.id
}

# Account-level provider — used only by the optional metastore assignment and
# the optional analysts group. Requires Azure Databricks account admin.
provider "databricks" {
  alias      = "account"
  host       = "https://accounts.azuredatabricks.net"
  account_id = var.databricks_account_id
}
