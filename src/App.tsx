import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { LibraryPage } from "@/features/library/library-page";
import { GamePage } from "@/features/library/game-page";
import { CategoriesPage } from "@/features/categories/categories-page";
import { GoalsPage } from "@/features/goals/goals-page";
import { StatsPage } from "@/features/stats/stats-page";
import { SettingsPage } from "@/features/settings/settings-page";

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<LibraryPage />} />
          <Route path="status/:status" element={<LibraryPage />} />
          <Route path="category/:categoryId" element={<LibraryPage />} />
          <Route path="game/:id" element={<GamePage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
