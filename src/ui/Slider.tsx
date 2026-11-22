interface SliderProps {
  id: string
  label: string
  min: number
  max: number
  step: number
  value: number
  reset: number
  display: (v: number) => string
  onChange: (v: number) => void
}

export function Slider(p: SliderProps) {
  const clamp = (v: number) => Math.min(p.max, Math.max(p.min, v))
  return (
    <div class="slider-row" data-testid={`lab-slider-${p.id}`}>
      <button class="lbl" onClick={() => p.onChange(p.reset)} aria-label={`Reset ${p.label}`}>
        {p.label}
      </button>
      <output>{p.display(p.value)}</output>
      <div class="control">
        <button class="step" aria-label={`${p.label} down`} onClick={() => p.onChange(clamp(p.value - p.step))}>
          −
        </button>
        <input
          type="range"
          min={p.min}
          max={p.max}
          step={p.step}
          value={p.value}
          aria-label={p.label}
          onInput={(e) => p.onChange(Number((e.target as HTMLInputElement).value))}
        />
        <button class="step" aria-label={`${p.label} up`} onClick={() => p.onChange(clamp(p.value + p.step))}>
          +
        </button>
      </div>
    </div>
  )
}
