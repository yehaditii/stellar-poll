import { useEffect, useRef, useState } from 'react'
import { createEventPoller } from '../utils/events'

export function useContractEvents(onEvent) {
  const eventHandler = useRef(onEvent)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  useEffect(() => {
    eventHandler.current = onEvent
  }, [onEvent])

  useEffect(() => createEventPoller({
    onEvent: event => eventHandler.current?.(event),
    onError: setError,
    onStatus: nextStatus => {
      setStatus(nextStatus)
      if (nextStatus === 'listening') setError(null)
    },
  }), [])

  return { status, error }
}