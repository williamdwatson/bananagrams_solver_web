import { Button } from "primereact/button"
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { OverlayPanel } from "primereact/overlaypanel";
import { Toast } from "primereact/toast"
import { RefObject, useEffect, useRef, useState } from "react"
import LinkWrapper from "./link_wrapper";
import { AppState } from "./types";

interface SettingsProps {
    /**
     * The current app state, including settings
     */
    appState: AppState|null,
    /**
     * Sets the new app state
     * @param new_app_state New app state
     */
    setAppState: (new_app_state: AppState|null) => void,
    /**
     * Toast popup reference
     */
    toast: RefObject<Toast>,
    /**
     * Whether to format for a mobile display
     */
    mobile?: boolean
}

/**
 * Shows the settings and information popups
 * 
 * @component
 */
export default function Settings(props: SettingsProps) {
    const [showSettings, setShowSettings] = useState(false);
    const [filterLettersOnBoard, setFilterLettersOnBoard] = useState<number|null>(2);
    const [whichDictionary, setWhichDictionary] = useState<"Short"|"Full">("Short");
    const [maximumWordsToCheck, setMaximumWordsToCheck] = useState<number|null>(50_000);
    const [aboutVisible, setAboutVisible] = useState(false);
    const filterLettersInfo = useRef<OverlayPanel>(null);
    const maxWordsInfo = useRef<OverlayPanel>(null);
    const whichDictionaryInfo = useRef<OverlayPanel>(null);

    // Get the available settings whenever the popup is shown
    useEffect(() => {
        if (showSettings) {
            setFilterLettersOnBoard(props.appState?.filter_letters_on_board ?? 2);
            setMaximumWordsToCheck(props.appState?.maximum_words_to_check ?? 20_000);
            setWhichDictionary(props.appState?.use_long_dictionary ? "Full" : "Short")
        }
    }, [showSettings]);

    /**
     * Updates the settings
     */
    const setSettings = () => {
        if (filterLettersOnBoard == null) {
            props.toast.current?.show({severity: "warn", summary: "Missing usable letters on board", detail: "The number of usable letters on the board must be provided"});
        }
        else if (filterLettersOnBoard < 0) {
            props.toast.current?.show({severity: "warn", summary: "Invalid usable letters on board", detail: "The number of usable letters on the board must be a non-negative integer."})
        }
        else if (filterLettersOnBoard >= 2**32) {
            props.toast.current?.show({severity: "warn", summary: "Invalid usable letters on board", detail: "The number of usable letters on the board must be less than 2³²"});
        }
        else if (maximumWordsToCheck == null) {
            props.toast.current?.show({severity: "warn", summary: "Missing maximum iterations", detail: "The maximum iterations must be provided"});
        }
        else if (maximumWordsToCheck < 0) {
            props.toast.current?.show({severity: "warn", summary: "Invalid maximum iterations", detail: "The maximum iterations must be a non-negative integer"});
        }
        else if (maximumWordsToCheck >= 2**32) {
            props.toast.current?.show({severity: "warn", summary: "Invalid maximum iterations", detail: "The maximum iterations must be less than 2³²"});
        }
        else {
            props.setAppState({
                last_game: props.appState?.last_game ?? null,
                undo_stack: props.appState?.undo_stack ?? [],
                redo_stack: props.appState?.redo_stack ?? [],
                filter_letters_on_board: filterLettersOnBoard,
                maximum_words_to_check: maximumWordsToCheck,
                use_long_dictionary: whichDictionary === "Full"
            });
            setShowSettings(false);
        }
    }

    const about_filter_letters_on_board = <>
        <p>The maximum number of letters on the board that can be used in conjuction with letters in the hand when filtering playable words</p>
        <p><strong>Lower values:</strong> <em>Usually</em> faster solutions</p>
        <p><strong>Higher values:</strong> <em>Usually</em> slower solutions, but more likely to find a solution if one exists. For an exhaustive search, use a value greater than the total number of letters.</p>
    </>

    return (
        <>
        <Dialog header="Settings" visible={showSettings} onHide={() => setShowSettings(false)}>
            <div className="settings-div" style={{marginTop: props.mobile ? "15px" : undefined}}>
                <label htmlFor="filter_letters_on_board">Usable letters on board:</label> <InputNumber value={filterLettersOnBoard} onChange={e => setFilterLettersOnBoard(e.value)} min={0} max={2**32-1} inputId="filter_letters_on_board"/>
                <OverlayPanel ref={filterLettersInfo} style={{maxWidth: props.mobile ? "90vw" : "33vw"}}>
                    {about_filter_letters_on_board}
                </OverlayPanel>
                <i className="pi pi-info-circle info-overlay" onClick={e => filterLettersInfo.current?.toggle(e)} aria-haspopup></i>
            </div>
            <div className="settings-div" style={{marginTop: props.mobile ? "10px" : undefined}}>
                <label htmlFor="max_words_to_check">Maximum iterations:</label> <InputNumber value={maximumWordsToCheck} onChange={e => setMaximumWordsToCheck(e.value)} min={0} max={2**32-1} inputId="max_words_to_check"/>
                <OverlayPanel ref={maxWordsInfo} style={{maxWidth: props.mobile ? "90vw" : "33vw"}}>
                    <p>The maximum number of iterations before the solver stops and returns no solution (i.e. a "dump") - this applies separately to each of the first six words checked</p>
                    <p><strong>Lower values:</strong> Faster "dump" solutions</p>
                    <p><strong>Higher values:</strong> Slower "dump" solutions, but more likely to find a solution if one exists. For an exhaustive search, use a very large value.</p>
                </OverlayPanel>
                <i className="pi pi-info-circle info-overlay" onClick={e => maxWordsInfo.current?.toggle(e)} aria-haspopup></i>
            </div>
            <div className="settings-div" style={{marginTop: props.mobile ? "10px" : undefined}}>
                <label htmlFor="use_dictionary">Dictionary:</label> <Dropdown value={whichDictionary} onChange={e => setWhichDictionary(e.value)} options={["Short", "Full"]} inputId="use_dictionary"/>
                <OverlayPanel ref={whichDictionaryInfo} style={{maxWidth: props.mobile ? "90vw" : "33vw"}}>
                    <p>Which dictionary to use</p>
                    <p><strong>Short:</strong> Contains 30,515 words</p>
                    <p><strong>Full:</strong> Contains 178,663 words, including some that some players might consider questionable</p>
                </OverlayPanel>
                <i className="pi pi-info-circle info-overlay" onClick={e => whichDictionaryInfo.current?.toggle(e)} aria-haspopup></i>
            </div>
            <div style={{display: "flex", justifyContent: "center", marginTop: "15px"}}>
                <Button label="Use settings" icon="pi pi-arrow-right" iconPos="right" onClick={setSettings}/>
                <Button label="Cancel" icon="pi pi-times" iconPos="right" severity="secondary" onClick={() => setShowSettings(false)} style={{marginLeft: "5px"}}/>
            </div>
        </Dialog>
        <Dialog header="About" visible={aboutVisible} onHide={() => setAboutVisible(false)} style={{maxWidth: props.mobile ? undefined : "90vw"}} maximized={props.mobile}>
            <p>
                This Bananagrams solver was written by William Watson, with source available on <LinkWrapper href="https://github.com/williamdwatson/bananagrams_solver_web">GitHub</LinkWrapper>.
            </p>
            <p>
                The frontend was written using React/Typescript, and uses the <LinkWrapper href="https://primereact.org/">PrimeReact</LinkWrapper> and <LinkWrapper href="https://github.com/BetterTyped/react-zoom-pan-pinch">react-zoom-pan-pinch</LinkWrapper> libraries.
            </p>
            <p>
                The backend was written in Rust and compiled to WebAssembly using the <LinkWrapper href="https://github.com/rustwasm/wasm-pack">wasm-pack</LinkWrapper> library.
            </p>
            <p>
                Dictionaries are derived from several sources and are available on the main project's <LinkWrapper href="https://github.com/williamdwatson/bananagrams_solver">GitHub</LinkWrapper>:
            </p>
            <ul>
                <li>
                    Full dictionary:
                    <ul>
                        Taken from <LinkWrapper href="https://github.com/redbo/scrabble/blob/05748fb060b6e20480424b9113c1610066daca3c/dictionary.txt">here</LinkWrapper>, with minimal manual editing
                    </ul>
                </li>
                <li>
                    Short dictionary:
                    <ul>
                        <li>
                            Lists from <LinkWrapper href="https://people.sc.fsu.edu/~jburkardt/datasets/words/words.html">here</LinkWrapper> under the <LinkWrapper href="https://www.gnu.org/licenses/lgpl-3.0.en.html#license-text)">LGPL license</LinkWrapper>:
                            <ul>
                                <li>basic_english_850.txt</li>
                                <li>basic_english_2000.txt</li>
                                <li>doublet_words.txt</li>
                                <li>globish.txt</li>
                                <li>simplified_english.txt</li>
                                <li>special_english.txt</li>
                                <li>unique_grams.txt</li>
                            </ul>
                        </li>
                        <li>
                            Lists from <LinkWrapper href="https://github.com/MichaelWehar/Public-Domain-Word-Lists">here</LinkWrapper> in the public domain:
                            <ul>
                                <li>200-less-common.txt</li>
                                <li>5000-more-common.txt</li>
                            </ul>
                        </li>
                        <li><LinkWrapper href="https://www.mit.edu/~ecprice/wordlist.10000">MIT's 10000 word list</LinkWrapper></li>
                        <li><LinkWrapper href="https://github.com/first20hours/google-10000-english">10000 word list derived from Google</LinkWrapper></li>
                    </ul>
                </li>
            </ul>
        </Dialog>
        <div style={{marginTop: "5%", width: "100%", display: "flex", justifyContent: "center"}}>
            <Button label="Settings" icon="pi pi-cog" iconPos="right" onClick={() => setShowSettings(true)}/>
            <Button label="About" icon="pi pi-info-circle" iconPos="right" onClick={() => setAboutVisible(true)} style={{marginLeft: "5px"}}/>
        </div>
        </>
    )
}