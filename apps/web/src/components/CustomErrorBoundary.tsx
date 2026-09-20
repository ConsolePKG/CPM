import { Button, Result } from '@/components/ui'
// import * as Sentry from '@sentry/react';
// import { BrowserTracing } from '@sentry/tracing';
import { cloneElement, Component, ReactElement, ReactNode } from 'react'

type Props = {
  children: ReactNode
  showDialog?: boolean
  title?: string
  subTitle?: string
}

// Sentry.init({
//   dsn: 'https://b330b8f226c444769a43292c20048d3e@o477756.ingest.sentry.io/6749540',
//   integrations: [new BrowserTracing()],
//   tracesSampleRate: 1.0
// });

type ErrorBoundaryProps = Props & { fallback: ReactNode }

class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  { error: Error | null; errorInfo: { componentStack: string } | null }
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo,
    })
    console.error(error)
  }

  render() {
    if (this.state.error) {
      return cloneElement(this.props.fallback as ReactElement<any>, { subTitle: this.state.error?.message })
    }
    return this.props.children
  }
}

export const CustomErrorBoundary = ({ children, title, subTitle, showDialog }: Props) => {
  if (import.meta.env.DEV) {
    return <>{children}</>
  }

  return (
    <ErrorBoundary
      showDialog={showDialog}
      fallback={
        <Result
          status="error"
          title={title || 'Error message'}
          subTitle={subTitle || 'Something went wrong. Please try again. '}
          extra={[
            <Button
              key="again"
              onClick={() => {
                window.location.reload()
              }}
            >
              Again
            </Button>,
          ]}
        ></Result>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
