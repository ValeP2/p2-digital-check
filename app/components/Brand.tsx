import P2Mark from './P2Mark'

/** «P2/» + «Digital Check» — überall gleich: Seitenleiste, Anmeldung, öffentlicher Bericht. */
export default function Brand({ height = 24, color = '#1C1C1E', size = 15 }: { height?: number; color?: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5" style={{ color }}>
      <P2Mark height={height} color={color} />
      <span className="font-semibold leading-none pt-[3px]" style={{ fontSize: size }}>Digital Check</span>
    </span>
  )
}
