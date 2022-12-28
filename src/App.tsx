import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect } from "react";
import { bindActionCreators } from "redux";
import * as actionCreators from "./store/actions/appActions";
import "./App.css";
import app from "./firebaseConfig";
import Home from "./pages/Home";
import { useDispatch } from "react-redux";
import { Box } from "@mui/material";
import Main from "./layout/MainLayout";

const App: React.FC = () => {
  const { v4: uuidv4 } = require("uuid");

  const dispatch = useDispatch();
  const { retrieveItems } = bindActionCreators(actionCreators, dispatch);

  // useEffect(() => {
  //   const docRef = doc(app, "main", "allGames");
  //   getDoc(docRef).then((data) => {
  //     if (data.exists()) {
  //       retrieveItems(data.data());
  //     } else {
  //       console.log("No such document!");
  //     }
  //   });
  // }, []);

  const addEntry = async () => {
    const docRef = doc(app, "main", "allGames");
    await updateDoc(docRef, {
      [`a362ff7f-777b-4085-a924-f255aa05115d.name`]: "asd",
    }).catch((error) => console.log(error));
  };

  const removeEntry = async (uuid: any) => {
    console.log(uuid);
    const docRef = doc(app, "main", "allGames");
    await updateDoc(docRef, {
      [uuid]: deleteField(),
    });
  };

  return (
    <div
      className="App"
      style={{
        fontFamily: "joystix-monospace",
        backgroundColor: "#ded7d1",
        minHeight: "100vh",
      }}
    >
      <Main>
        <Home />
        <button onClick={() => addEntry()}>Add</button>
        <button 
          onClick={() => removeEntry("2333b6fd-0770-4e18-b22c-1a144c19bae5")}
        >
          Delete
        </button>
      </Main>
    </div>
  );
};

export default App;
