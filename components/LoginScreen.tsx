
import React, { useState } from 'react';
import { AiIcon, LoginIcon } from './Icons';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === '' || password.trim() === '') {
      setError('Please enter both username and password.');
      return;
    }
    // Simulate successful login
    setError('');
    onLoginSuccess();
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-800">
      <div className="w-full max-w-sm p-8 space-y-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center">
            <div className="inline-block p-4 bg-gradient-to-br from-blue-400 to-sky-500 rounded-full mb-4">
                 <AiIcon className="w-10 h-10 text-white" />
            </div>
          <h1 className="text-3xl font-bold text-slate-800">Welcome to Jarvis</h1>
          <p className="mt-2 text-slate-500">Your personal AI assistant</p>
        </div>
        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label
              htmlFor="username"
              className="text-sm font-medium text-slate-600"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 mt-2 text-slate-800 bg-slate-100 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-slate-600"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 mt-2 text-slate-800 bg-slate-100 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div>
            <button
              type="submit"
              className="flex items-center justify-center w-full px-4 py-3 font-semibold text-white transition-transform duration-200 transform bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-blue-500"
            >
                <LoginIcon className="w-5 h-5 mr-2" />
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;