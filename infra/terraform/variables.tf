variable "subscription_id" {
  description = "Azure subscription to deploy into."
  type        = string
}

variable "resource_group_name" {
  description = "Deploy into this existing resource group (e.g. one prepared by the training provider). null creates a new one."
  type        = string
  default     = null
}

variable "register_resource_providers" {
  description = "Let azurerm register resource providers at subscription scope. Set false when you are Owner only on a resource group."
  type        = bool
  default     = true
}

variable "location" {
  description = "Azure region for all resources, e.g. ukwest. null: westeurope for a new resource group, or the existing group's region. Unity Catalog allows one metastore per region."
  type        = string
  default     = null
}

variable "prefix" {
  description = "Short lowercase prefix for all resource names (a random suffix is appended)."
  type        = string
  default     = "dbxfund"

  validation {
    condition     = can(regex("^[a-z][a-z0-9]{2,11}$", var.prefix))
    error_message = "prefix must be 3-12 lowercase letters/digits, starting with a letter (it feeds the storage account name)."
  }
}

variable "tags" {
  description = "Extra tags applied to every Azure resource."
  type        = map(string)
  default     = {}
}

variable "workspace_sku" {
  description = "Workspace pricing tier. Unity Catalog requires premium."
  type        = string
  default     = "premium"

  validation {
    condition     = contains(["premium", "trial"], var.workspace_sku)
    error_message = "Unity Catalog needs the premium tier (or trial, which is premium for 14 days)."
  }
}

variable "storage_container_name" {
  description = "ADLS Gen2 container backing the external location."
  type        = string
  default     = "training"
}

variable "catalog_name" {
  description = "Catalog created on the external location. retailhub_trainer matches what 00_setup expects for the trainer account."
  type        = string
  default     = "retailhub_trainer"
}

variable "schemas" {
  description = "Medallion schemas created in the catalog. The `default` schema is declared separately in unity_catalog.tf — do not list it."
  type        = list(string)
  default     = ["bronze", "silver", "gold"]
}

# ── Participants and compute ─────────────────────────────────────────────────

variable "participants" {
  description = "E-mails of this training's participants. They must exist in the workspace's Entra ID tenant. Change per training and apply again."
  type        = set(string)
  default     = []
}

variable "training_group_name" {
  description = "Workspace group holding the trainer and all participants. Must match TRAINING_GROUP in notebooks/setup/00_pre_config."
  type        = string
  default     = "alt_trn_gr"
}

variable "trainer_cluster_node_type" {
  description = "VM size of the trainer's single-node cluster. Lab subscriptions often have low vCPU quotas — keep it small."
  type        = string
  default     = "Standard_D4ds_v5"
}

variable "trainer_cluster_autotermination_minutes" {
  type    = number
  default = 30
}

variable "catalog_force_destroy" {
  description = "Allow `terraform destroy` to drop the catalog even when it still contains schemas and tables."
  type        = bool
  default     = false
}

# ── Optional, account-level ──────────────────────────────────────────────────

variable "databricks_account_id" {
  description = "Azure Databricks account ID (account console, top right). Needed only for metastore_id or create_analysts_group."
  type        = string
  default     = null
}

variable "metastore_id" {
  description = "Assign this metastore explicitly. Leave null when the region's metastore auto-assigns new workspaces (default for accounts created after 9 Nov 2023)."
  type        = string
  default     = null
}

variable "create_analysts_group" {
  description = "Create the account group used by the M06 GRANT/REVOKE demo. Requires account admin."
  type        = bool
  default     = false
}

variable "analysts_group_name" {
  description = "Must match ANALYSTS_GROUP in notebooks/setup/00_setup and 00_pre_config."
  type        = string
  default     = "retailhub_analysts"
}
