/**
 * Mobile-First Responsive Components
 * Optimized components for mobile auction interface
 */

import { ReactNode } from 'react'
import { 
  Bars3Icon, 
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'

interface MobileHeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
  onMenu?: () => void
  actions?: ReactNode
}

export function MobileHeader({ title, subtitle, onBack, onMenu, actions }: MobileHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-md hover:bg-gray-100 md:hidden"
            >
              <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
            </button>
          )}
          {onMenu && (
            <button
              onClick={onMenu}
              className="p-2 -ml-2 rounded-md hover:bg-gray-100 md:hidden"
            >
              <Bars3Icon className="h-5 w-5 text-gray-600" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center space-x-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

interface MobileCardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function MobileCard({ children, className = '', padding = 'md' }: MobileCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  )
}

interface MobileStatsGridProps {
  stats: Array<{
    label: string
    value: string | number
    icon?: ReactNode
    color?: 'blue' | 'green' | 'red' | 'yellow' | 'indigo'
  }>
}

export function MobileStatsGrid({ stats }: MobileStatsGridProps) {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    indigo: 'text-indigo-600'
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat, index) => (
        <div key={index} className="text-center">
          {stat.icon && (
            <div className={`mx-auto mb-2 ${colorClasses[stat.color || 'blue']}`}>
              {stat.icon}
            </div>
          )}
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{stat.value}</p>
          <p className="text-xs sm:text-sm text-gray-500">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}

interface MobilePlayerCardProps {
  player: {
    name: string
    position: string
    nationality: string
    imageUrl?: string
  }
  price?: number
  team?: {
    name: string
    logo?: string
  }
  actions?: ReactNode
  compact?: boolean
}

export function MobilePlayerCard({ player, price, team, actions, compact = false }: MobilePlayerCardProps) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center space-x-3">
        <div className={`${compact ? 'w-10 h-10' : 'w-12 h-12'} bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0`}>
          {player.imageUrl ? (
            <img 
              src={player.imageUrl} 
              alt={player.name}
              className={`${compact ? 'w-10 h-10' : 'w-12 h-12'} rounded-full object-cover`}
            />
          ) : (
            <span className={`${compact ? 'text-sm' : 'text-lg'} font-bold text-gray-500`}>
              {player.name.charAt(0)}
            </span>
          )}
        </div>
        
        <div className="min-w-0 flex-1">
          <h3 className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-gray-900 truncate`}>
            {player.name}
          </h3>
          <p className={`${compact ? 'text-xs' : 'text-sm'} text-gray-500`}>
            {player.position} • {player.nationality}
          </p>
          
          {team && (
            <div className="flex items-center space-x-1 mt-1">
              {team.logo && (
                <img src={team.logo} alt={team.name} className="w-4 h-4 rounded" />
              )}
              <span className="text-xs text-gray-600">{team.name}</span>
            </div>
          )}
        </div>
        
        <div className="text-right flex-shrink-0">
          {price && (
            <p className={`${compact ? 'text-sm' : 'text-base'} font-bold text-green-600`}>
              ₹{price.toLocaleString()}
            </p>
          )}
          {actions}
        </div>
      </div>
    </div>
  )
}

interface MobileBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  height?: 'auto' | 'half' | 'full'
}

export function MobileBottomSheet({ isOpen, onClose, title, children, height = 'auto' }: MobileBottomSheetProps) {
  if (!isOpen) return null

  const heightClasses = {
    auto: 'max-h-[70vh]',
    half: 'h-[50vh]',
    full: 'h-[90vh]'
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-lg ${heightClasses[height]} overflow-hidden`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-md hover:bg-gray-100"
          >
            <XMarkIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

interface MobileTabsProps {
  tabs: Array<{
    id: string
    label: string
    icon?: ReactNode
    count?: number
  }>
  activeTab: string
  onChange: (tabId: string) => void
}

export function MobileTabs({ tabs, activeTab, onChange }: MobileTabsProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="flex overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === tab.id
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

interface MobileBidButtonProps {
  amount: number
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}

export function MobileBidButton({ amount, onClick, disabled = false, variant = 'primary', size = 'md' }: MobileBidButtonProps) {
  const baseClasses = 'font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
  
  const variantClasses = {
    primary: disabled 
      ? 'bg-gray-300 text-gray-500' 
      : 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
    secondary: disabled
      ? 'bg-gray-100 text-gray-400 border border-gray-200'
      : 'bg-white text-indigo-600 border border-indigo-600 hover:bg-indigo-50 focus:ring-indigo-500'
  }
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-6 py-4 text-lg'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} w-full`}
    >
      Bid ₹{amount.toLocaleString()}
    </button>
  )
}

interface MobileTimerProps {
  timeRemaining: number
  size?: 'sm' | 'md' | 'lg'
}

export function MobileTimer({ timeRemaining, size = 'md' }: MobileTimerProps) {
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl'
  }
  
  const isUrgent = timeRemaining <= 30

  return (
    <div className={`font-mono font-bold ${sizeClasses[size]} ${
      isUrgent ? 'text-red-600' : 'text-gray-900'
    }`}>
      {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  )
}

interface MobileSwipeableListProps {
  items: Array<{
    id: string
    content: ReactNode
    actions?: ReactNode
  }>
  onSwipeAction?: (itemId: string, action: string) => void
}

export function MobileSwipeableList({ items, onSwipeAction }: MobileSwipeableListProps) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="relative overflow-hidden">
          <div className="bg-white border border-gray-200 rounded-lg">
            {item.content}
          </div>
          {item.actions && (
            <div className="absolute right-0 top-0 bottom-0 flex items-center bg-red-500 px-4">
              {item.actions}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* Mobile-specific utility classes */
export const mobileUtilities = {
  // Safe area padding for devices with notches
  safePadding: 'pt-safe-top pb-safe-bottom pl-safe-left pr-safe-right',
  
  // Touch-friendly sizing
  touchTarget: 'min-h-[44px] min-w-[44px]',
  
  // Scrollable containers
  scrollContainer: 'overflow-auto scrollbar-hide',
  
  // Hidden scrollbars
  hideScrollbar: 'scrollbar-hide',
  
  // Full viewport height on mobile
  fullHeight: 'min-h-screen min-h-[100dvh]'
}