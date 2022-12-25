import {
  deleteField,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect } from "react";
import { bindActionCreators } from "redux";
import * as actionCreators from "./store/actions/appActions";
import "./App.css";
import app from "./firebaseConfig";
import Home from "./pages/Home";
import { useDispatch, useSelector } from "react-redux";
import { State } from "./store/reducers/rootReducer";
import { IGame } from "./interfaces";


const App: React.FC = () => {

  const { v4: uuidv4 } = require('uuid');

  const reduxItems: IGame[] = useSelector(
    (state: State) => state.gameReducer.games
  );

  const dispatch = useDispatch();
  const { retrieveItems } = bindActionCreators(actionCreators, dispatch);

  useEffect(() => {
    const docRef = doc(app, "main", "allGames");
    getDoc(docRef).then((data) => {
      if (data.exists()) {
        retrieveItems(data.data());
      } else {
        console.log("No such document!");
      }
    });
  }, []);

  console.log("reduxItems: ", reduxItems);

  const addEntry = async () => {
    const docRef = doc(app, "main", "allGames");
    await updateDoc(docRef, {
      [uuidv4()]: { name: "CSGO" }
    })
    .catch((error) => console.log(error));
  };

  const removeEntry = async (uuid: any) => {
    console.log(uuid)
    const docRef = doc(app, "main", "allGames");
    await updateDoc(docRef, {
      [uuid]: deleteField()
    })
  };

  return (
    <div className="App">
      <Home />
      <button onClick={() => addEntry()}>
        Add
      </button>
      <button
        onClick={() => removeEntry("2333b6fd-0770-4e18-b22c-1a144c19bae5")}
      >
        Delete
      </button>
    </div>
  );
};

export default App;
