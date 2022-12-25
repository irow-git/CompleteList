import { Dispatch } from "redux"
import { State } from "../reducers/rootReducer"
import * as ActionInterface from "./actionInterfaces"


export const retrieveItems = (data: any) => {

    return async (dispatch: Dispatch<ActionInterface.RetrieveGamesAction>, getState: () => State) => {
        dispatch({
            type: "RETRIEVE_GAMES", payload: data
        })
    }
}