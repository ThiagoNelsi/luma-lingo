import { readApiOrigin } from "./config/api-origin.js";
import { AppRoutes } from "./routes/app-routes.js";

export function App() {
  const apiOrigin = readApiOrigin(import.meta.env.VITE_API_ORIGIN);
  return <AppRoutes apiOrigin={apiOrigin} />;
}
