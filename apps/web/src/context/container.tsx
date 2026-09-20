import { createContext, ReactNode, useContext } from 'react'

type ProviderProps<State> = State extends undefined
  ? {
      initState?: State
      children: ReactNode
    }
  : { initState: State; children: ReactNode }

export const createContainer = <Value, State = undefined>(
  useHook: (initState: State) => Value,
  displayName?: string,
) => {
  const Context = createContext<Value | null>(null)

  if (displayName) {
    Context.displayName = displayName
  }

  function useContainer(throwError?: true): Value
  function useContainer(throwError?: false): Value | undefined
  function useContainer(throwError = true): Value | undefined {
    const value = useContext(Context)
    if (value === null) {
      if (throwError) {
        throw new Error('Component must be wrapped in Provider')
      } else {
        return undefined
      }
    }
    return value
  }

  const Provider = ({ initState, children }: ProviderProps<State>) => {
    const value = useHook(initState as State)
    return <Context.Provider value={value}>{children}</Context.Provider>
  }

  return { useContainer, Provider }
}
