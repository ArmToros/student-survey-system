import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, MessageCircle, HelpCircle, Plus, X, CheckCircle, Trash2, ArrowLeft } from 'lucide-react';
import './Chat.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';

/**
 * Support.
 *
 * The left column holds the questions admins have written answers for, plus the
 * conversations you are part of. Picking a question shows its answer straight
 * away and starts nothing. "Other" opens a box for anything not on the list:
 * that question is assigned to an admin and becomes a conversation.
 *
 * Either side can close a conversation, and either side can then remove it from
 * their own list. Removing is per-person - the other side keeps theirs.
 */
const Chat = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [presets, setPresets] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // What the right-hand panel is showing: nothing, a preset answer, the
  // "ask something else" form, or a conversation.
  const [view, setView] = useState({ kind: 'none' });
  const [thread, setThread] = useState(null);

  const [draft, setDraft] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [busy, setBusy] = useState(false);

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
    Promise.all([loadPresets(), loadChats()]).finally(() => setLoading(false));
  }, [loadPresets, loadChats]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

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

  const removeFromMyList = async (chatId) => {
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

  const activePreset = view.kind === 'preset'
    ? presets.find(item => item.id === view.id)
    : null;

  return (
    <div className="chat">
      <div className="chat-container">
        <div className="chat-main-content">
          <div className="main-content-header">
            <h2>{t('chat.help')}</h2>
          </div>

          <div className="chat-list-column">
            <p className="chat-section-label">{t('chat.commonQuestions')}</p>

            {presets.length === 0 && (
              <div className="chat-empty-hint">{t('chat.noQuestions')}</div>
            )}

            {presets.map(preset => (
              <button
                key={preset.id}
                className={`preset-item ${view.kind === 'preset' && view.id === preset.id ? 'active' : ''}`}
                onClick={() => setView({ kind: 'preset', id: preset.id })}
              >
                <HelpCircle size={16} />
                <span>{preset.question}</span>
                {!preset.isActive && <em className="preset-retired">{t('chat.retired')}</em>}
              </button>
            ))}

            <button
              className={`preset-item other ${view.kind === 'ask' ? 'active' : ''}`}
              onClick={() => setView({ kind: 'ask' })}
            >
              <Plus size={16} />
              <span>{t('chat.other')}</span>
            </button>

            <p className="chat-section-label">{t('chat.yourConversations')}</p>

            {chats.length === 0 && (
              <div className="chat-empty-hint">{t('chat.noConversations')}</div>
            )}

            {chats.map(chat => (
              <button
                key={chat.id}
                className={`chat-item ${view.kind === 'chat' && view.id === chat.id ? 'active' : ''}`}
                onClick={() => openThread(chat.id)}
              >
                <div className="chat-item-top">
                  <span className="chat-item-title">{chat.title}</span>
                  {chat.isClosed && <span className="chat-chip">{t('chat.closed')}</span>}
                </div>
                <span className="chat-item-sub">
                  {chat.mine ? chat.adminName : chat.askedBy} - {formatTime(chat.createdAt)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="chat-main">
          {error && <p className="chat-error">{error}</p>}

          {view.kind === 'none' && (
            <div className="no-chat-selected">
              <MessageCircle size={64} />
              <h3>{t('chat.chatUnavailable')}</h3>
              <p>{t('chat.pickAQuestion')}</p>
            </div>
          )}

          {activePreset && (
            <div className="preset-answer">
              <h3>{activePreset.question}</h3>
              <p>{activePreset.answer}</p>
              <div className="preset-answer-footer">
                <span>{t('chat.notWhatYouNeeded')}</span>
                <button className="btn btn-primary" onClick={() => setView({ kind: 'ask' })}>
                  {t('chat.other')}
                </button>
              </div>
            </div>
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
                <button className="back-btn" onClick={() => setView({ kind: 'none' })}>
                  <ArrowLeft size={20} />
                </button>
                <div className="user-info">
                  <h3>{thread.title}</h3>
                  <span className="user-status">
                    {thread.isClosed ? t('chat.closed') : t('chat.open')}
                  </span>
                </div>
                <div className="chat-actions">
                  <button
                    className="action-btn"
                    onClick={() => setClosed(thread.id, !thread.isClosed)}
                    disabled={busy}
                    title={thread.isClosed ? t('chat.reopen') : t('chat.close')}
                  >
                    {thread.isClosed ? <X size={18} /> : <CheckCircle size={18} />}
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => removeFromMyList(thread.id)}
                    disabled={busy}
                    title={t('chat.remove')}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
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

      {user?.role === 'admin' && (
        <p className="chat-admin-hint">{t('chat.adminHint')}</p>
      )}
    </div>
  );
};

export default Chat;
