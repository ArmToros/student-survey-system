import React, { useState, useEffect, useRef } from 'react';
import { Send, Phone, Video, MoreVertical, Search, Users, MessageCircle, Smile, ArrowLeft, X } from 'lucide-react';
import './Chat.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';

// A small fixed palette: enough to be useful without pulling in an emoji library.
const EMOJIS = ['😀', '🙂', '👍', '🙏', '📚', '✅', '❓', '🎉', '😢', '❤️'];

const Chat = () => {
  const {t} = useLanguage();
  const { user } = useAuth();
  // Nothing is selected on arrival, so the panel shows "Select a conversation"
  // instead of dropping straight into the AI assistant.
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [message, setMessage] = useState('');
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [aiMessages, setAiMessages] = useState([
    {
      id: 1,
      sender: 'AI Assistant',
      message: 'Hi. Ask me anything about surveys, courses, news, student services, or how to use this university system.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: false
    }
  ]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [showChatModal, setShowChatModal] = useState(() => window.innerWidth <= 1024);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const mockChats = [
      {
        id: 1,
        name: 'AI Assistant',
        lastMessage: 'Ask university questions',
        time: "Online",
        unread: 0,
        online: true,
        avatar: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=50&h=50&fit=crop&crop=face",
        type: "bot"
      },
      {
        id: 2,
        name: t('chat.universityAdmin'),
        lastMessage: t('chat.last_message2'),
        time: "5 min ago",
        unread: 1,
        online: true,
        avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=50&h=50&fit=crop&crop=face",
        type: "university"
      },
      {
        id: 3,
        name: t('chat.librarySupport'),
        lastMessage:  t('chat.last_message3'),
        time: "3 hours ago",
        unread: 1,
        online: true,
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face",
        type: "support"
      }
    ];

    setChats(mockChats);
  }, [t]);

  useEffect(() => {
    const mockMessages = {
      1: [
        { id: 1, sender: t('chat.botName'), message: t('chat.bot_msg1'), time: "10:30 AM", isOwn: false },
        { id: 2, sender: "You", message: t('chat.bot_msg2'), time: "10:32 AM", isOwn: true },
        { id: 3, sender: t('chat.botName'), message: t('chat.bot_msg3'), time: "10:33 AM", isOwn: false },
        { id: 4, sender: "You", message: t('chat.bot_msg4'), time: "10:35 AM", isOwn: true },
        { id: 5, sender: t('chat.botName'), message: t('chat.bot_msg5'), time: "10:36 AM", isOwn: false }
      ],
      2: [
        { id: 1, sender: t('chat.universityAdmin'), message: t('chat.uni_msg1'), time: "9:15 AM", isOwn: false },
        { id: 2, sender: "You", message:  t('chat.uni_msg2'), time: "9:20 AM", isOwn: true },
        { id: 3, sender: t('chat.universityAdmin'), message: t('chat.uni_msg3'), time: "9:22 AM", isOwn: false },
        { id: 4, sender: "You", message: t('chat.uni_msg4'), time: "9:25 AM", isOwn: true },
        { id: 5, sender: t('chat.universityAdmin'), message: t('chat.uni_msg5'), time: "9:27 AM", isOwn: false }
      ],
      3: [
        { id: 1, sender: t('chat.librarySupport'), message: t('chat.lib_msg1'), time: "8:30 AM", isOwn: false },
        { id: 2, sender: "You", message: t('chat.lib_msg2'), time: "8:35 AM", isOwn: true },
        { id: 3, sender:t('chat.librarySupport'), message: t('chat.lib_msg3'), time: "8:37 AM", isOwn: false },
        { id: 4, sender: "You", message: t('chat.lib_msg4'), time: "8:40 AM", isOwn: true },
        { id: 5, sender:t('chat.librarySupport'), message:t('chat.lib_msg5'), time: "8:42 AM", isOwn: false }
      ]
    };

    if (selectedChat === 1) {
      setMessages(aiMessages);
    } else if (selectedChat) {
      setMessages(mockMessages[selectedChat] || []);
    } else {
      setMessages([]);
    }
  }, [selectedChat, t, aiMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    const newMessage = {
      id: Date.now(),
      sender: "You",
      message: trimmedMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: true
    };

    setMessage('');

    if (selectedChat !== 1) {
      setMessages(prev => [...prev, newMessage]);
      return;
    }

    const nextAiMessages = [...aiMessages, newMessage];
    setAiMessages(nextAiMessages);
    setIsAiTyping(true);

    try {
      const response = await apiFetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.dbId,
          message: trimmedMessage,
          history: aiMessages
            .slice(-8)
            .map(item => ({
              role: item.isOwn ? 'user' : 'assistant',
              content: item.message
            }))
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const detail = errorBody?.detail ? ` ${errorBody.detail}` : '';
        throw new Error(`${errorBody?.message || 'AI assistant is unavailable.'}${detail}`);
      }

      const data = await response.json();
      setAiMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'AI Assistant',
          message: data.answer,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOwn: false
        }
      ]);
    } catch (error) {
      setAiMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'AI Assistant',
          message: error.message || 'AI assistant is unavailable. Please try again later.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOwn: false,
          isError: true
        }
      ]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleChatSelect = (chatId) => {
    setSelectedChat(chatId);
    // Show modal on mobile/tablet
    if (window.innerWidth <= 1024) {
      setShowChatModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowChatModal(false);
  };

  const visibleChats = searchTerm.trim()
    ? chats.filter(chat =>
        (chat.name || '').toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
        (chat.lastMessage || '').toLowerCase().includes(searchTerm.trim().toLowerCase()))
    : chats;

  const selectedChatData = chats.find(chat => chat.id === selectedChat);

  return (
    <div className="chat">
      <div className="chat-container">
        {/* Main Content with Chat Items */}
        <div className="chat-main-content">
          <div className="main-content-header">
            <h2>{t('chat.messages')}</h2>
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
            {visibleChats.length === 0 && (
              <div className="chat-empty-hint">{t('chat.empty')}</div>
            )}
            {visibleChats.map(chat => (
              <div
                key={chat.id}
                className={`chat-item ${selectedChat === chat.id ? 'active' : ''}`}
                onClick={() => handleChatSelect(chat.id)}
              >
                <div className="chat-avatar">
                  <img src={chat.avatar} alt={chat.name} />
                  {chat.online && <div className="online-indicator"></div>}
                </div>
                <div className="chat-info">
                  <div className="chat-name">
                    {chat.name}
                    {chat.type === 'bot' && <span className="chat-badge bot">🤖</span>}
                    {chat.type === 'university' && <span className="chat-badge university">🏛️</span>}
                    {chat.type === 'support' && <span className="chat-badge support">📚</span>}
                  </div>
                  <div className="chat-preview">{chat.lastMessage}</div>
                </div>
                <div className="chat-meta">
                  <div className="chat-time">{chat.time}</div>
                  {chat.unread > 0 && (
                    <div className="unread-badge">{chat.unread}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Chat Main - Always visible on desktop */}
        <div className="chat-main desktop-only">
          {selectedChatData ? (
            <>
              <div className="chat-header">
                <div className="chat-user">
                  <div className="chat-avatar">
                    <img src={selectedChatData.avatar} alt={selectedChatData.name} />
                    {selectedChatData.online && <div className="online-indicator"></div>}
                  </div>
                  <div className="user-info">
                    <h3>{selectedChatData.name}</h3>
                    <span className="user-status">
                      {selectedChatData.online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="messages-container">
                <div className="messages">
                  {messages.map(msg => (
                    <div key={msg.id} className={`message ${msg.isOwn ? 'own' : 'other'} ${msg.isError ? 'error' : ''}`}>
                      <div className="message-content">
                        <div className="message-text">{msg.message}</div>
                        <div className="message-time">{msg.time}</div>
                      </div>
                    </div>
                  ))}
                  {isAiTyping && selectedChat === 1 && (
                    <div className="message other">
                      <div className="message-content">
                        <div className="message-text">AI Assistant is thinking...</div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

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
                            setMessage(current => current + emoji);
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
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={isAiTyping && selectedChat === 1}
                  className="message-field"
                />
                <button 
                  onClick={handleSendMessage}
                  className="send-btn"
                  disabled={!message.trim() || (isAiTyping && selectedChat === 1)}
                >
                  <Send size={20} />
                </button>
              </div>
            </>
          ) : (
            <div className="no-chat-selected">
              <MessageCircle size={64} />
              <h3>{t('chat.chatUnavailable')}</h3>
              <p>{t('chat.chatUnavailableDesc')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile/Tablet Chat Modal */}
      {showChatModal && selectedChatData && (
        <div className="chat-modal-overlay" onClick={handleCloseModal}>
          <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chat-header">
              <button className="back-btn" onClick={handleCloseModal}>
                <ArrowLeft size={20} />
              </button>
              <div className="chat-user">
                <div className="chat-avatar">
                  <img src={selectedChatData.avatar} alt={selectedChatData.name} />
                  {selectedChatData.online && <div className="online-indicator"></div>}
                </div>
                <div className="user-info">
                  <h3>{selectedChatData.name}</h3>
                  <span className="user-status">
                    {selectedChatData.online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            <div className="messages-container">
              <div className="messages">
                {messages.map(msg => (
                  <div key={msg.id} className={`message ${msg.isOwn ? 'own' : 'other'} ${msg.isError ? 'error' : ''}`}>
                    <div className="message-content">
                      <div className="message-text">{msg.message}</div>
                      <div className="message-time">{msg.time}</div>
                    </div>
                  </div>
                ))}
                {isAiTyping && selectedChat === 1 && (
                  <div className="message other">
                    <div className="message-content">
                      <div className="message-text">AI Assistant is thinking...</div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="message-input">
              <button className="input-btn">
                <Smile size={20} />
              </button>
              <input
                type="text"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isAiTyping && selectedChat === 1}
                className="message-field"
              />
              <button 
                onClick={handleSendMessage}
                className="send-btn"
                disabled={!message.trim() || (isAiTyping && selectedChat === 1)}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
