import type { ComponentType, ReactNode } from 'react'

type IconCmp = ComponentType<{ size?: number }>

type Props = {
  icon: IconCmp
  title: string
  subtitle?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, subtitle, action }: Props) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={26} />
      </div>
      <div className="empty-title">{title}</div>
      {subtitle && <div className="text-sm mt-8">{subtitle}</div>}
      {action && <div className="mt-12">{action}</div>}
    </div>
  )
}
