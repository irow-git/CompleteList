import { IGame } from "../../interfaces"
import AppAction from "../actions/actionInterfaces"

interface GamesState {
    games: IGame[],
}

const initState: GamesState = {
    games: [

    ]
}

const itemReducer = (state: GamesState = initState, action: AppAction) => {
    switch (action.type) {
        
        case "RETRIEVE_GAMES":
            return {
                ...state,
                games: {...action.payload},
            }

        case "ADD_GAME":
            return {
                ...state,
                games: [...state.games, action.payload]
            }

        case "DELETE_GAME":
            const tempArrDelete:any[] = state.games.filter((game) => action.payload !== game.uuid)

            return {
                ...state,
                ganes: tempArrDelete
            }


        case "EDIT_GAME":
            const tempArrEdit: any[] = state.games.map(game => {
                if (game.uuid === action.payload.data.uuid) {
                    return { ...action.payload }
                }
                return game
            })
            return {
                ...state,
                games: tempArrEdit
            }


        default: return {
            ...state
        }
    }
}

export default itemReducer