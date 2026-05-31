import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'sm' | 'icon'
  as?: 'button' | 'a'
  href?: string
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  as: Tag = 'button',
  href,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const cls = `btn-${variant} ${className}`.trim()

  if (Tag === 'a') {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    )
  }

  return (
    <button className={cls} {...props}>
      {children}
    </button>
  )
}
