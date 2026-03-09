import { H2, H3, P, UL, OL, LI, Strong, Blockquote, Img, InternalLink, CTA } from '../components';

export default function Article() {
  return (
    <>
      <P>
        La <Strong>media maratón</Strong> es la distancia perfecta: lo bastante larga para exigir una
        preparación seria, lo bastante corta para permitir competir varias veces al año. Un buen
        <Strong> plan de entrenamiento para media maratón</Strong> combina volumen, trabajo de umbral
        y una estrategia de carrera inteligente. En esta guía te mostramos cómo estructurarlo paso a
        paso.
      </P>

      <Blockquote>
        "La media maratón es la competición que mejor refleja tu nivel de forma aeróbica. No hay
        donde esconderse durante 21 kilómetros."
      </Blockquote>

      <H2>¿Cuántas semanas necesito para preparar una media maratón?</H2>
      <P>
        Depende de tu nivel de partida. Como referencia general:
      </P>
      <UL>
        <LI><Strong>Corredor principiante</Strong> (menos de 30 km/semana): 16-20 semanas</LI>
        <LI><Strong>Corredor intermedio</Strong> (30-50 km/semana): 12-16 semanas</LI>
        <LI><Strong>Corredor avanzado</Strong> (más de 50 km/semana): 8-12 semanas</LI>
      </UL>
      <P>
        Estos plazos asumen que ya tienes una base de carrera continua. Si partes de cero, necesitarás
        primero un período de adaptación de 8-12 semanas corriendo 3-4 días por semana antes de
        empezar el plan específico.
      </P>

      {/* IMAGEN: Corredores en una media maratón popular */}
      <Img
        src="media-maraton-carrera.png"
        alt="Corredores participando en una media maratón popular"
        caption="La media maratón es la distancia más popular en España, con carreras en prácticamente todas las ciudades."
      />

      <H2>Estructura del plan de entrenamiento</H2>
      <P>
        Un plan de media maratón de 12 semanas se divide en tres fases, siguiendo los principios de{' '}
        <InternalLink to="/blog/periodizacion-entrenamiento-medio-fondo">
          periodización del entrenamiento
        </InternalLink>:
      </P>

      <H3>Fase 1: Base aeróbica (semanas 1-4)</H3>
      <P>
        El objetivo es consolidar la base de kilómetros y acostumbrar al cuerpo a correr con
        frecuencia. El 85-90% del volumen se corre en{' '}
        <InternalLink to="/blog/zonas-entrenamiento-running">zona 2</InternalLink>.
      </P>
      <UL>
        <LI>4-5 días de carrera por semana</LI>
        <LI>1 tirada larga progresiva: de 14 km a 18 km</LI>
        <LI>1 sesión de fartlek suave (cambios de ritmo por sensaciones)</LI>
        <LI>Resto: rodajes en zona 2</LI>
        <LI>1-2 días de gimnasio con{' '}
          <InternalLink to="/blog/importancia-fuerza-corredores-fondo">
            trabajo de fuerza para corredores
          </InternalLink>
        </LI>
      </UL>

      <H3>Fase 2: Específica (semanas 5-9)</H3>
      <P>
        Se introduce el trabajo de umbral, que es la clave de la media maratón. El ritmo de
        competición está muy cerca del umbral anaeróbico, por lo que hay que acostumbrar al cuerpo
        a mantenerlo durante mucho tiempo.
      </P>
      <UL>
        <LI><Strong>Sesión clave 1 — Tempo run:</Strong> 20-40 minutos continuos a ritmo de media maratón</LI>
        <LI><Strong>Sesión clave 2 — Intervalos largos:</Strong> 4-6 × 2000m a ritmo 10K con 2 min recuperación</LI>
        <LI>1 tirada larga: de 18 km a 22 km, últimos 5 km a ritmo objetivo</LI>
        <LI>Rodajes de recuperación entre sesiones clave</LI>
      </UL>

      <H3>Fase 3: Afinamiento / Tapering (semanas 10-12)</H3>
      <P>
        Se reduce el volumen un 30-40% manteniendo la intensidad. El cuerpo asimila todo el trabajo
        acumulado y llega fresco a la competición.
      </P>
      <OL>
        <LI>Semana 10: reducción del 20% del volumen, mantener 1 sesión de tempo corto</LI>
        <LI>Semana 11: reducción del 35%, series cortas a ritmo de 10K</LI>
        <LI>Semana 12: solo rodajes suaves, 2-3 progresivos cortos, descanso pre-carrera</LI>
      </OL>

      <H2>Sesiones clave para la media maratón</H2>

      <H3>Tempo runs</H3>
      <P>
        La sesión más importante para la media maratón. Se trata de correr de 20 a 40 minutos a
        un ritmo controladamente incómodo, alrededor de tu ritmo objetivo de competición o
        ligeramente más lento. Mejora la capacidad de mantener el umbral anaeróbico durante
        períodos prolongados.
      </P>

      <H3>Tirada larga progresiva</H3>
      <P>
        La tirada larga no es solo sumar kilómetros. La versión más efectiva para la media maratón
        es el <Strong>long run progresivo</Strong>: empiezas a ritmo de zona 2 y terminas los
        últimos 4-6 km a ritmo objetivo de carrera. Esto simula la fatiga de competición y entrena
        al cuerpo a mantener el ritmo cuando las piernas pesan.
      </P>

      <H3>Intervalos de umbral</H3>
      <P>
        Series de 1000m a 3000m a ritmo de 10K-15K con recuperaciones cortas (60-90 segundos).
        Ejemplos: 5×2000m (r: 90"), 3×3000m (r: 2'), 8×1000m (r: 60"). Estas sesiones suben
        el techo de rendimiento y hacen que el ritmo de media maratón se sienta más cómodo.
      </P>

      <H2>Errores comunes en la preparación</H2>
      <UL>
        <LI>
          <Strong>Correr las tiradas largas demasiado rápido:</Strong> El 80% de la tirada larga
          debe ser en zona 2. Si vas demasiado fuerte, acumulas fatiga sin mejorar la resistencia.
        </LI>
        <LI>
          <Strong>Saltarse la fase de base:</Strong> Sin una buena base aeróbica, el trabajo
          específico no produce adaptaciones reales y aumenta el riesgo de lesión.
        </LI>
        <LI>
          <Strong>No hacer tapering:</Strong> Muchos corredores llegan agotados a la carrera por
          miedo a perder forma. La reducción de volumen es donde se producen las mejoras finales.
        </LI>
        <LI>
          <Strong>Ignorar el trabajo de fuerza:</Strong> La fuerza protege contra lesiones y mejora
          la economía de carrera, especialmente en los últimos kilómetros.
        </LI>
      </UL>

      <H2>Estrategia de carrera en la media maratón</H2>
      <P>
        El error número uno en media maratón es salir demasiado rápido. Cada segundo que vas más
        rápido de tu ritmo en el primer tercio lo pagas multiplicado en el último tercio.
      </P>
      <OL>
        <LI><Strong>Km 1-7:</Strong> ritmo objetivo o 5-10" más lento, controlar la emoción de la salida</LI>
        <LI><Strong>Km 8-14:</Strong> establecer el ritmo objetivo, mantener constancia</LI>
        <LI><Strong>Km 15-21:</Strong> si te sientes bien, soltar ligeramente; si no, mantener</LI>
      </OL>

      <H2>Planifica tu media maratón con Training Track</H2>
      <P>
        Con Training Track puedes crear un plan de media maratón completo con mesociclos, asignarlo
        a tus atletas y hacer seguimiento semana a semana. El sistema calcula automáticamente el
        ACWR y el TSB para asegurar que la carga es progresiva y segura. Además, los informes IA
        semanales te avisan si algún atleta muestra signos de fatiga acumulada.
      </P>

      <CTA text="Crea planes de media maratón personalizados para tus atletas con Training Track" />
    </>
  );
}
