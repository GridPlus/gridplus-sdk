import { type ReactNode, useState } from 'react'

interface ButtonProps {
  onClick: () => Promise<void>
  children: ReactNode
}

export const Button = ({ onClick, children }: ButtonProps) => {
  const [isLoading, setIsLoading] = useState(false)

  const handleOnClick = () => {
    setIsLoading(true)
    onClick().finally(() => setIsLoading(false))
  }
  return (
    <button type="button" onClick={handleOnClick} disabled={isLoading}>
      {children}
    </button>
  )
}
