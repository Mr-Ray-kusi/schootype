import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI crash:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-slate-100">
          <h1 className="text-xl font-bold text-white">Something went wrong</h1>
          <p className="max-w-lg text-sm text-slate-400">
            {this.state.error?.message || 'The page failed to render after sign-in.'}
          </p>
          <button
            type="button"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('school');
              localStorage.removeItem('tokenExpiresAt');
              window.location.href = '/login';
            }}
          >
            Clear session and go to login
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
