import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

type User = {
  id: string;
  email: string;
  username: string;
};

type Category = {
  id: string;
  name: string;
  color: string;
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
  categoryId?: string | null;
  category?: Category | null;
};

type ShoppingList = {
  id: string;
  title: string;
  color: string;
  icon: string;
  creator: { id: string; username: string };
  categories: Category[];
  items: ListItem[];
  accesses?: Array<{
    id: string;
    role: string;
    user?: { id: string; username: string; email: string };
  }>;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const priorityLabels: Record<number, string> = {
  0: 'Normal',
  1: 'Wichtig',
  2: 'Sehr wichtig',
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [newListTitle, setNewListTitle] = useState('');
  const [newItem, setNewItem] = useState({
    title: '',
    quantity: 1,
    unit: 'Stk.',
    notes: '',
    priority: 1,
    categoryId: '',
  });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'done'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    title: '',
    quantity: 1,
    unit: 'Stk.',
    notes: '',
    priority: 1,
    categoryId: '',
  });
  const [error, setError] = useState('');

  const fetchLists = async () => {
    try {
      const res = await api.get('/lists', { headers: getAuthHeader() });
      setLists(res.data);
      if (!selectedListId && res.data.length > 0) {
        setSelectedListId(res.data[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Listen konnten nicht geladen werden.');
    }
  };

  const fetchListDetails = async (id: string) => {
    try {
      const res = await api.get(`/lists/${id}`, { headers: getAuthHeader() });
      setSelectedList(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Liste konnte nicht geladen werden.');
    }
  };

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
    fetchLists();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedListId) return;
    fetchListDetails(selectedListId);
  }, [selectedListId, user]);

  useEffect(() => {
    if (!selectedList) return;
    setSelectedCategoryId('all');
    setActiveTab('all');
  }, [selectedListId]);

  const filteredLists = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return lists;
    return lists.filter((list) => list.title.toLowerCase().includes(value));
  }, [lists, search]);

  const filteredItems = useMemo(() => {
    if (!selectedList) return [];

    return selectedList.items.filter((item) => {
      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'open' && !item.completed) ||
        (activeTab === 'done' && item.completed);

      const matchesCategory =
        selectedCategoryId === 'all' || String(item.categoryId || '') === selectedCategoryId;

      return matchesTab && matchesCategory;
    });
  }, [selectedList, activeTab, selectedCategoryId]);

  const totalItems = selectedList?.items.length ?? 0;
  const doneItems = selectedList?.items.filter((item) => item.completed).length ?? 0;

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

  const handleCreateCategory = async () => {
    if (!selectedListId || !newCategoryName.trim()) return;

    try {
      const res = await api.post(
        '/categories',
        {
          listId: selectedListId,
          name: newCategoryName.trim(),
          color: '#5b7cff',
        },
        { headers: getAuthHeader() }
      );

      setSelectedList((current) => {
        if (!current) return current;
        return {
          ...current,
          categories: [...current.categories, res.data],
        };
      });

      setNewCategoryName('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Kategorie konnte nicht erstellt werden');
    }
  };

  const handleAddItem = async () => {
    if (!selectedListId || !newItem.title.trim()) return;

    try {
      const res = await api.post(
        '/items',
        {
          listId: selectedListId,
          title: newItem.title,
          quantity: newItem.quantity,
          unit: newItem.unit,
          notes: newItem.notes,
          priority: newItem.priority,
          categoryId: newItem.categoryId || undefined,
        },
        { headers: getAuthHeader() }
      );

      setSelectedList((current) => {
        if (!current) return current;
        return {
          ...current,
          items: [...current.items, res.data],
        };
      });

      setLists((current) =>
        current.map((list) =>
          list.id === selectedListId
            ? { ...list, items: [...list.items, res.data] }
            : list
        )
      );

      setNewItem({ title: '', quantity: 1, unit: 'Stk.', notes: '', priority: 1, categoryId: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Eintrag konnte nicht hinzugefügt werden');
    }
  };

  const startEdit = (item: ListItem) => {
    setEditingItemId(item.id);
    setEditDraft({
      title: item.title,
      quantity: item.quantity,
      unit: item.unit || 'Stk.',
      notes: item.notes || '',
      priority: item.priority ?? 1,
      categoryId: item.categoryId || '',
    });
  };

  const saveEdit = async () => {
    if (!editingItemId) return;

    try {
      const res = await api.put(
        `/items/${editingItemId}`,
        {
          title: editDraft.title,
          quantity: editDraft.quantity,
          unit: editDraft.unit,
          notes: editDraft.notes,
          priority: editDraft.priority,
          categoryId: editDraft.categoryId || null,
        },
        { headers: getAuthHeader() }
      );

      setSelectedList((current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((item) => (item.id === editingItemId ? res.data : item)),
        };
      });

      setEditingItemId(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Eintrag konnte nicht gespeichert werden');
    }
  };

  const deleteItem = async (itemId: string) => {
    try {
      await api.delete(`/items/${itemId}`, { headers: getAuthHeader() });

      setSelectedList((current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.filter((item) => item.id !== itemId),
        };
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Eintrag konnte nicht gelöscht werden');
    }
  };

  const toggleItem = async (itemId: string, completed: boolean) => {
    try {
      const updated = await api.put(
        `/items/${itemId}`,
        { completed: !completed },
        { headers: getAuthHeader() }
      );

      setSelectedList((current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((item) => (item.id === itemId ? updated.data : item)),
        };
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Eintrag konnte nicht aktualisiert werden');
    }
  };

  const handleShareList = async () => {
    if (!selectedListId || !shareEmail.trim()) return;

    try {
      await api.post(
        `/lists/${selectedListId}/share`,
        { email: shareEmail, role: 'viewer' },
        { headers: getAuthHeader() }
      );
      setShareEmail('');
      fetchListDetails(selectedListId);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Liste konnte nicht geteilt werden');
    }
  };

  const handleDeleteList = async () => {
    if (!selectedListId) return;

    try {
      await api.delete(`/lists/${selectedListId}`, { headers: getAuthHeader() });
      const nextLists = lists.filter((list) => list.id !== selectedListId);
      setLists(nextLists);
      setSelectedList(null);
      setSelectedListId(nextLists[0]?.id ?? null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Liste konnte nicht gelöscht werden');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setLists([]);
    setSelectedList(null);
    setSelectedListId(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-10">
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] lg:grid-cols-2">
          <div className="flex flex-col justify-between bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-8 text-white">
            <div>
              <div className="mb-6 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em]">
                List
              </div>
              <h1 className="text-4xl font-black leading-tight">Mehrere Nutzer. Eine Einkaufsliste.</h1>
              <p className="mt-4 max-w-md text-sm text-indigo-50/90">
                Moderne Einkaufslisten mit Freigabe, Kategorie-Management, Datenschutz und klarer Übersicht für den Alltag.
              </p>
            </div>

            <div className="mt-10 space-y-3 text-sm text-indigo-50/90">
              <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />Echtzeit-Updates</div>
              <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />Responsive Design</div>
              <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />SQLite + Prisma</div>
            </div>
          </div>

          <div className="p-8 md:p-10">
            <div className="mb-8 flex gap-2 rounded-2xl bg-slate-100 p-1.5">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  authMode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Registrieren
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">E-Mail</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-400 focus:bg-white"
                  placeholder="dein@email.de"
                />
              </div>

              {authMode === 'register' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Benutzername</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-400 focus:bg-white"
                    placeholder="max.mustermann"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Passwort</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-400 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>

              {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

              <button
                type="button"
                onClick={handleAuth}
                className="mt-2 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-300 transition hover:opacity-95"
              >
                {authMode === 'login' ? 'Einloggen' : 'Konto erstellen'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-3 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 rounded-[28px] bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] md:flex-row md:items-center md:justify-between md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 text-lg font-black text-white">L</div>
            <div>
              <div className="text-xl font-black text-slate-900">List</div>
              <div className="text-xs text-slate-500">Einkaufslisten für Teams</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700">{lists.length} Listen</div>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Abmelden
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="rounded-[28px] bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] md:p-5">
            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Suche</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white"
                placeholder="Liste suchen"
              />
            </div>

            <div className="mb-4 rounded-2xl bg-slate-50 p-3">
              <input
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400"
                placeholder="Neue Liste erstellen"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateList();
                }}
              />
              <button
                type="button"
                onClick={handleCreateList}
                className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Liste hinzufügen
              </button>
            </div>

            <div className="space-y-3">
              {filteredLists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setSelectedListId(list.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    selectedListId === list.id ? 'border-indigo-200 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: `${list.color}22`, color: list.color }}>
                        {list.icon || '✓'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{list.title}</div>
                        <div className="text-xs text-slate-500">{list.creator.username}</div>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{list.items?.length ?? 0}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main className="rounded-[28px] bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] md:p-6">
            {selectedList ? (
              <>
                <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl font-bold" style={{ backgroundColor: `${selectedList.color}22`, color: selectedList.color }}>
                        {selectedList.icon || '✓'}
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-slate-900">{selectedList.title}</h2>
                        <div className="text-xs text-slate-500">Erstellt von {selectedList.creator.username}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">{doneItems}/{totalItems} erledigt</span>
                      <span className="rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-700">{selectedList.accesses?.length ?? 0} geteilt</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteList}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
                    >
                      Löschen
                    </button>
                  </div>
                </div>

                <div className="mb-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${activeTab === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    Alle
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('open')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${activeTab === 'open' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    Offen
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('done')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${activeTab === 'done' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    Erledigt
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId('all')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selectedCategoryId === 'all' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'}`}
                  >
                    Alle Kategorien
                  </button>
                  {selectedList.categories?.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(category.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selectedCategoryId === category.id ? 'text-white' : 'text-slate-700'} `}
                      style={{ backgroundColor: selectedCategoryId === category.id ? category.color : `${category.color}18` }}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                <div className="mb-6 rounded-[26px] bg-slate-50 p-3 md:p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_100px_100px_140px]">
                    <input
                      value={newItem.title}
                      onChange={(e) => setNewItem((current) => ({ ...current, title: e.target.value }))}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-indigo-400"
                      placeholder="Produkt eingeben"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddItem();
                      }}
                    />
                    <input
                      type="number"
                      min={1}
                      value={newItem.quantity}
                      onChange={(e) => setNewItem((current) => ({ ...current, quantity: Number(e.target.value) || 1 }))}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-indigo-400"
                    />
                    <input
                      value={newItem.unit}
                      onChange={(e) => setNewItem((current) => ({ ...current, unit: e.target.value }))}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-indigo-400"
                      placeholder="Stk."
                    />
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:opacity-95"
                    >
                      Hinzufügen
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
                    <input
                      value={newItem.notes}
                      onChange={(e) => setNewItem((current) => ({ ...current, notes: e.target.value }))}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-indigo-400"
                      placeholder="Notiz / Zusatzinfo"
                    />
                    <select
                      value={newItem.priority}
                      onChange={(e) => setNewItem((current) => ({ ...current, priority: Number(e.target.value) }))}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-indigo-400"
                    >
                      <option value={0}>Normal</option>
                      <option value={1}>Wichtig</option>
                      <option value={2}>Sehr wichtig</option>
                    </select>
                    <select
                      value={newItem.categoryId}
                      onChange={(e) => setNewItem((current) => ({ ...current, categoryId: e.target.value }))}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-indigo-400"
                    >
                      <option value="">Ohne Kategorie</option>
                      {selectedList.categories?.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-indigo-400"
                      placeholder="Neue Kategorie"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Kategorie anlegen
                    </button>
                  </div>
                </div>

                <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700">Liste teilen</div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                      placeholder="E-Mail des Nutzers"
                    />
                    <button
                      type="button"
                      onClick={handleShareList}
                      className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Teilen
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredItems.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                      Noch keine Produkte in dieser Ansicht.
                    </div>
                  )}

                  {filteredItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 md:p-4">
                      {editingItemId === item.id ? (
                        <div className="space-y-3">
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_90px_90px]">
                            <input
                              value={editDraft.title}
                              onChange={(e) => setEditDraft((current) => ({ ...current, title: e.target.value }))}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                            />
                            <input
                              type="number"
                              min={1}
                              value={editDraft.quantity}
                              onChange={(e) => setEditDraft((current) => ({ ...current, quantity: Number(e.target.value) || 1 }))}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                            />
                            <input
                              value={editDraft.unit}
                              onChange={(e) => setEditDraft((current) => ({ ...current, unit: e.target.value }))}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                            />
                          </div>

                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_150px]">
                            <input
                              value={editDraft.notes}
                              onChange={(e) => setEditDraft((current) => ({ ...current, notes: e.target.value }))}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                            />
                            <select
                              value={editDraft.priority}
                              onChange={(e) => setEditDraft((current) => ({ ...current, priority: Number(e.target.value) }))}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                            >
                              <option value={0}>Normal</option>
                              <option value={1}>Wichtig</option>
                              <option value={2}>Sehr wichtig</option>
                            </select>
                            <select
                              value={editDraft.categoryId}
                              onChange={(e) => setEditDraft((current) => ({ ...current, categoryId: e.target.value }))}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                            >
                              <option value="">Ohne Kategorie</option>
                              {selectedList.categories?.map((category) => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingItemId(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                              Abbrechen
                            </button>
                            <button type="button" onClick={saveEdit} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">
                              Speichern
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() => toggleItem(item.id, item.completed)}
                              className="mt-1 h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <div className={`text-base font-semibold ${item.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                {item.title}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {item.quantity} {item.unit || 'Stk.'}
                                {item.notes ? ` · ${item.notes}` : ''}
                              </div>
                              {item.category && (
                                <span className="mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold text-slate-700" style={{ backgroundColor: `${item.category.color}22` }}>
                                  {item.category.name}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                              item.priority === 2 ? 'bg-red-50 text-red-700' : item.priority === 1 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {priorityLabels[item.priority] || 'Normal'}
                            </span>
                            <button type="button" onClick={() => startEdit(item)} className="rounded-lg bg-white px-2.5 py-2 text-xs font-medium text-slate-700 border border-slate-200">
                              Bearbeiten
                            </button>
                            <button type="button" onClick={() => deleteItem(item.id)} className="rounded-lg bg-red-50 px-2.5 py-2 text-xs font-medium text-red-600 border border-red-200">
                              Löschen
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Bitte wähle eine Liste aus.
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

