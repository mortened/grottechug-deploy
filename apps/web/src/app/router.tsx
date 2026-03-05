import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./Layout";
import { WheelPage } from "../pages/WheelPage";
import { ChugListPage } from "../pages/ChugListPage";
import { RulesPage } from "../pages/RulesPage";
import { LeaderboardPage } from "../pages/LeaderboardPage";
import { PersonPage } from "../pages/PersonPage";
import { StatsDashboardPage } from "../pages/StatsDashboardPage";
import { GrottaPage } from "../pages/GrottaPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <WheelPage /> },
      { path: "wheel", element: <WheelPage /> },
      { path: "chug", element: <ChugListPage /> },
      { path: "rules", element: <RulesPage /> },
      { path: "leaderboard", element: <LeaderboardPage /> },
      { path: "person/:id", element: <PersonPage /> },
      { path: "stats", element: <StatsDashboardPage /> },
      { path: "grotta", element: <GrottaPage /> }
    ]
  }
]);