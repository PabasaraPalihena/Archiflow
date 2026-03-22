import React from "react";
import { useNavigate } from "react-router-dom";

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>WAM Architecture Editor</h1>
      <button
        style={styles.button}
        onClick={() => navigate("/maincanvas")}
      >
        Open Main Canvas
      </button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "24px",
  },
  title: {
    margin: 0,
    fontSize: "28px",
  },
  button: {
  padding: "12px 24px",
  fontSize: "16px",
  cursor: "pointer",
  backgroundColor: "#000",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
},
};

export default Home;
