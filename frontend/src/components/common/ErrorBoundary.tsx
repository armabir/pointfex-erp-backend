import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCw, ShieldAlert } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  errorId: string | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, errorId: null }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return {
      hasError: true,
      errorId: `ERR-${Date.now().toString(36).toUpperCase()}`,
    }
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // Error details intentionally withheld from client console/DOM to prevent stack leakage
  }

  private handleReload = () => {
    window.location.href = '/'
  }

  private handleResetView = () => {
    this.setState({ hasError: false, errorId: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-slate-900/90 border border-white/10 shadow-2xl p-8 text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[11px] font-semibold uppercase tracking-wider text-rose-300">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>System Error</span>
              </div>
              <h1 className="text-xl font-bold text-white">Unexpected Application Interruption</h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Pointfex ERP encountered an unexpected interface error. Your corporate session and
                database records remain safely intact.
              </p>
              {this.state.errorId && (
                <p className="text-[11px] font-mono text-slate-500">
                  Reference Code: {this.state.errorId}
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleResetView}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
              >
                Try Recovering
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white inline-flex items-center gap-1.5 shadow-lg shadow-indigo-600/25 transition-colors cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Reload Workspace</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
