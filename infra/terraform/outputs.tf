output "workspace_url" {
  description = "Open this in the browser."
  value       = "https://${azurerm_databricks_workspace.this.workspace_url}"
}

output "workspace_id" {
  value = azurerm_databricks_workspace.this.workspace_id
}

output "storage_location" {
  description = "Paste into STORAGE_LOCATION in notebooks/setup/00_pre_config.ipynb."
  value       = local.container_url
}

output "catalog_name" {
  value = databricks_catalog.training.name
}

output "external_location_name" {
  value = databricks_external_location.training.name
}

output "trainer_cluster_id" {
  description = "For the Databricks CLI / jobs submit."
  value       = databricks_cluster.trainer.id
}

output "training_group" {
  description = "Set as TRAINING_GROUP in 00_pre_config."
  value       = databricks_group.training.display_name
}

output "participants" {
  value = sort(tolist(var.participants))
}

output "analysts_group" {
  description = "null when create_analysts_group = false — create the group in the workspace UI instead."
  value       = var.create_analysts_group ? databricks_group.analysts[0].display_name : null
}
