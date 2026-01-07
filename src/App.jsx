import React, { useEffect, useMemo, useRef, useState } from "react";
import { ref, onChildAdded } from "firebase/database";
import { db } from "./firebaseConfig";

// Import images from src/assets/
import drillBit from './assets/drill-bit.png';
import drillBody from './assets/drill-body.png';

// Chart
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
  Filler
} from "chart.js";

ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
  Filler
);

// Helper functions (define them at the top)
function getChartTitle(metric) {
  const titles = {
    temp: 'TEMPERATURE TREND ANALYSIS',
    rpm: 'ROTATIONAL SPEED MONITORING',
    load: 'ELECTRICAL LOAD PROFILE',
    vibration: 'VIBRATION ANALYSIS',
    depth: 'DRILL DEPTH PROGRESSION',
    tempComparison: 'ACTUAL vs ESTIMATED TEMPERATURE',
    torqueComparison: 'TORQUE PERFORMANCE ANALYSIS'
  };
  return titles[metric] || metric.toUpperCase();
}

function getChartButtonLabel(metric) {
  const labels = {
    temp: 'TEMPERATURE',
    rpm: 'RPM',
    load: 'LOAD',
    vibration: 'VIBRATION',
    depth: 'DEPTH',
    tempComparison: 'COMPARISON',
    torqueComparison: 'TORQUE'
  };
  return labels[metric] || metric;
}

function getMetricColor(metric) {
  const colors = {
    temp: '#ef4444',
    rpm: '#6366f1',
    load: '#f59e0b',
    vibration: '#0ea5e9',
    depth: '#8b5cf6',
    tempComparison: '#ec4899',
    torqueComparison: '#10b981'
  };
  return colors[metric] || '#cbd5e1';
}

function getMetricUnit(metric) {
  const units = {
    temp: '°C',
    rpm: 'RPM',
    load: 'A',
    vibration: 'm/s²',
    depth: 'mm',
    tempComparison: '°C',
    torqueComparison: 'Nm'
  };
  return units[metric] || '';
}

function getRULColor(percentage) {
  const colors = {
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444'
  };
  if (percentage >= 70) return colors.success;
  if (percentage >= 40) return colors.warning;
  return colors.danger;
}

function getRULGradient(percentage) {
  const colors = {
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444'
  };
  if (percentage >= 70) return `${colors.success}, ${colors.success}80`;
  if (percentage >= 40) return `${colors.warning}, ${colors.warning}80`;
  return `${colors.danger}, ${colors.danger}80`;
}

// Soft color palette - God level aesthetics
const colors = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  secondary: '#8b5cf6',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#0ea5e9',
  darkBg: '#0f172a',
  cardBg: 'rgba(30, 41, 59, 0.7)',
  glassBg: 'rgba(255, 255, 255, 0.05)',
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  border: '#334155',
  gradientStart: '#6366f1',
  gradientMid: '#8b5cf6',
  gradientEnd: '#ec4899'
};

// Thresholds for alarming
const thresholds = {
  temp: 70,
  rpm: 4000,
  load: 20,
  vibration: 5,
  depth: 40
};

// Estimation parameters
const ESTIMATION_CONSTANTS = {
  BASE_RUL: 10000,
  TEMP_FACTOR: 100,
  VIBRATION_FACTOR: 500,
  LOAD_FACTOR: 300,
  RPM_FACTOR: 0.1,
  OPTIMAL_RPM: 3000,
  OPTIMAL_TEMP: 50,
  OPTIMAL_VIBRATION: 3,
  OPTIMAL_LOAD: 15
};

// Drill Visualization Component - FIXED: Drill bit behind body with rotation
function DrillVisualization({ isActive, latest, rulPercentage }) {
  const [rotationSpeed, setRotationSpeed] = useState(0);
  const drillBitRef = useRef(null);
  
  // Update rotation speed based on RPM
  useEffect(() => {
    if (latest.rpm > 0) {
      // Calculate animation speed based on RPM (faster RPM = faster oscillation)
      const speed = Math.min(1, latest.rpm / 5000);
      setRotationSpeed(speed);
    } else {
      setRotationSpeed(0);
    }
  }, [latest.rpm]);

  // Calculate animation duration: higher RPM = faster oscillation
  const animationDuration = rotationSpeed > 0 ? (0.08 / rotationSpeed) + 's' : '0s';

  return (
    <div style={styles.drillContainer}>
      {/* Animated background particles */}
      <div style={styles.particlesContainer}>
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            style={{
              ...styles.particle,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.2}s`,
              background: `radial-gradient(circle, ${colors.primaryLight}20 0%, transparent 70%)`
            }}
          />
        ))}
      </div>
      
      {/* Main title */}
      <div style={styles.drillHeader}>
        <div style={styles.statusBadge}>
          <div style={{
            ...styles.statusDot,
            background: rulPercentage >= 70 ? colors.success : 
                       rulPercentage >= 40 ? colors.warning : colors.danger
          }} />
          <span style={styles.statusText}>
            {rulPercentage >= 70 ? 'OPTIMAL' : 
             rulPercentage >= 40 ? 'WARNING' : 'CRITICAL'}
          </span>
        </div>
        <h2 style={styles.drillTitle}>DRILL OPERATION</h2>
        <p style={styles.drillSubtitle}>Real-time visualization & monitoring</p>
      </div>
      
      {/* Drill Machine - FIXED: Drill bit BEHIND body */}
      <div style={styles.drillWrapper}>
        {/* Glow effects */}
        <div style={styles.drillGlow} />
        <div style={{
          ...styles.drillGlow,
          background: `radial-gradient(circle, ${colors.accent}15 0%, transparent 70%)`,
          filter: 'blur(40px)',
          width: '500px',
          height: '500px'
        }} />
        
        {/* DRILL BIT - BEHIND THE BODY */}
        <div style={styles.drillBitWrapper}>
          <img
            ref={drillBitRef}
            src={drillBit}
            style={{
              ...styles.drillBit,
              animation: rotationSpeed > 0 ? `drill-oscillate ${animationDuration} ease-in-out infinite alternate` : 'none',
              opacity: rotationSpeed > 0 ? 1 : 0.7,
              filter: rulPercentage < 30 ? 
                `sepia(1) saturate(3) hue-rotate(-30deg)` : 
                `drop-shadow(0 0 15px ${colors.primary}50)`,
            }}
            alt="Drill Bit"
          />
          
          {/* Rotation blur effect when spinning fast */}
          {rotationSpeed > 0.5 && (
            <div style={{
              ...styles.drillBitBlur,
              opacity: rotationSpeed * 0.8,
              animation: `drill-blur ${animationDuration} ease-in-out infinite alternate`
            }} />
          )}
          
          {/* Drilling chips/sparks effect when active */}
          {rotationSpeed > 0.3 && (
            <div style={styles.chipsContainer}>
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.chip,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${i * 0.1}s`,
                    background: `radial-gradient(circle, ${colors.warning} 0%, transparent 70%)`
                  }}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Drill Body - ON TOP OF DRILL BIT */}
        <img
          src={drillBody}
          style={styles.drillBody}
          alt="Drill Body"
        />
        
        {/* Heat effect when temperature is high */}
        {latest.temp > 60 && (
          <div style={styles.heatEffect} />
        )}
        
        {/* Rotation Speed Indicator */}
        {rotationSpeed > 0 && (
          <div style={styles.rotationIndicator}>
            <div style={styles.rotationSpeedBar}>
              <div 
                style={{
                  ...styles.rotationSpeedFill,
                  width: `${rotationSpeed * 100}%`,
                  background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`
                }}
              />
            </div>
            <div style={styles.rotationSpeedText}>
              {Math.round(latest.rpm || 0)} RPM
            </div>
          </div>
        )}
        
        {/* RUL Indicator - Prominent */}
        <div style={styles.rulIndicator}>
          <div style={styles.rulCircle}>
            <div style={{ 
              ...styles.rulFill, 
              height: `${100 - rulPercentage}%`,
              background: `linear-gradient(to top, ${getRULGradient(rulPercentage)})`,
              boxShadow: `0 0 30px ${getRULColor(rulPercentage)}40`
            }} />
            <div style={styles.rulInnerGlow} />
            <div style={styles.rulText}>
              <span style={styles.rulPercentage}>{rulPercentage}%</span>
              <span style={styles.rulLabel}>REMAINING</span>
            </div>
          </div>
        </div>
        
        {/* Live Metrics Overlay - Around Drill */}
        <div style={styles.metricsOverlay}>
          <div style={{ ...styles.metricBubble, ...styles.tempBubble }}>
            <div style={styles.metricIcon}>🌡️</div>
            <div style={styles.metricValue}>
              {latest.temp?.toFixed(1) || '--'}°C
            </div>
            <div style={styles.metricLabel}>TEMP</div>
          </div>
          
          <div style={{ ...styles.metricBubble, ...styles.rpmBubble }}>
            <div style={styles.metricIcon}>⚡</div>
            <div style={styles.metricValue}>
              {latest.rpm || '--'}
            </div>
            <div style={styles.metricLabel}>RPM</div>
          </div>
          
          <div style={{ ...styles.metricBubble, ...styles.loadBubble }}>
            <div style={styles.metricIcon}>🔋</div>
            <div style={styles.metricValue}>
              {latest.load?.toFixed(2) || '--'}A
            </div>
            <div style={styles.metricLabel}>LOAD</div>
          </div>
          
          <div style={{ ...styles.metricBubble, ...styles.vibrationBubble }}>
            <div style={styles.metricIcon}>📳</div>
            <div style={styles.metricValue}>
              {latest.vibration?.toFixed(3) || '--'}
            </div>
            <div style={styles.metricLabel}>VIB</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState("connecting");
  const [selectedMetric, setSelectedMetric] = useState("temp");
  const [isDrillAnimating, setIsDrillAnimating] = useState(false);
  const [samplingRate, setSamplingRate] = useState('--');
  const [lastUpdated, setLastUpdated] = useState('--');
  
  // Estimation states
  const [rulPrediction, setRulPrediction] = useState(null);
  const [estimatedTorque, setEstimatedTorque] = useState(null);
  const [estimatedTemp, setEstimatedTemp] = useState(null);
  const [rulPercentage, setRulPercentage] = useState(100);

  const chartRef = useRef(null);
  const MAX_RECORDS = 50;
  const lastTimestampRef = useRef(null);

  // Trigger drill animation on new data
  useEffect(() => {
    if (records.length > 0) {
      setIsDrillAnimating(true);
      const timeout = setTimeout(() => setIsDrillAnimating(false), 1000);
      return () => clearTimeout(timeout);
    }
  }, [records]);

  // 🔥 INSTANT REALTIME DATABASE LISTENER
  useEffect(() => {
    const drillRef = ref(db, "drillData");
    
    // Use onChildAdded for instant updates
    const unsubscribe = onChildAdded(drillRef, (snapshot) => {
      if (!snapshot.exists()) {
        setStatus("no data");
        return;
      }

      const v = snapshot.val();
      const id = snapshot.key;
      
      const newRecord = {
        id,
        temp: Number(v.temperature) || 0,
        rpm: Number(v.rpm) || 0,
        load: Number(v.load) || 0,
        vibration: Number(v.vibration) || 0,
        depth: Number(v.depth) || 0,
        time: v.timestamp || new Date().toLocaleString(),
        timestamp: v.timestamp ? new Date(v.timestamp).getTime() : Date.now(),
        createdAt: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      };

      // Update last updated time
      setLastUpdated(new Date().toLocaleTimeString());
      
      // Calculate sampling rate
      if (lastTimestampRef.current && newRecord.timestamp) {
        const diff = (newRecord.timestamp - lastTimestampRef.current) / 1000;
        setSamplingRate(diff.toFixed(2) + ' s');
      }
      lastTimestampRef.current = newRecord.timestamp;

      // Add new record at the beginning
      setRecords(prev => {
        const newRecords = [newRecord, ...prev];
        if (newRecords.length > MAX_RECORDS) {
          return newRecords.slice(0, MAX_RECORDS);
        }
        return newRecords;
      });
      
      setStatus("live");
    });

    return () => unsubscribe();
  }, []);

  // Calculate estimations when records change
  useEffect(() => {
    if (records.length > 0) {
      calculateEstimations();
    }
  }, [records]);

  const latest = records[0] || {};

  const calculateEstimations = () => {
    if (!latest || Object.keys(latest).length === 0) return;

    const calculatedRUL = calculateRUL(latest);
    setRulPrediction(calculatedRUL);
    
    const rulPercentage = Math.max(0, Math.min(100, (calculatedRUL / ESTIMATION_CONSTANTS.BASE_RUL) * 100));
    setRulPercentage(Math.round(rulPercentage));
    
    const calculatedTorque = calculateTorque(latest);
    setEstimatedTorque(calculatedTorque);
    
    const calculatedTemp = estimateTemperature(latest);
    setEstimatedTemp(calculatedTemp);
  };

  const calculateRUL = (data) => {
    const { temp, rpm, load, vibration } = data;
    
    let remainingCycles = ESTIMATION_CONSTANTS.BASE_RUL;
    
    if (temp > ESTIMATION_CONSTANTS.OPTIMAL_TEMP) {
      remainingCycles -= (temp - ESTIMATION_CONSTANTS.OPTIMAL_TEMP) * ESTIMATION_CONSTANTS.TEMP_FACTOR;
    }
    
    if (vibration > ESTIMATION_CONSTANTS.OPTIMAL_VIBRATION) {
      remainingCycles -= (vibration - ESTIMATION_CONSTANTS.OPTIMAL_VIBRATION) * ESTIMATION_CONSTANTS.VIBRATION_FACTOR;
    }
    
    if (load > ESTIMATION_CONSTANTS.OPTIMAL_LOAD) {
      remainingCycles -= (load - ESTIMATION_CONSTANTS.OPTIMAL_LOAD) * ESTIMATION_CONSTANTS.LOAD_FACTOR;
    }
    
    const rpmDeviation = Math.abs(rpm - ESTIMATION_CONSTANTS.OPTIMAL_RPM);
    remainingCycles -= rpmDeviation * ESTIMATION_CONSTANTS.RPM_FACTOR;
    
    return Math.max(0, Math.round(remainingCycles));
  };

  const calculateTorque = (data) => {
    const { load, rpm } = data;
    if (!load || !rpm || rpm === 0) return 0;
    
    const torque = (load * 9.55) / rpm;
    return torque.toFixed(2);
  };

  const estimateTemperature = (data) => {
    const { load, rpm, vibration } = data;
    
    let estimatedTemp = 25;
    estimatedTemp += (load / 2);
    estimatedTemp += (rpm / 200);
    estimatedTemp += (vibration * 2);
    
    estimatedTemp = Math.min(120, Math.max(20, estimatedTemp));
    
    return estimatedTemp.toFixed(1);
  };

  // 📈 Chart Data - God level styling
  const chartData = useMemo(() => {
    const points = records.slice(0, 25);

    if (selectedMetric === 'tempComparison' || selectedMetric === 'torqueComparison') {
      const actualData = points.map(r => selectedMetric === 'tempComparison' ? r.temp : calculateTorque(r));
      const estimatedData = points.map(r => selectedMetric === 'tempComparison' ? estimateTemperature(r) : calculateTorque(r));
      
      return {
        labels: points.map(r => r.createdAt || r.time.split(' ')[1] || r.time),
        datasets: [
          {
            label: 'ACTUAL',
            data: actualData,
            borderWidth: 4,
            pointRadius: 6,
            pointBackgroundColor: colors.primary,
            pointBorderColor: colors.textPrimary,
            pointBorderWidth: 2,
            pointHoverRadius: 8,
            tension: 0.4,
            borderColor: colors.primary,
            backgroundColor: `${colors.primary}30`,
            fill: true,
            shadowColor: `${colors.primary}60`,
            shadowBlur: 15
          },
          {
            label: 'ESTIMATED',
            data: estimatedData,
            borderWidth: 4,
            pointRadius: 6,
            pointBackgroundColor: colors.accent,
            pointBorderColor: colors.textPrimary,
            pointBorderWidth: 2,
            pointHoverRadius: 8,
            tension: 0.4,
            borderColor: colors.accent,
            backgroundColor: `${colors.accent}30`,
            fill: true,
            borderDash: [8, 4]
          }
        ],
      };
    }

    return {
      labels: points.map(r => r.createdAt || r.time.split(' ')[1] || r.time),
      datasets: [
        {
          label: selectedMetric.toUpperCase(),
          data: points.map((r) => r[selectedMetric] ?? 0),
          borderWidth: 4,
          pointRadius: 6,
          pointBackgroundColor: getMetricColor(selectedMetric),
          pointBorderColor: colors.textPrimary,
          pointBorderWidth: 2,
          pointHoverRadius: 8,
          tension: 0.4,
          borderColor: getMetricColor(selectedMetric),
          backgroundColor: `${getMetricColor(selectedMetric)}30`,
          fill: true,
        },
      ],
    };
  }, [records, selectedMetric, latest]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { 
        display: selectedMetric.includes('Comparison'),
        position: 'top',
        labels: {
          color: colors.textSecondary,
          font: {
            size: 14,
            family: "'Inter', sans-serif",
            weight: '600'
          },
          padding: 25,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      }, 
      title: { 
        display: true, 
        text: getChartTitle(selectedMetric),
        font: { 
          size: 22,
          family: "'Inter', sans-serif",
          weight: '700'
        },
        color: colors.textPrimary,
        padding: { top: 20, bottom: 40 }
      },
      tooltip: {
        backgroundColor: colors.cardBg,
        titleColor: colors.textPrimary,
        bodyColor: colors.textSecondary,
        borderColor: colors.border,
        borderWidth: 2,
        cornerRadius: 12,
        padding: 16,
        boxShadow: `0 10px 25px rgba(0,0,0,0.3)`,
        titleFont: {
          size: 14,
          weight: '600'
        },
        bodyFont: {
          size: 16,
          weight: '500'
        }
      }
    },
    scales: { 
      y: { 
        beginAtZero: true,
        grid: {
          color: `${colors.border}50`,
          lineWidth: 1
        },
        ticks: {
          color: colors.textSecondary,
          font: {
            size: 12,
            weight: '500'
          },
          padding: 10
        },
        title: {
          display: true,
          text: getMetricUnit(selectedMetric),
          color: colors.textPrimary,
          font: {
            size: 16,
            weight: '600'
          },
          padding: { top: 20, bottom: 10 }
        }
      },
      x: {
        grid: {
          color: `${colors.border}50`,
          lineWidth: 1
        },
        ticks: {
          color: colors.textSecondary,
          font: {
            size: 12,
            weight: '500'
          },
          maxRotation: 45
        },
        title: {
          display: true,
          text: 'TIME',
          color: colors.textPrimary,
          font: {
            size: 16,
            weight: '600'
          },
          padding: { top: 10, bottom: 20 }
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    },
    animations: {
      tension: {
        duration: 1000,
        easing: 'easeOutQuart'
      }
    }
  };

  // 📤 Export CSV
  function exportCSV() {
    const header = "Time,Temperature,RPM,Load,Vibration,Depth,Estimated_Temp,Estimated_Torque,RUL\n";

    const rows = records
      .map((r) => {
        const torque = calculateTorque(r);
        const estTemp = estimateTemperature(r);
        const rul = calculateRUL(r);
        return `${r.time},${r.temp},${r.rpm},${r.load},${r.vibration},${r.depth},${estTemp},${torque},${rul}`;
      })
      .join("\n");

    const blob = new Blob([header + rows], {
      type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "drill-data-with-estimations.csv";
    link.click();
  }

  // Export chart as PNG
  function exportChart() {
    if (chartRef.current) {
      const link = document.createElement("a");
      link.download = `${selectedMetric}-chart.png`;
      link.href = chartRef.current.toBase64Image('image/png', 1.0);
      link.click();
    }
  }

  // Clear local UI data
  function clearLocalUI() {
    setRecords([]);
    setStatus("cleared local UI");
  }

  const getTorqueEfficiency = () => {
    if (!estimatedTorque || !latest.load || latest.rpm === 0) return "--";
    const idealTorque = (latest.load * 9.55) / Math.max(latest.rpm, 1);
    const efficiency = (parseFloat(estimatedTorque) / idealTorque) * 100;
    return Math.min(100, Math.max(0, efficiency)).toFixed(1);
  };

  const getTemperatureAccuracy = () => {
    if (!estimatedTemp || !latest.temp) return "--";
    const diff = Math.abs(latest.temp - parseFloat(estimatedTemp));
    const accuracy = Math.max(0, 100 - (diff * 2));
    return accuracy.toFixed(1);
  };

  return (
    <div style={styles.app}>
      <style>
        {`
          /* OSCILLATION ANIMATION - drill bit only rotates */
          @keyframes drill-oscillate {
            0% {
              transform: rotate(-3deg);
            }
            100% {
              transform: rotate(3deg);
            }
          }
          
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
          
          @keyframes pulse-glow {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.7; }
          }
          
          @keyframes heat-glow {
            0%, 100% { filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.5)); }
            50% { filter: drop-shadow(0 0 25px rgba(239, 68, 68, 0.8)); }
          }
          
          @keyframes particle-float {
            0% { transform: translateY(0) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(-100px) rotate(360deg); opacity: 0; }
          }
          
          @keyframes chip-spark {
            0% { transform: translateY(0) scale(1); opacity: 1; }
            100% { transform: translateY(-100px) scale(0); opacity: 0; }
          }
          
          @keyframes drill-blur {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
          }
        `}
      </style>
      
      {/* Animated Background */}
      <div style={styles.background}>
        <div style={styles.bgGradient} />
        <div style={styles.bgGrid} />
      </div>
      
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerText}>
            <div style={styles.titleGlow}>
              <h1 style={styles.title}>INDUSTRIAL DRILL MONITOR</h1>
            </div>
            <p style={styles.subtitle}>PREDICTIVE ANALYTICS & REAL-TIME MONITORING</p>
          </div>
          
          <div style={styles.headerControls}>
            <div style={styles.statusIndicator}>
              <div style={{
                ...styles.statusPulse,
                background: status === 'live' ? colors.success : colors.warning
              }} />
              <span style={styles.statusLabel}>{status.toUpperCase()}</span>
              <div style={styles.lastUpdate}>LAST: {lastUpdated}</div>
            </div>
            
            <div style={styles.controlButtons}>
              <button style={styles.controlButton} onClick={exportCSV}>
                <span style={styles.buttonIcon}>📊</span> EXPORT DATA
              </button>
              <button style={{...styles.controlButton, background: colors.info}} onClick={exportChart}>
                <span style={styles.buttonIcon}>📈</span> EXPORT CHART
              </button>
              <button style={{...styles.controlButton, background: colors.danger}} onClick={clearLocalUI}>
                <span style={styles.buttonIcon}>🗑️</span> CLEAR DATA
              </button>
            </div>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {/* Top Row: Drill Visualization & Key Metrics */}
        <div style={styles.topRow}>
          {/* Drill Visualization */}
          <DrillVisualization 
            isActive={isDrillAnimating} 
            latest={latest} 
            rulPercentage={rulPercentage} 
          />
          
          {/* Key Metrics Cards */}
          <div style={styles.metricsSection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>KEY METRICS</h2>
              <div style={styles.samplingRate}>Sampling: {samplingRate}</div>
            </div>
            
            <div style={styles.metricsGrid}>
              {[
                { key: 'temp', label: 'TEMPERATURE', icon: '🌡️', unit: '°C', color: colors.danger },
                { key: 'rpm', label: 'ROTATION SPEED', icon: '⚡', unit: 'RPM', color: colors.primary },
                { key: 'load', label: 'ELECTRICAL LOAD', icon: '🔋', unit: 'Amps', color: colors.warning },
                { key: 'vibration', label: 'VIBRATION', icon: '📳', unit: 'm/s²', color: colors.info },
                { key: 'depth', label: 'DRILL DEPTH', icon: '📏', unit: 'mm', color: colors.secondary },
                { key: 'torque', label: 'EST. TORQUE', icon: '🔧', unit: 'Nm', color: colors.accent },
              ].map((metric) => (
                <div 
                  key={metric.key}
                  style={{
                    ...styles.metricCard,
                    borderColor: metric.color + '40',
                    background: `linear-gradient(135deg, ${metric.color}15, transparent)`
                  }}
                  onClick={() => metric.key !== 'torque' && setSelectedMetric(metric.key)}
                >
                  <div style={styles.metricHeader}>
                    <span style={styles.metricCardIcon}>{metric.icon}</span>
                    <span style={styles.metricCardLabel}>{metric.label}</span>
                  </div>
                  <div style={styles.metricCardValue}>
                    {metric.key === 'torque' ? estimatedTorque || '--' :
                     latest[metric.key] !== undefined ? 
                       (metric.key === 'vibration' ? latest[metric.key].toFixed(3) :
                        metric.key === 'temp' || metric.key === 'load' || metric.key === 'depth' ? 
                        latest[metric.key].toFixed(2) : latest[metric.key]) 
                     : '--'}
                    <span style={styles.metricUnit}> {metric.unit}</span>
                  </div>
                  {latest[metric.key] > thresholds[metric.key] && metric.key !== 'torque' && (
                    <div style={styles.warningAlert}>⚠️ EXCEEDS LIMIT</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Row: Predictive Analytics */}
        <div style={styles.analyticsSection}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>PREDICTIVE ANALYTICS</h2>
            <p style={styles.sectionSubtitle}>Real-time estimations & health monitoring</p>
          </div>
          
          <div style={styles.analyticsGrid}>
            <div style={{
              ...styles.analyticsCard,
              background: `linear-gradient(135deg, ${getRULColor(rulPercentage)}20, transparent)`,
              borderColor: `${getRULColor(rulPercentage)}40`
            }}>
              <div style={styles.analyticsIcon}>⏳</div>
              <div style={styles.analyticsValue}>{rulPrediction?.toLocaleString() || '--'}</div>
              <div style={styles.analyticsLabel}>REMAINING USEFUL LIFE</div>
              <div style={styles.analyticsDetail}>
                <div style={styles.progressBar}>
                  <div 
                    style={{
                      ...styles.progressFill,
                      width: `${rulPercentage}%`,
                      background: `linear-gradient(90deg, ${getRULColor(rulPercentage)}, ${getRULColor(rulPercentage)}80)`
                    }}
                  />
                </div>
                <div style={styles.progressText}>{rulPercentage}% REMAINING</div>
              </div>
            </div>
            
            <div style={styles.analyticsCard}>
              <div style={styles.analyticsIcon}>⚡</div>
              <div style={styles.analyticsValue}>{estimatedTorque || '--'} Nm</div>
              <div style={styles.analyticsLabel}>ESTIMATED TORQUE</div>
              <div style={styles.analyticsDetail}>
                Efficiency: <strong>{getTorqueEfficiency()}%</strong>
              </div>
            </div>
            
            <div style={styles.analyticsCard}>
              <div style={styles.analyticsIcon}>🌡️</div>
              <div style={styles.analyticsValue}>{estimatedTemp || '--'}°C</div>
              <div style={styles.analyticsLabel}>ESTIMATED TEMPERATURE</div>
              <div style={styles.analyticsDetail}>
                Accuracy: <strong>{getTemperatureAccuracy()}%</strong>
                <div style={styles.tempComparison}>
                  Actual: {latest.temp?.toFixed(1) || '--'}°C
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Chart & Data Table */}
        <div style={styles.bottomRow}>
          {/* Chart */}
          <div style={styles.chartSection}>
            <div style={styles.chartHeader}>
              <div style={styles.chartTitle}>{getChartTitle(selectedMetric)}</div>
              <div style={styles.chartControls}>
                {['temp', 'rpm', 'load', 'vibration', 'depth', 'tempComparison', 'torqueComparison'].map((metric) => (
                  <button
                    key={metric}
                    style={{
                      ...styles.chartButton,
                      background: selectedMetric === metric ? colors.primary : 'transparent',
                      borderColor: selectedMetric === metric ? colors.primary : colors.border
                    }}
                    onClick={() => setSelectedMetric(metric)}
                  >
                    {getChartButtonLabel(metric)}
                  </button>
                ))}
              </div>
            </div>
            <div style={styles.chartContainer}>
              <Line 
                ref={chartRef} 
                data={chartData} 
                options={chartOptions} 
                style={styles.chart}
              />
            </div>
          </div>
          
          {/* Data Table */}
          <div style={styles.tableSection}>
            <div style={styles.tableHeader}>
              <h3 style={styles.tableTitle}>RECENT READINGS</h3>
              <div style={styles.tableCount}>{records.length} records</div>
            </div>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.tableHead}>TIME</th>
                    <th style={styles.tableHead}>TEMP</th>
                    <th style={styles.tableHead}>RPM</th>
                    <th style={styles.tableHead}>LOAD</th>
                    <th style={styles.tableHead}>VIB</th>
                    <th style={styles.tableHead}>DEPTH</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 8).map((record, index) => (
                    <tr key={index} style={styles.tableRow}>
                      <td style={styles.tableCell}>{record.createdAt || '--'}</td>
                      <td style={{
                        ...styles.tableCell,
                        color: record.temp > thresholds.temp ? colors.danger : colors.textPrimary
                      }}>
                        {record.temp?.toFixed(1) || '--'}°C
                      </td>
                      <td style={styles.tableCell}>{record.rpm || '--'}</td>
                      <td style={styles.tableCell}>{record.load?.toFixed(2) || '--'}A</td>
                      <td style={styles.tableCell}>{record.vibration?.toFixed(3) || '--'}</td>
                      <td style={styles.tableCell}>{record.depth?.toFixed(2) || '--'}mm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <div style={styles.footerText}>
            <span style={styles.footerLogo}>INDUSTRIAL IoT MONITORING SYSTEM</span>
            <span style={styles.footerStatus}>
              STATUS: <span style={{ color: status === 'live' ? colors.success : colors.warning }}>
                {status.toUpperCase()}
              </span> • RECORDS: {records.length} • UPDATED: {lastUpdated}
            </span>
          </div>
          <div style={styles.footerCopyright}>
            © 2024 Drill Predictive Analytics • Real-time Condition Monitoring v3.0
          </div>
        </div>
      </footer>
    </div>
  );
}

// 🎨 STYLES
const styles = {
  app: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    minHeight: '100vh',
    background: colors.darkBg,
    color: colors.textPrimary,
    position: 'relative',
    overflowX: 'hidden'
  },
  
  // Background
  background: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    pointerEvents: 'none'
  },
  
  bgGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    background: `linear-gradient(to bottom, ${colors.darkBg} 0%, ${colors.darkBg}80 100%)`,
  },
  
  bgGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `radial-gradient(circle at 25px 25px, ${colors.border} 1px, transparent 1px)`,
    backgroundSize: '50px 50px',
    opacity: 0.1
  },
  
  // Header
  header: {
    padding: '20px 30px',
    background: colors.cardBg,
    backdropFilter: 'blur(10px)',
    borderBottom: `1px solid ${colors.border}`,
    position: 'relative',
    zIndex: 10,
    boxShadow: `0 4px 20px rgba(0,0,0,0.3)`
  },
  
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '100%',
    margin: '0 auto'
  },
  
  headerText: {
    flex: 1
  },
  
  titleGlow: {
    position: 'relative',
    display: 'inline-block'
  },
  
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: '900',
    background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '1px',
    textTransform: 'uppercase'
  },
  
  subtitle: {
    fontSize: '13px',
    color: colors.textSecondary,
    marginTop: '4px',
    letterSpacing: '2px',
    fontWeight: '500'
  },
  
  headerControls: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '12px'
  },
  
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 16px',
    background: `${colors.glassBg}`,
    borderRadius: '20px',
    border: `1px solid ${colors.border}`,
    backdropFilter: 'blur(10px)'
  },
  
  statusPulse: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    animation: 'pulse-glow 2s infinite'
  },
  
  statusLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: '1px'
  },
  
  lastUpdate: {
    fontSize: '11px',
    color: colors.textSecondary,
    marginLeft: '10px',
    paddingLeft: '10px',
    borderLeft: `1px solid ${colors.border}`
  },
  
  controlButtons: {
    display: 'flex',
    gap: '10px'
  },
  
  controlButton: {
    padding: '10px 18px',
    background: colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.3s ease',
    boxShadow: `0 4px 12px ${colors.primary}40`,
    letterSpacing: '0.5px',
    textTransform: 'uppercase'
  },
  
  buttonIcon: {
    fontSize: '14px'
  },
  
  // Main Content
  main: {
    padding: '25px',
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '25px'
  },
  
  // Top Row
  topRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '25px',
    height: '500px'
  },
  
  // Drill Visualization - FIXED: Drill bit BEHIND body
  drillContainer: {
    background: colors.cardBg,
    borderRadius: '24px',
    border: `1px solid ${colors.border}`,
    boxShadow: `0 20px 40px rgba(0,0,0,0.4)`,
    padding: '25px',
    position: 'relative',
    overflow: 'hidden',
    backdropFilter: 'blur(10px)'
  },
  
  particlesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden'
  },
  
  particle: {
    position: 'absolute',
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    animation: 'particle-float 20s infinite linear'
  },
  
  drillHeader: {
    textAlign: 'center',
    marginBottom: '20px',
    position: 'relative',
    zIndex: 2
  },
  
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 15px',
    background: `${colors.glassBg}`,
    borderRadius: '20px',
    border: `1px solid ${colors.border}`,
    marginBottom: '15px',
    backdropFilter: 'blur(10px)'
  },
  
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    animation: 'pulse-glow 2s infinite'
  },
  
  statusText: {
    fontSize: '12px',
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: '1px'
  },
  
  drillTitle: {
    fontSize: '22px',
    fontWeight: '800',
    color: colors.textPrimary,
    margin: '0 0 5px 0',
    letterSpacing: '1px',
    textTransform: 'uppercase'
  },
  
  drillSubtitle: {
    fontSize: '13px',
    color: colors.textSecondary,
    fontWeight: '500'
  },
  
  drillWrapper: {
    position: 'relative',
    height: '350px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  
  drillGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '400px',
    height: '400px',
    background: `radial-gradient(circle, ${colors.primary}20 0%, transparent 70%)`,
    filter: 'blur(40px)',
    zIndex: 1
  },
  
  // DRILL BIT WRAPPER - BEHIND BODY
  drillBitWrapper: {
    position: 'absolute',
    width: '140px',
    height: '80px',
    left: '-7px',  // Positioned to match drill body
    top: '30px',
    zIndex: 2,  // Behind drill body
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
    
  },
  
  drillBit: {
    width: '140px',
    height: '80px',
    objectFit: 'contain',
    position: 'relative',
    zIndex: 3,
    transformOrigin: 'center center',
    
  },
  
  drillBitBlur: {
    position: 'absolute',
    width: '160px',
    height: '90px',
    background: `radial-gradient(ellipse at center, 
      ${colors.primary}40 0%, 
      ${colors.primary}20 30%, 
      transparent 70%)`,
    borderRadius: '50%',
    zIndex: 2,
    pointerEvents: 'none',
    filter: 'blur(5px)'
  },
  
  // Drill Body - ON TOP OF DRILL BIT
  drillBody: {
    width: '600px',
    height: '400px',
    objectFit: 'contain',
    position: 'relative',
    zIndex: 4,  // Higher than drill bit
    filter: 'drop-shadow(0 15px 40px rgba(99, 102, 241, 0.3))'
  },
  
  chipsContainer: {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: 1
  },
  
  chip: {
    position: 'absolute',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    animation: 'chip-spark 0.8s infinite ease-out'
  },
  
  heatEffect: {
    position: 'absolute',
    width: '140px',
    height: '80px',
    left: '120px',
    top: '160px',
    background: `radial-gradient(circle, ${colors.danger}30 0%, transparent 70%)`,
    filter: 'blur(20px)',
    zIndex: 1,
    animation: 'heat-glow 2s ease-in-out infinite'
  },
  
  rotationIndicator: {
    position: 'absolute',
    bottom: '30px',
    left: '0',
    right: '0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    zIndex: 5
  },
  
  rotationSpeedBar: {
    width: '200px',
    height: '6px',
    background: colors.border,
    borderRadius: '3px',
    overflow: 'hidden'
  },
  
  rotationSpeedFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.5s ease'
  },
  
  rotationSpeedText: {
    fontSize: '12px',
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: '0.5px'
  },
  
  rulIndicator: {
    position: 'absolute',
    top: '30px',
    right: '30px',
    zIndex: 5
  },
  
  rulCircle: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: `3px solid ${colors.border}`,
    position: 'relative',
    overflow: 'hidden',
    background: colors.glassBg,
    backdropFilter: 'blur(10px)',
    boxShadow: `0 10px 30px rgba(0,0,0,0.3)`
  },
  
  rulFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    transition: 'height 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
    borderTopLeftRadius: '60px',
    borderTopRightRadius: '60px'
  },
  
  rulInnerGlow: {
    position: 'absolute',
    inset: '3px',
    borderRadius: '50%',
    border: `2px solid ${colors.glassBg}`,
    boxShadow: `inset 0 0 20px rgba(255,255,255,0.1)`
  },
  
  rulText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    zIndex: 2
  },
  
  rulPercentage: {
    fontSize: '32px',
    fontWeight: '900',
    color: colors.textPrimary,
    display: 'block',
    lineHeight: '1'
  },
  
  rulLabel: {
    fontSize: '11px',
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginTop: '4px'
  },
  
  metricsOverlay: {
    position: 'absolute',
    bottom: '20px',
    left: '0',
    right: '0',
    display: 'flex',
    justifyContent: 'center',
    gap: '15px',
    zIndex: 5
  },
  
  metricBubble: {
    background: colors.glassBg,
    backdropFilter: 'blur(10px)',
    border: `1px solid ${colors.border}`,
    borderRadius: '16px',
    padding: '12px',
    minWidth: '100px',
    textAlign: 'center',
    transition: 'all 0.3s ease'
  },
  
  tempBubble: {
    borderColor: `${colors.danger}40`,
    background: `${colors.danger}15`
  },
  
  rpmBubble: {
    borderColor: `${colors.primary}40`,
    background: `${colors.primary}15`
  },
  
  loadBubble: {
    borderColor: `${colors.warning}40`,
    background: `${colors.warning}15`
  },
  
  vibrationBubble: {
    borderColor: `${colors.info}40`,
    background: `${colors.info}15`
  },
  
  metricIcon: {
    fontSize: '20px',
    marginBottom: '8px'
  },
  
  metricValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: '4px'
  },
  
  metricLabel: {
    fontSize: '11px',
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: '1px'
  },
  
  // Metrics Section
  metricsSection: {
    background: colors.cardBg,
    borderRadius: '24px',
    border: `1px solid ${colors.border}`,
    padding: '25px',
    backdropFilter: 'blur(10px)',
    boxShadow: `0 20px 40px rgba(0,0,0,0.4)`
  },
  
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: colors.textPrimary,
    margin: 0,
    letterSpacing: '1px',
    textTransform: 'uppercase'
  },
  
  samplingRate: {
    fontSize: '12px',
    color: colors.textSecondary,
    background: colors.glassBg,
    padding: '6px 12px',
    borderRadius: '20px',
    border: `1px solid ${colors.border}`
  },
  
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '15px',
    height: 'calc(100% - 50px)'
  },
  
  metricCard: {
    background: colors.glassBg,
    borderRadius: '16px',
    border: `2px solid ${colors.border}`,
    padding: '20px',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  },
  
  metricHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '15px'
  },
  
  metricCardIcon: {
    fontSize: '18px'
  },
  
  metricCardLabel: {
    fontSize: '12px',
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: '1px',
    textTransform: 'uppercase'
  },
  
  metricCardValue: {
    fontSize: '28px',
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: '5px',
    lineHeight: '1'
  },
  
  metricUnit: {
    fontSize: '14px',
    color: colors.textSecondary,
    fontWeight: '500'
  },
  
  warningAlert: {
    fontSize: '11px',
    color: colors.danger,
    fontWeight: '600',
    background: `${colors.danger}20`,
    padding: '4px 8px',
    borderRadius: '12px',
    marginTop: '10px',
    textAlign: 'center',
    animation: 'pulse-glow 2s infinite'
  },
  
  // Analytics Section
  analyticsSection: {
    background: colors.cardBg,
    borderRadius: '24px',
    border: `1px solid ${colors.border}`,
    padding: '25px',
    backdropFilter: 'blur(10px)',
    boxShadow: `0 20px 40px rgba(0,0,0,0.4)`
  },
  
  sectionSubtitle: {
    fontSize: '14px',
    color: colors.textSecondary,
    marginTop: '5px'
  },
  
  analyticsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    marginTop: '20px'
  },
  
  analyticsCard: {
    background: colors.glassBg,
    borderRadius: '20px',
    border: `2px solid ${colors.border}`,
    padding: '25px',
    textAlign: 'center',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease'
  },
  
  analyticsIcon: {
    fontSize: '32px',
    marginBottom: '15px'
  },
  
  analyticsValue: {
    fontSize: '36px',
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: '10px',
    lineHeight: '1'
  },
  
  analyticsLabel: {
    fontSize: '14px',
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: '15px'
  },
  
  analyticsDetail: {
    fontSize: '13px',
    color: colors.textPrimary,
    fontWeight: '500'
  },
  
  progressBar: {
    height: '8px',
    background: colors.border,
    borderRadius: '4px',
    overflow: 'hidden',
    margin: '15px 0'
  },
  
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 1s ease'
  },
  
  progressText: {
    fontSize: '12px',
    color: colors.textSecondary,
    fontWeight: '600'
  },
  
  tempComparison: {
    fontSize: '12px',
    color: colors.textSecondary,
    marginTop: '5px'
  },
  
  // Bottom Row
  bottomRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '25px',
    height: '500px'
  },
  
  chartSection: {
    background: colors.cardBg,
    borderRadius: '24px',
    border: `1px solid ${colors.border}`,
    padding: '25px',
    backdropFilter: 'blur(10px)',
    boxShadow: `0 20px 40px rgba(0,0,0,0.4)`,
    display: 'flex',
    flexDirection: 'column'
  },
  
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '25px'
  },
  
  chartTitle: {
    fontSize: '20px',
    fontWeight: '800',
    color: colors.textPrimary,
    margin: 0,
    letterSpacing: '1px'
  },
  
  chartControls: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  
  chartButton: {
    padding: '8px 16px',
    background: 'transparent',
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '600',
    transition: 'all 0.3s ease',
    letterSpacing: '0.5px',
    textTransform: 'uppercase'
  },
  
  chartContainer: {
    flex: 1,
    position: 'relative'
  },
  
  chart: {
    width: '100% !important',
    height: '100% !important'
  },
  
  tableSection: {
    background: colors.cardBg,
    borderRadius: '24px',
    border: `1px solid ${colors.border}`,
    padding: '25px',
    backdropFilter: 'blur(10px)',
    boxShadow: `0 20px 40px rgba(0,0,0,0.4)`,
    display: 'flex',
    flexDirection: 'column'
  },
  
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  
  tableTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: colors.textPrimary,
    margin: 0,
    letterSpacing: '1px',
    textTransform: 'uppercase'
  },
  
  tableCount: {
    fontSize: '12px',
    color: colors.textSecondary,
    background: colors.glassBg,
    padding: '6px 12px',
    borderRadius: '20px',
    border: `1px solid ${colors.border}`
  },
  
  tableWrapper: {
    flex: 1,
    overflow: 'auto'
  },
  
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  
  tableHead: {
    background: colors.border,
    color: colors.textPrimary,
    padding: '14px 16px',
    textAlign: 'left',
    fontWeight: '600',
    fontSize: '12px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    position: 'sticky',
    top: 0,
    zIndex: 1
  },
  
  tableRow: {
    '&:hover': {
      background: `${colors.glassBg}`
    }
  },
  
  tableCell: {
    padding: '12px 16px',
    borderBottom: `1px solid ${colors.border}`,
    fontSize: '13px',
    color: colors.textPrimary,
    fontWeight: '500'
  },
  
  // Footer
  footer: {
    marginTop: '25px',
    padding: '20px 30px',
    background: colors.cardBg,
    borderTop: `1px solid ${colors.border}`,
    backdropFilter: 'blur(10px)',
    boxShadow: `0 -4px 20px rgba(0,0,0,0.3)`
  },
  
  footerContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px'
  },
  
  footerText: {
    display: 'flex',
    alignItems: 'center',
    gap: '30px',
    fontSize: '13px',
    color: colors.textPrimary,
    fontWeight: '600',
    letterSpacing: '1px'
  },
  
  footerLogo: {
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  
  footerStatus: {
    color: colors.textSecondary,
    fontWeight: '500'
  },
  
  footerCopyright: {
    fontSize: '12px',
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500'
  }
};
