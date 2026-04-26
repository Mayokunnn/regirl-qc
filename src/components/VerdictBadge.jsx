const VERDICT_STYLES = {
  PASS: { bg: '#16a34a', color: '#fff' },
  FAIL: { bg: '#dc2626', color: '#fff' },
  ADVISORY: { bg: '#d97706', color: '#fff' },
  'NEEDS REVIEW': { bg: '#2563eb', color: '#fff' },
}

export default function VerdictBadge({ verdict, large = false }) {
  const style = VERDICT_STYLES[verdict] || { bg: '#6b7280', color: '#fff' }
  return (
    <span
      style={{ backgroundColor: style.bg, color: style.color }}
      className={`inline-block font-bold rounded ${large ? 'px-5 py-2 text-lg' : 'px-2.5 py-0.5 text-xs'}`}
    >
      {verdict}
    </span>
  )
}
