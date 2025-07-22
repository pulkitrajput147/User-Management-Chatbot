import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        // Your backend API URL
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'An unknown error occurred.');
            }

            // --- SUCCESS ---
            // Store the token and redirect
            if (typeof window !== 'undefined') {
                localStorage.setItem('userToken', data.access_token);
                // Redirect to the main chat page.
                router.push('/');
            }

        } catch (err) {
            setError(err.message);
            setIsLoading(false);
        }
    };

    return (
        <>
            <Head>
                <title>Sign In - UserBot</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            </Head>
            {/* We use a style tag here for the global body and animation styles */}
            <style jsx global>{`
                body {
                    font-family: 'Inter', sans-serif;
                    background-color: #111827; /* Dark background */
                    overflow: hidden; /* Hide scrollbars from the animated background */
                }

                .background-grid {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 0;
                    background-image:
                        linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
                    background-size: 40px 40px;
                    animation: move-grid 200s linear infinite;
                }

                @keyframes move-grid {
                    from { background-position: 0 0; }
                    to { background-position: 10000px 10000px; }
                }

                .glow-effect {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 800px;
                    height: 800px;
                    background: radial-gradient(circle, rgba(79, 70, 229, 0.3) 0%, rgba(79, 70, 229, 0) 60%);
                    transform: translate(-50%, -50%);
                    animation: pulse-glow 10s ease-in-out infinite;
                }

                @keyframes pulse-glow {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
                    50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.7; }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
                }
            `}</style>

            <main className="flex items-center justify-center min-h-screen text-gray-200">
                <div className="background-grid"></div>
                <div className="glow-effect"></div>

                <div className="relative z-10 w-full max-w-md p-8 space-y-6 bg-gray-900/80 backdrop-blur-md border border-gray-700/50 rounded-2xl shadow-2xl">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-white">Welcome Back</h1>
                        <p className="text-gray-400 mt-2">Sign in to access the future of user management.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="text-sm font-medium text-gray-300">
                                Email Address
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full px-4 py-3 rounded-lg border text-white bg-gray-800 border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 outline-none transition"
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-900 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-purple-600/30 hover:-translate-y-0.5"
                            >
                                {isLoading ? 'Signing In...' : 'Sign In'}
                            </button>
                        </div>
                    </form>

                    {error && (
                        <div className="text-center p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-300 text-sm">
                            {error}
                        </div>
                    )}
                </div>
            </main>
        </>
    );
};

export default LoginPage;
