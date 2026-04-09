import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { HiArrowLeft } from 'react-icons/hi';
import useSEO from '../hooks/useSEO';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

export default function TermsConditions() {
  useSEO({
    title: 'Términos y Condiciones',
    description: 'Términos y condiciones de uso de TrainingTrack. Información sobre planes, suscripciones, pagos, cancelaciones y derechos del usuario.',
    path: '/terminos-y-condiciones',
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
            Términos y Condiciones
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
            Última actualización: 9 de abril de 2026
          </p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">

            {/* 1 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                1. Información general
              </h2>
              <p>
                Los presentes Términos y Condiciones (en adelante, &quot;Términos&quot;) regulan el acceso y uso de la
                plataforma TrainingTrack (en adelante, &quot;la Plataforma&quot; o &quot;el Servicio&quot;), accesible a
                través del sitio web{' '}
                <a
                  href="https://trainingtrack.es"
                  className="text-sky-600 dark:text-sky-400 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  trainingtrack.es
                </a>{' '}
                y sus aplicaciones asociadas.
              </p>
              <ul className="list-none space-y-1 pl-0 mt-3">
                <li><strong>Titular:</strong> Albert Alarcón Martínez</li>
                <li><strong>Correo electrónico:</strong> info@trainingtrack.es</li>
                <li><strong>Domicilio:</strong> Alicante, España</li>
                <li><strong>Sitio web:</strong> https://trainingtrack.es</li>
              </ul>
              <p className="mt-3">
                TrainingTrack es una plataforma SaaS de planificación y seguimiento de entrenamientos deportivos,
                diseñada para entrenadores de atletismo y atletas independientes. Ofrece herramientas de
                planificación, métricas de rendimiento, comunicación, integración con dispositivos deportivos
                y funcionalidades basadas en inteligencia artificial.
              </p>
              <p className="mt-2">
                Al registrarte y utilizar la Plataforma, aceptas íntegramente estos Términos. Si no estás de acuerdo
                con alguna de sus condiciones, no debes utilizar el Servicio.
              </p>
            </section>

            {/* 2 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                2. Definiciones
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Usuario:</strong> toda persona física que se registra y utiliza la Plataforma, ya sea
                  como entrenador o como atleta.
                </li>
                <li>
                  <strong>Suscripción:</strong> contrato de acceso recurrente a las funcionalidades de pago de la
                  Plataforma, con renovación automática mensual o anual.
                </li>
                <li>
                  <strong>Plan:</strong> cada una de las modalidades de acceso disponibles (Free, Pro, Team, Premium),
                  con diferentes niveles de funcionalidad y precio.
                </li>
                <li>
                  <strong>Período de facturación:</strong> intervalo de tiempo (mensual o anual) durante el cual se
                  cobra la suscripción y se presta el servicio correspondiente.
                </li>
                <li>
                  <strong>Período de prueba:</strong> plazo de 14 días naturales durante el cual el Usuario puede
                  acceder a todas las funcionalidades de pago sin coste alguno.
                </li>
                <li>
                  <strong>Contenido:</strong> cualquier dato, texto, imagen, archivo o información introducida por
                  el Usuario en la Plataforma.
                </li>
              </ul>
            </section>

            {/* 3 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                3. Registro y cuenta
              </h2>
              <p>
                Para utilizar la Plataforma es necesario crear una cuenta de usuario. Al registrarte, te comprometes a:
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>Proporcionar información veraz, exacta y actualizada.</li>
                <li>Mantener la confidencialidad de tus credenciales de acceso (correo y contraseña).</li>
                <li>No compartir tu cuenta con terceros.</li>
                <li>Notificar de inmediato cualquier uso no autorizado de tu cuenta.</li>
                <li>Ser mayor de 14 años. Los menores de 14 años requieren autorización de su padre, madre o tutor legal.</li>
              </ul>
              <p className="mt-3">
                TrainingTrack se reserva el derecho de suspender o cancelar cuentas que proporcionen información falsa,
                violen estos Términos o realicen un uso abusivo de la Plataforma.
              </p>
            </section>

            {/* 4 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                4. Planes y precios
              </h2>
              <p>
                TrainingTrack ofrece los siguientes planes de suscripción:
              </p>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm border border-gray-200 dark:border-[#2A2A2A]">
                  <thead className="bg-gray-50 dark:bg-[#141414]">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-[#2A2A2A]">Plan</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-[#2A2A2A]">Dirigido a</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-[#2A2A2A]">Precio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-[#2A2A2A]">
                    <tr>
                      <td className="px-4 py-2 font-medium">Free</td>
                      <td className="px-4 py-2">Entrenadores y atletas</td>
                      <td className="px-4 py-2">Gratuito</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-medium">Pro</td>
                      <td className="px-4 py-2">Entrenadores</td>
                      <td className="px-4 py-2">Consultar en la página de precios</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-medium">Team</td>
                      <td className="px-4 py-2">Entrenadores (equipos)</td>
                      <td className="px-4 py-2">Consultar en la página de precios</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-medium">Premium</td>
                      <td className="px-4 py-2">Atletas independientes</td>
                      <td className="px-4 py-2">Consultar en la página de precios</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3">
                Los precios vigentes están disponibles en la{' '}
                <Link to="/pricing" className="text-sky-600 dark:text-sky-400 underline">
                  página de precios
                </Link>
                . Todos los precios incluyen los impuestos aplicables (IVA). TrainingTrack se reserva el derecho
                de modificar los precios, notificando a los usuarios con al menos 30 días de antelación.
              </p>
            </section>

            {/* 5 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                5. Suscripciones y pagos
              </h2>
              <p>
                Los pagos se procesan a través de <strong>Stripe, Inc.</strong>, un procesador de pagos certificado
                PCI DSS Nivel 1. TrainingTrack no almacena ni tiene acceso a los datos completos de tu tarjeta bancaria.
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-3">
                <li>
                  Las suscripciones se cobran de forma recurrente (mensual o anual) según el plan seleccionado.
                </li>
                <li>
                  El cobro se realiza automáticamente al inicio de cada período de facturación.
                </li>
                <li>
                  La suscripción se renueva automáticamente salvo que el Usuario la cancele antes de la fecha de renovación.
                </li>
                <li>
                  Todos los precios incluyen los impuestos aplicables.
                </li>
                <li>
                  En caso de que el cobro falle, TrainingTrack podrá reintentar el pago durante un período razonable
                  antes de suspender el acceso a las funcionalidades de pago.
                </li>
              </ul>
              <p className="mt-3">
                Para más información sobre cómo Stripe gestiona tus datos de pago, consulta la{' '}
                <a
                  href="https://stripe.com/privacy"
                  className="text-sky-600 dark:text-sky-400 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Política de Privacidad de Stripe
                </a>.
              </p>
            </section>

            {/* 6 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                6. Período de prueba
              </h2>
              <p>
                TrainingTrack ofrece un período de prueba gratuito de <strong>14 días naturales</strong> para los
                planes de pago, con las siguientes condiciones:
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>El período de prueba otorga acceso completo a todas las funcionalidades del plan seleccionado.</li>
                <li>No se requiere introducir datos de tarjeta de crédito para iniciar la prueba.</li>
                <li>Al finalizar el período de prueba, el Usuario podrá elegir contratar un plan de pago o
                  continuar con el plan Free con funcionalidades limitadas.</li>
                <li>Si el Usuario no realiza ninguna acción al expirar la prueba, su cuenta pasará automáticamente
                  al plan Free.</li>
                <li>El período de prueba solo se ofrece una vez por usuario.</li>
              </ul>
            </section>

            {/* 7 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                7. Cancelación y cambio de plan
              </h2>
              <p>
                El Usuario puede gestionar su suscripción en cualquier momento desde la configuración de su cuenta:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>
                  <strong>Cancelación:</strong> puedes cancelar tu suscripción en cualquier momento. Mantendrás el
                  acceso a las funcionalidades de pago hasta el final del período de facturación en curso. No se
                  realizarán cobros adicionales tras la cancelación.
                </li>
                <li>
                  <strong>Cambio a un plan superior (upgrade):</strong> el cambio se aplica de forma inmediata. Se
                  prorrateará el importe restante del período actual y se cobrará la diferencia.
                </li>
                <li>
                  <strong>Cambio a un plan inferior (downgrade):</strong> el cambio se hará efectivo al inicio del
                  siguiente período de facturación. Hasta entonces, conservarás las funcionalidades del plan actual.
                </li>
                <li>
                  <strong>Conservación de datos:</strong> en caso de cancelación o downgrade, tus datos se conservan
                  en la Plataforma. Si vuelves a contratar un plan de pago, podrás acceder de nuevo a todas tus
                  métricas y contenido histórico.
                </li>
              </ul>
            </section>

            {/* 8 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                8. Derecho de desistimiento
              </h2>
              <p>
                De conformidad con el artículo 103 del Real Decreto Legislativo 1/2007 y la Directiva 2011/83/UE,
                el Usuario consumidor tiene derecho a desistir del contrato en un plazo de{' '}
                <strong>14 días naturales</strong> desde la fecha de contratación del servicio, sin necesidad de
                justificación y sin penalización alguna.
              </p>
              <p className="mt-3">
                No obstante, si el Usuario consiente expresamente el inicio inmediato de la prestación del servicio
                durante el período de desistimiento y reconoce que perderá su derecho de desistimiento una vez que
                el servicio haya sido completamente ejecutado, el derecho de desistimiento quedará excluido.
              </p>
              <p className="mt-3">
                En el momento de la contratación, se solicitará al Usuario su consentimiento expreso para el inicio
                inmediato del servicio mediante la aceptación de la siguiente declaración:
              </p>
              <div className="bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] rounded-lg p-4 mt-3 italic">
                &quot;Solicito expresamente que el servicio comience de forma inmediata y reconozco que, una vez
                el servicio haya sido completamente prestado, perderé mi derecho de desistimiento.&quot;
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2">
                Modelo de formulario de desistimiento
              </h3>
              <div className="bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#2A2A2A] rounded-lg p-4 mt-2">
                <p className="font-medium text-gray-900 dark:text-white mb-2">
                  A la atención de Albert Alarcón Martínez — TrainingTrack:
                </p>
                <ul className="list-none pl-0 space-y-2 text-sm">
                  <li>Por la presente comunico que desisto del contrato de prestación del siguiente servicio:</li>
                  <li>Servicio contratado: ___________________________</li>
                  <li>Fecha de contratación: ___________________________</li>
                  <li>Nombre del consumidor: ___________________________</li>
                  <li>Correo electrónico: ___________________________</li>
                  <li>Fecha: ___________________________</li>
                  <li>Firma (solo en caso de comunicación en papel): ___________________________</li>
                </ul>
                <p className="text-sm mt-3">
                  Enviar a: <a href="mailto:info@trainingtrack.es" className="text-sky-600 dark:text-sky-400 underline">info@trainingtrack.es</a>
                </p>
              </div>
              <p className="mt-3">
                En caso de ejercer el derecho de desistimiento, TrainingTrack reembolsará todos los pagos recibidos
                en un plazo máximo de 14 días naturales desde la recepción de la comunicación de desistimiento,
                utilizando el mismo medio de pago empleado en la transacción original.
              </p>
            </section>

            {/* 9 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                9. Reembolsos
              </h2>
              <p>
                Con carácter general, <strong>no se realizan reembolsos parciales</strong> por períodos de
                facturación no consumidos. Al cancelar una suscripción, el Usuario mantiene el acceso hasta el
                final del período de facturación en curso.
              </p>
              <p className="mt-3">
                Se contemplan las siguientes excepciones:
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>
                  <strong>Errores de cobro:</strong> si se ha producido un cobro duplicado o erróneo, se procederá
                  al reembolso íntegro del importe incorrecto.
                </li>
                <li>
                  <strong>Servicio no prestado:</strong> si, por causa imputable a TrainingTrack, el servicio no ha
                  podido prestarse durante un período significativo, se valorará el reembolso proporcional.
                </li>
              </ul>
              <p className="mt-3">
                Para solicitar un reembolso, contacta con nosotros en{' '}
                <a href="mailto:info@trainingtrack.es" className="text-sky-600 dark:text-sky-400 underline">
                  info@trainingtrack.es
                </a>{' '}
                indicando el motivo y los datos de la transacción.
              </p>
            </section>

            {/* 10 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                10. Uso aceptable
              </h2>
              <p>
                Al utilizar la Plataforma, el Usuario se compromete a no realizar las siguientes acciones:
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>Enviar spam, mensajes masivos no solicitados o contenido publicitario no autorizado.</li>
                <li>Realizar scraping, crawling o extracción automatizada de datos de la Plataforma.</li>
                <li>Compartir las credenciales de acceso de su cuenta con terceros.</li>
                <li>Intentar acceder a cuentas, datos o sistemas ajenos sin autorización.</li>
                <li>Utilizar la Plataforma para actividades ilegales o que vulneren derechos de terceros.</li>
                <li>Introducir código malicioso, virus o cualquier elemento que pueda dañar la Plataforma.</li>
                <li>Sobrecargar intencionadamente los servidores o la infraestructura del Servicio.</li>
                <li>Revender, sublicenciar o redistribuir el acceso a la Plataforma sin autorización.</li>
              </ul>
              <p className="mt-3">
                El incumplimiento de estas normas podrá dar lugar a la suspensión o cancelación de la cuenta
                sin derecho a reembolso, sin perjuicio de las acciones legales que pudieran corresponder.
              </p>
            </section>

            {/* 11 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                11. Propiedad intelectual
              </h2>
              <p>
                Todo el contenido de la Plataforma (diseño, código fuente, logotipos, textos, gráficos,
                algoritmos de inteligencia artificial y demás elementos) es propiedad de TrainingTrack o de sus
                licenciantes, y está protegido por la legislación española e internacional sobre propiedad
                intelectual e industrial.
              </p>
              <p className="mt-3">
                Queda prohibida la reproducción, distribución, comunicación pública o transformación de
                cualquier elemento de la Plataforma sin autorización expresa y por escrito de TrainingTrack.
              </p>
              <p className="mt-3">
                <strong>Contenido del Usuario:</strong> los datos, planes de entrenamiento, métricas y demás
                contenido introducido por el Usuario en la Plataforma son y seguirán siendo propiedad del
                Usuario. TrainingTrack únicamente los utiliza para prestar el Servicio contratado. El Usuario
                otorga a TrainingTrack una licencia limitada, no exclusiva y revocable para almacenar y procesar
                dicho contenido con el fin de operar la Plataforma.
              </p>
            </section>

            {/* 12 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                12. Limitación de responsabilidad
              </h2>
              <p>
                La Plataforma se ofrece &quot;tal cual&quot; (<em>as is</em>) y &quot;según disponibilidad&quot;
                (<em>as available</em>). TrainingTrack no garantiza:
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>La disponibilidad ininterrumpida del Servicio (100% uptime).</li>
                <li>La ausencia total de errores o vulnerabilidades.</li>
                <li>Que los resultados obtenidos mediante las herramientas de IA sean exactos o completos.</li>
                <li>La compatibilidad con todos los dispositivos o navegadores.</li>
              </ul>
              <p className="mt-3">
                TrainingTrack no será responsable de los daños indirectos, incidentales, especiales o consecuentes
                derivados del uso o la imposibilidad de uso del Servicio, incluyendo pero no limitándose a:
                pérdida de datos, pérdida de beneficios, interrupción de la actividad deportiva o lesiones
                derivadas del seguimiento de planes de entrenamiento generados por la Plataforma.
              </p>
              <p className="mt-3">
                <strong>Los planes de entrenamiento, informes de IA y recomendaciones de la Plataforma tienen
                carácter orientativo y no sustituyen el asesoramiento profesional de un médico, fisioterapeuta
                o entrenador cualificado.</strong>
              </p>
              <p className="mt-3">
                En todo caso, la responsabilidad máxima de TrainingTrack se limitará al importe total abonado
                por el Usuario durante los 12 meses anteriores al hecho causante.
              </p>
            </section>

            {/* 13 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                13. Modificaciones de los Términos
              </h2>
              <p>
                TrainingTrack se reserva el derecho de modificar estos Términos y Condiciones en cualquier
                momento. Las modificaciones serán notificadas a los usuarios con un mínimo de{' '}
                <strong>30 días naturales de antelación</strong> a través de:
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>Correo electrónico a la dirección asociada a la cuenta del usuario.</li>
                <li>Aviso visible dentro de la Plataforma.</li>
              </ul>
              <p className="mt-3">
                El uso continuado de la Plataforma tras la entrada en vigor de las modificaciones implica la
                aceptación de los nuevos Términos. Si el Usuario no está de acuerdo con los cambios, podrá
                cancelar su suscripción antes de que estos entren en vigor.
              </p>
            </section>

            {/* 14 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                14. Ley aplicable y jurisdicción
              </h2>
              <p>
                Estos Términos se rigen por la <strong>legislación española</strong>. Para la resolución de
                cualquier controversia derivada de la interpretación o cumplimiento de estos Términos, las partes
                se someten a los <strong>Juzgados y Tribunales de Alicante</strong>, salvo que la normativa de
                protección al consumidor establezca un fuero distinto.
              </p>
              <p className="mt-3">
                No obstante, conforme al Reglamento (UE) 524/2013, informamos de que la Comisión Europea pone a
                disposición de los consumidores una plataforma de resolución de litigios en línea, accesible en:{' '}
                <a
                  href="https://ec.europa.eu/consumers/odr"
                  className="text-sky-600 dark:text-sky-400 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://ec.europa.eu/consumers/odr
                </a>.
              </p>
            </section>

            {/* 15 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                15. Contacto
              </h2>
              <p>
                Para cualquier consulta relacionada con estos Términos y Condiciones, puedes contactar con
                nosotros en:
              </p>
              <ul className="list-none pl-0 space-y-1 mt-2">
                <li><strong>Email:</strong>{' '}
                  <a href="mailto:info@trainingtrack.es" className="text-sky-600 dark:text-sky-400 underline">
                    info@trainingtrack.es
                  </a>
                </li>
                <li><strong>Titular:</strong> Albert Alarcón Martínez</li>
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
