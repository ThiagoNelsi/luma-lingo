export function renderPublicRouteText(): string {
  return "public route";
}

export function PublicPage() {
  return <main>{renderPublicRouteText()}</main>;
}
