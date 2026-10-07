"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { loggers } from "@/lib/logger"
import { isChunkLoadError } from "@/lib/chunk-load-error"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  name?: string
}

interface ErrorBoundaryState {
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

const CHUNK_RELOAD_RETRY_WINDOW_MS = 60_000

/** Reload once when a deployment leaves the browser holding stale chunk URLs. */
function reloadForChunkLoadErrorOnce(): boolean {
  try {
    const key = `weebx:chunk-load-retry:${window.location.pathname}`
    const lastAttempt = Number(window.sessionStorage.getItem(key) || 0)
    const now = Date.now()
    if (lastAttempt > 0 && now - lastAttempt < CHUNK_RELOAD_RETRY_WINDOW_MS) return false

    window.sessionStorage.setItem(key, String(now))
    window.location.reload()
    return true
  } catch {
    // Storage can be disabled in private/restricted browser contexts. Leave the
    // regular error UI available rather than risking an unbounded reload loop.
    return false
  }
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    const boundaryName = this.props.name || "unknown component"
    // Keep the stack and component trace: the production UI intentionally hides
    // internals, so these logs are the only reliable way to diagnose reports.
    loggers.critical.critical(`ErrorBoundary caught error in ${boundaryName}: ${error.message}`, error)
    if (errorInfo.componentStack) {
      loggers.critical.critical(`ErrorBoundary component stack in ${boundaryName}`, new Error(errorInfo.componentStack))
    }

    // Next.js can retain stale references to lazily loaded chunks after a
    // deployment. One guarded hard reload usually fetches the matching build;
    // the session guard leaves the fallback visible if the retry also fails.
    if (isChunkLoadError(error)) reloadForChunkLoadErrorOnce()
  }

  handleReset = () => {
    if (this.state.error && isChunkLoadError(this.state.error)) {
      window.location.reload()
      return
    }

    this.setState({
      error: null,
      errorInfo: null,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = "/"
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8 bg-background">
          <div className="max-w-md w-full bg-card border border-border rounded-lg p-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>

            <h2 className="text-xl font-semibold text-foreground mb-2">
              Что-то пошло не так
            </h2>

            <p className="text-muted-foreground mb-6">
              Произошла ошибка при загрузке компонента. Попробуйте обновить страницу или вернуться на главную.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Попробовать снова
              </Button>

              <Button
                onClick={this.handleReload}
                variant="default"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Обновить страницу
              </Button>

              <Button
                onClick={this.handleGoHome}
                variant="secondary"
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                На главную
              </Button>
            </div>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                  Технические детали
                </summary>
                <pre className="mt-2 p-3 bg-muted rounded text-xs text-destructive overflow-auto max-h-64">
                  {this.state.error.message}
                  {"\n\n"}
                  {this.state.error.stack}
                  {"\n\n"}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook for functional components to catch errors
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  const handleError = React.useCallback((err: Error) => {
    loggers.critical.critical(`Error caught by useErrorHandler: ${err.message}`)
    setError(err)
  }, [])

  const clearError = React.useCallback(() => {
    setError(null)
  }, [])

  return { error, handleError, clearError }
}

// Simple error fallback component
export function ErrorFallback({ error, onRetry }: { error?: Error | null; onRetry?: () => void }) {
  if (!error) return null

  return (
    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-destructive mb-1">Ошибка загрузки</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="mt-3 gap-2"
            >
              <RefreshCw className="w-3 h-3" />
              Повторить
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
