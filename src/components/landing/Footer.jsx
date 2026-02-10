import { motion } from 'framer-motion';
import { HiMail, HiPhone, HiLocationMarker } from 'react-icons/hi';
import { FaFacebook, FaInstagram, FaLinkedin, FaYoutube, FaTiktok } from 'react-icons/fa';
import { FaXTwitter } from "react-icons/fa6";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { name: 'Características', href: '/not-found' },
      { name: 'Pricing', href: '#pricing' },
      { name: 'Casos de Uso', href: '/not-found' },
      { name: 'Testimonios', href: '#testimonios' },
    ],
    company: [
      { name: 'Sobre Nosotros', href: '#conocenos' },
      { name: 'Blog', href: '/not-found' },
      { name: 'Carreras', href: '/not-found' },
      { name: 'Prensa', href: '/not-found' },
    ],
    resources: [
      { name: 'Documentación', href: '/not-found' },
      { name: 'Centro de Ayuda', href: '/not-found' },
      { name: 'API', href: '/not-found' },
      { name: 'Comunidad', href: '/not-found' },
    ],
    legal: [
      { name: 'Privacidad', href: '/not-found' },
      { name: 'Términos', href: '/not-found' },
      { name: 'Cookies', href: '/not-found' },
      { name: 'Licencias', href: '/not-found' },
    ],
  };

  const socialLinks = [
    { icon: FaFacebook, href: '#', label: 'Facebook', color: 'hover:text-blue-600' },
    { icon: FaXTwitter, href: '#', label: 'Twitter', color: 'hover:text-blue-400' },
    { icon: FaInstagram, href: '#', label: 'Instagram', color: 'hover:text-pink-600' },
    { icon: FaTiktok, href: '#', label: 'TikTok', color: 'hover:text-black-600' },
    { icon: FaLinkedin, href: '#', label: 'LinkedIn', color: 'hover:text-blue-700' },
    { icon: FaYoutube, href: '#', label: 'YouTube', color: 'hover:text-red-600' },
  ];

  return (
    <footer className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-500 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gray-500 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 mb-12">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center">
                <img src="/img/logo.png" alt="TrainingTrackPro" className="w-16 h-16 object-contain" />

                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">TrainingTrackPro</span>
              </div>

              <p className="text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                La plataforma líder en gestión de entrenamientos de atletismo.
                Llevando tu rendimiento al siguiente nivel.
              </p>

              {/* Contact Info */}
              <div className="space-y-3 text-gray-500 dark:text-gray-300">
                <div className="flex items-center space-x-3 text-sm">
                  <HiMail className="w-5 h-5 text-sky-500" />
                  <span>contacto@trainingtrackpro.com</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <HiPhone className="w-5 h-5 text-sky-500" />
                  <span>+34 900 123 456</span>
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
                  <a
                    href={link.href}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                  >
                    {link.name}
                  </a>
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
                  <a
                    href={link.href}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Resources Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h3 className="text-gray-900 dark:text-white font-semibold mb-4">Recursos</h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.href}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                  >
                    {link.name}
                  </a>
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
                  <a
                    href={link.href}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Newsletter Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="border-t border-gray-200 dark:border-gray-800 pt-8 mb-8"
        >
          <div className="max-w-md mx-auto text-center">
            <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Mantente actualizado</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              Recibe las últimas noticias y actualizaciones directamente en tu correo
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="tu@email.com"
                className="flex-1 px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold hover:shadow-lg transition-all duration-200"
              >
                Suscribirse
              </motion.button>
            </div>
          </div>
        </motion.div>

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
            © {currentYear} TrainingTrack Pro. Todos los derechos reservados.
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
