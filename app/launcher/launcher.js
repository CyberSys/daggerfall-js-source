// DA8: THE LAUNCHER'S DRAW. It holds no state of its own: the shell sends
// the whole view (app/lib/launcherState.cjs viewOf) on every change, and
// this paints it. Every word reaches the page as TEXT - the patch notes
// included, which come from GitHub - through textContent and fresh
// elements, never markup.
'use strict';

(() => {
  const bridge = window.daggerLauncher;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  /** "a **b** c" as text nodes and <strong>, `code` and links as their text. */
  function inline(target, text) {
    const plain = String(text).replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`([^`]*)`/g, '$1');
    plain.split('**').forEach((part, i) => {
      if (part) target.append(i % 2 ? el('strong', null, part) : document.createTextNode(part));
    });
  }

  /** A release's patch notes - the PATCH-NOTES-*.md subset: headings,
   *  bullets, paragraphs. Anything else is a paragraph of its text. */
  function notesBlock(note) {
    const box = el('article', 'release');
    if (note.version) box.append(el('span', 'ver', `v${note.version}`));
    let list = null;
    let para = null;
    for (const raw of String(note.text ?? '').split('\n')) {
      const line = raw.trim();
      const bullet = /^[-*]\s+(.*)$/.exec(line);
      const head = /^(#{1,6})\s+(.*)$/.exec(line);
      if (!line) { list = null; para = null; continue; }
      if (head) {
        list = null; para = null;
        box.append(el(head[1].length === 1 ? 'h4' : 'h5', null, head[2].replace(/^Patch Notes:\s*/i, '')));
      } else if (bullet) {
        para = null;
        if (!list) { list = el('ul'); box.append(list); }
        const li = el('li');
        inline(li, bullet[1]);
        list.append(li);
      } else {
        list = null;
        if (!para) { para = el('p'); box.append(para); } else para.append(document.createTextNode(' '));
        inline(para, line);
      }
    }
    return box;
  }

  /** Rebuild a region only when what it shows changed. A download sends a
   *  view many times a second, and a button rebuilt under the pointer
   *  between press and release is a click that never happens. */
  const drawn = new Map();
  const changed = (region, value) => {
    const key = JSON.stringify(value);
    if (drawn.get(region) === key) return false;
    drawn.set(region, key);
    return true;
  };

  function render(v) {
    const waitingOnPlayer = v.actions.some((a) => a.primary) || v.found.length > 0;
    document.body.toggleAttribute('data-busy', !waitingOnPlayer);
    document.body.dataset.stage = v.stage;
    $('title').textContent = v.title;
    $('detail').textContent = v.detail;
    $('version').textContent = v.version;

    const progress = $('progress');
    progress.hidden = !v.progress;
    if (v.progress) {
      progress.querySelector('.bar i').style.width = `${v.progress.percent}%`;
      progress.querySelector('.bar').setAttribute('aria-valuenow', String(Math.round(v.progress.percent)));
      progress.querySelector('.label').textContent = v.progress.label;
    }

    const found = $('found');
    if (changed('found', v.found)) {
      found.replaceChildren(...v.found.map((f) => {
        const li = el('li');
        const where = el('span', 'where');
        // the path is cut from the LEFT (right-to-left, in the stylesheet) so its end shows; the marks keep
        // its slashes in order, or bidi moves an absolute path's leading "/" to the far end
        where.append(el('span', 'from', f.from), el('span', 'path', `‎${f.dir}‎`));
        where.title = f.dir;
        const use = el('button', `plaque small${v.found.length === 1 ? ' primary' : ''}`, 'Use these files');
        use.type = 'button';
        use.addEventListener('click', () => bridge.act('use-found', f.index));
        li.append(where, use);
        return li;
      }));
      found.hidden = !v.found.length;
    }

    const notes = $('notes');
    if (changed('notes', [v.notesTitle, v.notes])) {
      notes.hidden = !v.notes.length;
      notes.querySelector('.caps').textContent = v.notesTitle;
      notes.querySelector('.body').replaceChildren(...v.notes.map(notesBlock));
    }

    if (changed('actions', v.actions)) {
      $('actions').replaceChildren(...v.actions.map((a) => {
        const b = el('button', `plaque${a.primary ? ' primary' : ''}`, a.label);
        b.type = 'button';
        b.addEventListener('click', () => bridge.act(a.id, a.arg));
        return b;
      }));
      // Enter takes the screen's own answer - and only that: "Play now" under a download is the way
      // out, not the way on, and is not the button a keypress should press
      document.querySelector('.plaque.primary')?.focus({ preventScroll: true });
    }
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-open]');
    if (link) bridge.act('open', link.dataset.open);
  });
  bridge.onView(render);
})();
