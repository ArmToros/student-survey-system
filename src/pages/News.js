import React, { useState, useEffect } from 'react';
import { Calendar, User, Share2, BookOpen, X, Check } from 'lucide-react';
import './News.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';

const News = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState("news.filters.all");
  const [openArticle, setOpenArticle] = useState(null);
  const [sharedId, setSharedId] = useState(null);

  useEffect(() => {
    const loadNews = async () => {
      try {
        const response = await apiFetch(`/api/news?role=${encodeURIComponent(user?.role || '')}`);

        if (!response.ok) {
          throw new Error('NEWS_API_FAILED');
        }

        const images = [
          'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=200&fit=crop',
          'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=200&fit=crop',
          'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=200&fit=crop'
        ];
        const data = await response.json();
        setNews(data.map((article, index) => ({
          ...article,
          category: article.category || 'General',
          image: images[index % images.length]
        })));
      } catch (error) {
        console.warn('Unable to load news from API', error);
        setNews([]);
      } finally {
        setLoading(false);
      }
    };

    loadNews();
  }, [user?.role]);

  // The four categories the app offers, matching dbo.NewsType after
  // scripts/data-news-categories.sql. They are fixed rather than derived from
  // whatever happens to be loaded, so a category a role cannot see shows the
  // "no news" message instead of disappearing from the filter bar.
  const categoryFilters = [
    "news.filters.all",
    "Academic",
    "Events",
    "Announcements",
    "Sports"
  ];

  const categoryLabel = (category) => {
    if (category.startsWith('news.')) {
      return t(category);
    }
    const translated = t(`news.filters.${category.toLowerCase()}`);
    return translated.startsWith('news.') ? category : translated;
  };
  const filteredNews =
    selectedCategory === "news.filters.all"
      ? news
      : news.filter(article => article.category === selectedCategory);

  // Both lists come from the filtered set. Deriving the featured one from the
  // full list instead used to hide every featured article whenever a category
  // was selected, which made most categories look empty.
  const featuredNews = filteredNews.filter(n => n.featured);
  const regularNews = filteredNews.filter(n => !n.featured);

  // The API returns the whole body, so "Read More" opens it in place.
  const openReader = (article) => setOpenArticle(article);

  /**
   * Copies the link to the article.
   *
   * navigator.share and navigator.clipboard only exist in a secure context, so
   * over plain HTTP - which is how this is published - both are undefined and
   * the button did nothing at all. The hidden textarea with execCommand is the
   * old way, and it is the one that still works there. The modern APIs are
   * tried first for when this is served over HTTPS or opened on localhost.
   */
  const shareArticle = async (article) => {
    const link = `${window.location.origin}/news#article-${article.id}`;

    const flash = () => {
      setSharedId(article.id);
      setTimeout(() => setSharedId(current => (current === article.id ? null : current)), 2000);
    };

    try {
      if (navigator.share) {
        await navigator.share({ title: article.title, text: article.excerpt, url: link });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        flash();
        return;
      }
    } catch (error) {
      // A cancelled share sheet is not a failure worth reporting; fall through
      // to the copy below.
      console.warn('Share sheet unavailable, copying instead', error);
    }

    try {
      const field = document.createElement('textarea');
      field.value = link;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(field);

      if (copied) {
        flash();
        return;
      }

      window.prompt(t('news.copyLink'), link);
    } catch (error) {
      console.warn('Unable to copy the link', error);
      window.prompt(t('news.copyLink'), link);
    }
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

  if (loading) {
    return (
      <div className="news">
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading news...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="news">
      <div className="container">
        
        {/* HEADER */}
        <div className="page-header">
          <h1>{t('news.title')}</h1>
          <p>{t('news.subtitle')}</p>
        </div>

        {/* FILTERS */}
        <div className="news-filters">
          <div className="category-filters">
            {categoryFilters.map(category => (
              <button
                key={category}
                className={`filter-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {categoryLabel(category)}
              </button>
            ))}
          </div>
        </div>

        {/* FEATURED NEWS – visible only for ALL */}
        {featuredNews.length > 0 && (
          <div className="featured-section">
            <h2>{t('news.featuredNews')}</h2>

            <div className="featured-news">
              {featuredNews.map(article => (
                <div key={article.id} className="featured-article">
                  <div className="article-image">
                    <img src={article.image} alt={article.title} />
                    <div className="article-category">{article.category}</div>
                  </div>

                  <div className="article-content">
                    <h3>{article.title}</h3>
                    <p>{article.excerpt}</p>

                    <div className="article-meta">
                      <div className="meta-item"><User size={16}/> <span>{article.author}</span></div>
                      <div className="meta-item"><Calendar size={16}/> <span>{formatDate(article.date)}</span></div>
                    </div>

                    <div className="article-actions">
                      <button className="btn btn-primary" onClick={() => openReader(article)}>
                        {t('news.readMore')}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => shareArticle(article)}
                        title={t('news.share')}
                      >
                        {sharedId === article.id ? <Check size={16}/> : <Share2 size={16}/>}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REGULAR NEWS */}
        <div className="regular-news-section">
          <h2>
            {selectedCategory === "news.filters.all"
              ? t("news.latestNews")
              : categoryLabel(selectedCategory)
            }
          </h2>

          <div className="news-grid">
            {regularNews.map(article => (
              <div key={article.id} className="news-card">
                
                <div className="card-image">
                  <img src={article.image} alt={article.title} />
                  <div className="card-category">{article.category}</div>
                </div>

                <div className="card-content">
                  <h3>{article.title}</h3>
                  <p>{article.excerpt}</p>

                  <div className="card-meta">
                    <div className="meta-item"><User size={14}/><span>{article.author}</span></div>
                    <div className="meta-item"><Calendar size={14}/><span>{formatDate(article.date)}</span></div>
                  </div>

                  <div className="card-actions">
                    <button className="btn btn-outline" onClick={() => openReader(article)}>
                      {t('news.readMore')}
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => shareArticle(article)}
                      title={t('news.share')}
                    >
                      {sharedId === article.id ? <Check size={14}/> : <Share2 size={14}/>}
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>

          {filteredNews.length === 0 && (
            <div className="no-news">
              <BookOpen size={64} />
              <h3>{t('news.noNews')}</h3>
              <p>{t('news.noNewsDesc')}</p>
            </div>
          )}

        </div>
      </div>

      {openArticle && (
        <div className="article-reader" onClick={() => setOpenArticle(null)}>
          <div
            className="article-reader-panel"
            role="dialog"
            aria-modal="true"
            aria-label={openArticle.title}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="article-reader-close"
              onClick={() => setOpenArticle(null)}
              aria-label={t('news.close')}
            >
              <X size={20}/>
            </button>

            <div className="article-reader-category">{openArticle.category}</div>
            <h2>{openArticle.title}</h2>

            <div className="article-reader-meta">
              <span><User size={14}/> {openArticle.author}</span>
              <span><Calendar size={14}/> {formatDate(openArticle.date)}</span>
            </div>

            <div className="article-reader-body">
              {String(openArticle.content || openArticle.excerpt || '')
                .split(/\n+/)
                .filter(Boolean)
                .map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default News;
