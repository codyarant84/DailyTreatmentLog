import { useParams, Link, Navigate } from 'react-router-dom';
import MarketingNav from '../../components/marketing/MarketingNav.jsx';
import MarketingFooter from '../../components/marketing/MarketingFooter.jsx';
import SeoHead from '../../components/marketing/SeoHead.jsx';
import { getPostBySlug } from '../../data/blogPosts.js';
import '../MarketingPage.css';
import './Blog.css';

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function ContentBlock({ block, index }) {
  if (block.type === 'h2') return <h2 className="blog-post-h2" key={index}>{block.text}</h2>;
  if (block.type === 'h3') return <h3 className="blog-post-h3" key={index}>{block.text}</h3>;
  if (block.type === 'ul') {
    return (
      <ul className="blog-post-list" key={index}>
        {block.items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    );
  }
  return <p className="blog-post-p" key={index}>{block.text}</p>;
}

export default function BlogPost() {
  const { slug } = useParams();
  const post = getPostBySlug(slug);

  if (!post) return <Navigate to="/blog" replace />;

  return (
    <div className="mp-page">
      <SeoHead
        title={post.title}
        description={post.excerpt}
        path={`/blog/${post.slug}`}
      />
      <MarketingNav />

      <article className="blog-post">
        <div className="mp-section-inner blog-post-inner">
          <Link to="/blog" className="blog-post-back">&larr; All Articles</Link>
          <p className="blog-card-date">{formatDate(post.date)}</p>
          <h1 className="blog-post-title">{post.title}</h1>
          <div className="blog-post-body">
            {post.content.map((block, i) => <ContentBlock block={block} index={i} key={i} />)}
          </div>
        </div>
      </article>

      <MarketingFooter />
    </div>
  );
}
