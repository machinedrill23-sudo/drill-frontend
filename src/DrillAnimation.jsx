// src/DrillAnimation.jsx
import React, { useEffect, useRef } from "react";

export default function DrillAnimation({ rpm = 0, temp = 20, vibration = 0 }) {
  const drillRef = useRef();

  useEffect(() => {
    let frame;
    const animate = () => {
      if (drillRef.current) {
        // Rotate proportional to RPM
        drillRef.current.style.transform = `rotate(${Date.now() * (rpm / 60) * 0.1}deg)`;

        // Color changes with temp
        if (temp > 70) drillRef.current.style.background = "red";
        else if (temp > 40) drillRef.current.style.background = "orange";
        else drillRef.current.style.background = "steelblue";

        // Vibrate with CSS transform
        const vibX = Math.sin(Date.now() / 50) * vibration * 0.5;
        const vibY = Math.cos(Date.now() / 50) * vibration * 0.5;
        drillRef.current.style.marginLeft = `${vibX}px`;
        drillRef.current.style.marginTop = `${vibY}px`;
      }
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, [rpm, temp, vibration]);

  return (
    <div style={styles.container}>
      <div ref={drillRef} style={styles.drill}></div>
      <div style={styles.labels}>
        <p><strong>Temp:</strong> {temp} °C</p>
        <p><strong>RPM:</strong> {rpm}</p>
        <p><strong>Vibration:</strong> {vibration} m/s²</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: "20px"
  },
  drill: {
    width: "60px",
    height: "120px",
    background: "steelblue",
    borderRadius: "12px",
    transition: "background 0.3s ease",
  },
  labels: {
    marginTop: "10px",
    textAlign: "center",
    fontSize: "14px",
    color: "#333"
  }
};
