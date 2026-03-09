import { H2, H3, P, UL, OL, LI, Strong, Blockquote, Img, InternalLink, CTA } from '../components';

export default function Article() {
  return (
    <>
      <P>
        El <Strong>ACWR (Acute:Chronic Workload Ratio)</Strong> es una de las métricas más potentes
        para prevenir lesiones y optimizar el rendimiento en running. Junto con el{' '}
        <Strong>TSB (Training Stress Balance)</Strong>, permite al entrenador saber si un atleta
        está en la zona óptima de carga o si se está acercando al sobreentrenamiento. En este
        artículo te explicamos cómo interpretar ambas métricas y aplicarlas en tu día a día.
      </P>

      <Blockquote>
        "No es cuánto entrenas lo que te lesiona, sino cuánto más entrenas respecto a lo que tu
        cuerpo está acostumbrado."
      </Blockquote>

      <H2>¿Qué es el ACWR?</H2>
      <P>
        El ACWR compara la carga de entrenamiento de la última semana (carga aguda) con la media
        de las últimas 4 semanas (carga crónica). El resultado es un ratio que indica si el atleta
        está entrenando más, menos o igual que su media reciente.
      </P>
      <P>
        La fórmula es simple: <Strong>ACWR = Carga aguda (7 días) ÷ Carga crónica (28 días)</Strong>.
        La "carga" puede calcularse de varias formas: kilómetros, duración, RPE × duración (sRPE),
        o Training Impulse (TRIMP).
      </P>

      <H2>Interpretación del ACWR</H2>
      <P>
        Los rangos de referencia, basados en la investigación de Tim Gabbett y otros:
      </P>
      <UL>
        <LI>
          <Strong>ACWR {'<'} 0.8 (infracarga):</Strong> El atleta entrena significativamente menos
          que su media. Puede ocurrir en semanas de descanso (bien) o por inactividad no planificada
          (mal). Un ACWR bajo prolongado reduce la "aptitud" del atleta.
        </LI>
        <LI>
          <Strong>ACWR 0.8 – 1.3 (zona óptima):</Strong> La carga actual está en proporción con
          lo que el atleta ha hecho en el último mes. Es la zona donde se producen adaptaciones sin
          riesgo excesivo de lesión. El "sweet spot" del entrenamiento.
        </LI>
        <LI>
          <Strong>ACWR {'>'} 1.3 (zona de peligro):</Strong> La carga aguda supera con creces la
          crónica. Esto ocurre cuando se sube el volumen o la intensidad demasiado rápido. El riesgo
          de lesión se dispara, especialmente por encima de 1.5.
        </LI>
      </UL>

      <H3>Matices importantes del ACWR</H3>
      <P>
        El ACWR no es una regla absoluta. Hay contexto que importa:
      </P>
      <UL>
        <LI>
          Un ACWR de 1.4 en una semana de competición puede ser aceptable si el atleta tiene buena
          base crónica.
        </LI>
        <LI>
          Un ACWR de 0.9 puede ser peligroso si la carga crónica ya era excesiva de por sí.
        </LI>
        <LI>
          Los atletas con mayor carga crónica toleran mejor picos agudos (el efecto protector de la
          forma física).
        </LI>
      </UL>

      <H2>¿Qué es el TSB (Training Stress Balance)?</H2>
      <P>
        El TSB mide el equilibrio entre la <Strong>forma física</Strong> (CTL - Chronic Training Load)
        y la <Strong>fatiga</Strong> (ATL - Acute Training Load). Es un indicador de "frescura":
      </P>
      <P>
        <Strong>TSB = CTL - ATL</Strong>
      </P>
      <UL>
        <LI>
          <Strong>TSB positivo:</Strong> El atleta está más descansado que en forma. Ideal para
          competir (entre +10 y +25 para el día de carrera).
        </LI>
        <LI>
          <Strong>TSB cercano a 0:</Strong> Equilibrio entre forma y fatiga. Zona productiva de
          entrenamiento.
        </LI>
        <LI>
          <Strong>TSB negativo:</Strong> Más fatiga que forma. Normal durante bloques de carga,
          pero si es muy negativo (por debajo de -20) durante mucho tiempo, hay riesgo de
          sobreentrenamiento.
        </LI>
      </UL>

      {/* IMAGEN: Dashboard de Training Track mostrando métricas ACWR y TSB */}
      <Img
        src="acwr-dashboard.png"
        alt="Panel de métricas de Training Track mostrando ACWR y TSB de un atleta"
        caption="Training Track calcula automáticamente el ACWR y TSB de cada atleta a partir de sus sesiones."
      />

      <H2>Cómo usar ACWR y TSB en la práctica</H2>

      <H3>Regla del 10%</H3>
      <P>
        La recomendación clásica de no aumentar más de un 10% semanal se alinea con mantener el
        ACWR por debajo de 1.3. Si un atleta corre 40 km esta semana, la siguiente no debería
        superar los 44 km. Esto es especialmente importante al volver de una lesión o período de
        inactividad, donde la carga crónica es baja.
      </P>

      <H3>Semanas de descarga</H3>
      <P>
        Cada 3-4 semanas se programa una semana de descarga (reducción del 30-40% del volumen).
        Esto permite que el TSB suba temporalmente, reduciendo la fatiga acumulada. El ACWR bajará
        a 0.6-0.7, lo cual es intencional y saludable.
      </P>

      <H3>Tapering pre-competición</H3>
      <P>
        En las 2-3 semanas antes de una competición importante, se reduce progresivamente la carga
        para que el TSB suba a territorio positivo. Un buen tapering lleva el TSB a +10/+25 el día
        de la carrera, con el atleta descansado pero sin perder forma.
      </P>

      <H2>RPE: el complemento subjetivo del ACWR</H2>
      <P>
        El <Strong>RPE (Rate of Perceived Exertion)</Strong> añade la dimensión subjetiva que las
        métricas objetivas no capturan. Un atleta puede tener un ACWR de 1.0 pero reportar un RPE
        de 9 en una sesión que normalmente sería un 6. Esto indica fatiga oculta que no aparece en
        los kilómetros.
      </P>
      <P>
        En Training Track, cada atleta registra su RPE después de cada sesión. Los informes IA
        semanales cruzan automáticamente el ACWR, TSB y RPE para detectar señales de alerta
        temprana y recomendar ajustes al entrenador.
      </P>

      <H2>Errores comunes al usar estas métricas</H2>
      <OL>
        <LI>
          <Strong>Obsesionarse con el número:</Strong> El ACWR es una guía, no una ley. Un atleta
          con años de experiencia y buena base puede tolerar valores que serían peligrosos para un
          principiante.
        </LI>
        <LI>
          <Strong>No considerar la intensidad:</Strong> 50 km en zona 2 no es lo mismo que 50 km
          con 15 km de series. Usar sRPE (duración × RPE) en vez de solo kilómetros da una imagen
          más fiel de la carga real.
        </LI>
        <LI>
          <Strong>Reaccionar tarde:</Strong> El ACWR es una herramienta preventiva. Cuando ya hay
          dolor o bajón de rendimiento, probablemente el daño está hecho. Revisa las métricas cada
          semana, no cuando aparecen los problemas.
        </LI>
      </OL>

      <CTA text="Monitoriza el ACWR, TSB y RPE de tus atletas automáticamente con Training Track" />
    </>
  );
}
