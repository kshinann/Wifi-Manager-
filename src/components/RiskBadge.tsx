interface RiskBadgeProps {
  risk: 'critical' | 'high' | 'medium' | 'low'
}

const LABELS: Record<RiskBadgeProps['risk'], string> = {
  critical: 'Critical risk',
  high: 'High risk',
  medium: 'Medium risk',
  low: 'Low risk',
}

export function RiskBadge({ risk }: RiskBadgeProps) {
  return <span className={`badge badge--${risk}`}>{LABELS[risk]}</span>
}
