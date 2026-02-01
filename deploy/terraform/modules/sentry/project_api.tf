resource "sentry_project" "api" {
  organization = var.organization_slug
  teams        = [sentry_team.main.id]
  name         = "${var.project_name}-api"
  slug         = "${var.project_slug}-api"
  platform     = "bun"

  default_rules = true
}

resource "sentry_key" "api" {
  organization = var.organization_slug
  project      = sentry_project.api.id
  name         = "Production"
}
