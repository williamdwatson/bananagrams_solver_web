mod utils;

use std::{fmt, iter::FromIterator};
use hashbrown::HashSet;
use wasm_bindgen::prelude::*;
use serde::Serialize;
use serde_wasm_bindgen::to_value;
use lazy_static::lazy_static;

/// A numeric representation of a word
type Word = Vec<usize>;
/// Represents a hand of letters
type Letters = [usize; 26];
/// Represents a board and its minimum and maximum played columns and rows
type BoardAndIdxs = (Board, usize, usize, usize, usize);
/// Represents a set of removable indices that will storm form a valid board, plus that new board's minimum and maximum played columns and rows
type Removable = (Vec<(usize, usize)>, usize, usize, usize, usize);

/// The maximum length of any word in the dictionary
const MAX_WORD_LENGTH: usize = 17;
/// Value of an empty cell on the board
const EMPTY_VALUE: usize = 30;
/// Number rows/columns in the board
const BOARD_SIZE: usize = 144;

lazy_static! {
    static ref SHORT_DICTIONARY: Vec<Word> = {
        let mut words: Vec<_> = include_str!("updated_short_dictionary.txt").lines().map(convert_word_to_array).collect();
        words.sort_by(|a, b| b.len().cmp(&a.len()));
        words
    };
}

lazy_static! {
    static ref FULL_DICTIONARY: Vec<Word> = {
        let mut words: Vec<_> = include_str!("dictionary.txt").lines().map(convert_word_to_array).collect();
        words.sort_by(|a, b| b.len().cmp(&a.len()));
        words
    };
}

/// Enumeration of the direction a word is played
#[derive(Copy, Clone, PartialEq)]
enum Direction {
    /// The word was played horizontally
    Horizontal,
    /// The word was played vertically
    Vertical
}
impl fmt::Display for Direction {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Direction::Vertical => write!(f, "Horizontal"),
            Direction::Horizontal => write!(f, "Vertical")
        }
    }
}
impl fmt::Debug for Direction {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Direction::Vertical => write!(f, "Horizontal"),
            Direction::Horizontal => write!(f, "Vertical")
        }
    }
}

/// Enumeration of how many letters have been used
#[derive(Copy, Clone)]
enum LetterUsage {
    /// There are still unused letters
    Remaining,
    /// More letters have been used than are available
    Overused,
    /// All letters have been used
    Finished
}
impl fmt::Display for LetterUsage {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
       match self {
            LetterUsage::Remaining => write!(f, "Remaining"),
            LetterUsage::Overused => write!(f, "Overused"),
            LetterUsage::Finished => write!(f, "Finished")
        }
    }
}
impl fmt::Debug for LetterUsage {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            LetterUsage::Remaining => write!(f, "Remaining"),
            LetterUsage::Overused => write!(f, "Overused"),
            LetterUsage::Finished => write!(f, "Finished")
        }
    }
}

/// For comparing a current hand of letters to a previous hand
enum LetterComparison {
    /// At least one letter has fewer than the previous letter
    SomeLess,
    /// All letters are the same except exactly one is greater by exactly one
    GreaterByOne,
    /// One or more letters are greater by one or more
    GreaterByMoreThanOne,
    /// The hand is the same as before
    Same
}
impl fmt::Debug for LetterComparison {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            LetterComparison::SomeLess => write!(f, "Some less"),
            LetterComparison::GreaterByOne => write!(f, "Greater by one"),
            LetterComparison::GreaterByMoreThanOne => write!(f, "Greater by more than one"),
            LetterComparison::Same => write!(f, "Same")
        }
     }
}


/// The current board
#[derive(Clone)]
struct Board {
    /// The underlying vector of the board
    arr: Vec<usize>
}
impl Board {
    /// Creates a new board of dimensions `BOARD_SIZE`x`BOARD_SIZE` filled with the `EMPTY_VALUE`
    fn new() -> Board {
        return Board { arr: vec![EMPTY_VALUE; BOARD_SIZE*BOARD_SIZE] }
    }

    /// Gets a value from the board at the given index
    /// # Arguments
    /// * `row` - Row index of the value to get (must be less than `BOARD_SIZE`)
    /// * `col` - Column index of the value to get (must be less than `BOARD_SIZE`)
    /// # Returns
    /// `usize` - The value in the board at `(row, col)`
    /// # Panics
    /// If `row` or `col` are out-of-bounds
    fn get_val(&self, row: usize, col: usize) -> usize {
        return *self.arr.get(row*BOARD_SIZE + col).expect("Index not in range!");
    }

    /// Sets a value in the board at the given index
    /// # Arguments
    /// * `row` - Row index of the value to get (must be less than `BOARD_SIZE`)
    /// * `col` - Column index of the value to get (must be less than `BOARD_SIZE`)
    /// * `val` - Value to set at `(row, col)` in the board
    /// # Panics
    /// If `row` or `col` are out-of-bounds
    fn set_val(&mut self, row: usize, col: usize, val: usize) {
        let v = self.arr.get_mut(row*BOARD_SIZE + col).expect("Index not in range!");
        *v = val;
    }

    /// Plays a word on the board
    /// # Arguments
    /// * `word` - The word to be played
    /// * `row_idx` - The starting row at which to play the word
    /// * `col_idx` - The starting column at which to play the word
    /// * `direction` - The `Direction` in which to play the word
    /// * `letters` - The number of each letter currently in the hand
    /// * `letters_on_board` - The number of each letter on the board (is modified in-place)
    /// # Returns
    /// *`Result` with:*
    /// * `bool` - Whether the word could be validly played
    /// * `Vec<(usize, usize)>` - Vector of the indices played in `board`
    /// * `[usize; 26]`- The remaining letters
    /// * `LetterUsage` - How many letters were used
    /// 
    /// *or empty `Err` if out-of-bounds*
    fn play_word(&mut self, word: &Word, row_idx: usize, col_idx: usize, direction: Direction, letters: &Letters, letters_on_board: &mut Letters) -> (bool, Vec<(usize, usize)>, [usize; 26], LetterUsage) {
        let mut played_indices: Vec<(usize, usize)> = Vec::with_capacity(MAX_WORD_LENGTH);
        match direction {
            Direction::Horizontal => {
                let mut remaining_letters = letters.clone();
                if col_idx + word.len() > BOARD_SIZE {
                    return (false, played_indices, remaining_letters, LetterUsage::Remaining);
                }
                // Check if the word will start or end at a letter, or borders one top or bottom
                let borders_start = self.get_val(row_idx, col_idx) != EMPTY_VALUE;
                let borders_end = self.get_val(row_idx, col_idx+word.len()-1) != EMPTY_VALUE;
                let borders_top_or_bottom = if row_idx == 0 {
                    (col_idx..col_idx+word.len()).any(|c_idx| self.get_val(1, c_idx) != EMPTY_VALUE)
                }
                else if row_idx == BOARD_SIZE-1 {
                    (col_idx..col_idx+word.len()).any(|c_idx| self.get_val(BOARD_SIZE-2, c_idx) != EMPTY_VALUE)
                }
                else {
                    (col_idx..col_idx+word.len()).any(|c_idx| self.get_val(row_idx-1, c_idx) != EMPTY_VALUE || self.get_val(row_idx+1, c_idx) != EMPTY_VALUE)
                };
                if !(borders_start || borders_end || borders_top_or_bottom) {
                    return (false, played_indices, remaining_letters, LetterUsage::Remaining);
                }
                else {
                    let mut entirely_overlaps = true;
                    for i in 0..word.len() {
                        if self.get_val(row_idx, col_idx+i) == EMPTY_VALUE {
                            self.set_val(row_idx, col_idx+i, word[i]);
                            letters_on_board[word[i]] += 1;
                            played_indices.push((row_idx, col_idx+i));
                            entirely_overlaps = false;
                            let elem = remaining_letters.get_mut(word[i]).unwrap();
                            if *elem == 0 {
                                return (false, played_indices, remaining_letters, LetterUsage::Overused);
                            }
                            *elem -= 1;
                        }
                        else if self.get_val(row_idx, col_idx+i) != word[i] {
                            return (false, played_indices, remaining_letters, LetterUsage::Remaining);
                        }
                    }
                    if remaining_letters.iter().all(|count| *count == 0) && !entirely_overlaps {
                        return (true, played_indices, remaining_letters, LetterUsage::Finished);
                    }
                    else {
                        return (!entirely_overlaps, played_indices, remaining_letters, LetterUsage::Remaining);
                    }
                }
            },
            Direction::Vertical => {
                let mut remaining_letters = letters.clone();
                if row_idx + word.len() > BOARD_SIZE {
                    return (false, played_indices, remaining_letters, LetterUsage::Remaining);
                }

                // Check if the word will start or end at a letter, or borders one left or right
                let borders_start = self.get_val(row_idx, col_idx) != EMPTY_VALUE;
                let borders_end = self.get_val(row_idx+word.len()-1, col_idx) != EMPTY_VALUE;
                let borders_left_or_right = if col_idx == 0 {
                    (row_idx..row_idx+word.len()).any(|r_idx| self.get_val(r_idx, 1) != EMPTY_VALUE)
                }
                else if col_idx == BOARD_SIZE-2 {
                    (row_idx..row_idx+word.len()).any(|r_idx| self.get_val(r_idx, BOARD_SIZE-2) != EMPTY_VALUE)
                }
                else {
                    (row_idx..row_idx+word.len()).any(|r_idx| self.get_val(r_idx, col_idx-1) != EMPTY_VALUE || self.get_val(r_idx, col_idx+1) != EMPTY_VALUE)
                };
                if !(borders_start || borders_end || borders_left_or_right) {
                    return (false, played_indices, remaining_letters, LetterUsage::Remaining);
                }
                else {
                    let mut entirely_overlaps = true;
                    for i in 0..word.len() {
                        if self.get_val(row_idx+i, col_idx) == EMPTY_VALUE {
                            self.set_val(row_idx+i, col_idx, word[i]);
                            letters_on_board[word[i]] += 1;
                            played_indices.push((row_idx+i, col_idx));
                            entirely_overlaps = false;
                            let elem = remaining_letters.get_mut(word[i]).unwrap();
                            if *elem == 0 {
                                return (false, played_indices, remaining_letters, LetterUsage::Overused);
                            }
                            *elem -= 1;
                        }
                        else if self.get_val(row_idx+i, col_idx) != word[i] {
                            return (false, played_indices, remaining_letters, LetterUsage::Remaining);
                        }
                    }
                    if remaining_letters.iter().all(|count| *count == 0) && !entirely_overlaps {
                        return (true, played_indices, remaining_letters, LetterUsage::Finished);
                    }
                    else {
                        return (!entirely_overlaps, played_indices, remaining_letters, LetterUsage::Remaining);
                    }
                }
            }
        }
    }

    /// Undoes a play on the `board`
    /// # Arguments
    /// * `board` - `Board` being undone (is modified in-place)
    /// * `played_indices` - Vector of the indices in `board` that need to be reset
    /// * `letters_on_board` - Length-26 array of the number of each letter on the board (is modified in place)
    /// # Returns
    /// * `Vec<usize>` - Vector of the previous values on the `board` for each of `played_indices`
    fn undo_play(&mut self, played_indices: &Vec<(usize, usize)>, letters_on_board: &mut Letters) -> Vec<usize> {
        let mut old_letters: Vec<usize> = Vec::with_capacity(played_indices.len());
        for index in played_indices.iter() {
            let old_val = self.get_val(index.0, index.1);
            letters_on_board[old_val] -= 1;
            old_letters.push(old_val);
            self.set_val(index.0, index.1, EMPTY_VALUE);
        }
        old_letters
    }

    /// Erases the board
    fn erase(&mut self) {
        self.arr.fill(EMPTY_VALUE);
    }
}

/// Converts a word into a numeric vector representation
/// # Arguments
/// * `word` - String word to convert
/// # Returns
/// `Word` - numeric representation of `word`, with each letter converted from 0 ('A') to 25 ('Z')
/// # See also
/// `convert_array_to_word`
fn convert_word_to_array(word: &str) -> Word {
    word.chars().filter(|c| c.is_ascii_uppercase()).map(|c| (c as usize) - 65).collect()
}

/// Converts a numeric vector representation into a `String`
/// # Arguments
/// * `arr` - Numeric vector of the word
/// # Returns
/// * `String` - `arr` converted into a `String`, with each number converted from 'A' (0) to 'Z' (25)
/// # See also
/// `convert_word_to_array`
fn convert_array_to_word(arr: &Word) -> String {
    arr.iter().map(|c| (*c as u8+65) as char).collect()
}

/// Converts a `board` to a vector of vectors of strings
/// # Arguments
/// * `board` - Board to display
/// * `min_col` - Minimum occupied column index
/// * `max_col` - Maximum occupied column index
/// * `min_row` - Minimum occupied row index
/// * `max_row` - Maximum occupied row index
/// # Returns
/// * `Vec<Vec<String>>` - `board` in vector form (with all numbers converted to letters)
fn board_to_vec(board: &Board, min_col: usize, max_col: usize, min_row: usize, max_row: usize, previous_idxs: &HashSet<(usize, usize)>) -> Vec<Vec<String>> {
    let mut board_vec: Vec<Vec<String>> = Vec::with_capacity(max_row-min_row);
    for row in min_row..=max_row {
        let mut row_vec: Vec<String> = Vec::with_capacity(max_col-min_col);
        for col in min_col..=max_col {
            if board.get_val(row, col) == EMPTY_VALUE {
                row_vec.push(' '.to_string());
            }
            else {
                if !previous_idxs.contains(&(row, col)) {
                    row_vec.push(((board.get_val(row, col) as u8+65) as char).to_string());
                }
                else {
                    row_vec.push(((board.get_val(row, col) as u8+65) as char).to_string() + "*");
                }
            }
        }
        board_vec.push(row_vec);
    }
    return board_vec;
}

#[wasm_bindgen]
pub fn js_board_to_vec(board: &[u8], min_col: usize, max_col: usize, min_row: usize, max_row: usize) -> JsValue {
    let b = Board { arr: board.into_iter().map(|c| *c as usize).collect() };
    return to_value(&board_to_vec(&b, min_col, max_col, min_row, max_row, &HashSet::new())).unwrap_or(JsValue::from_str("Failed to serialize!"));
}

/// Checks whether a `word` can be made using the given `letters`
/// # Arguments
/// * `word` - The vector form of the word to check
/// * `letters` - Length-26 array of the number of each letter in the hand
/// # Returns
/// * `bool` - Whether `word` can be made using `letters`
fn is_makeable(word: &Word, letters: &Letters) -> bool {
    let mut available_letters = letters.clone();
    for letter in word.iter() {
        if available_letters.get(*letter).unwrap() == &0 {
            return false;
        }
        let elem = available_letters.get_mut(*letter).unwrap();
        *elem -= 1;
    }
    return true;
}

/// Removes words that can't be played with `current_letters` plus a set number of `board_letters`
/// # Arguments
/// * `current_letters` - Letters currently available in the hand
/// * `board_letters` - Letters played on the board
/// * `word_being_checked` - Word to check if it contains the appropriate number of letters
/// * `filter_letters_on_board` - Maximum number of letters from `board_letters` that can be used when checking if the word can be played
/// # Returns
/// * `bool` - Whether `word_being_checked` should pass the filter
fn check_filter_after_play_later(mut current_letters: Letters, mut board_letters: Letters, word_being_checked: &Word, filter_letters_on_board: usize) -> bool {
    let mut num_from_board = 0usize;
    for letter in word_being_checked.iter() {
        let num_in_hand = current_letters.get_mut(*letter).unwrap();
        if *num_in_hand == 0 {
            if num_from_board == filter_letters_on_board {
                return false;
            }
            let num_on_board = board_letters.get_mut(*letter).unwrap();
            if *num_on_board == 0 {
                return false;
            }
            *num_on_board -= 1;
            num_from_board += 1;
        }
        else {
            *num_in_hand -= 1;
        }
    }
    return true;
}

/// Checks which words can be played after the first
/// # Arguments
/// * `letters` - Length-26 array of originally available letters
/// * `word_being_checked` - Word that is being checked if playable
/// * `played_on_board` - Set of the letters played on the board
/// # Returns
/// * `bool` - Whether the `word_being_checked` is playable
fn check_filter_after_play(mut letters: Letters, word_being_checked: &Word, played_on_board: &HashSet<usize>) -> bool {
    let mut already_seen_negative = false;
    for letter in word_being_checked.iter() {
        let elem = letters.get_mut(*letter).unwrap();
        if *elem == 0 && !played_on_board.contains(letter) {
            return false;
        }
        else if *elem <= 0 && already_seen_negative {
            return false;
        }
        else if *elem == 0 {
            already_seen_negative = true;
        }
        else {
            *elem -= 1;
        }
    }
    return true;
}

/// Checks that a `board` is valid after a word is played horizontally, given the specified list of `valid_word`s
/// Note that this does not check if all words are contiguous; this condition must be enforced elsewhere.
/// # Arguments
/// * `board` - `Board` being checked
/// * `min_col` - Minimum x (column) index of the subsection of the `board` to be checked
/// * `max_col` - Maximum x (column) index of the subsection of the `board` to be checked
/// * `min_row` - Minimum y (row) index of the subsection of the `board` to be checked
/// * `max_row` - Maximum y (row) index of the subsection of the `board` to be checked
/// * `row` - Row of the word played
/// * `start_col` - Starting column of the word played
/// * `end_col` - Ending column of the word played
/// * `valid_words` - HashSet of all valid words as `Vec<usize>`s
/// # Returns
/// `bool` - whether the given `board` is made only of valid words
fn is_board_valid_horizontal(board: &Board, min_col: usize, max_col: usize, min_row: usize, max_row: usize, row: usize, start_col: usize, end_col: usize, valid_words: &HashSet<&Word>) -> bool {
    let mut current_letters: Vec<usize> = Vec::with_capacity(MAX_WORD_LENGTH);
    // Find the furthest left column that the new play is connected to
    let mut minimum_col = start_col;
    while minimum_col > min_col {
        if board.get_val(row, minimum_col - 1) == EMPTY_VALUE {
            break;
        }
        minimum_col -= 1;
    }

    // Check across the row where the word was played
    for col_idx in minimum_col..=max_col {
        // If we're not at an empty square, add it to the current word we're looking at
        if board.get_val(row, col_idx) != EMPTY_VALUE {
            current_letters.push(board.get_val(row, col_idx));
        }
        else {
            // Turns out that checking with a set is faster than using a trie, at least for smaller hands
            if current_letters.len() > 1 && !valid_words.contains(&current_letters) {
                return false;
            }
            current_letters.clear();
            if col_idx > end_col {
                break;
            }
        }
    }
    if current_letters.len() > 1 && !valid_words.contains(&current_letters) {
        return false;
    }
    // Check down each column where a letter was played
    for col_idx in start_col..=end_col {
        current_letters.clear();
        // Find the furthest up row that the word is connected to
        let mut minimum_row = row;
        while minimum_row > min_row {
            if board.get_val(minimum_row - 1, col_idx) == EMPTY_VALUE {
                break;
            }
            minimum_row -= 1;
        }

        for row_idx in minimum_row..=max_row {
            if board.get_val(row_idx, col_idx) != EMPTY_VALUE {
                current_letters.push(board.get_val(row_idx, col_idx));
            }
            else {
                if current_letters.len() > 1 && !valid_words.contains(&current_letters) {
                    return false;
                }
                current_letters.clear();
                if row_idx > row {
                    break;
                }
            }
        }
        if current_letters.len() > 1 && !valid_words.contains(&current_letters) {
            return false;
        }
    }
    true
}

/// Checks that a `board` is valid after a word is played vertically, given the specified list of `valid_word`s
/// Note that this does not check if all words are contiguous; this condition must be enforced elsewhere.
/// # Arguments
/// * `board` - `Board` being checked
/// * `min_col` - Minimum x (column) index of the subsection of the `board` to be checked
/// * `max_col` - Maximum x (column) index of the subsection of the `board` to be checked
/// * `min_row` - Minimum y (row) index of the subsection of the `board` to be checked
/// * `max_row` - Maximum y (row) index of the subsection of the `board` to be checked
/// * `start_row` - Starting row of the word played
/// * `end_row` - Ending row of the word played
/// * `col` - Column of the word played
/// * `valid_words` - HashSet of all valid words as `Vec<usize>`s
/// # Returns
/// `bool` - whether the given `board` is made only of valid words
fn is_board_valid_vertical(board: &Board, min_col: usize, max_col: usize, min_row: usize, max_row: usize, start_row: usize, end_row: usize, col: usize, valid_words: &HashSet<&Word>) -> bool {
    let mut current_letters: Vec<usize> = Vec::with_capacity(MAX_WORD_LENGTH);
    // Find the furthest up row that the new play is connected to
    let mut minimum_row = start_row;
    while minimum_row > min_row {
        if board.get_val(minimum_row - 1, col) == EMPTY_VALUE {
            break;
        }
        minimum_row -= 1;
    }
    // Check down the column where the word was played
    for row_idx in minimum_row..=max_row {
        // If it's not an empty value, add it to the current word
        if board.get_val(row_idx, col) != EMPTY_VALUE {
            current_letters.push(board.get_val(row_idx, col));
        }
        else {
            // Otherwise, check if we have more than one letter - if so, check if the word is valid
            if current_letters.len() > 1 && !valid_words.contains(&current_letters) {
                return false;
            }
            current_letters.clear();
            // If we're past the end of the played word, no need to check farther
            if row_idx > end_row {
                break;
            }
        }
    }
    // In case we don't hit the `else` in the previous loop
    if current_letters.len() > 1 {
        if !valid_words.contains(&current_letters) {
            return false;
        }
    }
    // Check across each row where a letter was played
    for row_idx in start_row..=end_row {
        current_letters.clear();
        // Find the furthest left column that the word is connected to
        let mut minimum_col = col;
        while minimum_col > min_col {
            if board.get_val(row_idx, minimum_col - 1) == EMPTY_VALUE {
                break;
            }
            minimum_col -= 1;
        }
        for col_idx in minimum_col..=max_col {
            if board.get_val(row_idx, col_idx) != EMPTY_VALUE {
                current_letters.push(board.get_val(row_idx, col_idx));
            }
            else {
                if current_letters.len() > 1 && !valid_words.contains(&current_letters) {
                    return false;
                }
                current_letters.clear();
                if col_idx > col {
                    break;
                }
            }
        }
        if current_letters.len() > 1 && !valid_words.contains(&current_letters) {
            return false;
        }
    }
    return true;
}

/// Gets the minimum and maximum columns where a word could be played at `row` on `board`
/// # Arguments
/// * `board` - Board to search
/// * `row` - Row to check
/// * `min_col` - Minimum occupied column on `board`
/// * `max_col` - Maximum occupied column on `board`
/// # Returns
/// * `(usize, usize)` - Length-2 tuple of the (minimum column, maximum column) where a word could be played
fn get_col_limits(board: &Board, row: usize, min_col: usize, max_col: usize) -> (usize, usize) {
    let mut leftmost = max_col;
    let mut rightmost = min_col;
    if row == 0 {
        for col in min_col..max_col {
            if board.get_val(row, col) != EMPTY_VALUE || board.get_val(row+1, col) != EMPTY_VALUE {
                leftmost = col;
                break;
            }
        }
        for col in (min_col..=max_col).rev() {
            if board.get_val(row, col) != EMPTY_VALUE || board.get_val(row+1, col) != EMPTY_VALUE {
                rightmost = col;
                break;
            }
        }
    }
    else if row == BOARD_SIZE-1 {
        for col in min_col..max_col {
            if board.get_val(row, col) != EMPTY_VALUE || board.get_val(row-1, col) != EMPTY_VALUE {
                leftmost = col;
                break;
            }
        }
        for col in (min_col..=max_col).rev() {
            if board.get_val(row, col) != EMPTY_VALUE || board.get_val(row-1, col) != EMPTY_VALUE {
                rightmost = col;
                break;
            }
        }
    }
    else {
        for col in min_col..max_col {
            if board.get_val(row-1, col) != EMPTY_VALUE || board.get_val(row, col) != EMPTY_VALUE || board.get_val(row+1, col) != EMPTY_VALUE {
                leftmost = col;
                break;
            }
        }
        for col in (min_col..=max_col).rev() {
            if board.get_val(row-1, col) != EMPTY_VALUE || board.get_val(row, col) != EMPTY_VALUE || board.get_val(row+1, col) != EMPTY_VALUE {
                rightmost = col;
                break;
            }
        }
    }
    (leftmost, rightmost)
}

/// Gets the minimum and maximum rows where a word could be played at `col` on `board`
/// # Arguments
/// * `board` - Board to search
/// * `col` - Column to check
/// * `min_row` - Minimum occupied row on `board`
/// * `max_row` - Maximum occupied row on `board`
/// # Returns
/// * `(usize, usize)` - Length-2 tuple of the (minimum row, maximum row) where a word could be played
fn get_row_limits(board: &Board, col: usize, min_row: usize, max_row: usize) -> (usize, usize) {
    let mut uppermost = min_row;
    let mut lowermost = max_row;
    if col == 0 {
        for row in min_row..max_row {
            if board.get_val(row, col) != EMPTY_VALUE || board.get_val(row, col+1) != EMPTY_VALUE {
                uppermost = row;
                break;
            }
        }
        for row in (min_row..=max_row).rev() {
            if board.get_val(row, col) != EMPTY_VALUE || board.get_val(row, col+1) != EMPTY_VALUE {
                lowermost = row;
                break;
            }
        }
    }
    else if col == BOARD_SIZE-1 {
        for row in min_row..max_row {
            if board.get_val(row, col) != EMPTY_VALUE || board.get_val(row, col-1) != EMPTY_VALUE {
                uppermost = row;
                break;
            }
        }
        for row in (min_row..=max_row).rev() {
            if board.get_val(row, col) != EMPTY_VALUE || board.get_val(row, col-1) != EMPTY_VALUE {
                lowermost = row;
                break;
            }
        }
    }
    else {
        for row in min_row..max_row {
            if board.get_val(row, col-1) != EMPTY_VALUE || board.get_val(row, col) != EMPTY_VALUE || board.get_val(row, col+1) != EMPTY_VALUE {
                uppermost = row;
                break;
            }
        }
        for row in (min_row..=max_row).rev() {
            if board.get_val(row, col-1) != EMPTY_VALUE || board.get_val(row, col) != EMPTY_VALUE || board.get_val(row, col+1) != EMPTY_VALUE {
                lowermost = row;
                break;
            }
        }
    }
    (uppermost, lowermost)
}

/// Tries to play a word horizontally anywhere on the `board`
/// # Arguments
/// * `board` - The `Board` to modify in-place
/// * `word` - Word to try to play
/// * `min_col` - Minimum occupied column index in `board`
/// * `max_col` - Maximum occupied column index in `board`
/// * `min_row` - Minimum occupied row index in `board`
/// * `max_row` - Maximum occupied row index in `board`
/// * `valid_words_vec` - Vector of vectors, each representing a word (see `convert_word_to_array`)
/// * `valid_words_set` - HashSet of vectors, each representing a word (a HashSet version of `valid_words_vec` for faster membership checking)
/// * `letters` - Length-26 array of the number of each letter in the hand
/// * `depth` - Depth of the current recursive call
/// * `words_checked` - The number of words checked in total
/// * `letters_on_board` - Length-26 array of the number of each letter currently present on the `board`
/// * `filter_letters_on_board` - Maximum number of letters currently on the board that can be used in a newly played word
/// * `max_words_to_check` - Maximum number of words to check before stopping
/// # Returns
/// *`Result` with `Option` upon success with:*
/// * `bool` - Whether the word could be validly played
/// * `usize` - Minimum occupied column index in `board`
/// * `usize` - Maximum occupied column index in `board`
/// * `usize` - Minimum occupied row index in `board`
/// * `usize` - Maximum occupied row index in `board`
/// 
/// *or `None` if no valid playing location was found, or empty `Err` another thread signalled to stop*
fn try_play_word_horizontal(board: &mut Board, word: &Word, min_col: usize, max_col: usize, min_row: usize, max_row: usize, valid_words_vec: &Vec<&Word>, valid_words_set: &HashSet<&Word>, letters: Letters, depth: usize, words_checked: &mut usize, letters_on_board: &mut Letters, filter_letters_on_board: usize, max_words_to_check: usize) -> Result<Option<(bool, usize, usize, usize, usize)>, ()> {
    // Try across all rows (starting from one before to one after)
    for row_idx in min_row.saturating_sub(1)..=BOARD_SIZE.min(max_row+1) {
        let (leftmost_col, rightmmost_col) = get_col_limits(board, row_idx, min_col, max_col);
        // For each row, try across all columns (starting from the farthest out the word could be played)
        for col_idx in leftmost_col.saturating_sub(word.len())..=BOARD_SIZE.min(rightmmost_col+1) {
            let res = board.play_word(word, row_idx, col_idx, Direction::Horizontal, &letters, letters_on_board);
            if res.0 {
                // If the word was played successfully (i.e. it's not a complete overlap and it borders at least one existing tile), then check the validity of the new words it forms
                let new_min_col = min_col.min(col_idx);
                let new_max_col = max_col.max(col_idx+word.len());
                let new_min_row = min_row.min(row_idx);
                let new_max_row = max_row.max(row_idx);
                if is_board_valid_horizontal(board, new_min_col, new_max_col, new_min_row, new_max_row, row_idx, col_idx, col_idx+word.len()-1, valid_words_set) {
                    // If it's valid, go to the next recursive level (unless we've all the letters, at which point we're done)
                    match res.3 {
                        LetterUsage::Finished => {
                            return Ok(Some((true, new_min_col, new_max_col, new_min_row, new_max_row)));
                        },
                        LetterUsage::Remaining => {
                            let mut new_valid_words_vec: Vec<&Word> = Vec::with_capacity(valid_words_vec.len()/2);
                            for i in 0..valid_words_vec.len() {
                                if check_filter_after_play_later(letters.clone(), letters_on_board.clone(), valid_words_vec[i], filter_letters_on_board) {
                                    new_valid_words_vec.push(valid_words_vec[i]);
                                }
                            }
                            let res2 = play_further(board, new_min_col, new_max_col, new_min_row, new_max_row, &new_valid_words_vec, valid_words_set, res.2, depth+1, words_checked, letters_on_board, filter_letters_on_board, max_words_to_check)?;
                            if res2.0 {
                                // If that recursive stack finishes successfully, we're done! (could have used another Result or Option rather than a bool in the returned tuple, but oh well)
                                return Ok(Some(res2));
                            }
                            else {
                                // Otherwise, undo the previous play (cloning the board before each play so we don't have to undo is *way* slower)
                                board.undo_play(&res.1, letters_on_board);
                            }
                        },
                        LetterUsage::Overused => unreachable!()
                    }
                }
                else {
                    // If the play formed some invalid words, undo the previous play
                    board.undo_play(&res.1, letters_on_board);
                }
            }
            else {
                // If trying to play the board was invalid, undo the play
                board.undo_play(&res.1, letters_on_board);
            }
        }
    }
    Ok(None)
}

/// Tries to play a word vertically anywhere on the `board`
/// # Arguments
/// * `board` - The `Board` to modify in-place
/// * `word` - Word to try to play
/// * `min_col` - Minimum occupied column index in `board`
/// * `max_col` - Maximum occupied column index in `board`
/// * `min_row` - Minimum occupied row index in `board`
/// * `max_row` - Maximum occupied row index in `board`
/// * `valid_words_vec` - Vector of vectors, each representing a word (see `convert_word_to_array`)
/// * `valid_words_set` - HashSet of vectors, each representing a word (a HashSet version of `valid_words_vec` for faster membership checking)
/// * `letters` - Length-26 array of the number of each letter in the hand
/// * `depth` - Depth of the current recursive call
/// * `words_checked` - The number of words checked in total
/// * `letters_on_board` - Length-26 array of the number of each letter currently present on the `board`
/// * `filter_letters_on_board` - Maximum number of letters currently on the board that can be used in a newly played word
/// * `max_words_to_check` - Maximum number of words to check before stopping
/// # Returns
/// *`Result` with `Option` upon success with:*
/// * `bool` - Whether the word could be validly played
/// * `usize` - Minimum occupied column index in `board`
/// * `usize` - Maximum occupied column index in `board`
/// * `usize` - Minimum occupied row index in `board`
/// * `usize` - Maximum occupied row index in `board`
/// 
/// *or `None` if no valid playing location was found, or empty `Err` if another thread signalled to stop*
fn try_play_word_vertically(board: &mut Board, word: &Word, min_col: usize, max_col: usize, min_row: usize, max_row: usize, valid_words_vec: &Vec<&Word>, valid_words_set: &HashSet<&Word>, letters: Letters, depth: usize, words_checked: &mut usize, letters_on_board: &mut Letters, filter_letters_on_board: usize, max_words_to_check: usize) -> Result<Option<(bool, usize, usize, usize, usize)>, ()> {
    // Try down all columns
    for col_idx in min_col.saturating_sub(1)..=BOARD_SIZE.min(max_col+1) {
        let (uppermost_row, lowermost_row) = get_row_limits(board, col_idx, min_row, max_row);
        // This is analagous to the above
        for row_idx in uppermost_row.saturating_sub(word.len())..=BOARD_SIZE.min(lowermost_row+1) {
            let res = board.play_word(word, row_idx, col_idx, Direction::Vertical, &letters, letters_on_board);
            if res.0 {
                let new_min_col = min_col.min(col_idx);
                let new_max_col = max_col.max(col_idx);
                let new_min_row = min_row.min(row_idx);
                let new_max_row = max_row.max(row_idx+word.len());
                if is_board_valid_vertical(board, new_min_col, new_max_col, new_min_row, new_max_row, row_idx, row_idx+word.len()-1, col_idx, valid_words_set) {
                    match res.3 {
                        LetterUsage::Finished => {
                            return Ok(Some((true, new_min_col, new_max_col, new_min_row, new_max_row)));
                        },
                        LetterUsage::Remaining => {
                            let mut new_valid_words_vec: Vec<&Word> = Vec::with_capacity(valid_words_vec.len()/2);
                            for i in 0..valid_words_vec.len() {
                                if check_filter_after_play_later(letters.clone(), letters_on_board.clone(), valid_words_vec[i], filter_letters_on_board) {
                                    new_valid_words_vec.push(valid_words_vec[i]);
                                }
                            }
                            let res2 = play_further(board, new_min_col, new_max_col, new_min_row, new_max_row, &new_valid_words_vec, valid_words_set, res.2, depth+1, words_checked, letters_on_board, filter_letters_on_board, max_words_to_check)?;
                            if res2.0 {
                                return Ok(Some(res2));
                            }
                            else {
                                board.undo_play(&res.1, letters_on_board);
                            }
                        },
                        LetterUsage::Overused => unreachable!()
                    }
                }
                else {
                    board.undo_play(&res.1, letters_on_board);
                }
            }
            else {
                board.undo_play(&res.1, letters_on_board);
            }
        }
    }
    Ok(None)
}

/// Recursively solves Bananagrams
/// # Arguments
/// * `board` - The `Board` to modify in-place
/// * `min_col` - Minimum occupied column index in `board`
/// * `max_col` - Maximum occupied column index in `board`
/// * `min_row` - Minimum occupied row index in `board`
/// * `max_row` - Maximum occupied row index in `board`
/// * `valid_words_vec` - Vector of vectors, each representing a word (see `convert_word_to_array`)
/// * `valid_words_set` - HashSet of vectors, each representing a word (a HashSet version of `valid_words_vec` for faster membership checking)
/// * `letters` - Length-26 array of the number of each letter in the hand
/// * `depth` - Depth of the current recursive call
/// * `words_checked` - The number of words checked in total
/// * `letters_on_board` - Length-26 array of the number of each letter currently present on the `board`
/// * `filter_letters_on_board` - Maximum number of letters currently on the board that can be used in a newly played word
/// * `max_words_to_check` - Maximum number of words to check before stopping
/// # Returns
/// *`Result` with:*
/// * `bool` - Whether the word could be validly played
/// * `usize` - Minimum occupied column index in `board`
/// * `usize` - Maximum occupied column index in `board`
/// * `usize` - Minimum occupied row index in `board`
/// * `usize` - Maximum occupied row index in `board`
/// 
/// *or empty `Err` if past the maximum number of words to check*
fn play_further(board: &mut Board, min_col: usize, max_col: usize, min_row: usize, max_row: usize, valid_words_vec: &Vec<&Word>, valid_words_set: &HashSet<&Word>, letters: Letters, depth: usize, words_checked: &mut usize, letters_on_board: &mut Letters, filter_letters_on_board: usize, max_words_to_check: usize) -> Result<(bool, usize, usize, usize, usize), ()> {
    if *words_checked > max_words_to_check {
        return Err(());
    }
    // If we're at an odd depth, play horizontally first (trying to alternate horizontal-vertical-horizontal as a heuristic to solve faster)
    if depth % 2 == 1 {
        for word in valid_words_vec.iter() {
            *words_checked += 1;
            if let Some(r) = try_play_word_horizontal(board, word, min_col, max_col, min_row, max_row, valid_words_vec, valid_words_set, letters, depth, words_checked, letters_on_board, filter_letters_on_board, max_words_to_check)? {
                return Ok(r);
            }
        }
        // If trying every word horizontally didn't work, try vertically instead
        for word in valid_words_vec.iter() {
            *words_checked += 1;
            if let Some(r) = try_play_word_vertically(board, word, min_col, max_col, min_row, max_row, valid_words_vec, valid_words_set, letters, depth, words_checked, letters_on_board, filter_letters_on_board, max_words_to_check)? {
                return Ok(r);
            }
        }
        return Ok((false, min_col, max_col, min_row, max_row));
    }
    // If we're at an even depth, play vertically first. Otherwise this is analgous to the above.
    else {
        for word in valid_words_vec.iter() {
            *words_checked += 1;
            if let Some(r) = try_play_word_vertically(board, word, min_col, max_col, min_row, max_row, valid_words_vec, valid_words_set, letters, depth, words_checked, letters_on_board, filter_letters_on_board, max_words_to_check)? {
                return Ok(r);
            }
        }
        // No point in checking horizontally for the first depth, since it would have to form a vertical word that was already checked and failed
        if depth == 0 {
            return Ok((false, min_col, max_col, min_row, max_row));
        }
        for word in valid_words_vec.iter() {
            *words_checked += 1;
            if let Some(r) = try_play_word_horizontal(board, word, min_col, max_col, min_row, max_row, valid_words_vec, valid_words_set, letters, depth, words_checked, letters_on_board, filter_letters_on_board, max_words_to_check)? {
                return Ok(r);
            }
        }
        return Ok((false, min_col, max_col, min_row, max_row));
    }
}

/// Tries to play a single letter on the board
/// # Arguments
/// * `board` - The `Board` on which to try to play the `letter`
/// * `min_col` - Minimum occupied column index in `board`
/// * `max_col` - Maximum occupied column index in `board`
/// * `min_row` - Minimum occupied row index in `board`
/// * `max_row` - Maximum occupied row index in `board`
/// * `letter` - The numeric representation of the letter to play
/// * `valid_words_set` - HashSet of all valid words
/// # Returns
/// `Option` - either `None` if no solution was found, or a `Some` tuple of `(row, col, new_min_col, new_max_col, new_min_row, new_max_row)` on success
fn play_one_letter(board: &mut Board, min_col: usize, max_col: usize, min_row: usize, max_row: usize, letter: usize, valid_words_set: &HashSet<&Word>) -> Option<(usize, usize, usize, usize, usize, usize)> {
    // Loop through all possible locations and check if the letter works there
    for row in min_row.saturating_sub(1)..=BOARD_SIZE.min(max_row+1) {
        for col in min_col.saturating_sub(1)..=BOARD_SIZE.min(max_col+1) {
            if row < BOARD_SIZE && col < BOARD_SIZE && board.get_val(row, col) == EMPTY_VALUE {   // row/col don't need to be checked if they're greater than 0 since they'd underflow
                if (col > 0 && board.get_val(row, col-1) != EMPTY_VALUE) || (col < BOARD_SIZE-1 && board.get_val(row, col+1) != EMPTY_VALUE) || (row > 0 && board.get_val(row-1, col) != EMPTY_VALUE) || (row < BOARD_SIZE-1 && board.get_val(row+1, col) != EMPTY_VALUE) {
                    board.set_val(row, col, letter);
                    let new_min_col = min_col.min(col);
                    let new_max_col = max_col.max(col);
                    let new_min_row = min_row.min(row);
                    let new_max_row = max_row.max(row);
                    // Could also use `is_board_valid_vertical`
                    if is_board_valid_horizontal(board, new_min_col, new_max_col, new_min_row, new_max_row, row, col, col, valid_words_set) {
                        // If it's valid, return the (potentially) new bounds, along with the location the letter was played
                        return Some((row, col, new_min_col, new_max_col, new_min_row, new_max_row));
                    }
                    else {
                        // If the board wasn't ok, reset this spot
                        board.set_val(row, col, EMPTY_VALUE);
                    }
                }
            }
        }
    }
    // Return `None` if we don't find a solution
    return None;
}

/// Gets the minimum and maximum occupied row and column from a `board` (assuming that tiles have only been removed)
/// # Arguments
/// * `board` - The `Board` to check
/// * `old_min_col` - The previous mimimum occupied column
/// * `old_max_col` - The previous maximum occupied column
/// * `old_min_row` - The previous minimum occupied row
/// * `old_max_row` - The previous maximum occupied row
/// * `except_vec` - Vector of indices to ignore when checking if occupied
/// # Returns
/// * `usize` - New minimum occupied column (never smaller than `old_min_col`)
/// * `usize` - New maximum occupied column (never greater than `old_min_row`)
/// * `usize` - New minimum occupied row (never smaller than `old_min_row`)
/// * `usize` - New maximum occupied row (never greater than `old_max_row`)
fn get_new_min_max(board: &Board, old_min_col: usize, old_max_col: usize, old_min_row: usize, old_max_row: usize, except_vec: &Vec<(usize, usize)>) -> (usize, usize, usize, usize) {
    let mut except_idxs: HashSet<&(usize, usize)> = HashSet::with_capacity(except_vec.len());
    for idxs in except_vec {
        except_idxs.insert(idxs);
    }
    // Start at the old minimum row and check if that row or any subsequent ones have any non-empty values
    let mut min_row = old_min_row;
    for row in old_min_row..=old_max_row {
        if (old_min_col..old_max_col).any(|col| !except_idxs.contains(&(row, col)) && board.get_val(row, col) != EMPTY_VALUE) {
            break;
        }
        min_row += 1;
    }
    // Start at the test max_row and work our way down
    let mut max_row = old_max_row;
    while max_row > min_row {
        if (old_min_col..old_max_col).any(|col| !except_idxs.contains(&(max_row, col)) && board.get_val(max_row, col) != EMPTY_VALUE) {
            break;
        }
        max_row -= 1;
    }
    // Now do down columns
    let mut min_col = old_min_col;
    for col in old_min_col..=old_max_col {
        if (min_row..max_row).any(|row| !except_idxs.contains(&(row, col)) && board.get_val(row, col) != EMPTY_VALUE) {
            break;
        }
        min_col += 1;
    }
    let mut max_col = old_max_col;
    while max_col > min_col {
        if (min_row..max_row).any(|row| !except_idxs.contains(&(row, max_col)) && board.get_val(row, max_col) != EMPTY_VALUE) {
            break;
        }
        max_col -= 1;
    }
    (min_col, max_col, min_row, max_row)
}

/// Checks whether the `board` is fully connected; this code is mostly from ChatGPT
/// # Arguments
/// * `board` - Board to check
/// * `min_col` - The minimum played column
/// * `max_col` - The maximum played column
/// * `min_row` - The minimum played row
/// * `max_row` - The maximum played row
/// * `ignore_cells` - Locations to ignore
/// # Returns
/// * `bool` - Whether `board` is fully connected
fn is_connected(board: &Board, min_col: usize, max_col: usize, min_row: usize, max_row: usize, ignored_cells: &Vec<(usize, usize)>) -> bool {
    // Create a HashSet from the ignored cells for efficient lookup
    let ignored_cells: HashSet<_> = ignored_cells.into_iter().collect();

    // Find the starting point
    let mut start: Option<(usize, usize)> = None;
    for row in min_row..=max_row {
        for col in min_col..=max_col {
            if board.get_val(row, col) != EMPTY_VALUE && !ignored_cells.contains(&(row, col)) {
                start = Some((row, col));
                break;
            }
        }
        if start.is_some() {
            break;
        }
    }

    // If no starting point found, board is trivially connected
    if start.is_none() {
        return true;
    }

    let (start_row, start_col) = start.unwrap();

    // Perform DFS to check connectivity
    let mut visited = HashSet::new();
    let mut stack = vec![(start_row, start_col)];

    let directions = [(0, 1), (1, 0), (0, -1), (-1, 0)];

    while let Some((row, col)) = stack.pop() {
        if !visited.insert((row, col)) {
            continue;
        }

        for (dr, dc) in &directions {
            let new_row = (row as isize + dr) as usize;
            let new_col = (col as isize + dc) as usize;

            if new_row >= min_row && new_row <= max_row && new_col >= min_col && new_col <= max_col {
                if board.get_val(new_row, new_col) != EMPTY_VALUE && !visited.contains(&(new_row, new_col)) && !ignored_cells.contains(&(new_row, new_col)) {
                    stack.push((new_row, new_col));
                }
            }
        }
    }

    // Check if all occupied cells are visited
    for row in min_row..=max_row {
        for col in min_col..=max_col {
            if board.get_val(row, col) != EMPTY_VALUE && !ignored_cells.contains(&(row, col)) && !visited.contains(&(row, col)) {
                return false;
            }
        }
    }
    true
}

/// Gets a vector of vectors of each part of a word that can be validly removed from the `board`
/// # Arguments
/// * `board` - The board to check for removable word parts
/// * `min_col` - The minimum played column
/// * `max_col` - The maximum played column
/// * `min_row` - The minimum played row
/// * `max_row` - The maximum played row
/// # Returns
/// `Vec` - Vector of length-5 tuples of (vector of length-2 index tuples of the indices of `board` that can be validly removed, new_min_col, new_max_col, new_min_row, new_max_row)
fn get_removable_indices(board: &Board, min_col: usize, max_col: usize, min_row: usize, max_row: usize) -> Vec<Removable> {
    if max_col <= min_col || max_row <= min_row {
        return Vec::new();
    }
    let mut removable: Vec<Removable> = Vec::with_capacity((max_col - min_col) + (max_row - min_row));
    let mut board_empty = true;
    // First get horizontal removable word parts
    for row in min_row..=max_row {
        let mut current_word_part: Vec<(usize, usize)> = Vec::with_capacity(max_col-min_col);
        for col in min_col..=max_col {
            let touching = (row != 0 && board.get_val(row-1, col) != EMPTY_VALUE) || (row != BOARD_SIZE-1 && board.get_val(row+1, col) != EMPTY_VALUE);
            if board.get_val(row, col) != EMPTY_VALUE && !touching {
                current_word_part.push((row, col));
            }
            else if board.get_val(row, col) == EMPTY_VALUE && current_word_part.len() > 0 {
                if is_connected(board, min_col, max_col, min_row, max_row, &current_word_part) {
                    let new_min_max = get_new_min_max(board, min_col, max_col, min_row, max_row, &current_word_part);
                    removable.push((current_word_part.clone(), new_min_max.0, new_min_max.1, new_min_max.2, new_min_max.3));
                }
                current_word_part.clear();
            }
            else {
                // There's a non-empty value that didn't get removed (so there's still something on the board)
                board_empty = false;
            }
        }
        if current_word_part.len() > 0 {
            if is_connected(board, min_col, max_col, min_row, max_row, &current_word_part) {
                let new_min_max = get_new_min_max(board, min_col, max_col, min_row, max_row, &current_word_part);
                removable.push((current_word_part.clone(), new_min_max.0, new_min_max.1, new_min_max.2, new_min_max.3));
            }
            current_word_part.clear();
        }
    }
    // If the board is empty, that means there was only a single horizontal word that got removed
    if removable.len() == 1 && board_empty {
        return Vec::new();
    }
    // Then get vertical removable word parts
    for col in min_col..=max_col {
        let mut current_word_part: Vec<(usize, usize)> = Vec::with_capacity(max_col-min_col);
        for row in min_row..=max_row {
            if board.get_val(row, col) != EMPTY_VALUE && !((col != 0 && board.get_val(row, col-1) != EMPTY_VALUE) || (col != BOARD_SIZE-1 && board.get_val(row, col+1) != EMPTY_VALUE)) {
                current_word_part.push((row, col));
            }
            else if board.get_val(row, col) == EMPTY_VALUE && current_word_part.len() > 0 {
                if is_connected(board, min_col, max_col, min_row, max_row, &current_word_part) {
                    let new_min_max = get_new_min_max(board, min_col, max_col, min_row, max_row, &current_word_part);
                    removable.push((current_word_part.clone(), new_min_max.0, new_min_max.1, new_min_max.2, new_min_max.3));
                }
                current_word_part.clear();
            }
            else {
                board_empty = false;
            }
        }
        if current_word_part.len() > 0 {
            if is_connected(board, min_col, max_col, min_row, max_row, &current_word_part) {
                let new_min_max = get_new_min_max(board, min_col, max_col, min_row, max_row, &current_word_part);
                removable.push((current_word_part.clone(), new_min_max.0, new_min_max.1, new_min_max.2, new_min_max.3));
            }
            current_word_part.clear();
        }
    }
    if board_empty {
        return Vec::new();
    }
    removable
}

/// Recursively plays on an existing board by removing letters
/// # Arguments
/// * `board` - Existing board (will be modified in-place)
/// * `letters_on_board` - Current letters on the `board`
/// * `min_col` - Minimum occupied column index in `board`
/// * `max_col` - Maximum occupied column index in `board`
/// * `min_row` - Minimum occupied row index in `board`
/// * `max_row` - Maximum occupied row index in `board`
/// * `hand_letters` - Letters currently in the hand
/// * `valid_words_vec` - Valid words that can be played on `board`
/// * `valid_words_set` - Set of all valid words
/// * `filter_letters_on_board` - Maximum number of letters from the board that can be used in a word
/// * `max_words_to_check` - Maximum number of words to check
/// # Returns
/// `Option` - either `None` if no solution was found, or a `Some` tuple of `(new_min_col, new_max_col, new_min_row, new_max_row)` on success
fn play_removing(board: &mut Board, letters_on_board: &mut Letters, min_col: usize, max_col: usize, min_row: usize, max_row: usize, hand_letters: Letters, valid_words_vec: &Vec<&Word>, valid_words_set: &HashSet<&Word>, filter_letters_on_board: usize, max_words_to_check: usize) -> Option<(usize, usize, usize, usize)> {
    let mut words_checked = 0usize;
    // First try to play the words on the board, first horizontally and then vertically
    for word in valid_words_vec {
        match try_play_word_horizontal(board, word, min_col, max_col, min_row, max_row, valid_words_vec, valid_words_set, hand_letters, 0, &mut words_checked, &mut letters_on_board.clone(), filter_letters_on_board, max_words_to_check) {
            Ok(r) => {
                // Ok + Some indicates that a solution was found
                if let Some(rr) = r {
                    // If we found a solution, return it
                    if rr.0 {
                        return Some((rr.1, rr.2, rr.3, rr.4));
                    }
                    // Otherwise, try to play the word vertically
                    else {
                        match try_play_word_vertically(board, word, min_col, max_col, min_row, max_row, valid_words_vec, valid_words_set, hand_letters, 0, &mut words_checked, &mut letters_on_board.clone(), filter_letters_on_board, max_words_to_check) {
                            Ok(rrr) => {
                                if let Some(rrrr) = rrr {
                                    if rrrr.0 {
                                        return Some((rrrr.1, rrrr.2, rrrr.3, rrrr.4));
                                    }
                                }
                            },
                            Err(_) => {
                                return None;
                            }
                        }
                    }
                }
                else {
                    match try_play_word_vertically(board, word, min_col, max_col, min_row, max_row, valid_words_vec, valid_words_set, hand_letters, 0, &mut words_checked, &mut letters_on_board.clone(), filter_letters_on_board, max_words_to_check) {
                        Ok(rrr) => {
                            if let Some(rrrr) = rrr {
                                if rrrr.0 {
                                    return Some((rrrr.1, rrrr.2, rrrr.3, rrrr.4));
                                }
                            }
                        },
                        Err(_) => {
                            return None;
                        }
                    }
                }
            },
            // An `Err` indicates that a thread signalled to stop
            Err(_) => {
                return None;
            }
        }
    }
    // If playing the word failed, find the new removable_indices and continue recursively
    let mut removable_indices = get_removable_indices(board, min_col, max_col, min_row, max_row);
    removable_indices.sort_unstable_by(|a, b| a.0.len().cmp(&b.0.len()));
    for rmv in removable_indices {
        let mut new_letters_on_board = letters_on_board.clone();
        let prev_vals = board.undo_play(&rmv.0, &mut new_letters_on_board);
        let mut new_hand_letters = hand_letters.clone();
        prev_vals.iter().for_each(|p| {
            new_hand_letters[*p] += 1;
        });
        // If we found a solution, return it
        if let Some(res) = play_removing(board, &mut new_letters_on_board, rmv.1, rmv.2, rmv.3, rmv.4, new_hand_letters, valid_words_vec, valid_words_set, filter_letters_on_board, max_words_to_check) {
            return Some(res);
        }
        // Otherwise undo the undo and continue to the next set of removable indices
        else {
            for (idx, val) in rmv.0.iter().zip(prev_vals) {
                board.set_val(idx.0, idx.1, val);
            }
        }
    }
    None
}

/// Plays a new hand of `letters` on an existing `board`
/// # Arguments
/// * `old_board` - Previous board solution
/// * `min_col` - Minimum occupied column index
/// * `max_col` - Maximum occupied column index
/// * `min_row` - Minimum occupied row index
/// * `max_row` - Maximum occupied row index
/// * `letters` - Letters in the new hand
/// * `filter_letters_on_board` - Maximum number of letters from the board that can be used in a word
/// * `max_words_to_check` - Maximum number of words to check
fn play_existing(old_board: &Board, min_col: usize, max_col: usize, min_row: usize, max_row: usize, letters: &Letters, valid_words_set: &HashSet<&Word>, dict_to_use: &Vec<Word>, filter_letters_on_board: usize, max_words_to_check: usize) -> Option<BoardAndIdxs> {
    // First, try to play words that use only the new letters, plus one already present on the board
    let mut hand_letters = letters.clone();
    let mut old_letters_on_board = [0usize; 26];
    let mut played_on_board: HashSet<usize> = HashSet::new();
    for row in min_row..=max_row {
        for col in min_col..=max_col {
            if old_board.get_val(row, col) != EMPTY_VALUE {
                hand_letters[old_board.get_val(row, col)] -= 1;
                old_letters_on_board[old_board.get_val(row, col)] += 1;
                played_on_board.insert(old_board.get_val(row, col));
            }
        }
    }
    let valid_words_vec: Vec<&Word> = dict_to_use.iter().filter(|w| check_filter_after_play_later(hand_letters.clone(), old_letters_on_board.clone(), w, filter_letters_on_board)).collect();
    if !valid_words_vec.is_empty() {
        // Loop through each word and play it on a new board
        let mut words_checked = 0;
        let mut board = old_board.clone();
        for word in valid_words_vec.iter() {
            match try_play_word_horizontal(&mut board, word, min_col, max_col, min_row, max_row, &valid_words_vec, &valid_words_set, hand_letters, 0, &mut words_checked, &mut old_letters_on_board.clone(), filter_letters_on_board, max_words_to_check) {
                Ok(r) => {
                    if let Some(rr) = r {
                        if rr.0 {
                            return Some((board, rr.1, rr.2, rr.3, rr.4));
                        }
                        else {
                            match try_play_word_vertically(&mut board, word, min_col, max_col, min_row, max_row, &valid_words_vec, &valid_words_set, hand_letters, 0, &mut words_checked, &mut old_letters_on_board.clone(), filter_letters_on_board, max_words_to_check) {
                                Ok(rrr) => {
                                    if let Some(rrrr) = rrr {
                                        if rrrr.0 {
                                            return Some((board, rrrr.1, rrrr.2, rrrr.3, rrrr.4));
                                        }
                                    }
                                },
                                Err(_) => {
                                    break;
                                }
                            }
                        }
                    }
                    else {
                        match try_play_word_vertically(&mut board, word, min_col, max_col, min_row, max_row, &valid_words_vec, &valid_words_set, hand_letters, 0, &mut words_checked, &mut old_letters_on_board.clone(), filter_letters_on_board, max_words_to_check) {
                            Ok(rrr) => {
                                if let Some(rrrr) = rrr {
                                    if rrrr.0 {
                                        return Some((board, rrrr.1, rrrr.2, rrrr.3, rrrr.4));
                                    }
                                }
                            },
                            Err(_) => {
                                break;
                            }
                        }
                    }
                },
                Err(_) => {
                    break;
                }
            }
        }
    }

    // If that didn't work (or there were no valid words), try recursively looping through indices that can be removed
    let mut removable_indices = get_removable_indices(old_board, min_col, max_col, min_row, max_row);
    removable_indices.sort_unstable_by(|a, b| a.0.len().cmp(&b.0.len()));  // Try smaller sets of removable indices first

    let mut cloned_board = old_board.clone();
    for r in removable_indices {
        // "Undo" the letters that we want to remove
        let mut new_letters_on_board = old_letters_on_board.clone();
        let prev_letters = cloned_board.undo_play(&r.0, &mut new_letters_on_board);
        let mut new_hand_letters = hand_letters.clone();
        prev_letters.iter().for_each(|p| {
            new_hand_letters[*p] += 1;
        });
        let valid_words_vec = dict_to_use.iter().filter(|w| check_filter_after_play_later(new_hand_letters.clone(), new_letters_on_board.clone(), w, filter_letters_on_board)).collect();
        // If we found a solution, set it as a solution and return
        if let Some(res) = play_removing(&mut cloned_board, &mut new_letters_on_board, r.1, r.2, r.3, r.4, new_hand_letters, &valid_words_vec, &valid_words_set, filter_letters_on_board, max_words_to_check) {
            return Some((cloned_board, res.0, res.1, res.2, res.3));
        }
        else {
            // Undo the undo and try with the next set of letters to remove
            for (idx, val) in r.0.iter().zip(prev_letters) {
                cloned_board.set_val(idx.0, idx.1, val);
            }
        }
    }
    // Otherwise, return None
    None
}

/// Gets which indices overlap between `previous_board` and `new_board`
/// # Arguments
/// * `previous_board` - The previous board
/// * `new_board` - The new board
/// * `previous_min_col` - The minimum played column in `previous_board`
/// * `previous_max_col` - The maximum played column in `previous_board`
/// * `previous_min_row` - The minimum played row in `previous_board`
/// * `previous_max_row` - The maximum played row in `previous_board`
/// * `new_min_col` - The minimum played column in `new_board`
/// * `new_max_col` - The maximum played column in `new_board`
/// * `new_min_row` - The minimum played row in `new_board`
/// * `new_max_row` - The maximum played row in `new_board`
/// # Returns
/// `HashSet` - Set of the indices where `previous_board` and `new_board` have the same value
fn get_board_overlap(previous_board: &Board, new_board: &Board, previous_min_col: usize, previous_max_col: usize, previous_min_row: usize, previous_max_row: usize, new_min_col: usize, new_max_col: usize, new_min_row: usize, new_max_row: usize) -> HashSet<(usize, usize)> {
    let mut overlapping_idxs: HashSet<(usize, usize)> = HashSet::new();
    for row in previous_min_row.max(new_min_row)..=previous_max_row.min(new_max_row) {
        for col in previous_min_col.max(new_min_col)..=previous_max_col.min(new_max_col) {
            if previous_board.get_val(row, col) != EMPTY_VALUE && previous_board.get_val(row, col) == new_board.get_val(row, col) {
                overlapping_idxs.insert((row, col));
            }
        }
    }
    overlapping_idxs
}

/// Struct for returning a solution to the frontend
#[derive(Serialize)]
pub struct Solution {
    /// Flattened representation of the board
    pub board: Vec<usize>,
    /// 2D vector of strings representing the solved board
    pub board_string: Vec<Vec<String>>,
    /// Length-26 array of the number of each letter presennt in the hand
    pub letters: [usize; 26],
    /// Minimum occupied column
    pub min_col: usize,
    /// Maximum occupied column
    pub max_col: usize,
    /// Minimum occupied row
    pub min_row: usize,
    /// Maximum occupied row
    pub max_row: usize
}

/// Struct returned when getting playable words
#[derive(Serialize)]
pub struct PlayableWords {
    /// Playable words using the shorter dictionary
    short: Vec<String>,
    /// Playable words using the whole Scrabble dictionary
    long: Vec<String>
}

/// Play from an existing board
#[wasm_bindgen]
pub fn play_from_existing(letters_array: &[u8], old_letters_array: &[u8], use_long_dictionary: bool, filter_letters_on_board: usize, max_words_to_check: usize, old_board: &[u8], old_min_col: usize, old_max_col: usize, old_min_row: usize, old_max_row: usize) -> JsValue {
    let dict_to_use: &Vec<Word> = if use_long_dictionary { &FULL_DICTIONARY} else { &SHORT_DICTIONARY };
    // Convert the hand of letters into an appropriate representation    
    let mut letters = [0usize; 26];
    for i in 0..26 {
        letters[i] = letters_array[i] as usize;
    }
    let mut old_letters = [0usize; 26];
    for i in 0..26 {
        old_letters[i] = old_letters_array[i] as usize;
    }
    let mut seen_greater: usize = EMPTY_VALUE;
    let mut comparison = LetterComparison::Same;
    for i in 0..26 {
        if letters[i] < old_letters[i] {
            // Any less means we re-do the board, so we can break here
            comparison = LetterComparison::SomeLess;
            break;
        }
        else if letters[i] > old_letters[i] && (seen_greater != EMPTY_VALUE || letters[i] - old_letters[i] != 1) {
            comparison = LetterComparison::GreaterByMoreThanOne;
        }
        else if letters[i] > old_letters[i] {
            comparison = LetterComparison::GreaterByOne;
            seen_greater = i;
        }
    }
    let old_board = Board { arr: old_board.iter().map(|v| *v as usize).collect() };
    match comparison {
        LetterComparison::Same => {
            // If the hand is the same then no need to do anything
            let solution = Solution { board: old_board.arr.clone(), board_string: board_to_vec(&old_board, old_min_col, old_max_col, old_min_row, old_max_row, &HashSet::new()), min_col: old_min_col, max_col: old_max_col, min_row: old_min_row, max_row: old_max_row, letters };
            return to_value(&solution).unwrap_or(JsValue::from_str("Failed to serialize to JS value!"));
        },
        LetterComparison::GreaterByOne => {
            // If only a single letter has increased by one, then first check just that letter
            let valid_words_set: HashSet<&Word> = HashSet::from_iter(dict_to_use.iter().filter(|word| is_makeable(word, &letters)));
            let mut board = old_board.clone();
            let res = play_one_letter(&mut board, old_min_col, old_max_col, old_min_row, old_max_row, seen_greater, &valid_words_set);
            match res {
                Some(result) => {
                    let previous_idxs = get_board_overlap(&old_board, &board, old_min_col, old_max_col, old_min_row, old_max_row, result.2, result.3, result.4, result.5);
                    let solution = Solution { board: board.arr.clone(), board_string: board_to_vec(&board, result.2, result.3, result.4, result.5, &previous_idxs), min_col: result.2, max_col: result.3, min_row: result.4, max_row: result.5, letters };
                    return to_value(&solution).unwrap_or(JsValue::from_str("Failed to serialize to JS value!"));
                },
                None => {
                    // If we failed when playing one letter, try playing off the existing board
                    let attempt = play_existing(&old_board, old_min_col, old_max_col, old_min_row, old_max_row, &letters, &valid_words_set, dict_to_use, filter_letters_on_board, max_words_to_check);
                    match attempt {
                        Some(result) => {
                            let previous_idxs = get_board_overlap(&old_board, &result.0, old_min_col, old_max_col, old_min_row, old_max_row, result.1, result.2, result.3, result.4);
                            let solution = Solution { board: result.0.arr.clone(), board_string: board_to_vec(&result.0, result.1, result.2, result.3, result.4, &previous_idxs), min_col: result.1, max_col: result.2, min_row: result.3, max_row: result.4, letters };
                            return to_value(&solution).unwrap_or(JsValue::from_str("Failed to serialize to JS value!"));
                        },
                        None => { /* We want to continue with the code that builds from scratch */ }
                    }
                }
            }
        },
        LetterComparison::GreaterByMoreThanOne => {
            // If a letter has increased by more than one, or multiple have increased by one or more, then try playing off the existing board
            let valid_words_set: HashSet<&Word> = HashSet::from_iter(dict_to_use.iter().filter(|word| is_makeable(word, &letters)));
            let attempt = play_existing(&old_board, old_min_col, old_max_col, old_min_row, old_max_row, &letters, &valid_words_set, dict_to_use, filter_letters_on_board, max_words_to_check);
            match attempt {
                Some(result) => {
                    let previous_idxs = get_board_overlap(&old_board, &result.0, old_min_col, old_max_col, old_min_row, old_max_row, result.1, result.2, result.3, result.4);
                            let solution = Solution { board: result.0.arr.clone(), board_string: board_to_vec(&result.0, result.1, result.2, result.3, result.4, &previous_idxs), min_col: result.1, max_col: result.2, min_row: result.3, max_row: result.4, letters };
                            return to_value(&solution).unwrap_or(JsValue::from_str("Failed to serialize to JS value!"));
                },
                None => { /* We want to continue with the code that builds from scratch */ }
            }
        },
        LetterComparison::SomeLess => {/* We just want to continue to the code that starts from scratch */}
    }
    JsValue::NULL
}

/// Play from scratch
/// # Arguments
/// * `letters_array` - From JavaScript, a Uint8Array of length 26 of the number of each letter present in the hand
/// * `use_long_dictionary` - Whether to use the full dictionary
/// * `filter_letters_on_board` - The maximum number of letters on the board that can be used in conjunction with letters in the hand when filtering playable words
/// * `max_words_to_check` - Maximum number of words to check for each of the first 6 words
/// * `old_board` - From JavaScript, a Uint8Array of the flattened previous board
/// * `old_min_col` - The minimum played column in `old_board`
/// * `old_max_col` - The maximum played column in `old_board`
/// * `old_min_row` - The minimum played row in `old_board`
/// * `old_max_row` - The maximum played row in `old_board`
/// # Returns
/// * `JsValue` - JavaScript value of the `Solution`, or a string error message
#[wasm_bindgen]
pub fn play_from_scratch(letters_array: &[u8], use_long_dictionary: bool, filter_letters_on_board: usize, max_words_to_check: usize, old_board: &[u8], old_min_col: usize, old_max_col: usize, old_min_row: usize, old_max_row: usize) -> JsValue {
    let dict_to_use: &Vec<Word> = if use_long_dictionary { &FULL_DICTIONARY} else { &SHORT_DICTIONARY };
    // Convert the hand of letters into an appropriate representation
    let mut letters = [0usize; 26];
    for i in 0..26 {
        letters[i] = letters_array[i] as usize;
    }
    // Get a vector of all valid words
    let valid_words_vec: Vec<&Word> = dict_to_use.iter().filter(|word| is_makeable(word, &letters)).collect();
    if valid_words_vec.is_empty() {
        return JsValue::from_str("No valid words can be formed from the current letters - dump and try again!");
    }
    let valid_words_set: HashSet<&Word> = HashSet::from_iter(valid_words_vec.iter().map(|w| *w));
    // Loop through each word and play it on a new board
    let mut words_checked = 0;
    let mut board = Board::new();
    for (word_num, word) in valid_words_vec.iter().enumerate() {
        let col_start = BOARD_SIZE/2 - word.len()/2;
        let row = BOARD_SIZE/2;
        let mut use_letters: [usize; 26] = letters.clone();
        let mut letters_on_board = [0usize; 26];
        for i in 0..word.len() {
            board.set_val(row, col_start+i, word[i]);
            letters_on_board[word[i]] += 1;
            use_letters[word[i]] -= 1;  // Should never underflow because we've verified that every word is playable with these letters
        }
        let min_col = col_start;
        let min_row = row;
        let max_col = col_start + (word.len()-1);
        let max_row = row;
        if use_letters.iter().all(|count| *count == 0) {
            let overlap_idxes: HashSet<(usize, usize)> = if old_board.len() == 0 {
                HashSet::new()
            }
            else {
                let old_board = Board { arr: old_board.into_iter().map(|v| *v as usize).collect() };
                get_board_overlap(&old_board, &board, old_min_col, old_max_col, old_min_row, old_max_row, min_col, max_col, min_row, max_row)
            };
            let solution = Solution { board: board.arr.clone(), board_string: board_to_vec(&board, min_col, max_col, min_row, max_row, &overlap_idxes), min_col, max_col, min_row, max_row, letters };
            return to_value(&solution).unwrap_or(JsValue::from_str("Failed to serialize to JS value!"));
        }
        else {
            // Reduce the set of remaining words to check to those that can be played with the letters not in the first word (plus only one of the tiles played in the first word)
            let word_letters: HashSet<usize> = HashSet::from_iter(word.iter().map(|c| c.clone()));
            let mut new_valid_words_vec: Vec<&Word> = Vec::with_capacity(valid_words_vec.len());
            for i in word_num..valid_words_vec.len() {
                if check_filter_after_play(use_letters.clone(), valid_words_vec[i], &word_letters) {
                    new_valid_words_vec.push(&valid_words_vec[i]);
                }
            }
            // Begin the recursive processing
            if let Ok(result) = play_further(&mut board, min_col, max_col, min_row, max_row, &new_valid_words_vec, &valid_words_set, use_letters, 0, &mut words_checked, &mut letters_on_board, filter_letters_on_board, max_words_to_check) {
                if result.0 {
                    let overlap_idxes: HashSet<(usize, usize)> = if old_board.len() == 0 {
                        HashSet::new()
                    }
                    else {
                        let old_board = Board { arr: old_board.into_iter().map(|v| *v as usize).collect() };
                        get_board_overlap(&old_board, &board, old_min_col, old_max_col, old_min_row, old_max_row, result.1, result.2, result.3, result.4)
                    };
                    let solution = Solution { board: board.arr.clone(), board_string: board_to_vec(&board, result.1, result.2, result.3, result.4, &overlap_idxes), min_col: result.1, max_col: result.2, min_row: result.3, max_row: result.4, letters };
                    return to_value(&solution).unwrap_or(JsValue::from_str("Failed to serialize to JS value!"));
                }
            }
            else if word_num <= 6 {
                words_checked = 0;
                board.erase();
            }
            else {
                // An `Err` meanst that we reached the maximum number of iterations
                break;
            }
        }
        for col in min_col..=max_col {
            board.set_val(row, col, EMPTY_VALUE);
        }
    }
    return JsValue::from_str("No solution found - dump and try again!");
}

///Gets playable words
/// # Arguments
/// * `letters_array` - From JavaScript, a Uint8Array of length 26 representing the number of each letter in the hand
/// # Returns
/// * `JsValue` of either a `PlayableWords` struct (with two keys, `short` and `long` holds vectors of the playable words as strings), or an error string
#[wasm_bindgen]
pub fn get_playable_words(letters_array: &[u8]) -> JsValue {
    // Convert the hand of letters into an appropriate representation
    let mut letters = [0usize; 26];
    for i in 0..26 {
        letters[i] = letters_array[i] as usize;
    }
    let playable_short: Vec<String> = SHORT_DICTIONARY.iter().filter(|word| is_makeable(word, &letters)).map(convert_array_to_word).collect();
    let playable_long: Vec<String> = FULL_DICTIONARY.iter().filter(|word| is_makeable(word, &letters)).map(convert_array_to_word).collect();
    return to_value(&PlayableWords { short: playable_short, long: playable_long }).unwrap_or(JsValue::from_str("Failed to serialize!"));
}