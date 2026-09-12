# ─────────────────────────────────────────────────────────────────────────────
# Workspace users: the trainer (whoever runs Terraform) plus var.participants.
#
# The trainer is not declared here — the identity running Terraform is
# provisioned as workspace admin automatically on its first API call.
#
# The group is workspace-level on purpose: it needs no account admin, and
# 00_pre_config only reads its members to create one catalog per person and
# grants to the users themselves. It is NOT the retailhub_analysts group of
# the M06 demo, which must be an account group (see account.tf).
# ─────────────────────────────────────────────────────────────────────────────

data "databricks_current_user" "trainer" {}

resource "databricks_user" "participant" {
  for_each = var.participants

  user_name = each.value

  # A participant who opened the workspace before apply already exists
  # (Contributor on the resource group auto-provisions them) — adopt them.
  force = true
}

resource "databricks_group" "training" {
  display_name = var.training_group_name
}

resource "databricks_group_member" "trainer" {
  group_id  = databricks_group.training.id
  member_id = data.databricks_current_user.trainer.id
}

resource "databricks_group_member" "participant" {
  for_each = databricks_user.participant

  group_id  = databricks_group.training.id
  member_id = each.value.id
}
