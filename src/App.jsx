import React, { useEffect, useState, useRef, useMemo } from 'react';
import { db } from './firebaseConfig';

// Import images from src/assets/
import drillBit from './assets/drill-bit.png';
import drillBody from './assets/drill-body.png';

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';

// chart.js + react wrapper
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

// Global cycle counter for degradation simulation
let cycle = 0;

// Updated helper to create sensor values with degradation
function makeRandomDrillValues() {
  cycle++;
  const degradationFactor = cycle / 1000; // Wear over 1000 cycles
  return {
    temp: +(20 + Math.random() * 60 + degradationFactor * 10).toFixed(2), // Temp rises
    rpm: Math.round(5000 - degradationFactor * 1000), // RPM decreases
    load: +(Math.random() * 30 + degradationFactor * 5).toFixed(2),
    vibration: +(Math.random() * 10 + degradationFactor * 2).toFixed(3),
    depth: +(Math.random() * 50).toFixed(2)
  };
}

// Thresholds for alarming
const thresholds = {
  temp: 70,
  rpm: 4000,
  load: 20,
  vibration: 5,
  depth: 40
};

// Drill Visualization Component
function DrillVisualization({ isActive, latest }) {
  return (
    <div style={styles.drillContainer}>
      <div style={styles.drillWrapper}>
        <img
          src={drillBody}
          style={styles.drillBody}
          alt="Drill Body"
        />
        <img
          src={drillBit}
          style={{
            ...styles.drillBit,
            animation: isActive ? 'spin 0.12s ease-in-out infinite alternate' : 'none'
          }}
          alt="Drill Bit"
        />
        {/* Metric Labels with Thin Arrows to Specific Parts */}
        <div style={{ ...styles.metricLabel, ...styles.tempLabel, color: (latest.temp > thresholds.temp) ? 'red' : '#333' }}>
          <span>Temperature: {latest.temp ?? 'N/A'} °C</span>
        </div>
        <div style={{ ...styles.metricLabel, ...styles.rpmLabel, color: (latest.rpm > thresholds.rpm) ? 'red' : '#333' }}>
          <span>RPM: {latest.rpm ?? 'N/A'}</span>
        </div>
        <div style={{ ...styles.metricLabel, ...styles.loadLabel, color: (latest.load > thresholds.load) ? 'red' : '#333' }}>
          <span>Load: {latest.load ?? 'N/A'} A</span>
        </div>
        <div style={{ ...styles.metricLabel, ...styles.vibrationLabel, color: (latest.vibration > thresholds.vibration) ? 'red' : '#333' }}>
          <span>Vibration: {latest.vibration ?? 'N/A'} m/s²</span>
        </div>
        <div style={{ ...styles.metricLabel, ...styles.depthLabel, color: (latest.depth > thresholds.depth) ? 'red' : '#333' }}>
          <span>Depth: {latest.depth ?? 'N/A'} mm</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [records, setRecords] = useState([]); // latest docs from Firestore (desc)
  const [status, setStatus] = useState('idle');
  const [autoSending, setAutoSending] = useState(false);
  const [isDrillAnimating, setIsDrillAnimating] = useState(false);
  const autoRef = useRef(null);
  const [selectedMetric, setSelectedMetric] = useState('temp');
  const [samplingRate, setSamplingRate] = useState('N/A');
  const chartRef = useRef(null);
  const limitToShow = 50; // how many points to show in chart

  // ML states
  const [rulPrediction, setRulPrediction] = useState(null);
  const [estimatedTemp, setEstimatedTemp] = useState(null);

  // Trigger drill animation on new data
  useEffect(() => {
    if (records.length > 0) {
      setIsDrillAnimating(true);
      const timeout = setTimeout(() => setIsDrillAnimating(false), 1000); // Animate for 1 second
      return () => clearTimeout(timeout);
    }
  }, [records]);

  // send one random data point to Firestore
  async function sendRandomToFirestore() {
    try {
      const values = makeRandomDrillValues();
      await addDoc(collection(db, 'drillData'), {
        ...values,
        createdAt: serverTimestamp()
      });
      setStatus('sent');
    } catch (err) {
      console.error('Write error', err);
      setStatus('error: ' + (err.message || err));
    }
  }

  // Start / Stop automatic sending
  function startAutoSend(intervalMs = 5000) {
    if (autoRef.current) return;
    setAutoSending(true);
    autoRef.current = setInterval(sendRandomToFirestore, intervalMs);
    setStatus('auto-started');
  }
  function stopAutoSend() {
    if (autoRef.current) {
      clearInterval(autoRef.current);
      autoRef.current = null;
    }
    setAutoSending(false);
    setStatus('auto-stopped');
  }

  // Realtime listener: top N docs ordered by createdAt desc
  useEffect(() => {
    const q = query(collection(db, 'drillData'), orderBy('createdAt', 'desc'), limit(limitToShow));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setRecords(arr);

        // Calculate sampling rate (average interval in seconds)
        if (arr.length > 1) {
          const times = arr
            .map((r) => r.createdAt?.toDate()?.getTime())
            .filter(Boolean)
            .sort((a, b) => a - b);
          if (times.length > 1) {
            const diffs = times.slice(1).map((t, i) => t - times[i]);
            const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length / 1000; // in seconds
            setSamplingRate(avgDiff.toFixed(2) + ' s');
          }
        } else {
          setSamplingRate('N/A');
        }
      },
      (err) => {
        console.error('Listen error', err);
        setStatus('listen-error: ' + (err.message || err));
      }
    );
    return () => unsub();
  }, []);

  // ML Prediction useEffect
  useEffect(() => {
    if (records.length >= 20) {
      // Reverse to chronological order (oldest to newest)
      const recentRecords = records.slice(0, 20).reverse();
      // Prepare sequence with features
      const sequence = recentRecords.map((r, i) => {
        const temp = r.temp ?? 0;
        const rpm = r.rpm ?? 0;
        const load = r.load ?? 0;
        const vibration = r.vibration ?? 0;
        const depth = r.depth ?? 0;
        const prevTemp = i > 0 ? recentRecords[i-1].temp ?? 0 : temp;
        const tempChange = temp - prevTemp;
        const torqueEst = (load * 9.55) / Math.max(rpm, 1);
        return [temp, rpm, load, vibration, depth, tempChange, torqueEst];
      });

      // RUL Prediction
      const backendUrl = process.env.NODE_ENV === 'production'
  ? 'https://drill-dashboard-backend.onrender.com/' // Replace with your actual Render URL
  : 'http://localhost:5000';

// RUL Prediction
fetch(`${backendUrl}/predict_rul`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sequence: [sequence] })  // Batch of 1
})
  .then(res => res.json())
  .then(data => setRulPrediction(Math.round(data.rul)))
  .catch(err => console.error('RUL error:', err));

// Temp Estimation (exclude temp for input)
const sequenceForEst = sequence.map(row => row.slice(1)).flat();
fetch(`${backendUrl}/predict_temp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sequence: sequenceForEst })
})
  .then(res => res.json())
  .then(data => setEstimatedTemp(data.temp_est.toFixed(2)))
  .catch(err => console.error('Temp est error:', err));
    }
  }, [records]);

  // Chart data derived from records
  const chartData = useMemo(() => {
    const points = [...records].reverse();
    const labels = points.map((r) => {
      try {
        return r.createdAt && typeof r.createdAt.toDate === 'function'
          ? r.createdAt.toDate().toLocaleTimeString()
          : '';
      } catch (e) {
        return '';
      }
    });
    let values = points.map((r) => (r[selectedMetric] !== undefined ? r[selectedMetric] : 0));
    
    // Handle ML metrics (placeholders if not available)
    if (selectedMetric === 'rul') {
      values = new Array(points.length).fill(rulPrediction || 0);
    } else if (selectedMetric === 'estTemp') {
      values = new Array(points.length).fill(estimatedTemp || 0);
    }

    return {
      labels: labels.length ? labels : [''],
      datasets: [
        {
          label: selectedMetric,
          data: values.length ? values : [0],
          fill: false,
          tension: 0.3,
          pointRadius: 2
        }
      ]
    };
  }, [records, selectedMetric, rulPrediction, estimatedTemp]);

  const chartOptions = {
    responsive: true,
    plugins: { legend: { display: false }, title: { display: true, text: `${selectedMetric} over time` } },
    scales: { y: { beginAtZero: true } }
  };

  // latest (most recent) values
  const latest = records[0] || {};

  // Export chart as PNG (high resolution)
  function exportChart() {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = `${selectedMetric}-chart.png`;
      link.href = chartRef.current.toBase64Image('image/png', 1.0);  // Full resolution
      link.click();
    }
  }

  // Export data as CSV (updated with predictions and consistent time format)
  function exportCSV() {
    const csvHeader = 'Time,Temp,RPM,Load,Vibration,Depth,RUL_Pred,Temp_Est\n';
    const csvRows = records.map((r, i) => {
      const time = r.createdAt?.toDate()?.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).replace(',', '') ?? '—';
      const rul = (i === 0 && rulPrediction !== null) ? rulPrediction : '—';
      const tempEst = (i === 0 && estimatedTemp !== null) ? estimatedTemp : '—';
      return `${time},${r.temp ?? '—'},${r.rpm ?? '—'},${r.load ?? '—'},${r.vibration ?? '—'},${r.depth ?? '—'},${rul},${tempEst}`;
    }).join('\n');
    const csv = csvHeader + csvRows;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'drill-data.csv';
    link.href = url;
    link.click();
  }

  return (
    <div style={styles.app}>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(-2deg); }
            to { transform: rotate(2deg); }
          }
        `}
      </style>
      <header style={styles.header}>
        <h1 style={{ margin: 0 }}>Drill Dashboard (React)</h1>
        <div style={{ fontSize: 13, color: '#333' }}>Firestore: collection <code>drillData</code> • Live listener • ML Predictions</div>
      </header>

      <main style={styles.main}>
        <div style={styles.contentWrapper}>
          <section style={styles.controls}>
            <button style={styles.btn} onClick={sendRandomToFirestore}>Send Random Data</button>
            <button style={styles.btn} disabled={autoSending} onClick={() => startAutoSend(5000)}>
              Start Auto (5s)
            </button>
            <button style={{ ...styles.btn, background: '#f33' }} disabled={!autoSending} onClick={stopAutoSend}>
              Stop Auto
            </button>
            <button
              style={{ ...styles.btn, background: '#888' }}
              onClick={() => {
                setRecords([]);
                setStatus('cleared local UI');
              }}
            >
              Clear Local UI
            </button>
            <button style={{ ...styles.btn, background: '#28a745' }} onClick={exportChart}>
              Export Chart as PNG
            </button>
            <button style={{ ...styles.btn, background: '#17a2b8' }} onClick={exportCSV}>
              Export Data as CSV
            </button>
          </section>

          <section style={styles.cardsRow}>
            <MetricCard
              title="Temperature"
              value={latest.temp}
              unit="°C"
              active={selectedMetric === 'temp'}
              onClick={() => setSelectedMetric('temp')}
              isAlert={latest.temp > thresholds.temp}
            />
            <MetricCard
              title="RPM"
              value={latest.rpm}
              unit=""
              active={selectedMetric === 'rpm'}
              onClick={() => setSelectedMetric('rpm')}
              isAlert={latest.rpm > thresholds.rpm}
            />
            <MetricCard
              title="Load (A)"
              value={latest.load}
              unit="A"
              active={selectedMetric === 'load'}
              onClick={() => setSelectedMetric('load')}
              isAlert={latest.load > thresholds.load}
            />
            <MetricCard
              title="Vibration"
              value={latest.vibration}
              unit="m/s²"
              active={selectedMetric === 'vibration'}
              onClick={() => setSelectedMetric('vibration')}
              isAlert={latest.vibration > thresholds.vibration}
            />
            <MetricCard
              title="Depth"
              value={latest.depth}
              unit="mm"
              active={selectedMetric === 'depth'}
              onClick={() => setSelectedMetric('depth')}
              isAlert={latest.depth > thresholds.depth}
            />
            {/* New ML Cards */}
            <MetricCard
              title="Predicted RUL"
              value={rulPrediction ?? 'Calculating...'}
              unit="cycles"
              active={selectedMetric === 'rul'}
              onClick={() => setSelectedMetric('rul')}
              isAlert={rulPrediction !== null && rulPrediction < 50}
            />
            <MetricCard
              title="Estimated Temp"
              value={estimatedTemp ?? 'Calculating...'}
              unit="°C"
              active={selectedMetric === 'estTemp'}
              onClick={() => setSelectedMetric('estTemp')}
              isAlert={estimatedTemp !== null && Math.abs(estimatedTemp - (latest.temp ?? 0)) > 5}
            />
          </section>

          <section style={styles.chartSection}>
            <div style={styles.chartBox}>
              <Line ref={chartRef} data={chartData} options={chartOptions} />
            </div>
            <aside style={styles.recentList}>
              <h3 style={{ marginTop: 0 }}>Recent entries (newest first)</h3>
              <div style={{ maxHeight: 360, overflow: 'auto' }}>
                {records.length === 0 && <div style={{ color: '#666' }}>No records yet</div>}
                {records.map((r) => (
                  <div key={r.id} style={styles.listItem}>
                    <div style={{ fontSize: 13 }}>
                      <strong>{r.temp ?? '—'}</strong> °C • <strong>{r.rpm ?? '—'}</strong> RPM • <strong>{r.load ?? '—'}</strong> A • <strong>{r.vibration ?? '—'}</strong> m/s² • <strong>{r.depth ?? '—'}</strong> mm
                    </div>
                    <div style={{ fontSize: 11, color: '#666' }}>
                      {r.createdAt && typeof r.createdAt.toDate === 'function' ? r.createdAt.toDate().toLocaleString() : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </section>

          <div style={{ marginTop: 12, color: '#333' }}>
            <small>Status: {status}</small>
            <br />
            <small>Sampling Rate: {samplingRate}</small>
          </div>
        </div>
        <DrillVisualization isActive={isDrillAnimating} latest={latest} />
      </main>

      <footer style={styles.footer}>
        <small>Tip: paste your Firebase config into <code>src/firebaseConfig.js</code></small>
      </footer>
    </div>
  );
}

function MetricCard({ title, value, unit, active, onClick, isAlert }) {
  return (
    <div onClick={onClick} style={{ ...styles.card, borderColor: active ? '#007bff' : '#eee' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: isAlert ? 'red' : '#000' }}>{value !== undefined ? value : 'N/A'} {unit}</div>
      <div style={{ color: '#666' }}>{title}</div>
    </div>
  );
}

const styles = {
  app: { 
    fontFamily: 'Inter, system-ui, Arial', 
    minHeight: '100vh', 
    background: '#f6fbff', 
    color: '#111' 
  },
  header: { 
    padding: 20, 
    borderBottom: '1px solid #e6eef7', 
    background: '#fff' 
  },
  main: { 
    display: 'grid', 
    gridTemplateColumns: '1fr 1fr', 
    gap: 20, 
    padding: 20, 
    maxWidth: '100vw',
    boxSizing: 'border-box'
  },
  contentWrapper: {
    maxHeight: 'calc(100vh - 120px)', // Subtract header and footer height
    overflowY: 'auto',
    paddingRight: 10
  },
  controls: { 
    display: 'flex', 
    gap: 10, 
    marginBottom: 20, 
    flexWrap: 'wrap' 
  },
  btn: { 
    padding: '10px 14px', 
    background: '#007bff', 
    color: '#fff', 
    border: 'none', 
    borderRadius: 8, 
    cursor: 'pointer' 
  },
  cardsRow: { 
    display: 'flex', 
    gap: 12, 
    marginBottom: 18, 
    flexWrap: 'wrap' 
  },
  card: { 
    flex: '1 1 180px', 
    background: '#fff', 
    padding: 14, 
    borderRadius: 10, 
    border: '2px solid #eee', 
    boxShadow: '0 4px 12px rgba(10,20,40,0.04)', 
    cursor: 'pointer' 
  },
  chartSection: { 
    display: 'grid', 
    gridTemplateColumns: '1fr 360px', 
    gap: 16, 
    alignItems: 'start' 
  },
  chartBox: { 
    background: '#fff', 
    padding: 12, 
    borderRadius: 10, 
    boxShadow: '0 6px 18px rgba(10,20,40,0.04)' 
  },
  recentList: { 
    background: '#fff', 
    padding: 12, 
    borderRadius: 10, 
    boxShadow: '0 6px 18px rgba(10,20,40,0.04)' 
  },
  listItem: { 
    padding: 8, 
    borderBottom: '1px solid #f0f3f6' 
  },
  footer: { 
    padding: 20, 
    textAlign: 'center', 
    color: '#666' 
  },
  drillContainer: {
    position: 'fixed',
    right: 0,
    top: 80, // Below header
    width: '50vw',
    height: 'calc(100vh - 120px)', // Subtract header and footer height
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  drillWrapper: { 
    width: 250, 
    height: 200, 
    position: 'relative', 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center',
    background: '#fff',
    borderRadius: 10,
    boxShadow: '0 6px 18px rgba(10,20,40,0.04)'
  },
  drillBody: { 
    width: 250, 
    height: 200, 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    zIndex: 1 
  },
  drillBit: { 
    width: 80, 
    height: 60, 
    position: 'absolute', 
    top: 16, 
    left: '-18%', 
    zIndex: 0 
  },
  metricLabel: {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.9)',
    padding: '5px 10px',
    borderRadius: 5,
    fontSize: 12,
    fontWeight: 500,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    zIndex: 2
  },
  tempLabel: {
    top: '5%',   // top of drill body
    left: '50%',
    transform: 'translateX(-50%)'
  },
  rpmLabel: {
    top: '30%',  // front, near drill bit
    left: '-140px'
  },
  vibrationLabel: {
    top: '45%',  // handle grip
    right: '-140px'
  },
  loadLabel: {
    bottom: '10%', // bottom near power cord
    right: '-140px'
  },
  depthLabel: {
    top: '80%', // near drill bit tip
    left: '-140px'
  }
  // Note: CSS for ::after pseudo-elements removed for brevity; add back if needed
};