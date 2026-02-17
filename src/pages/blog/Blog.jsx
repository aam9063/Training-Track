import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiArrowRight, HiClock, HiCalendar } from 'react-icons/hi';
import Navbar from '../../components/landing/Navbar';
import Footer from '../../components/landing/Footer';
import ScrollToTop from '../../components/landing/ScrollToTop';
import useSEO from '../../hooks/useSEO';
import blogArticles from './blogData';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

function ArticleCard({ article, index }) {
  const formattedDate = new Date(article.date + 'T00:00:00').toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <motion.article
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={fadeUp}
    >
      <Link
        to={`/blog/${article.slug}`}
        className="group block bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
      >
        {/* Image */}
        <div className="relative aspect-video overflow-hidden">
          <img
            src={article.image}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          {/* Category badge */}
          <span className="absolute top-4 left-4 px-3 py-1 bg-sky-600 text-white text-xs font-semibold rounded-full">
            {article.category}
          </span>
        </div>

        {/* Content */}
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 line-clamp-2 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
            {article.title}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4 line-clamp-3">
            {article.excerpt}
          </p>

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <HiCalendar className="w-3.5 h-3.5" />
                {formattedDate}
              </span>
              <span className="flex items-center gap-1">
                <HiClock className="w-3.5 h-3.5" />
                {article.readTime}
              </span>
            </div>
            <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium group-hover:gap-2 transition-all">
              Leer más <HiArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

export default function Blog() {
  useSEO({
    title: 'Blog de Entrenamiento de Atletismo',
    description:
      'Artículos sobre periodización, fisiología del deporte, fuerza para corredores y rendimiento atlético. Consejos de entrenamiento para medio fondo y fondo.',
    path: '/blog',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'Blog Training Track',
      description: 'Artículos sobre entrenamiento de atletismo, fisiología deportiva y rendimiento.',
      url: 'https://trainingtrack.es/blog',
      publisher: {
        '@type': 'Organization',
        name: 'Training Track',
        url: 'https://trainingtrack.es',
      },
    },
  });

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-[45vh] flex items-center justify-center overflow-hidden pt-20">
        {/* Background image with blur */}
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{ backgroundImage: "url('/img/pista.jpg')" }}
        />
        <div className="absolute inset-0 backdrop-blur-sm bg-black/50" />

        {/* Content */}
        <div className="relative z-10 text-center px-4">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-block px-4 py-1.5 bg-sky-600/20 text-sky-300 rounded-full text-sm font-medium mb-4 border border-sky-500/30"
          >
            Nuestro Blog
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl sm:text-6xl font-bold text-white mb-4"
          >
            Blog
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-gray-300 max-w-2xl mx-auto"
          >
            Artículos sobre entrenamiento, fisiología del deporte y rendimiento atlético
          </motion.p>
        </div>
      </section>

      {/* Articles Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl font-bold text-gray-900 dark:text-white mb-12"
        >
          Últimos artículos
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogArticles.map((article, index) => (
            <ArticleCard key={article.slug} article={article} index={index} />
          ))}
        </div>

        {/* Empty state */}
        {blogArticles.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              Próximamente publicaremos nuestros primeros artículos. ¡Mantente atento!
            </p>
          </div>
        )}
      </section>

      <Footer />
      <ScrollToTop />
    </div>
  );
}
