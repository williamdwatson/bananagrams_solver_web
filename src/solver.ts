import { getRandomInt } from "./utilities";
import init, { play_from_existing, play_from_scratch } from "../bg-solver/pkg/bg_solver";


/**
 * All uppercase letters in the Latin alphabet
 */
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/**
 * The number of each letter present in regular Bananagrams
 */
const REGULAR_TILES = [13, 3, 3, 6, 18, 3, 4, 3, 12, 2, 2, 5, 3, 8, 11, 3, 2, 9, 6, 9, 6, 3, 3, 2, 3, 2];


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

// For the web worker
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
