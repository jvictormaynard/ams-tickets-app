"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Head from 'next/head';
import Image from 'next/image';

const LOGO_URL = "https://s3.dev.amssergipe.com.br/general/b84493fc-cbf9-4f67-9abf-020f25a32447.png";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        console.log('Submitting login', { username, /* masked for security */ }); // debug submission

        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
                credentials: 'include',
            });
            console.log('Response status:', response.status); // debug status

            const data = await response.json();
            console.log('Response data:', data); // debug payload

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao fazer login');
            }

            // Set authentication in localStorage
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('loginTimestamp', Date.now().toString());
            
            // Navigate after setting auth
            router.replace('/');
        } catch (err: any) {
            console.error('Login error:', err); // debug error
            setError(err.message || 'Erro ao fazer login');
            // Clear any stale auth data
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('loginTimestamp');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Head>
                <title>Login - Painel de Tickets AMS</title>
            </Head>
            <div className="login-container">
                <div className="floating-logo">
                    <Image
                        src={LOGO_URL}
                        alt="Logo AMS Sergipe"
                        width={200}
                        height={60}
                        priority
                        className="logo-image"
                        style={{ width: 'auto', height: 'auto' }}
                        onError={(e) => console.error('Image failed:', (e.currentTarget as HTMLImageElement).src)}
                    />
                </div>
                <div className="login-box">
                    <div className="title-container">
                        <span className="welcome-text">Bem-vindo ao</span>
                        <h2>Painel de Tickets</h2>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label htmlFor="username">Usuário</label>
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="password">Senha</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        {error && <p className="error-message">{error}</p>}
                        <button
                            type="submit"
                            className="login-button"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>
                </div>
            </div>
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @keyframes slideIn {
                    from { transform: translateX(-10px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }

                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #1a1d21 0%, #121416 100%);
                    color: #e0e0e0;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    height: 100vh;
                    overflow: hidden;
                }

                .login-container {
                    position: absolute;
                    top: 50%;
                    left: 50%;  
                    transform: translate(-50%, -50%);
                    display: flex;
                    justify-content: center;a
                    align-items: center;
                    width: 100%;
                    max-width: 420px;
                    animation: fadeIn 0.6s ease-out;
                }

                .floating-logo {
                    position: absolute;
                    top: -15%;
                    left: 50%;
                    transform: translateX(-50%) translateY(-65%);
                    z-index: 10;
                    animation: floatIn 0.8s ease-out;
                }

                @keyframes floatIn {
                    from { 
                        opacity: 0;
                        transform: translateX(-50%) translateY(-55%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(-65%);
                    }
                }

                .login-box {
                    background: rgba(37, 40, 44, 0.95);
                    padding: 40px;
                    border-radius: 16px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                    width: 100%;
                    border: 1px solid rgba(0, 123, 255, 0.2);
                    backdrop-filter: blur(10px);
                }

                .logo-image {
                    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
                    transition: all 0.3s ease;
                    max-width: 200px;
                    height: auto;
                }

                .logo-image:hover {
                    transform: scale(1.02);
                    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4));
                }

                .title-container {
                    text-align: left;
                    margin-bottom: 30px;
                    animation: slideIn 0.6s ease-out;
                }

                .welcome-text {
                    display: block;
                    color: #8b8d91;
                    font-size: 16px;
                    margin-bottom: 4px;
                    font-weight: 500;
                }

                .login-box h2 {
                    color: #4AC9FF;
                    text-align: left;
                    margin: 0;
                    font-size: 28px;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }

                .input-group {
                    margin-bottom: 24px;
                    animation: slideIn 0.6s ease-out;
                }

                .input-group label {
                    display: block;
                    color: #8b8d91;
                    margin-bottom: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    transition: color 0.2s ease;
                }

                .input-group:focus-within label {
                    color: #4AC9FF;
                }

                .input-group input {
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 8px;
                    border: 2px solid #3a3f44;
                    background-color: rgba(30, 33, 37, 0.8);
                    color: #e0e0e0;
                    font-size: 15px;
                    box-sizing: border-box;
                    transition: all 0.2s ease;
                }

                .input-group input:focus {
                    outline: none;
                    border-color: #4AC9FF;
                    box-shadow: 0 0 0 3px rgba(74, 201, 255, 0.15);
                    background-color: rgba(30, 33, 37, 0.95);
                }

                .input-group input:disabled {
                    background-color: #2a2d31;
                    cursor: not-allowed;
                    opacity: 0.7;
                }

                .login-button {
                    width: 100%;
                    padding: 14px 20px;
                    background: linear-gradient(135deg, #007bff 0%, #4AC9FF 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 600;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }

                .login-button:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(74, 201, 255, 0.2);
                }

                .login-button:active:not(:disabled) {
                    transform: translateY(0);
                }

                .login-button:disabled {
                    background: #4a5056;
                    cursor: not-allowed;
                    opacity: 0.7;
                }

                .error-message {
                    color: #ff6b6b;
                    text-align: center;
                    margin-bottom: 20px;
                    font-size: 14px;
                    padding: 10px;
                    background-color: rgba(255, 107, 107, 0.1);
                    border-radius: 6px;
                    animation: fadeIn 0.3s ease-out;
                }
            `}</style>
        </>
    );
}
