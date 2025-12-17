import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

console.log("DEBUG: main.jsx executing...");
const rootElement = document.getElementById('root');
if (!rootElement) {
    console.error("DEBUG: Root element NOT found!");
} else {
    console.log("DEBUG: Root element found, rendering App...");
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
}
