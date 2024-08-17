import { useState, useRef, useEffect, MouseEvent } from "react";
import "primereact/resources/themes/tailwind-light/theme.css";
import "primereact/resources/primereact.min.css";
import 'primeicons/primeicons.css';
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { ScrollPanel } from "primereact/scrollpanel";
import { Splitter, SplitterPanel } from "primereact/splitter";
import { Toast } from "primereact/toast";
import "./App.css";
import LetterInput from "./letter_input";
import ResultsDisplay, { useWindowDimensions } from "./results_display";
import PlayableWords from "./playable_words";
import Settings from "./settings";
import { AppState, GameState, result_t } from "./types";
import init, { js_board_to_vec } from "../bg-solver/pkg/bg_solver";
import { ConfirmDialog } from "primereact/confirmdialog";


export default function App() {
    const [appState, setAppState] = useState<AppState|null>(null);
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState<result_t|null>(null);
    const [letterInputContextMenu, setLetterInputContextMenu] = useState<MouseEvent<HTMLDivElement>|null>(null);
    const [resultsContextMenu, setResultsContextMenu] = useState<MouseEvent<HTMLDivElement>|null>(null);
    const [playableWordsVisible, setPlayableWordsVisible] = useState(false);
    const [playableWords, setPlayableWords] = useState<{short: string[], long: string[]}|null>(null);
    const [panelSizes, setPanelSizes] = useState<[number, number]>([26, 74]);
    const [undoPossible, setUndoPossible] = useState(false);
    const [redoPossible, setRedoPossible] = useState(false);
    const [canPlay, setCanPlay] = useState(false);
    const [solutionVisible, setSolutionVisible] = useState(false);
    const [worker, setWorker] = useState<Worker>(new Worker(new URL("solver", import.meta.url), {type: "module"}));

    const appStateRef = useRef<AppState|null>(null);
    const toast = useRef<Toast>(null);
    const startTimeRef = useRef(0);
    const mobileRef = useRef(false);
    const dimensions = useWindowDimensions();

    const mobile = dimensions.width < 730;

    // Update the ref when the mobile state changes (which presumably won't happen often in actual use)
    useEffect(() => {
        mobileRef.current = mobile;
    }, [mobile]);

    // Set up the web worker
    useEffect(() => {
        worker.addEventListener("error", e => {
            toast.current?.show({severity: "error", summary: "Uh oh!", detail: `An error occurred: ${e}`});
            setRunning(false);
        });
        worker.addEventListener("message", e => {
            if (e.data === "initialized") {
                setCanPlay(true);
            }
            else if (typeof e.data === "string") {
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
                    letters: e.data.letters
                };
                setAppState({
                    last_game: game_state,
                    undo_stack: [...appStateRef.current!.undo_stack, appStateRef.current!.last_game],
                    redo_stack: [],
                    maximum_words_to_check: appStateRef.current!.maximum_words_to_check,
                    filter_letters_on_board: appStateRef.current!.filter_letters_on_board,
                    use_long_dictionary: appStateRef.current!.use_long_dictionary
                });
                setRedoPossible(false);
                setUndoPossible(true);
                setResults({
                    board: e.data.board_string,
                    elapsed: Date.now() - startTimeRef.current,
                    state: game_state
                });
                setRunning(false);
                if (mobileRef.current) {
                    setSolutionVisible(true);
                }
            }
        });
        worker.postMessage("init");
    }, [worker]);
    
    // Update the ref with the state (so the callback on the webworker can use the most recent value)
    useEffect(() => {
        appStateRef.current = appState;
    }, [appState]);

    // Disable right-clicking elsewhere on the page and initialize the WASM
    useEffect(() => {
        const runWasm = async () => {
            await init(); // Initializes the WASM module
        };
        runWasm();
        setAppState({
            last_game: null,
            undo_stack: [],
            redo_stack: [],
            maximum_words_to_check: 20_000,
            filter_letters_on_board: 2,
            use_long_dictionary: false
        });
        document.addEventListener("contextmenu", e => e.preventDefault());
    }, []);

    /**
     * Runs the solver
     * @param letters Mapping of length-one letter strings to the number of that letter present in the hand
     */
    const startRunning = (letters_array: Uint8Array) => {
        setRunning(true);
        startTimeRef.current = Date.now();
        if (appState != null) {
            if (appState.last_game != null) {
                worker.postMessage({
                    letters_array,
                    last_game: appState.last_game,
                    maximum_words_to_check: appState.maximum_words_to_check,
                    filter_letters_on_board: appState.filter_letters_on_board,
                    use_long_dictionary: appState.use_long_dictionary
                })
            }
            else {
                worker.postMessage({
                    letters_array,
                    last_game: null,
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
                    undo_stack: [...appState!.undo_stack, null],
                    redo_stack: appState!.redo_stack,                           // No need to slice since we popped above
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
                    undo_stack: [...appState!.undo_stack, appState!.last_game],
                    redo_stack: appState!.redo_stack,
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
                    undo_stack: appState!.undo_stack,
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
                    undo_stack: appState!.undo_stack,
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

    /**
     * Cancels the solver by terminating and reinitializing the web worker
     */
    const cancelRun = () => {
        worker.terminate();
        setRunning(false);
        setCanPlay(false);
        setWorker(new Worker(new URL("solver", import.meta.url), {type: "module"}));
    }

    if (mobile) {
        return (
            <>
            <Toast ref={toast}/>
            <ConfirmDialog/>
            <PlayableWords playableWords={playableWords} visible={playableWordsVisible} setVisible={setPlayableWordsVisible} mobile/>
            <Dialog header="Solution" visible={solutionVisible} onHide={() => setSolutionVisible(false)} maximized>
                <ResultsDisplay toast={toast} results={results} contextMenu={resultsContextMenu} clearResults={clearResults} running={running} panelWidth={100} mobile/>
            </Dialog>
            <div style={{height: "95vh", display: "flex", alignItems: "center"}}>
            <div style={{display: "grid", justifyContent: "grid", alignItems: "center"}}>
                <LetterInput appState={appState} toast={toast} startRunning={startRunning} running={running} canPlay={canPlay} cancel={cancelRun}
                             contextMenu={letterInputContextMenu} setPlayableWords={setPlayableWords} setPlayableWordsVisible={setPlayableWordsVisible}
                             clearResults={clearResults} undo={undo} redo={redo} undoPossible={undoPossible} redoPossible={redoPossible} mobile/>
                <Button label="View results" severity="success" onClick={() => setSolutionVisible(true)} style={{marginTop: "3vh"}} disabled={appState?.last_game == null}/>
                <Settings toast={toast} appState={appState} setAppState={setAppState} mobile/>
            </div>
            </div>
            </>
        )
    }
    else {
        return (
            <>
            <Toast ref={toast}/>
            <ConfirmDialog/>
            <PlayableWords playableWords={playableWords} visible={playableWordsVisible} setVisible={setPlayableWordsVisible}/>
            <Splitter style={{height: "98vh"}} onResizeEnd={e => setPanelSizes(e.sizes as [number, number])}>
                <SplitterPanel size={panelSizes[0]} pt={{root: {onContextMenu: e => setLetterInputContextMenu(e)}}} minSize={20}>
                    <ScrollPanel style={{ width: "100%", height: "100%" }}>
                        <LetterInput appState={appState} toast={toast} startRunning={startRunning} running={running} canPlay={canPlay} cancel={cancelRun}
                                     contextMenu={letterInputContextMenu} setPlayableWords={setPlayableWords} setPlayableWordsVisible={setPlayableWordsVisible}
                                     clearResults={clearResults} undo={undo} redo={redo} undoPossible={undoPossible} redoPossible={redoPossible}/>
                        <Settings toast={toast} appState={appState} setAppState={setAppState}/>
                    </ScrollPanel>
                </SplitterPanel>
                <SplitterPanel size={panelSizes[1]} style={{display: "flex", justifyContent: "center", alignItems: "center"}} pt={{root: {onContextMenu: e => setResultsContextMenu(e)}}} minSize={50}>
                    <ResultsDisplay toast={toast} results={results} contextMenu={resultsContextMenu} clearResults={clearResults} running={running} panelWidth={panelSizes[1]}/>
                </SplitterPanel>
            </Splitter>
            </>
        );
    }
}
