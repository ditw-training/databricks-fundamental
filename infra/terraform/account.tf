# ─────────────────────────────────────────────────────────────────────────────
# Optional: the account group used by the M06 GRANT/REVOKE demo.
#
# It has to be an ACCOUNT group. The workspace-level databricks_group resource,
# the Workspace Groups API and SQL CREATE GROUP all create workspace-local
# groups, which Unity Catalog cannot grant to (PRINCIPAL_DOES_NOT_EXIST).
# Hence the account provider — and the account admin requirement.
# ─────────────────────────────────────────────────────────────────────────────

resource "databricks_group" "analysts" {
  count    = var.create_analysts_group ? 1 : 0
  provider = databricks.account

  display_name = var.analysts_group_name

  lifecycle {
    precondition {
      condition     = var.databricks_account_id != null
      error_message = "create_analysts_group = true requires databricks_account_id."
    }
  }
}

# Makes the group visible (and addable-to) in the workspace admin settings.
resource "databricks_mws_permission_assignment" "analysts" {
  count    = var.create_analysts_group ? 1 : 0
  provider = databricks.account

  workspace_id = azurerm_databricks_workspace.this.workspace_id
  principal_id = databricks_group.analysts[0].id
  permissions  = ["USER"]
}
