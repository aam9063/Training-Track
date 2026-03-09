import { H2, H3, P, UL, OL, LI, Strong, Blockquote, Img, InternalLink, CTA } from '../components';

export default function Article() {
  return (
    <>
      <P>
        <Strong>Strava</Strong> es la red social del running por excelencia: millones de corredores
        registran sus actividades cada día. Pero para un <Strong>entrenador de atletismo</Strong>,
        Strava solo es útil si puede conectar esos datos con la planificación real del entrenamiento.
        En este artículo te explicamos cómo aprovechar Strava como herramienta de seguimiento y
        por qué la integración con una plataforma de gestión multiplica su valor.
      </P>

      <Blockquote>
        "El dato de Strava solo tiene sentido cuando se compara con lo que se planificó.
        Ahí es donde empieza el trabajo del entrenador."
      </Blockquote>

      <H2>¿Qué datos aporta Strava al entrenador?</H2>
      <P>
        Cuando un atleta conecta su cuenta de Strava, cada actividad registrada incluye:
      </P>
      <UL>
        <LI><Strong>Distancia y duración:</Strong> Lo básico, pero fundamental para calcular el volumen semanal.</LI>
        <LI><Strong>Ritmo medio y parciales:</Strong> Permite verificar si el atleta corrió a los ritmos prescritos.</LI>
        <LI><Strong>Frecuencia cardíaca:</Strong> Si usa pulsómetro, se puede analizar en qué{' '}
          <InternalLink to="/blog/zonas-entrenamiento-running">zonas de entrenamiento</InternalLink>{' '}
          pasó el tiempo.
        </LI>
        <LI><Strong>Desnivel acumulado:</Strong> Importante para corredores de trail y cross.</LI>
        <LI><Strong>Cadencia:</Strong> Un indicador técnico que ayuda a detectar fatiga (la cadencia suele bajar cuando el corredor está agotado).</LI>
        <LI><Strong>Mapa GPS:</Strong> Para verificar la ruta y el tipo de terreno.</LI>
      </UL>

      <H2>El problema de usar Strava como única herramienta</H2>
      <P>
        Strava es excelente para registrar actividades, pero tiene limitaciones importantes para
        la gestión del entrenamiento:
      </P>
      <UL>
        <LI>
          <Strong>No tiene planificación:</Strong> No puedes prescribir entrenamientos futuros ni
          crear un plan de temporada con mesociclos.
        </LI>
        <LI>
          <Strong>No calcula ACWR ni TSB:</Strong> No hay métricas de{' '}
          <InternalLink to="/blog/como-interpretar-acwr-carga-entrenamiento">
            control de carga
          </InternalLink>{' '}
          que crucen lo planificado con lo ejecutado.
        </LI>
        <LI>
          <Strong>No tiene RPE:</Strong> Strava tiene "esfuerzo percibido" pero no lo integra con
          las métricas de carga ni genera alertas.
        </LI>
        <LI>
          <Strong>No es una herramienta de comunicación:</Strong> No puedes enviar notas
          específicas a cada atleta sobre su sesión.
        </LI>
        <LI>
          <Strong>No genera informes:</Strong> El entrenador tiene que revisar atleta por atleta,
          actividad por actividad, sin un resumen semanal unificado.
        </LI>
      </UL>

      <H2>Cómo funciona la integración Strava + Training Track</H2>
      <P>
        La integración conecta ambas plataformas para que el dato fluya automáticamente del reloj
        del atleta al dashboard del entrenador. El proceso es:
      </P>
      <OL>
        <LI>
          <Strong>El atleta conecta Strava:</Strong> Desde su perfil en Training Track, autoriza
          la conexión OAuth con Strava. Es un proceso de un click.
        </LI>
        <LI>
          <Strong>Sincronización automática:</Strong> Cada vez que el atleta sube una actividad a
          Strava (al terminar de correr con su reloj GPS), Training Track recibe los datos
          automáticamente via webhook.
        </LI>
        <LI>
          <Strong>Matching con la sesión planificada:</Strong> El sistema busca si hay una sesión
          de entrenamiento planificada para ese día y la marca como completada con los datos reales
          de Strava (distancia, duración, ritmo).
        </LI>
        <LI>
          <Strong>Notificación al atleta:</Strong> El atleta recibe un aviso para que indique su
          RPE y añada notas sobre cómo se sintió.
        </LI>
        <LI>
          <Strong>Análisis del entrenador:</Strong> El coach ve en su dashboard la sesión completada
          con datos reales vs. planificados, actualización del ACWR/TSB y alertas si hay
          discrepancias.
        </LI>
      </OL>

      {/* IMAGEN: Dashboard del entrenador mostrando sesión completada con datos de Strava */}
      <Img
        src="strava-dashboard-entrenador.png"
        alt="Dashboard de Training Track mostrando sesión auto-completada con datos de Strava"
        caption="Las sesiones se completan automáticamente con los datos de Strava, ahorrando tiempo al atleta y al entrenador."
      />

      <H2>Beneficios concretos para el entrenador</H2>

      <H3>Ahorro de tiempo</H3>
      <P>
        Sin integración, el entrenador tiene que preguntar a cada atleta "¿qué hiciste hoy?" y
        registrar los datos manualmente. Con 10-20 atletas, esto consume horas cada semana. La
        sincronización automática elimina esta tarea por completo.
      </P>

      <H3>Datos objetivos vs. percepción</H3>
      <P>
        Un atleta puede decir "corrí suave" pero los datos de Strava mostrar que fue a ritmo de
        umbral. O puede reportar "fue muy duro" cuando los datos muestran ritmos normales, lo que
        indica fatiga acumulada. La combinación de datos objetivos (Strava) + subjetivos (RPE)
        da una imagen completa.
      </P>

      <H3>Detección temprana de problemas</H3>
      <P>
        Si un atleta normalmente corre su rodaje a 5:00/km y de repente aparece a 5:30/km con la
        misma FC, algo ha cambiado. Los informes IA semanales de Training Track detectan estos
        patrones automáticamente y alertan al entrenador.
      </P>

      <H2>Relojes GPS compatibles con Strava</H2>
      <P>
        Prácticamente cualquier reloj GPS del mercado sincroniza con Strava, y por tanto con
        Training Track:
      </P>
      <UL>
        <LI><Strong>Garmin:</Strong> Forerunner 55/165/265/965, Fenix, Enduro (sincronización automática)</LI>
        <LI><Strong>COROS:</Strong> PACE 3, APEX, VERTIX (sincronización automática)</LI>
        <LI><Strong>Polar:</Strong> Vantage, Pacer, Grit X (vía Polar Flow → Strava)</LI>
        <LI><Strong>Suunto:</Strong> Race, Vertical, 9 Peak (vía Suunto App → Strava)</LI>
        <LI><Strong>Apple Watch:</Strong> Con apps como WorkOutDoors o directamente desde Apple Fitness</LI>
      </UL>

      <H2>Configuración paso a paso</H2>
      <OL>
        <LI>El atleta inicia sesión en Training Track</LI>
        <LI>Va a su perfil → "Conectar Strava"</LI>
        <LI>Autoriza el acceso en la ventana de Strava</LI>
        <LI>Las actividades pasadas se sincronizan y las futuras llegarán automáticamente</LI>
        <LI>El entrenador no necesita hacer nada: los datos aparecen en su dashboard</LI>
      </OL>

      <CTA text="Conecta Strava y automatiza el seguimiento de tus atletas con Training Track" />
    </>
  );
}
