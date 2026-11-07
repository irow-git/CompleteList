import React from "react";
import "./App.css";
import Main from "./layout/MainLayout";
import TableView from "./pages/TableView";
import { Routes, Route, HashRouter } from "react-router-dom";
import AddGame from "./pages/AddGame";
import EditGame from "./pages/EditGame";
import CardView from "./pages/CardView";
import Settings from "./pages/Settings";
import SeriesView from "./pages/SeriesView";
import EditSeries from "./pages/EditSeries";
import GameDetails from "./pages/GameDetails";

const App: React.FC = () => {
  return (
    <div className="App min-h-screen bg-sand font-pixel">
      <HashRouter>
        <Main>
          <Routes>
            <Route path="create" element={<AddGame />} />
            <Route path="edit/:id" element={<EditGame />} />
            <Route path="/" element={<TableView />} />
            <Route path="card" element={<CardView />} />
            <Route path="series" element={<SeriesView />} />
            <Route path="series/new" element={<EditSeries />} />
            <Route path="series/edit/:name" element={<EditSeries />} />
            <Route path="game/:id" element={<GameDetails />} />
            <Route path="settings" element={<Settings />} />
          </Routes>
        </Main>
      </HashRouter>
    </div>
  );
};

export default App;
