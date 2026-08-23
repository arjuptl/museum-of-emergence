import flock    from './flock.js';
import slime    from './slime.js';
import turing   from './turing.js';
import lenia    from './lenia.js';
import sync     from './sync.js';
import sandpile from './sandpile.js';
import dendrite from './dendrite.js';
import rule30   from './rule30.js';

/* Hung in the order a visitor should meet them: agents you can see,
   then agents too numerous to see, then fields, then life, then the
   two that are really about statistics, then the smallest one of all. */
export const EXHIBITS = [flock, slime, turing, lenia, sync, sandpile, dendrite, rule30];
export const byId = Object.fromEntries(EXHIBITS.map(e => [e.id, e]));
