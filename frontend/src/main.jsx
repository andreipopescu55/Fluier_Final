import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// React 19: montam aplicatia cu createRoot.
// StrictMode = verificari suplimentare in dev (nu afecteaza productia).
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
