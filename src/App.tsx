import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect } from "react";
import { bindActionCreators } from "redux";
import * as actionCreators from "./store/actions/appActions";
import "./App.css";
import app from "./firebaseConfig";
import { useDispatch } from "react-redux";
import Main from "./layout/MainLayout";
import TableView from "./pages/TableView";
import { Routes, Route, HashRouter } from "react-router-dom";
import AddGame from "./pages/AddGame";
import CardView from "./pages/CardView";
import LetterView from "./pages/LetterView";

const App: React.FC = () => {
  const dispatch = useDispatch();
  const { retrieveGames } = bindActionCreators(actionCreators, dispatch);

  useEffect(() => {
    const docRef = doc(app, "main", "allGames");
    getDoc(docRef).then((data) => {
      if (data.exists()) {
        retrieveGames(data.data());
      } else {
        console.log("No such document!");
      }
    });
  }, []);

  const removeEntry = async (uuid: any) => {
    console.log(uuid);
    const docRef = doc(app, "main", "allGames");
    await updateDoc(docRef, {
      [uuid]: deleteField(),
    });
  };

  return (
    <div className="App min-h-screen bg-sand font-pixel">
      <HashRouter>
        <Main>
          <Routes>
            <Route path="create" element={<AddGame />} />
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
