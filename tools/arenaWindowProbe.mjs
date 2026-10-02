// ARENA3, MEASURED (2026-10-02, Mac: "Joining a team comes with it's own enhanced UI where you can view your ranking and
// even player leaderboards"; "All UI elements and text must be enhanced UI plus"): THE ARENA WINDOW (ui/arenaWindow.js)
// drawn over the real sheets in Chromium - the Enhanced Plus skin and the classic skin's own sheet - at a desktop's
// width, a narrow window's and a phone's, on every page (Bouts with the wager open, Ladder, Team, each Leaderboard,
// Records, Rules), over a save with something on every page: a fighter of the Red Banner two tiers up, in the laurel,
// with bouts behind them, a wager won and one waiting. Each must stand inside the viewport with nothing spilling
// sideways and the page never scrolling sideways, its words in the pixel face, and every tab a `role="tab"`.
// test/arena3_window.test.js holds the window's law on a fake page; this photographs what a fake cannot.
// Photographs to SHOT_DIR (default tools/shots/, ignored).
//
//     node tools/arenaWindowProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const server = await createServer({ server: { port: 5244, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const errors = [];
const PAGES = [['bouts', null], ['bouts', 'wager'], ['ladder', null], ['team', null], ['boards', 'pve'], ['boards', 'fast'], ['boards', 'pvp'], ['boards', 'team'], ['records', null], ['rules', null]];

for (const [W, H, width] of [[1440, 900, 'desktop'], [800, 600, 'narrow'], [390, 760, 'phone']]) for (const skin of ['enhanced', 'classic']) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(`http://localhost:5244/play/?skin=${skin}&touch=off`);
  await page.evaluate(async () => {
    const LG = await import('/src/systems/arenaLeague.js');
    const BK = await import('/src/systems/arenaBook.js');
    const AL = await import('/src/systems/arenaLadder.js');
    const AB = await import('/src/systems/arenaBoard.js');
    const { mountArenaWindow } = await import('/src/ui/arenaWindow.js');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:repeating-linear-gradient(45deg,#2a2721 0 14px,#231f1a 14px 28px);height:100vh';
    // a save with something on every page: noon of day 200 of 3E 405, the Red Banner, in the laurel
    const gm = 523530 - (523530 % 1440) + 196 * 1440 + 12 * 60;
    let ladder = AL.newArenaLadder();
    let league = LG.joinBanner(LG.newArenaLeague(), 'red', gm - 60 * 1440).league;
    league.laurel = { banner: 'red', season: 405 };
    const opps = ['Mirabelle Ashfield', 'Gorlak gro-Mazgulbarz', 'Uthyrick Kingston', 'The Grizzly Bear', 'Senna Varo', 'Peristair Kingfield', 'Tozca of Totambu'];
    for (let i = 0; i < 9; i++) {
      const won = i !== 4;
      const next = AL.nextLadderBout(ladder);
      ladder = AL.ladderAfter(ladder, { won, how: won ? 'fall' : 'yield', purse: won ? next.purse : 0 }).ladder;
      league = LG.leagueAfterBout(league, { gameMinutes: gm - (40 - i * 4) * 1440, tier: next.tier, label: next.label, opp: opps[i % opps.length], won, how: won ? (i % 2 ? 'judges' : 'fall') : 'yield', purse: won ? next.purse : 0, champion: next.champion });
    }
    const ex0 = AL.exhibitionFor(gm - 26 * 60);
    let book = BK.placeWager(league.book, ex0, 0, 100, { gold: 1000, gameMinutes: gm - 26 * 60 }).book;
    book = BK.settleBook(BK.bookVerdict(book, ex0.hour, 0), gm - 26 * 60 + 30).book;
    const ex1 = AL.exhibitionFor(gm);
    book = BK.placeWager(book, ex1, 1, 50, { gold: 1000, gameMinutes: gm }).book;
    book = { ...book, wagers: book.wagers.filter((w) => w.hour !== ex1.hour) };   // the hour's still open to wager on
    league = { ...league, book };
    window.__arena = { gm, ladder, league };
    const host = document.createElement('div');
    document.body.append(host);
    window.__arenaView = mountArenaWindow(host, {
      board: () => AB.arenaBoard({ ladder, league, gameMinutes: gm, name: 'Aldric Wyndbrooke-Varnell', atGate: true, gold: 640, healthShare: 1 }),
      act: () => ({ ok: true, text: 'Taken - 50 gold on Gorlak gro-Mazgul at 7 to 4. Good luck to you.' }),
    });
    await new Promise((res) => setTimeout(res, 120));
  });
  for (const [pg, sub] of PAGES) {
    const tag = `${width}-${skin}-${pg}${sub ? `-${sub}` : ''}`;
    const r = await page.evaluate(async ([pg, sub]) => {
      const shell = document.querySelector('.aw-shell');
      const tab = [...shell.querySelectorAll('.aw-tab')].find((t) => t.dataset.page === pg);
      tab.click();
      if (pg === 'bouts' && sub === 'wager') {
        shell.querySelector('.aw-act[data-act="wager"]').click();
        shell.querySelectorAll('.aw-side')[1]?.click();
        shell.querySelectorAll('.aw-stake')[2]?.click();
      }
      if (pg === 'boards') [...shell.querySelectorAll('.aw-subtab')].find((b) => b.dataset.board === sub)?.click();
      await new Promise((res) => setTimeout(res, 60));
      const win = shell.querySelector('.aw-win');
      const q = win.getBoundingClientRect();
      const body = shell.querySelector('.aw-body');
      const inTabs = (n) => !!n.closest('.aw-tabs');
      const spill = [...win.querySelectorAll('*')].filter((n) => !inTabs(n) && n.getClientRects().length).filter((n) => { const b = n.getBoundingClientRect(); return b.width > 0 && (b.right > q.right + 1 || b.left < q.left - 1); })
        .map((n) => `${n.className}`).slice(0, 4);
      const tabs = [...shell.querySelectorAll('.aw-tab')];
      return {
        rect: [q.left, q.top, q.right, q.bottom], spill, bodyX: body.scrollWidth - body.clientWidth, pageX: document.documentElement.scrollWidth - innerWidth,
        font: getComputedStyle(win).fontFamily, tabsRole: tabs.every((t) => t.getAttribute('role') === 'tab'), selected: tabs.find((t) => t.getAttribute('aria-selected') === 'true')?.dataset.page,
        words: body.textContent.length, border: getComputedStyle(win).borderImageSource !== 'none',
      };
    }, [pg, sub]);
    const [l, t, rr, b] = r.rect;
    check(`${tag} inside the viewport`, l >= 0 && t >= 0 && rr <= W + 0.5 && b <= H + 0.5, r.rect.map(Math.round).join(','));
    check(`${tag} nothing spilling sideways`, r.spill.length === 0 && r.bodyX <= 1 && r.pageX <= 0, `${r.spill.join(' | ')} body+${r.bodyX} page+${r.pageX}`);
    check(`${tag} pixel face, its tab chosen`, /Pixelify/.test(r.font) && r.tabsRole && r.selected === pg, `${r.font.slice(0, 30)} ${r.selected}`);
    check(`${tag} the kit's carved frame`, r.border, '');
    check(`${tag} words on the page`, r.words > 40, String(r.words));
    await page.screenshot({ path: `${OUT}/arena-window-${tag}.png` });
  }
  await page.close();
}
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
await server.close();
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
