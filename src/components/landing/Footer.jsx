// Note: Tailwind gray-* utilities with dark: variants are used intentionally for landing text/borders.
// CSS transition-colors on hover links is preferred over Framer Motion for performance (no JS overhead).
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { HiMail, HiLocationMarker } from 'react-icons/hi';
import { FaFacebook, FaInstagram, FaLinkedin, FaYoutube, FaTiktok } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { name: 'Casos de Uso', href: '/casos-de-uso' },
      { name: 'Pricing', href: '#pricing' },
      { name: 'Testimonios', href: '#testimonios' },
    ],
    company: [
      { name: 'Sobre Nosotros', href: '#conocenos' },
      { name: 'Blog', href: '/blog' },
    ],
    legal: [
      { name: 'Privacidad', href: '/privacidad' },
      { name: 'Términos y condiciones', href: '/terminos-y-condiciones' },
      { name: 'Cookies', href: '#', onClick: () => { localStorage.removeItem('cookie_consent'); window.location.reload(); } },
    ],
  };

  // Social brand colors — intentionally not design system tokens (third-party brand guidelines)
  const socialLinks = [
    { icon: FaFacebook, href: '#', label: 'Facebook', color: 'hover:text-blue-600' },
    { icon: FaXTwitter, href: '#', label: 'Twitter', color: 'hover:text-blue-400' },
    { icon: FaInstagram, href: '#', label: 'Instagram', color: 'hover:text-pink-600' },
    { icon: FaTiktok, href: '#', label: 'TikTok', color: 'hover:text-black dark:hover:text-white' },
    { icon: FaLinkedin, href: '#', label: 'LinkedIn', color: 'hover:text-blue-700' },
    { icon: FaYoutube, href: '#', label: 'YouTube', color: 'hover:text-red-600' },
  ];

  return (
    <footer className="bg-gray-100 dark:bg-coach-base text-gray-600 dark:text-gray-300 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-500 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gray-500 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center space-x-2 mb-4">
                <img src="/img/logo.png" alt="TrainingTrack" className="w-10 h-10 object-contain" />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">Training Track</span>
              </div>

              <p className="text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                La plataforma de entrenamiento de atletismo con IA para entrenadores
                y atletas independientes. Llevando tu rendimiento al siguiente nivel.
              </p>

              {/* Contact Info */}
              <div className="space-y-3 text-gray-500 dark:text-gray-300">
                <div className="flex items-center space-x-3 text-sm">
                  <HiMail className="w-5 h-5 text-sky-500" />
                  <span>info@trainingtrack.es</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <HiLocationMarker className="w-5 h-5 text-sky-500" />
                  <span>Alicante, España</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Product Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h3 className="text-gray-900 dark:text-white font-semibold mb-4">Producto</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link, index) => (
                <li key={index}>
                  {link.href.startsWith('#') ? (
                    <a
                      href={link.href}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                    >
                      {link.name}
                    </a>
                  ) : (
                    <Link
                      to={link.href}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                    >
                      {link.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Company Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h3 className="text-gray-900 dark:text-white font-semibold mb-4">Compañía</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link, index) => (
                <li key={index}>
                  {link.href.startsWith('#') ? (
                    <a
                      href={link.href}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                    >
                      {link.name}
                    </a>
                  ) : (
                    <Link
                      to={link.href}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                    >
                      {link.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Legal Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h3 className="text-gray-900 dark:text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link, index) => (
                <li key={index}>
                  {link.href.startsWith('#') || link.onClick ? (
                    <a
                      href={link.href}
                      onClick={link.onClick ? (e) => { e.preventDefault(); link.onClick(); } : undefined}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 cursor-pointer"
                    >
                      {link.name}
                    </a>
                  ) : (
                    <Link
                      to={link.href}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                    >
                      {link.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Bottom Section */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="border-t border-gray-200 dark:border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          {/* Copyright */}
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            © {currentYear} Training Track. Todos los derechos reservados.
          </div>

          {/* Social Links */}
          <div className="flex items-center space-x-4">
            {socialLinks.map((social, index) => {
              const Icon = social.icon;
              return (
                <motion.a
                  key={index}
                  href={social.href}
                  aria-label={social.label}
                  whileHover={{ scale: 1.2, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  className={`text-gray-500 dark:text-gray-400 ${social.color} transition-colors duration-200`}
                >
                  <Icon className="w-5 h-5" />
                </motion.a>
              );
            })}
          </div>

          {/* Made with love */}
          <div className="text-gray-500 dark:text-gray-400 text-sm flex items-center space-x-2">
            <span>Hecho con</span>
            <motion.span
              animate={{
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                repeatType: 'reverse',
              }}
              className="text-red-500"
            >
              ❤️
            </motion.span>
            <span>para atletas</span>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
