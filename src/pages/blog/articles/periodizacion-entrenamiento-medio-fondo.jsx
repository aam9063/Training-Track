import { H2, H3, P, UL, OL, LI, Strong, Blockquote, Img, InternalLink, CTA } from '../components';

export default function Article() {
  return (
    <>
      <P>
        La <Strong>periodización del entrenamiento en medio fondo</Strong> es la piedra angular de
        cualquier programa serio para atletas de 800m a 5000m. Sin una estructura clara de mesociclos
        y microciclos, es imposible llevar a un corredor a su máximo potencial de forma sostenible.
        En este artículo te explicamos cómo planificar cada fase del entrenamiento para optimizar
        el rendimiento.
      </P>

      <H2>¿Qué es la periodización del entrenamiento?</H2>
      <P>
        La periodización es la división sistemática del plan de entrenamiento anual en períodos más
        pequeños y manejables. Cada período tiene objetivos específicos que, combinados, llevan al
        atleta a su pico de rendimiento en el momento adecuado, normalmente coincidiendo con las
        competiciones principales de la temporada.
      </P>

      <Blockquote>
        "El éxito en medio fondo no se construye en una semana. Se construye con meses de trabajo
        progresivo y bien planificado."
      </Blockquote>

      <Img
        src="periodizacion-pista.png"
        alt="Atletas entrenando en pista de atletismo"
        caption="La periodización permite llevar al atleta a su pico de rendimiento en el momento justo."
      />

      <H2>Estructura de un macrociclo para medio fondo</H2>
      <P>Un macrociclo típico en medio fondo se divide en cuatro fases fundamentales:</P>
      <UL>
        <LI>
          <Strong>Fase de base (8-12 semanas):</Strong> Construcción aeróbica, volumen progresivo y
          fortalecimiento general. Es el cimiento sobre el que se construye todo lo demás. En esta
          fase es clave complementar con{' '}
          <InternalLink to="/blog/importancia-fuerza-corredores-fondo">
            trabajo de fuerza en gimnasio
          </InternalLink>.
        </LI>
        <LI>
          <Strong>Fase específica (6-8 semanas):</Strong> Trabajo a ritmos de competición, series
          largas y transición a intensidad. Se empieza a moldear el rendimiento.
        </LI>
        <LI>
          <Strong>Fase de competición (4-6 semanas):</Strong> Reducción de volumen, afinamiento y
          máxima especificidad. El atleta debe sentirse fresco y rápido.
        </LI>
        <LI>
          <Strong>Fase de transición (2-4 semanas):</Strong> Recuperación activa y regeneración.
          Fundamental para evitar el sobreentrenamiento.
        </LI>
      </UL>

      <H2>El microciclo semanal</H2>
      <P>
        Dentro de cada mesociclo, la semana es la unidad operativa. Un microciclo bien diseñado
        alterna estímulos de carga y recuperación para maximizar las adaptaciones. Para definir
        las intensidades de cada sesión, es fundamental conocer los{' '}
        <InternalLink to="/blog/test-conconi-ritmos-entrenamiento">
          ritmos de entrenamiento mediante el test de Conconi
        </InternalLink>.
      </P>
      <UL>
        <LI><Strong>Lunes:</Strong> Recuperación o descanso total</LI>
        <LI><Strong>Martes:</Strong> Series de calidad (intervalos, repeticiones)</LI>
        <LI><Strong>Miércoles:</Strong> Rodaje suave + gimnasio</LI>
        <LI><Strong>Jueves:</Strong> Tempo o fartlek</LI>
        <LI><Strong>Viernes:</Strong> Rodaje regenerativo</LI>
        <LI><Strong>Sábado:</Strong> Sesión larga o competición</LI>
        <LI><Strong>Domingo:</Strong> Rodaje suave o descanso</LI>
      </UL>

      <H3>Principios clave del microciclo</H3>
      <OL>
        <LI>Nunca colocar dos sesiones de alta intensidad en días consecutivos</LI>
        <LI>La sesión larga debe ir seguida de un día suave o descanso</LI>
        <LI>El volumen semanal debe progresar un 5-10% como máximo</LI>
        <LI>Cada 3-4 semanas incluir una semana de descarga (reducción del 30-40%)</LI>
      </OL>

      <Img
        src="periodizacion-calendario.png"
        alt="Calendario de planificación de entrenamiento semanal"
        caption="Un microciclo bien diseñado alterna estímulos de carga y recuperación."
      />

      <H2>Herramientas para planificar el entrenamiento</H2>
      <P>
        Con Training Track, los entrenadores pueden crear mesociclos, asignar tipos de semana
        (carga, descarga, competición) y planificar cada sesión con ejercicios específicos del banco
        de ejercicios. Todo desde una interfaz visual e intuitiva que permite ver el panorama
        completo del entrenamiento.
      </P>
      <P>
        La plataforma calcula automáticamente la carga de entrenamiento y permite ajustar sobre la
        marcha según la respuesta del atleta, facilitando la toma de decisiones basada en datos
        reales.
      </P>

      <CTA text="Planifica mesociclos y microciclos para tus atletas con Training Track" />
    </>
  );
}
