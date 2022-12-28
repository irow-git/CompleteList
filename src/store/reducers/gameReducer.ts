import { IGame } from "../../interfaces";
import AppAction from "../actions/actionInterfaces";

interface GamesState {
  games: IGame[];
}

const initState: GamesState = {
  games: [],
};

const itemReducer = (state: GamesState = initState, action: AppAction) => {
  switch (action.type) {
    case "RETRIEVE_GAMES":
      const tempArrRetrieve = Object.entries(action.payload).map((game) => {
        return { ...game[1], id: game[0] };
      });
      return {
        ...state,
        games: tempArrRetrieve,
      };

    case "ADD_GAME":
      return {
        ...state,
        games: [...state.games, action.payload],
      };

    case "DELETE_GAME":
      const tempArrDelete: any[] = state.games.filter(
        (game) => action.payload !== game.id
      );

      return {
        ...state,
        ganes: tempArrDelete,
      };

    case "EDIT_GAME":
      const tempArrEdit: any[] = state.games.map((game) => {
        if (game.id === action.payload.id) {
          return { ...action.payload };
        }
        return game;
      });
      return {
        ...state,
        games: tempArrEdit,
      };

    default:
      return {
        ...state,
      };
  }
};

export default itemReducer;
