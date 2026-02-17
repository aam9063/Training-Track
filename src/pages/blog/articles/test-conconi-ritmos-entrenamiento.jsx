import { H2, H3, P, UL, OL, LI, Strong, Blockquote, Img, InternalLink, CTA } from '../components';

export default function Article() {
  return (
    <>
      <P>
        El <Strong>test de Conconi</Strong> es una herramienta fundamental para establecer los{' '}
        <Strong>ritmos de entrenamiento</Strong> basados en frecuencia cardíaca. Desarrollado por
        el Dr. Francesco Conconi en los años 80, permite determinar el umbral anaeróbico de un
        atleta mediante un protocolo incremental en pista. Es una de las pruebas más accesibles
        y fiables para personalizar las zonas de entrenamiento.
      </P>

      <Blockquote>
        "Conocer tu umbral anaeróbico es la diferencia entre entrenar con propósito y entrenar a
        ciegas."
      </Blockquote>

      <H2>¿En qué consiste el test de Conconi?</H2>
      <P>
        El atleta realiza series de 200-400 metros a velocidades progresivamente crecientes mientras
        se registra la frecuencia cardíaca al final de cada repetición. El punto donde la relación
        lineal entre velocidad y FC se rompe (punto de deflexión) indica el umbral anaeróbico.
      </P>
      <P>
        Este punto de deflexión marca la intensidad a partir de la cual el cuerpo empieza a
        acumular ácido láctico más rápido de lo que puede eliminarlo, lo que limita la duración del
        esfuerzo.
      </P>

      <Img
        src="conconi-pulsometro.png"
        alt="Atleta con pulsómetro de banda pectoral en pista de atletismo"
        caption="El registro preciso de la frecuencia cardíaca es clave para la fiabilidad del test."
      />

      <H2>Protocolo del test de Conconi paso a paso</H2>
      <OL>
        <LI>Calentamiento de 15-20 minutos a ritmo suave</LI>
        <LI>Primera serie a ritmo cómodo (aproximadamente 5:30-6:00/km)</LI>
        <LI>Incrementar 2-3 segundos por serie</LI>
        <LI>Registrar FC inmediatamente al finalizar cada serie</LI>
        <LI>Recuperación de 200m trotando entre series</LI>
        <LI>Continuar hasta que el atleta no pueda mantener el ritmo</LI>
      </OL>

      <H3>Consideraciones importantes para el test</H3>
      <UL>
        <LI>Realizar el test en condiciones similares cada vez (temperatura, hora, superficie)</LI>
        <LI>El atleta debe estar descansado (no hacer sesión intensa el día anterior)</LI>
        <LI>Usar un pulsómetro fiable con banda de pecho para mayor precisión</LI>
        <LI>Registrar un mínimo de 10-12 series para obtener datos significativos</LI>
      </UL>

      <H2>Interpretación de los ritmos de entrenamiento</H2>
      <P>
        Con los datos recogidos se construye una gráfica velocidad-FC. El punto de deflexión divide
        las zonas de entrenamiento en tres grandes bloques:
      </P>
      <UL>
        <LI>
          <Strong>Por debajo del umbral (R1-R5):</Strong> Zona aeróbica. Ideal para rodajes,
          recuperación y trabajo de base. El cuerpo utiliza principalmente grasas como fuente de
          energía.
        </LI>
        <LI>
          <Strong>En el umbral (R5-R6):</Strong> Zona de transición. Ritmo de maratón y medio
          maratón. Se trabaja la capacidad de mantener esfuerzos prolongados a alta intensidad.
        </LI>
        <LI>
          <Strong>Por encima del umbral (R7-R10):</Strong> Zona anaeróbica. Intervalos, series
          cortas y trabajo de velocidad. Mejora la potencia y la tolerancia al lactato.
        </LI>
      </UL>
      <P>
        Estos ritmos son la base sobre la que se construye toda la{' '}
        <InternalLink to="/blog/periodizacion-entrenamiento-medio-fondo">
          periodización del entrenamiento
        </InternalLink>{' '}
        de un corredor de medio fondo.
      </P>

      <Img
        src="conconi-grafica.png"
        alt="Gráfica velocidad vs frecuencia cardíaca del test de Conconi"
        caption="El punto de deflexión en la gráfica velocidad-FC indica el umbral anaeróbico."
      />

      <H2>Automatización del test con Training Track</H2>
      <P>
        Nuestra plataforma permite subir los datos del test de Conconi directamente desde un archivo
        Excel. El sistema calcula automáticamente los 11 ritmos de entrenamiento (RR, R1-R10) con
        sus rangos de frecuencia cardíaca asociados.
      </P>
      <P>
        Una vez calculados, estos ritmos se integran directamente en la planificación semanal, de
        modo que el entrenador puede asignar series a los ritmos exactos del atleta. Todo el proceso,
        desde el test hasta la planificación, queda centralizado en una sola herramienta.
      </P>

      <CTA text="Calcula automáticamente los ritmos de entrenamiento de tus atletas" />
    </>
  );
}
