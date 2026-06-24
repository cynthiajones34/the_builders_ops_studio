import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createHashRouter, Navigate } from "react-router-dom";
import "./index.css";
import Shell from "./components/Shell";
import AuthGate from "./components/AuthGate";
import { AuthProvider } from "./lib/AuthContext";
import { sections } from "./nav";

// Hash routing (/admin/#/dashboard) so the portal works on GitHub Pages, which
// has no server-side SPA rewrite. Every route loads /admin/index.html and the
// hash carries the route, so deep links and refreshes never 404.
const router = createHashRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      ...sections.map((s) => ({ path: s.path.slice(1), element: <s.Component /> })),
      { path: "*", element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthGate>
        <RouterProvider router={router} />
      </AuthGate>
    </AuthProvider>
  </React.StrictMode>
);
