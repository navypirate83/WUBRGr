/* =====================================================================
   THE CARD AREA
   Everything under the search box: the Language picker, the card's
   picture with the Share and "+" Add to binder buttons beside it, the
   Flip and Foil buttons,
   the name / set / artist line, the Set and Version pickers, and the
   Notes and Rules and Format Legality boxes.
   It remembers which printing, side and language is showing. The Search
   page draws a fresh one for every card looked up, so each new card
   starts on the printing Scryfall found.
   Before any card is looked up (or when one isn't found), it shows the
   back of a card and greyed-out pickers.
   ===================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { loadLanguages, type ScryfallCard } from '../../lib/scryfall';
import {
  CARD_BACK, cardSearchParams, faceName, foilChoices, foilFor, groupBySet, imageFor,
  isDoubleSided, languageName, versionLabel, type SetGroup,
} from '../../lib/cards';
import type { BinderCard } from '../../lib/binderStorage';
import { useShortcutKeys } from '../../hooks/useShortcutKeys';
import SetPicker, { EMPTY_PICKER_TEXT } from './SetPicker';
import CardPicture from './CardPicture';
import { Legality, Rulings } from './CardNotes';
import AddToBinder, { type AddToBinderHandle } from './AddToBinder';
import PricePanel from './PricePanel';
import styles from './SearchPage.module.css';

// How long "Link copied!" stays visible (2 seconds)
const TOAST_MS = 2000;

type Props = {
  // The card that was looked up and all its printings (missing before a
  // search, or when the card wasn't found)
  result?: { card: ScryfallCard; prints: ScryfallCard[] };
  // A shared link can ask for the back side or another language
  startFace: number;
  startLang: string | null;
  // Each set's symbol picture (once it has downloaded)
  setIcons?: Map<string, string>;
  // Is Foil on? It's kept by the Search page, so it carries on to the
  // next card looked up (the same as the original site).
  foil: boolean;
  setFoil: (on: boolean) => void;
  // A card is being looked up (shows the spinner)
  busy: boolean;
  // Say something to screen readers
  announce: (text: string) => void;
  // Is someone using the binders (so the "+" Add to binder shows)?
  usingBinders: boolean;
  // The binder this page was opened from, and the pocket to fill, if any
  fromBinder: string | null;
  pocket: { page: number; slot: number } | null;
  // Show a message under the search box (red if it's a problem)
  onMessage: (text: string, isError?: boolean) => void;
};

export default function CardPanel(props: Props) {
  const { result, startFace, startLang, setIcons, foil, setFoil, busy, announce } = props;
  const { usingBinders, fromBinder, pocket, onMessage } = props;
  const navigate = useNavigate();
  // The "+" Add to binder button (the A key presses it)
  const addRef = useRef<AddToBinderHandle>(null);
  // The card's printings, grouped by set, newest set first. (useMemo
  // only redoes this when the printings or the set symbols change.)
  const sets = useMemo(
    () => (result ? groupBySet(result.prints, setIcons) : []),
    [result, setIcons],
  );

  // Where to start: the printing Scryfall found (for a name search,
  // usually the newest one; for a shared link, the exact one).
  const startPrint = useMemo(() => {
    if (!result || sets.length === 0) return null;
    return sets.flatMap((s) => s.prints).find((p) => p.id === result.card.id) ?? sets[0].prints[0];
  }, [result, sets]);

  // What's showing: which printing, which side (0 = front, 1 = back) and
  // which language (null = the printing's own language). Each starts
  // from the values above when this card area is first drawn.
  const [printId, setPrintId] = useState(startPrint?.id ?? null);
  const [face, setFace] = useState(startPrint && isDoubleSided(startPrint) ? startFace : 0);
  const [lang, setLang] = useState(startLang);

  // The printing and set that go with printId
  const print = sets.flatMap((s) => s.prints).find((p) => p.id === printId) ?? startPrint;
  const currentSet: SetGroup | null = sets.find((s) => print && s.prints.includes(print)) ?? null;

  // Every language this exact printing was made in (downloaded in the
  // background; until then, just its own language, greyed out)
  const languages = useQuery({
    queryKey: ['languages', print?.set, print?.collector_number],
    queryFn: () => loadLanguages(print!, languageName),
    enabled: Boolean(print),
  });
  // The language version being shown (the printing itself if it's in its
  // own language, or the languages haven't loaded yet)
  const shown = (lang && languages.data?.find((v) => v.lang === lang)) || print;

  // Is Foil on for this printing? (Foil-only printings are always on;
  // printings with no foil version are always off.)
  const foilOn = print ? foilFor(print, foil) : false;
  const { canBeFoil, onlyFoil } = print ? foilChoices(print) : { canBeFoil: false, onlyFoil: false };

  // Whenever the printing changes, remember Foil the way it now shows
  // (so it carries on to the next version, the same as the original).
  // This runs only when the printing changes ([print?.id]), not every
  // time Foil does.
  useEffect(() => {
    if (print) setFoil(foilFor(print, foil));
  }, [print?.id]);

  // Switch to another printing: front side, in its own language.
  function selectPrint(next: ScryfallCard) {
    setPrintId(next.id);
    setFace(0);
    setLang(null);
  }

  // Switch to another set, on its first printing.
  function selectSet(set: SetGroup) {
    selectPrint(set.prints[0]);
  }

  // Flip a two-sided card over.
  function flip() {
    setFace(face === 0 ? 1 : 0);
  }

  /* ----- Sharing a link to the card ----- */

  // The "Link copied!" message beside the Share button
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }
  // Stop the timer if the card area goes away.
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // Clicking Share: on devices with a built-in share menu (phones, and
  // some desktop browsers) open that menu. Otherwise copy the link. If
  // even copying is blocked, show the link so it can be copied by hand.
  async function share() {
    if (!print || !shown) return;
    const params = cardSearchParams(print, face, shown.lang, foilOn);
    const url = `${location.origin}${import.meta.env.BASE_URL}search?${params}`;
    const title = `${print.name} — ${print.set_name}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: title, url });
        return;
      } catch (err) {
        // The person closed the share menu: that's fine, do nothing.
        if ((err as Error).name === 'AbortError') return;
        // Any other problem: copy the link instead (below).
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied!');
    } catch {
      window.prompt('Copy this link to share the card:', url);
    }
  }

  /* ----- Adding the card to a binder ----- */

  // The card being shown, as a binder saves it: this exact set, version,
  // side and language, whether it's foil, and the picture for the pocket
  // (the smaller "normal" size is plenty, and downloads faster).
  function cardEntry(): BinderCard {
    const side = isDoubleSided(print!) ? face : 0;
    return {
      name: print!.name,
      set: print!.set,
      number: print!.collector_number,
      face: side,
      lang: shown!.lang !== print!.lang ? shown!.lang : undefined,   // only saved if switched
      foil: foilOn ? true : undefined,                              // only saved if foil
      image: imageFor(shown!, side, ['normal', 'large']) ?? CARD_BACK,
    };
  }

  /* ----- Shortcut keys for the card (see the Keyboard shortcuts window) ----- */

  // Show the version a step before (-1) or after (+1) the one showing,
  // in this set. It stops at the first and last (no wrapping around).
  function stepVersion(step: number) {
    const prints = currentSet!.prints;
    const index = prints.indexOf(print!);
    const next = prints[index + step];
    if (!next) {
      announce(prints.length === 1 ? 'This set has only one version.'
        : step > 0 ? 'This is the last version in this set.' : 'This is the first version in this set.');
      return;
    }
    selectPrint(next);
    announce(`Version ${index + step + 1} of ${prints.length}: ${versionLabel(next)}`);
  }

  // Show the set a step before (-1) or after (+1) the one showing.
  function stepSet(step: number) {
    const index = sets.indexOf(currentSet!);
    const next = sets[index + step];
    if (!next) {
      announce(sets.length === 1 ? 'This card was printed in only one set.'
        : step > 0 ? 'This is the last set.' : 'This is the first set.');
      return;
    }
    selectSet(next);
    announce(`Set ${index + step + 1} of ${sets.length}: ${next.name}`);
  }

  //  [ / ]  previous / next version     { / }  previous / next set
  //  F      flip a two-sided card       S      share
  //  A      add to binder               B      back to the binder you came from
  useShortcutKeys((event) => {
    const key = event.key;
    if (key === 'b' || key === 'B') {
      if (!usingBinders || !fromBinder) { announce('There\'s no binder to go back to.'); return; }
      event.preventDefault();
      navigate(`/binders/${encodeURIComponent(fromBinder)}`);
      return;
    }
    if (!['[', ']', '{', '}', 'f', 'F', 's', 'S', 'a', 'A'].includes(key)) return;
    event.preventDefault();
    if (!print || !shown) { announce('Search for a card first.'); return; }
    if (key === 'a' || key === 'A') {
      if (!usingBinders) { announce('Sign in, or use the site locally, to add cards to a binder.'); return; }
      addRef.current?.activate();
      return;
    }
    if (key === '[' || key === ']') stepVersion(key === ']' ? 1 : -1);
    else if (key === '{' || key === '}') stepSet(key === '}' ? 1 : -1);
    else if (key === 'f' || key === 'F') {
      if (!isDoubleSided(print)) { announce('This card has only one side.'); return; }
      const next = face === 0 ? 1 : 0;
      setFace(next);
      announce(`Showing the ${next === 1 ? 'back' : 'front'}: ${faceName(print, next)}`);
    } else {
      share();
      announce('Sharing a link to this card.');
    }
  });

  /* ----- What's drawn ----- */

  // The picture for the side and language showing (null: the card back)
  const pictureUrl = shown ? imageFor(shown, face) : null;
  const pictureAlt = shown ? `${faceName(shown, face)} — ${shown.set_name}` : '';
  // The languages to offer: the downloaded list, or just this one
  const languageOptions = languages.data ?? (print ? [print] : []);

  return (
    <>
      {/* LANGUAGE: the languages this printing was made in. Greyed out
          while the list loads, or when there's only one. */}
      <div className={styles.languagePicker}>
        <label className={styles.fieldLabel} htmlFor="languageSelect">Language</label>
        <select
          id="languageSelect"
          className={styles.picker}
          disabled={!shown || languageOptions.length < 2}
          value={shown?.lang ?? ''}
          onChange={(event) => setLang(event.target.value)}
        >
          {shown
            ? languageOptions.map((v) => <option key={v.lang} value={v.lang}>{languageName(v.lang)}</option>)
            : <option value="">{EMPTY_PICKER_TEXT}</option>}
        </select>
      </div>

      {/* THE CARD, with the round Share and "+" Add to binder buttons
          beside it */}
      <div className={styles.cardStage}>
        <CardPicture src={pictureUrl} alt={pictureAlt} busy={busy} />

        {/* PRICES beside the card, on the left (just the stores' icons).
            Only on pages wide enough for it: otherwise the stylesheet
            hides this one, and the one under Notes and Rules shows. */}
        {print && <PricePanel print={print} foil={foilOn} layout="side" />}

        {print && (
          <button
            className={styles.shareButton}
            type="button"
            aria-label="Share a link to this card"
            title="Share this card"
            onClick={share}
          >
            {/* Three joined dots: the usual "share" symbol */}
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" stroke="none" />
              <circle cx="6" cy="12" r="3" stroke="none" />
              <circle cx="18" cy="19" r="3" stroke="none" />
              <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" fill="none" />
            </svg>
          </button>
        )}

        {/* "+": only for someone using the binders, once a card is showing */}
        {print && usingBinders && (
          <AddToBinder ref={addRef} cardEntry={cardEntry} fromBinder={fromBinder} pocket={pocket} onMessage={onMessage} />
        )}

        {/* "Link copied!" (role="status" makes screen readers read it) */}
        {toast && <div className={styles.shareToast} role="status">{toast}</div>}
      </div>

      {/* FLIP (two-sided cards only) and FOIL, side by side under the card.
          aria-pressed says whether Foil is on (and colors it orange). */}
      {print && (
        <div className={styles.cardToggles}>
          {isDoubleSided(print) && (
            <button className={styles.flipButton} type="button" onClick={flip}>Flip card ↻</button>
          )}
          <button
            className={styles.foilButton}
            type="button"
            aria-pressed={foilOn}
            disabled={!canBeFoil || onlyFoil}
            title={!canBeFoil ? 'This printing has no foil version'
              : onlyFoil ? 'This printing only comes in foil' : 'I have the foil version'}
            onClick={() => setFoil(!foilOn)}
          >
            Foil
          </button>
        </div>
      )}

      {/* The card's name, set, number and artist, and a link to Scryfall */}
      <p className={styles.cardInfo}>
        {print && (
          <>
            <strong>{print.name}</strong><br />
            {print.set_name} · #{print.collector_number}
            {print.artist && ` · Illustrated by ${print.artist}`}<br />
            <a href={print.scryfall_uri} target="_blank" rel="noopener">View on Scryfall</a>
          </>
        )}
      </p>

      {/* SET and VERSION: side by side on wider screens */}
      <div className={styles.pickers}>
        <SetPicker sets={sets} current={currentSet} onChoose={selectSet} />
        <div>
          <label className={styles.fieldLabel} htmlFor="versionSelect">Version</label>
          <select
            id="versionSelect"
            className={styles.picker}
            disabled={!currentSet}
            value={print?.id ?? ''}
            onChange={(event) => {
              const next = currentSet?.prints.find((p) => p.id === event.target.value);
              if (next) selectPrint(next);
            }}
          >
            {currentSet
              ? currentSet.prints.map((p) => <option key={p.id} value={p.id}>{versionLabel(p)}</option>)
              : <option value="">{EMPTY_PICKER_TEXT}</option>}
          </select>
        </div>
      </div>

      {/* NOTES AND RULES and FORMAT LEGALITY (only once a card is showing) */}
      {result && <Rulings card={result.card} />}
      {/* PRICES under Notes and Rules, with the stores' names: only on
          pages too narrow for the box beside the card */}
      {print && <PricePanel print={print} foil={foilOn} layout="below" />}
      {print && <Legality print={print} />}
    </>
  );
}
