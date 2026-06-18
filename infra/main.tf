provider "aws" {
  alias  = "application"
  region = var.aws_region
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge({
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }, aws_servicecatalogappregistry_application.luma_lingo.application_tag)
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "aws_servicecatalogappregistry_application" "luma_lingo" {
  provider = aws.application

  name        = "LumaLingo"
  description = "LumaLingo is a language learning app that uses AI to create personalized learning paths for users."
}
