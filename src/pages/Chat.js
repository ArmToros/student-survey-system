import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, MessageCircle, Search, Smile, CheckCircle, RotateCcw, Trash2, Bot } from 'lucide-react';
import './Chat.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';

// A small fixed palette: enough to be useful without pulling in an emoji library.
const EMOJIS = ['😀', '🙂', '👍', '🙏', '📚', '✅', '❓', '🎉', '😢', '❤️'];

/**
 * Help and support.
 *
 * The left column is the old messenger list, now holding two kinds of row: the
 * questions admins have written answers for, and the conversations you are part
 * of. Picking a question shows its answer and starts nothing. "Ask something
 * else" sends your question to an admin and opens a conversation.
 *
 * Closing, reopening and removing a conversation belong to the admin it was
 * assigned to. Everyone else can read and reply.
 */
const Chat = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [presets, setPresets] = useState([]);
  const [botName, setBotName] = useState('Bot AI');
  // The bot conversation is not stored: it is a transcript of what this visitor
  // has asked it during this visit, rebuilt from the preset list each time.
  const [botTranscript, setBotTranscript] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // What the right-hand panel shows: nothing, a preset answer, the ask form, or
  // a conversation.
  const [view, setView] = useState({ kind: 'none' });
  const [thread, setThread] = useState(null);

  const [draft, setDraft] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);

  const endOfMessagesRef = useRef(null);

  const loadPresets = useCallback(async () => {
    try {
      const response = await apiFetch('/api/support/questions');
      if (!response.ok) {
        throw new Error('PRESETS_FAILED');
      }
      setPresets(await response.json());
    } catch (loadError) {
      console.warn('Unable to load the preset questions', loadError);
      setError(t('chat.loadFailed'));
    }
  }, [t]);

  const loadBotName = useCallback(async () => {
    try {
      const response = await apiFetch('/api/support/bot');
      if (!response.ok) {
        throw new Error('BOT_FAILED');
      }
      const data = await response.json();
      if (data?.name) {
        setBotName(data.name);
      }
    } catch (loadError) {
      // The default name is good enough; this is not worth an error banner.
      console.warn('Unable to load the bot name', loadError);
    }
  }, []);

  const loadChats = useCallback(async () => {
    try {
      const response = await apiFetch('/api/support/chats');
      if (!response.ok) {
        throw new Error('CHATS_FAILED');
      }
      setChats(await response.json());
    } catch (loadError) {
      console.warn('Unable to load conversations', loadError);
      setError(t('chat.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    Promise.all([loadPresets(), loadChats(), loadBotName()]).finally(() => setLoading(false));
  }, [loadPresets, loadChats, loadBotName]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread, botTranscript]);

  const openThread = async (chatId) => {
    setView({ kind: 'chat', id: chatId });
    setThread(null);
    try {
      const response = await apiFetch(`/api/support/chats/${chatId}`);
      if (!response.ok) {
        throw new Error('THREAD_FAILED');
      }
      setThread(await response.json());
      setError(null);
    } catch (threadError) {
      console.error(threadError);
      setError(t('chat.loadFailed'));
    }
  };

  const sendReply = async () => {
    if (!draft.trim() || !thread) {
      return;
    }

    setBusy(true);
    try {
      const response = await apiFetch(`/api/support/chats/${thread.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: draft })
      });

      if (!response.ok) {
        throw new Error('SEND_FAILED');
      }

      setDraft('');
      await openThread(thread.id);
      await loadChats();
    } catch (sendError) {
      console.error(sendError);
      setError(t('chat.sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const askSomethingElse = async () => {
    if (!newQuestion.trim()) {
      return;
    }

    setBusy(true);
    try {
      const response = await apiFetch('/api/support/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newQuestion })
      });

      if (!response.ok) {
        throw new Error('ASK_FAILED');
      }

      const created = await response.json();
      setNewQuestion('');
      await loadChats();
      await openThread(created.id);
    } catch (askError) {
      console.error(askError);
      setError(t('chat.sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const setClosed = async (chatId, closed) => {
    setBusy(true);
    try {
      const response = await apiFetch(
        `/api/support/chats/${chatId}/${closed ? 'close' : 'reopen'}`,
        { method: 'POST' }
      );
      if (!response.ok) {
        throw new Error('CLOSE_FAILED');
      }
      await openThread(chatId);
      await loadChats();
    } catch (closeError) {
      console.error(closeError);
      setError(t('chat.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const removeConversation = async (chatId) => {
    if (!window.confirm(t('chat.removeConfirm'))) {
      return;
    }

    setBusy(true);
    try {
      const response = await apiFetch(`/api/support/chats/${chatId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('REMOVE_FAILED');
      }
      setView({ kind: 'none' });
      setThread(null);
      await loadChats();
    } catch (removeError) {
      console.error(removeError);
      setError(t('chat.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  // Picking a question writes both sides of the exchange into the transcript,
  // so the bot reads as a conversation rather than a list of links.
  const askBot = (preset) => {
    setBotTranscript(current => [
      ...current,
      { id: `q-${preset.id}-${current.length}`, own: true, text: preset.question, at: new Date() },
      { id: `a-${preset.id}-${current.length}`, own: false, text: preset.answer, at: new Date() }
    ]);
  };

  const formatTime = (value) => {
    if (!value) {
      return '';
    }
    return new Date(value).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const initials = (name) => (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('');

  const term = searchTerm.trim().toLowerCase();
  const matches = (text) => !term || (text || '').toLowerCase().includes(term);

  const visiblePresets = presets.filter(preset => matches(preset.question) || matches(preset.answer));
  const visibleChats = chats.filter(chat => matches(chat.title) || matches(chat.lastMessage));

  // Only the admin a conversation was assigned to may close or remove it.
  const canManageThread = thread && user?.role === 'admin' && !thread.mine;

  if (loading) {
    return (
      <div className="chat">
        <div className="chat-container">
          <div className="loading">
            <div className="spinner"></div>
            <p>{t('chat.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat">
      <div className="chat-container">
        <div className="chat-main-content">
          <div className="main-content-header">
            <h2>{t('chat.help')}</h2>
            <div className="header-actions">
              <button
                className="action-btn"
                onClick={() => {
                  setShowSearch(open => !open);
                  setSearchTerm('');
                }}
                title={t('chat.search')}
              >
                <Search size={20} />
              </button>
            </div>
          </div>

          {showSearch && (
            <div className="chat-search">
              <input
                type="text"
                className="chat-search-input"
                placeholder={t('chat.search')}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className="chat-list-column">
            <div
              className={`chat-item ${view.kind === 'bot' ? 'active' : ''}`}
              onClick={() => setView({ kind: 'bot' })}
            >
              <div className="chat-avatar">
                <div className="avatar-initials bot"><Bot size={20} /></div>
              </div>
              <div className="chat-info">
                <div className="chat-name">
                  <span className="chat-title-text">{botName}</span>
                </div>
                <div className="chat-preview">{t('chat.botPreview')}</div>
              </div>
            </div>

            <p className="chat-section-label">{t('chat.yourConversations')}</p>

            {visibleChats.length === 0 && (
              <div className="chat-empty-hint">{t('chat.noConversations')}</div>
            )}

            {visibleChats.map(chat => {
              const counterpart = chat.mine ? chat.adminName : chat.askedBy;
              return (
                <div
                  key={`chat-${chat.id}`}
                  className={`chat-item ${view.kind === 'chat' && view.id === chat.id ? 'active' : ''}`}
                  onClick={() => openThread(chat.id)}
                >
                  <div className="chat-avatar">
                    <div className="avatar-initials">{initials(counterpart)}</div>
                  </div>
                  <div className="chat-info">
                    <div className="chat-name">
                      <span className="chat-title-text">{chat.title}</span>
                      {chat.isClosed && <span className="chat-badge">{t('chat.closed')}</span>}
                    </div>
                    <div className="chat-preview">{chat.lastMessage}</div>
                  </div>
                  <div className="chat-meta">
                    <div className="chat-time">{formatTime(chat.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="chat-main desktop-only">
          {error && <p className="chat-error">{error}</p>}

          {view.kind === 'none' && (
            <div className="no-chat-selected">
              <MessageCircle size={64} />
              <h3>{t('chat.chatUnavailable')}</h3>
              <p>{t('chat.pickAQuestion')}</p>
            </div>
          )}

          {view.kind === 'bot' && (
            <>
              <div className="chat-header">
                <div className="chat-user">
                  <div className="chat-avatar">
                    <div className="avatar-initials bot"><Bot size={20} /></div>
                  </div>
                  <div className="user-info">
                    <h3>{botName}</h3>
                    <span className="user-status">{t('chat.botStatus')}</span>
                  </div>
                </div>
              </div>

              <div className="messages-container">
                <div className="messages">
                  <div className="message other">
                    <div className="message-content">
                      <div className="message-text">{t('chat.botGreeting')}</div>
                    </div>
                  </div>

                  {botTranscript.map(entry => (
                    <div key={entry.id} className={`message ${entry.own ? 'own' : 'other'}`}>
                      <div className="message-content">
                        <div className="message-text">{entry.text}</div>
                      </div>
                    </div>
                  ))}

                  <div ref={endOfMessagesRef} />
                </div>
              </div>

              <div className="bot-options">
                <p className="bot-options-label">{t('chat.botPick')}</p>

                {visiblePresets.length === 0 && (
                  <p className="chat-empty-hint">{t('chat.noQuestions')}</p>
                )}

                <div className="bot-option-list">
                  {visiblePresets.map(preset => (
                    <button
                      key={preset.id}
                      className="bot-option"
                      onClick={() => askBot(preset)}
                    >
                      {preset.question}
                      {!preset.isActive && (
                        <span className="chat-badge">{t('chat.retired')}</span>
                      )}
                    </button>
                  ))}

                  <button
                    className="bot-option other"
                    onClick={() => setView({ kind: 'ask' })}
                  >
                    {t('chat.other')}
                  </button>
                </div>
              </div>
            </>
          )}

          {view.kind === 'ask' && (
            <div className="ask-form">
              <h3>{t('chat.askTitle')}</h3>
              <p>{t('chat.askHint')}</p>
              <textarea
                rows="6"
                className="ask-input"
                placeholder={t('chat.askPlaceholder')}
                value={newQuestion}
                onChange={(event) => setNewQuestion(event.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={askSomethingElse}
                disabled={busy || !newQuestion.trim()}
              >
                <Send size={16} /> {t('chat.sendQuestion')}
              </button>
            </div>
          )}

          {view.kind === 'chat' && thread && (
            <>
              <div className="chat-header">
                <div className="chat-user">
                  <div className="chat-avatar">
                    <div className="avatar-initials">
                      {initials(thread.messages.find(message => !message.own)?.senderName)}
                    </div>
                  </div>
                  <div className="user-info">
                    <h3>{thread.title}</h3>
                    <span className="user-status">
                      {thread.isClosed ? t('chat.closed') : t('chat.open')}
                    </span>
                  </div>
                </div>

                {canManageThread && (
                  <div className="chat-actions">
                    <button
                      className="action-btn"
                      onClick={() => setClosed(thread.id, !thread.isClosed)}
                      disabled={busy}
                      title={thread.isClosed ? t('chat.reopen') : t('chat.close')}
                    >
                      {thread.isClosed ? <RotateCcw size={20} /> : <CheckCircle size={20} />}
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => removeConversation(thread.id)}
                      disabled={busy}
                      title={t('chat.remove')}
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                )}
              </div>

              <div className="messages-container">
                <div className="messages">
                  {thread.messages.map(message => (
                    <div key={message.id} className={`message ${message.own ? 'own' : 'other'}`}>
                      <div className="message-content">
                        {!message.own && (
                          <div className="message-sender">{message.senderName}</div>
                        )}
                        <div className="message-text">{message.text}</div>
                        <div className="message-time">{formatTime(message.sentAt)}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={endOfMessagesRef} />
                </div>
              </div>

              {thread.isClosed ? (
                <div className="chat-closed-note">{t('chat.closedNote')}</div>
              ) : (
                <div className="message-input">
                  <div className="emoji-wrapper">
                    <button
                      className="input-btn"
                      onClick={() => setShowEmoji(open => !open)}
                      title="Emoji"
                    >
                      <Smile size={20} />
                    </button>
                    {showEmoji && (
                      <div className="emoji-picker">
                        {EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            className="emoji-option"
                            onClick={() => {
                              setDraft(current => current + emoji);
                              setShowEmoji(false);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder={t('chat.typeMessage')}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendReply();
                      }
                    }}
                    className="message-field"
                    disabled={busy}
                  />
                  <button
                    onClick={sendReply}
                    className="send-btn"
                    disabled={busy || !draft.trim()}
                  >
                    <Send size={20} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
