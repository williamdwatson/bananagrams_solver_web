import { PlaySequence } from "./types";
import { getRandomInt } from "./utilities";
import init, { play_from_existing, play_from_scratch } from "../bg-solver/pkg/bg_solver";

export interface GameState {
    /**
     * The previous board
     */
    board: Uint8Array,
    /**
     * The minimum played column in `board`
     */
    min_col: number,
    /**
     * The maximum played column in `board`
     */
    max_col: number,
    /**
     * The minimum played row in `board`
     */
    min_row: number,
    /**
     * The maximum played row in `board`
     */
    max_row: number,
    /**
     * The hand used to make the `board`
     */
    letters: Uint8Array
}
export interface AppState {
    /**
     * Dictionary of the ~20k most common words in English
     */
    all_words_short: Array<Uint8Array>,
    /**
     * Complete Scrabble dictionary
     */
    all_words_long: Array<Uint8Array>,
    /**
     * The last game state (if `null`, then no previous game has been played)
     */
    last_game: GameState|null,
    /*
     * Stack of previous solutions
     */
    undo_stack: (GameState|null)[],
    /*
     * Stack of undone solutions
     */
    redo_stack: (GameState|null)[],
    /*
     * Number of letters present on the board that can be used in a word (higher will result in fewer words being filtered out)
     */
    filter_letters_on_board: number,
    /*
     * Maximum number of words to check before stopping
     */
    maximum_words_to_check: number,
    /*
     * Whether to use the long dictionary or the short one
     */
    use_long_dictionary: boolean
}

/**
 * The return type when a solution is found
 */
export type solution_t = {
    /**
     * The solved board
     */
    board: string[][],
    /**
     * How long it took to solve the board in milliseconds
     */
    elapsed: number,
    /**
     * The state of the game upon solving
     */
    state: GameState
}

/**
 * All uppercase letters in the Latin alphabet
 */
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/**
 * The number of each letter present in regular Bananagrams
 */
const REGULAR_TILES = [13, 3, 3, 6, 18, 3, 4, 3, 12, 2, 2, 5, 3, 8, 11, 3, 2, 9, 6, 9, 6, 3, 3, 2, 3, 2];

/**
 * Converts a word into a numeric vector representation
 * @param word String word to convert
 * @returns Numeric representation of `word`, with each letter converted from 0 ('A') to 25 ('Z')
 * @see convert_array_to_word - the inverse function
 */
export function convert_word_to_array(word: string) {
    const word_arr: number[] = [];
    for (const char of word) {
        if (UPPERCASE.includes(char)) {
            word_arr.push(char.charCodeAt(0) - 65);
        }
    }
    return Uint8Array.from(word_arr);
}

/**
 * Converts a numeric vector representation into a string
 * @param word Numeric vector of the word
 * @returns `arr` converted into a string, with each number converted from 'A' (0) to 'Z' (25)
 * @see convert_word_to_array - the inverse function
 */
function convert_array_to_word(arr: Uint8Array) {
    const chars: string[] = [];
    arr.forEach(val => {
        chars.push(String.fromCharCode(val+65));
    });
    return chars.join("");
}

/**
 * Checks whether a `word` can be made using the given `letters`
 * @param word The array form of the word to check
 * @param letters Length-26 array of the number of each letter in the hand
 * @returns Whether `word` can be made using `letters
 *
 */
function is_makeable(word: Uint8Array, letters: Uint8Array) {
    const available_letters = new Uint8Array(letters.length);
    for (let i=0; i<letters.length; i++) {
        available_letters[i] = letters[i];
    }
    for (let i=0; i<word.length; i++) {
        if (available_letters[word[i]] === 0) {
            return false;
        }
        available_letters[word[i]] -= 1;
    }
    return true;
}

/**
 * Async function to get the playable words for a given hand of letters
 * @param available_letters Mapping string letters to numeric quanity of each letter
 * @param state Current state of the app
 * @returns Object with two keys - "short" (common words playable using `available_letters`) and "long" (Scrabble words playable using `available_letters`)
 */
export async function get_playable_words(available_letters: Map<string, number>, state: AppState) {
    return new Promise<{short: string[], long: string[]}>((resolve, reject) => {
        // Check if we have all the letters from the frontend
        const letters = new Uint8Array(26);
        for (const c of UPPERCASE) {
            const num = available_letters.get(c);
            if (num != null) {
                if (num < 0) {
                    reject("Number of letter " + c + " is " + num + ", but must be greater than or equal to 0!");
                    return;
                }
                letters[c.charCodeAt(0) - 65] = num;
            }
            else {
                reject("Missing letter: " + c);
                return;
            }
        }
        const playable_short = state.all_words_short.filter(word => is_makeable(word, letters)).map(convert_array_to_word);
        const playable_long = state.all_words_long.filter(word => is_makeable(word, letters)).map(convert_array_to_word);
        resolve({short: playable_short, long: playable_long});
    });
}

/**
 * Generates random letters based on user input
 * @param what Whether to generate characters from an "infinite set" (i.e. all are equal likelihood), or selected from "standard Bananagrams" (144 tiles) or "double Bananagrams" (288 tiles)
 * @param how_many How many tiles to randomly generate; must be greater than 0, and less than 144 for regular Bananagrams, or 288 for double
 * @returns Mapping of each uppercase Latin character to the number of times it's present
 */
export async function get_random_letters(what: "infinite set"|"standard Bananagrams"|"double Bananagrams", how_many: number) {
    return new Promise<Map<string, number>>((resolve, reject) => {
        if (how_many < 1) {
            reject("The number to choose should be greater than 0");
            return;
        }
        const return_chars = new Map<string, number>();
        [...UPPERCASE].forEach(c => {
            return_chars.set(c, 0);
        });
        if (what == "infinite set") {
            // For "infinite set", randomly generate characters
            for (let i=0; i<how_many; i++) {
                const random_num = getRandomInt(0, 25);
                const random_char = String.fromCharCode(random_num+65);
                if (return_chars.has(random_char)) {
                    return_chars.set(random_char, return_chars.get(random_char)!+1);
                }
                else {
                    reject("Missing value in return dictionary: " + random_char);
                    return;
                }
            }
        }
        else if (what === "standard Bananagrams") {
            if (how_many > 144) {
                reject("The number to choose msut be less than 144 for standard Bananagrams");
                return;
            }
            const to_choose_from = [];
            for (let i=0; i<UPPERCASE.length; i++) {
                for (let j=0; j<REGULAR_TILES[i]; j++) {
                    to_choose_from.push(UPPERCASE.charAt(i));
                }
            }
            for (let i=0; i<how_many; i++) {
                const random_num = getRandomInt(0, to_choose_from.length-1);
                const random_char = to_choose_from[random_num];
                if (return_chars.has(random_char)) {
                    return_chars.set(random_char, return_chars.get(random_char)!+1);
                }
                else {
                    reject("Missing value in return dictionary: " + random_char);
                    return;
                }
                to_choose_from.splice(random_num, 1);
            }
        }
        else if (what === "double Bananagrams") {
            if (how_many > 288) {
                reject("The number to choose msut be less than 288 for double Bananagrams");
                return;
            }
            const to_choose_from = [];
            for (let i=0; i<UPPERCASE.length; i++) {
                for (let j=0; j<REGULAR_TILES[i]; j++) {
                    to_choose_from.push(UPPERCASE.charAt(i));
                }
            }
            for (let i=0; i<how_many; i++) {
                const random_num = getRandomInt(0, to_choose_from.length-1);
                const random_char = to_choose_from[random_num];
                if (return_chars.has(random_char)) {
                    return_chars.set(random_char, return_chars.get(random_char)!+1);
                }
                else {
                    reject("Missing value in return dictionary: " + random_char);
                    return;
                }
                to_choose_from.splice(random_num, 1);
            }
        }
        else {
            reject("`what` must be \"infinite set\", \"standard Bananagrams\", or \"double Bananagrams\", not " + what);
            return;
        }
        resolve(return_chars);
    })
}


self.addEventListener("message", e => {
    if (e.data === "init") {
        init().then(() => {
            self.postMessage("initialized");
        });
    }
    else if (!e.data.last_game) {
        self.postMessage(play_from_scratch(
            e.data.letters_array, e.data.use_long_dictionary, e.data.filter_letters_on_board, e.data.maximum_words_to_check,
            new Uint8Array(), 0, 0, 0, 0
        ));
    }
    else {
        const solution = play_from_existing(
            e.data.letters_array, e.data.last_game.letters, e.data.use_long_dictionary, e.data.filter_letters_on_board, e.data.maximum_words_to_check,
            e.data.last_game.board, e.data.last_game.min_col, e.data.last_game.max_col, e.data.last_game.min_row, e.data.last_game.max_row
        );
        if (solution == null) {
            self.postMessage(play_from_scratch(
                e.data.letters_array, e.data.use_long_dictionary, e.data.filter_letters_on_board, e.data.maximum_words_to_check,
                e.data.last_game.board, e.data.last_game.min_col, e.data.last_game.max_col, e.data.last_game.min_row, e.data.last_game.max_row
            ));
        }
        else {
            self.postMessage(solution);
        }
    }
}, false)
