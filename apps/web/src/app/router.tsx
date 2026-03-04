import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./Layout";
import { WheelPage } from "../pages/WheelPage";
import { ChugListPage } from "../pages/ChugListPage";
import { RulesPage } from "../pages/RulesPage";
import { ViolationsPage } from "../pages/ViolationsPage";
import { GuestsPage } from "../pages/GuestsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <WheelPage /> },
      { path: "wheel", element: <WheelPage /> },
      { path: "chug", element: <ChugListPage /> },
      { path: "rules", element: <RulesPage /> },
      { path: "violations", element: <ViolationsPage /> },
      { path: "guests", element: <GuestsPage /> },
    ]
  }
]);