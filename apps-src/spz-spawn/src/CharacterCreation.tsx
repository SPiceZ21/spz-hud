import { useState, useEffect, useRef, useMemo } from 'preact/hooks'
import { User, Check, AlertCircle, Flag, Hash, Search, ChevronDown, ArrowRight, Info, RectangleHorizontal } from 'lucide-preact'
import { PlatePreview } from './components/PlatePreview'
import './styles/creation.css'

/*
 * Character creation, in two acts.
 *
 * Act one builds the racer: pick a base model, then open the full appearance
 * editor. Act two names them: alias, nation, race number and plate.
 *
 * That order is deliberate. Naming something you cannot see is an abstract
 * form; naming a racer standing in front of you is a decision. The ped is live
 * behind the rail the whole time — the model swaps under you as you pick it,
 * and by the time you are typing an alias you are looking at the person it
 * belongs to.
 *
 * The panel is docked left rather than centred for the same reason: a centred
 * modal covers the only thing worth looking at.
 */

/* ISO 3166-1 alpha-2 — drives the flag shown on nametags and race standings */
const NATIONS: [string, string][] = [
  ['ar', 'Argentina'], ['au', 'Australia'], ['at', 'Austria'], ['az', 'Azerbaijan'],
  ['bh', 'Bahrain'], ['bd', 'Bangladesh'], ['be', 'Belgium'], ['br', 'Brazil'],
  ['ca', 'Canada'], ['cl', 'Chile'], ['cn', 'China'], ['co', 'Colombia'],
  ['hr', 'Croatia'], ['cz', 'Czechia'], ['dk', 'Denmark'], ['eg', 'Egypt'],
  ['ee', 'Estonia'], ['fi', 'Finland'], ['fr', 'France'], ['de', 'Germany'],
  ['gr', 'Greece'], ['hu', 'Hungary'], ['is', 'Iceland'], ['in', 'India'],
  ['id', 'Indonesia'], ['ie', 'Ireland'], ['il', 'Israel'], ['it', 'Italy'],
  ['jp', 'Japan'], ['kz', 'Kazakhstan'], ['ke', 'Kenya'], ['kw', 'Kuwait'],
  ['lv', 'Latvia'], ['lt', 'Lithuania'], ['my', 'Malaysia'], ['mx', 'Mexico'],
  ['mc', 'Monaco'], ['ma', 'Morocco'], ['np', 'Nepal'], ['nl', 'Netherlands'],
  ['nz', 'New Zealand'], ['ng', 'Nigeria'], ['no', 'Norway'], ['pk', 'Pakistan'],
  ['pe', 'Peru'], ['ph', 'Philippines'], ['pl', 'Poland'], ['pt', 'Portugal'],
  ['qa', 'Qatar'], ['ro', 'Romania'], ['sa', 'Saudi Arabia'], ['rs', 'Serbia'],
  ['sg', 'Singapore'], ['sk', 'Slovakia'], ['si', 'Slovenia'], ['za', 'South Africa'],
  ['kr', 'South Korea'], ['es', 'Spain'], ['lk', 'Sri Lanka'], ['se', 'Sweden'],
  ['ch', 'Switzerland'], ['tw', 'Taiwan'], ['th', 'Thailand'], ['tr', 'Türkiye'],
  ['ua', 'Ukraine'], ['ae', 'United Arab Emirates'], ['gb', 'United Kingdom'],
  ['us', 'United States'], ['uy', 'Uruguay'], ['vn', 'Vietnam'],
]

type Step = 'model' | 'identity'

function nationName(code: string) {
  return NATIONS.find(([c]) => c === code)?.[1] || ''
}

function post(path: string, body: unknown) {
  return fetch(`https://${GetParentResourceName()}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {})
}

/*
 * Nation combobox — type to filter, arrows to move, Enter to take.
 *
 * Replaces a native <select>, which could do none of that with seventy entries:
 * no search, no flag, the chosen name clipped by the control, and an OS-drawn
 * dropdown appearing in the middle of the game.
 */
function NationPicker({ value, onPick }: { value: string; onPick: (code: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return NATIONS
    // Prefix matches first: typing "in" should offer India before Argentina.
    const starts = NATIONS.filter(([, n]) => n.toLowerCase().startsWith(q))
    const rest = NATIONS.filter(([, n]) => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q))
    return [...starts, ...rest]
  }, [query])

  useEffect(() => { setCursor(0) }, [query])

  // Close on any click that lands outside the control.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    const el = menuRef.current?.querySelector('[data-cursor="true"]')
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [cursor, open])

  const take = (code: string) => {
    onPick(code)
    setOpen(false)
    setQuery('')
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[cursor]) take(results[cursor][0]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div class="cc-nation" ref={boxRef}>
      <div class="cc-control" onClick={() => setOpen(true)}>
        <span class="cc-lead">
          {value && !open
            ? <img class="cc-flag" src={`flags/${value}.webp`} alt="" />
            : <Search size={16} />}
        </span>
        <input
          value={open ? query : (value ? nationName(value) : '')}
          onInput={(e) => { setQuery((e.target as HTMLInputElement).value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search nations…"
          spellcheck={false}
        />
        <span class="cc-trail"><ChevronDown size={16} color="var(--gray-600)" /></span>
      </div>

      {open && (
        <div class="cc-menu" ref={menuRef}>
          {results.length === 0 && <div class="cc-empty">No nation matches that.</div>}
          {results.map(([code, label], i) => (
            <div
              key={code}
              class="cc-option"
              role="button"
              data-cursor={i === cursor}
              data-picked={code === value}
              onMouseEnter={() => setCursor(i)}
              onClick={() => take(code)}
            >
              <img class="cc-flag" src={`flags/${code}.webp`} alt="" />
              <span>{label}</span>
              {code === value && <Check size={13} style={{ marginLeft: 'auto' }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function CharacterCreation(
  { serverError, onClearError }: { serverError: string | null; onClearError: () => void },
) {
  const [step, setStep] = useState<Step>('model')
  const [gender, setGender] = useState(0)
  const [styled, setStyled] = useState(false)   // appearance editor has run at least once
  const [name, setName] = useState('')
  const [nation, setNation] = useState('')
  const [raceNumber, setRaceNumber] = useState('')
  const [plate, setPlate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [paused, setPaused] = useState(false)   // appearance editor has the screen

  useEffect(() => {
    if (serverError) setSubmitting(false)
  }, [serverError])

  /*
   * The client drives the handoff to the appearance editor and back.
   *
   * `creationPause` rather than an unmount: this component holds the model
   * choice and which act we are in, and the editor can be open for minutes.
   * Tearing it down and rebuilding it would silently reset both.
   *
   * `appearanceStepDone` is what advances the flow — not a timer. The editor
   * takes exactly as long as the player wants it to.
   */
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'creationPause') {
        setPaused(true)
      } else if (e.data.type === 'appearanceStepDone') {
        setPaused(false)
        setStyled(true)
        setStep('identity')
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Swapping the model on the live ped is the whole point of showing it: the
  // choice is visible immediately instead of being described by a label.
  const pickGender = (g: number) => {
    if (g === gender) return
    setGender(g)
    post('previewGender', { gender: g })
  }

  const isValidName = /^[a-zA-Z0-9_]{3,16}$/.test(name)
  const numValue = parseInt(raceNumber, 10)
  const isValidNumber = !isNaN(numValue) && numValue >= 1 && numValue <= 999

  // Optional on purpose: a blank plate is a valid answer and the car keeps
  // whatever the game gives it. Only a NON-empty plate can be wrong, so an
  // empty box must never block the form.
  const plateTrimmed = plate.trim()
  const isValidPlate = plateTrimmed === '' || /^[A-Z0-9 ]{1,8}$/.test(plateTrimmed)
  const canSubmit = isValidName && nation !== '' && isValidNumber && isValidPlate && !submitting

  // Name the single thing standing in the way, in the order the form asks for
  // it. A greyed-out button that will not say why is the worst version of this.
  const blocker = !isValidName
    ? (name.length === 0 ? 'Choose your racer alias' : '3–16 letters, numbers or underscores')
    : nation === ''
    ? 'Pick the nation you race under'
    : !isValidNumber
    ? 'Pick a race number from 1 to 999'
    : !isValidPlate
    ? 'Plate: up to 8 letters, numbers or spaces'
    : null

  const submit = () => {
    if (!canSubmit) return
    setSubmitting(true)
    onClearError()
    post('submitCharacterCreation', { name, gender, nation, raceNumber: numValue, plate: plateTrimmed })
  }

  // Stays mounted while the editor is up so nothing chosen so far is lost.
  if (paused) return null

  return (
    <div class="cc-root">
      <div class="cc-scrim" />

      {/* Keyed on the step so the rows re-stagger when the act changes. */}
      <div class="cc-rail cc-stagger" key={step}>
        <div>
          <div class="cc-eyebrow"><i />SPiceZ Racing · New Driver</div>
          <div class="cc-title">
            {step === 'model' ? <>Build your<br /><b>racer</b></> : <>Name your<br /><b>racer</b></>}
          </div>
          <div class="cc-sub">
            {step === 'model'
              ? 'Pick a base, then style them however you like. Everything you change shows on them straight away.'
              : 'This is how you appear on every nametag, standings tower and leaderboard on the server.'}
          </div>
        </div>

        {serverError && (
          <div class="cc-error" key={serverError}>
            <AlertCircle size={15} />
            <span>{serverError}</span>
          </div>
        )}

        {step === 'model' ? (
          <>
            <div class="cc-field" data-done="true">
              <div class="cc-label"><span class="cc-step">1</span>Base model</div>
              <div class="cc-models">
                <div class="cc-model" role="button" data-on={gender === 0} onClick={() => pickGender(0)}>
                  <User size={22} />
                  <span>Male</span>
                </div>
                <div class="cc-model" role="button" data-on={gender === 1} onClick={() => pickGender(1)}>
                  <User size={22} />
                  <span>Female</span>
                </div>
              </div>
              <div class="cc-hint">Switching base resets the look, so choose it before styling.</div>
            </div>

            <div class="cc-field" data-done={styled}>
              <div class="cc-label">
                <span class="cc-step">{styled ? <Check size={10} /> : '2'}</span>
                Appearance
              </div>
              <div class="cc-hint">
                {styled
                  ? 'Styled. Go back in any time, or carry on and name them.'
                  : 'Face, hair, build and clothing — the full editor.'}
              </div>
            </div>

            <div class="cc-commit">
              <button class="cc-go" onClick={() => post('openAppearanceStep', {})}>
                {styled ? 'Edit appearance' : 'Style your racer'}
                <ArrowRight size={17} />
              </button>
              {styled && (
                <button class="cc-go cc-go-quiet" onClick={() => setStep('identity')}>
                  Continue to naming
                  <ArrowRight size={16} />
                </button>
              )}
              <div class="cc-blocker">
                {styled
                  ? <><Check size={12} color="var(--color-primary)" />Racer built</>
                  : <><Info size={12} />Style your racer to continue</>}
              </div>
            </div>
          </>
        ) : (
          <>
            <div class="cc-field" data-done={isValidName}>
              <div class="cc-label">
                <span class="cc-step">{isValidName ? <Check size={10} /> : '1'}</span>
                Racer alias
                <span class="cc-count">{name.length}/16</span>
              </div>
              <div class={`cc-control ${name.length > 0 && !isValidName ? 'is-bad' : ''}`}>
                <span class="cc-lead"><User size={16} color={isValidName ? 'var(--color-primary)' : undefined} /></span>
                <input
                  value={name}
                  onInput={(e) => setName((e.target as HTMLInputElement).value)}
                  placeholder="Your name on the grid"
                  maxLength={16}
                  spellcheck={false}
                />
                {isValidName && <span class="cc-trail"><Check size={16} color="var(--color-primary)" /></span>}
              </div>
              <div class={`cc-hint ${name.length > 0 && !isValidName ? 'is-bad' : ''}`}>
                {name.length > 0 && !isValidName
                  ? 'Letters, numbers and underscores only, 3 to 16 characters.'
                  : 'Must be unique across the server.'}
              </div>
            </div>

            {/* cc-raise: the open dropdown has to paint over the rows beneath
                it — see the note on .cc-raise, the rows are stacking contexts. */}
            <div class="cc-field cc-raise" data-done={nation !== ''}>
              <div class="cc-label">
                <span class="cc-step">{nation !== '' ? <Check size={10} /> : '2'}</span>
                Nation
              </div>
              <NationPicker value={nation} onPick={setNation} />
              <div class="cc-hint">Your flag flies beside your name in the standings.</div>
            </div>

            <div class="cc-field" data-done={isValidNumber}>
              <div class="cc-label">
                <span class="cc-step">{isValidNumber ? <Check size={10} /> : '3'}</span>
                Race number
              </div>
              <div class="cc-plate-row">
                <div class="cc-plate" data-on={isValidNumber}>
                  <b>{raceNumber || '00'}</b>
                </div>
                <div class={`cc-control ${raceNumber.length > 0 && !isValidNumber ? 'is-bad' : ''}`}>
                  <span class="cc-lead"><Hash size={16} color={isValidNumber ? 'var(--color-primary)' : undefined} /></span>
                  <input
                    inputMode="numeric"
                    value={raceNumber}
                    onInput={(e) => {
                      const el = e.target as HTMLInputElement
                      const v = el.value.replace(/\D/g, '').slice(0, 3)
                      el.value = v   // keep a rejected key out of the box (state may not change)
                      setRaceNumber(v)
                    }}
                    placeholder="1 – 999"
                    maxLength={3}
                  />
                </div>
              </div>
              <div class="cc-hint">Yours alone — numbers already taken are rejected on save.</div>
            </div>

            <div class="cc-field" data-done={plateTrimmed !== '' && isValidPlate}>
              <div class="cc-label">
                <span class="cc-step">{plateTrimmed !== '' && isValidPlate ? <Check size={10} /> : '4'}</span>
                Number plate
                <span class="cc-count">{plateTrimmed.length}/8</span>
              </div>
              <div class="cc-plate-row is-plate">
                <div class="cc-plate is-texture" data-on={plateTrimmed !== '' && isValidPlate}>
                  <PlatePreview text={plateTrimmed} />
                </div>
                <div class={`cc-control ${!isValidPlate ? 'is-bad' : ''}`}>
                  <span class="cc-lead">
                    <RectangleHorizontal size={16} color={plateTrimmed !== '' && isValidPlate ? 'var(--color-primary)' : undefined} />
                  </span>
                  <input
                    value={plate}
                    onInput={(e) => {
                      const el = e.target as HTMLInputElement
                      const caret = el.selectionStart ?? el.value.length
                      const before = el.value.length
                      const v = el.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 8)
                      el.value = v
                      // Uppercasing / dropping a character must not throw the caret to the end.
                      const pos = Math.max(0, caret - (before - v.length))
                      el.setSelectionRange(pos, pos)
                      setPlate(v)
                    }}
                    placeholder="Optional"
                    maxLength={8}
                    spellcheck={false}
                  />
                </div>
              </div>
              <div class="cc-hint">
                Goes on every car you spawn. Leave blank to keep the default. Change it later with /plate.
              </div>
            </div>

            {/* The artefact, not the form: exactly how the three answers combine
                on a nametag, so a mistake is caught before it is permanent. */}
            <div class={`cc-identity ${!isValidName && !isValidNumber ? 'is-empty' : ''}`}>
              <span class="num">{isValidNumber ? `#${numValue}` : '#—'}</span>
              {nation
                ? <img class="cc-flag" src={`flags/${nation}.webp`} alt="" />
                : <Flag size={14} color="var(--gray-700)" />}
              <span class="alias">{name || 'Your alias'}</span>
              <span class="tag">Preview</span>
            </div>

            <div class="cc-commit">
              <button class="cc-go" disabled={!canSubmit} onClick={submit}>
                {submitting ? 'Creating…' : 'Enter the grid'}
                {!submitting && <ArrowRight size={17} />}
              </button>
              <div class="cc-blocker">
                {blocker
                  ? <><Info size={12} />{blocker}</>
                  : <><Check size={12} color="var(--color-primary)" />Ready to race</>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default CharacterCreation
