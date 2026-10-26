import React from "react";
import "./App.css";
import Main from "./layout/MainLayout";
import TableView from "./pages/TableView";
import { Routes, Route, HashRouter } from "react-router-dom";
import AddGame from "./pages/AddGame";
import EditGame from "./pages/EditGame";
import CardView from "./pages/CardView";
import Settings from "./pages/Settings";
import useResizeObserver from "./hooks/useResizeObserver";

const App: React.FC = () => {

  const [ref, headerRect] = useResizeObserver();

  return (
    <div className="App min-h-screen bg-sand font-pixel">
      <HashRouter>
        <Main ref={ref}>
          <Routes>
            <Route path="create" element={<AddGame />} />
            <Route path="edit/:id" element={<EditGame />} />
            <Route path="/" element={<TableView headerRect={headerRect} />} />
            <Route path="card" element={<CardView />} />
            <Route path="settings" element={<Settings />} />
          </Routes>
        </Main>
      </HashRouter>
    </div>
  );
};

export default App;
