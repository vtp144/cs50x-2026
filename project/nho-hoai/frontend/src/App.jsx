import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Decks from "./pages/Decks";
import DeckDetail from "./pages/DeckDetail";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/decks" replace />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/decks"
        element={
          <ProtectedRoute>
            <Decks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/decks/:id"
        element={
          <ProtectedRoute>
            <DeckDetail />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/decks" replace />} />
    </Routes>
  );
}
