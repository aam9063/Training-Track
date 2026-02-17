import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { HiArrowLeft } from 'react-icons/hi';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
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
            Politica de Privacidad
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
            Ultima actualizacion: 11 de febrero de 2026
          </p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">

            {/* 1 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                1. Responsable del tratamiento
              </h2>
              <ul className="list-none space-y-1 pl-0">
                <li><strong>Titular:</strong> Training Track</li>
                <li><strong>Correo electronico:</strong> contacto@trainingtrack.com</li>
                <li><strong>Domicilio:</strong> Alicante, Espana</li>
                <li><strong>Sitio web:</strong> https://trainingtrack.com</li>
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
                  <strong>Reglamento General de Proteccion de Datos (RGPD)</strong> — Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27 de abril de 2016.
                </li>
                <li>
                  <strong>Ley Organica 3/2018, de 5 de diciembre</strong>, de Proteccion de Datos Personales y garantia de los derechos digitales (LOPD-GDD).
                </li>
                <li>
                  <strong>Ley 34/2002, de 11 de julio</strong>, de Servicios de la Sociedad de la Informacion y del Comercio Electronico (LSSI-CE).
                </li>
              </ul>
            </section>

            {/* 3 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                3. Datos personales que recopilamos
              </h2>
              <p>
                Recopilamos los siguientes datos personales en funcion del uso que hagas de la plataforma:
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                3.1. Datos de registro
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Nombre y apellidos</li>
                <li>Direccion de correo electronico</li>
                <li>Contrasena (almacenada de forma cifrada)</li>
                <li>Rol (entrenador o atleta)</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                3.2. Datos del perfil
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Telefono de contacto</li>
                <li>Fecha de nacimiento, peso, altura (solo atletas)</li>
                <li>Distancias de competicion</li>
                <li>Fotografia de perfil</li>
                <li>Biografia y especialidades (solo entrenadores)</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                3.3. Datos de actividad deportiva
              </h3>
              <p>
                A traves de la integracion con servicios de terceros (Strava, COROS, Garmin), podemos recibir:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Datos de entrenamientos: distancia, duracion, ritmo, velocidad, cadencia</li>
                <li>Frecuencia cardiaca y zonas de frecuencia cardiaca</li>
                <li>Datos de GPS y rutas (latitud, longitud, altitud)</li>
                <li>Desnivel acumulado y perfil de elevacion</li>
                <li>Calorias estimadas</li>
                <li>Tipo de actividad (carrera, ciclismo, trail, etc.)</li>
                <li>Splits, segmentos y mejores esfuerzos</li>
                <li>Datos del dispositivo utilizado</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                3.4. Datos fisiologicos y de rendimiento
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>VO2 maximo estimado</li>
                <li>Resultados de tests fisiologicos (Test de Conconi, Test VAM)</li>
                <li>Zonas de ritmo personalizadas</li>
                <li>Valoracion del esfuerzo percibido (RPE)</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                3.5. Datos de comunicacion
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Mensajes enviados entre entrenador y atleta dentro de la plataforma</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                3.6. Datos tecnicos
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Direccion IP</li>
                <li>Tipo de navegador y sistema operativo</li>
                <li>Cookies y preferencias de sesion</li>
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
                <table className="w-full text-sm border border-gray-200 dark:border-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">Finalidad</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">Base juridica</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    <tr>
                      <td className="px-4 py-2">Gestion del registro y la cuenta de usuario</td>
                      <td className="px-4 py-2">Ejecucion de contrato (art. 6.1.b RGPD)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Prestacion del servicio de planificacion de entrenamientos</td>
                      <td className="px-4 py-2">Ejecucion de contrato (art. 6.1.b RGPD)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Sincronizacion de datos de actividad deportiva con servicios de terceros (Strava, COROS, Garmin)</td>
                      <td className="px-4 py-2">Consentimiento del usuario (art. 6.1.a RGPD)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Generacion de informes de rendimiento con inteligencia artificial</td>
                      <td className="px-4 py-2">Consentimiento del usuario (art. 6.1.a RGPD)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Almacenamiento de datos de tests fisiologicos y metricas de salud</td>
                      <td className="px-4 py-2">Consentimiento explicito (art. 9.2.a RGPD)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Comunicacion entre entrenador y atleta</td>
                      <td className="px-4 py-2">Ejecucion de contrato (art. 6.1.b RGPD)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Analisis de uso de la plataforma y mejora del servicio</td>
                      <td className="px-4 py-2">Interes legitimo (art. 6.1.f RGPD)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Envio de comunicaciones informativas sobre el servicio</td>
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
                Determinados datos tratados por la plataforma pueden considerarse <strong>datos relativos a la salud</strong> segun
                el articulo 9 del RGPD (frecuencia cardiaca, VO2 maximo, datos fisiologicos). Estos datos se tratan
                exclusivamente con el <strong>consentimiento explicito</strong> del usuario, obtenido en el momento de:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Conectar una cuenta de un servicio de terceros (Strava, COROS, Garmin)</li>
                <li>Realizar un test fisiologico (Conconi, VAM)</li>
                <li>Registrar valoraciones de esfuerzo percibido (RPE)</li>
              </ul>
              <p className="mt-2">
                El usuario puede revocar este consentimiento en cualquier momento desconectando su cuenta del servicio
                de terceros o solicitando la eliminacion de sus datos.
              </p>
            </section>

            {/* 6 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                6. Integraciones con terceros
              </h2>
              <p>
                Training Track se integra con los siguientes servicios de terceros para la sincronizacion
                de datos de actividad deportiva:
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                6.1. Strava
              </h3>
              <p>
                Al conectar tu cuenta de Strava, autorizas a Training Track a acceder a tus datos de actividad
                a traves de la API de Strava. Puedes revocar este acceso en cualquier momento desde la configuracion
                de tu cuenta de Strava (<a href="https://www.strava.com/settings/apps" className="text-sky-600 dark:text-sky-400 underline" target="_blank" rel="noopener noreferrer">strava.com/settings/apps</a>)
                o desde la seccion de Dispositivos de tu perfil.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                6.2. COROS
              </h3>
              <p>
                Al conectar tu cuenta de COROS, autorizas a Training Track a acceder a tus datos de entrenamiento
                a traves de la API de COROS. Puedes revocar este acceso en cualquier momento desde la configuracion de
                tu cuenta de COROS o desde la plataforma.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                6.3. Garmin Connect
              </h3>
              <p>
                Al conectar tu cuenta de Garmin, autorizas a Training Track a acceder a tus datos de actividad
                a traves de la API de Garmin Connect. Puedes revocar este acceso desde
                la configuracion de aplicaciones de tu cuenta de Garmin o desde la plataforma.
              </p>

              <p className="mt-3">
                En todos los casos, solo accedemos a los datos necesarios para prestar el servicio.
                <strong> No modificamos, publicamos ni compartimos tus datos con estos servicios</strong>.
                El acceso es unicamente de lectura.
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
                <li>Se realiza unicamente con datos anonimizados y agregados del atleta</li>
                <li>No se utiliza para la toma de decisiones automatizadas con efectos juridicos</li>
                <li>Los datos no se utilizan para entrenar modelos de IA de terceros</li>
                <li>El usuario puede solicitar la no generacion de informes de IA en cualquier momento</li>
              </ul>
            </section>

            {/* 8 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                8. Comunicacion de datos a terceros
              </h2>
              <p>
                Los datos personales <strong>no se ceden ni se venden a terceros</strong>, salvo en los siguientes supuestos:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>
                  <strong>Relacion entrenador-atleta:</strong> Los datos de actividad y rendimiento del atleta
                  son visibles para el entrenador asignado, previa solicitud y aceptacion por parte de ambos.
                </li>
                <li>
                  <strong>Proveedores de servicios:</strong> Utilizamos Supabase (almacenamiento y autenticacion)
                  y servicios de IA para el procesamiento de datos. Estos proveedores actuan como encargados del
                  tratamiento conforme al articulo 28 del RGPD.
                </li>
                <li>
                  <strong>Obligacion legal:</strong> Cuando sea requerido por ley, autoridad judicial o administrativa.
                </li>
              </ul>
            </section>

            {/* 9 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                9. Transferencias internacionales de datos
              </h2>
              <p>
                Algunos de nuestros proveedores de servicios pueden estar ubicados fuera del Espacio Economico Europeo.
                En estos casos, garantizamos que las transferencias se realizan conforme a:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Decisiones de adecuacion de la Comision Europea</li>
                <li>Clausulas contractuales tipo aprobadas por la Comision Europea</li>
                <li>El Marco de Privacidad de Datos UE-EE.UU. (EU-US Data Privacy Framework)</li>
              </ul>
            </section>

            {/* 10 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                10. Conservacion de datos
              </h2>
              <p>
                Los datos personales se conservan durante el tiempo necesario para cumplir con la finalidad
                para la que fueron recogidos:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Datos de cuenta:</strong> mientras la cuenta este activa. Tras la baja, se eliminan en un plazo maximo de 30 dias.</li>
                <li><strong>Datos de actividad deportiva:</strong> mientras la cuenta este activa y la integracion con el servicio de terceros este conectada.</li>
                <li><strong>Datos de tests fisiologicos:</strong> mientras la cuenta este activa.</li>
                <li><strong>Mensajes:</strong> mientras la cuenta del remitente y destinatario esten activas.</li>
                <li><strong>Datos tecnicos y de cookies:</strong> segun la duracion indicada en la Politica de Cookies.</li>
              </ul>
              <p className="mt-2">
                Transcurridos los plazos, los datos seran eliminados o anonimizados de forma irreversible.
              </p>
            </section>

            {/* 11 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                11. Derechos del usuario
              </h2>
              <p>
                De conformidad con el RGPD y la LOPD-GDD, puedes ejercer los siguientes derechos:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Acceso:</strong> solicitar informacion sobre los datos que tratamos.</li>
                <li><strong>Rectificacion:</strong> corregir datos inexactos o incompletos.</li>
                <li><strong>Supresion:</strong> solicitar la eliminacion de tus datos ("derecho al olvido").</li>
                <li><strong>Limitacion:</strong> solicitar la restriccion del tratamiento en determinados supuestos.</li>
                <li><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado y de uso comun.</li>
                <li><strong>Oposicion:</strong> oponerte al tratamiento de tus datos en determinadas circunstancias.</li>
                <li><strong>Revocacion del consentimiento:</strong> retirar el consentimiento otorgado en cualquier momento.</li>
              </ul>
              <p className="mt-3">
                Para ejercer cualquiera de estos derechos, puedes contactar con nosotros en{' '}
                <a href="mailto:contacto@trainingtrack.com" className="text-sky-600 dark:text-sky-400 underline">
                  contacto@trainingtrack.com
                </a>
                , indicando tu nombre completo, correo electronico asociado a tu cuenta y el derecho que deseas ejercer.
                Responderemos en un plazo maximo de 30 dias.
              </p>
              <p className="mt-2">
                Si consideras que tus derechos no han sido atendidos correctamente, puedes presentar una reclamacion ante la{' '}
                <strong>Agencia Espanola de Proteccion de Datos (AEPD)</strong> —{' '}
                <a href="https://www.aepd.es" className="text-sky-600 dark:text-sky-400 underline" target="_blank" rel="noopener noreferrer">
                  www.aepd.es
                </a>.
              </p>
            </section>

            {/* 12 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                12. Medidas de seguridad
              </h2>
              <p>
                Aplicamos medidas tecnicas y organizativas adecuadas para garantizar la seguridad de los datos personales,
                incluyendo:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Cifrado de datos en transito (HTTPS/TLS) y en reposo</li>
                <li>Contrasenas almacenadas con hash criptografico (bcrypt)</li>
                <li>Autenticacion segura con tokens JWT</li>
                <li>Politicas de acceso basadas en roles (Row Level Security)</li>
                <li>Tokens de integracion con terceros almacenados de forma cifrada</li>
                <li>Copias de seguridad periodicas de la base de datos</li>
                <li>Acceso restringido a la infraestructura del servidor</li>
              </ul>
            </section>

            {/* 13 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                13. Politica de cookies
              </h2>
              <p>
                Training Track utiliza cookies para el funcionamiento del servicio. Para mas informacion,
                consulta el banner de consentimiento de cookies que se muestra al acceder a la plataforma.
              </p>
              <p className="mt-2">Tipos de cookies utilizadas:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Necesarias:</strong> inicio de sesion, preferencias de tema (claro/oscuro), seguridad de sesion.</li>
                <li><strong>Analiticas:</strong> medicion de trafico y uso de la plataforma (requieren consentimiento).</li>
                <li><strong>Marketing:</strong> personalizacion de contenido y ofertas (requieren consentimiento).</li>
              </ul>
              <p className="mt-2">
                Puedes gestionar tus preferencias de cookies en cualquier momento desde el enlace "Cookies"
                en el pie de pagina.
              </p>
            </section>

            {/* 14 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                14. Menores de edad
              </h2>
              <p>
                Conforme al articulo 7 de la LOPD-GDD, el tratamiento de datos de menores de 14 anos requiere
                el consentimiento de sus padres o tutores legales. Training Track no recopila deliberadamente
                datos de menores de 14 anos sin dicho consentimiento. Si eres menor de 14 anos, debes contar con
                la autorizacion de tu padre, madre o tutor legal para registrarte.
              </p>
            </section>

            {/* 15 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                15. Modificaciones de esta politica
              </h2>
              <p>
                Nos reservamos el derecho de modificar esta Politica de Privacidad para adaptarla a novedades legislativas
                o cambios en el servicio. Cualquier modificacion sera publicada en esta pagina con la fecha de actualizacion
                correspondiente. En caso de cambios sustanciales, notificaremos a los usuarios a traves del correo
                electronico asociado a su cuenta.
              </p>
            </section>

            {/* 16 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                16. Contacto
              </h2>
              <p>
                Para cualquier consulta relacionada con esta Politica de Privacidad o el tratamiento de tus datos
                personales, puedes contactar con nosotros en:
              </p>
              <ul className="list-none pl-0 space-y-1 mt-2">
                <li><strong>Email:</strong> contacto@trainingtrack.com</li>
                <li><strong>Direccion:</strong> Alicante, Espana</li>
              </ul>
            </section>

          </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
