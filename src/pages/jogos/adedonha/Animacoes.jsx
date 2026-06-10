import { useEffect, useRef, useState } from "react";
import { ALFABETO_COMPLETO } from "../../../lib/adedonha.js";

const CORES_BURST = ["#ff5fa2", "#ffc83d", "#8b5cf6", "#22d3ee", "#a3e635", "#ff8a3d"];

// Explosão de confete radial (usada no lock do sorteio e no slam do STOP).
function Burst({ cores = CORES_BURST, n = 14 }) {
  return (
    <div className="ade-burst" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          style={{
            "--a": `${(360 / n) * i}deg`,
            "--d": `${130 + (i % 3) * 45}px`,
            "--c": cores[i % cores.length],
            "--t": `${0.55 + (i % 4) * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}

// Sorteio: slot machine de letras girando; trava com punch + confete + shockwave.
export function SorteioLetra({ letra }) {
  const [estado, setEstado] = useState({ letra, n: 0 });
  const [travado, setTravado] = useState(false);
  const intervaloRef = useRef(null);

  useEffect(() => {
    setTravado(false);
    let ticks = 0;
    intervaloRef.current = setInterval(() => {
      ticks += 1;
      setEstado({
        letra: ALFABETO_COMPLETO[Math.floor(Math.random() * ALFABETO_COMPLETO.length)],
        n: ticks,
      });
      // Ciclo curto (~1.1s); depois trava e segura a letra bem visível.
      if (ticks >= 12) {
        clearInterval(intervaloRef.current);
        setEstado({ letra, n: ticks + 1 });
        setTravado(true);
      }
    }, 90);
    return () => clearInterval(intervaloRef.current);
  }, [letra]);

  return (
    <div className="ade-overlay">
      <div className={`ade-sorteio ${travado ? "travado" : ""}`}>
        <div className="ade-rays" />
        {travado && <div className="ade-shockwave" />}
        {travado && <Burst />}
        <div className={`ade-hex ${travado ? "travado" : ""}`}>
          <div className="ade-hex-inner">
            <span
              key={estado.n}
              className={`ade-hex-letra ${travado ? "lock" : "cycling"}`}
            >
              {estado.letra}
            </span>
          </div>
        </div>
        <div className="ade-sorteio-label">
          {travado ? <>Letra sorteada: <strong>{letra}</strong></> : "Sorteando..."}
        </div>
      </div>
    </div>
  );
}

// STOP: placa octogonal entra com slam + shockwave + confete + screen shake.
export function StopAnim({ nome }) {
  return (
    <div className="ade-overlay ade-overlay-shake">
      <div className="ade-stop-anim">
        <div className="ade-stop-scene">
          <div className="ade-shockwave vermelho" />
          <Burst cores={["#ff5573", "#ffc83d", "#ff8a3d", "#fff"]} n={12} />
          <div className="ade-stop-face">STOP</div>
        </div>
        <div className="ade-stop-anim-text">
          <div className="nome">{nome || "Alguém"}</div>
          <div className="grito">GRITOU STOP!</div>
        </div>
      </div>
    </div>
  );
}
