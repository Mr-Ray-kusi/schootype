import React, { useState } from 'react';

import { useNavigate, Link, useSearchParams } from 'react-router-dom';

import { useAuth, getPostAuthPath } from '../contexts/authcontext';

import toast from 'react-hot-toast';

import { School } from 'lucide-react';



const Login = () => {

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);

  const { login } = useAuth();

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const planParam = searchParams.get('plan');



  const handleSubmit = async (e) => {

    e.preventDefault();

    setLoading(true);

    try {

      const data = await login(email, password);

      toast.success('Login successful!');

      navigate(getPostAuthPath(data.school));

    } catch (error) {
      const data = error.response?.data;
      const message =
        data?.error
        || (error.request && !error.response
          ? 'Cannot connect to server. Start the backend: cd backend && npm run dev'
          : 'Login failed');
      if (error.response?.status === 429 && data?.retryAfter) {
        toast.error(`${message} (${data.retryAfter}s)`);
      } else {
        toast.error(message);
      }

    } finally {

      setLoading(false);

    }

  };



  const signupLink = planParam ? `/signup?plan=${planParam}` : '/signup';



  return (

    <div className="min-h-screen flex items-center justify-center bg-slate-900">

      <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md">

        <div className="text-center mb-8">

          <Link to="/" className="inline-flex items-center gap-2 text-primary-300 hover:text-primary-200 mb-4">

            <School className="w-6 h-6" />

            <span className="font-semibold">SchoolMS</span>

          </Link>

          <h1 className="text-2xl font-bold text-white">Login to your account</h1>

          {planParam && (

            <p className="text-sm text-primary-300 mt-2 capitalize">

              Plan selected: {planParam}

            </p>

          )}

        </div>



        <form onSubmit={handleSubmit} className="space-y-6">

          <div>

            <label className="block text-sm font-medium text-slate-100 mb-2">

              Email Address

            </label>

            <input

              type="email"

              value={email}

              onChange={(e) => setEmail(e.target.value)}

              className="input"

              required

              placeholder="admin@school.com"

            />

          </div>



          <div>

            <label className="block text-sm font-medium text-slate-100 mb-2">

              Password

            </label>

            <input

              type="password"

              value={password}

              onChange={(e) => setPassword(e.target.value)}

              className="input"

              required

              placeholder="••••••••"

            />

          </div>



          <button

            type="submit"

            disabled={loading}

            className="btn-primary w-full disabled:opacity-50"

          >

            {loading ? 'Logging in...' : 'Login'}

          </button>

        </form>



        <p className="text-center mt-6 text-slate-300">

          Don't have an account?{' '}

          <Link to={signupLink} className="text-primary-300 hover:text-primary-200 hover:underline">

            Sign up

          </Link>

        </p>



        <p className="text-center mt-3">

          <Link to="/" className="text-sm text-slate-400 hover:text-slate-300">

            ← Back to payment plans

          </Link>

        </p>



        {import.meta.env.DEV && (

          <div className="mt-6 p-4 bg-slate-700/80 rounded-lg border border-slate-600 text-xs text-slate-300">

            <p className="font-medium text-slate-200 mb-2">Dev super admin</p>

            <p>Email: superadmin@school.com</p>

            <p>Password: SuperAdmin123!</p>

          </div>

        )}

      </div>

    </div>

  );

};



export default Login;

