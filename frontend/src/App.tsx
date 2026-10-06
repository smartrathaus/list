import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

type User = {
  id: string;
  email: string;
  username: string;
};

type ListItem = {
  id: string;
  title: string;
  completed: boolean;
  quantity: number;
  unit: string;
  notes: string;
  priority: number;
  dueDate?: string | null;
  category?: { id: string; name: string; color: string } | null;
};

type ShoppingList = {
  id: string;
  title: string;
  color: string;
  icon: string;
  creator: { id: string; username: string };
  items: ListItem[];
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL
});

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newListTitle, setNewListTitle] = useState('');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    api
      .get('/auth/me', { headers: getAuthHeader() })
      .then((res) => {
        setUser(res.data);
      })
      .catch(() => {
        localStorage.removeItem('token');
      });
  }, []);

  useEffect(() => {
    if (!user) return;

    const socket = io('http://localhost:5000');

    socket.on('connect', () => {
      if (selectedListId) socket.emit('join-list', selectedListId);
    });

    socket.on('item-created', (item) => {
      setLists((current) =>
        current.map((list) =>
          list.id === selectedListId
            ? { ...list, items: [...list.items, item] }
            : list
        )
      );
    });

    socket.on('item-updated', (item) => {
      setLists((current) =>
        current.map((list) =>
          list.id === selectedListId
            ? {
                ...list,
                items: list.items.map((existing) => (existing.id === item.id ? item : existing))
              }
            : list
        )
      );
    });

    return () => socket.disconnect();
  }, [user, selectedListId]);

  useEffect(() => {
    if (!user) return;

    api
      .get('/lists', { headers: getAuthHeader() })
      .then((res) => setLists(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Fehler beim Laden der Listen'));
  }, [user]);

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedListId) ?? null,
    [lists, selectedListId]
  );

  const handleAuth = async () => {
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const payload = authMode === 'login' ? { email, password } : { email, username, password };
      const res = await api.post(endpoint, payload);
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentifizierung fehlgeschlagen');
    }
  };

  const handleCreateList = async () => {
    if (!newListTitle.trim()) return;

    try {
      const res = await api.post('/lists', { title: newListTitle }, { headers: getAuthHeader() });
      setLists((current) => [res.data, ...current]);
      setSelectedListId(res.data.id);
      setNewListTitle('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Liste konnte nicht erstellt werden');
    }
  };

  const handleAddItem = async () => {
    if (!selectedListId || !newItemTitle.trim()) return;

    try {
      await api.post(
        '/items',
        { listId: selectedListId, title: newItemTitle },
        { headers: getAuthHeader() }
      );
      setNewItemTitle('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Eintrag konnte nicht hinzugefügt werden');
    }
  };

  const toggleItem = async (itemId: string, completed: boolean) => {
    try {
      await api.put(`/items/${itemId}`, { completed: !completed }, { headers: getAuthHeader() });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Eintrag konnte nicht aktualisiert werden');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setLists([]);
    setSelectedListId(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
          <div className="mb-6 text-center">
            <div className="text-3xl font-bold text-brand-600">List</div>
            <p className="text-slate-500 mt-2">Einkaufslisten für mehrere Benutzer</p>
          </div>

          <div className="flex gap-2 mb-5">
            <button
              className={`flex-1 rounded-xl px-4 py-2 ${authMode === 'login' ? 'bg-brand-600 text-white' : 'bg-slate-100'}`}
              onClick={() => setAuthMode('login')}
            >
              Login
            </button>
            <button
              className={`flex-1 rounded-xl px-4 py-2 ${authMode === 'register' ? 'bg-brand-600 text-white' : 'bg-slate-100'}`}
              onClick={() => setAuthMode('register')}
            >
              Registrieren
            </button>
          </div>

          <div className="space-y-4">
            <input
              className="w-full border rounded-xl p-3"
              placeholder="E-Mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {authMode === 'register' && (
              <input
                className="w-full border rounded-xl p-3"
                placeholder="Benutzername"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            )}

            <input
              type="password"
              className="w-full border rounded-xl p-3"
              placeholder="Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error && <div className="text-red-500 text-sm">{error}</div>}

            <button onClick={handleAuth} className="w-full bg-brand-600 text-white rounded-xl p-3 font-semibold">
              {authMode === 'login' ? 'Einloggen' : 'Konto erstellen'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto grid md:grid-cols-[280px_1fr] gap-5">
        <aside className="bg-white rounded-2xl shadow-lg p-5 h-fit">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="font-bold text-xl">List</div>
              <div className="text-sm text-slate-500">Hallo, {user.username}</div>
            </div>
            <button onClick={logout} className="text-sm text-slate-500">
              Logout
            </button>
          </div>

          <div className="mb-4">
            <input
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              className="w-full border rounded-xl p-3 mb-2"
              placeholder="Neue Liste"
            />
            <button onClick={handleCreateList} className="w-full bg-brand-600 text-white rounded-xl p-3 font-medium">
              Liste erstellen
            </button>
          </div>

          <div className="space-y-2">
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={`w-full text-left p-3 rounded-xl ${selectedListId === list.id ? 'bg-brand-100 border border-brand-500' : 'bg-slate-50'}`}
              >
                <div className="font-medium">{list.title}</div>
                <div className="text-xs text-slate-500">{list.items.length} Einträge</div>
              </button>
            ))}
          </div>
        </aside>

        <main className="bg-white rounded-2xl shadow-lg p-5">
          {selectedList ? (
            <>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h1 className="text-2xl font-bold">{selectedList.title}</h1>
                  <p className="text-slate-500 text-sm">Erstellt von {selectedList.creator.username}</p>
                </div>
              </div>

              <div className="flex gap-2 mb-5">
                <input
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  className="flex-1 border rounded-xl p-3"
                  placeholder="Neues Produkt hinzufügen"
                />
                <button onClick={handleAddItem} className="bg-brand-600 text-white px-4 py-3 rounded-xl font-medium">
                  Hinzufügen
                </button>
              </div>

              <div className="space-y-3">
                {selectedList.items.length === 0 && <p className="text-slate-500">Noch keine Produkte in dieser Liste.</p>}

                {selectedList.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border rounded-xl p-3 bg-slate-50">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => toggleItem(item.id, item.completed)}
                      />
                      <div>
                        <div className={item.completed ? 'line-through text-slate-500' : 'font-medium'}>{item.title}</div>
                        <div className="text-xs text-slate-500">{item.quantity} {item.unit || 'Stk.'}</div>
                      </div>
                    </div>
                    <span className="text-xs bg-brand-100 text-brand-600 px-2 py-1 rounded-full">
                      {item.priority === 2 ? 'hoch' : item.priority === 1 ? 'mittel' : 'normal'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[300px] text-slate-500">
              Bitte wähle eine Liste aus.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
