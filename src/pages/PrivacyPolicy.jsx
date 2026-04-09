import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { HiArrowLeft } from 'react-icons/hi';
import useSEO from '../hooks/useSEO';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

export default function PrivacyPolicy() {
  useSEO({
    title: 'Política de Privacidad',
    description: 'Política de privacidad de TrainingTrack. Información sobre el tratamiento de datos personales, derechos RGPD, integraciones con terceros y medidas de seguridad.',
    path: '/privacidad',
  });
  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A]">
      <Navbar />

      <div className="pt-28 pb-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 text-sm font-medium mb-8 transition-colors"
          >
            <HiArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Política de Privacidad
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
            Última actualización: 9 de abril de 2026
          </p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">

            {/* 1 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                1. Responsable del tratamiento
              </h2>
              <ul className="list-none space-y-1 pl-0">
                <li><strong>Titular:</strong> Training Track</li>
                <li><strong>Correo electrónico:</strong> info@trainingtrack.es</li>
                <li><strong>Domicilio:</strong> Alicante, España</li>
                <li><strong>Sitio web:</strong> https://trainingtrack.es</li>
              </ul>
            </section>

            {/* 2 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                2. Normativa aplicable
              </h2>
              <p>
                El tratamiento de datos personales se realiza conforme a la siguiente normativa:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>
                  <strong>Reglamento General de Protección de Datos (RGPD)</strong> — Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27 de abril de 2016.
                </li>
                <li>
                  <strong>Ley Orgánica 3/2018, de 5 de diciembre</strong>, de Protección de Datos Personales y garantía de los derechos digitales (LOPD-GDD).
                </li>
                <li>
                  <strong>Ley 34/2002, de 11 de julio</strong>, de Servicios de la Sociedad de la Información y del Comercio Electrónico (LSSI-CE).
                </li>
              </ul>
            </section>

            {/* 3 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                3. Datos personales que recopilamos
              </h2>
              <p>
                Recopilamos los siguientes datos personales en función del uso que hagas de la plataforma:
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                3.1. Datos de registro
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Nombre y apellidos</li>
                <li>Dirección de correo electrónico</li>
                <li>Contraseña (almacenada de forma cifrada)</li>
                <li>Rol (entrenador o atleta)</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                3.2. Datos del perfil
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Teléfono de contacto</li>
                <li>Fecha de nacimiento, peso, altura (solo atletas)</li>
                <li>Distancias de competición</li>
                <li>Fotografía de perfil</li>
                <li>Biografía y especialidades (solo entrenadores)</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                3.3. Datos de actividad deportiva
              </h3>
              <p>
                A través de la integración con servicios de terceros (Strava, COROS, Garmin), podemos recibir:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Datos de entrenamientos: distancia, duración, ritmo, velocidad, cadencia</li>
                <li>Frecuencia cardíaca y zonas de frecuencia cardíaca</li>
                <li>Datos de GPS y rutas (latitud, longitud, altitud)</li>
                <li>Desnivel acumulado y perfil de elevación</li>
                <li>Calorías estimadas</li>
                <li>Tipo de actividad (carrera, ciclismo, trail, etc.)</li>
                <li>Splits, segmentos y mejores esfuerzos</li>
                <li>Datos del dispositivo utilizado</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                3.4. Datos fisiológicos y de rendimiento
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>VO2 máximo estimado</li>
                <li>Resultados de tests fisiológicos (Test de Conconi, Test VAM)</li>
                <li>Zonas de ritmo personalizadas</li>
                <li>Valoración del esfuerzo percibido (RPE)</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                3.5. Datos de comunicación
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Mensajes enviados entre entrenador y atleta dentro de la plataforma</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                3.6. Datos técnicos
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Dirección IP</li>
                <li>Tipo de navegador y sistema operativo</li>
                <li>Cookies y preferencias de sesión</li>
              </ul>
            </section>

            {/* 4 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                4. Finalidad del tratamiento
              </h2>
              <p>
                Los datos personales se tratan con las siguientes finalidades:
              </p>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm border border-gray-200 dark:border-[#2A2A2A]">
                  <thead className="bg-gray-50 dark:bg-[#141414]">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-[#2A2A2A]">Finalidad</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-[#2A2A2A]">Base jurídica</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-[#2A2A2A]">
                    <tr>
                      <td className="px-4 py-2">Gestión del registro y la cuenta de usuario</td>
                      <td className="px-4 py-2">Ejecución de contrato (art. 6.1.b RGPD)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Prestación del servicio de planificación de entrenamientos</td>
                      <td className="px-4 py-2">Ejecución de contrato (art. 6.1.b RGPD)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Sincronización de datos de actividad deportiva con servicios de terceros (Strava, COROS, Garmin)</td>
                      <td className="px-4 py-2">Consentimiento del usuario (art. 6.1.a RGPD)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Generación de informes de rendimiento con inteligencia artificial</td>
                      <td className="px-4 py-2">Consentimiento del usuario (art. 6.1.a RGPD)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Almacenamiento de datos de tests fisiológicos y métricas de salud</td>
                      <td className="px-4 py-2">Consentimiento explícito (art. 9.2.a RGPD)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Comunicación entre entrenador y atleta</td>
                      <td className="px-4 py-2">Ejecución de contrato (art. 6.1.b RGPD)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Análisis de uso de la plataforma y mejora del servicio</td>
                      <td className="px-4 py-2">Interés legítimo (art. 6.1.f RGPD)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Envío de comunicaciones informativas sobre el servicio</td>
                      <td className="px-4 py-2">Consentimiento del usuario (art. 6.1.a RGPD)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 5 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                5. Tratamiento de datos de salud
              </h2>
              <p>
                Determinados datos tratados por la plataforma pueden considerarse <strong>datos relativos a la salud</strong> según
                el artículo 9 del RGPD (frecuencia cardíaca, VO2 máximo, datos fisiológicos). Estos datos se tratan
                exclusivamente con el <strong>consentimiento explícito</strong> del usuario, obtenido en el momento de:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Conectar una cuenta de un servicio de terceros (Strava, COROS, Garmin)</li>
                <li>Realizar un test fisiológico (Conconi, VAM)</li>
                <li>Registrar valoraciones de esfuerzo percibido (RPE)</li>
              </ul>
              <p className="mt-2">
                El usuario puede revocar este consentimiento en cualquier momento desconectando su cuenta del servicio
                de terceros o solicitando la eliminación de sus datos.
              </p>
            </section>

            {/* 6 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                6. Integraciones con terceros
              </h2>
              <p>
                Training Track se integra con los siguientes servicios de terceros para la sincronización
                de datos de actividad deportiva:
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                6.1. Strava
              </h3>
              <p>
                Al conectar tu cuenta de Strava, autorizas a Training Track a acceder a tus datos de actividad
                a través de la API de Strava. Puedes revocar este acceso en cualquier momento desde la configuración
                de tu cuenta de Strava (<a href="https://www.strava.com/settings/apps" className="text-sky-600 dark:text-sky-400 underline" target="_blank" rel="noopener noreferrer">strava.com/settings/apps</a>)
                o desde la sección de Dispositivos de tu perfil.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                6.2. COROS
              </h3>
              <p>
                Al conectar tu cuenta de COROS, autorizas a Training Track a acceder a tus datos de entrenamiento
                a través de la API de COROS. Puedes revocar este acceso en cualquier momento desde la configuración de
                tu cuenta de COROS o desde la plataforma.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                6.3. Garmin Connect
              </h3>
              <p>
                Al conectar tu cuenta de Garmin, autorizas a Training Track a acceder a tus datos de actividad
                a través de la API de Garmin Connect. Puedes revocar este acceso desde
                la configuración de aplicaciones de tu cuenta de Garmin o desde la plataforma.
              </p>

              <p className="mt-3">
                En todos los casos, solo accedemos a los datos necesarios para prestar el servicio.
                <strong> No modificamos, publicamos ni compartimos tus datos con estos servicios</strong>.
                El acceso es únicamente de lectura.
              </p>
            </section>

            {/* 7 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                7. Uso de inteligencia artificial
              </h2>
              <p>
                Training Track utiliza modelos de inteligencia artificial para generar informes de rendimiento
                deportivo. Este procesamiento:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Se realiza únicamente con datos anonimizados y agregados del atleta</li>
                <li>No se utiliza para la toma de decisiones automatizadas con efectos jurídicos</li>
                <li>Los datos no se utilizan para entrenar modelos de IA de terceros</li>
                <li>El usuario puede solicitar la no generación de informes de IA en cualquier momento</li>
              </ul>
            </section>

            {/* 8 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                8. Comunicación de datos a terceros
              </h2>
              <p>
                Los datos personales <strong>no se ceden ni se venden a terceros</strong>, salvo en los siguientes supuestos:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>
                  <strong>Relación entrenador-atleta:</strong> Los datos de actividad y rendimiento del atleta
                  son visibles para el entrenador asignado, previa solicitud y aceptación por parte de ambos.
                </li>
                <li>
                  <strong>Proveedores de servicios:</strong> Utilizamos Supabase (almacenamiento y autenticación)
                  y servicios de IA para el procesamiento de datos. Estos proveedores actúan como encargados del
                  tratamiento conforme al artículo 28 del RGPD.
                </li>
                <li>
                  <strong>Obligación legal:</strong> Cuando sea requerido por ley, autoridad judicial o administrativa.
                </li>
              </ul>
            </section>

            {/* 9 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                9. Transferencias internacionales de datos
              </h2>
              <p>
                Algunos de nuestros proveedores de servicios pueden estar ubicados fuera del Espacio Económico Europeo.
                En estos casos, garantizamos que las transferencias se realizan conforme a:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Decisiones de adecuación de la Comisión Europea</li>
                <li>Cláusulas contractuales tipo aprobadas por la Comisión Europea</li>
                <li>El Marco de Privacidad de Datos UE-EE.UU. (EU-US Data Privacy Framework)</li>
              </ul>
            </section>

            {/* 10 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                10. Procesamiento de pagos (Stripe)
              </h2>
              <p>
                TrainingTrack utiliza <strong>Stripe, Inc.</strong> como procesador de pagos para gestionar las
                suscripciones y cobros de la plataforma.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                10.1. Datos procesados por Stripe
              </h3>
              <p>
                Al realizar un pago o suscribirte a un plan de pago, Stripe procesa directamente los siguientes datos:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Número de tarjeta de crédito o débito</li>
                <li>Fecha de caducidad de la tarjeta</li>
                <li>Código de verificación (CVC/CVV)</li>
                <li>Dirección de facturación</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                10.2. Datos que TrainingTrack almacena
              </h3>
              <p>
                TrainingTrack <strong>no almacena, procesa ni tiene acceso</strong> a los datos completos de tu tarjeta
                bancaria. Únicamente almacenamos:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Identificador de cliente de Stripe (Stripe Customer ID)</li>
                <li>Estado de la suscripción (activa, cancelada, período de prueba, etc.)</li>
                <li>Plan contratado y fecha de renovación</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                10.3. Datos compartidos con Stripe
              </h3>
              <p>
                Para la creación y gestión de tu cuenta de pago, TrainingTrack transfiere a Stripe los siguientes datos:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Dirección de correo electrónico</li>
                <li>Nombre del usuario</li>
                <li>Plan de suscripción seleccionado</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                10.4. Seguridad y certificaciones
              </h3>
              <p>
                Stripe cuenta con la certificación <strong>PCI DSS Nivel 1</strong>, el estándar de seguridad más
                exigente de la industria de pagos. Todos los datos de pago se transmiten y almacenan de forma cifrada
                en los servidores de Stripe.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                10.5. Base jurídica y política de privacidad
              </h3>
              <p>
                La base jurídica para el tratamiento de datos relacionados con pagos es la{' '}
                <strong>ejecución del contrato</strong> (artículo 6.1.b del RGPD), ya que el procesamiento de pagos es
                necesario para la prestación del servicio contratado.
              </p>
              <p className="mt-2">
                Para más información sobre cómo Stripe trata tus datos, consulta su{' '}
                <a
                  href="https://stripe.com/privacy"
                  className="text-sky-600 dark:text-sky-400 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Política de Privacidad
                </a>.
              </p>
            </section>

            {/* 11 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                11. Conservación de datos
              </h2>
              <p>
                Los datos personales se conservan durante el tiempo necesario para cumplir con la finalidad
                para la que fueron recogidos:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Datos de cuenta:</strong> mientras la cuenta esté activa. Tras la baja, se eliminan en un plazo máximo de 30 días.</li>
                <li><strong>Datos de actividad deportiva:</strong> mientras la cuenta esté activa y la integración con el servicio de terceros esté conectada.</li>
                <li><strong>Datos de tests fisiológicos:</strong> mientras la cuenta esté activa.</li>
                <li><strong>Mensajes:</strong> mientras la cuenta del remitente y destinatario estén activas.</li>
                <li><strong>Datos técnicos y de cookies:</strong> según la duración indicada en la Política de Cookies.</li>
              </ul>
              <p className="mt-2">
                Transcurridos los plazos, los datos serán eliminados o anonimizados de forma irreversible.
              </p>
            </section>

            {/* 12 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                12. Derechos del usuario
              </h2>
              <p>
                De conformidad con el RGPD y la LOPD-GDD, puedes ejercer los siguientes derechos:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Acceso:</strong> solicitar información sobre los datos que tratamos.</li>
                <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
                <li><strong>Supresión:</strong> solicitar la eliminación de tus datos ("derecho al olvido").</li>
                <li><strong>Limitación:</strong> solicitar la restricción del tratamiento en determinados supuestos.</li>
                <li><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado y de uso común.</li>
                <li><strong>Oposición:</strong> oponerte al tratamiento de tus datos en determinadas circunstancias.</li>
                <li><strong>Revocación del consentimiento:</strong> retirar el consentimiento otorgado en cualquier momento.</li>
              </ul>
              <p className="mt-3">
                Para ejercer cualquiera de estos derechos, puedes contactar con nosotros en{' '}
                <a href="mailto:info@trainingtrack.es" className="text-sky-600 dark:text-sky-400 underline">
                  info@trainingtrack.es
                </a>
                , indicando tu nombre completo, correo electrónico asociado a tu cuenta y el derecho que deseas ejercer.
                Responderemos en un plazo máximo de 30 días.
              </p>
              <p className="mt-2">
                Si consideras que tus derechos no han sido atendidos correctamente, puedes presentar una reclamación ante la{' '}
                <strong>Agencia Española de Protección de Datos (AEPD)</strong> —{' '}
                <a href="https://www.aepd.es" className="text-sky-600 dark:text-sky-400 underline" target="_blank" rel="noopener noreferrer">
                  www.aepd.es
                </a>.
              </p>
            </section>

            {/* 13 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                13. Medidas de seguridad
              </h2>
              <p>
                Aplicamos medidas técnicas y organizativas adecuadas para garantizar la seguridad de los datos personales,
                incluyendo:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Cifrado de datos en tránsito (HTTPS/TLS) y en reposo</li>
                <li>Contraseñas almacenadas con hash criptográfico (bcrypt)</li>
                <li>Autenticación segura con tokens JWT</li>
                <li>Políticas de acceso basadas en roles (Row Level Security)</li>
                <li>Tokens de integración con terceros almacenados de forma cifrada</li>
                <li>Copias de seguridad periódicas de la base de datos</li>
                <li>Acceso restringido a la infraestructura del servidor</li>
              </ul>
            </section>

            {/* 14 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                14. Política de cookies
              </h2>
              <p>
                Training Track utiliza cookies para el funcionamiento del servicio. Para más información,
                consulta el banner de consentimiento de cookies que se muestra al acceder a la plataforma.
              </p>
              <p className="mt-2">Tipos de cookies utilizadas:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Necesarias:</strong> inicio de sesión, preferencias de tema (claro/oscuro), seguridad de sesión.</li>
                <li><strong>Analíticas:</strong> medición de tráfico y uso de la plataforma (requieren consentimiento).</li>
                <li><strong>Marketing:</strong> personalización de contenido y ofertas (requieren consentimiento).</li>
              </ul>
              <p className="mt-2">
                Puedes gestionar tus preferencias de cookies en cualquier momento desde el enlace "Cookies"
                en el pie de página.
              </p>
            </section>

            {/* 15 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                15. Menores de edad
              </h2>
              <p>
                Conforme al artículo 7 de la LOPD-GDD, el tratamiento de datos de menores de 14 años requiere
                el consentimiento de sus padres o tutores legales. Training Track no recopila deliberadamente
                datos de menores de 14 años sin dicho consentimiento. Si eres menor de 14 años, debes contar con
                la autorización de tu padre, madre o tutor legal para registrarte.
              </p>
            </section>

            {/* 16 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                16. Modificaciones de esta política
              </h2>
              <p>
                Nos reservamos el derecho de modificar esta Política de Privacidad para adaptarla a novedades legislativas
                o cambios en el servicio. Cualquier modificación será publicada en esta página con la fecha de actualización
                correspondiente. En caso de cambios sustanciales, notificaremos a los usuarios a través del correo
                electrónico asociado a su cuenta.
              </p>
            </section>

            {/* 17 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                17. Contacto
              </h2>
              <p>
                Para cualquier consulta relacionada con esta Política de Privacidad o el tratamiento de tus datos
                personales, puedes contactar con nosotros en:
              </p>
              <ul className="list-none pl-0 space-y-1 mt-2">
                <li><strong>Email:</strong> info@trainingtrack.es</li>
                <li><strong>Dirección:</strong> Alicante, España</li>
              </ul>
            </section>

          </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
