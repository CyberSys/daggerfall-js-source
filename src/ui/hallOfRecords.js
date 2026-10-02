// @ts-check
// SEASON1 part three (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE HALL OF RECORDS AS A BOOK
// (bible/11-Multiplayer/Seats-Arc.md 9.2: "A Hall of Records book in every seat's palace ... read it as prose ... The book
// is read through the enhanced book window the port already has"). A seat's Chronicle, read by the law
// (net/townSeatLaw.js hallOfRecordsChapters), laid out as the book reader's own tokens - its title centred in the title
// face, each Season's chapter under its name, each line a paragraph - and handed to the reader's one door
// (ui/bookDoor.js createBookReaderWindow), which picks the skin's face. Pure: the rows are handed in.
//
// Not a DFU member: Daggerfall's books are files; this one is written from the server's Chronicle. Ledger A row.
import { RSC, TOKEN_TEXT } from '../formats/textRsc.js';
import { createBookReaderWindow } from './bookDoor.js';   // EB1: the reader's one door - it picks the skin's face
import { hallOfRecordsChapters, hallOfRecordsTitle, HALL_OF_RECORDS_EMPTY } from '../net/townSeatLaw.js';

/** Who the book says wrote it. */
export const HALL_OF_RECORDS_AUTHOR = 'the Chronicle of the Seats';
/** The title face's font (ui/enhancedBook.js: 5 is the title cut). */
const TITLE_FONT = 5;
const text = (t) => ({ formatting: TOKEN_TEXT, text: t });
const nl = () => ({ formatting: RSC.NewLine });
const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** The book's tokens: the title, centred in the title face; then each chapter - its Season's name centred, or none for
 *  rows from no counted Season - and its lines, each a paragraph with a blank row after; an empty Hall says so. */
export function hallOfRecordsTokens(seat, rows, zero = null) {
  /** @type {any[]} */
  const out = [{ formatting: RSC.JustifyCenter }, { formatting: RSC.FontPrefix, x: TITLE_FONT }, text(hallOfRecordsTitle(seat)), nl(), nl()];   // the blank row puts the face and the centring back
  const chapters = hallOfRecordsChapters(rows, seat, zero);
  if (!chapters.length) return [...out, text(HALL_OF_RECORDS_EMPTY), nl()];
  for (const c of chapters) {
    if (c.heading) out.push({ formatting: RSC.JustifyCenter }, text(upper(c.heading)), nl(), nl());
    out.push({ formatting: RSC.JustifyLeft });
    for (const line of c.lines) out.push(text(line), nl(), nl());
  }
  return out;
}

/** THE BOOK the reader's door takes (ui/bookDoor.js createBookReaderWindow - it reads `title`, `author`, `pageCount`
 *  and `getPageTokens`): one page holding every token, as the reader joins pages anyway. */
export function hallOfRecordsBook(seat, rows, zero = null) {
  const tokens = hallOfRecordsTokens(seat, rows, zero);
  return { title: hallOfRecordsTitle(seat), author: HALL_OF_RECORDS_AUTHOR, pageCount: 1, getPageTokens: () => tokens };
}

/** The book's window, through the reader's one door - what a seat's palace shelf opens. */
export const hallOfRecordsWindow = (seat, rows, zero = null) => createBookReaderWindow(hallOfRecordsBook(seat, rows, zero));
