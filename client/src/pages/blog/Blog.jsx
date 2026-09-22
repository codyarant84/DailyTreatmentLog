import { Link } from 'react-router-dom';
import MarketingNav from '../../components/marketing/MarketingNav.jsx';
import MarketingFooter from '../../components/marketing/MarketingFooter.jsx';
import SeoHead from '../../components/marketing/SeoHead.jsx';
import { blogPosts } from '../../data/blogPosts.js';
import '../MarketingPage.css';
import './Blog.css';

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function Blog() {
  const sorted = [...blogPosts].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mp-page">
      <SeoHead
        title="Blog"
        description="Practical guidance for athletic trainers on EMR selection, HIPAA compliance, GPS load monitoring, and injury documentation — from the team building Fieldside."
        path="/blog"
      />
      <MarketingNav />

      <section className="blog-hero">
        <div className="mp-section-inner">
          <p className="mp-eyebrow">Fieldside Blog</p>
          <h1 className="mp-section-title">Resources for athletic trainers.</h1>
          <p className="mp-section-sub">
            Practical guidance on documentation, compliance, and injury prevention — written for the
            people doing the job.
          </p>
        </div>
      </section>

      <section className="blog-list">
        <div className="mp-section-inner">
          <div className="blog-card-grid">
            {sorted.map((post) => (
              <Link key={post.slug} to={`/blog/${post.slug}`} className="blog-card">
                <span className="blog-card-date">{formatDate(post.date)}</span>
                <h2 className="blog-card-title">{post.title}</h2>
                <p className="blog-card-excerpt">{post.excerpt}</p>
                <span className="blog-card-link">Read more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
