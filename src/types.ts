/**
 * Type of the return after a solution is found
 */
export type result_t = {
    /**
     * 2D array of characters of the solution
     */
    board: string[][],
    /**
     * The time the function took to run
     */
    elapsed: number,
    /**
     * The game state
     */
    state: GameState
}

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