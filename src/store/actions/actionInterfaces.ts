import { IGame } from "../../interfaces"

export interface RetrieveGamesAction {
    type: "RETRIEVE_GAMES",
    payload: IGame[]
}

export interface AddGameAction {
    type: "ADD_GAME",
    payload: IGame
}

export interface DeleteGameByIdAction {
    type: "DELETE_GAME",
    payload: string
}

export interface EditGameAction {
    type: "EDIT_GAME",
    payload: IGame
}


type AppAction = 
      RetrieveGamesAction
    | DeleteGameByIdAction
    | AddGameAction
    | EditGameAction

export default AppAction