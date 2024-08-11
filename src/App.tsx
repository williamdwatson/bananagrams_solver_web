import { useState, useRef, useEffect, MouseEvent } from "react";
import "primereact/resources/themes/tailwind-light/theme.css";
import "primereact/resources/primereact.min.css";
import 'primeicons/primeicons.css';
import { Splitter, SplitterPanel } from "primereact/splitter";
import { Toast } from "primereact/toast";
import "./App.css";
import LetterInput, { UPPERCASE } from "./letter_input";
import ResultsDisplay from "./results_display";
import PlayableWords from "./playable_words";
import { AppState, convert_word_to_array, GameState } from "./solver";
import { result_t } from "./types";
import init, { js_board_to_vec } from "../bg-solver/pkg/bg_solver";

export default function App() {
    const toast = useRef<Toast>(null);
    const [appState, setAppState] = useState<AppState|null>(null);
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState<result_t|null>(null);
    const [letterInputContextMenu, setLetterInputContextMenu] = useState<MouseEvent<HTMLDivElement>|null>(null);
    const [resultsContextMenu, setResultsContextMenu] = useState<MouseEvent<HTMLDivElement>|null>(null);
    const [playableWordsVisible, setPlayableWordsVisible] = useState(false);
    const [playableWords, setPlayableWords] = useState<{short: string[], long: string[]}|null>(null);
    const [panelSizes, setPanelSizes] = useState<number[]>([26, 74]);
    const [undoPossible, setUndoPossible] = useState(false);
    const [redoPossible, setRedoPossible] = useState(false);

    // Disable right-clicking elsewhere on the page and load the data
    useEffect(() => {
        const runWasm = async () => {
            await init(); // Initializes the WASM module
        };
        runWasm();
        // document.addEventListener("contextmenu", e => e.preventDefault());
        Promise.all([
            fetch("https://raw.githubusercontent.com/williamdwatson/bananagrams_solver/main/src-tauri/src/dictionary.txt"),
            fetch("https://raw.githubusercontent.com/williamdwatson/bananagrams_solver/main/src-tauri/src/updated_short_dictionary.txt")
        ]).then(([long, short]) => {
            Promise.all([
                long.text(), short.text()
            ]).then(([long_text, short_text]) => {
                setAppState({
                    last_game: null,
                    all_words_long: long_text.split("\n").filter(word => word.length > 1).map(word => convert_word_to_array(word.toUpperCase().trim())).sort((a, b) => b.length - a.length),
                    all_words_short: short_text.split("\n").filter(word => word.length > 1).map(word => convert_word_to_array(word.toUpperCase().trim())).sort((a, b) => b.length - a.length),
                    undo_stack: [],
                    redo_stack: [],
                    maximum_words_to_check: 500_000,
                    filter_letters_on_board: 1,
                    use_long_dictionary: false
                });
            }).catch(error => {
                toast.current?.show({severity: "error", summary: "Error getting dictionary", detail: "There was an error getting the dictionary: " + error});
            });
        }).catch(error => {
            toast.current?.show({severity: "error", summary: "Error getting dictionary", detail: "There was an error getting the dictionary: " + error});
        });
    }, []);

    /**
     * Runs the solver
     * @param letters Mapping of length-one letter strings to the number of that letter present in the hand
     */
    const startRunning = (letters: Map<string, number>) => {
        setRunning(true);
        const start_time = Date.now();
        if (appState != null) {
            if (appState.last_game != null) {

            }
            else {
                const letters_array = new Uint8Array(26);
                for (let i=0; i<UPPERCASE.length; i++) {
                    letters_array[i] = letters.get(UPPERCASE[i]) ?? 0;
                }
                const worker = new Worker(new URL("solver", import.meta.url), {type: "module"});
                worker.addEventListener("message", e => {
                    if (typeof e.data === "string") {
                        toast.current?.show({severity: "error", summary: "Uh oh!", detail: e.data.toString()});
                        setRunning(false);
                    }
                    else {
                        const game_state: GameState = {
                            board: e.data.board,
                            min_col: e.data.min_col,
                            max_col: e.data.max_col,
                            min_row: e.data.min_row,
                            max_row: e.data.max_row,
                            letters: letters_array
                        }
                        setAppState({
                            last_game: game_state,
                            all_words_long: appState.all_words_long,
                            all_words_short: appState.all_words_short,
                            undo_stack: [...appState.undo_stack, appState.last_game],
                            redo_stack: [],
                            maximum_words_to_check: appState.maximum_words_to_check,
                            filter_letters_on_board: appState.filter_letters_on_board,
                            use_long_dictionary: appState.use_long_dictionary
                        });
                        setRedoPossible(false);
                        setUndoPossible(true);
                        setResults({
                            board: e.data.board_string,
                            elapsed: Date.now() - start_time,
                            state: game_state
                        });
                        setRunning(false);
                    }
                });
                worker.addEventListener("error", e => {
                    toast.current?.show({severity: "error", summary: "Uh oh!", detail: `An error occurred: ${e}`});
                    setRunning(false);
                });
                worker.postMessage({
                    letters_array,
                    maximum_words_to_check: appState.maximum_words_to_check,
                    filter_letters_on_board: appState.filter_letters_on_board,
                    use_long_dictionary: appState.use_long_dictionary
                });
            }
        }
    }

    /**
     * Clears the existing results, if any (only if the solver is not currently running)
     */
    const clearResults = () => {
        if (!running && appState != null) {
            setResults(null);
            setAppState({
                last_game: null,
                all_words_long: appState.all_words_long,
                all_words_short: appState.all_words_short,
                undo_stack: [...appState.undo_stack, appState.last_game],
                redo_stack: [],
                maximum_words_to_check: appState.maximum_words_to_check,
                filter_letters_on_board: appState.filter_letters_on_board,
                use_long_dictionary: appState.use_long_dictionary
            });
        }
    }

    /**
     * Redoes the previous play
     * @returns Letters on the previously played board
     */
    const redo = () => {
        const len = appState?.redo_stack.length;
        if (len == null) {
            setRedoPossible(false);
            setUndoPossible(false);
            return new Uint8Array(26);
        }
        else if (len === 0) {
            setUndoPossible(appState!.undo_stack.length > 0);
            setRedoPossible(false);
            return appState!.last_game?.letters ?? new Uint8Array(26);
        }
        else {
            const prev_game_state = appState!.redo_stack.pop();
            setUndoPossible(true);
            setRedoPossible(appState!.redo_stack.length > 0);
            if (prev_game_state == null) {
                setAppState({
                    last_game: null,
                    all_words_long: appState!.all_words_long,
                    all_words_short: appState!.all_words_short,
                    undo_stack: [...appState!.undo_stack, null],
                    redo_stack: appState!.redo_stack.slice(0, -1),
                    maximum_words_to_check: appState!.maximum_words_to_check,
                    filter_letters_on_board: appState!.filter_letters_on_board,
                    use_long_dictionary: appState!.use_long_dictionary
                });
                setResults(null);
                return new Uint8Array(26);
            }
            else {
                setAppState({
                    last_game: prev_game_state,
                    all_words_long: appState!.all_words_long,
                    all_words_short: appState!.all_words_short,
                    undo_stack: [...appState!.undo_stack, appState!.last_game],
                    redo_stack: appState!.redo_stack.slice(0, -1),
                    maximum_words_to_check: appState!.maximum_words_to_check,
                    filter_letters_on_board: appState!.filter_letters_on_board,
                    use_long_dictionary: appState!.use_long_dictionary
                });
                setResults({
                    board: js_board_to_vec(prev_game_state.board, prev_game_state.min_col, prev_game_state.max_col, prev_game_state.min_row, prev_game_state.max_row),
                    elapsed: 0,
                    state: prev_game_state
                });
                return prev_game_state.letters;
            }
        }
    }

    /**
     * Undoes the previous play
     * @returns Letters previously played on the board
     */
    const undo = () => {
        const len = appState?.undo_stack.length;
        if (len == null) {
            setRedoPossible(false);
            setUndoPossible(false);
            return new Uint8Array(26);
        }
        else if (len === 0) {
            setRedoPossible(appState!.undo_stack.length > 0);
            setUndoPossible(false);
            return appState!.last_game?.letters ?? new Uint8Array(26);
        }
        else {
            const prev_game_state = appState!.undo_stack.pop();
            setRedoPossible(true);
            setUndoPossible(appState!.undo_stack.length > 0);
            if (prev_game_state == null) {
                setAppState({
                    last_game: null,
                    all_words_long: appState!.all_words_long,
                    all_words_short: appState!.all_words_short,
                    undo_stack: appState!.undo_stack.slice(0, -1),
                    redo_stack: [...appState!.redo_stack, appState!.last_game],
                    maximum_words_to_check: appState!.maximum_words_to_check,
                    filter_letters_on_board: appState!.filter_letters_on_board,
                    use_long_dictionary: appState!.use_long_dictionary
                });
                setResults(null);
                return new Uint8Array(26);
            }
            else {
                setAppState({
                    last_game: prev_game_state,
                    all_words_long: appState!.all_words_long,
                    all_words_short: appState!.all_words_short,
                    undo_stack: appState!.undo_stack.slice(0, -1),
                    redo_stack: [...appState!.redo_stack, appState!.last_game],
                    maximum_words_to_check: appState!.maximum_words_to_check,
                    filter_letters_on_board: appState!.filter_letters_on_board,
                    use_long_dictionary: appState!.use_long_dictionary
                });
                setResults({
                    board: js_board_to_vec(prev_game_state.board, prev_game_state.min_col, prev_game_state.max_col, prev_game_state.min_row, prev_game_state.max_row),
                    elapsed: 0,
                    state: prev_game_state
                });
                return prev_game_state.letters;
            }
        }
    }

    return (
        <>
        <Toast ref={toast}/>
        <PlayableWords playableWords={playableWords} visible={playableWordsVisible} setVisible={setPlayableWordsVisible}/>
        <Splitter style={{height: "98vh"}} onResizeEnd={e => setPanelSizes(e.sizes)}>
            <SplitterPanel size={panelSizes[0]} pt={{root: {onContextMenu: e => setLetterInputContextMenu(e)}}}>
                <LetterInput appState={appState} toast={toast} startRunning={startRunning} running={running}
                             contextMenu={letterInputContextMenu} setPlayableWords={setPlayableWords} setPlayableWordsVisible={setPlayableWordsVisible}
                             clearResults={clearResults} undo={undo} redo={redo} undoPossible={undoPossible} redoPossible={redoPossible}/>
            </SplitterPanel>
            <SplitterPanel size={panelSizes[1]} style={{display: "flex", justifyContent: "center", alignItems: "center"}} pt={{root: {onContextMenu: e => setResultsContextMenu(e)}}}>
                <ResultsDisplay toast={toast} results={results} contextMenu={resultsContextMenu} clearResults={clearResults} running={running} panelWidth={panelSizes[1]}/>
            </SplitterPanel>
        </Splitter>
        </>
    );
}
