import { useState, useRef, useEffect, MouseEvent } from "react";
import "primereact/resources/themes/tailwind-light/theme.css";
import "primereact/resources/primereact.min.css";
import 'primeicons/primeicons.css';
import { Splitter, SplitterPanel } from "primereact/splitter";
import { Toast } from "primereact/toast";
import "./App.css";
import LetterInput from "./letter_input";
import ResultsDisplay from "./results_display";
import PlayableWords from "./playable_words";
import { AppState, convert_word_to_array } from "./solver";
import { result_t } from "./types";

export default function App() {
    const toast = useRef<Toast>(null);
    const [gameState, setGameState] = useState<AppState|null>(null);
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState<result_t|null>(null);
    const [letterInputContextMenu, setLetterInputContextMenu] = useState<MouseEvent<HTMLDivElement>|null>(null);
    const [resultsContextMenu, setResultsContextMenu] = useState<MouseEvent<HTMLDivElement>|null>(null);
    const [playableWordsVisible, setPlayableWordsVisible] = useState(false);
    const [playableWords, setPlayableWords] = useState<{short: string[], long: string[]}|null>(null);
    const [panelSizes, setPanelSizes] = useState<number[]>([25, 75]);

    // Disable right-clicking elsewhere on the page and load the data
    useEffect(() => {
        //document.addEventListener("contextmenu", e => e.preventDefault());
        Promise.all([
            fetch("https://raw.githubusercontent.com/williamdwatson/bananagrams_solver/main/src-tauri/src/dictionary.txt"),
            fetch("https://raw.githubusercontent.com/williamdwatson/bananagrams_solver/main/src-tauri/src/short_dictionary.txt")
        ]).then(([long, short]) => {
            Promise.all([
                long.text(), short.text()
            ]).then(([long_text, short_text]) => {
                setGameState({
                    last_game: null,
                    all_words_long: long_text.split("\n").filter(word => word.length > 1).map(word => convert_word_to_array(word.toUpperCase().trim())),
                    all_words_short: short_text.split("\n").filter(word => word.length > 1).map(word => convert_word_to_array(word.toUpperCase().trim()))
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
        if (gameState != null) {
            const worker = new Worker(new URL("solver", import.meta.url), {type: "module"});
            worker.addEventListener("message", e => {
                if (typeof e.data === "string") {
                    toast.current?.show({severity: "error", summary: "Uh oh!", detail: "" + e.data});
                    setRunning(false);
                }
                else {
                    const results = e.data as result_t;
                    const new_state: AppState = {
                        all_words_short: gameState.all_words_short,
                        all_words_long: gameState.all_words_long,
                        last_game: results.state
                    }
                    setGameState(new_state);
                    setResults(results);
                    setRunning(false);
                }
            });
            worker.postMessage({letters: letters, gameState: gameState});
        }
    }

    /**
     * Clears the existing results, if any (only if the solver is not currently running)
     */
    const clearResults = () => {
        if (!running && gameState != null) {
            setResults(null);
            setGameState({last_game: null, all_words_long: gameState.all_words_long, all_words_short: gameState.all_words_short});
        }
    }

    return (
        <>
        <Toast ref={toast}/>
        <PlayableWords playableWords={playableWords} visible={playableWordsVisible} setVisible={setPlayableWordsVisible}/>
        <Splitter style={{height: "98vh"}} onResizeEnd={e => setPanelSizes(e.sizes)}>
            <SplitterPanel size={panelSizes[0]} pt={{root: {onContextMenu: e => setLetterInputContextMenu(e)}}}>
                <LetterInput gameState={gameState} toast={toast} startRunning={startRunning} running={running} contextMenu={letterInputContextMenu} setPlayableWords={setPlayableWords} setPlayableWordsVisible={setPlayableWordsVisible} clearResults={clearResults}/>
            </SplitterPanel>
            <SplitterPanel size={panelSizes[1]} style={{display: "flex", justifyContent: "center", alignItems: "center"}} pt={{root: {onContextMenu: e => setResultsContextMenu(e)}}}>
                <ResultsDisplay toast={toast} results={results} contextMenu={resultsContextMenu} clearResults={clearResults} running={running} panelWidth={panelSizes[1]}/>
            </SplitterPanel>
        </Splitter>
        </>
    );
}
