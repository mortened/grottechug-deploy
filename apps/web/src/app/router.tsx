import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./Layout";
import { WheelPage } from "../pages/WheelPage";
import { ChugListPage } from "../pages/ChugListPage";
import { RulesPage } from "../pages/RulesPage";
import { LeaderboardPage } from "../pages/LeaderboardPage";
import { PersonPage } from "../pages/PersonPage";
import { StatsDashboardPage } from "../pages/StatsDashboardPage";
import { GrottaPage } from "../pages/GrottaPage";
import { ViolationsPage } from "../pages/ViolationsPage";
import { HomePage } from "../pages/HomePage";
import { SessionPage } from "../pages/SessionPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "wheel", element: <WheelPage /> },
      { path: "chug", element: <ChugListPage /> },
      { path: "rules", element: <RulesPage /> },
      { path: "leaderboard", element: <LeaderboardPage /> },
      { path: "person/:id", element: <PersonPage /> },
      { path: "stats", element: <StatsDashboardPage /> },
      { path: "grotta", element: <GrottaPage /> },
      { path: "violations", element: <ViolationsPage /> },
      { path: "session/:id", element: <SessionPage /> },
    ]
  }
]);