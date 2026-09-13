'use client'

import React from 'react'
import { CheckSquare, Umbrella, Wind, Sun, ShieldAlert, Sparkles, Navigation } from 'lucide-react'
import type { ActionPlanItem, ActionCategory } from '@/lib/intelligence/types'

interface TodayActionPlanCardProps {
  items: ActionPlanItem[]
}

export function TodayActionPlanCard({ items }: TodayActionPlanCardProps) {
  const getCategoryIcon = (category: ActionCategory) => {
    switch (category) {
      case 'ALERT':
        return <ShieldAlert size={16} />
      case 'RAIN':
        return <Umbrella size={16} />
      case 'UV':
        return <Sun size={16} />
      case 'AIR':
        return <Wind size={16} />
      case 'HEAT':
        return <Sun size={16} />
      case 'COMMUTE':
        return <Navigation size={16} />
      case 'GENERAL':
      default:
        return <Sparkles size={16} />
    }
  }

  const getCategoryBg = (category: ActionCategory) => {
    switch (category) {
      case 'ALERT':
        return 'var(--coral)'
      case 'RAIN':
        return 'var(--cyan)'
      case 'UV':
        return 'var(--orange)'
      case 'AIR':
        return 'var(--lavender)'
      case 'HEAT':
        return '#fff09a'
      case 'COMMUTE':
        return 'var(--mint)'
      case 'GENERAL':
      default:
        return 'var(--acid)'
    }
  }

  return (
    <div className="intel-card action-plan-card">
      <div className="intel-card-header">
        <div className="intel-kicker-group">
          <span className="intel-kicker">DECISION SUPPORT • ACTION CHECKLIST</span>
          <h3 className="intel-title">TODAY&apos;S ACTION PLAN</h3>
        </div>
        <div className="intel-plan-counter">
          <CheckSquare size={14} />
          <span>{items.length} KEY PRIORITIES</span>
        </div>
      </div>

      <div className="action-plan-grid">
        {items.map((item, index) => {
          const bg = getCategoryBg(item.category)
          return (
            <div key={item.id || `action-${index}`} className="action-plan-item">
              <div className="action-item-badge-row">
                <span className="action-item-icon" style={{ backgroundColor: bg }}>
                  {getCategoryIcon(item.category)}
                </span>
                <span className="action-item-category">
                  {item.badgeText || item.category}
                </span>
                <span className="action-item-priority">PRIORITY 0{index + 1}</span>
              </div>

              <strong className="action-item-title">{item.title}</strong>
              <p className="action-item-desc">{item.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
