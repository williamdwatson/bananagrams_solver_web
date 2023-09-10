import { PlaySequence } from "./types";
import { getRandomInt } from "./utilities";

interface GameState {
    /**
     * The previous board
     */
    board: Board,
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
    letters: Uint8Array,
    /**
     * The indices played at each level of the recursive chain
     */
    play_sequence?: PlaySequence
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
    last_game: GameState|null
}
type comparison_t = "Same"|"SomeLess"|"GreaterByMoreThanOne"|"GreaterByOne";
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
 * The maximum length of any word in the dictionary
 */
const MAX_WORD_LENGTH = 15;
/**
 * Value of an empty cell on the board
 */
const EMPTY_VALUE = 30;
/**
 * Number rows/columns in the board
 */
const BOARD_SIZE = 144;
/**
 * All uppercase letters in the Latin alphabet
 */
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/**
 * The number of each letter present in regular Bananagrams
 */
const REGULAR_TILES = [13, 3, 3, 6, 18, 3, 4, 3, 12, 2, 2, 5, 3, 8, 11, 3, 2, 9, 6, 9, 6, 3, 3, 2, 3, 2];

function vec_hasher(v: Uint8Array|number[]) {
    let seed = v.length;
    v.forEach(num => {
        let x = ((num >> 16) ^ num) * 0x45d9f3b;
        let y = ((x >> 16) ^ x) * 0x45d9f3b;
        let z = (y >> 16) ^ y;
        seed ^= z + 0x9e3779b9 + (seed << 6) + (seed >> 2);
    });
    return seed;
}


/**
 * A thin wrapper around the board
 */
class Board {
    /**
     * The underlying board array
     */
    arr: Uint8Array
    /**
     * Creates a new board of size `BOARD_SIZE`x`BOARD_SIZE` filled with `EMPTY_VALUE`
     */
    constructor() {
        this.arr = new Uint8Array(BOARD_SIZE*BOARD_SIZE);
        this.arr.fill(EMPTY_VALUE);
    }
    /**
     * Gets a value at the given index in the board
     * @param row Row of the value to get
     * @param col Column of the value to get
     * @returns The value at `(row, col)`
     */
    get_val(row: number, col: number) {
        return this.arr[row*BOARD_SIZE + col];
    }
    /**
     * Sets a value at the given index in the board
     * @param row Row of the value to set
     * @param col Column of the value to set
     * @param val The value to set at `(row, col)`
     */
    set_val(row: number, col: number, val: number) {
        this.arr[row*BOARD_SIZE + col] = val;
    }
}

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
 * Converts a `board` to a `String`
 * @param board Board to display
 * @param min_col Minimum occupied column index
 * @param max_col Maximum occupied column index
 * @param min_row Minimum occupied row index
 * @param max_row Maximum occupied row index
 * @returns `board` in string form (with all numbers converted to letters)
 */
function _board_to_string(board: Board, min_col: number, max_col: number, min_row: number, max_row: number) {
    const board_string: string[] = [];
    for (let row=min_row; row<max_row+1; row++) {
        for (let col=min_col; col<max_col+1; col++) {
            if (board.get_val(row, col) === EMPTY_VALUE) {
                board_string.push(" ");
            }
            else {
                board_string.push(String.fromCharCode(board.get_val(row, col)+65));
            }
        }
        board_string.push("\n");
    }
    return board_string.join("").trimEnd();
}

function get_previous_idxs(previous_play_sequence?: PlaySequence, new_play_sequence?: PlaySequence) {
    if (previous_play_sequence == null || new_play_sequence == null) {
        return new Set<[number, number]>();
    }
    else {
        const previous_idxs = new Set<[number, number]>;
        for (let i=0; i<Math.min(previous_play_sequence.length, new_play_sequence.length); i++) {
            if (previous_play_sequence[i] == new_play_sequence[i]) {
                const word_len = previous_play_sequence[i][0].length;
                const start_row = previous_play_sequence[i][1][0];
                const start_col = previous_play_sequence[i][1][1];
                if (previous_play_sequence[i][1][2] === "horizontal") {
                    for (let j=0; j<word_len; j++) {
                        previous_idxs.add([start_row, start_col+j]);
                    }
                }
                else {
                    for (let j=0; j<word_len; j++) {
                        previous_idxs.add([start_row+j, start_col]);
                    }
                }
            }
        }
        return previous_idxs;
    }
}

/**
 * Converts a `board` to a vector of vectors of chars
 * @param board Board to display
 * @param min_col Minimum occupied column index
 * @param max_col Maximum occupied column index
 * @param min_row Minimum occupied row index
 * @param max_row Maximum occupied row index
 * @returns `board` in vector form (with all numbers converted to letters)
 */
function board_to_vec(board: Board, min_col: number, max_col: number, min_row: number, max_row: number, previous_idxs: Set<[number, number]>) {
    const board_vec: string[][] = [];
    for (let row=min_row; row<max_row+1; row++) {
        const row_vec: string[] = [];
        for (let col=min_col; col<max_col+1; col++) {
            if (board.get_val(row, col) == EMPTY_VALUE) {
                row_vec.push(" ");
            }
            else {
                const c = String.fromCharCode(board.get_val(row, col) + 65);
                if (!previous_idxs.has([row, col])) {
                    row_vec.push(c);
                }
                else {
                    row_vec.push(c + "*");
                }
            }
        }
        board_vec.push(row_vec);
    }
    return board_vec;
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
 * Checks which words can be played after the first
 * @param letters Length-26 array of originally available letters
 * @param word_being_checked Word that is being checked if playable
 * @param played_on_board Set of the letters played on the board
 * @returns Whether the `word_being_checked` is playable
 */
function check_filter_after_play(letters: Uint8Array, word_being_checked: Uint8Array, played_on_board: Set<number>) {
    const available_letters = new Int8Array(letters);
    let already_seen_negative = false;
    for (const letter of word_being_checked) {
        const num_left = available_letters[letter];
        if (num_left === 0 && !played_on_board.has(letter)) {
            return false;
        }
        else if (num_left === 0 && already_seen_negative) {
            return false;
        }
        else if (num_left === 0) {
            already_seen_negative = true;
        }
        available_letters[letter] -= 1;
    }
    return true;
}

/**
 * Checks that a `board` is valid after a word is played horizontally, given the specified list of `valid_word`s
 * Note that this does not check if all words are contiguous; this condition must be enforced elsewhere.
 * @param board `Board` being checked
 * @param min_col Minimum x (column) index of the subsection of the `board` to be checked
 * @param max_col Maximum x (column) index of the subsection of the `board` to be checked
 * @param min_row Minimum y (row) index of the subsection of the `board` to be checked
 * @param max_row Maximum y (row) index of the subsection of the `board` to be checked
 * @param row Row of the word played
 * @param start_col Starting column of the word played
 * @param end_col Ending column of the word played
 * @param valid_words Set of all valid words
 * @returns Whether the given `board` is made only of valid words
 */
function is_board_valid_horizontal(board: Board, min_col: number, max_col: number, min_row: number, max_row: number, row: number, start_col: number, end_col: number, valid_words: Set<number>) {
    let current_letters: number[] = [];
    // Check across the row where the word was played
    for (let col_idx=min_col; col_idx<max_col+1; col_idx++) {
        // If we're not at an empty square, add it to the current word we're looking at
        if (board.get_val(row, col_idx) != EMPTY_VALUE) {
            current_letters.push(board.get_val(row, col_idx));
        }
        else {
            if (current_letters.length > 1 && !valid_words.has(vec_hasher(current_letters))) {
                return false;
            }
            current_letters = [];
            if (col_idx > end_col) {
                break;
            }
        }
    }
    if (current_letters.length > 1 && !valid_words.has(vec_hasher(current_letters))) {
        return false;
    }
    // Check down each column where a letter was played
    for (let col_idx=start_col; col_idx<end_col+1; col_idx++) {
        current_letters = [];
        for (let row_idx=min_row; row_idx<max_row+1; row_idx++) {
            if (board.get_val(row_idx, col_idx) != EMPTY_VALUE) {
                current_letters.push(board.get_val(row_idx, col_idx));
            }
            else {
                if (current_letters.length > 1 && !valid_words.has(vec_hasher(current_letters))) {
                    return false;
                }
                current_letters = [];
                if (row_idx > row) {
                    break;
                }
            }
        }
        if (current_letters.length > 1 && !valid_words.has(vec_hasher(current_letters))) {
            return false;
        }
    }
    return true;
}

/**
 * Checks that a `board` is valid after a word is played vertically, given the specified list of `valid_word`s
 * Note that this does not check if all words are contiguous; this condition must be enforced elsewhere.
 * @param board `Board` being checked
 * @param min_col Minimum x (column) index of the subsection of the `board` to be checked
 * @param max_col Maximum x (column) index of the subsection of the `board` to be checked
 * @param min_row Minimum y (row) index of the subsection of the `board` to be checked
 * @param max_row Maximum y (row) index of the subsection of the `board` to be checked
 * @param start_row Starting row of the word played
 * @param end_row Ending row of the word played
 * @param col Column of the word played
 * @param valid_words Set of all valid words
 * @returns Whether the given `board` is made only of valid words
 */
function is_board_valid_vertical(board: Board, min_col: number, max_col: number, min_row: number, max_row: number, start_row: number, end_row: number, col: number, valid_words: Set<number>) {
    let current_letters: number[] = [];
    // Check down the column where the word was played
    for (let row_idx=min_row; row_idx<max_row+1; row_idx++) {
        // If it's not an empty value, add it to the current word
        if (board.get_val(row_idx, col) != EMPTY_VALUE) {
            current_letters.push(board.get_val(row_idx, col));
        }
        else {
            // Otherwise, check if we have more than one letter - if so, check if the word is valid
            if (current_letters.length > 1 && !valid_words.has(vec_hasher(current_letters))) {
                return false;
            }
            current_letters = [];
            // If we're past the end of the played word, no need to check farther
            if (row_idx > end_row) {
                break;
            }
        }
    }
    // In case we don't hit the `else` in the previous loop
    if (current_letters.length > 1) {
        if (!valid_words.has(vec_hasher(current_letters))) {
            return false;
        }
    }
    // Check across each row where a letter was played
    for (let row_idx=start_row; row_idx<end_row+1; row_idx++) {
        current_letters = [];
        for (let col_idx=min_col; col_idx<max_col+1; col_idx++) {
            if (board.get_val(row_idx, col_idx) != EMPTY_VALUE) {
                current_letters.push(board.get_val(row_idx, col_idx));
            }
            else {
                if (current_letters.length > 1 && !valid_words.has(vec_hasher(current_letters))) {
                    return false;
                }
                current_letters = [];
                if (col_idx > col) {
                    break;
                }
            }
        }
        if (current_letters.length > 1 && !valid_words.has(vec_hasher(current_letters))) {
            return false;
        }
    }
    return true;
}

/**
 * Plays a word on the board
 * @param word The word to be played
 * @param row_idx The starting row at which to play the word
 * @param col_idx The starting column at which to play the word
 * @param board The current board (is modified in-place)
 * @param direction The direction in which to play the word
 * @param letters 
 * @returns Whether the word could be validly played, which indices it was played on, the remaining letters, and the letter usage; or `null` if the play would be out-of-bounds
 */
function play_word(word: Uint8Array, row_idx: number, col_idx: number, board: Board, direction: "horizontal"|"vertical", letters: Uint8Array): [boolean, Array<[number, number]>, Uint8Array, "Remaining"|"Overused"|"Finished"]|null {
    const played_indices: Array<[number, number]> = [];
    if (direction === "horizontal") {
        if (col_idx + word.length >= BOARD_SIZE) {
            return null;
        }
        const remaining_letters = Uint8Array.from(letters);
        // Check if the word will start or end at a letter
        let valid_loc = (col_idx != 0 && board.get_val(row_idx, col_idx-1) != EMPTY_VALUE) || (BOARD_SIZE-col_idx <= word.length && board.get_val(row_idx, col_idx+word.length) != EMPTY_VALUE);
        // Check if the word will border any letters on the top or bottom
        if (!valid_loc) {
            for (let c_idx=col_idx; c_idx<col_idx+word.length; c_idx++) {
                if ((row_idx < BOARD_SIZE-1 && board.get_val(row_idx+1, c_idx) != EMPTY_VALUE) || (row_idx > 0 && board.get_val(row_idx-1, c_idx) != EMPTY_VALUE)) {
                    valid_loc = true;
                    break;
                }
            }
        }
        if (!valid_loc) {
            return [false, played_indices, remaining_letters, "Remaining"];
        }
        else {
            let entirely_overlaps = true;
            for (let i=0; i<word.length; i++) {
                if (board.get_val(row_idx, col_idx+i) == EMPTY_VALUE) {
                    board.set_val(row_idx, col_idx+i, word[i]);
                    played_indices.push([row_idx, col_idx+i]);
                    entirely_overlaps = false;
                    if (remaining_letters[word[i]] === 0) {
                        return [false, played_indices, remaining_letters, "Overused"];
                    }
                    remaining_letters[word[i]] -= 1;
                }
                else if (board.get_val(row_idx, col_idx+i) !== word[i]) {
                    return [false, played_indices, remaining_letters, "Remaining"];
                }
            }
            if (remaining_letters.every(count => count === 0) && !entirely_overlaps) {
                return [true, played_indices, remaining_letters, "Finished"];
            }
            else {
                return [!entirely_overlaps, played_indices, remaining_letters, "Remaining"];
            }
        }
    }
    else {
        if (row_idx + word.length >= BOARD_SIZE) {
            return null;
        }
        const remaining_letters = Uint8Array.from(letters);
        // Check if the word will start or end at a letter
        let valid_loc = (row_idx != 0 && board.get_val(row_idx-1, col_idx) != EMPTY_VALUE) || (BOARD_SIZE-row_idx <= word.length && board.get_val(row_idx+word.length, col_idx) != EMPTY_VALUE);
        // Check if the word will border any letters on the right or left
        if (!valid_loc) {
            for (let r_idx=row_idx; r_idx<row_idx+word.length; r_idx++) {
                if ((col_idx < BOARD_SIZE-1 && board.get_val(r_idx, col_idx+1) != EMPTY_VALUE) || (col_idx > 0 && board.get_val(r_idx, col_idx-1) != EMPTY_VALUE)) {
                    valid_loc = true;
                    break;
                }
            }
        }
        if (!valid_loc) {
            return [false, played_indices, remaining_letters, "Remaining"];
        }
        else {
            let entirely_overlaps = true;
            for (let i=0; i<word.length; i++) {
                if (board.get_val(row_idx+i, col_idx) == EMPTY_VALUE) {
                    board.set_val(row_idx+i, col_idx, word[i]);
                    played_indices.push([row_idx+i, col_idx]);
                    entirely_overlaps = false;
                    if (remaining_letters[word[i]] === 0) {
                        return [false, played_indices, remaining_letters, "Overused"];
                    }
                    remaining_letters[word[i]] -= 1;
                }
                else if (board.get_val(row_idx+i, col_idx) !== word[i]) {
                    return [false, played_indices, remaining_letters, "Remaining"];
                }
            }
            if (remaining_letters.every(count => count == 0) && !entirely_overlaps) {
                return [true, played_indices, remaining_letters, "Finished"];
            }
            else {
                return [!entirely_overlaps, played_indices, remaining_letters, "Remaining"];
            }
        }
    }
}

/**
 * Undoes a play on the `board`
 * @param board `Board` being undone (is modified in-place)
 * @param played_indices Array of the indices in `board` that need to be reset
 */
function undo_play(board: Board, played_indices: Array<[number, number]>) {
    for (const index of played_indices) {
        board.set_val(index[0], index[1], EMPTY_VALUE);
    }
}

/**
 * Recursively solves Bananagrams
 * @param board The `Board` to modify in-place
 * @param min_col Minimum occupied column index in `board`
 * @param max_col Maximum occupied column index in `board`
 * @param min_row Minimum occupied row index in `board`
 * @param max_row Maximum occupied row index in `board`
 * @param valid_words_vec Array of arrays, each representing a word (see `convert_word_to_array`)
 * @param valid_words_set Set of hashed word arrays
 * @param letters Length-26 array of the number of each letter in the hand
 * @param depth Depth of the current recursive call
 * @param play_sequence Sequence of played words for this current run
 * @param previous_play_sequence Sequence of played words for the previous run, if any
 * @returns Whether the word could be validly played, and the new minimum/maximum indices of the board, or `null` on out-of-bounds failure
 */
function play_further(board: Board, min_col: number, max_col: number, min_row: number, max_row: number, valid_words_vec: Array<Uint8Array>, valid_words_set: Set<number>, letters: Uint8Array, depth: number, play_sequence: PlaySequence, previous_play_sequence: PlaySequence): [boolean, number, number, number, number]|null {
    if (depth+1 < previous_play_sequence.length) {
        const word = previous_play_sequence[depth+1][0];
        const row_idx = previous_play_sequence[depth+1][1][0];
        const col_idx = previous_play_sequence[depth+1][1][1];
        const res = play_word(word, row_idx, col_idx, board, previous_play_sequence[depth+1][1][2], letters);
        if (res == null) {
            return res;
        }
        if (res[0]) {
            if (previous_play_sequence[depth+1][1][2] === "horizontal") {
                const new_min_col = Math.min(min_col, col_idx);
                const new_max_col = Math.max(max_col, col_idx+word.length);
                const new_min_row = Math.min(min_row, row_idx);
                const new_max_row = Math.max(max_row, row_idx);
                if (is_board_valid_horizontal(board, new_min_col, new_max_col, new_min_row, new_max_row, row_idx, col_idx, col_idx+word.length-1, valid_words_set)) {
                    // If it's valid, go to the next recursive level (where completion will be checked)
                    play_sequence.push([word, [res[1][0][0], res[1][0][1], "horizontal"]]);
                    if (res[3] === "Finished") {
                        return [true, new_min_col, new_max_col, new_min_row, new_max_row];
                    }
                    else if (res[3] === "Remaining") {
                        const res2 = play_further(board, new_min_col, new_max_col, new_min_row, new_max_row, valid_words_vec, valid_words_set, res[2], depth+1, play_sequence, previous_play_sequence);
                        if (res2 == null) {
                            return null;
                        }
                        else if (res2[0]) {
                            // If that recursive stack finishes successfully, we're done! (could have used another Result or Option rather than a bool in the returned tuple, but oh well)
                            return res2;
                        }
                        else {
                            // Otherwise, undo the previous play (cloning the board before each play so we don't have to undo is *way* slower)
                            play_sequence.pop();
                            undo_play(board, res[1]);
                        }
                    }
                }
                else {
                    // If the play formed some invalid words, undo the previous play
                    undo_play(board, res[1]);
                }
            }
            else {
                const new_min_col = Math.min(min_col, col_idx);
                const new_max_col = Math.max(max_col, col_idx);
                const new_min_row = Math.min(min_row, row_idx);
                const new_max_row = Math.max(max_row, row_idx+word.length);
                if (is_board_valid_vertical(board, new_min_col, new_max_col, new_min_row, new_max_row, row_idx, row_idx+word.length-1, col_idx, valid_words_set)) {
                    play_sequence.push([word, [res[1][0][0], res[1][0][1], "vertical"]]);
                    if (res[3] === "Finished") {
                        return [true, new_min_col, new_max_col, new_min_row, new_max_row];
                    }
                    else if (res[3] === "Remaining") {
                        const res2 = play_further(board, new_min_col, new_max_col, new_min_row, new_max_row, valid_words_vec, valid_words_set, res[2], depth+1, play_sequence, previous_play_sequence);
                        if (res2 == null) {
                            return null;
                        }
                        else if (res2[0]) {
                            return res2;
                        }
                        else {
                            play_sequence.pop();
                            undo_play(board, res[1]);
                        }
                    }
                }
                else {
                    undo_play(board, res[1]);
                }
            }
        }
        else {
            // If trying to play the board was invalid, undo the play
            undo_play(board, res[1]);
        }
        return [false, min_col, max_col, min_row, max_row];
    }
    // If we're at an odd depth, play horizontally first (trying to alternate horizontal-vertical-horizontal as a heuristic to solve faster)
    else if (depth % 2 == 1) {
        for (const word of  valid_words_vec) {
            // Try across all rows (starting from one before to one after)
            for (let row_idx=min_row-1; row_idx<max_row+2; row_idx++) {
                // For each row, try across all columns (starting from the farthest out the word could be played)
                for (let col_idx=min_col-word.length; col_idx<max_col+2; col_idx++) {
                    // Using the ? because `play_word` can give an `Err` if the index is out of bounds
                    const res = play_word(word, row_idx, col_idx, board, "horizontal", letters);
                    if (res == null) {
                        return null;
                    }
                    else if (res[0]) {
                        // If the word was played successfully (i.e. it's not a complete overlap and it borders at least one existing tile), then check the validity of the new words it forms
                        const new_min_col = Math.min(min_col, col_idx);
                        const new_max_col = Math.max(max_col, col_idx+word.length);
                        const new_min_row = Math.min(min_row, row_idx);
                        const new_max_row = Math.max(max_row, row_idx);
                        if (is_board_valid_horizontal(board, new_min_col, new_max_col, new_min_row, new_max_row, row_idx, col_idx, col_idx+word.length-1, valid_words_set)) {
                            // If it's valid, go to the next recursive level (unless we've all the letters, at which point we're done)
                            play_sequence.push([word, [res[1][0][0], res[1][0][1], "horizontal"]]);
                            if (res[3] === "Finished") {
                                return [true, new_min_col, new_max_col, new_min_row, new_max_row];
                            }
                            else if (res[3] === "Remaining") {
                                const res2 = play_further(board, new_min_col, new_max_col, new_min_row, new_max_row, valid_words_vec, valid_words_set, res[2], depth+1, play_sequence, previous_play_sequence);
                                if (res2 == null) {
                                    return null;
                                }
                                else if (res2[0]) {
                                    // If that recursive stack finishes successfully, we're done! (could have used another Result or Option rather than a bool in the returned tuple, but oh well)
                                    return res2;
                                }
                                else {
                                    // Otherwise, undo the previous play (cloning the board before each play so we don't have to undo is *way* slower)
                                    play_sequence.pop();
                                    undo_play(board, res[1]);
                                }
                            }
                        }
                        else {
                            // If the play formed some invalid words, undo the previous play
                            undo_play(board, res[1]);
                        }
                    }
                    else {
                        // If trying to play the board was invalid, undo the play
                        undo_play(board, res[1]);
                    }
                }
            }
        }
        // If trying every word horizontally didn't work, try vertically instead
        for (const word of valid_words_vec) {
            // Try down all columns
            for (let col_idx=min_col-1; col_idx<max_col+2; col_idx++) {
                // This is analgous to the above
                for (let row_idx=min_row-word.length; row_idx<max_row+2; row_idx++) {
                    const res = play_word(word, row_idx, col_idx, board, "vertical", letters);
                    if (res == null) {
                        return null;
                    }
                    else if (res[0]) {
                        const new_min_col = Math.min(min_col, col_idx);
                        const new_max_col = Math.max(max_col, col_idx);
                        const new_min_row = Math.min(min_row, row_idx);
                        const new_max_row = Math.max(max_row, row_idx+word.length);
                        if (is_board_valid_vertical(board, new_min_col, new_max_col, new_min_row, new_max_row, row_idx, row_idx+word.length-1, col_idx, valid_words_set)) {
                            play_sequence.push([word, [res[1][0][0], res[1][0][1], "vertical"]]);
                            if (res[3] === "Finished") {
                                return [true, new_min_col, new_max_col, new_min_row, new_max_row];
                            }
                            else if (res[3] === "Remaining") {
                                const res2 = play_further(board, new_min_col, new_max_col, new_min_row, new_max_row, valid_words_vec, valid_words_set, res[2], depth+1, play_sequence, previous_play_sequence);
                                if (res2 == null) {
                                    return null;
                                }
                                else if (res2[0]) {
                                    return res2;
                                }
                                else {
                                    play_sequence.pop();
                                    undo_play(board, res[1]);
                                }
                            }
                        }
                        else {
                            undo_play(board, res[1]);
                        }
                    }
                    else {
                        undo_play(board, res[1]);
                    }
                }
            }
        }
        return [false, min_col, max_col, min_row, max_row];
    }
    // If we're at an even depth, play vertically first. Otherwise this is analgous to the above.
    else {
        for (const word of valid_words_vec) {
            // Try down all columns
            for (let col_idx=min_col-1; col_idx<max_col+2; col_idx++) {
                for (let row_idx=min_row-word.length; row_idx<max_row+2; row_idx++) {
                    const res = play_word(word, row_idx, col_idx, board, "vertical", letters);
                    if (res == null) {
                        return null;
                    }
                    else if (res[0]) {
                        const new_min_col = Math.min(min_col, col_idx);
                        const new_max_col = Math.max(max_col, col_idx);
                        const new_min_row = Math.min(min_row, row_idx);
                        const new_max_row = Math.max(max_row, row_idx+word.length);
                        if (is_board_valid_vertical(board, new_min_col, new_max_col, new_min_row, new_max_row, row_idx, row_idx+word.length-1, col_idx, valid_words_set)) {
                            play_sequence.push([word, [res[1][0][0], res[1][0][1], "vertical"]]);
                            if (res[3] === "Finished") {
                                return [true, new_min_col, new_max_col, new_min_row, new_max_row]; 
                            }
                            else if (res[3] === "Remaining") {
                                const res2 = play_further(board, new_min_col, new_max_col, new_min_row, new_max_row, valid_words_vec, valid_words_set, res[2], depth+1, play_sequence, previous_play_sequence);
                                if (res2 == null) {
                                    return null;
                                }
                                else if (res2[0]) {
                                    return res2;
                                }
                                else {
                                    play_sequence.pop();
                                    undo_play(board, res[1]);
                                }
                            }
                        }
                        else {
                            undo_play(board, res[1]);
                        }
                    }
                    else {
                        undo_play(board, res[1]);
                    }
                }
            }
        }
        for (const word of valid_words_vec) {
            // Try across all rows
            for (let row_idx=min_row-1; row_idx<max_row+2; row_idx++) {
                for (let col_idx=min_col-word.length; col_idx<max_col+2; col_idx++) {
                    const res = play_word(word, row_idx, col_idx, board, "horizontal", letters);
                    if (res == null) {
                        return null;
                    }
                    if (res[0]) {
                        const new_min_col = Math.min(min_col, col_idx);
                        const new_max_col = Math.max(max_col, col_idx+word.length);
                        const new_min_row = Math.min(min_row, row_idx);
                        const new_max_row = Math.max(max_row, row_idx);
                        if (is_board_valid_horizontal(board, new_min_col, new_max_col, new_min_row, new_max_row, row_idx, col_idx, col_idx+word.length-1, valid_words_set)) {
                            play_sequence.push([word, [res[1][0][0], res[1][0][1], "horizontal"]]);
                            if (res[3] === "Finished") {
                                return [true, new_min_col, new_max_col, new_min_row, new_max_row];
                            }
                            else if (res[3] === "Remaining") {
                                const res2 = play_further(board, new_min_col, new_max_col, new_min_row, new_max_row, valid_words_vec, valid_words_set, res[2], depth+1, play_sequence, previous_play_sequence);
                                if (res2 == null) {
                                    return null;
                                }
                                else if (res2[0]) {
                                    return res2;
                                }
                                else {
                                    play_sequence.pop();
                                    undo_play(board, res[1]);
                                }
                            }
                        }
                        else {
                            undo_play(board, res[1]);
                        }
                    }
                    else {
                        undo_play(board, res[1]);
                    }
                }
            }
        }
        return [false, min_col, max_col, min_row, max_row];
    }
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

/**
 * Async function to solve a Bananagrams board
 * @param available_letters Mapping of string letters to numeric quantity of each letter
 * @param state Current state of the app
 */
export async function play_bananagrams(available_letters: Map<string, number>, state: AppState) {
    return new Promise<solution_t>((resolve, reject) => {
        const start = new Date();
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
        if (state.last_game != null) {
            let comparison: comparison_t = "Same";
            let seen_greater = EMPTY_VALUE;
            for (let i=0; i<26; i++) {
                if (letters[i] < state.last_game.letters[i]) {
                    // Any less means we re-do the board, so we can break here
                    comparison = "SomeLess";
                    break;
                }
                else if (letters[i] > state.last_game.letters[i] && (seen_greater != EMPTY_VALUE || letters[i] - state.last_game.letters[i] != 1)) {
                    comparison = "GreaterByMoreThanOne";
                }
                else if (letters[i] > state.last_game.letters[i]) {
                    comparison = "GreaterByOne";
                    seen_greater = i;
                }
            }
            if (comparison === "Same") {
                resolve({
                    board: board_to_vec(state.last_game.board, state.last_game.min_col, state.last_game.max_col, state.last_game.min_row, state.last_game.max_row, new Set()),
                    elapsed: ((new Date()).getMilliseconds() - start.getMilliseconds()),
                    state: {
                        board: state.last_game.board,
                        min_col: state.last_game.min_col,
                        max_col: state.last_game.max_col,
                        min_row: state.last_game.min_row,
                        max_row: state.last_game.max_row,
                        letters: state.last_game.letters
                    }
                });
                return;
            }
            else if (comparison === "GreaterByOne") {

            }
            else if (comparison === "GreaterByMoreThanOne") {

            }
            else {
                // We just want to continue to the code that starts from scratch
            }
        }
        // Play from scratch
        let valid_words_vec: Uint8Array[] = state.all_words_short.filter(word => is_makeable(word, letters));
        if (valid_words_vec.length == 0) {
            reject("No valid words can be formed from the current letters - dump and try again!");
            return;
        }
        // Loop through each word and play it on a new board
        for (const word of valid_words_vec) {
            const board = new Board();
            const col_start = Math.round(BOARD_SIZE/2 - word.length/2);
            const row = Math.round(BOARD_SIZE/2);
            const use_letters = Uint8Array.from(letters);
            for (let i=0; i<word.length; i++) {
                board.set_val(row, col_start+i, word[i]);
                use_letters[word[i]] -= 1;
            }
            const min_col = col_start;
            const min_row = row;
            const max_col = col_start + (word.length-1);
            const max_row = row;
            const play_sequence: PlaySequence = [];
            play_sequence.push([word, [row, col_start, "horizontal"]]);
            if (use_letters.every(count => count == 0)) {
                const previous_idxs = get_previous_idxs(state.last_game?.play_sequence, play_sequence);
                resolve({
                    board: board_to_vec(board, min_col, max_col, min_row, max_row, previous_idxs),
                    elapsed: ((new Date()).getMilliseconds() - start.getMilliseconds()),
                    state: {
                        board: board,
                        min_col: min_col,
                        max_col: max_col,
                        min_row: min_row,
                        max_row: max_row,
                        letters: letters,
                        play_sequence: play_sequence
                    }
                });
                return;
            }
            else {
                // Reduce the set of remaining words to check to those that can be played with the letters not in the first word (plus only one of the tiles played in the first word)
                const word_letters = new Set(letters);
                const new_valid_words_vec = valid_words_vec.filter(word => check_filter_after_play(use_letters, word, word_letters));
                const valid_words_set = new Set(valid_words_vec.map(vec_hasher));
                // Begin the recursive processing
                const result = play_further(board, min_col, max_col, min_row, max_row, new_valid_words_vec, valid_words_set, use_letters, 0, play_sequence, []);
                if (result == null || !result[0]) {
                    reject("No valid words can be formed from the current letters - dump and try again!");
                    return;
                }
                else {
                    const previous_idxs = get_previous_idxs(state.last_game?.play_sequence, play_sequence);
                    resolve({
                        board: board_to_vec(board, result[1], result[2], result[3], result[4], previous_idxs),
                        elapsed: ((new Date()).getMilliseconds() - start.getMilliseconds()),
                        state: {
                            board: board,
                            min_col: result[1],
                            max_col: result[2],
                            min_row: result[3],
                            max_row: result[4],
                            letters: letters,
                            play_sequence: play_sequence
                        }
                    });
                    return;
                }
            }
        }
    })
}