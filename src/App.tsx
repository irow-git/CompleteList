import React, { useEffect } from "react";
import "./App.css";
import { useGamesStore } from "./store/gamesStore";
import Main from "./layout/MainLayout";
import TableView from "./pages/TableView";
import { Routes, Route, HashRouter } from "react-router-dom";
import AddGame from "./pages/AddGame";
import EditGame from "./pages/EditGame";
import CardView from "./pages/CardView";
import LetterView from "./pages/LetterView";

const App: React.FC = () => {
  const loadPage = useGamesStore((state) => state.loadPage);

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  return (
    <div className="App min-h-screen bg-sand font-pixel">
      <HashRouter>
        <Main>
          <Routes>
            <Route path="create" element={<AddGame />} />
            <Route path="edit/:id" element={<EditGame />} />
            <Route path="/" element={<TableView />} />
            <Route path="card" element={<CardView />} />
            <Route path="letter" element={<LetterView />} />
          </Routes>
        </Main>
      </HashRouter>
    </div>
  );
};

export default App;
