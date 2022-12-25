
import gameReducer from "./gameReducer"
import { combineReducers } from "redux";

const rootReducer = combineReducers({
    gameReducer: gameReducer,
})

export default rootReducer
export type State = ReturnType<typeof rootReducer>