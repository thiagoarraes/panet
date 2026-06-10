import { useEffect, useRef, useState } from "react";
import { ALFABETO_COMPLETO } from "../../../lib/adedonha.js";

// Sorteio: hexágono com raios girando; a letra "roda" rápido e crava na final.
export function SorteioLetra({ letra }) {
  const [display, setDisplay] = useState(letra);
  const [travado, setTravado] = useState(false);
  const intervaloRef = useRef(null);

  useEffect(() => {
    setTravado(false);
    let ticks = 0;
    intervaloRef.current = setInterval(() => {
      ticks += 1;
      setDisplay(ALFABETO_COMPLETO[Math.floor(Math.random() * ALFABETO_COMPLETO.length)]);
      // Ciclo curto (~1.1s); depois trava e segura a letra bem visível.
      if (ticks >= 12) {
        clearInterval(intervaloRef.current);
        setDisplay(letra);
        setTravado(true);
      }
    }, 90);
    return () => clearInterval(intervaloRef.current);
  }, [letra]);

  return (
    <div className="ade-overlay">
      <div className={`ade-sorteio ${travado ? "travado" : ""}`}>
        <div className="ade-rays" />
        <div className={`ade-hex ${travado ? "travado" : ""}`}>
          <div className="ade-hex-inner">
            <span className={`ade-hex-letra ${travado ? "lock" : "cycling"}`}>{display}</span>
          </div>
        </div>
        <div className="ade-sorteio-label">
          {travado ? <>Letra sorteada: <strong>{letra}</strong></> : "Sorteando..."}
        </div>
      </div>
    </div>
  );
}

// Animação de STOP: hexágono vermelho tremendo + "FULANO GRITOU STOP!".
export function StopAnim({ nome }) {
  return (
    <div className="ade-overlay">
      <div className="ade-stop-anim">
        <div className="ade-stop-face">!</div>
        <div className="ade-stop-anim-text">
          <div className="nome">{nome || "Alguém"}</div>
          <div className="grito">GRITOU STOP!</div>
        </div>
      </div>
    </div>
  );
}
