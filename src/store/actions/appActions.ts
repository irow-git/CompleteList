import { doc, updateDoc } from "firebase/firestore";
import { Dispatch } from "redux";
import { State } from "../reducers/rootReducer";
import * as ActionInterface from "./actionInterfaces";
import app from "../../firebaseConfig";
import { v4 as uuidv4 } from "uuid";
export const retrieveGames = (data: any) => {
  return async (
    dispatch: Dispatch<ActionInterface.RetrieveGamesAction>,
    getState: () => State
  ) => {
    dispatch({
      type: "RETRIEVE_GAMES",
      payload: data,
    });
  };
};

export const addGame = (data: any) => {
  return async (
    dispatch: Dispatch<ActionInterface.AddGameAction>,
    getState: () => State
  ) => {
    const docRef = doc(app, "main", "allGames");
    await updateDoc(docRef, {
      [uuidv4()]: data,
    }).catch((error) => console.log(error));

    dispatch({
      type: "ADD_GAME",
      payload: data,
    });
  };
};
