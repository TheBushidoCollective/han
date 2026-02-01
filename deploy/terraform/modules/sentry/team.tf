resource "sentry_team" "main" {
  organization = var.organization_slug
  name         = var.team_name
  slug         = var.team_slug
}
