import React, { useState, useEffect } from 'react';
import { Calendar, User, Eye, MessageCircle, Share2, BookOpen } from 'lucide-react';
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

  // Filtering logic
  const dynamicCategories = [
    "news.filters.all",
    ...Array.from(new Set(news.map(article => article.category).filter(Boolean)))
  ];
  const filteredNews =
    selectedCategory === "news.filters.all"
      ? news
      : news.filter(article => article.category === selectedCategory);

  const featuredNews = news.filter(n => n.featured);
  const regularNews = filteredNews.filter(n => !n.featured);

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
            {dynamicCategories.map(category => (
              <button
                key={category}
                className={`filter-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category.startsWith('news.') ? t(category) : category}
              </button>
            ))}
          </div>
        </div>

        {/* FEATURED NEWS – visible only for ALL */}
        {selectedCategory === "news.filters.all" && featuredNews.length > 0 && (
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
                      <div className="meta-item"><Eye size={16}/> <span>{article.views} {t('news.meta.views')}</span></div>
                      <div className="meta-item"><MessageCircle size={16}/> <span>{article.comments} {t('news.meta.comments')}</span></div>
                    </div>

                    <div className="article-actions">
                      <button className="btn btn-primary">{t('news.readMore')}</button>
                      <button className="btn btn-secondary"><Share2 size={16}/></button>
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
              : t(selectedCategory)
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

                  <div className="card-stats">
                    <div className="stat"><Eye size={14}/><span>{article.views}</span></div>
                    <div className="stat"><MessageCircle size={14}/><span>{article.comments}</span></div>
                  </div>

                  <div className="card-actions">
                    <button className="btn btn-outline">{t('news.readMore')}</button>
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
    </div>
  );
};

export default News;
