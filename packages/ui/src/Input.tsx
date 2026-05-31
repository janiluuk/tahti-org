import React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean
}

export function Input({ mono, className = '', ...props }: InputProps) {
  return (
    <input
      className={`input${mono ? ' mono' : ''} ${className}`.trim()}
      {...props}
    />
  )
}

export interface FormFieldProps {
  label: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, children, className = '' }: FormFieldProps) {
  return (
    <div className={`apply-field ${className}`.trim()}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}
