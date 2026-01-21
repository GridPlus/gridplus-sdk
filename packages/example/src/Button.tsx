import { useState } from 'react'

export const Button = ({ onClick, children }) => {
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
