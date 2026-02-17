import { Suspense } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiArrowLeft, HiClock, HiCalendar, HiUser, HiChevronRight } from 'react-icons/hi';
import Navbar from '../../components/landing/Navbar';
import Footer from '../../components/landing/Footer';
import ScrollToTop from '../../components/landing/ScrollToTop';
import useSEO from '../../hooks/useSEO';
import blogArticles from './blogData';

export default function BlogPost() {
  const { slug } = useParams();
  const article = blogArticles.find((a) => a.slug === slug);

  if (!article) {
    return <Navigate to="/blog" replace />;
  }

  const { Component } = article;

  const formattedDate = new Date(article.date + 'T00:00:00').toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  useSEO({
    title: article.title,
    description: article.excerpt,
    path: `/blog/${article.slug}`,
    image: article.image,
    type: 'article',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.excerpt,
      image: article.image,
      datePublished: article.date,
      dateModified: article.date,
      author: {
        '@type': 'Organization',
        name: article.author,
        url: 'https://trainingtrack.es',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Training Track',
        url: 'https://trainingtrack.es',
        logo: {
          '@type': 'ImageObject',
          url: 'https://trainingtrack.es/img/logo.png',
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `https://trainingtrack.es/blog/${article.slug}`,
      },
    },
  });

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-[50vh] flex items-end overflow-hidden pt-20">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{ backgroundImage: `url('${article.image}')` }}
        />
        <div className="absolute inset-0 backdrop-blur-sm bg-gradient-to-t from-black/80 via-black/50 to-black/30" />

        {/* Content */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-1.5 text-sm text-gray-300">
              <li><Link to="/" className="hover:text-white transition-colors">Inicio</Link></li>
              <li><HiChevronRight className="w-3.5 h-3.5" /></li>
              <li><Link to="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              <li><HiChevronRight className="w-3.5 h-3.5" /></li>
              <li className="text-white font-medium truncate max-w-[200px] sm:max-w-none">{article.title}</li>
            </ol>
          </nav>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Category */}
            <span className="inline-block px-3 py-1 bg-sky-600 text-white text-xs font-semibold rounded-full mb-4">
              {article.category}
            </span>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              {article.title}
            </h1>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
              <span className="flex items-center gap-1.5">
                <HiUser className="w-4 h-4" />
                {article.author}
              </span>
              <span className="flex items-center gap-1.5">
                <HiCalendar className="w-4 h-4" />
                {formattedDate}
              </span>
              <span className="flex items-center gap-1.5">
                <HiClock className="w-4 h-4" />
                {article.readTime} de lectura
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Article Content */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg"
        >
          <Suspense
            fallback={
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <Component />
          </Suspense>
        </motion.article>

        {/* Back to blog */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800"
        >
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-medium transition-all duration-200 hover:shadow-lg"
          >
            <HiArrowLeft className="w-5 h-5" />
            Volver al blog
          </Link>
        </motion.div>
      </section>

      <Footer />
      <ScrollToTop />
    </div>
  );
}
