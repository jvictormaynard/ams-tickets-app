"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

            // Navigate after setting auth
            router.replace('/');
        } catch (err: any) {
            console.error('Login error:', err); // debug error
            setError(err.message || 'Erro ao fazer login');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
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
        </>
    );
}
