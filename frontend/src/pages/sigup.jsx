import { useState } from 'react';

import { useNavigate, Link, useSearchParams } from 'react-router-dom';

import toast from 'react-hot-toast';

import { useAuth, getPostAuthPath } from '../contexts/authcontext';

import { getPlan } from '../constants/plans';

import { School } from 'lucide-react';



const Signup = () => {

  const navigate = useNavigate();

  const { signup } = useAuth();

  const [searchParams] = useSearchParams();

  const planParam = searchParams.get('plan');

  const selectedPlan = planParam ? getPlan(planParam) : null;



  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({

    email: '',

    password: '',

    confirmPassword: '',

    schoolName: ''

  });

  const [logo, setLogo] = useState(null);

  const [logoPreview, setLogoPreview] = useState(null);



  const handleChange = (e) => {

    setFormData({

      ...formData,

      [e.target.name]: e.target.value

    });

  };



  const handleLogoChange = (e) => {

    const file = e.target.files?.[0];

    if (!file) return;



    if (!file.type.startsWith('image/')) {

      toast.error('Please select an image file');

      return;

    }



    if (file.size > 2 * 1024 * 1024) {

      toast.error('Logo must be smaller than 2MB');

      return;

    }



    const reader = new FileReader();

    reader.onloadend = () => {

      setLogo(reader.result);

      setLogoPreview(reader.result);

    };

    reader.readAsDataURL(file);

  };



  const handleRemoveLogo = () => {

    setLogo(null);

    setLogoPreview(null);

  };



  const handleSubmit = async (e) => {

    e.preventDefault();



    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (!/[a-zA-Z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      toast.error('Password must include at least one letter and one number');
      return;
    }

    setLoading(true);

    try {

      const data = await signup(

        formData.schoolName,

        formData.email,

        formData.password,

        logo,

        planParam || null

      );

      toast.success(planParam ? 'Account created! Your plan is awaiting admin approval.' : 'Account created successfully!');
      navigate(getPostAuthPath(data.school));

    } catch (error) {

      toast.error(error.response?.data?.error || error.response?.data?.message || 'Signup failed');

    } finally {

      setLoading(false);

    }

  };



  const loginLink = planParam ? `/login?plan=${planParam}` : '/login';



  return (

    <div className="min-h-screen flex items-center justify-center bg-slate-900 py-8">

      <div className="max-w-md w-full space-y-6 p-8 bg-slate-800 rounded-lg shadow-lg shadow-black/30">

        <div className="text-center">

          <Link to="/" className="inline-flex items-center gap-2 text-primary-300 hover:text-primary-200 mb-4">

            <School className="w-6 h-6" />

            <span className="font-semibold">SchoolMS</span>

          </Link>

          <h2 className="text-3xl font-bold text-white">Sign Up</h2>

          {selectedPlan ? (

            <p className="text-sm text-primary-300 mt-2">

              {selectedPlan.name} plan — ${selectedPlan.price}/{selectedPlan.period}

            </p>

          ) : (

            <p className="text-sm text-slate-300 mt-2">

              You'll choose a payment plan after creating your account.

            </p>

          )}

        </div>



        <form onSubmit={handleSubmit} className="space-y-4">

          <div>

            <label className="block text-sm font-medium text-slate-100">School Name</label>

            <input

              type="text"

              name="schoolName"

              required

              value={formData.schoolName}

              onChange={handleChange}

              className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-50 shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"

            />

          </div>



          <div>

            <label className="block text-sm font-medium text-slate-100">Email</label>

            <input

              type="email"

              name="email"

              required

              value={formData.email}

              onChange={handleChange}

              className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-50 shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"

            />

          </div>



          <div>

            <label className="block text-sm font-medium text-slate-100">Password</label>

            <input

              type="password"

              name="password"

              required

              value={formData.password}

              onChange={handleChange}

              className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-50 shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"

            />
            <p className="text-xs text-slate-400 mt-1">At least 8 characters with letters and numbers.</p>

          </div>

          <div>
            <label className="block text-sm font-medium text-slate-100">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-50 shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>

            <label className="block text-sm font-medium text-slate-100">School Logo (optional)</label>

            <p className="text-xs text-slate-300 mt-1 mb-2">This logo will appear on your admin dashboard.</p>

            {logoPreview ? (

              <div className="flex items-center gap-4 mt-2">

                <img

                  src={logoPreview}

                  alt="Logo preview"

                  className="w-16 h-16 rounded-lg object-cover border border-slate-600"

                />

                <button

                  type="button"

                  onClick={handleRemoveLogo}

                  className="text-sm text-red-400 hover:text-red-300"

                >

                  Remove

                </button>

              </div>

            ) : (

              <input

                type="file"

                accept="image/*"

                onChange={handleLogoChange}

                className="mt-1 block w-full text-sm text-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-600 file:text-white hover:file:bg-primary-700"

              />

            )}

          </div>



          <button

            type="submit"

            disabled={loading}

            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"

          >

            {loading ? 'Creating account...' : 'Create Account'}

          </button>

        </form>



        <p className="text-center text-sm text-slate-300">

          Already have an account?{' '}

          <Link to={loginLink} className="font-medium text-primary-300 hover:text-primary-200">

            Login

          </Link>

        </p>



        {!planParam && (

          <p className="text-center">

            <Link to="/" className="text-sm text-slate-400 hover:text-slate-300">

              ← View payment plans first

            </Link>

          </p>

        )}

      </div>

    </div>

  );

};



export default Signup;

