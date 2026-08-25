import { useState } from 'react';
import { DOC_ARTICLES } from '@docs/docsRegistry';
import { MarkdownDocViewer } from '../docs/MarkdownDocViewer';
import { Search } from 'lucide-react';

export function DocsBrowser() {
  const [selectedId, setSelectedId] = useState<string>(DOC_ARTICLES[0].id);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Hardware & Circuits', 'WDF DSP Physics', 'Audio & Tab Player', 'CAD Shortcuts'];

  const filteredArticles = DOC_ARTICLES.filter((art) => {
    const matchesCat = selectedCategory === 'All' || art.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      art.title.toLowerCase().includes(query) ||
      art.summary.toLowerCase().includes(query) ||
      art.tags.some((t) => t.toLowerCase().includes(query));
    return matchesCat && matchesQuery;
  });

  const activeArticle = DOC_ARTICLES.find((a) => a.id === selectedId) || filteredArticles[0] || DOC_ARTICLES[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header & Search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#f4f4f5' }}>
            Documentation Hub
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#a1a1aa' }}>
            Reference manuals for guitar electronics, Wave Digital Filter physics, and synthesizer mechanics.
          </p>
        </div>

        {/* Search input with icon */}
        <div style={{ position: 'relative', minWidth: '280px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#71717a',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search articles, tags, formulas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 12px 7px 32px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: '#f4f4f5',
              fontSize: '12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              background: selectedCategory === cat ? '#0284c7' : 'rgba(255, 255, 255, 0.04)',
              color: selectedCategory === cat ? '#ffffff' : '#a1a1aa',
              border: selectedCategory === cat ? '1px solid #0284c7' : '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '5px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Two-Column Docs Layout: Sidebar List + Rendered Article Body */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '290px 1fr',
          gap: '1px',
          borderRadius: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          minHeight: '520px',
        }}
      >
        {/* Left List */}
        <div
          style={{
            backgroundColor: '#18181b',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            overflowY: 'auto',
            maxHeight: '650px',
          }}
        >
          {filteredArticles.length === 0 ? (
            <div style={{ padding: '16px', fontSize: '12px', color: '#71717a', textAlign: 'center' }}>
              No articles match your search.
            </div>
          ) : (
            filteredArticles.map((art) => {
              const isSelected = art.id === activeArticle.id;
              return (
                <div
                  key={art.id}
                  onClick={() => setSelectedId(art.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? '#27272a' : 'transparent',
                    border: isSelected ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#38bdf8', marginBottom: '2px' }}>
                    {art.category}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#ffffff' : '#d4d4d8', marginBottom: '4px' }}>
                    {art.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#71717a', lineHeight: 1.4 }}>
                    {art.summary}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Rendered Markdown Article Content */}
        <div
          style={{
            backgroundColor: '#141417',
            padding: '28px 36px',
            overflowY: 'auto',
            maxHeight: '650px',
          }}
        >
          {activeArticle && (
            <div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '14px' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.12)',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                  }}
                >
                  {activeArticle.category}
                </span>
                {activeArticle.tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: '10px',
                      color: '#71717a',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      padding: '2px 5px',
                      borderRadius: '3px',
                    }}
                  >
                    #{t}
                  </span>
                ))}
              </div>

              {/* Rich Markdown Formatted Renderer */}
              <MarkdownDocViewer content={activeArticle.contentMarkdown} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
