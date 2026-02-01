resource "sentry_project" "website" {
  organization = var.organization_slug
  teams        = [sentry_team.main.id]
  name         = "${var.project_name}-website"
  slug         = "${var.project_slug}-website"
  platform     = "javascript-nextjs"

  default_rules = true
}

resource "sentry_key" "website" {
  organization = var.organization_slug
  project      = sentry_project.website.id
  name         = "Production"
}
