// @ts-check
// VOICE1 (2026-09-28, Mac: "develop prox chat") - WHO IS SPEAKING: a small line at the screen's left, under nothing -
// my own microphone while push-to-talk is held, and the names of the players near me whose voices are heard now.
// Pointer-transparent, drawn only while there is something to say. `voiceHudLines` is the pure half.

/** The lines, in order: me first, then the speakers by name (at most VOICE_HUD_NAMES_MAX, then "+N"). */
export const VOICE_HUD_NAMES_MAX = 4;
/**
 * @param {{ talking: boolean, mic: string, held: boolean, speakers: string[] }} s
 * @returns {string[]}
 */
export function voiceHudLines({ talking, mic, held, speakers }) {
  const out = [];
  if (held && mic === 'denied') out.push('\u{1F399} Microphone blocked');
  else if (held && mic === 'asking') out.push('\u{1F399} Allow the microphone…');
  else if (talking) out.push('\u{1F399} Talking');
  const names = speakers.filter((n) => typeof n === 'string' && n);
  for (const n of names.slice(0, VOICE_HUD_NAMES_MAX)) out.push(`\u{1F50A} ${n}`);
  if (names.length > VOICE_HUD_NAMES_MAX) out.push(`+${names.length - VOICE_HUD_NAMES_MAX} more`);
  return out;
}

/** The element, made on first use and kept; `render(lines)` shows them (hidden when none). */
export function createVoiceHud(doc = globalThis.document) {
  let el = null;
  let shown = '';
  return {
    render(lines) {
      const text = lines.join('\n');
      if (text === shown) return;
      shown = text;
      if (!el) {
        if (!doc?.body) return;
        el = doc.createElement('div');
        el.id = 'voice-hud';
        Object.assign(el.style, {
          position: 'fixed', left: '12px', top: '40%', zIndex: '40', pointerEvents: 'none', whiteSpace: 'pre',
          font: '600 14px/1.5 system-ui, sans-serif', color: '#f3ead2', textShadow: '0 1px 2px #000, 0 0 4px #000',
        });
        doc.body.append(el);
      }
      el.textContent = text;
      el.style.display = text ? 'block' : 'none';
    },
    dispose() { el?.remove(); el = null; shown = ''; },
  };
}
