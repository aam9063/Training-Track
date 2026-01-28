import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';
import { HiStar } from 'react-icons/hi';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

export default function Testimonials() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const testimonials = [
    {
      name: 'Carlos Mendoza',
      role: 'Entrenador Nacional de Medio Fondo',
      image: 'https://randomuser.me/api/portraits/men/32.jpg',
      rating: 5,
      text: 'TrackPro ha revolucionado la forma en que gestiono a mis 20 atletas. El análisis de datos me permite tomar decisiones más inteligentes y los resultados hablan por sí solos.',
      specialty: '800m - 1500m',
    },
    {
      name: 'María González',
      role: 'Atleta Internacional',
      image: 'https://randomuser.me/api/portraits/women/44.jpg',
      rating: 5,
      text: 'Como atleta, poder ver mi progreso en tiempo real y comunicarme directamente con mi entrenador ha marcado la diferencia en mi preparación para competencias.',
      specialty: '5000m - 10000m',
    },
    {
      name: 'Roberto Silva',
      role: 'Entrenador de Maratón',
      image: 'https://randomuser.me/api/portraits/men/52.jpg',
      rating: 5,
      text: 'La planificación de entrenamientos es increíblemente intuitiva. Puedo crear planes personalizados para cada atleta en minutos y ajustarlos sobre la marcha.',
      specialty: '21k - Maratón',
    },
    {
      name: 'Ana Martínez',
      role: 'Atleta de Medio Fondo',
      image: 'https://randomuser.me/api/portraits/women/68.jpg',
      rating: 5,
      text: 'Las gráficas de rendimiento son espectaculares. Puedo ver exactamente dónde estoy mejorando y qué aspectos necesito trabajar más.',
      specialty: '400m - 800m',
    },
    {
      name: 'Luis Hernández',
      role: 'Entrenador Universitario',
      image: 'https://randomuser.me/api/portraits/men/67.jpg',
      rating: 5,
      text: 'Gestionar un equipo universitario nunca fue tan fácil. TrackPro centraliza todo: entrenamientos, comunicación y análisis. Es indispensable.',
      specialty: 'Equipo Universitario',
    },
  ];

  return (
    <section
      id="testimonios"
      ref={ref}
      className="py-24 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 relative overflow-hidden"
    >
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-300 dark:bg-blue-900/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-300 dark:bg-purple-900/30 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.5 }}
            className="inline-block px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-semibold mb-4"
          >
            TESTIMONIOS
          </motion.span>

          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Lo que dicen nuestros
            <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              entrenadores y atletas
            </span>
          </h2>

          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Únete a la comunidad de profesionales que están transformando
            el entrenamiento de atletismo
          </p>
        </motion.div>

        {/* Testimonials Slider */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative"
        >
          <Swiper
            modules={[Autoplay, Pagination, Navigation]}
            spaceBetween={30}
            slidesPerView={1}
            pagination={{
              clickable: true,
              dynamicBullets: true,
            }}
            navigation={true}
            autoplay={{
              delay: 5000,
              disableOnInteraction: false,
            }}
            breakpoints={{
              640: {
                slidesPerView: 1,
              },
              768: {
                slidesPerView: 2,
              },
              1024: {
                slidesPerView: 3,
              },
            }}
            className="pb-16"
          >
            {testimonials.map((testimonial, index) => (
              <SwiperSlide key={index}>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 h-full border border-gray-100 dark:border-gray-700">
                  {/* Rating */}
                  <div className="flex items-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <HiStar key={i} className="w-5 h-5 text-yellow-400" />
                    ))}
                  </div>

                  {/* Testimonial Text */}
                  <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed italic">
                    "{testimonial.text}"
                  </p>

                  {/* Author Info */}
                  <div className="flex items-center space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <img
                      src={testimonial.image}
                      alt={testimonial.name}
                      className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-500"
                    />
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">
                        {testimonial.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {testimonial.role}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
                        {testimonial.specialty}
                      </p>
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </motion.div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {[
            { number: '4.9/5', label: 'Calificación Promedio' },
            { number: '500+', label: 'Reseñas Positivas' },
            { number: '98%', label: 'Tasa de Retención' },
            { number: '24/7', label: 'Soporte Disponible' },
          ].map((stat, index) => (
            <div
              key={index}
              className="text-center bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg"
            >
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                {stat.number}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
